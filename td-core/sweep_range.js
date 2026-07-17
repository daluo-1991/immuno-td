// 扫描：射程倍数 × 攻击倍数 对各摆放档胜率的影响（验证"加射程降攻击"是否改变结果）
const { CELLS, LEVELS } = require('./config');
const { simulateShop } = require('./sim');

const N = 30;
const base = {};
for (const k in CELLS) base[k] = { range: CELLS[k].range, dps: CELLS[k].dps };

function applyMult(rm, dm) {
  for (const k in CELLS) {
    if (base[k].range) CELLS[k].range = +(base[k].range * rm).toFixed(2);
    if (base[k].dps > 0) CELLS[k].dps = +(base[k].dps * dm).toFixed(1);
  }
}
function winRate(level, mode) {
  let win = 0;
  for (let s = 1; s <= N; s++) if (simulateShop(level, s * 7919, { mode }).win) win++;
  return (win / N * 100).toFixed(0);
}

const modes = ['smart', 'bottom', 'clueless'];
const rms = [1.0, 1.5, 2.0];
const dms = [1.0, 0.7];
for (const rm of rms) for (const dm of dms) {
  applyMult(rm, dm);
  console.log(`\n=== 射程×${rm}  攻击×${dm} ===`);
  for (const lv of LEVELS) {
    const parts = modes.map(m => `${m}:${winRate(lv, m)}%`).join('  ');
    console.log(`  ${lv.name}: ${parts}`);
  }
}
