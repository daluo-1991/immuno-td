// 加载真实 L1_play.html 脚本，验证「直接顶掉」：商店满 / 同类型 也不再拦截
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
  getG:()=>G, setG:(g)=>{ G=g; }, CELLS, placeTower, tryMoveOrSwap, trySwap, start, renderShop, updateHUD, anchorFor, canPlace,
};`;
new vm.Script(exposed).runInNewContext(ctx);

const api = window.__api;
api.start();
const G = api.getG();

for (let r = 2; r <= 6; r++) for (let c = 2; c <= 5; c++) G.grid[r][c] = null;

let passed = 0, failed = 0;
function assert(msg, cond) { if (cond) { passed++; console.log('✅', msg); } else { failed++; console.log('❌', msg); } }

// 场景 1：商店满时，巨噬(2×2)拖到中性粒(1×1)上 → 不同尺寸，直接顶掉，被顶塔追加到商店新槽
G.shop = ['neutrophil','neutrophil','neutrophil','neutrophil'];
G.towers = [];
const macro = api.placeTower('macrophage', 2, 2);   // (2,2)-(3,3)
const neut = api.placeTower('neutrophil', 4, 2);    // 1×1 (4,2)
console.log('--- 场景1：商店满，巨噬拖到中性粒（不同尺寸→顶掉） ---');
const r1 = api.tryMoveOrSwap(macro, 4, 2);
console.log('result:', r1, '| shop:', G.shop, '| towers:', G.towers.map(t=>t.type));
assert('商店满也移动成功', r1.ok);
assert('成功时不给提示（msg 为空）', r1.msg === '');
assert('巨噬落到 (4,2)', macro.col===4 && macro.row===2);
assert('中性粒挪到巨噬原位腾出格（不回商店）', G.towers.includes(neut) && neut.col===2 && neut.row===2);
assert('商店不变（中性粒挪位未回商店）', G.shop.length===4);

// 场景 2：商店有 1 空槽时，巨噬(2×2)拖到中性粒(1×1) → 不同尺寸顶掉，被顶塔退回商店空槽
G.shop = ['neutrophil','neutrophil','neutrophil',null];
G.towers = [];
const macro2 = api.placeTower('macrophage', 2, 2);
const neut2 = api.placeTower('neutrophil', 4, 2);
console.log('\n--- 场景2：商店1空槽，巨噬拖到中性粒（不同尺寸→顶掉） ---');
const r2 = api.tryMoveOrSwap(macro2, 4, 2);
console.log('result:', r2, '| shop:', G.shop);
assert('有空槽时移动成功', r2.ok);
assert('中性粒挪到巨噬原位腾出格（不回商店）', G.towers.includes(neut2) && neut2.col===2 && neut2.row===2);

// 场景 3：商店卡替换，商店满也直接顶掉（trySwap）
G.shop = ['interferon','neutrophil','neutrophil','neutrophil'];  // slot0 是要放的干扰素卡
G.towers = [];
const memo = api.placeTower('memory', 3, 3);   // 2×2 记忆 (3,3)-(4,4)
console.log('\n--- 场景3：商店满，用干扰素卡(slot0)替换记忆 ---');
api.trySwap(0, 'interferon', 3, 3);
console.log('shop:', G.shop, '| towers:', G.towers.map(t=>({type:t.type,col:t.col,row:t.row})));
assert('干扰素已上场替换记忆', G.towers.length===1 && G.towers[0].type==='interferon');
assert('干扰素落在记忆原位 (3,3)', G.towers[0].col===3 && G.towers[0].row===3);
assert('被顶掉的记忆退回商店末槽（商店满→push）', G.shop.includes('memory') && G.shop.length===4);

console.log(`\n结果：PASS ${passed}, FAIL ${failed}`);
if (failed) process.exit(1);
