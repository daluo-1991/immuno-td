// 验证：A) 4格开通→拖巨噬成功；B) 红框混入暗格→详尽诊断提示能定位
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('L1_play.html', 'utf-8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function makeEl(id){
  const el = { id, _children:[], textContent:'', innerHTML:'', value:'', width:336, height:432,
    style:new Proxy({},{get:()=>'' ,set:()=>true}),
    classList:{ _s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,f){ f?this._s.add(c):this._s.delete(c) }, contains(c){return this._s.has(c)} },
    onclick:null, _listeners:{},
    addEventListener(t,fn){ (this._listeners[t]||(this._listeners[t]=[])).push(fn); }, removeEventListener(){},
    appendChild(c){ this._children.push(c); }, get childElementCount(){ return this._children.length; },
    getContext(){ return ctxStub; }, getBoundingClientRect(){ return { left:0, top:0, width:336, height:432 }; },
    setPointerCapture(){}, releasePointerCapture(){} };
  return el;
}
const ctxStub = new Proxy({}, { get(){ return ()=>{}; }});
const els = {}; const docListeners = {};
const document = { getElementById(id){ if(!els[id]) els[id]=makeEl(id); return els[id]; },
  addEventListener(t,fn){ (docListeners[t]||(docListeners[t]=[])).push(fn); }, createElement(){ return makeEl('dyn'); }, body:{ appendChild(){} } };
const window = {}; const requestAnimationFrame=()=>{}; const setInterval=()=>0; const setTimeout=()=>0; const alert=()=>{};
const lastTip = { txt:'' };
const document2 = Object.assign({}, document, { /* noop */ });
const ctx = { document, window, requestAnimationFrame, setInterval, setTimeout, alert, console,
  Math, Date, JSON, Object, Array, Proxy, String, Number, Boolean, isNaN, parseInt, parseFloat };
ctx.globalThis = ctx;
// 捕获 tip
const exposed = script + `
const __origTip = tip;
tip = function(msg){ window.__lastTip = msg; console.log('[TIP]', msg); };
window.__api = { getG:()=>G, start, renderShop, placeTower, startShopDrag, cvXY, anchorForWithEvict, trySwap, diagnosePlacement, getTip:()=>window.__lastTip };
`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
const CELL = 48;
function px(c,r){ return { clientX:c*CELL+24, clientY:r*CELL+24 }; }
function fireDoc(type,e){ (docListeners[type]||[]).forEach(fn=>fn(e)); }

const cases = [
  { name:'A 红框4格全开通(无暗格)', box:[[4,1],[5,1],[4,2],[5,2]], neu:[5,2], locked:[] },
  { name:'B 红框混入1格暗格(右上角 locked)', box:[[4,1],[5,1],[4,2],[5,2]], neu:[5,2], locked:[[5,1]] },
  { name:'C 红框混入1格暗格(左上角 locked)', box:[[4,1],[5,1],[4,2],[5,2]], neu:[5,2], locked:[[4,1]] },
];

for(const cc of cases){
  api.start();
  const G = api.getG();
  for(const [c,r] of cc.box) G.grid[r][c] = null;
  for(const [c,r] of cc.locked) G.grid[r][c] = 'locked';
  api.placeTower('neutrophil', cc.neu[0], cc.neu[1]);
  G.shop = ['macrophage', null, null, null];
  api.renderShop(); G.selected=-1;
  // 拖到红框中心点 (4.5,1.5) -> 像素落在 (4,1) 或 (5,1) 边界，取 (4,1)
  api.startShopDrag(0, { clientX:0, clientY:0, preventDefault(){} });
  fireDoc('pointermove', { clientX:10, clientY:10, preventDefault(){} });
  fireDoc('pointerup', { clientX:px(4,1).clientX, clientY:px(4,1).clientY, preventDefault(){} });
  const mac = G.towers.find(t=>t.type==='macrophage');
  console.log(`\n### ${cc.name}`);
  console.log('  巨噬上场?', !!mac, mac?('@'+mac.col+','+mac.row):'(未上场)');
  console.log('  诊断提示:', api.getTip());
}
