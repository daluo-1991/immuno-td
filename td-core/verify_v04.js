// v0.4 验证：6×9 网格 + 保卫向日葵模板（U形路径 + 预置开局塔）
// 对比三档摆放水平 × L1-L3 的通关率
const { CELLS, LEVELS } = require('./config');
const { simulateShop } = require('./sim');

const N = 60;
const TAG = {
  smart: '老手(沿路铺开)',
  naive: '半懂(路边随机)',
  clueless: '手残(全图乱扔)',
};

function winRate(level, mode) {
  let win = 0, leakSum = 0, tempSum = 0;
  for (let s = 1; s <= N; s++) {
    const r = simulateShop(level, s * 7919, { mode });
    if (r.win) win++;
    leakSum += r.leaks;
    tempSum += r.peakTemp;
  }
  return {
    win,
    rate: (win / N * 100).toFixed(0),
    leak: (leakSum / N).toFixed(1),
    temp: (tempSum / N).toFixed(1),
  };
}

console.log(`═══ 免疫塔防 v0.4 验证 ═══`);
console.log(`网格: 6×9 | 模板: 保卫向日葵 (U形路径 + 预置开局塔)`);
console.log(`range 下限: ${CELLS.neutrophil.range} | T细胞: ${CELLS.tcell.range}`);
console.log(`每组 N=${N} 种子\n`);

for (const lv of LEVELS) {
  console.log(`===== ${lv.name} (${lv.cols}×${lv.rows}, 入口${lv.entrances.length}个, 预置${(lv.preplaced||[]).length}塔) =====`);
  for (const mode of ['smart', 'naive', 'clueless']) {
    const r = winRate(lv, mode);
    console.log(`  ${TAG[mode]}`);
    console.log(`    胜率 ${r.rate}% (${r.win}/${N}) | 平均漏怪 ${r.leak} | 峰温 ${r.temp}°`);
  }
  // 打印预置塔信息
  if (lv.preplaced && lv.preplaced.length) {
    console.log(`  预置: ${lv.preplaced.map(p => `${CELLS[p.type].name}@(${p.col},${p.row})`).join(', ')}`);
  }
  console.log('');
}
