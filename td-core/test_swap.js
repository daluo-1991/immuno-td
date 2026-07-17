const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.join(__dirname, 'L1_play.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error('no inline script found');
const code = m[1];

function makeEl(id) {
  const el = { id, _style: {}, _class: new Set(), _children: [], _text: '', _html: '' };
  Object.assign(el, {
    get textContent() { return el._text; },
    set textContent(v) { el._text = String(v); },
    get innerHTML() { return el._html; },
    set innerHTML(v) { el._html = String(v); },
    classList: {
      add: (c) => el._class.add(c),
      remove: (c) => el._class.delete(c),
      toggle: (c) => { const had = el._class.has(c); if (had) el._class.delete(c); else el._class.add(c); return !had; },
      contains: (c) => el._class.has(c),
    },
    style: { width: '', height: '', opacity: '', boxShadow: '', display: '' },
    onclick: null,
    _listeners: {},
    addEventListener(type, fn) { (el._listeners[type] ||= []).push(fn); },
    appendChild(c) { el._children.push(c); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 336, height: 432 }; },
  });
  return el;
}

const els = {};
const canvas = {
  width: 336, height: 432,
  style: { width: '', height: '' },
  getContext() { return { fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, fill() {}, stroke() {}, setLineDash() {}, closePath() {}, clearRect() {} }; },
  getBoundingClientRect() { return { left: 0, top: 0, width: 336, height: 432 }; },
  addEventListener() {}, setPointerCapture() {},
};

const document = {
  getElementById(id) { if (id === 'cv') return canvas; if (!els[id]) els[id] = makeEl(id); return els[id]; },
  createElement(tag) { return makeEl(tag); },
  addEventListener() {},
};

const context = {
  document, window: { addEventListener() {}, requestAnimationFrame() {}, setInterval() {}, setTimeout() {}, location: { href: '' }, innerWidth: 430, innerHeight: 800 },
  console, Math, Date, Object, Array, JSON, RegExp, Error, Set, Map, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite,
  setInterval() {}, setTimeout() {}, alert() {}, requestAnimationFrame() {},
};
context.window = context;

new vm.Script(code + `
Object.defineProperty(window, '__G', { get: function(){ return G; } });
Object.defineProperty(window, '__CELLS', { get: function(){ return CELLS; } });
Object.defineProperty(window, '__placeTower', { get: function(){ return placeTower; } });
Object.defineProperty(window, '__anchorFor', { get: function(){ return anchorFor; } });
Object.defineProperty(window, '__canPlace', { get: function(){ return canPlace; } });
Object.defineProperty(window, '__trySwap', { get: function(){ return trySwap; } });
`).runInNewContext(context);

context.start();

const G = context.__G;
const CELLS = context.__CELLS;
const placeTower = context.__placeTower;
const anchorFor = context.__anchorFor;
const canPlace = context.__canPlace;
const trySwap = context.__trySwap;

// 清空并构造截图状态
G.towers = [];
for (let r = 0; r < 9; r++) for (let c = 0; c < 7; c++) if (G.grid[r][c] && typeof G.grid[r][c] === 'object') G.grid[r][c] = null;

placeTower('interferon', 2, 3);
placeTower('neutrophil', 1, 3);
G.shop[3] = 'memory';
G.shop[0] = null; // 确保有槽接收顶回的干扰素
G.selected = 3;

function dump() {
  const rows = [];
  for (let r = 0; r < 9; r++) {
    const line = [];
    for (let c = 0; c < 7; c++) {
      const g = G.grid[r][c];
      if (g === 'path') line.push('P');
      else if (g === 'locked') line.push('#');
      else if (g === null) line.push('.');
      else if (typeof g === 'object') line.push(CELLS[g.type].short);
    }
    rows.push(line.join(''));
  }
  return rows.join('\n');
}

console.log('棋盘：\n' + dump());
console.log('塔：', G.towers.map(t => `${CELLS[t.type].name}@${t.col},${t.row}`).join('  '));

console.log('\n--- 右下角 (4,5) 状态与普通放置 ---');
console.log('(4,5):', G.grid[5][4] === null ? 'null' : G.grid[5][4] === 'locked' ? 'locked' : typeof G.grid[5][4]);
for (const [c, r] of [[3,4],[4,4],[3,5],[4,5]]) {
  console.log(`canPlace(memory,${c},${r}):`, canPlace('memory', c, r));
}
const a45 = anchorFor('memory', 4, 5);
console.log('anchorFor(memory,4,5):', a45);

console.log('\n--- 替换干扰素：点击 footprint 各格 ---');
const G1 = { grid: JSON.parse(JSON.stringify(G.grid)), towers: G.towers.slice(), shop: G.shop.slice() };
for (const [c, r] of [[2,3],[3,3],[2,4],[3,4]]) {
  G.grid = JSON.parse(JSON.stringify(G1.grid));
  G.towers = G1.towers.slice();
  G.shop = G1.shop.slice();
  trySwap(3, 'memory', c, r);
  const mem = G.towers.find(t => t.type === 'memory');
  const intf = G.towers.find(t => t.type === 'interferon');
  console.log(`点击(${c},${r}) => 记忆@${mem ? `${mem.col},${mem.row}` : '无'}, 干扰素@${intf ? '已回商店' : '已消失'}`);
}
