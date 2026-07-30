// 构建时从 Wikimedia Commons（公共领域 / 自由授权）抓取绘画参考图，写入 drawings.json
// 仅构建时运行；线上站点直接读 drawings.json
// 注：Wikimedia API 会拒绝 Node fetch 的默认 UA，统一走 curl（沙箱与 GitHub Actions 均预装）
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Commons 分类 -> 应用内中文分类 / 主题
const SOURCES = [
  { cat: 'Category:Pencil drawings',     zh: '铅笔素描', theme: '素描造型', limit: 30 },
  { cat: 'Category:Charcoal drawings',   zh: '铅笔素描', theme: '素描造型', limit: 20 },
  { cat: 'Category:Colored pencil drawings', zh: '彩铅', theme: '彩铅上色', limit: 30 },
  { cat: 'Category:Watercolor paintings', zh: '彩铅',   theme: '彩铅上色', limit: 20 },
  { cat: 'Category:Acrylic paintings',   zh: '丙烯画',  theme: '丙烯创作', limit: 30 },
  { cat: 'Category:Line drawings',       zh: '简笔画',  theme: '简笔线条', limit: 30 },
];

async function getJSON(params) {
  const url = API + '?action=query&format=json&' + params;
  const out = execFileSync('curl', ['-sS', '-A', UA, url], { maxBuffer: 1 << 28 });
  return JSON.parse(out.toString());
}

async function main() {
  const out = [];
  let seq = 0;
  for (const s of SOURCES) {
    try {
      const data = await getJSON(new URLSearchParams({
        generator: 'categorymembers',
        gcmtype: 'file',
        gcmtitle: s.cat,
        gcmlimit: String(s.limit),
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|mime',
        iiurlwidth: '500',
      }).toString());
      const pages = (data.query && data.query.pages) || {};
      for (const pid of Object.keys(pages)) {
        const p = pages[pid];
        const ii = p.imageinfo && p.imageinfo[0];
        if (!ii) continue;
        if (!/^image\//.test(ii.mime || '')) continue; // 只要图片
        const lic = (ii.extmetadata && ii.extmetadata.LicenseShortName && ii.extmetadata.LicenseShortName.value) || '未知';
        out.push({
          id: 'dl' + (++seq),
          name: p.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
          category: s.zh,
          theme: s.theme,
          difficulty: 1 + (seq % 5),
          refPath: ii.url || '',           // 500px 缩略图
          tutorial: ii.descriptionurl || '',
          status: '想画',
          lic,
        });
      }
      console.log(`✓ ${s.cat} -> ${s.zh} 取到 ${Object.keys(pages).length} 个`);
    } catch (e) {
      console.warn(`✗ ${s.cat} 失败: ${e.message}`);
    }
  }
  writeFileSync(new URL('../drawings.json', import.meta.url), JSON.stringify(out, null, 2));
  console.log(`\n共生成 ${out.length} 条绘画参考 -> drawings.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
