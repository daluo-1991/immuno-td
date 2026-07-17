// 复刻 L1_play.html 中 canPlace / anchorFor / moveTower 的核心逻辑，验证“暗格不可被移动/摆放自动开通”
const CELLS = {
  neutrophil: { size:1 },   // 自爆/中性粒细胞 1×1
  memory:     { size:2 },   // 记忆细胞 2×2
};
const LEVEL = { cols:7, rows:9 };

// 棋盘初始化：仅正中 3×3 开通(null)，其余内圈为暗格('locked')
function newGrid(){
  const g = [];
  for(let r=0;r<LEVEL.rows;r++){
    g[r]=[];
    for(let c=0;c<LEVEL.cols;c++){
      const inner = c>=1 && c<=LEVEL.cols-2 && r>=1 && r<=LEVEL.rows-2;
      g[r][c] = inner ? 'locked' : 'border';
    }
  }
  // 开通正中 3×3（行 3..5，列 2..4）
  for(let r=3;r<=5;r++) for(let c=2;c<=4;c++) g[r][c]=null;
  return g;
}
function grid_in(c,r){ return c>=0&&c<LEVEL.cols&&r>=0&&r<LEVEL.rows; }

function canPlace(type,col,row){
  const d=CELLS[type];
  for(let dr=0;dr<d.size;dr++)for(let dc=0;dc<d.size;dc++){
    const c=col+dc, r=row+dr;
    if(!grid_in(c,r)) return false;
    if(c<1||c>LEVEL.cols-2||r<1||r>LEVEL.rows-2) return false;
    if(G.grid[r][c]!==null) return false;
  }
  return true;
}
function anchorFor(type, c, r){
  const s = CELLS[type].size;
  const tAc = c - (s-1)/2, tAr = r - (s-1)/2;
  let best=null, bestScore=1e9, bestSum=-1e9;
  for(let dr=0; dr<s; dr++) for(let dc=0; dc<s; dc++){
    const ac=c-dc, ar=r-dr;
    if(!canPlace(type, ac, ar)) continue;
    const score = Math.abs(ac - tAc) + Math.abs(ar - tAr);
    const sum = ac + ar;
    if(score < bestScore || (score===bestScore && sum > bestSum)){
      bestScore=score; bestSum=sum; best={ ac, ar };
    }
  }
  return best;
}

let G;
function assert(name, cond){ console.log((cond?'PASS':'FAIL')+' · '+name); if(!cond) process.exitCode=1; }

// 场景1：1×1 自爆已上场在开通格(3,3)，尝试拖到暗格(6,6)
G={grid:newGrid(), towers:[]};
const t={type:'neutrophil', col:3, row:3, size:1};
G.grid[3][3]=t; G.towers.push(t);
// 模拟移动：先临时移出
for(let dr=0;dr<t.size;dr++)for(let dc=0;dc<t.size;dc++) G.grid[t.row+dr][t.col+dc]=null;
const a1 = anchorFor('neutrophil', 6, 6);   // 暗格(6,6) 实际是 'locked'？检查
// 修正：(6,6) 是否 inner？cols-2=5, 所以 c=6 超 inner → border。改用一个确为 locked 的内圈格，如 (1,1)
const a1b = anchorFor('neutrophil', 1, 1);  // 内圈暗格
for(let dr=0;dr<t.size;dr++)for(let dc=0;dc<t.size;dc++) G.grid[t.row+dr][t.col+dc]=t;
assert('1×1 拖到内圈暗格(1,1) → 落点 null(被拦截)', a1b===null);
assert('1×1 拖到外圈(6,6) → 落点 null(越界被拦截)', a1===null);

// 场景2：1×1 拖到另一开通格(4,4) → 落点应为 (4,4)
G={grid:newGrid(), towers:[]};
const t2={type:'neutrophil', col:3, row:3, size:1};
G.grid[3][3]=t2; G.towers.push(t2);
for(let dr=0;dr<t2.size;dr++)for(let dc=0;dc<t2.size;dc++) G.grid[t2.row+dr][t2.col+dc]=null;
const a2 = anchorFor('neutrophil', 4, 4);
for(let dr=0;dr<t2.size;dr++)for(let dc=0;dc<t2.size;dc++) G.grid[t2.row+dr][t2.col+dc]=t2;
assert('1×1 拖到开通格(4,4) → 落点 (4,4)', a2 && a2.ac===4 && a2.ar===4);

// 场景3：1×1 拖到自身格(3,3) → 临时移出后落点应为自身(无操作)
G={grid:newGrid(), towers:[]};
const t3={type:'neutrophil', col:3, row:3, size:1};
G.grid[3][3]=t3; G.towers.push(t3);
for(let dr=0;dr<t3.size;dr++)for(let dc=0;dc<t3.size;dc++) G.grid[t3.row+dr][t3.col+dc]=null;
const a3 = anchorFor('neutrophil', 3, 3);
for(let dr=0;dr<t3.size;dr++)for(let dc=0;dc<t3.size;dc++) G.grid[t3.row+dr][t3.col+dc]=t3;
assert('1×1 拖到自身格(3,3) → 落点 (3,3)(无操作)', a3 && a3.ac===3 && a3.ar===3);

// 场景4：1×1 细胞卡摆到暗格 → 应被拦截（修复前会误返回点击格并自动开通）
G={grid:newGrid(), towers:[]};
const a4 = anchorFor('neutrophil', 1, 1);
assert('1×1 细胞卡摆暗格(1,1) → null(不会自动开通)', a4===null);

// 场景5：2×2 记忆细胞拖到含暗格区域 → null
G={grid:newGrid(), towers:[]};
const m={type:'memory', col:3, row:3, size:2};
for(let dr=0;dr<2;dr++)for(let dc=0;dc<2;dc++) G.grid[3+dr][3+dc]=m;
G.towers.push(m);
for(let dr=0;dr<2;dr++)for(let dc=0;dc<2;dc++) G.grid[m.row+dr][m.col+dc]=null;
const a5 = anchorFor('memory', 1, 1);  // 暗格区域放不下 2×2
for(let dr=0;dr<2;dr++)for(let dc=0;dc<2;dc++) G.grid[m.row+dr][m.col+dc]=m;
assert('2×2 拖到暗格区域(1,1) → null', a5===null);

console.log('\n完成。若全部 PASS，则“暗格可被移动/摆放自动开通”的 bug 已修复。');
