// 验证：两个同尺寸塔换位置 → 互换（不回商店）；不同尺寸 → 顶掉回商店
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
const exposed = script + `\nwindow.__api = { getG:()=>G, CELLS, placeTower, tryMoveOrSwap, start, renderShop, updateHUD };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
api.start();
const G = api.getG();
let passed=0, failed=0;
function assert(m,c){ if(c){passed++;console.log('✅',m);}else{failed++;console.log('❌',m);} }

function openCells(list){ for(const [cc,rr] of list) G.grid[rr][cc]=null; }

// 场景1：两个 2×2（巨噬 + 干扰素）互换
G.towers=[]; for(let r=1;r<=7;r++)for(let c=1;c<=5;c++) G.grid[r][c]='locked';
openCells([[2,2],[3,2],[2,3],[3,3],[4,2],[5,2],[4,3],[5,3]]);
G.shop=[null,null,null,null];
const A1=api.placeTower('macrophage',2,2);   // (2,2)-(3,3)
const B1=api.placeTower('interferon',4,2);   // (4,2)-(5,3)
const r1=api.tryMoveOrSwap(A1,4,2);
console.log('场景1 互换2×2:', r1, '| A1→',A1.col,A1.row,'B1→',B1.col,B1.row,'shop=',G.shop);
assert('互换成功', r1.ok && r1.swapped);
assert('巨噬 A 落到干扰素原位 (4,2)', A1.col===4 && A1.row===2);
assert('干扰素 B 落到巨噬原位 (2,2)', B1.col===2 && B1.row===2);
assert('两塔都在场上（不回商店）', G.towers.length===2 && G.towers.includes(A1) && G.towers.includes(B1));
assert('商店无新增（未退回）', G.shop.every(x=>x===null));

// 场景2：两个 1×1（中性粒 + T细胞）互换
G.towers=[]; for(let r=1;r<=7;r++)for(let c=1;c<=5;c++) G.grid[r][c]='locked';
openCells([[2,2],[4,2]]);
G.shop=[null,null,null,null];
const A2=api.placeTower('neutrophil',2,2);
const B2=api.placeTower('tcell',4,2);
const r2=api.tryMoveOrSwap(A2,4,2);
console.log('场景2 互换1×1:', r2, '| A2→',A2.col,A2.row,'B2→',B2.col,B2.row);
assert('1×1 互换成功', r2.ok && r2.swapped);
assert('中性粒落到 (4,2)', A2.col===4 && A2.row===2);
assert('T细胞落到 (2,2)', B2.col===2 && B2.row===2);
assert('两塔都在场上', G.towers.length===2);

// 场景3：不同尺寸（巨噬2×2 + 中性粒1×1）→ 不互换，顶掉回商店
G.towers=[]; for(let r=1;r<=7;r++)for(let c=1;c<=5;c++) G.grid[r][c]='locked';
openCells([[2,2],[3,2],[2,3],[3,3],[4,2],[5,2],[4,3],[5,3]]);
G.shop=[null,null,null,null];
const A3=api.placeTower('macrophage',2,2);   // 2×2
const B3=api.placeTower('neutrophil',4,2);   // 1×1
const r3=api.tryMoveOrSwap(A3,4,2);
console.log('场景3 不同尺寸:', r3, '| A3→',A3.col,A3.row,'B3在场上?',G.towers.includes(B3),'shop=',G.shop);
assert('不同尺寸不互换，仍成功', r3.ok);
assert('巨噬落到 (4,2)', A3.col===4 && A3.row===2);
assert('中性粒挪到巨噬原位腾出格（在场上）', G.towers.includes(B3) && B3.col===2 && B3.row===2);
assert('中性粒未回商店', !G.shop.includes('neutrophil'));

console.log(`\n结果：PASS ${passed}, FAIL ${failed}`);
if(failed) process.exit(1);
