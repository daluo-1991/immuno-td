// 闯关模式（系统战役 / 选关地图）自检：多章配置 / 难度递进 / 章节切换 / 结算页→战役页→选章 / 进度持久化
// 用真实代码 vm 加载 L1_play.html 验证（2026-07-18）
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
      if(!this._cards){ const h=this.innerHTML||''; const re=/class="(ch-card[^"]*)"\s*data-i="(\d+)"/g; let m,res=[];
        while((m=re.exec(h))){ const cls=m[1].split(' '); const c={dataset:{i:m[2]},classList:{contains:c=>cls.includes(c)},style:{},onclick:null}; res.push(c); }
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
const exposed=script+'\nwindow.__api={getG:()=>G,CELLS,VIRUSES,LEVELS,startRun,newGame,endGame,spawnVirus,chapterWaves,showCampaign,saveUnlocked,loadProgress,getProgress:()=>progress};';
new vm.Script(exposed).runInNewContext(ctx);
const api=window.__api;

let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;console.log('  ✅ '+name);} else {fail++;console.log('  ❌ '+name);} }

console.log('=== 1. 多章配置 ===');
ok('LEVELS 共 5 章', api.LEVELS.length===5);
ok('章节名 第1~5章', api.LEVELS.map(l=>l.chapterName).join(',')==='第 1 章,第 2 章,第 3 章,第 4 章,第 5 章');
ok('每章 waves 9 个出怪事件', api.LEVELS.every(l=>l.waves.length===9));
ok('每章均为 7×9 / C形路径(23点) / 中央3×3绿簇', api.LEVELS.every(l=>l.cols===7&&l.rows===9&&l.path.length===23&&l.reserved.length===9));

console.log('=== 2. 难度递进 ===');
const c1=api.LEVELS[0].waves, c5=api.LEVELS[4].waves;
ok('小怪数量逐章递增 (第1章轮1 < 第5章轮1)', c1[0].count < c5[0].count);
ok('出怪间隔逐章收紧 (第1章轮1 > 第5章轮1)', c1[0].interval >= c5[0].interval);
const b1=c1[4], b5=c5[4];
ok('BOSS hpMul 逐章递增 ('+b1.hpMul+' < '+b5.hpMul+')', b1.hpMul < b5.hpMul);
const boss1hp=api.VIRUSES.boss1.hp, boss2hp=api.VIRUSES.boss2.hp;
const b5hp = (c5[4].virus==='boss2'?boss2hp:boss1hp)*b5.hpMul;
ok('第5章BOSS实际血量放大 ('+b5hp+' > '+boss1hp+')', b5hp > boss1hp);

console.log('=== 3. newGame(idx) 章节加载 ===');
api.newGame(0); let G=api.getG();
ok('idx0 → chapterIdx=0 / 第1章', G.chapterIdx===0 && api.LEVELS[0].chapterName==='第 1 章');
api.newGame(4); G=api.getG();
ok('idx4 → chapterIdx=4 / 第5章', G.chapterIdx===4 && api.LEVELS[4].chapterName==='第 5 章');
api.newGame(2); G=api.getG();
ok('idx2 → 当前 LEVEL.waves 跟随 LEVELS[2]', G.waveIdx===0 && api.LEVELS[2].waves.length===9);

console.log('=== 4. 结算页 → 确定 → 战役页 → 选第2章 ===');
api.newGame(0); api.endGame(true);
const ov=document.getElementById('overlay');
ok('第1章通关 → 显示结算页(含「确定」)', ov.innerHTML.includes('确定'));
document.getElementById('okBtn').onclick();   // 点「确定」→ 进入战役页
ok('确定后进入「系统战役」页', ov.innerHTML.includes('系统战役'));
ok('通关后第2章已解锁 (progress.unlocked>=1)', api.getProgress().unlocked>=1);
const unlockedCards = ov.querySelectorAll('.ch-card:not(.locked)');
const ch2 = unlockedCards.find(c=>c.dataset.i==='1');
ok('战役页第2章卡片可点击(非locked)', !!ch2);
ch2.onclick();   // 选第2章
G=api.getG();
ok('点第2章 → 进入 第2章 且开始运行', G.chapterIdx===1 && G.running===true);

console.log('=== 5. 末章通关 → 全部通关 + 全部标记已通关 ===');
api.newGame(4); api.endGame(true);
ok('第5章通关 → 显示「全部通关 · 查看战役」', document.getElementById('overlay').innerHTML.includes('全部通关'));
document.getElementById('okBtn').onclick();
ok('全通后所有5章解锁(progress.unlocked>=5)', api.getProgress().unlocked>=5);
ok('战役页渲染全部5章卡片', document.getElementById('overlay').innerHTML.split('data-i="').length-1===5);

console.log('=== 6. 失败 → 返回战役 ===');
api.newGame(0); api.endGame(false);
const fov=document.getElementById('overlay').innerHTML;
ok('失败页含「返回战役」', fov.includes('返回战役'));
document.getElementById('campBtn').onclick();
ok('点「返回战役」→ 进入战役页', document.getElementById('overlay').innerHTML.includes('系统战役'));

console.log('');
console.log(`结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail?1:0);
