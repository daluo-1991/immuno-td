// 验证 §6 设计原则：辅助/减益类细胞（抗体/debuff、干扰素/aura）也参战，具备基础攻击力。
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(__dirname+'/L1_play.html','utf-8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function makeEl(id){
  const el={id,_children:[],style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    addEventListener(){},appendChild(){},get childElementCount(){return 0},
    getContext(){return new Proxy({},{get(t,prop){ if(prop==='createRadialGradient'||prop==='createLinearGradient') return ()=>({addColorStop(){}}); return ()=>{}; }})},
    getBoundingClientRect(){return{left:0,top:0,width:336,height:432}},setPointerCapture(){},querySelectorAll(){return[]}};
  let h='';Object.defineProperty(el,'innerHTML',{get:()=>h,set:v=>{h=String(v)}});return el;
}
const els={};
const document={getElementById:id=>(els[id]||(els[id]=makeEl(id))),addEventListener(){},createElement:()=>makeEl('d'),body:{appendChild(){}}};
const window={};const _store={};
const localStorage={getItem:k=>k in _store?_store[k]:null,setItem:(k,v)=>{_store[k]=String(v)}};
const ctx={document,window,localStorage,requestAnimationFrame:()=>{},setInterval:()=>0,setTimeout:()=>0,alert:()=>{},console,Math,Date,JSON,Object,Array,Proxy,String,Number,Boolean,isNaN,parseInt,parseFloat};
ctx.globalThis=ctx;
new vm.Script(script+'\nwindow.__api={getG:()=>G,newGame,placeTower,step,spawnVirus,eff,CELLS,VIRUSES,LEVEL:()=>LEVEL};').runInNewContext(ctx);
const api=window.__api;
let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;console.log('  ✓ '+name);} else {fail++;console.log('  ✗ '+name);} }

console.log('=== 辅助细胞也参战：抗体 / 干扰素 基础攻击 ===');
api.newGame(0);
const G=api.getG();
G.running=true; G.phase='wave';            // 跳过准备期，直接进入战斗
// 在绿簇放 抗体(3,4) 与 干扰素(4,4)
api.placeTower('antibody',3,4,1);
api.placeTower('interferon',4,4,1);
const ab=G.towers.find(t=>t.type==='antibody');
const ifn=G.towers.find(t=>t.type==='interferon');
ok('两塔已落位', ab && ifn);
ok('抗体 dps 由 0 改为 >0 (eff)', api.eff(ab).dps>0);
ok('干扰素 dps 由 0 改为 >0 (eff)', api.eff(ifn).dps>0);
// 在右列 [6,4]≈prog18 造一只病毒，落在两塔射程内
api.spawnVirus('rhinovirus',1);
const v=G.viruses[G.viruses.length-1];
v.prog=18;                                  // 强制放到 (6.5,4.5)，距两塔中心 2~3 格
// 跑 40 帧（dt=0.1 → 4 秒），每帧把病毒 prog 钳在 18~18.5 之间，确保持续在射程内
for(let i=0;i<40;i++){
  v.prog=18+0.25*Math.sin(i/3);             // 在塔射程内轻微浮动，避免跑出范围
  api.step(0.1);
}
console.log('  · 抗体累计伤害 dmg='+(ab.dmg||0).toFixed(1));
console.log('  · 干扰素累计伤害 dmg='+(ifn.dmg||0).toFixed(1));
ok('抗体参战：造成过伤害 (dmg>0)', (ab.dmg||0)>0);
ok('干扰素参战：造成过伤害 (dmg>0)', (ifn.dmg||0)>0);

console.log('\n结果：'+pass+' 通过 / '+fail+' 失败');
process.exit(fail?1:0);
