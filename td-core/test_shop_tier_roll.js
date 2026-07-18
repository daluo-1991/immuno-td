// 回归：商店按概率刷出高阶(tier2)细胞卡；商店卡 tier 不超过 MAX_TIER-1；合成封顶 MAX_TIER。
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('L1_play.html','utf-8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function makeEl(id){
  const el={ id,_children:[],textContent:'',value:'',width:336,height:432,
    style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    onclick:null,_listeners:{},addEventListener(t,fn){(this._listeners[t]||(this._listeners[t]=[])).push(fn)},
    removeEventListener(){},appendChild(c){this._children.push(c)},
    get childElementCount(){return this._children.length},
    getContext(){return ctxStub},getBoundingClientRect(){return{left:0,top:0,width:336,height:432}},
    setPointerCapture(){},releasePointerCapture(){},querySelectorAll(sel){return [];} };
  let _html=''; Object.defineProperty(el,'innerHTML',{get:()=>_html,set:v=>{_html=String(v);}});
  return el;
}
const ctxStub=new Proxy({},{get(){return()=>{}}});
const els={},docListeners={}; const _store={};
const localStorage={getItem:k=>(k in _store?_store[k]:null),setItem:(k,v)=>{_store[k]=String(v)},removeItem:k=>{delete _store[k]}};
const document={getElementById(id){if(!els[id])els[id]=makeEl(id);return els[id]},addEventListener(t,fn){(docListeners[t]||(docListeners[t]=[])).push(fn)},createElement(){return makeEl('dyn')},body:{appendChild(){}}};
const window={};
const ctx={document,window,localStorage,requestAnimationFrame:()=>{},setInterval:()=>0,setTimeout:(fn)=>0,alert:()=>{},console,Math,Date,JSON,Object,Array,Proxy,String,Number,Boolean,isNaN,parseInt,parseFloat};
ctx.globalThis=ctx;
const exposed=script+'\nwindow.__api={getG:()=>G,CELLS,eff,findMergeTarget,placeTower,trySwap,tryMoveOrSwap,rollShop,shopTier,cardType,cardTier,MAX_TIER,newGame};';
new vm.Script(exposed).runInNewContext(ctx);
const api=window.__api;
let pass=0,fail=0;
function ok(n,c){ if(c){pass++;console.log('  ✅ '+n);} else {fail++;console.log('  ❌ '+n);} }

// ---------- 1. 商店按概率刷出 tier2 卡（蒙特卡洛） ----------
console.log('=== 1. 商店按概率刷出 tier2 卡 ===');
api.newGame(0); let G=api.getG();
let tier2count=0, tierHigh=0, total=0;
for(let i=0;i<2000;i++){
  G.chapterIdx=0; api.rollShop();
  for(let s=1;s<4;s++){            // 仅看后 3 个细胞卡槽
    total++;
    const it=G.shop[s];
    const tier = (typeof it==='object'&&it.tier) ? it.tier : 1;
    if(tier>=2) tier2count++;
    if(tier > api.MAX_TIER-1) tierHigh++;
  }
}
ok('2000×3 刷新里出现 tier≥2 卡', tier2count>0);
console.log('     tier2 占比 ≈ '+(tier2count/total*100).toFixed(1)+'%');
ok('商店卡 tier 不超过 MAX_TIER-1 (封顶前)', tierHigh===0);

// ---------- 2. 章节越高，tier2 比例越高 ----------
console.log('=== 2. 章节越高 tier2 比例越高 ===');
function rate2(ch){ let n=0,N=2000; for(let i=0;i<N;i++){ if(api.shopTier(ch)>=2) n++; } return n/N; }
const r0=rate2(0), r4=rate2(4);
console.log('     ch0 tier2率≈'+(r0*100).toFixed(1)+'%  ch4≈'+(r4*100).toFixed(1)+'%');
ok('ch4 的 tier2 率 > ch0', r4>r0);
ok('shopTier 任意章节都不超过 MAX_TIER-1', (function(){for(let c=0;c<6;c++)for(let i=0;i<500;i++){if(api.shopTier(c)>api.MAX_TIER-1)return false;}return true;})());

// ---------- 3. 合成封顶 MAX_TIER：满级塔不再被合成 ----------
console.log('=== 3. 合成封顶 MAX_TIER（满级塔不再升阶）===');
api.newGame(0); G=api.getG();
G.towers=[]; G.shop=[null,null,null,null]; G.selected=-1;
api.placeTower('neutrophil',2,3,api.MAX_TIER);          // 场上 Lv.MAX 中性粒（1×1 细胞）
let onBoard=G.towers.find(t=>t.type==='neutrophil');
ok('场上放置 Lv.MAX 中性粒', onBoard && onBoard.tier===api.MAX_TIER);
// 用一张 Lv.MAX 商店卡拖到“不重叠”的远处空位(4,5) → 期望：因封顶不合成，作为新塔落在空位（场上塔不变）
G.shop[1]={type:'neutrophil',tier:api.MAX_TIER};
api.trySwap(1,{type:'neutrophil',tier:api.MAX_TIER},4,5);  // (4,5) 与 (2,3) 不重叠
G=api.getG();
const nks=G.towers.filter(t=>t.type==='neutrophil');
ok('合成被封顶：场上仍只有 Lv.MAX（无 Lv'+(api.MAX_TIER+1)+'）', nks.every(t=>t.tier===api.MAX_TIER));
ok('Lv.MAX 商店卡改放空位（未触发合成）', nks.length===2);

// ---------- 4. 非满级仍可正常合成（回归）----------
console.log('=== 4. 非满级仍可正常合成（回归）===');
api.newGame(0); G=api.getG();
G.towers=[]; G.shop=[null,null,null,null]; G.selected=-1;
api.placeTower('nk',2,3,1);
G.shop[0]={type:'nk',tier:1};
api.trySwap(0,{type:'nk',tier:1},2,3);   // 1+1 → 2
G=api.getG();
const nk=G.towers.find(t=>t.type==='nk');
ok('Lv1 + Lv1 仍合成到 Lv2', nk && nk.tier===2);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail?1:0);
