// Vercel 函数：返回最新真实新闻 JSON。
// 通过 Cache-Control 让 CDN 每天只重新抓取一次（实现「每天爬取」）。
import { crawlNews } from './_lib/crawl.mjs';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  try {
    const data = await crawlNews();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(e && e.message || e) }));
  }
}
