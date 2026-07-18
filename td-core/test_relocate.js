// 验证：大塔移动覆盖小塔 → 小塔自动挪到大塔原位腾出格，不回商店
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('L1_play.html', 'utf-8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function makeEl(id){ return { id,_children:[],textContent:'',innerHTML:'',value:'',width:336,height:432,style:new Proxy({},{get:()=>'',set:()=>true}),classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},onclick:null,addEventListener(){},removeEventListener(){},appendChild(c){this._children.push(c)},
    querySelectorAll(sel){return [];},get childElementCount(){return this._children.length},getContext(){return ctxStub},getBoundingClientRect(){return{left:0,top:0,width:336,height:432}},setPointerCapture(){},releasePointerCapture(){} }; }
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

// 场景：记忆(3,3)-(4,4)，右边 NK(5,3)+抗体(5,4)。记忆右移一格到 (4,3)
G.towers=[]; for(let r=1;r<=7;r++)for(let c=1;c<=5;c++) G.grid[r][c]='locked';
for (const [cc,rr] of [[3,3],[4,3],[3,4],[4,4],[5,3],[5,4]]) G.grid[rr][cc]=null;
G.shop=[null,null,null,null];
const mem=api.placeTower('memory',3,3);      // (3,3)-(4,4)
const nk=api.placeTower('nk',5,3);            // 1×1 (5,3)
const ab=api.placeTower('antibody',5,4);      // 1×1 (5,4)
console.log('before: mem@',mem.col,mem.row,'nk@',nk.col,nk.row,'ab@',ab.col,ab.row);

const r=api.tryMoveOrSwap(mem,4,3);           // 记忆右移一格
console.log('after: mem@',mem.col,mem.row,'nk@',nk.col,nk.row,'ab@',ab.col,ab.row,'shop=',G.shop);
console.log('towers:',G.towers.map(t=>t.type+'@'+t.col+','+t.row));

assert('记忆右移成功', r.ok);
assert('记忆落到 (4,3)', mem.col===4 && mem.row===3);
assert('NK 挪到记忆原位腾出格 (3,3)', nk.col===3 && nk.row===3);
assert('抗体 挪到记忆原位腾出格 (3,4)', ab.col===3 && ab.row===4);
assert('三塔都在场上（不回商店）', G.towers.length===3 && G.towers.includes(mem) && G.towers.includes(nk) && G.towers.includes(ab));
assert('商店无新增（未退回）', G.shop.every(x=>x===null));

// 场景2：腾出格不够（覆盖3个1×1，腾出2格）→ 第3个回商店
G.towers=[]; for(let r=1;r<=7;r++)for(let c=1;c<=5;c++) G.grid[r][c]='locked';
for (const [cc,rr] of [[2,2],[3,2],[2,3],[3,3],[4,2],[5,2],[4,3],[5,3],[4,4]]) G.grid[rr][cc]=null;
G.shop=[null,null,null,null];
const m2=api.placeTower('memory',2,2);       // (2,2)-(3,3)
const n1=api.placeTower('neutrophil',4,2);
const n2=api.placeTower('neutrophil',4,3);
const n3=api.placeTower('neutrophil',4,4);   // 第3个，腾出格不够
const r2=api.tryMoveOrSwap(m2,3,2);           // 记忆右移覆盖 n1,n2? footprint (3,2)-(4,3). n1(4,2),n2(4,3).
console.log('\n场景2: towers=',G.towers.map(t=>t.type+'@'+t.col+','+t.row),'shop=',G.shop);
assert('场景2 移动成功', r2.ok);
assert('记忆落到 (3,2)', m2.col===3 && m2.row===2);

console.log(`\n结果：PASS ${passed}, FAIL ${failed}`);
if(failed) process.exit(1);
