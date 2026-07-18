// 验证：拖动场上塔到空绿格移动（tryMoveOrSwap 普通移动，不消耗商店卡、不顶掉）
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('L1_play.html', 'utf-8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl(id){
  return { id,_children:[],textContent:'',innerHTML:'',value:'',width:336,height:432,
    style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    onclick:null,addEventListener(){},removeEventListener(){},
    appendChild(c){this._children.push(c)},get childElementCount(){return this._children.length},
    getContext(){return ctxStub},getBoundingClientRect(){return{left:0,top:0,width:336,height:432}},
    setPointerCapture(){},releasePointerCapture(){} };
}
const ctxStub = new Proxy({}, { get(){ return ()=>{}; }});
const els = {};
const document = { getElementById(id){ if(!els[id]) els[id]=makeEl(id); return els[id]; }, addEventListener(){}, createElement(){ return makeEl('dyn'); }, body:{ appendChild(){} } };
const window = {};
const requestAnimationFrame = ()=>{}, setInterval = ()=>0, setTimeout = ()=>0, alert = ()=>{};
const ctx = { document, window, requestAnimationFrame, setInterval, setTimeout, alert, console, Math, Date, JSON, Object, Array, Proxy, String, Number, Boolean, isNaN, parseInt, parseFloat, Set, Map, WeakMap, Error };
ctx.globalThis = ctx;

const exposed = script + `\nwindow.__api = { getG:()=>G, CELLS, placeTower, tryMoveOrSwap, start, renderShop, updateHUD };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
api.start();
const G = api.getG();
let passed=0, failed=0;
function assert(m,c){ if(c){passed++;console.log('✅',m);}else{failed++;console.log('❌',m);} }

// 暗格环境，只开通 mem 占位 (2,3)-(3,4) + 目标区 (4,3)-(5,4)
for (let r=1;r<=7;r++) for (let c=1;c<=5;c++) G.grid[r][c]='locked';
for (const [cc,rr] of [[2,3],[3,3],[2,4],[3,4],[4,3],[5,3],[4,4],[5,4]]) G.grid[rr][cc]=null;
G.towers = [];
const mem = api.placeTower('memory', 2, 3);   // (2,3)-(3,4)
assert('初始记忆在 (2,3)', mem.col===2 && mem.row===3);

G.selected=-1; G.shop=[null,null,null,null];
const result = api.tryMoveOrSwap(mem, 4, 3);   // 拖场上塔到空格 (4,3)
console.log('tryMoveOrSwap 结果:', result, '| mem→', mem.col, mem.row);
assert('拖动到 (4,3) 成功', result.ok===true);
assert('记忆最终落在 (4,3)', mem.col===4 && mem.row===3);
assert('旧 footprint (2,3)-(3,4) 已清空', G.grid[3][2]===null && G.grid[4][3]===null);
assert('新 footprint (4,3)-(5,4) 占位', G.grid[3][4]===mem && G.grid[4][5]===mem);
assert('未消耗商店卡（移动不消耗）', G.shop.every(x=>x===null));
assert('场上仍只有 1 座塔', G.towers.length===1 && G.towers[0]===mem);

console.log(`\n结果：PASS ${passed}, FAIL ${failed}`);
if(failed) process.exit(1);
