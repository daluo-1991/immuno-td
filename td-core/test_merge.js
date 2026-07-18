// §7 合成主线自检：同型同级 2合1 → tier+1（占位不变，属性按阶递增）
// 用真实代码 vm 加载 L1_play.html 验证（2026-07-18）
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('L1_play.html','utf-8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl(id){
  const el={
    id,_children:[],textContent:'',value:'',width:336,height:432,
    style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    onclick:null,_listeners:{},addEventListener(t,fn){(this._listeners[t]||(this._listeners[t]=[])).push(fn)},
    removeEventListener(){},appendChild(c){this._children.push(c)},
    get childElementCount(){return this._children.length},
    getContext(){return ctxStub},getBoundingClientRect(){return{left:0,top:0,width:336,height:432}},
    setPointerCapture(){},releasePointerCapture(){},querySelectorAll(sel){return [];}
  };
  let _html=''; Object.defineProperty(el,'innerHTML',{get:()=>_html,set:v=>{_html=String(v);}});
  return el;
}
const ctxStub=new Proxy({},{get(){return()=>{}}});
const els={},docListeners={};
const _store={};
const localStorage={getItem:k=>(k in _store?_store[k]:null),setItem:(k,v)=>{_store[k]=String(v)},removeItem:k=>{delete _store[k]}};
const document={getElementById(id){if(!els[id])els[id]=makeEl(id);return els[id]},addEventListener(t,fn){(docListeners[t]||(docListeners[t]=[])).push(fn)},createElement(){return makeEl('dyn')},body:{appendChild(){}}};
const window={};
const ctx={document,window,localStorage,requestAnimationFrame:()=>{},setInterval:()=>0,setTimeout:(fn)=>0,alert:()=>{},console,Math,Date,JSON,Object,Array,Proxy,String,Number,Boolean,isNaN,parseInt,parseFloat};
ctx.globalThis=ctx;
const exposed=script+'\nwindow.__api={getG:()=>G,CELLS,eff,findMergeTarget,placeTower,trySwap,tryMoveOrSwap,drawTower,newGame,start};';
new vm.Script(exposed).runInNewContext(ctx);
const api=window.__api;

let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;console.log('  ✅ '+name);} else {fail++;console.log('  ❌ '+name);} }

console.log('=== 1. eff() 阶数增益 ===');
api.newGame(0);
const base=api.CELLS.neutrophil;
const e1=api.eff({type:'neutrophil',tier:1});
const e2=api.eff({type:'neutrophil',tier:2});
const e3=api.eff({type:'neutrophil',tier:3});
ok('tier1 dps == 基础 dps', Math.abs(e1.dps-base.dps)<1e-6);
ok('tier2 dps ≈ 基础×1.7', Math.abs(e2.dps-base.dps*1.7)<1e-6);
ok('tier3 dps ≈ 基础×1.7²', Math.abs(e3.dps-base.dps*1.7*1.7)<1e-6);
ok('range 随阶 +0.45/阶', Math.abs(e2.range-(base.range+0.45))<1e-6);
ok('atkSpeed 随阶递增', e2.atkSpeed>base.atkSpeed && e3.atkSpeed>e2.atkSpeed);

console.log('=== 2. placeTower 默认 tier=1 ===');
api.newGame(0); let G=api.getG();
const tw=api.placeTower('neutrophil',2,3);
ok('新塔 tier===1', tw.tier===1);
ok('网格写入 tower 对象', G.grid[3][2]===tw);

console.log('=== 3. 商店卡拖到同型同级塔 → 合成升阶 ===');
api.newGame(0); G=api.getG();
api.placeTower('neutrophil',2,3);                 // 场上 tier1 中性粒
G.shop=['neutrophil','tcell','tcell','tcell']; G.selected=-1;
const before=G.towers.length;
api.trySwap(0,'neutrophil',2,3);                  // 商店中性粒拖到场上中性粒
const m=G.towers.find(t=>t.type==='neutrophil'&&t.col===2&&t.row===3);
ok('场上塔升到 tier2', m && m.tier===2);
ok('塔数量不变（合成不新增塔）', G.towers.length===before);
ok('商店卡被消耗（4→3）', G.shop.length===3);
ok('没有 tier1 中性粒残留', !G.towers.some(t=>t.type==='neutrophil'&&t.tier===1&&t.col===2&&t.row===3&&m.tier!==1));

console.log('=== 4. 场上塔拖到同型同级塔 → 合成（source 被吸收） ===');
api.newGame(0); G=api.getG();
const A=api.placeTower('neutrophil',2,3);         // tier1 @(2,3)
const B=api.placeTower('neutrophil',3,3);         // tier1 @(3,3)
const before2=G.towers.length;
const res=api.tryMoveOrSwap(A,3,3);                // 拖 A 到 B 上
ok('返回合成成功', res && res.merged===true);
ok('塔数 2→1（source 被吸收）', G.towers.length===before2-1);
const remain=G.towers.find(t=>t.type==='neutrophil');
ok('残留塔在 B 位(3,3)、tier2', remain && remain.col===3&&remain.row===3&&remain.tier===2);
ok('A 已从网格移除', G.grid[3][2]===null);

console.log('=== 5. 异型 / 异级 不合成（走替换/落子） ===');
api.newGame(0); G=api.getG();
api.placeTower('macrophage',2,3);                 // 巨噬 tier1 @(2,3)
G.shop=['neutrophil','tcell','tcell','tcell']; G.selected=-1;
api.trySwap(0,'neutrophil',2,3);                  // 中性粒卡拖到巨噬上：异型→替换
const neu=G.towers.find(t=>t.type==='neutrophil');
const mac=G.towers.find(t=>t.type==='macrophage');
ok('异型不合成：中性粒落子 tier1', neu && neu.tier===1 && neu.col===2 && neu.row===3);
ok('被顶巨噬回商店（保留 tier）', mac===undefined && G.shop.some(it=>(it&&typeof it==='object'?it.type:it)==='macrophage'));

api.newGame(0); G=api.getG();
const t2=api.placeTower('neutrophil',2,3); t2.tier=2;   // 手动设 tier2
G.shop=['neutrophil','tcell','tcell','tcell']; G.selected=-1;
api.trySwap(0,'neutrophil',2,3);                  // 商店 tier1 卡拖到 tier2 塔：异级→替换
const t3=G.towers.find(t=>t.type==='neutrophil'&&t.col===2&&t.row===3);
ok('异级不合成：新落 tier1 中性粒', t3 && t3.tier===1);
const back2=G.shop.find(it=>it&&typeof it==='object'&&it.type==='neutrophil');
ok('旧 tier2 塔回商店且保留 tier=2', back2 && back2.tier===2);

console.log('=== 6. 红细胞合成产能随阶放大 ===');
const r1=api.eff({type:'redcell',tier:1});
const r2=api.eff({type:'redcell',tier:2});
ok('红细胞 tier1 energyRate = 基础(2)', Math.abs(r1.energyRate-2)<1e-6);
ok('红细胞 tier2 energyRate ≈ 基础×1.7', Math.abs(r2.energyRate-2*1.7)<1e-6);

console.log('=== 7. drawTower 不崩（含 tier 角标） ===');
api.newGame(0); G=api.getG();
const rt=api.placeTower('interferon',2,3); rt.tier=3;   // 2×2 高阶
let drewOk=false; try{ api.drawTower(rt); drewOk=true; }catch(e){ console.log('    drawTower 异常:',e.message); }
ok('drawTower(tier3 2×2) 无异常', drewOk);

console.log('\n=== 结果 ===');
console.log(`${pass} 通过 / ${fail} 失败`);
process.exit(fail?1:0);
