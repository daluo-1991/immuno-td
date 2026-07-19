// 验证体力系统：上限 40、每次闯关 -5、每 10 分钟 +1（含离线恢复）、HUD 显示、不足拦截。
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(__dirname+'/L1_play.html','utf-8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function makeEl(id){
  const el={id,_children:[],style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    addEventListener(){},appendChild(){},get childElementCount(){return 0},
    getContext(){return new Proxy({},{get(t,prop){ if(prop==='createRadialGradient'||prop==='createLinearGradient') return ()=>({addColorStop(){}}); return ()=>{}; }})},
    getBoundingClientRect(){return{left:0,top:0,width:336,height:432}},setPointerCapture(){},querySelectorAll(){return[]}};
  let h='';Object.defineProperty(el,'innerHTML',{get:()=>h,set:v=>{h=String(v)}});
  let tc='';Object.defineProperty(el,'textContent',{get:()=>tc,set:v=>{tc=String(v)}});
  return el;
}
const els={};
const document={getElementById:id=>(els[id]||(els[id]=makeEl(id))),addEventListener(){},createElement:()=>makeEl('d'),body:{appendChild(){}}};
const window={};const _store={};
const localStorage={getItem:k=>k in _store?_store[k]:null,setItem:(k,v)=>{_store[k]=String(v)}};
const ctx={document,window,localStorage,requestAnimationFrame:()=>{},setInterval:()=>0,setTimeout:()=>0,alert:()=>{},console,Math,Date,JSON,Object,Array,Proxy,String,Number,Boolean,isNaN,parseInt,parseFloat};
ctx.globalThis=ctx;
new vm.Script(script+'\nwindow.__api={loadStamina,spendStamina,staminaRecover,updateStaminaHUD,getStamina:()=>stamina,setStamina:s=>{stamina=s},STAMINA_MAX,STAMINA_COST,STAMINA_REGEN_MS,STAMINA_KEY};').runInNewContext(ctx);
const api=window.__api;
let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;console.log('  ✓ '+name);} else {fail++;console.log('  ✗ '+name);} }
const sv=()=>ctx.document.getElementById('staminaVal').textContent;
const cd=()=>ctx.document.getElementById('staminaCd').textContent;
const hsv=()=>ctx.document.getElementById('homeStaminaVal').textContent;
const hcd=()=>ctx.document.getElementById('homeStaminaCd').textContent;

console.log('=== 体力系统 ===');
// 启动脚本后 updateStaminaHUD() 已执行，同时应写首页体力
api.updateStaminaHUD();
ok('战斗页 HUD 显示 40/40', sv()==='40/40');
ok('战斗页 HUD cd=已满', cd()==='已满');
ok('首页体力显示 40/40', hsv()==='40/40');
ok('首页体力 cd=已满', hcd()==='已满');

// 2. 扣 5
const before=api.getStamina().stamina;
const r=api.spendStamina(api.STAMINA_COST);
ok('spendStamina(5) 返回 true', r===true);
ok('扣减后 = 35', api.getStamina().stamina===before-5);
api.updateStaminaHUD();
ok('HUD 显示 35/40', sv()==='35/40');
ok('cd 显示倒计时(含"后 +1")', /后 \+1/.test(cd()));

// 3. 不足拦截
api.setStamina({stamina:3,lastTs:Date.now()});
const r2=api.spendStamina(5);
ok('体力 3<5 时 spendStamina 返回 false', r2===false);
ok('不足时不扣减(仍=3)', api.getStamina().stamina===3);

// 4. 离线恢复：20 分钟前, stamina 30 → +2 = 32
const now=Date.now();
ctx.localStorage.setItem(api.STAMINA_KEY, JSON.stringify({stamina:30, lastTs: now-20*60*1000}));
const rec=api.loadStamina();
ok('离线 20 分钟: 30 → 32', rec.stamina===32);
// 离线恢复跨多周期且满：30 分钟前 stamina 5 → +3 = 8
ctx.localStorage.setItem(api.STAMINA_KEY, JSON.stringify({stamina:5, lastTs: now-30*60*1000}));
ok('离线 30 分钟: 5 → 8', api.loadStamina().stamina===8);
// 封顶：35 分钟前 stamina 38 → 38+3=41 封顶 40
ctx.localStorage.setItem(api.STAMINA_KEY, JSON.stringify({stamina:38, lastTs: now-35*60*1000}));
ok('离线恢复封顶 40 (38+3→40)', api.loadStamina().stamina===40);

console.log('\n结果：'+pass+' 通过 / '+fail+' 失败');
process.exit(fail?1:0);
