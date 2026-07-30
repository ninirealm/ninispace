// 共享新闻爬取逻辑：供 scripts/crawl-news.mjs（生成快照）与 api/news.js（线上按需）复用
// 现在同时抽取每篇全文，写入 fullText，前端可直接展示，无需运行时函数/客户端代理。
import Parser from 'rss-parser';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

// 集中管理的 RSS 源（可随时扩展）。
// 注：财经/深圳本地等中文 RSS 大多已失效（实测 404/403），这里用实测稳定可用的源。
export const FEEDS = [
  { url: 'https://www.ithome.com/rss/',                  source: 'IT之家',   category: '科技·数码' },
  { url: 'https://sspai.com/feed',                       source: '少数派',   category: '科技·数码' },
  { url: 'https://36kr.com/feed',                        source: '36氪',     category: '商业·创投' },
  { url: 'http://www.people.com.cn/rss/politics.xml',    source: '人民日报', category: '时政·综合' },
];

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}
const asText = s => (s || '').replace(/\s+/g, ' ').trim();
const clean = t => (t || '').replace(/\s+/g, ' ').trim();

async function extractFullText(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return '';
    const html = await r.text();
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    return clean(article ? article.textContent : '');
  } catch (e) { return ''; }
}

// 简单并发池
async function pool(items, worker, size = 4) {
  const out = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => run()));
  return out;
}

export async function crawlNews() {
  const parser = new Parser({ timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const results = await Promise.all(FEEDS.map(async (feed) => {
    try {
      const f = await parser.parseURL(feed.url);
      return (f.items || []).slice(0, 12).map(it => {
        const raw = it.contentSnippet || it.summary || it.content || '';
        const summary = asText(stripHtml(raw)).slice(0, 160);
        const ts = it.isoDate || it.pubDate || null;
        return {
          id: hashStr(feed.source + (it.link || it.title || '')),
          title: asText(it.title),
          link: it.link || '',
          source: feed.source,
          category: feed.category,
          pubDate: ts ? new Date(ts).toISOString() : null,
          summary,
        };
      }).filter(x => x.title && x.link);
    } catch (e) {
      console.error('feed failed:', feed.source, e.message);
      return [];
    }
  }));

  let items = results.flat();
  const seen = new Set();
  items = items.filter(x => { if (seen.has(x.link)) return false; seen.add(x.link); return true; });
  items.sort((a, b) => (b.pubDate ? new Date(b.pubDate) : 0) - (a.pubDate ? new Date(a.pubDate) : 0));

  // 并发抽取全文（带超时）；失败则回退摘要
  const texts = await pool(items, async (it) => {
    const ft = await extractFullText(it.link);
    return ft.length > 40 ? ft : it.summary;
  }, 4);

  items = items.map((it, i) => ({ ...it, fullText: texts[i] }));
  return { updated: new Date().toISOString(), items };
}
