// 验证两级吸附：1×1 精确（暗格/占格回退，不吸邻居）；2×2 先精确后宽窗口吸附。
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
// 全开通
for(let r=1;r<=rows-2;r++) for(let c=1;c<=cols-2;c++) G.grid[r][c]=null;
// 在 (3,3) 放一个暗格（locked）
G.grid[3][3]='locked';
ok('1×1 悬停暗格(3,3) → null(回退,不吸到邻格)', api.anchorFor('neutrophil',3,3)===null);
ok('1×1 悬停合法格(2,2) → 精确落点(2,2)', JSON.stringify(api.anchorFor('neutrophil',2,2))===JSON.stringify({ac:2,ar:2}));

// ---------- B. 2×2 宽吸附：悬停暗格附近有空位 → 吸到合法位 ----------
console.log('\n[B] 2×2 宽吸附（悬停暗格也能吸到附近合法 2×2）');
api.start();
G = api.getG();
for(let r=1;r<=rows-2;r++) for(let c=1;c<=cols-2;c++) G.grid[r][c]=null;
// 让 (3,3) 为暗格，但 (1,1) 区域全空（合法 2×2 位 (1,1) 存在）
G.grid[3][3]='locked';
const ev = api.anchorForWithEvict('macrophage', 3, 3, null);
ok('2×2 悬停暗格(3,3) 也能吸附到附近合法位(非null)', !!ev);
ok('2×2 吸附位确实是合法 2×2 全空位', ev ? (function(){ for(let dr=0;dr<2;dr++)for(let dc=0;dc<2;dc++){ if(G.grid[ev.anchor.ar+dr][ev.anchor.ac+dc]!==null) return false;} return true;})() : false);

// ---------- C. 半满棋盘：宽模式 vs 精确模式 成功率对照 ----------
console.log('\n[C] 半满棋盘 2×2 落点成功率（宽模式 vs 精确模式）');
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
function rate(g, fn){
  let tot=0, succ=0;
  for(let r=1;r<=rows-2;r++) for(let c=1;c<=cols-2;c++){
    tot++;
    if(fn(g,c,r)) succ++;
  }
  return succ/tot;
}
let wideRates=[], exactRates=[];
for(let t=0;t<6;t++){
  const g = buildSparse(0.3, 3);   // 30% 暗格 + 3 座散塔，模拟真实半开通棋盘
  const wide = rate(g, (g,c,r)=>!!api.anchorForWithEvict('macrophage',c,r,null));
  const exact = rate(g, (g,c,r)=>!!api.anchorForWithEvictCore('macrophage',c,r,null,false));
  wideRates.push(wide); exactRates.push(exact);
}
const aw = (wideRates.reduce((a,b)=>a+b,0)/wideRates.length*100).toFixed(1);
const ae = (exactRates.reduce((a,b)=>a+b,0)/exactRates.length*100).toFixed(1);
console.log(`  宽模式成功率=${aw}%  精确模式成功率=${ae}%`);
ok('宽模式成功率 >> 精确模式（证明 2×2 不再“很多地方拖不进”）', parseFloat(aw) >= parseFloat(ae)+30);
ok('宽模式成功率足够高(>=80%)', parseFloat(aw) >= 80);

// ---------- D. 红框顶掉（2×2 覆盖占用塔）仍成功 ----------
console.log('\n[D] 2×2 顶掉占用塔（红框右下中性粒）');
api.start();
G = api.getG();
for(let r=1;r<=rows-2;r++) for(let c=1;c<=cols-2;c++) G.grid[r][c]=null;
// 红框 col4-5 row1-2，右下(5,2) 中性粒
api.placeTower('neutrophil', 5, 2);
const ev2 = api.anchorForWithEvict('macrophage', 5, 2, null);
ok('悬停中性粒(5,2) → 2×2 锚点命中且 targets 含中性粒', !!ev2 && ev2.targets.length===1 && ev2.targets[0].type==='neutrophil');
ok('锚点使红框4格全可放(顶掉后)', ev2 ? (function(){ for(let dr=0;dr<2;dr++)for(let dc=0;dc<2;dc++){ const cc=ev2.anchor.ac+dc, rr=ev2.anchor.ar+dr; if(cc<1||cc>cols-2||rr<1||rr>rows-2) return false;} return true;})() : false);

// ---------- E. 拖动 2×2 到 2×2 塔 footprint 任意格，都顶掉/互换（用户截图场景） ----------
console.log('\n[E] 拖动 2×2 到 2×2 塔 footprint 上任意位置 → 顶掉/互换');
let allSwap=true;
for(let r=2; r<=3; r++){
  for(let c=3; c<=4; c++){
    api.start();
    G = api.getG();
    api.placeTower('interferon', 1, 1); // source 2x2
    api.placeTower('memory', 3, 2);     // target 2x2 red-box position
    const interferon = G.towers.find(t=>t.type==='interferon');
    const res = api.tryMoveOrSwap(interferon, c, r);
    const okCond = res.ok && (res.swapped || (interferon.col===3 && interferon.row===2));
    if(!okCond) allSwap=false;
  }
}
ok('鼠标在 memory footprint 任意格(3,2)-(4,3) 拖动干扰素 → 成功顶掉/互换', allSwap);

console.log(`\n==== 结果: ${pass} 通过, ${fail} 失败 ====`);
process.exit(fail?1:0);
