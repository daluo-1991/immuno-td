// 闯关模式（线性串联骨架）自检：多章配置 / 难度递进 / 章节切换 / 胜利分章推进 / Boss血量递进
// 用真实代码 vm 加载 L1_play.html 验证（2026-07-18）
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('L1_play.html','utf-8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl(id){
  return {
    id,_children:[],textContent:'',innerHTML:'',value:'',width:336,height:432,
    style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    onclick:null,_listeners:{},addEventListener(t,fn){(this._listeners[t]||(this._listeners[t]=[])).push(fn)},
    removeEventListener(){},appendChild(c){this._children.push(c)},
    get childElementCount(){return this._children.length},
    getContext(){return ctxStub},getBoundingClientRect(){return{left:0,top:0,width:336,height:432}},
    setPointerCapture(){},releasePointerCapture(){}
  };
}
const ctxStub=new Proxy({},{get(){return()=>{}}});
const els={},docListeners={};
const document={getElementById(id){if(!els[id])els[id]=makeEl(id);return els[id]},addEventListener(t,fn){(docListeners[t]||(docListeners[t]=[])).push(fn)},createElement(){return makeEl('dyn')},body:{appendChild(){}}};
const window={};
const ctx={document,window,requestAnimationFrame:()=>{},setInterval:()=>0,setTimeout:(fn)=>0,alert:()=>{},console,Math,Date,JSON,Object,Array,Proxy,String,Number,Boolean,isNaN,parseInt,parseFloat};
ctx.globalThis=ctx;
const exposed=script+'\nwindow.__api={getG:()=>G,CELLS,VIRUSES,LEVELS,start,startRun,newGame,endGame,spawnVirus,chapterWaves};';
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

console.log('=== 4. 胜利分章推进 ===');
api.newGame(0); G=api.getG();
api.endGame(true);
const ov1=document.getElementById('overlay').innerHTML;
ok('第1章通关 → 显示「进入 第 2 章」', ov1.includes('进入 第 2 章'));
ok('第1章通关 → 存在 nextBtn', !!document.getElementById('nextBtn'));
document.getElementById('nextBtn').onclick();   // 模拟点击「进入下一章」
G=api.getG();
ok('点 nextBtn → 进入第2章 (chapterIdx=1)', G.chapterIdx===1 && api.LEVELS[1].chapterName==='第 2 章');

api.newGame(4); G=api.getG();
api.endGame(true);
const ov5=document.getElementById('overlay').innerHTML;
ok('第5章(末章)通关 → 显示「全部通关」', ov5.includes('全部通关'));
ok('末章通关 → 无「进入 第」按钮(从头再战)', !ov5.includes('进入 第'));

console.log('=== 5. 失败重玩本章 ===');
api.newGame(3); G=api.getG();
api.endGame(false);
const ovf=document.getElementById('overlay').innerHTML;
ok('失败 → 显示「发烧失败」', ovf.includes('发烧失败'));
document.getElementById('againBtn').onclick();
G=api.getG();
ok('点 againBtn → 重玩本章 (chapterIdx=3)', G.chapterIdx===3);

console.log('=== 6. spawnVirus hpMul（Boss 血量递进）===');
api.newGame(2); G=api.getG();
api.spawnVirus('boss1', 2.0);
const v=G.viruses[0];
ok('boss1 hpMul=2 → hp/maxhp = 450×2 = 900', v.hp===boss1hp*2 && v.maxhp===boss1hp*2);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail?1:0);
