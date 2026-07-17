// 验证用户场景：摆位区在最右2列，路径走 上+左+下 三边（开口朝右的马蹄形）
// 算"路径上有多少格能被摆位区任何一格在给定 range 内打到"
const COLS = 7, ROWS = 12;
const path = new Set();
const key = (c, r) => c + ',' + r;
for (let c = 0; c < COLS; c++) { path.add(key(c, 0)); path.add(key(c, ROWS - 1)); }
for (let r = 0; r < ROWS; r++) path.add(key(0, r));

// 摆位区：最右2列(col 5,6)，排除落在路径上的格(第0/11行)
const place = [];
for (let r = 1; r < ROWS - 1; r++) for (let c = COLS - 2; c < COLS; c++) place.push([c, r]);

function fracInRange(R) {
  let covered = 0, total = 0;
  for (const k of path) {
    const [pc, pr] = k.split(',').map(Number);
    total++;
    for (const [qc, qr] of place) {
      if (Math.hypot(pc - qc, pr - qr) <= R) { covered++; break; }
    }
  }
  return (covered / total * 100).toFixed(0);
}
console.log(`网格 ${COLS}×${ROWS} | 摆位区=最右2列 | 路径=上+左+下 三边\n`);
for (const R of [2.5, 3.5, 4.5, 6, 7]) {
  console.log(`range ${R}: 路径被覆盖 ${fracInRange(R)}%`);
}
// 最致命的一段：左边整列路径(col 0)到最近摆位格(col 5)的水平距离
console.log(`\n左边路径(col0)到最近摆位(col5)水平距离 = 5 格`);
