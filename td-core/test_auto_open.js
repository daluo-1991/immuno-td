// 验证「落塔自动开通暗格」：2×2 / 1×1 现在能摆到任意内格（含暗格），不再只能放绿簇。
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('L1_play.html', 'utf-8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl(id){
  const el = { id, _children:[], textContent:'', innerHTML:'', value:'', width:336, height:432,
    style:new Proxy({},{get:()=>'' ,set:()=>true}),
    classList:{ _s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,f){ f?this._s.add(c):this._s.delete(c) }, contains(c){return this._s.has(c)} },
    onclick:null, _listeners:{}, addEventListener(t,fn){ (this._listeners[t]||(this._listeners[t]=[])).push(fn); }, removeEventListener(){},
    appendChild(c){ this._children.push(c); }, get childElementCount(){ return this._children.length; },
    getContext(){ return ctxStub; }, getBoundingClientRect(){ return { left:0, top:0, width:336, height:432 }; },
    setPointerCapture(){}, releasePointerCapture(){} };
  return el;
}
const ctxStub = new Proxy({}, { get(){ return ()=>{}; }});
const els = {}; const docListeners = {};
const document = { getElementById(id){ if(!els[id]) els[id]=makeEl(id); return els[id]; },
  addEventListener(t,fn){ (docListeners[t]||(docListeners[t]=[])).push(fn); }, createElement(){ return makeEl('dyn'); }, body:{ appendChild(){} } };
const window = {};
const ctx = { document, window, requestAnimationFrame:()=>{}, setInterval:()=>0, setTimeout:()=>0, alert:()=>{}, console,
  Math, Date, JSON, Object, Array, Proxy, String, Number, Boolean, isNaN, parseInt, parseFloat };
ctx.globalThis = ctx;
const exposed = script + `
window.__api = { getG:()=>G, CELLS, start, anchorFor, anchorForWithEvict, trySwap, placeTower, canPlace, LEVEL };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
const LEVEL = api.LEVEL;
const cols = LEVEL.cols, rows = LEVEL.rows;
let pass=0, fail=0;
function ok(name, cond){ if(cond){pass++; console.log('  ✅ '+name);} else {fail++; console.log('  ❌ '+name);} }

console.log('=== A. 旧行为（openLocked=false）：2×2 吸到远处绿簇，不落在指的位置 ===');
api.start();
let G = api.getG();
const oldA = api.anchorFor('macrophage',1,1,false);
ok('2×2 悬停暗格(1,1) 旧逻辑→吸到远处(锚点不覆盖点击格(1,1))', !!oldA && !(1>=oldA.ac && 1<oldA.ac+2 && 1>=oldA.ar && 1<oldA.ar+2));
ok('1×1 悬停暗格(1,1) 旧逻辑→null(须先开格)', api.anchorFor('neutrophil',1,1,false)===null);

console.log('\n=== B. 新行为（openLocked=true）：暗格上也能解析出精确锚点 ===');
api.start();
G = api.getG();
const a2 = api.anchorFor('macrophage',1,1,true);
ok('2×2 悬停暗格(1,1) → 返回锚点(精确落在鼠标附近)', !!a2);
ok('2×2 锚点 footprint 全部在内格摆位区(不越界/不踩路径)',
   a2 && (function(){ for(let dr=0;dr<2;dr++)for(let dc=0;dc<2;dc++){ const c=a2.ac+dc,r=a2.ar+dr; if(c<1||c>cols-2||r<1||r>rows-2) return false;} return true;})());
const a1 = api.anchorFor('neutrophil',1,1,true);
ok('1×1 悬停暗格(1,1) → 精确落点(1,1)', !!a1 && a1.ac===1 && a1.ar===1);

console.log('\n=== C. 真实落子 trySwap：2×2 拖到暗格区 → 成功放置并覆盖暗格 ===');
api.start();
G = api.getG();
G.shop = ['macrophage', null, null, null];   // 商店首槽放巨噬(2×2)
const before = G.grid[1][1];   // 应为 'locked'
ok('落子前 (1,1) 是暗格', before==='locked');
api.trySwap(0, 'macrophage', 1, 1);   // 模拟松手落在 (1,1) 附近
const t = G.towers.find(t=>t.type==='macrophage');
ok('巨噬已成功上场', !!t);
ok('巨噬 footprint 4 格现在都不再是暗格(已被塔覆盖)', t && (function(){
  for(let dr=0;dr<2;dr++)for(let dc=0;dc<2;dc++){ if(G.grid[t.row+dr][t.col+dc]==='locked') return false; }
  return true;
})());
ok('商店首槽已被消耗(splice)', G.shop[0]===null || G.shop[0]==='macrophage' ? (G.shop.filter(x=>x==='macrophage').length===0) : true);

console.log('\n=== D. 整片内格任意位置都能放 2×2（不再只能绿簇）===');
api.start();
G = api.getG();
let canPlaceAnywhere=0, total=0;
for(let r=1;r<=rows-2;r++) for(let c=1;c<=cols-2;c++){
  total++;
  // 模拟玩家把 2×2 拖到 (c,r)：openLocked=true
  const a = api.anchorFor('macrophage', c, r, true);
  if(a) canPlaceAnywhere++;
}
console.log(`  能落子的鼠标落点: ${canPlaceAnywhere} / ${total}（旧版仅 35/35 但都吸到绿簇，现在精确落点附近）`);
ok('绝大多数内格落点都能解析出合法 2×2 锚点(>=90%)', canPlaceAnywhere >= total*0.9);

console.log(`\n==== 结果: ${pass} 通过, ${fail} 失败 ====`);
process.exit(fail?1:0);
