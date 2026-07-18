// 验证：商店满4，拖场上塔顶掉多塔 → push 新槽（左滑可见），不丢弃
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

// 开通区域放3塔
for (let r=2;r<=6;r++) for (let c=2;c<=5;c++) G.grid[r][c]=null;
G.towers = [];
G.shop = ['neutrophil','neutrophil','neutrophil','neutrophil'];   // 商店满4
const macro = api.placeTower('macrophage', 1, 1);
const inter = api.placeTower('interferon', 3, 2);
const antibody = api.placeTower('antibody', 4, 2);

const result = api.tryMoveOrSwap(macro, 3, 2);   // 巨噬顶掉 inter+antibody
console.log('result:', result, '| shop:', G.shop);
assert('移动成功', result.ok);
assert('干扰素(2×2)退回商店（push）', G.shop.includes('interferon'));
assert('抗体(1×1)挪到巨噬原位腾出格（在场上）', G.towers.includes(antibody));
assert('商店从4增到5（push 1 干扰素；抗体挪位不进商店）', G.shop.length===5);
assert('原4张中性粒仍在商店', G.shop.filter(x=>x==='neutrophil').length===4);

console.log(`\n结果：PASS ${passed}, FAIL ${failed}`);
if(failed) process.exit(1);
