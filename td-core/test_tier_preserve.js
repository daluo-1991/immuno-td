// 回归：升级塔(被挤回商店)保留 tier；重摆仍是该 tier；商店卡可携带 tier（Lv.2 卡直接摆放/合成）
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
const exposed=script+'\nwindow.__api={getG:()=>G,CELLS,eff,findMergeTarget,placeTower,trySwap,tryMoveOrSwap,drawTower,newGame,start,rollShop,cardType,cardTier,isTileCard};';
new vm.Script(exposed).runInNewContext(ctx);
const api=window.__api;
let pass=0,fail=0;
function ok(n,c){ if(c){pass++;console.log('  ✅ '+n);} else {fail++;console.log('  ❌ '+n);} }

console.log('=== 1. 升级塔被挤回商店，tier 保留 ===');
api.newGame(0); let G=api.getG();
api.placeTower('macrophage',2,3);                 // 场上 Lv1
G.shop=['macrophage','neutrophil','neutrophil','neutrophil']; G.selected=-1;
api.trySwap(0,'macrophage',2,3);                  // 合成 → 场上 Lv2
let t2=G.towers.find(t=>t.type==='macrophage');
ok('场上巨噬升到 Lv2', t2 && t2.tier===2);
// 用邻格中性粒顶掉巨噬，逼它回商店
api.placeTower('neutrophil',3,3);
let nt=G.towers.find(t=>t.type==='neutrophil'&&t.col===3&&t.row===3);
api.tryMoveOrSwap(nt,2,3);                         // 中性粒覆盖巨噬位
G=api.getG();
let back=G.shop.find(it=>typeof it==='object' && it.type==='macrophage');
ok('巨噬以对象形式回商店', !!back);
ok('回商店的巨噬保留 tier=2', back && back.tier===2);
// 把这张 Lv2 卡重新摆回场上
let slot=G.shop.indexOf(back);
api.trySwap(slot, back, 2, 3);
G=api.getG();
let re=G.towers.find(t=>t.type==='macrophage'&&t.col===2&&t.row===3);
ok('重摆后仍是 Lv2（tier 未丢）', re && re.tier===2);

console.log('\n=== 2. 商店 Lv2 卡可直接摆放 ===');
api.newGame(0); G=api.getG();
G.shop=[{type:'tcell',tier:2}, 'neutrophil','neutrophil','neutrophil']; G.selected=-1;
api.trySwap(0, G.shop[0], 2, 3);
G=api.getG();
let tc=G.towers.find(t=>t.type==='tcell'&&t.col===2&&t.row===3);
ok('Lv2 T细胞卡落场即 Lv2', tc && tc.tier===2);
ok('落子后该卡从商店消耗', G.shop[0]!==G.shop[0] || G.shop.length<4 || !G.shop.includes(G.shop[0]));

console.log('\n=== 3. 商店 Lv2 卡拖到场上 Lv2 同型塔 → 合成 Lv3 ===');
api.newGame(0); G=api.getG();
api.placeTower('nk',2,3);                          // 场上 Lv1
G.shop=[{type:'nk',tier:2},'neutrophil','neutrophil','neutrophil']; G.selected=-1;
api.trySwap(0, G.shop[0], 2, 3);
G=api.getG();
let nk=G.towers.find(t=>t.type==='nk'&&t.col===2&&t.row===3);
ok('Lv2 卡 + Lv1 塔 不匹配同级 → 不合成（落子为 Lv2）', nk && nk.tier===2);
// 再来一张 Lv2 卡合成到这张 Lv2
G.shop=[{type:'nk',tier:2},'neutrophil','neutrophil','neutrophil']; G.selected=-1;
api.trySwap(0, G.shop[0], 2, 3);
G=api.getG();
nk=G.towers.find(t=>t.type==='nk'&&t.col===2&&t.row===3);
ok('Lv2 卡 + Lv2 塔 → 合成到 Lv3', nk && nk.tier===3);

console.log('\n=== 4. 辅助函数 ===');
ok('cardType(字符串) 返回自身', api.cardType('macrophage')==='macrophage');
ok('cardType({type,tier}) 返回 type', api.cardType({type:'nk',tier:2})==='nk');
ok('cardTier(字符串)=1', api.cardTier('macrophage')===1);
ok('cardTier({type,tier:3})=3', api.cardTier({type:'nk',tier:3})===3);
ok('isTileCard(格子卡)=true', api.isTileCard({name:'竖3',size:3,weight:6,cells:[[0,0],[0,1],[0,2]]})===true);
ok('isTileCard(细胞卡对象)=false', api.isTileCard({type:'nk',tier:2})===false);
ok('isTileCard(字符串)=false', api.isTileCard('macrophage')===false);

console.log('\n通过 '+pass+' / 失败 '+fail);
process.exit(fail?1:0);
