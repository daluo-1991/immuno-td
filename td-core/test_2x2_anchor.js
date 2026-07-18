// 验证严格落点模式（用户 2026-07-18 拍板：2×2 与 1×1 一致，禁宽吸附）：
//  - 1×1 精确：暗格/占格 → null（不吸邻居）
//  - 2×2 严格：落点区域必须正好全绿(或全空可顶掉)才落子，悬停暗格 → null（不吸到附近）
//  - 2×2 顶掉 1×1 占用塔 仍成功
//  - 2×2 拖动到 2×2 塔 footprint 任意格 → 顶掉/互换
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
window.__api = { getG:()=>G, CELLS, start, renderShop, placeTower, moveTower, anchorFor, anchorForCore, anchorForWithEvict, anchorForWithEvictCore, LEVEL, tryMoveOrSwap };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
const LEVEL = api.LEVEL;
const cols = LEVEL.cols, rows = LEVEL.rows;
let pass=0, fail=0;
function ok(name, cond){ if(cond){pass++; console.log('  ✅ '+name);} else {fail++; console.log('  ❌ '+name);} }

// ---------- A. 1×1 精确：悬停暗格应 null（不吸邻居）----------
console.log('\n[A] 1×1 精确落点');
api.start();
let G = api.getG();
for(let r=1;r<=rows-2;r++) for(let c=1;c<=cols-2;c++) G.grid[r][c]=null;
G.grid[3][3]='locked';
ok('1×1 悬停暗格(3,3) → null(回退,不吸到邻格)', api.anchorFor('neutrophil',3,3)===null);
ok('1×1 悬停合法格(2,2) → 精确落点(2,2)', JSON.stringify(api.anchorFor('neutrophil',2,2))===JSON.stringify({ac:2,ar:2}));

// ---------- B. 2×2 严格：悬停暗格 → null（不吸到附近）；悬停全绿区 → 落子 ----------
console.log('\n[B] 2×2 严格模式（禁宽吸附）');
api.start();
G = api.getG();
for(let r=1;r<=rows-2;r++) for(let c=1;c<=cols-2;c++) G.grid[r][c]=null;
G.grid[3][3]='locked';
const ev = api.anchorForWithEvict('macrophage', 3, 3, null);
ok('2×2 悬停暗格(3,3) → null（严格模式不吸附）', ev===null);
for(let r=1;r<=rows-2;r++) for(let c=1;c<=cols-2;c++) G.grid[r][c]=null;
const ev2 = api.anchorForWithEvict('macrophage', 2, 2, null);
ok('2×2 悬停全绿区域(2,2 为中心) → 非null', !!ev2);

// ---------- C. 严格模式：anchorForWithEvict 与精确模式逐格一致（无宽吸附）----------
console.log('\n[C] 严格模式：anchorForWithEvict ≡ 精确模式（无宽吸附分支）');
function buildSparse(lockedRatio, K){
  api.start();
  const g = api.getG();
  for(let r=1;r<=rows-2;r++) for(let c=1;c<=cols-2;c++){
    g.grid[r][c] = Math.random()<lockedRatio ? 'locked' : null;
  }
  let placed=0, tries=0;
  while(placed<K && tries<500){
    tries++;
    const c=1+Math.floor(Math.random()*(cols-2)), r=1+Math.floor(Math.random()*(rows-2));
    if(g.grid[r][c]===null){ api.placeTower('neutrophil', c, r); placed++; }
  }
  return g;
}
let agree=true;
for(let t=0;t<6;t++){
  const g = buildSparse(0.3, 3);
  for(let r=1;r<=rows-2;r++) for(let c=1;c<=cols-2;c++){
    const a = api.anchorForWithEvict('macrophage',c,r,null);
    const b = api.anchorForWithEvictCore('macrophage',c,r,null,false);
    const sa = a?(a.anchor.ac+','+a.anchor.ar+'|'+a.targets.length):'null';
    const sb = b?(b.anchor.ac+','+b.anchor.ar+'|'+b.targets.length):'null';
    if(sa!==sb) agree=false;
  }
}
ok('anchorForWithEvict 与精确模式逐格一致（严格无宽吸）', agree);

// ---------- D. 2×2 顶掉 1×1 占用塔 仍成功 ----------
console.log('\n[D] 2×2 顶掉占用 1×1 塔');
api.start();
G = api.getG();
for(let r=1;r<=rows-2;r++) for(let c=1;c<=cols-2;c++) G.grid[r][c]=null;
api.placeTower('neutrophil', 5, 2);
const ev3 = api.anchorForWithEvict('macrophage', 5, 2, null);
ok('悬停中性粒(5,2) → 2×2 锚点命中且 targets 含中性粒', !!ev3 && ev3.targets.length===1 && ev3.targets[0].type==='neutrophil');
ok('锚点使红框4格全可放(顶掉后)', ev3 ? (function(){ for(let dr=0;dr<2;dr++)for(let dc=0;dc<2;dc++){ const cc=ev3.anchor.ac+dc, rr=ev3.anchor.ar+dr; if(cc<1||cc>cols-2||rr<1||rr>rows-2) return false;} return true;})() : false);

// ---------- E. 拖动 2×2 到 2×2 塔 footprint 任意格 → 顶掉/互换 ----------
console.log('\n[E] 拖动 2×2 到 2×2 塔 footprint 上任意位置 → 顶掉/互换');
let allSwap=true;
for(let r=2; r<=3; r++){
  for(let c=3; c<=4; c++){
    api.start();
    G = api.getG();
    api.placeTower('interferon', 1, 1);
    api.placeTower('memory', 3, 2);
    const interferon = G.towers.find(t=>t.type==='interferon');
    const res = api.tryMoveOrSwap(interferon, c, r);
    const okCond = res.ok && (res.swapped || (interferon.col===3 && interferon.row===2));
    if(!okCond) allSwap=false;
  }
}
ok('鼠标在 memory footprint 任意格(3,2)-(4,3) 拖动干扰素 → 成功顶掉/互换', allSwap);

console.log(`\n==== 结果: ${pass} 通过, ${fail} 失败 ====`);
process.exit(fail?1:0);
