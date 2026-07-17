const cfg = require('./config');
const { simulateShop } = require('./sim');
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function setRed(w) {
  cfg.WEIGHTS.redcell = w;
  const rest = (100 - w) / 7;
  for (const k in cfg.WEIGHTS) if (k !== 'redcell') cfg.WEIGHTS[k] = rest;
}

for (const w of [17, 22, 25, 30]) {
  setRed(w);
  console.log(`\n##### 红细胞商店权重 ${w}% #####`);
  for (const level of cfg.LEVELS) {
    let wins = 0, leak = 0, red = 0, fever = 0;
    for (const s of SEEDS) {
      const r = simulateShop(level, s);
      if (r.win) wins++; else if (r.reason === 'fever') fever++;
      leak += r.leaks; red += r.redDeployed;
    }
    console.log(`  ${level.name}: 胜率 ${wins}/8 | 平均漏${(leak / 8).toFixed(1)} | 平均红细胞${(red / 8).toFixed(1)} | 失败因发烧 ${fever}`);
  }
}
