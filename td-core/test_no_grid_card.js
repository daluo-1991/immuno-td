// 验证 2026-07-18「移除格子卡」：rollShop 不再产出格子卡（多形状对象），4 槽全为细胞卡
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
const console2 = console;
const ctx = { document, window, requestAnimationFrame, setInterval, setTimeout, alert, console:console2,
  Math, Date, JSON, Object, Array, Proxy, String, Number, Boolean, isNaN, parseInt, parseFloat };
ctx.globalThis = ctx;

const exposed = script + `
window.__api = { getG:()=>G, CELLS, start, rollShop, G_ref:()=>G };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
api.start();

let pass=0, fail=0;
function ok(name, cond){ if(cond){pass++; console.log('  ✅ '+name);} else {fail++; console.log('  ❌ '+name);} }

console.log('=== rollShop 200 次刷新，校验 4 槽全部是细胞卡（无格子卡对象）===');
let bad=0, total=0;
for(let k=0;k<200;k++){
  api.rollShop();
  const shop = api.getG().shop;
  for(const it of shop){
    total++;
    const isGridCard = (it!==null && typeof it==='object' && it.cells);
    const isCellCard = (typeof it==='string' && api.CELLS[it]);
    if(isGridCard || !isCellCard) bad++;
  }
}
ok(`200×4=${total} 槽中，非细胞卡数量=0（实际 ${bad}）`, bad===0);

console.log('=== 首槽不应再恒为格子卡（抽样前 50 次首槽均为细胞卡）===');
let firstBad=0;
for(let k=0;k<50;k++){ api.rollShop(); const f=api.getG().shop[0]; if(!(typeof f==='string'&&api.CELLS[f])) firstBad++; }
ok('首槽全为细胞卡', firstBad===0);

console.log(`\n结果：${pass} 通过, ${fail} 失败`);
process.exit(fail?1:0);
