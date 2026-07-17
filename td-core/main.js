const { LEVELS } = require('./config');
const { simulate, simpleBot, simulateShop, SHOP } = require('./sim');

console.log('=== 免疫塔防 td-core 模拟器 ===');
console.log('模式A: 寻路网格 TD / 完美信息 greedy bot（已知病毒→最优克制塔）');
console.log(`模式B: 随机商店（槽位${SHOP.slots} / 红细胞权重17% / 每波自动刷新+手动≤${SHOP.maxRerollsPerWave}次 / 红细胞目标${SHOP.targetRed}）\n`);

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

for (const level of LEVELS) {
  // 模式A
  const plan = simpleBot(level);
  const repA = simulate(level, plan);
  const actsA = Object.entries(repA.activated).map(([k, v]) => `${k}×${v}`).join(', ') || '无';

  // 模式B：多 seed 取平均 / 胜率
  let wins = 0, leakSum = 0, tempSum = 0, rerollSum = 0, redSum = 0, depSum = 0;
  const details = [];
  for (const s of SEEDS) {
    const r = simulateShop(level, s);
    if (r.win) wins++;
    leakSum += r.leaks; tempSum += r.peakTemp; rerollSum += r.rerollTotal; redSum += r.redDeployed; depSum += r.deployTotal;
    details.push(`  seed${s}:${r.win ? '✓' : '✗'}(漏${r.leaks},峰${r.peakTemp.toFixed(1)}°,滚${r.rerollTotal},红${r.redDeployed},部署${r.deployTotal})`);
  }
  const n = SEEDS.length;
  const actsB = Object.entries(repA.activated).map(([k, v]) => `${k}×${v}`).join(', ') || '无';

  console.log(`================= ${level.name} =================`);
  console.log(`[A 完美信息] ${repA.win ? '通关 ✓' : '失败 ✗'} | 峰温${repA.peakTemp.toFixed(1)}° 漏${repA.leaks}/${repA.spawned} 部署:${actsA}`);
  console.log(`[B 随机商店] 胜率 ${wins}/${n} | 平均漏${(leakSum / n).toFixed(1)} 峰温${(tempSum / n).toFixed(1)}° 平均刷新${(rerollSum / n).toFixed(1)}次 平均红细胞${(redSum / n).toFixed(1)} 平均部署${(depSum / n).toFixed(1)}`);
  console.log(details.join('\n'));
  console.log('');
}
