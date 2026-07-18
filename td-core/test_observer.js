// 测试 §7.2 记忆观察者：杀怪攒经验 → 满格暂停战斗 → 三选一 buff → 生效并升级（阈值递增/连锁/战斗接入）
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
const els={};
const document={getElementById:id=>(els[id]||(els[id]=makeEl(id))),addEventListener(){},createElement:()=>makeEl('d'),body:{appendChild(){}}};
const window={};const _store={};
const localStorage={getItem:k=>k in _store?_store[k]:null,setItem:(k,v)=>{_store[k]=String(v)}};
const ctx={document,window,localStorage,requestAnimationFrame:()=>{},setInterval:()=>0,setTimeout:()=>0,alert:()=>{},console,Math,Date,JSON,Object,Array,Proxy,String,Number,Boolean,isNaN,parseInt,parseFloat};ctx.globalThis=ctx;
new vm.Script(script+'\nwindow.__api={getG:()=>G,newGame,placeTower,gainObsExp,pickBuff,showBuffPanel,obsExpFor,BUFF_POOL,dealDamage,getChoices:()=>_buffChoices,MAX_TIER};').runInNewContext(ctx);
const api=window.__api;
let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;console.log('  ✓ '+name);} else {fail++;console.log('  ✗ '+name);} }
function reset(){ api.newGame(0); const g=api.getG(); g.running=true; return g; }

console.log('=== 1. 初始状态 ===');
let G=reset();
ok('观察者初始 Lv.1', G.obsLevel===1);
ok('初始经验 0', G.obsExp===0);
ok('初始阈值=obsExpFor(1)=15', G.obsExpMax===api.obsExpFor(1) && G.obsExpMax===15);
ok('初始未暂停', G.paused===false);
ok('buffs 默认全 1', G.buffs.atk===1&&G.buffs.spd===1&&G.buffs.def===1&&G.buffs.cool===1&&G.buffs.eco===1);

console.log('=== 2. 未满经验不触发 ===');
G=reset();
api.gainObsExp(10);
ok('经验累计到 10', G.obsExp===10);
ok('未满不暂停', G.paused===false);
ok('buff 弹层保持隐藏', els.buffOverlay.classList.contains('hide'));

console.log('=== 3. 经验满 → 暂停 + 弹三选一 ===');
G=reset();
api.gainObsExp(15);
ok('经验达阈值触发暂停', G.paused===true);
ok('buff 弹层显示（移除 hide）', !els.buffOverlay.classList.contains('hide'));
ok('提供 3 张 buff 三选一', api.getChoices().length===3);
ok('3 张 buff id 不重复', new Set(api.getChoices().map(b=>b.id)).size===3);

console.log('=== 4. 选 buff → 生效/升级/扣经验/恢复战斗 ===');
G=reset();
api.gainObsExp(15);                 // 触发（obsExp=15, max=15）
api.pickBuff(0);
G=api.getG();
ok('选完观察者升到 Lv.2', G.obsLevel===2);
ok('扣除本级阈值(15) → 经验回 0', G.obsExp===0);
ok('下一级阈值升到 obsExpFor(2)=22', G.obsExpMax===22);
ok('恢复战斗（取消暂停）', G.paused===false);
ok('buff 弹层重新隐藏', els.buffOverlay.classList.contains('hide'));

console.log('=== 5. 阈值随等级递增 ===');
ok('Lv1 阈值 15', api.obsExpFor(1)===15);
ok('Lv2 阈值 22', api.obsExpFor(2)===22);
ok('Lv3 阈值 29', api.obsExpFor(3)===29);

console.log('=== 6. 多余经验连锁弹层（一次攒够两级）===');
G=reset();
api.gainObsExp(15+22+5);            // =42：足够连触两次（15→22）
ok('首次触发暂停', G.paused===true);
api.pickBuff(0);                    // 42-15=27 ≥ 22 → 继续弹
G=api.getG();
ok('第一次选后仍暂停（余经验够再触发）', G.paused===true && G.obsLevel===2);
api.pickBuff(0);                    // 27-22=5 < 29 → 结束
G=api.getG();
ok('第二次选后升到 Lv.3', G.obsLevel===3);
ok('剩余经验 5（27-22）', G.obsExp===5);
ok('两级连锁后恢复战斗', G.paused===false);

console.log('=== 7. 每张 buff apply 正确 ===');
function freshG(){ const g=reset(); return g; }
let g;
g=freshG(); api.BUFF_POOL.find(b=>b.id==='fire').apply(g);   ok('火力：atk 1→1.15', Math.abs(g.buffs.atk-1.15)<1e-9);
g=freshG(); api.BUFF_POOL.find(b=>b.id==='rapid').apply(g);  ok('速攻：spd 1→1.12', Math.abs(g.buffs.spd-1.12)<1e-9);
g=freshG(); api.BUFF_POOL.find(b=>b.id==='wall').apply(g);   ok('坚壁：def 1→0.85（漏怪体温↓）', Math.abs(g.buffs.def-0.85)<1e-9);
g=freshG(); api.BUFF_POOL.find(b=>b.id==='cool').apply(g);   ok('退烧：cool 1→1.20', Math.abs(g.buffs.cool-1.20)<1e-9);
g=freshG(); api.BUFF_POOL.find(b=>b.id==='eco').apply(g);    ok('增产：eco 1→1.20', Math.abs(g.buffs.eco-1.20)<1e-9);
g=freshG(); const e0=g.energy; api.BUFF_POOL.find(b=>b.id==='energy').apply(g); ok('储备：立即 +30 能量', g.energy===e0+30);

console.log('=== 8. 火力 buff 实际提升伤害 ===');
G=reset(); G.buffs.atk=1;
let v1={type:'rhinovirus',hp:1000,vuln:1,prog:0};
const t={type:'neutrophil',tier:1};
api.dealDamage(v1,10,t); const dmg1=1000-v1.hp;
G.buffs.atk=2;
let v2={type:'rhinovirus',hp:1000,vuln:1,prog:0};
api.dealDamage(v2,10,t); const dmg2=1000-v2.hp;
ok('atk=2 时伤害是 atk=1 的 2 倍', Math.abs(dmg2-dmg1*2)<1e-6 && dmg1>0);

console.log('=== 9. 每章重置（新章观察者归零）===');
G=reset(); api.gainObsExp(15); api.pickBuff(0);   // 升到 Lv2
G=api.getG(); ok('升级后 Lv.2', G.obsLevel===2);
api.newGame(1); G=api.getG();
ok('切新章后观察者重置 Lv.1', G.obsLevel===1);
ok('切新章后经验归 0', G.obsExp===0);
ok('切新章后 buffs 归 1', G.buffs.atk===1&&G.buffs.eco===1);

console.log('\n结果：'+pass+' 通过 / '+fail+' 失败');
process.exit(fail?1:0);
