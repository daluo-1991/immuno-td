// 自检：2×2 拖动行为（光标即左上角，2026-07-18 改）
// ① 拖动跟手 → pointermove 无限制更新 hoverC/hoverR + 预览框始终在光标位（不吸附）
// ② 只能放在「光标位作为2×2左上角、4格全绿」的位置（4个合法锚点）
// ③ 暗格/越界/部分暗格 松手→卡片退商店（不消耗）
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('L1_play.html','utf-8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl(id){
  return {
    id, _children:[], textContent:'', innerHTML:'', value:'', width:336, height:432,
    style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    onclick:null,_listeners:{},addEventListener(t,fn){(this._listeners[t]||(this._listeners[t]=[])).push(fn)},removeEventListener(){},
    appendChild(c){this._children.push(c)},
    querySelectorAll(sel){return [];},get childElementCount(){return this._children.length},
    getContext(){return ctxStub},getBoundingClientRect(){return{left:0,top:0,width:336,height:432}},
    setPointerCapture(){},releasePointerCapture(){},
  };
}
const ctxStub=new Proxy({},{get(){return()=>{}}});
const els={},docListeners={};
const document={
  getElementById(id){if(!els[id])els[id]=makeEl(id);return els[id]},
  addEventListener(t,fn){(docListeners[t]||(docListeners[t]=[])).push(fn)},
  createElement(){return makeEl('dyn')},body:{appendChild(){}},
};
const window={};
const ctx={document,window,requestAnimationFrame:()=>{},setInterval:()=>0,setTimeout:(fn)=>0,alert:()=>{},console,
  Math,Date,JSON,Object,Array,Proxy,String,Number,Boolean,isNaN,parseInt,parseFloat};
ctx.globalThis=ctx;
const exposed=script+`
window.__api={getG:()=>G,CELLS,start,anchorFor,anchorForWithEvict,trySwap,canPlace,diagnosePlacement,renderShop};`;
new vm.Script(exposed).runInNewContext(ctx);
const api=window.__api;
let pass=0,fail=0;
function ok(n,c){if(c){pass++;console.log('  ✅ '+n)}else{fail++;console.log('  ❌ '+n)}}

// 棋盘确认
api.start(); let G=api.getG();
const lockedCount=G.grid.flat().filter(x=>x==='locked').length;
console.log('=== 棋盘确认: '+lockedCount+' 暗格 ===');

// 找所有 2×2 合法锚点（canPlace 为 true 的左上角位）
const validAnchors=[];
for(let r=1;r<=6;r++) for(let c=1;c<=4;c++){
  if(api.canPlace('macrophage',c,r)) validAnchors.push([c,r]);
}
console.log('2×2 合法锚点('+validAnchors.length+'): '+validAnchors.map(a=>'('+a.join(',')+')').join(' '));

// ② 35格逐一测：canPlace(c,r)为true→落子；false→退商店
console.log('\n=== ② 逐格拖放测试（光标即2×2左上角）===');
let placeOK=0, retreatOK=0, errs=[];
for(let r=1;r<=7;r++){
  for(let c=1;c<=5;c++){
    api.start(); G=api.getG();
    const shouldPlace = api.canPlace('macrophage', c, r);  // 在新鲜棋盘上判定
    G.shop[0]='macrophage'; G.selected=-1;
    const lenBefore=G.shop.length;
    api.trySwap(0,'macrophage',c,r);
    const consumed = G.shop.length < lenBefore;
    const placed = !!G.towers.find(t=>t.type==='macrophage');
    if(shouldPlace){
      if(placed&&consumed) placeOK++;
      else errs.push(`(${c},${r})应落子: consumed=${consumed} placed=${!!placed}`);
    }else{
      if(!placed&&!consumed) retreatOK++;
      else errs.push(`(${c},${r})应退商店: consumed=${consumed} placed=${!!placed}`);
    }
  }
}
if(errs.length) errs.forEach(e=>console.log('  ❌ '+e));
ok(`可落子位(${placeOK}个)全部落子`, placeOK===4 && errs.length===0);
ok(`不可落子位(${retreatOK}个)全部退商店`, retreatOK===31 && errs.length===0);

// ③ 暗格松手10次，卡片均在
console.log('\n=== ③ 暗格松手10次，卡片均在 ===');
let lost=0;
for(let i=0;i<10;i++){
  api.start(); G=api.getG();
  G.shop[0]='macrophage'; G.selected=-1;
  const lenBefore=G.shop.length;
  api.trySwap(0,'macrophage',1,1);
  if(G.shop.length < lenBefore) lost++;
}
ok(`10次暗格松手后卡片留存率 ${10-lost}/10`, lost===0);

// ④ 绿暗交界（如(4,4)作为左上角，2×2延伸到暗格col5）松手→退商店
console.log('\n=== ④ 绿暗交界松手→退商店 ===');
const boundaryTests=[[4,3],[4,4],[2,5],[3,5],[4,5]]; // 绿格但2×2延伸到暗格
let bOK=0;
for(const [c,r] of boundaryTests){
  api.start(); G=api.getG();
  G.shop[0]='macrophage'; G.selected=-1;
  const lenBefore=G.shop.length;
  api.trySwap(0,'macrophage',c,r);
  if(G.shop.length===lenBefore) bOK++;
  else console.log(`  ❌ (${c},${r}) 卡片被消耗（应退商店）`);
}
ok(`5个绿暗交界位全部退商店 (${bOK}/5)`, bOK===5);

console.log(`\n==== 结果: ${pass} 通过, ${fail} 失败 ====`);
if(fail) process.exit(1);
