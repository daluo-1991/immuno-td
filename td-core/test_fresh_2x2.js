// 复现：空白棋盘（仅 reserved 3×3 簇开通，其余锁定）首次放 2×2，看哪里能放。
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
const els = {}; const docListeners = {};
const document = { getElementById(id){ if(!els[id]) els[id]=makeEl(id); return els[id]; },
  addEventListener(t,fn){ (docListeners[t]||(docListeners[t]=[])).push(fn); },
  createElement(){ return makeEl('dyn'); }, body:{ appendChild(){} } };
const window = {};
const ctx = { document, window, requestAnimationFrame:()=>{}, setInterval:()=>0, setTimeout:()=>0, alert:()=>{}, console,
  Math, Date, JSON, Object, Array, Proxy, String, Number, Boolean, isNaN, parseInt, parseFloat };
ctx.globalThis = ctx;
const exposed = script + `
window.__api = { getG:()=>G, CELLS, start, anchorFor, anchorForWithEvict, LEVEL, LEVEL };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
const LEVEL = api.LEVEL;
const cols = LEVEL.cols, rows = LEVEL.rows;

api.start();
const G = api.getG();

// 棋盘格状态
console.log('=== 内格摆位区状态（L=locked 暗格, .=开通, P=路径）===');
let board = '';
for(let r=0;r<rows;r++){
  let line='';
  for(let c=0;c<cols;c++){
    const g = G.grid[r][c];
    if(g===null) line+='.';
    else if(g==='locked') line+='L';
    else if(g==='path') line+='P';
    else line+='T';
  }
  board += line+'\n';
}
console.log(board);

// 对每个内格，试 anchorFor('macrophage') 与 anchorForWithEvict
console.log('=== 每个内格作为鼠标落点，2×2 能否吸附到合法位 ===');
let validCount=0, totalInner=0;
for(let r=1;r<=rows-2;r++){
  let line='';
  for(let c=1;c<=cols-2;c++){
    totalInner++;
    const a = api.anchorFor('macrophage', c, r);
    if(a){ validCount++; line+='O'; }
    else line+='.';
  }
  console.log(line);
}
console.log(`\n能吸附到合法 2×2 位的鼠标落点数: ${validCount} / ${totalInner}`);

// 列出所有合法 2×2 锚点（全开通4格）
console.log('\n=== 全棋盘所有「4格全开通」的 2×2 锚点 ===');
let anchors=[];
for(let r=1;r<=rows-2;r++) for(let c=1;c<=cols-2;c++){
  let okAll=true;
  for(let dr=0;dr<2;dr++)for(let dc=0;dc<2;dc++){ if(G.grid[r+dr][c+dc]!==null){ okAll=false; break; } }
  if(okAll) anchors.push(`(${c},${r})`);
}
console.log('锚点(左上角):', anchors.join(' '));
