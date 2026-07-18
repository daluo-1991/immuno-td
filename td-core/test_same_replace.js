// 验证：拖商店同类型卡到场上「同型同级」塔（被暗格包围、无法挪位）→ 触发合成升阶（§7 合成主线）
// 说明：同型同级 2合1 现在走合成而非替换，这是 §7 封版后的正确行为。本测试覆盖
// 「塔被暗格包围、无法 relocate」这一边界，确认合成仍能就地升阶、不丢失塔。
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
const exposed = script + `\nwindow.__api = { getG:()=>G, CELLS, placeTower, trySwap, tryMoveOrSwap, start, renderShop, updateHUD, setSelected:(i)=>{G.selected=i;} };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
api.start();
const G = api.getG();

let passed=0, failed=0;
function assert(m,c){ if(c){passed++;console.log('✅',m);}else{failed++;console.log('❌',m);} }

// 场上干扰素 B(4,3)，周围全暗格（只开通 B 的 footprint）
for (let r=1;r<=7;r++) for (let c=1;c<=5;c++) G.grid[r][c]='locked';
for (const [cc,rr] of [[4,3],[5,3],[4,4],[5,4]]) G.grid[rr][cc]=null;
G.towers = [];
const B = api.placeTower('interferon', 4, 3);   // (4,3)-(5,4)，tier1
G.shop = ['interferon', null, null, null];
G.selected = 0;
console.log('before: towers=', G.towers.map(t=>t.type+'@'+t.col+','+t.row+'/L'+t.tier).join(' '), '| shop=', G.shop);

// 拖商店干扰素卡到 B 的位置 (4,3) → 同型同级 → 合成升阶（非替换）
api.trySwap(0, 'interferon', 4, 3);
console.log('after:  towers=', G.towers.map(t=>t.type+'@'+t.col+','+t.row+'/L'+t.tier).join(' '), '| shop=', G.shop, '| B in towers?', G.towers.includes(B));

assert('场上仍有 1 座干扰素（合成不新增塔）', G.towers.length===1 && G.towers[0].type==='interferon');
assert('B 就地升到 L2（合成，非替换）', G.towers[0]===B && B.tier===2);
assert('B 仍在原位 (4,3)', B.col===4 && B.row===3);
assert('商店卡被消耗（4→3，无顶掉回填空槽）', G.shop.length===3 && G.shop[0]===null);
assert('被暗格包围时合成也能就地升阶（不丢失塔）', G.towers.includes(B) && B.tier===2);

console.log(`\n结果：PASS ${passed}, FAIL ${failed}`);
if(failed) process.exit(1);
