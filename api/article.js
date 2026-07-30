// Vercel 函数：抽取单篇文章正文。
// 用法：/api/article?url=<文章链接>  →  { text }
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export const config = { maxDuration: 60 };

const clean = t => (t || '').replace(/\s+/g, ' ').trim();

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost').searchParams.get('url');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!url) { res.statusCode = 400; res.end(JSON.stringify({ text: '' })); return; }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: ctrl.signal });
    clearTimeout(timer);
    const html = await r.text();
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    const text = clean(article ? article.textContent : '');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.statusCode = 200;
    res.end(JSON.stringify({ text }));
  } catch (e) {
    res.statusCode = 200;
    res.end(JSON.stringify({ text: '' })); // 失败交给前端回退
  }
}
