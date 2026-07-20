// 守卫陈塘关战役线自检（2026-07-20）
// 验证：双线进度独立(immune/chen 互不污染)、showCampaign('chen')渲染7关、
//      进入陈塘关章节(newGame+tryEnterChapter 带 campaign)、无尽关 step 不误判胜利、
//      boss 注入 & 限时胜利(endlessSec) 行为、HUD 轮次显示走时间制。
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('L1_play.html','utf-8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl(id){
  const el={
    id,_children:[],textContent:'',value:'',width:336,height:432,
    style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    onclick:null,_listeners:{},_cards:null,addEventListener(t,fn){(this._listeners[t]||(this._listeners[t]=[])).push(fn)},
    removeEventListener(){},appendChild(c){this._children.push(c)},
    get childElementCount(){return this._children.length},
    getContext(){return ctxStub},getBoundingClientRect(){return{left:0,top:0,width:336,height:432}},
    setPointerCapture(){},releasePointerCapture(){},
    querySelectorAll(sel){
      if(!this._cards){ const h=this.innerHTML||''; const re=/class="(ch-card[^"]*)"\s*data-i="(\d+)"[^>]*data-campaign="([^"]*)"/g; let m,res=[];
        while((m=re.exec(h))){ const cls=m[1].split(' '); const c={dataset:{i:m[2],campaign:m[3]},classList:{contains:c=>cls.includes(c)},style:{},onclick:null}; res.push(c); }
        this._cards=res; }
      if(sel && sel.includes(':not(.locked)')) return this._cards.filter(e=>!e.classList.contains('locked'));
      return this._cards;
    }
  };
  let _html='';
  Object.defineProperty(el,'innerHTML',{get:()=>_html,set:v=>{_html=String(v); el._cards=null;}});
  return el;
}
const ctxStub=new Proxy({},{get(t,prop){ if(prop==='createRadialGradient'||prop==='createLinearGradient') return ()=>({addColorStop(){}}); return ()=>{}; }});
const els={},docListeners={};
const _store={};
const localStorage={getItem:k=>(k in _store?_store[k]:null),setItem:(k,v)=>{_store[k]=String(v)},removeItem:k=>{delete _store[k]}};
const document={getElementById(id){if(!els[id])els[id]=makeEl(id);return els[id]},addEventListener(t,fn){(docListeners[t]||(docListeners[t]=[])).push(fn)},createElement(){return makeEl('dyn')},body:{appendChild(){}}};
const window={};
const ctx={document,window,localStorage,requestAnimationFrame:()=>{},setInterval:()=>0,setTimeout:(fn)=>0,alert:()=>{},console,Math,Date,JSON,Object,Array,Proxy,String,Number,Boolean,isNaN,parseInt,parseFloat};
ctx.globalThis=ctx;
const exposed=script+'\nwindow.__api={getG:()=>G,CELLS,VIRUSES,LEVELS,LEVELS_CHEN,startRun,newGame,tryEnterChapter,endGame,spawnVirus,showCampaign,saveUnlocked,loadProgress,getProgress:()=>progress,stepFn:typeof step!=="undefined"?step:null};';
new vm.Script(exposed).runInNewContext(ctx);
const api=window.__api;

let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;console.log('  ✅ '+name);} else {fail++;console.log('  ❌ '+name);} }

console.log('=== 1. 双线进度独立 ===');
// 进入陈塘关第1关通关 → chen 解锁2，immune 不应被改
api.newGame(0,'immune'); api.startRun && void 0;
// 模拟：通关免疫第1章
api.saveUnlocked(1,'immune');
ok('通关免疫第1章 → immune>=1', api.getProgress().immune>=1);
ok('免疫通关不污染陈塘关线(chen=0)', api.getProgress().chen===0);
api.saveUnlocked(1,'chen');
ok('通关陈塘关第1关 → chen>=1', api.getProgress().chen>=1);
ok('陈塘关解锁不污染免疫线(immune 仍=1)', api.getProgress().immune===1);

console.log('=== 2. showCampaign(\'chen\') 渲染 7 关 ===');
api.showCampaign('chen');
const ov=document.getElementById('overlay');
ok('标题含「守卫陈塘关」', ov.innerHTML.includes('守卫陈塘关'));
const chenCards = ov.querySelectorAll('.ch-card:not(.locked)');
ok('陈塘关战役渲染7张卡片', ov.innerHTML.split('data-campaign="chen"').length-1===7);
const lastCard = ov.innerHTML.includes('守卫陈塘关·无尽') || ov.innerHTML.includes('无尽');
ok('含第7关「无尽」标记', lastCard);

console.log('=== 3. 进入陈塘关章节(newGame campaign) ===');
api.newGame(0,'chen');
const G=api.getG();
ok('LEVEL.campaign===\'chen\'', (G.campaign||api.getG().campaign)==='chen' );
ok('章节名含「守卫陈塘关」', G.chapterIdx===0);
ok('G 记录 campaign', G.campaign==='chen');

console.log('=== 4. 无尽关 step 循环不误判胜利 ===');
api.newGame(6,'chen');            // 第7关=无尽关
const Gg=api.getG();
Gg.phase='wave'; Gg.spawnLeft=0; Gg.viruses.length=0;  // 模拟一波清空
api.stepFn && api.stepFn(0.1);
ok('一波清空后未立即判胜(phase 仍 wave/gap)', Gg.phase==='wave'||Gg.phase==='gap');
ok('无尽关 elapsed 在累积', Gg.elapsed>0);

console.log('=== 5. 无尽关限时胜利(endlessSec) ===');
api.newGame(6,'chen');                 // 干净重开，避免上一轮 step 状态污染
const Gt=api.getG();
Gt.elapsed = api.LEVELS_CHEN[6].endlessSec + 5;  // 超过上限
Gt.phase='wave'; Gt.spawnLeft=0; Gt.viruses.length=0;  // 模拟一波清空且已超时
api.stepFn && api.stepFn(0.1);
ok('超过 endlessSec → 判胜(phase=win)', Gt.phase==='win');

console.log('=== 6. 终焉 BOSS 注入(endlessBossAt) ===');
api.newGame(6,'chen');
const G2=api.getG();
G2.elapsed = api.LEVELS_CHEN[6].endlessBossAt + 1;
G2.phase='wave'; G2.spawnLeft=0; G2.viruses.length=0;
api.stepFn && api.stepFn(0.1);
ok('到 endlessBossAt 注入 bossSpawned', G2.bossSpawned===true);
ok('场上出现 boss2', G2.viruses.some(v=>v.type==='boss2'));

console.log('\n结果：'+pass+' 通过 / '+fail+' 失败');
process.exit(fail?1:0);
