// 自检：2×2 拖动行为三要素 (2026-07-18)
// ① 拖动跟手 → pointermove 无限制更新 hoverC/hoverR（代码路径确认）
// ② 只能放在绿格 → anchorFor 严格模式 — 2×2 仅精确4候选
// ③ 暗格松手退商店 → trySwap null 时不 splice 消耗卡片
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('L1_play.html','utf-8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl(id){
  return {
    id, _children:[], textContent:'', innerHTML:'', value:'', width:336, height:432,
    style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    onclick:null,_listeners:{},addEventListener(t,fn){(this._listeners[t]||(this._listeners[t]=[])).push(fn)},removeEventListener(){},
    appendChild(c){this._children.push(c)},get childElementCount(){return this._children.length},
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
window.__api={getG:()=>G,CELLS,start,anchorFor,anchorForWithEvict,trySwap,diagnosePlacement,renderShop,canPlace};`;
new vm.Script(exposed).runInNewContext(ctx);
const api=window.__api;
let pass=0,fail=0;
function ok(n,c){if(c){pass++;console.log('  ✅ '+n)}else{fail++;console.log('  ❌ '+n)}}

// 棋盘确认
api.start(); const G0=api.getG();
const lockedCount=G0.grid.flat().filter(x=>x==='locked').length;
console.log('=== 棋盘确认: '+lockedCount+' 暗格 ===');

// 找所有 2×2 合法锚点
api.start(); let G=api.getG();
const validAnchors=[]; // 存储锚点 [col,row]
for(let r=1;r<=6;r++){
  let line='  row'+r+': ';
  for(let c=1;c<=5;c++){
    const v=G.grid[r][c];
    if(v===null) line+='G'; else if(v==='locked') line+='L'; else{ line+='.';}
  }
  for(let c=1;c<=4;c++){
    if(api.canPlace('macrophage',c,r)) validAnchors.push([c,r]);
  }
  console.log(line);
}
console.log('2×2 合法锚点('+validAnchors.length+'): '+validAnchors.map(a=>a.join(',')).join(' | '));

// ② 35格逐一测
console.log('\n=== ② 逐格拖放测试 ===');
let greenOK=0,darkOK=0,errs=[];
for(let r=1;r<=7;r++){
  for(let c=1;c<=5;c++){
    // 判断鼠标格是否在某个合法锚点的footprint内
    let cursorInGreen=false;
    for(const [ac,ar] of validAnchors){
      if(c>=ac&&c<ac+2&&r>=ar&&r<ar+2){cursorInGreen=true;break;}
    }
    api.start(); G=api.getG();
    G.shop[0]='macrophage'; G.selected=-1;
    const shopLenBefore = G.shop.length;
    api.trySwap(0,'macrophage',c,r);
    const consumed = G.shop.length < shopLenBefore;   // splice 消耗后数组压缩，长度-1
    const placed = !!G.towers.find(t=>t.type==='macrophage');
    if(cursorInGreen){
      if(placed&&consumed) greenOK++;
      else errs.push(`绿格区(${c},${r})应落子: consumed=${consumed} placed=${!!placed}`);
    }else{
      if(!placed&&!consumed) darkOK++;
      else errs.push(`暗格区(${c},${r})应退商店: consumed=${consumed} placed=${!!placed}`);
    }
  }
}
if(errs.length) errs.forEach(e=>console.log('  ❌ '+e));
ok(`绿格区可落子 (${greenOK}/9 成功)`, greenOK===9);
ok(`暗格区退商店 (${darkOK}/26 成功)`, darkOK===26);

// ③ 退商店不丢卡
console.log('\n=== ③ 暗格松手10次，卡片均在 ===');
let lost=0;
for(let i=0;i<10;i++){
  api.start(); G=api.getG();
  G.shop[0]='macrophage'; G.selected=-1;
  const shopLenBefore = G.shop.length;
  api.trySwap(0,'macrophage',1,1); // (1,1)始终暗格
  if(G.shop.length < shopLenBefore) lost++;   // 卡片消耗=长度-1
}
ok(`10次暗格松手后卡片留存率 ${10-lost}/10`, lost===0);

console.log(`\n==== 结果: ${pass} 通过, ${fail} 失败 ====`);
if(fail) process.exit(1);
