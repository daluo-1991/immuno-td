// 验证用户期望：商店细胞卡可拖到任意位置，但暗格(locked)上落不下，
// 松手后卡片自动退回商店（不消耗、不落塔、暗格不变绿）。绿格上正常落子。
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
let TIP = [];
const ctx = { document, window, requestAnimationFrame, setInterval, setTimeout, alert,
  tip:(m)=>{ TIP.push(m); }, console,
  Math, Date, JSON, Object, Array, Proxy, String, Number, Boolean, isNaN, parseInt, parseFloat };
ctx.globalThis = ctx;

const exposed = script + `
window.__api = { getG:()=>G, CELLS, start, renderShop, placeTower, trySwap, getTip:()=>TIP };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;

function ok(name, cond){ console.log((cond?'  ✅ ':'  ❌ ')+name); if(!cond) FAIL++; return cond; }
let FAIL=0;

function isLocked(G,c,r){ return G.grid[r][c]==='locked'; }
function isOpen(G,c,r){ return G.grid[r][c]===null; }

// 找一个远离开通簇的暗格
function findDark(G){ for(let r=1;r<=7;r++) for(let c=1;c<=5;c++) if(isLocked(G,c,r)) return {c,r}; return null; }
// 找一个开通(绿)格
function findGreen(G){ for(let r=1;r<=7;r++) for(let c=1;c<=5;c++) if(isOpen(G,c,r)) return {c,r}; return null; }
// 找一个全绿(4格null)的 2×2 左上角锚点
function findGreen2x2Anchor(G){
  for(let ar=1; ar<=7-1; ar++) for(let ac=1; ac<=5-1; ac++){
    if(isOpen(G,ac,ar)&&isOpen(G,ac+1,ar)&&isOpen(G,ac,ar+1)&&isOpen(G,ac+1,ar+1)) return {ac,ar};
  }
  return null;
}

console.log('=== 2×2 严格模式：暗格松手 → 卡片退回商店 ===');
api.start(); TIP=[];
let G = api.getG();
// 手动注入一个暗格（验证退商店逻辑；3×3 中央簇外已有大量暗格可直接测）
let d = {c:1,r:1}; G.grid[d.r][d.c] = 'locked';
console.log(`  注入暗格 (${d.c},${d.r})，状态=${JSON.stringify(G.grid[d.r][d.c])}`);
ok('选定位置确为暗格(locked)', isLocked(G,d.c,d.r));
G.shop = ['macrophage', null, null, null];
api.renderShop();
G.selected = -1;
const towersBefore = G.towers.length;
api.trySwap(0, 'macrophage', d.c, d.r);
ok('2×2 暗格松手→卡片未消耗（退商店）', G.shop[0]==='macrophage');
ok('2×2 暗格松手→未落塔（巨噬不在 towers 中）', !G.towers.find(t=>t.type==='macrophage'));
ok('towers 数量不变', G.towers.length===towersBefore);
ok('原暗格(拖放点)仍保持 locked（未变绿）', isLocked(G,d.c,d.r));

console.log('=== 2×2 严格模式：绿格 2×2 区域 → 正常落子（对照） ===');
api.start(); TIP=[];
G = api.getG();
let a = findGreen2x2Anchor(G);
console.log(`  选 2×2 全绿锚点 (${a.ac},${a.ar})，鼠标落在其中心格 (${a.ac+1},${a.ar+1})`);
G.shop = ['macrophage', null, null, null];
api.renderShop();
G.selected = -1;
const tb2x2 = G.towers.length;
api.trySwap(0, 'macrophage', a.ac+1, a.ar+1);
const mac2 = G.towers.find(t=>t.type==='macrophage');
ok('2×2 绿格区域→落子（巨噬已上场）', !!mac2);
ok('卡片被消耗（shop[0] 清空）', G.shop[0]===null);
ok('towers 数量 +1', G.towers.length===tb2x2+1);
ok('落点是合法 2×2 锚点(在内格摆位区)', mac2 && mac2.col>=1 && mac2.col<=3 && mac2.row>=1 && mac2.row<=5);
ok('落点 4 格均非暗格（即落在全绿 2×2 区域内）', mac2 && !isLocked(G,mac2.col,mac2.row) && !isLocked(G,mac2.col+1,mac2.row) && !isLocked(G,mac2.col,mac2.row+1) && !isLocked(G,mac2.col+1,mac2.row+1));

console.log('=== 暗格松手 → 卡片退回商店（1×1 中性粒） ===');
api.start(); TIP=[];
G = api.getG();
d = {c:5,r:7}; G.grid[d.r][d.c] = 'locked';
G.shop = ['neutrophil', null, null, null];
api.renderShop();
G.selected = -1;
const tb2 = G.towers.length;
api.trySwap(0, 'neutrophil', d.c, d.r);
ok('卡片未被消耗（shop[0] 仍为 neutrophil）', G.shop[0]==='neutrophil');
ok('未落塔', !G.towers.find(t=>t.type==='neutrophil'));
ok('towers 数量不变', G.towers.length===tb2);
ok('暗格仍保持 locked（未变绿）', isLocked(G,d.c,d.r));

console.log('=== 绿格松手 → 正常落子（对照） ===');
api.start(); TIP=[];
G = api.getG();
let g = findGreen(G);
console.log(`  选绿格 (${g.c},${g.r})`);
G.shop = ['macrophage', null, null, null];
api.renderShop();
G.selected = -1;
const tb3 = G.towers.length;
api.trySwap(0, 'macrophage', g.c, g.r);
ok('绿格上卡片被消耗（shop[0] 清空）', G.shop[0]===null);
ok('巨噬成功落塔', !!G.towers.find(t=>t.type==='macrophage'));
ok('towers 数量 +1', G.towers.length===tb3+1);

console.log('\n'+(FAIL===0?'全部通过 ✅':(FAIL+' 项失败 ❌')));
process.exit(FAIL===0?0:1);
