// 加载真实 L1_play.html 脚本，用 DOM 打桩，验证「2×2 塔移动覆盖多座塔时全部顶回商店」
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
    querySelectorAll(sel){ return []; },
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
  getG:()=>G, CELLS, placeTower, tryMoveOrSwap, trySwap, start, renderShop, updateHUD, anchorFor, canPlace,
  setSelected:(i)=>{ G.selected=i; },
};`;
new vm.Script(exposed).runInNewContext(ctx);

const api = window.__api;
api.start();
const G = api.getG();

// 开通一个足够大的区域
for (let r = 2; r <= 6; r++) {
  for (let c = 2; c <= 5; c++) {
    G.grid[r][c] = null;
  }
}
G.shop = [null, null, null, null];
G.towers = [];

let passed = 0, failed = 0;
function assert(msg, cond) { if (cond) { passed++; console.log('✅', msg); } else { failed++; console.log('❌', msg); } }

// 场景：巨噬细胞在 (1,1)， footprint (1,1)-(2,2)；干扰素在 (3,2)；抗体在 (4,2)
const macro = api.placeTower('macrophage', 1, 1);
const inter = api.placeTower('interferon', 3, 2);
const antibody = api.placeTower('antibody', 4, 2);

console.log('--- 初始 ---');
console.log('towers:', G.towers.map(t=>({type:t.type, col:t.col, row:t.row})));
console.log('shop free:', G.shop.filter(x=>x===null).length);

const result = api.tryMoveOrSwap(macro, 3, 2);
console.log('\n--- 移动巨噬到 (3,2) ---');
console.log('result:', result);
console.log('macro now:', macro.col, macro.row);
console.log('towers:', G.towers.map(t=>({type:t.type, col:t.col, row:t.row})));
console.log('shop:', G.shop);

assert('移动应成功', result.ok);
assert('巨噬细胞在场上', G.towers.includes(macro));
assert('干扰素(2×2)退回商店', G.shop.includes('interferon'));
assert('抗体(1×1)挪到巨噬原位腾出格（在场上）', G.towers.includes(antibody));
assert('场上巨噬+抗体（干扰素回商店）', G.towers.length === 2);

console.log(`\n结果：PASS ${passed}, FAIL ${failed}`);
if (failed) process.exit(1);
