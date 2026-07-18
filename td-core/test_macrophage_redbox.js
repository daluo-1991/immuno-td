// 复现用户场景：右上角 2x2 红框，4格已开通，右下角有中性粒，从商店拖巨噬进去
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('immuno-td/td-core/L1_play.html', 'utf-8');
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
window.__api = { getG:()=>G, CELLS, start, renderShop, placeTower, startShopDrag, cvXY, anchorForWithEvict, trySwap, getDrag:()=>drag };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
api.start();
const G = api.getG();
function fireDoc(type, e){ (docListeners[type]||[]).forEach(fn=>fn(e)); }

const CELL = 48;
function px(c,r){ return { clientX: c*CELL+24, clientY: r*CELL+24 }; }

// ===== 测试多种红框位置 =====
const boxes = [
  { name:'col4-5 row1-2 (贴右上)', cells:[[4,1],[5,1],[4,2],[5,2]], neu:5, nrow:2 },
  { name:'col3-4 row1-2', cells:[[3,1],[4,1],[3,2],[4,2]], neu:4, nrow:2 },
  { name:'col4-5 row2-3', cells:[[4,2],[5,2],[4,3],[5,3]], neu:5, nrow:3 },
];

for(const box of boxes){
  console.log('\n########## 红框: '+box.name+' ##########');
  // 重置棋盘
  api.start();
  const G2 = api.getG();
  // 开通红框4格
  for(const [c,r] of box.cells) G2.grid[r][c] = null;
  // 红框右下角放中性粒
  api.placeTower('neutrophil', box.neu, box.nrow);
  // 商店 slot0 = 巨噬
  G2.shop = ['macrophage', null, null, null];
  api.renderShop();
  G2.selected = -1;

  // 模拟把鼠标拖到红框每一格，看 trySwap 是否成功
  for(const [c,r] of box.cells){
    // 重新初始化（每格独立测，避免互相干扰）
    api.start();
    const g = api.getG();
    for(const [cc,rr] of box.cells) g.grid[rr][cc] = null;
    api.placeTower('neutrophil', box.neu, box.nrow);
    g.shop = ['macrophage', null, null, null];
    api.renderShop();
    g.selected = -1;
    // 先诊断 anchorForWithEvict（不真正落子）
    const diag = api.anchorForWithEvict('macrophage', c, r, null);
    const before = JSON.stringify(g.grid.map(row=>row.map(x=>x===null?'_':(typeof x==='object'?x.type[0]:x))));
    // 真实拖拽链
    api.startShopDrag(0, { clientX: 0, clientY: 0, preventDefault(){} });
    fireDoc('pointermove', { clientX: 10, clientY:10, preventDefault(){} });
    const p = px(c,r);
    fireDoc('pointerup', { clientX:p.clientX, clientY:p.clientY, preventDefault(){} });
    const mac = g.towers.find(t=>t.type==='macrophage');
    const neu = g.towers.find(t=>t.type==='neutrophil');
    console.log(`  拖到 (${c},${r}) | anchorForWithEvict=${diag?('('+diag.anchor.ac+','+diag.anchor.ar+') top='+diag.targets.length):'null'} | 巨噬上场=${!!mac} ${mac?('@'+mac.col+','+mac.row):''} | 中性粒仍在=${!!neu}${neu?('@'+neu.col+','+neu.row):''}`);
  }
}
