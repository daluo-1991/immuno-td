// 复现用户场景：红框位置本身已有 2x2 塔，商店 2x2 能否拖到该位置替换它
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
window.__api = { getG:()=>G, CELLS, LEVEL, start, renderShop, placeTower, startShopDrag, cvXY, anchorForWithEvict, trySwap };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
function fireDoc(type, e){ (docListeners[type]||[]).forEach(fn=>fn(e)); }
const CELL = 48;
function px(c,r){ return { clientX: c*CELL+24, clientY: r*CELL+24 }; }

// 红框 2x2 位置候选（reserved 区 col2-4 row3-5 内）
const boxes = [
  { name:'col2-3 row3-4', tower:'memory',    tc:2, tr:3 },
  { name:'col3-4 row3-4', tower:'interferon', tc:3, tr:3 },
  { name:'col4-5 row3-4', tower:'macrophage', tc:4, tr:3 },
  { name:'col2-3 row4-5', tower:'memory',    tc:2, tr:4 },
  { name:'col3-4 row4-5', tower:'interferon', tc:3, tr:4 },
];

const newCard = 'macrophage'; // 商店里拖的 2x2

for(const box of boxes){
  console.log('\n########## 红框已有 2x2 @ '+box.name+' ('+box.tower+'@'+box.tc+','+box.tr+') ##########');
  for(const [dc,dr] of [[0,0],[1,0],[0,1],[1,1],[0,-1],[-1,0],[2,0],[0,2]]){
    const c = box.tc+dc, r = box.tr+dr;
    if(c<1||c>5||r<1||r>7) continue;
    api.start();
    const g = api.getG();
    // 清掉所有塔
    g.towers=[]; for(let rr=0;rr<9;rr++)for(let cc=0;cc<7;cc++){ if(typeof g.grid[rr][cc]==='object') g.grid[rr][cc]=null; }
    // 放 2x2 塔在红框
    api.placeTower(box.tower, box.tc, box.tr);
    // 商店 slot0 = 2x2 新卡
    g.shop = [newCard, null, null, null];
    api.renderShop(); g.selected=-1;
    // 诊断
    const diag = api.anchorForWithEvict(newCard, c, r, null);
    // 真实拖拽
    api.startShopDrag(0, { clientX:0, clientY:0, preventDefault(){} });
    fireDoc('pointermove', { clientX:10, clientY:10, preventDefault(){} });
    const p = px(c,r);
    fireDoc('pointerup', { clientX:p.clientX, clientY:p.clientY, preventDefault(){} });
    const mac = g.towers.find(t=>t.type===newCard);
    const oldT = g.towers.find(t=>t.type===box.tower);
    console.log(`  拖到 (${c},${r}) | anchor=${diag?('('+diag.anchor.ac+','+diag.anchor.ar+') top='+diag.targets.length+' ty='+diag.targets.map(t=>t.type).join(',')):'null'} | 新2x2上场=${!!mac} ${mac?('@'+mac.col+','+mac.row):''} | 旧2x2回商店=${!oldT && g.shop.includes(box.tower)}`);
  }
}
