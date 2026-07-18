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

console.log('=== 暗格松手 → 2×2 吸到最近绿格落子（默认棋盘绿格在吸附范围内） ===');
api.start(); TIP=[];
let G = api.getG();
let d = findDark(G);
console.log(`  选暗格 (${d.c},${d.r})，状态=${JSON.stringify(G.grid[d.r][d.c])}`);
ok('选定位置确为暗格(locked)', isLocked(G,d.c,d.r));
G.shop = ['macrophage', null, null, null];
api.renderShop();
G.selected = -1;
const towersBefore = G.towers.length;
api.trySwap(0, 'macrophage', d.c, d.r);
const mac = G.towers.find(t=>t.type==='macrophage');
ok('2×2 吸到绿格落子（巨噬已上场）', !!mac);
ok('卡片被消耗（shop[0] 清空）', G.shop[0]===null);
ok('towers 数量 +1', G.towers.length===towersBefore+1);
ok('落点 4 格均非暗格（即落在开通区，未压到 locked）', mac && !isLocked(G,mac.col,mac.row) && !isLocked(G,mac.col+1,mac.row) && !isLocked(G,mac.col,mac.row+1) && !isLocked(G,mac.col+1,mac.row+1));
ok('原暗格(拖放点)仍保持 locked（未变绿）', isLocked(G,d.c,d.r));
ok('暗格从未被改为绿格（全棋盘 locked 数不变）', G.grid.flat().filter(x=>x==='locked').length===26);

console.log('=== 暗格松手 → 卡片退回商店（1×1 中性粒） ===');
api.start(); TIP=[];
G = api.getG();
d = findDark(G);
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
