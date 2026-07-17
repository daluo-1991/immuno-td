// 验证"贴脸门槛"：三档摆放水平 × 巨噬 range 2.0 vs 2.5 的通关率对比
// 老手(smart)=沿路径均匀铺开 | 半懂(naive)=路边2格随机 | 手残(clueless)=全图乱扔
const { CELLS, LEVELS } = require('./config');
const { simulateShop } = require('./sim');

const N = 60; // 每组随机种子数

function winRate(level, mode, macRange) {
  CELLS.macrophage.range = macRange; // 临时改巨噬 range（sim 引用同一对象）
  let win = 0, leakSum = 0, tempSum = 0;
  for (let s = 1; s <= N; s++) {
    const r = simulateShop(level, s * 7919, { mode });
    if (r.win) win++;
    leakSum += r.leaks; tempSum += r.peakTemp;
  }
  return { win, rate: (win / N * 100).toFixed(0), leak: (leakSum / N).toFixed(1), temp: (tempSum / N).toFixed(1) };
}

const TAG = { smart: '老手(沿路铺开)', naive: '半懂(路边随机)', bottom: '堆出口侧(入口留真空)', clueless: '手残(全图乱扔)' };

console.log(`\n每组 N=${N} 随机种子 | 网格 7×12\n`);
for (const lv of LEVELS) {
  console.log(`===== ${lv.name} =====`);
  for (const mode of ['smart', 'naive', 'bottom', 'clueless']) {
    const a = winRate(lv, mode, 2.0);
    const b = winRate(lv, mode, 2.5);
    console.log(`  ${TAG[mode]}`);
    console.log(`    巨噬 range 2.0 → 胜率 ${a.rate}% (${a.win}/${N}) 平均漏 ${a.leak} 峰温 ${a.temp}°`);
    console.log(`    巨噬 range 2.5 → 胜率 ${b.rate}% (${b.win}/${N}) 平均漏 ${b.leak} 峰温 ${b.temp}°`);
  }
  console.log('');
}
