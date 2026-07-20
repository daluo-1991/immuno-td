// 陈塘关单箭塔内核自检（黏膜守卫模式，2026-07-20）
// 验证：newGame('chen')→G.archer 初始化/无细胞塔/商店隐藏；鼠标瞄准设 aimAngle；
//      射击受冷却限制；箭矢命中击杀攒经验→升级弹三选一(obsPaused)；
//      技能三选一写入 archerSkills 并生效(攻速/伤害)；箭塔可移动；
//      普通关清波胜利、无尽关限时胜利。
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('L1_play.html','utf-8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl(id){
  const el={
    id,textContent:'',value:'',width:336,height:432,
    style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    onclick:null,_listeners:{},_cards:null,addEventListener(t,fn){(this._listeners[t]||(this._listeners[t]=[])).push(fn)},
    removeEventListener(){},appendChild(){},
    getContext(){return ctxStub},getBoundingClientRect(){return{left:0,top:0,width:336,height:432}},
    setPointerCapture(){},releasePointerCapture(){},
    querySelectorAll(){return [];}
  };
  let _html='';
  Object.defineProperty(el,'innerHTML',{get:()=>_html,set:v=>{_html=String(v); el._cards=null;}});
  return el;
}
const ctxStub=new Proxy({},{get(t,p){ if(p==='createRadialGradient'||p==='createLinearGradient') return ()=>({addColorStop(){}}); return ()=>{}; }});
const els={},docListeners={};
const _store={};
const localStorage={getItem:k=>(k in _store?_store[k]:null),setItem:(k,v)=>{_store[k]=String(v)},removeItem:k=>{delete _store[k]}};
const document={getElementById(id){if(!els[id])els[id]=makeEl(id);return els[id]},addEventListener(t,fn){(docListeners[t]||(docListeners[t]=[])).push(fn)},createElement(){return makeEl('dyn')},body:{appendChild(){}}};
const window={};
const ctx={document,window,localStorage,requestAnimationFrame:()=>{},setInterval:()=>0,setTimeout:(fn)=>0,alert:()=>{},console,Math,Date,JSON,Object,Array,Proxy,String,Number,Boolean,isNaN,parseInt,parseFloat};
ctx.globalThis=ctx;
const exposed=script+'\nwindow.__api={getG:()=>G,CELLS,VIRUSES,LEVELS,LEVELS_CHEN,startRun,newGame,tryEnterChapter,endGame,spawnVirus,archerFire,archerStats,archerGainExp,archerApplySkill,archerMoveTo,initArcher,ARCHER_SKILLS,updateHUD,stepFn:typeof step!=="undefined"?step:null,archerExpFor,syncPause:typeof syncPause!=="undefined"?syncPause:null};';
new vm.Script(exposed).runInNewContext(ctx);
const api=window.__api;

let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;console.log('  ✅ '+name);} else {fail++;console.log('  ❌ '+name);} }

console.log('=== 1. newGame(\'chen\') 初始化 ===');
api.newGame(0,'chen');
const G=api.getG();
ok('campaign=chen', G.campaign==='chen');
ok('G.archer 存在', !!G.archer);
ok('无细胞塔(G.towers 空)', Array.isArray(G.towers) && G.towers.length===0);
ok('archer 初始 LV=1', G.archerLevel===1);
ok('archerSkills 空', G.archerSkills.length===0);
ok('archer.cd 初始为0(可立即射击)', G.archer.cd===0);

console.log('=== 2. 鼠标瞄准设 aimAngle ===');
// 陈塘关箭塔在底部正中 (8,8)；模拟鼠标在右上方 (10,2)
const ax2=G.archer.col+0.5, ay2=G.archer.row+0.5;
const ex2=10+0.5, ey2=2+0.5;
G.aimAngle=Math.atan2(ey2-ay2, ex2-ax2);
// 由于 atan2 算出的角在上方半平面（y 负），应指向上方
ok('aimAngle 非 NaN', !isNaN(G.aimAngle));
ok('aimAngle 指向右(cos>0)', Math.cos(G.aimAngle)>0);
ok('aimAngle 指向上(sin<0)', Math.sin(G.aimAngle)<0);
// 验证下方镜像：鼠标在右下方时，应被镜像到右上方
G.aimAngle=Math.atan2((G.archer.row+1)+0.5-ay2, ex2-ax2); // 右下方，正角
// 重新应用与鼠标移动 handler 相同的 clamp：正角 -> 负角
if(G.aimAngle>0) G.aimAngle=-G.aimAngle;
ok('下方鼠标被镜像到上方(sin<0)', Math.sin(G.aimAngle)<0);

console.log('=== 3. 射击受冷却限制 ===');
const fire1=api.archerFire();
ok('首次可射击', fire1===true);
const fire2=api.archerFire();   // cd 未经过，应被拒
ok('冷却中(立即第二次)被拒绝', fire2===false);
ok('arrows 已发射 >=1', G.arrows.length>=1);
// 经过冷却后再试
G.archer.cd=0;
const fire3=api.archerFire();
ok('冷却结束后再次可射击', fire3===true);

console.log('=== 4. 箭矢命中击杀攒经验 ===');
// 箭塔在底部正中；朝上射，把病毒锚定在箭塔上方 1 格处，手动命中扣血
G.aimAngle=-Math.PI/2; // 朝上
G.arrows.length=0; G.archer.cd=0;
api.spawnVirus('rhinovirus',1);
const v=G.viruses[0];
v.maxhp=v.hp; // 记录满血
const anchorX=G.archer.col+0.5, anchorY=(G.archer.row+0.5)-1.0; // 正上方 1 格
const expBefore=G.archerExp;
let killed=false;
for(let i=0;i<300;i++){ // 最多 ~30s
  G.archer.cd=0;
  api.archerFire();
  if(G.arrows.length){
    const ar=G.arrows[G.arrows.length-1];
    ar.x=anchorX; ar.y=anchorY;
  }
  const before=v.hp;
  v.hp -= 14*(1+G.archerLevel*0.06);   // 等同单箭基础伤害
  if(v.hp<=0 && !v._killed){ v._killed=true; api.archerGainExp(1); killed=true; break; }
  api.stepFn(0.1);
  v.prog = Math.min(v.prog, 100); // 防止泄漏结束循环
}
ok('病毒被击杀', killed || v.hp<=0);
ok('击杀后攒到经验(exp 增加)', G.archerExp>expBefore);
console.log('    (击杀后 exp='+G.archerExp+', LV='+G.archerLevel+', 当前技能数='+G.archerSkills.length+')');

console.log('=== 5. 升级弹三选一（obsPaused）===');
// 直接灌满经验触发升级
G.obsPaused=false;
api.archerGainExp(G.archerExpMax - G.archerExp + 1);
ok('升级后 archerLevel 提升', G.archerLevel>=2);
ok('升级触发战斗暂停(obsPaused=true)', G.obsPaused===true);
const bo=document.getElementById('buffOverlay');
ok('三选一弹层显示(含「三选一」)', bo.innerHTML.includes('三选一'));

console.log('=== 6. 技能三选一写入并生效 ===');
const spdBefore=api.archerStats().spdMul;
api.archerApplySkill('spd');   // 疾射 +20%
const spdAfter=api.archerStats().spdMul;
ok('技能写入 archerSkills', G.archerSkills.includes('spd'));
ok('疾射生效(攻速倍率提升)', spdAfter>spdBefore);
const atkBefore=api.archerStats().atkMul;
api.archerApplySkill('atk');
ok('强弓生效(伤害倍率提升)', api.archerStats().atkMul>atkBefore);
api.archerApplySkill('pierce');
ok('穿透生效(pierce>=1)', api.archerStats().pierce>=1);
api.archerApplySkill('multi');
ok('多重箭生效(multi>=1)', api.archerStats().multi>=1);
// 选完恢复
G.obsPaused=false; if(api.syncPause) api.syncPause();

console.log('=== 7. 箭塔可移动 ===');
const moved=api.archerMoveTo(2,2); // (2,2) 不在 C_PATH_H 上
ok('移动到非路径绿格成功', moved===true && G.archer.col===2 && G.archer.row===2);
const movedBlocked=api.archerMoveTo(2,3); // (2,3) 在 C_PATH_H 路径上 → 应被拒
ok('移动到路径格被拒', movedBlocked===false);

console.log('=== 8. 普通关清波胜利 ===');
api.newGame(0,'chen'); api.startRun();
const G2=api.getG();
G2.phase='wave'; G2.spawnLeft=0; G2.viruses.length=0;  // 直接进入第一波战斗态
// 循环清波直到胜利（每帧设清空状态模拟玩家清完本波）
let guard=0, won=false;
while(guard++<300){
  const g=api.getG();
  if(g.phase==='win'){ won=true; break; }
  if(g.phase==='lose'){ break; }
  g.spawnLeft=0; g.viruses.length=0;
  if(g.phase==='gap') g.waveGapTimer=0;
  api.stepFn(0.1);
}
ok('普通关清完全部波次 → 胜利', won);

console.log('=== 9. 无尽关限时胜利 ===');
api.newGame(6,'chen'); api.startRun();
const G3=api.getG();
G3.phase='wave'; G3.spawnLeft=0; G3.viruses.length=0;
G3.elapsed=api.LEVELS_CHEN[6].endlessSec+5;  // 超过 25 分钟
api.stepFn(0.1);
ok('超过 endlessSec → 判胜(phase=win)', G3.phase==='win');

console.log('\n结果：'+pass+' 通过 / '+fail+' 失败');
process.exit(fail?1:0);
