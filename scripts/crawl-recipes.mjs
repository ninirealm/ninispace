// 构建时从 TheMealDB（免费、无需密钥）抓取真实食谱，写入 recipes.json
// 仅构建时运行（Node fetch，无 CORS / 无墙问题）；线上站点直接读 recipes.json
import { writeFileSync } from 'node:fs';

const API = 'https://www.themealdb.com/api/json/v1/1';

// TheMealDB 分类 -> 应用内中文分类
const TARGETS = [
  { cat: 'Dessert',   zh: '甜点',   limit: 18 },
  { cat: 'Breakfast', zh: '吐司',   limit: 18 },
  { cat: 'Beef',      zh: '家常菜', limit: 16 },
  { cat: 'Chicken',   zh: '家常菜', limit: 16 },
  { cat: 'Seafood',   zh: '家常菜', limit: 16 },
  { cat: 'Vegetarian',zh: '家常菜', limit: 16 },
  { cat: 'Pasta',     zh: '家常菜', limit: 16 },
];

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.json();
}
function diffFromIngredients(n) {
  if (n <= 4) return 1;
  if (n <= 7) return 2;
  if (n <= 10) return 3;
  if (n <= 14) return 4;
  return 5;
}

async function main() {
  const out = [];
  let seq = 0;
  for (const t of TARGETS) {
    try {
      const filt = await getJSON(`${API}/filter.php?c=${encodeURIComponent(t.cat)}`);
      const meals = (filt.meals || []).slice(0, t.limit);
      for (const m of meals) {
        try {
          const det = await getJSON(`${API}/lookup.php?i=${m.idMeal}`);
          const meal = det.meals && det.meals[0];
          if (!meal) continue;
          const ings = [];
          for (let i = 1; i <= 20; i++) {
            const ing = (meal['strIngredient' + i] || '').trim();
            const mea = (meal['strMeasure' + i] || '').trim();
            if (ing) ings.push((mea ? mea + ' ' : '') + ing);
          }
          const steps = (meal.strInstructions || '')
            .split(/\r?\n/).map(s => s.trim()).filter(Boolean)
            .join('\n');
          out.push({
            id: 'rl' + (++seq),
            name: meal.strMeal,
            category: t.zh,
            difficulty: diffFromIngredients(ings.length),
            rating: 0,
            thumb: meal.strMealThumb || '',
            ingredients: ings.join('\n'),
            steps,
            source: meal.strSource || (`https://www.themealdb.com/meal/${meal.idMeal}`),
            note: meal.strArea ? `菜系：${meal.strArea}（来自 TheMealDB）` : '来自 TheMealDB',
          });
        } catch (e) { /* 单条失败跳过 */ }
      }
      console.log(`✓ ${t.cat} -> ${t.zh} 已抓取`);
    } catch (e) {
      console.warn(`✗ ${t.cat} 失败: ${e.message}`);
    }
  }
  writeFileSync(new URL('../recipes.json', import.meta.url), JSON.stringify(out, null, 2));
  console.log(`\n共生成 ${out.length} 条真实食谱 -> recipes.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
