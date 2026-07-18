// 加载真实 L1_play.html，捕获 document 上的 pointerup 处理器，模拟「从商店拖干扰素到记忆 footprint」真实事件链
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
const console2 = console;
const ctx = { document, window, requestAnimationFrame, setInterval, setTimeout, alert, console:console2,
  Math, Date, JSON, Object, Array, Proxy, String, Number, Boolean, isNaN, parseInt, parseFloat, grid_in:undefined };
ctx.globalThis = ctx;

const exposed = script + `
window.__api = { getG:()=>G, CELLS, start, renderShop, placeTower, startShopDrag, cvXY, getDrag:()=>drag };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
api.start();

const G = api.getG();
function fireDoc(type, e){ (docListeners[type]||[]).forEach(fn=>fn(e)); }

// ===== 场景 A：拖拽商店干扰素到记忆 footprint 左上角 (2,3) =====
G.shop = [null, 'interferon', null, null];
const mem = api.placeTower('memory', 2, 3);
api.renderShop();
G.selected = -1;

// 模拟从商店 slot1 拖拽
api.startShopDrag(1, { clientX: 900, clientY: 50, preventDefault(){} }); // 起点在商店区(任意坐标)
// 移动指针到记忆 cell (2,3)=像素 (2*48+24, 3*48+24)=(120,168)，并超过 6px 阈值
fireDoc('pointermove', { clientX: 200, clientY: 200, preventDefault(){} });
fireDoc('pointerup', { clientX: 2*48+24, clientY: 3*48+24, preventDefault(){} });

console.log('=== 场景A：拖拽干扰素→记忆 footprint ===');
console.log('记忆是否还在场?', !!G.towers.find(t=>t.type==='memory'));
const inter = G.towers.find(t=>t.type==='interferon');
console.log('干扰素落点 col,row =', inter && inter.col, inter && inter.row);
console.log('干扰素完整覆盖原记忆 footprint?', inter && [[2,3],[3,3],[2,4],[3,4]].every(([c,r])=>G.grid[r][c]===inter));
console.log('shop =', G.shop);

// ===== 场景 B：商店 4 槽都满，无法交换 =====
G.shop = ['neutrophil','interferon','neutrophil','neutrophil'];
G.towers = [];
const mem2 = api.placeTower('memory', 2, 3);
api.renderShop();
G.selected = -1;
api.startShopDrag(1, { clientX: 900, clientY: 50, preventDefault(){} });
fireDoc('pointermove', { clientX: 200, clientY: 200, preventDefault(){} });
fireDoc('pointerup', { clientX: 2*48+24, clientY: 3*48+24, preventDefault(){} });
console.log('\n=== 场景B：商店满，拖干扰素→记忆 footprint ===');
console.log('记忆是否还在场?', !!G.towers.find(t=>t.type==='memory'));
console.log('干扰素是否上场?', !!G.towers.find(t=>t.type==='interferon'));
console.log('（设计上：商店满应禁止交换，记忆保留，干扰素不上场）');
