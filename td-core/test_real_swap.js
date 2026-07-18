// 加载真实 L1_play.html 脚本，用 DOM 打桩，模拟用户真实交互：
// 1) 选商店干扰素卡 → 2) 点击记忆细胞 footprint 左上角 (2,3) → 看实际棋盘落点
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('L1_play.html', 'utf-8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// ---- DOM 打桩 ----
function makeEl(id){
  const el = {
    id, _children:[], textContent:'', innerHTML:'', value:'', width:336, height:432,
    style:new Proxy({},{get:()=>'' ,set:()=>true}),
    classList:{ _s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,f){ f?this._s.add(c):this._s.delete(c) }, contains(c){return this._s.has(c)} },
    onclick:null,
    addEventListener(){}, removeEventListener(){},
    appendChild(c){ this._children.push(c); }, get childElementCount(){ return this._children.length; },
    getContext(){ return ctxStub; },
    querySelectorAll(sel){ return []; },
    getBoundingClientRect(){ return { left:0, top:0, width:336, height:432 }; },
    setPointerCapture(){}, releasePointerCapture(){},
  };
  return el;
}
const ctxStub = new Proxy({}, { get(){
  return ()=>{}; // 所有 canvas 方法都是 no-op
}});
const els = {};
const document = {
  getElementById(id){ if(!els[id]) els[id]=makeEl(id); return els[id]; },
  addEventListener(){}, createElement(){ return makeEl('dyn'); },
  body:{ appendChild(){} },
};
const window = {};
const requestAnimationFrame = ()=>{}; // 阻止真实游戏循环
const setInterval = ()=>0;
const setTimeout = (fn)=>0;
const alert = ()=>{};
const console2 = console;

const ctx = {
  document, window, requestAnimationFrame, setInterval, setTimeout, alert, console:console2,
  Math, Date, JSON, Object, Array, Proxy, String, Number, Boolean, isNaN, parseInt, parseFloat,
};
ctx.globalThis = ctx;

// 暴露内部函数
const exposed = script + `
window.__api = {
  getG:()=>G, CELLS, selectSlot, handleTap, trySwap, placeTower, start, renderShop, canPlace, anchorFor,
  setSelected:(i)=>{ G.selected=i; },
  cvXY:null,
};`;
new vm.Script(exposed).runInNewContext(ctx);

const api = window.__api;
api.start();

// 构造场景：记忆细胞(2×2) 在 (2,3) 占 footprint (col2-3, row3-4)
const G = api.getG();
// 清空商店并放入干扰素供选择
G.shop = [null, 'interferon', null, null];
// 注入记忆细胞
const mem = api.placeTower('memory', 2, 3);
api.renderShop();

console.log('—— 初始状态 ——');
console.log('记忆位置 col,row =', mem.col, mem.row, ' size=', mem.size);
console.log('interferon size =', api.CELLS['interferon'].size);

// 模拟用户：选商店干扰素卡（slot 1），然后点击记忆 footprint 左上角 (2,3)
api.setSelected(1);
console.log('\n—— 选卡后 G.selected =', G.selected);
api.handleTap({ clientX: 2*48+24, clientY: 3*48+24, preventDefault(){} });

console.log('\n—— 替换后状态 ——');
console.log('G.selected =', G.selected);
console.log('场上塔数量 =', G.towers.length);
console.log('场上塔：', G.towers.map(t=>({type:t.type, col:t.col, row:t.row, size:t.size})));
console.log('shop 状态：', G.shop);
// 检查记忆 footprint 是否被干扰素完整覆盖
const inter = G.towers.find(t=>t.type==='interferon');
if(inter){
  const covered = [[2,3],[3,3],[2,4],[3,4]].every(([c,r])=>G.grid[r][c]===inter);
  console.log('干扰素完整覆盖原记忆 footprint(2-3,3-4)?', covered);
  console.log('干扰素 footprint 左上角 =', inter.col, inter.row);
}
const stillMem = G.towers.find(t=>t.type==='memory');
console.log('记忆细胞是否还在场上?', !!stillMem);
