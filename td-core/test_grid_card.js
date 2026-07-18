// 验证 2026-07-18 恢复格子卡：
//   · rollShop 首槽恒出格子卡（多形状对象）
//   · 后 3 槽为细胞卡
//   · 格子卡可整块点入暗格开通（canPlaceTileShape / isLockedCell / 解锁后摆细胞）
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('L1_play.html', 'utf-8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl(id){
  const el = {
    id, _children:[], textContent:'', innerHTML:'', value:'', width:336, height:432,
    style:new Proxy({},{get:()=>'' ,set:()=>true}),
    classList:{ _s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,f){ f?this._s.add(c):this._s.delete(c) }, contains(c){return this._s.has(c)} },
    onclick:null, _listeners:{},
    addEventListener(t,fn){ (this._listeners[t]||(this._listeners[t]=[])).push(fn); }, removeEventListener(){},
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
const docListeners = {};
const document = {
  getElementById(id){ if(!els[id]) els[id]=makeEl(id); return els[id]; },
  addEventListener(t,fn){ (docListeners[t]||(docListeners[t]=[])).push(fn); },
  createElement(){ return makeEl('dyn'); },
  body:{ appendChild(){} },
};
const window = {};
const requestAnimationFrame = ()=>{};
const setInterval = ()=>0;
const setTimeout = (fn)=>0;
const alert = ()=>{};
const ctx = { document, window, requestAnimationFrame, setInterval, setTimeout, alert, console,
  Math, Date, JSON, Object, Array, Proxy, String, Number, Boolean, isNaN, parseInt, parseFloat };
ctx.globalThis = ctx;

const exposed = script + `
window.__api = { getG:()=>G, CELLS, start, rollShop, pickTileShape, canPlaceTileShape, isLockedCell, placeTower };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
api.start();

let pass=0, fail=0;
function ok(name, cond){ if(cond){pass++; console.log('  ✅ '+name);} else {fail++; console.log('  ❌ '+name);} }
const isGridCard = it => it!==null && typeof it==='object' && it.cells;
const isCellCard  = it => typeof it==='string' && api.CELLS[it];

// ① 首槽恒出格子卡（200 次刷新）
console.log('=== 首槽恒为格子卡（200 次刷新）===');
let firstGridOK=0;
for(let k=0;k<200;k++){ api.rollShop(); if(isGridCard(api.getG().shop[0])) firstGridOK++; }
ok(`200 次首槽均为格子卡对象（实际 ${firstGridOK}）`, firstGridOK===200);

// ② 后 3 槽恒为细胞卡（50 次）
console.log('=== 后 3 槽为细胞卡（50 次）===');
let cellOK=0;
for(let k=0;k<50;k++){ api.rollShop(); const s=api.getG().shop; if(isCellCard(s[1])&&isCellCard(s[2])&&isCellCard(s[3])) cellOK++; }
ok(`50 次后 3 槽均为细胞卡（实际 ${cellOK}）`, cellOK===50);

// ③ 格子卡可开通暗格
console.log('=== 格子卡开通暗格 ===');
api.start(); const G=api.getG();
let found=null;
for(let r=1;r<=7;r++) for(let c=1;c<=5;c++){ if(G.grid[r][c]==='locked'){ found=[c,r]; break; } }
ok('存在 locked 暗格', !!found);
if(found){
  const [c,r]=found;
  const shape={name:'1格',size:1,weight:1,cells:[[0,0]]};
  ok('isLockedCell(暗格)=true', api.isLockedCell(c,r)===true);
  ok('canPlaceTileShape(暗格)=true', api.canPlaceTileShape(shape,c,r)===true);
  for(const [dc,dr] of shape.cells){ G.grid[r+dr][c+dc]=null; }   // 模拟 handleTap 解锁
  ok('解锁后该格=null(可摆)', G.grid[r][c]===null);
  api.placeTower('neutrophil', c, r);
  ok('解锁后可在该格摆细胞', !!G.towers.find(t=>t.col===c&&t.row===r));
}

console.log(`\n结果：${pass} 通过, ${fail} 失败`);
process.exit(fail?1:0);
