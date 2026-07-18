// 测试「合成」按钮：条件检测 + 一键合成（三类：商店→场、商店↔商店、场↔场）+ 连锁
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(__dirname+'/L1_play.html','utf-8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function makeEl(id){
  const el={id,_children:[],style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    addEventListener(){},appendChild(){},get childElementCount(){return 0},
    getContext(){return new Proxy({},{get(){return()=>{}}})},
    getBoundingClientRect(){return{left:0,top:0,width:336,height:432}},setPointerCapture(){},querySelectorAll(){return[]}};
  let h='';Object.defineProperty(el,'innerHTML',{get:()=>h,set:v=>{h=String(v)}});return el;
}
const ctxStub=new Proxy({},{get(){return()=>{}}});
const els={};
const document={getElementById:id=>(els[id]||(els[id]=makeEl(id))),addEventListener(){},createElement:()=>makeEl('d'),body:{appendChild(){}}};
const window={};const _store={};
const localStorage={getItem:k=>k in _store?_store[k]:null,setItem:(k,v)=>{_store[k]=String(v)}};
const ctx={document,window,localStorage,requestAnimationFrame:()=>{},setInterval:()=>0,setTimeout:()=>0,alert:()=>{},console,Math,Date,JSON,Object,Array,Proxy,String,Number,Boolean,isNaN,parseInt,parseFloat};ctx.globalThis=ctx;
new vm.Script(script+'\nwindow.__api={getG:()=>G,placeTower,trySwap,newGame,mergeAll,findMergeOpportunities,updateMergeButton,MAX_TIER,CELLS,cardType,cardTier,LET:typeof LEVEL!=="undefined"?LEVEL:null};').runInNewContext(ctx);
const api=window.__api;
let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;console.log('  ✓ '+name);} else {fail++;console.log('  ✗ '+name);} }
// 新开一章并把状态置为「运行中、空棋盘」（模拟布防阶段，合成按钮可见）
function reset(){ api.newGame(0); const g=api.getG(); g.towers=[]; g.shop=[null,null,null,null]; g.running=true; return g; }

console.log('=== 1. 按钮初期隐藏（无合成条件）===');
let G=reset();
api.updateMergeButton();
ok('无合成条件时按钮不显示', !els.mergeBtn.classList.contains('show'));

console.log('=== 2. 商店卡↔场上塔 一键合成 ===');
G=reset();
api.placeTower('tcell',2,3,1);                 // 场上 Lv1 T细胞
G.shop[1]={type:'tcell',tier:1};               // 商店 Lv1 T细胞卡
api.updateMergeButton();
ok('出现合成按钮', els.mergeBtn.classList.contains('show'));
ok('机会数=1', api.findMergeOpportunities().length===1);
api.mergeAll();
G=api.getG();
const tc=G.towers.find(t=>t.type==='tcell');
ok('场上 T细胞升到 Lv2', tc && tc.tier===2);
ok('商店卡被消费(槽空)', G.shop[1]===null);
ok('合成后按钮隐藏', !els.mergeBtn.classList.contains('show'));

console.log('=== 3. 场上塔↔场上塔 一键合成 ===');
G=reset();
api.placeTower('nk',2,3,1);                    // Lv1 NK
api.placeTower('nk',3,4,1);                    // Lv1 NK
api.updateMergeButton();
ok('机会数=1（两座同阶）', api.findMergeOpportunities().length===1);
api.mergeAll();
G=api.getG();
const nks=G.towers.filter(t=>t.type==='nk');
ok('剩 1 座 NK', nks.length===1);
ok('该 NK 升到 Lv2', nks[0].tier===2);

console.log('=== 4. 商店卡↔商店卡 一键合成 ===');
G=reset();
G.shop=[null,{type:'antibody',tier:1},{type:'antibody',tier:1},null];
api.updateMergeButton();
ok('机会数=1（两张同阶商店卡）', api.findMergeOpportunities().length===1);
api.mergeAll();
G=api.getG();
ok('一个槽升到 Lv2', G.shop.some(it=>it&&api.cardType(it)==='antibody'&&api.cardTier(it)===2));
ok('被合成的伙伴槽清空', G.shop[2]===null);

console.log('=== 5. 连锁合成（合成后产生新的同阶组合，再合一次）===');
G=reset();
// 场: Lv1 巨噬 + Lv2 巨噬；商店: Lv1 巨噬
// 点一次 → 商店Lv1 并入场Lv1 变 Lv2 → 两座 Lv2 场巨噬再合成 → 出现 Lv3
api.placeTower('macrophage',2,3,1);
api.placeTower('macrophage',3,4,2);
G.shop[1]={type:'macrophage',tier:1};
api.updateMergeButton();
const opp=api.findMergeOpportunities().length;
api.mergeAll();
G=api.getG();
const boardMac=G.towers.filter(t=>t.type==='macrophage');
ok('初始机会≥1', opp>=1);
ok('连锁后只剩 1 座巨噬', boardMac.length===1);
ok('该巨噬升到 Lv3（两次连锁）', boardMac[0].tier===3);
ok('商店卡被消费', G.shop[1]===null);

console.log('=== 6. 满级封顶：MAX_TIER 不再被合成 ===');
G=reset();
api.placeTower('tcell',2,3,api.MAX_TIER);      // 场上满级
G.shop[1]={type:'tcell',tier:api.MAX_TIER};    // 商店满级
api.updateMergeButton();
ok('满级不出现合成按钮', !els.mergeBtn.classList.contains('show'));
ok('机会数=0', api.findMergeOpportunities().length===0);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail?1:0);
