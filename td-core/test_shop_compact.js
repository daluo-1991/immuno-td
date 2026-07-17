// 验证：消耗 splice + 动态 flex（≤4 平分 / >4 固定+滚动）
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
const exposed = script + `\nwindow.__api = { getG:()=>G, renderShop, start };`;
new vm.Script(exposed).runInNewContext(ctx);
const api = window.__api;
api.start();
const G = api.getG();
let passed=0, failed=0;
function assert(m,c){ if(c){passed++;console.log('✅',m);}else{failed++;console.log('❌',m);} }

const row = document.getElementById('shopRow');

// 初始 4 张：平分（无 .scroll）
api.renderShop();
assert('初始 4 张 → row 无 .scroll（flex:1 平分）', !row.classList.contains('scroll'));

// 模拟被顶掉 push 第 5 张（>4 → 固定宽度+滚动）
G.shop.push('macrophage');
api.renderShop();
assert('push 到 5 张 → row 有 .scroll（固定宽度+overflow-x:auto）', row.classList.contains('scroll'));

// 模拟消耗一个（splice，length 减）
G.shop.splice(0, 1);
api.renderShop();
assert('splice 消耗后 4 张 → row 无 .scroll（自动变回平分，右边卡左移变可见）', !row.classList.contains('scroll'));
assert('splice 后 shop 长度 4', G.shop.length===4);

// 继续消耗
G.shop.splice(0, 1);
api.renderShop();
assert('再消耗 → 3 张仍无 .scroll', !row.classList.contains('scroll'));

// 用尽
while(G.shop.length>0) G.shop.splice(0,1);
api.renderShop();
assert('用尽（length=0）仍无 .scroll', !row.classList.contains('scroll'));

// 再 push 回 5 张
for(let i=0;i<5;i++) G.shop.push('interferon');
api.renderShop();
assert('再 push 到 5 张 → 又有 .scroll', row.classList.contains('scroll'));

console.log(`\n结果：PASS ${passed}, FAIL ${failed}`);
if(failed) process.exit(1);
