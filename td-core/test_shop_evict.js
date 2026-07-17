// 验证：拖商店记忆卡到巨噬上 / 巨噬旁空格 → 都能顶掉巨噬（anchorForWithEvict 统一）
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('immuno-td/td-core/L1_play.html', 'utf-8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function makeEl(id){ return { id,_children:[],textContent:'',innerHTML:'',value:'',width:336,height:432,style:new Proxy({},{get:()=>'',set:()=>true}),classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},onclick:null,addEventListener(){},removeEventListener(){},appendChild(c){this._children.push(c)},get childElementCount(){return this._children.length},getContext(){return ctxStub},getBoundingClientRect(){return{left:0,top:0,width:336,height:432}},setPointerCapture(){},releasePointerCapture(){} }; }
const ctxStub = new Proxy({}, { get(){ return ()=>{}; }});
const els = {};
const document = { getElementById(id){ if(!els[id]) els[id]=makeEl(id); return els[id]; }, addEventListener(){}, createElement(){ return makeEl('dyn'); }, body:{ appendChild(){} } };
const window = {};
const requestAnimationFrame = ()=>{}, setInterval = ()=>0, setTimeout = ()=>0, alert = ()=>{};
const ctx = { document, window, requestAnimationFrame, setInterval, setTimeout, alert, console, Math, Date, JSON, Object, Array, Proxy, String, Number, Boolean, isNaN, parseInt, parseFloat, Set, Map, WeakMap, Error };
ctx.globalThis = ctx;
const exposed = script + `\nwindow.__api = { getG:()=>G, CELLS, placeTower, anchorForWithEvict, removeTowerFromGrid, findFreeShopSlot, start, renderShop, updateHUD };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
api.start();
const G = api.getG();
let passed=0, failed=0;
function assert(m,c){ if(c){passed++;console.log('✅',m);}else{failed++;console.log('❌',m);} }

// 暗格环境，开通巨噬 footprint (4,2)-(5,3) + 左侧空格 (3,2),(3,3)
for (let r=1;r<=7;r++) for (let c=1;c<=5;c++) G.grid[r][c]='locked';
for (const [cc,rr] of [[3,2],[3,3],[4,2],[5,2],[4,3],[5,3]]) G.grid[rr][cc]=null;
G.towers = [];
const B = api.placeTower('macrophage', 4, 2);   // (4,2)-(5,3)
G.shop = ['memory', null, null, null];

// 拖商店记忆卡到巨噬【上】(4,2)
const r1 = api.anchorForWithEvict('memory', 4, 2, null);
console.log('拖到巨噬上(4,2):', r1 && {anchor:r1.anchor, targets:r1.targets.map(x=>x.type)});
assert('拖到巨噬上有合法落点', !!r1);
assert('targets 含巨噬（顶掉）', r1 && r1.targets.includes(B));

// 拖商店记忆卡到巨噬【旁空格】(3,2)
const r2 = api.anchorForWithEvict('memory', 3, 2, null);
console.log('拖到巨噬旁(3,2):', r2 && {anchor:r2.anchor, targets:r2.targets.map(x=>x.type)});
assert('拖到巨噬旁空格有合法落点', !!r2);
assert('targets 含巨噬（顶掉）', r2 && r2.targets.includes(B));

// 拖到纯空格(无塔覆盖) → targets=[]（摆放不顶掉）：用 (3,3) 如果 footprint 不覆盖巨噬
// (3,3) footprint (3,3)-(4,4). (4,3)=巨噬. 覆盖. 换 (2,2)? 需开通. 跳过.

console.log(`\n结果：PASS ${passed}, FAIL ${failed}`);
if(failed) process.exit(1);
