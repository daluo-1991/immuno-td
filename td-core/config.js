// 免疫塔防 核心配置（v0.4 草案，对齐保卫向日葵模板：6×9 网格 + U形路径 + 预置开局塔）
// 单位：距离=格，时间=秒，dps=每秒伤害
//
// 设计参照：保卫向日葵（成熟微信小游戏 TD）
//   - 网格 6×9（比其 5×4 略大，因我们有 8 种细胞需更多摆位）
//   - U 形路径绕摆位区一周（迷宫 B 模式标准布局）
//   - 预置开局塔（解决"新手乱摆过不了第一关"问题）
//   - range 下限 3.0（在 6×9 紧凑网格中保证覆盖）

const CELLS = {
  // 七战斗塔（size=占用格子数，weight=商店随机池权重）
  // range 下限 = 3.0：6×9 紧凑网格中，直角方向 3 格 / 圆半径 3 格
  neutrophil: { name: '中性粒细胞', role: 'basic',  cost: 20, dps: 12, range: 3.0, atkType: 'single', atkSpeed: 1.2, size: 1, weight: 11.86 },
  macrophage: { name: '巨噬细胞',   role: 'aoe',    cost: 30, dps: 9,  range: 3.0, aoe: 1.5, slow: 0.3, atkSpeed: 1.0, size: 2, weight: 11.86 },
  tcell:      { name: 'T细胞',      role: 'sniper', cost: 35, dps: 30, range: 5.0, atkSpeed: 0.5, size: 1, weight: 11.86 },
  antibody:   { name: '抗体',       role: 'debuff', cost: 30, dps: 0,  range: 4.0, debuff: { type: 'vuln', mult: 1.5 }, atkSpeed: 1.0, size: 1, weight: 11.86 },
  nk:         { name: 'NK细胞',     role: 'fast',   cost: 28, dps: 18, range: 3.0, atkSpeed: 2.0, size: 1, weight: 11.86 },
  interferon: { name: '干扰素',     role: 'aura',   cost: 40, dps: 0,  range: 4.0, aura: { atkSpeed: 1.3, dmg: 1.3 }, size: 2, weight: 11.86 },
  memory:     { name: '记忆细胞',   role: 'intel',  cost: 45, dps: 0, intel: true, size: 2, weight: 11.86 },
  // 经济塔
  redcell:    { name: '红细胞',     role: 'economic', cost: 10, energyRate: 2, hp: 30, size: 1, weight: 17 },
};

// 商店配置（参照保卫向日葵：4槽位+刷新）
const SHOP = {
  slots: 4,
  rerollCost: 15,
  maxRerollsPerWave: 3,
  targetRed: 3,
};

// 从 CELLS.weight 派生权重表
const WEIGHTS = {};
for (const k in CELLS) WEIGHTS[k] = CELLS[k].weight;

// 克制矩阵：伤害系数 = MATRIX[病毒][细胞]
const MATRIX = {
  rhinovirus: { neutrophil: 1.0, macrophage: 1.0, tcell: 0.8, antibody: 1.6, nk: 1.0, interferon: 1.0, memory: 1.0, redcell: 0 },
  influenza:  { neutrophil: 1.0, macrophage: 1.0, tcell: 1.6, antibody: 0.8, nk: 1.0, interferon: 1.0, memory: 1.0, redcell: 0 },
  enveloped:  { neutrophil: 1.0, macrophage: 1.5, tcell: 0.8, antibody: 1.0, nk: 1.0, interferon: 1.0, memory: 1.0, redcell: 0 },
  nonenv:     { neutrophil: 1.0, macrophage: 1.0, tcell: 1.0, antibody: 1.6, nk: 1.0, interferon: 1.0, memory: 1.0, redcell: 0 },
  mutant:     { neutrophil: 1.0, macrophage: 0.8, tcell: 1.6, antibody: 1.0, nk: 1.0, interferon: 1.0, memory: 1.0, redcell: 0 },
};

const VIRUSES = {
  rhinovirus: { name: '感冒病毒',   hp: 50,  speed: 0.5, split: false },
  influenza:  { name: '流感病毒',   hp: 80,  speed: 0.6, split: false },
  enveloped:  { name: '包膜病毒',   hp: 150, speed: 0.4, split: false },
  nonenv:     { name: '无包膜病毒', hp: 70,  speed: 0.9, split: false },
  mutant:     { name: '变异株Boss', hp: 800, speed: 0.5, split: false },
};

const BALANCE = {
  baseTemp: 37.0,
  failTemp: 42.0,
  tempPerVirus: 0.15,
  naturalCool: -0.3,
  baseEnergyRegen: 1,
  tickSec: 0.1,
};

// ============================================================
// 关卡设计 v0.4 — 6×9 网格，外环路径 + 内格摆位（保卫向日葵模板）
// ============================================================
//
// 坐标系：col 0-5(左→右), row 0-8(上→下)
// 外环 = 病毒通道（col=0 / col=5 / row=0 / row=8）
// 内格 = 摆位区（col 1-4, row 1-7，共 4×7=28 格）
//
// L1 外环路径示意（C 形 / 开口在顶部）：
//   row0:  E · · · · X      E=入口(0,0)  X=出口(5,0)
//   row1:  P · · · · P      P=外环路径
//   row2:  P · · · · P      ·=内格摆位区
//   row3:  P · · · · P
//   row4:  P · · · · P
//   row5:  P · · · · P
//   row6:  P · · · · P
//   row7:  P · · · · P
//   row8:  P P P P P P      底边整行路径
//
//  paths[0] = 入口(0,0) → 沿左列下 → 底边右 → 右列上 → 出口(5,0)
//
// L2/L3 双入口：左右上角各一，共享底边，在底部汇合（双侧压力）
//

const LEVELS = [
  {
    // L1：入门关 — 单入口外环 C 形路径，预置 1 红细胞 + 1 中性粒
    id: 1, name: 'L1', cols: 6, rows: 9,
    entrances: [{ col: 0, row: 0 }],
    exit: { col: 5, row: 0 },
    feverThreshold: 42,
    energyStart: 30,
    // 外环 C 形路径：左列下 → 底边 → 右列上
    paths: [
      [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8],
       [1,8],[2,8],[3,8],[4,8],[5,8],
       [5,7],[5,6],[5,5],[5,4],[5,3],[5,2],[5,1],[5,0]],
    ],
    preplaced: [
      { type: 'redcell',    col: 2, row: 3 },   // 红细胞：内格中心偏上
      { type: 'neutrophil', col: 3, row: 4 },   // 中性粒：内格中心偏下，覆盖左右外环
    ],
    waves: [
      { virus: 'rhinovirus', count: 5, interval: 3.0 },
      { virus: 'rhinovirus', count: 5, interval: 2.5 },
      { virus: 'rhinovirus', count: 5, interval: 2.0 },
    ],
  },
  {
    // L2：双入口 — 左右上角各一，共享底边汇合，预置 3 塔
    id: 2, name: 'L2', cols: 6, rows: 9,
    entrances: [{ col: 0, row: 0 }, { col: 5, row: 0 }],
    exit: { col: 5, row: 8 },
    feverThreshold: 42,
    energyStart: 30,
    // 路径 0：入口(0,0) → 左列下 → 底边 → 出口(5,8)
    // 路径 1：入口(5,0) → 右列下 → 底边 → 出口(0,8)
    paths: [
      [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8]],
      [[5,0],[5,1],[5,2],[5,3],[5,4],[5,5],[5,6],[5,7],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]],
    ],
    preplaced: [
      { type: 'redcell',    col: 2, row: 3 },
      { type: 'neutrophil', col: 3, row: 4 },
      { type: 'macrophage', col: 2, row: 5 },   // AOE 守底边汇合区
    ],
    waves: [
      { virus: 'rhinovirus', count: 6, interval: 3.0 },
      { virus: 'influenza',  count: 4, interval: 3.0 },
      { virus: 'rhinovirus', count: 4, interval: 2.5 },
      { virus: 'influenza',  count: 6, interval: 2.0 },
    ],
  },
  {
    // L3：双入口 + 高血量病毒，预置 4 塔（双红细胞 + 中性粒 + T细胞）
    id: 3, name: 'L3', cols: 6, rows: 9,
    entrances: [{ col: 0, row: 0 }, { col: 5, row: 0 }],
    exit: { col: 5, row: 8 },
    feverThreshold: 42,
    energyStart: 40,
    paths: [
      [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8]],
      [[5,0],[5,1],[5,2],[5,3],[5,4],[5,5],[5,6],[5,7],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]],
    ],
    preplaced: [
      { type: 'redcell',    col: 1, row: 2 },
      { type: 'redcell',    col: 4, row: 2 },
      { type: 'neutrophil', col: 2, row: 4 },
      { type: 'tcell',      col: 3, row: 5 },
    ],
    waves: [
      { virus: 'rhinovirus', count: 5, interval: 3.0 },
      { virus: 'enveloped',  count: 3, interval: 4.0 },
      { virus: 'rhinovirus', count: 5, interval: 2.5 },
      { virus: 'nonenv',     count: 4, interval: 3.0 },
      { virus: 'enveloped',  count: 4, interval: 3.5 },
    ],
  },
];

module.exports = { CELLS, MATRIX, VIRUSES, BALANCE, LEVELS, SHOP, WEIGHTS };
