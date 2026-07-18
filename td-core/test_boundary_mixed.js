// 复现用户场景：2×2 拖到「部分绿格+部分暗格」交界处，验证拖动跟手 & 预览正常
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('L1_play.html','utf-8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl(id){
  return {
    id, _children:[], textContent:'', innerHTML:'', value:'', width:336, height:432,
    style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    onclick:null,_listeners:{},addEventListener(t,fn){(this._listeners[t]||(this._listeners[t]=[])).push(fn)},removeEventListener(){},
    appendChild(c){this._children.push(c)},
    querySelectorAll(sel){return [];},get childElementCount(){return this._children.length},
    getContext(){return ctxStub},getBoundingClientRect(){return{left:0,top:0,width:336,height:432}},
    setPointerCapture(){},releasePointerCapture(){},
  };
}
const ctxStub=new Proxy({},{get(){return()=>{}}});
const els={},docListeners={};
const document={
  getElementById(id){if(!els[id])els[id]=makeEl(id);return els[id]},
  addEventListener(t,fn){(docListeners[t]||(docListeners[t]=[])).push(fn)},
  createElement(){return makeEl('dyn')},body:{appendChild(){}},
};
const window={};
const ctx={document,window,requestAnimationFrame:()=>{},setInterval:()=>0,setTimeout:(fn)=>0,alert:()=>{},console,
  Math,Date,JSON,Object,Array,Proxy,String,Number,Boolean,isNaN,parseInt,parseFloat};
ctx.globalThis=ctx;
const exposed=script+`
window.__api={getG:()=>G,CELLS,start,anchorFor,anchorForWithEvict,trySwap,canPlace,grid_in};`;
new vm.Script(exposed).runInNewContext(ctx);
const api=window.__api;

api.start(); const G=api.getG();
const CELLS=api.CELLS;

// 打印绿格/暗格分布
console.log('=== 棋盘：G=绿格(null) L=暗格(locked) P=路径 ===');
for(let r=0;r<G.grid.length;r++){
  let line='r'+r+': ';
  for(let c=0;c<G.grid[r].length;c++){
    const v=G.grid[r][c];
    if(v===null) line+='G'; else if(v==='locked') line+='L'; else if(v==='path') line+='P'; else line+='?';
  }
  console.log(line);
}

// 对每个内格光标位置，模拟拖2×2巨噬：anchorFor 返回值 + 预览坐标
console.log('\n=== 逐格拖放模拟（2×2 巨噬）===');
console.log('格式: (c,r) [G=绿/L=暗] → anchor → 预览(ax,ay) valid');
let greenHits=0, darkHits=0, mixedHits=0;
for(let r=1;r<=7;r++){
  let line='';
  for(let c=1;c<=5;c++){
    const cellState = G.grid[r][c];
    const sym = cellState===null?'G':'L';
    const a = api.anchorFor('macrophage', c, r);
    // 判断光标4候选是否包含混合(部分绿+部分暗)情况
    let greenCount=0, darkCount=0;
    const candidates = [[c-1,r-1],[c,r-1],[c-1,r],[c,r]];
    for(const [ac,ar] of candidates){
      if(ac<1||ac>4||ar<1||ar>6) continue;
      for(let dr=0;dr<2;dr++) for(let dc=0;dc<2;dc++){
        const val=G.grid[ar+dr]?.[ac+dc];
        if(val===null) greenCount++; else if(val==='locked') darkCount++;
      }
    }
    const isMixed = greenCount>0 && darkCount>0 && !a;
    if(isMixed) mixedHits++;
    if(a) greenHits++; else darkHits++;

    const previewX = a ? a.ac : c;
    const previewY = a ? a.ar : r;
    const valid = !!a;
    line += ` (${c},${r}${sym})→${a?(a.ac+','+a.ar):'null'}@${previewX},${previewY}${valid?'':'[R]'}`;
  }
  console.log(line.trim());
}

console.log('\n=== 统计 ===');
console.log('可落子(绿格2x2区): '+greenHits+' / 35');
console.log('不可落子(退商店):   '+darkHits+' / 35');
console.log('其中「部分绿+部分暗」交界: '+mixedHits+' 个光标位');

// 关键验证：所有位置 anchorFor 都能正常返回（null或锚点），不会抛错/死循环
console.log('\n=== 关键验证 ===');
let noCrash=true;
for(let r=1;r<=7;r++) for(let c=1;c<=5;c++){
  try{ api.anchorFor('macrophage',c,r); }catch(e){ noCrash=false; console.log('CRASH at',c,r,e.message); }
}
console.log(noCrash?'✅ 所有35格 anchorFor 正常返回(无崩溃/无死循环)':'❌ 有崩溃');

// 预览坐标验证：无论 valid 与否，ax/ay 必然落在有效画布范围内
console.log('');
let previewOK=true;
for(let r=1;r<=7;r++) for(let c=1;c<=5;c++){
  const a = api.anchorFor('macrophage',c,r);
  const ax = a ? a.ac : c;
  const ay = a ? a.ar : r;
  if(ax<0||ax>6||ay<0||ay>8){ previewOK=false; console.log('BAD preview coords at',c,r,ax,ay); }
}
console.log(previewOK?'✅ 所有预览坐标 ax/ay 在画布范围内(不会画到屏外)':'❌ 有越界坐标');

// 精确边界检测：4候选锚点均无"全绿footprint"，但至少有一个"部分绿部分暗"
console.log('\n=== 精确绿暗交界松手→卡片退商店 ===');
let retreatOK=0, retreatFail=[];
const boundarySpots = [];
for(let r=1;r<=7;r++) for(let c=1;c<=5;c++){
  let hasFullyGreen=false, hasPartial=false;
  for(const [ac,ar] of [[c-1,r-1],[c,r-1],[c-1,r],[c,r]]){
    if(ac<1||ac>4||ar<1||ar>6) continue;
    let green=0, total=0;
    for(let dr=0;dr<2;dr++) for(let dc=0;dc<2;dc++){
      total++; const val=G.grid[ar+dr]?.[ac+dc];
      if(val===null) green++;
    }
    if(green===total) hasFullyGreen=true;
    else if(green>0) hasPartial=true;
  }
  if(!hasFullyGreen && hasPartial) boundarySpots.push([c,r]);
}
console.log('精确交界位置: '+boundarySpots.map(p=>'('+p.join(',')+')').join(' '));

for(const [c,r] of boundarySpots){
  api.start(); const G2=api.getG();
  G2.shop[0]='macrophage'; G2.selected=-1;
  const lenBefore=G2.shop.length;
  api.trySwap(0,'macrophage',c,r);
  const tower=G2.towers.find(t=>t.type==='macrophage');
  if(G2.shop.length===lenBefore) retreatOK++;
  else retreatFail.push(`(${c},${r}) 卡片被消耗${tower?',塔落点='+tower.col+','+tower.row:''}`);
}
if(retreatFail.length) retreatFail.forEach(e=>console.log('  ❌ '+e));
console.log(`${retreatOK}/${boundarySpots.length} 个交界位置松手后退回商店`+(retreatOK===boundarySpots.length?' ✅':' ❌'));

// 最终检查：是否存在"落塔含暗格"
console.log('\n=== 最终安检：落塔footprint不得含暗格 ===');
api.start(); let Gf=api.getG();
let darkTower=false;
for(const [c,r] of boundarySpots){
  api.start(); const G3=api.getG();
  G3.shop[0]='macrophage'; G3.selected=-1;
  api.trySwap(0,'macrophage',c,r);
  const tower=G3.towers.find(t=>t.type==='macrophage');
  if(tower){
    for(let dr=0;dr<tower.size;dr++) for(let dc=0;dc<tower.size;dc++){
      const cellVal = G3.grid[tower.row+dr]?.[tower.col+dc];
      if(cellVal && cellVal!==null && typeof cellVal==='string'){
        darkTower=true;
        console.log(`  ❌ 塔(${tower.col},${tower.row}) footprint[${dr},${dc}]=${cellVal} 含暗格!`);
      }
    }
  }
}
console.log(darkTower?'❌ 有塔落在含暗格的footprint上':'✅ 所有塔落在全绿footprint上');
