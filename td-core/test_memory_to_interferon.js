const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('L1_play.html', 'utf-8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl(id){
  const el = {
    id, _children:[], textContent:'', innerHTML:'', value:'', width:336, height:432,
    style:new Proxy({},{get:()=>'' ,set:()=>true}),
    classList:{ _s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,f){ f?this._s.add(c):this._s.delete(c) }, contains(c){return this._s.has(c)} },
    onclick:null, oninput:null, onchange:null,
    addEventListener(){}, removeEventListener(){},
    appendChild(c){ this._children.push(c); }, get childElementCount(){ return this._children.length; },
    getContext(){ return ctxStub; },
    getBoundingClientRect(){ return { left:0, top:0, width:336, height:432 }; },
    setPointerCapture(){}, releasePointerCapture(){},
  };
  return el;
}
const ctxStub = new Proxy({}, { get(){ return ()=>{}; }});
const els = {};
const document = {
  getElementById(id){ if(!els[id]) els[id]=makeEl(id); return els[id]; },
  addEventListener(){}, createElement(){ return makeEl('dyn'); },
  body:{ appendChild(){} },
};
const window = {};
const requestAnimationFrame = ()=>{};
const setInterval = ()=>0;
const setTimeout = (fn)=>0;
const alert = ()=>{};

const ctx = {
  document, window, requestAnimationFrame, setInterval, setTimeout, alert, console,
  Math, Date, JSON, Object, Array, Proxy, String, Number, Boolean, isNaN, parseInt, parseFloat, Set, Map, WeakMap, Error,
};
ctx.globalThis = ctx;

const exposed = script + `
window.__api = {
  getG:()=>G, CELLS, placeTower, tryMoveOrSwap, trySwap, start, renderShop, updateHUD, anchorFor, canPlace, removeTowerFromGrid, restoreTowerToGrid,
};`;
new vm.Script(exposed).runInNewContext(ctx);

const api = window.__api;
api.start();
const G = api.getG();

let passed = 0, failed = 0;
function assert(msg, cond) { if (cond) { passed++; console.log('✅', msg); } else { failed++; console.log('❌', msg); } }

// 开通中间 5x5 区域 (c:2..6, r:2..6)
for (let r = 2; r <= 6; r++) {
  for (let c = 2; c <= 6; c++) {
    G.grid[r][c] = null;
  }
}
G.shop = [null, null, null, null];
G.towers = [];

// 场景：记忆细胞在 (3,3) 占 footprint (3,3)-(4,4)；干扰细胞在 (4,5)（记忆的右下邻格）
// 用户想把记忆移到 (3,4)：新 footprint (3,4)-(4,5)，覆盖了干扰细胞 (4,5)
const mem = api.placeTower('memory', 3, 3);
const inter = api.placeTower('interferon', 4, 5);

console.log('--- 初始 ---');
console.log('towers:', G.towers.map(t=>({type:t.type, col:t.col, row:t.row})));
console.log('mem footprint:', `(${mem.col},${mem.row})-(${mem.col+1},${mem.row+1})`);

const result = api.tryMoveOrSwap(mem, 3, 4);
console.log('\n--- 移动记忆到 (3,4) ---');
console.log('result:', result);
console.log('mem now:', mem.col, mem.row);
console.log('towers:', G.towers.map(t=>({type:t.type, col:t.col, row:t.row})));
console.log('shop:', G.shop);
console.log('grid (4,5):', G.grid[5][4] && G.grid[5][4].type);
console.log('grid (3,5):', G.grid[5][3] && G.grid[5][3].type);
console.log('grid (4,4):', G.grid[4][4] && G.grid[4][4].type);
console.log('grid (3,4):', G.grid[4][3] && G.grid[4][3].type);

assert('移动应成功', result.ok === true);
assert('记忆现在覆盖 (3,4)-(4,5)', mem.col === 3 && mem.row === 4);
assert('干扰被顶掉（不在场上）', !G.towers.includes(inter));
assert('干扰被顶回商店', G.shop.includes('interferon'));
assert('新 footprint 四格都是记忆', G.grid[4][3]===mem && G.grid[4][4]===mem && G.grid[5][3]===mem && G.grid[5][4]===mem);
assert('旧 footprint 非重叠部分 (3,3)-(4,3) 已清空', G.grid[3][3]===null && G.grid[3][4]===null);

console.log(`\n结果：PASS ${passed}, FAIL ${failed}`);
if (failed) process.exit(1);
