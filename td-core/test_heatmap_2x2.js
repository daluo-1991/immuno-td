// 热力图：对棋盘每个格子(c,r)调用商店拖拽预览用的 anchorFor('macrophage',c,r)，
// 看 2×2 在哪些光标位置能解析出合法落点。打印成网格，确认有无空间不对称。
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
    getContext(){ return ctxStub; },
    querySelectorAll(sel){ return []; }, getBoundingClientRect(){ return { left:0, top:0, width:336, height:432 }; },
    setPointerCapture(){}, releasePointerCapture(){} };
  return el;
}
const ctxStub = new Proxy({}, { get(){ return ()=>{}; }});
const els = {}, docListeners = {};
const document = { getElementById(id){ if(!els[id]) els[id]=makeEl(id); return els[id]; },
  addEventListener(t,fn){ (docListeners[t]||(docListeners[t]=[])).push(fn); }, createElement(){ return makeEl('dyn'); }, body:{ appendChild(){} } };
const window = {};
const ctx = { document, window, requestAnimationFrame:()=>{}, setInterval:()=>0, setTimeout:(fn)=>0, alert:()=>{}, console,
  Math, Date, JSON, Object, Array, Proxy, String, Number, Boolean, isNaN, parseInt, parseFloat };
ctx.globalThis = ctx;
const exposed = script + `\nwindow.__api = { getG:()=>G, CELLS, LEVEL, start, renderShop, anchorFor, anchorForWithEvict };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
api.start();
const G = api.getG();
const cols = G.grid[0].length, rows = G.grid.length;

// 打印绿格(locked状态) + 2×2 落点热力图
console.log('=== 棋盘状态：. =空(绿/可摆)  L=locked(暗格)  #=path ===');
let board='';
for(let r=0;r<rows;r++){ let line=''; for(let c=0;c<cols;c++){ const g=G.grid[r][c]; line += g==='locked'?'L':(g==='path'?'#':(g&&typeof g==='object'?'T':'.')); } board+=line+'\n'; }
console.log(board);

console.log('=== 2×2 落点热力图：V=可落(anchorFor有解)  . =不可落(退商店) ===');
let heat='';
for(let r=0;r<rows;r++){ let line=''; for(let c=0;c<cols;c++){ const a=api.anchorFor('macrophage',c,r); line += a?'V':'.'; } heat+=line+'\n'; }
console.log(heat);

// 统计：哪些锚点被解析出来
const anchors={};
for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){ const a=api.anchorFor('macrophage',c,r); if(a) anchors[a.ac+','+a.ar]=(anchors[a.ac+','+a.ar]||0)+1; }
console.log('=== 被命中的 2×2 锚点(左上角)及命中次数 ===');
console.log(JSON.stringify(anchors,null,0));

// 左右半区可落光标格数对比（cols 0..6，左半=col<=3，右半=col>=4）
let left=0,right=0;
for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){ if(api.anchorFor('macrophage',c,r)){ if(c<=3) left++; else right++; } }
console.log(`\n左半区(col 0-3) 可落光标格 = ${left}； 右半区(col 4-6) 可落光标格 = ${right}`);
