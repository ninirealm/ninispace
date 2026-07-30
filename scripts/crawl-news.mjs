// 生成 news.json 真实新闻快照：node scripts/crawl-news.mjs
// 供沙箱预览 / 首次部署使用；线上由 api/news.js 覆盖。
import { crawlNews } from '../api/_lib/crawl.mjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, '..', 'news.json');

const data = await crawlNews();
writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
console.log('✅ wrote', out, '| items =', data.items.length, '| updated =', data.updated);
