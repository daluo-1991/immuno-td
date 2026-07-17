// 免疫塔防 战斗模拟器（headless，零依赖）
const { CELLS, MATRIX, VIRUSES, BALANCE, LEVELS } = require('./config');

const BODY_DURATION = 5; // 病毒入体后存活秒数，随后被免疫清除（§10 发烧模型）

function key(c, r) { return c + ',' + r; }
function dist(a, b) { return Math.hypot(a.col - b.col, a.row - b.row); }

function buildGrid(level) {
  const grid = [];
  for (let r = 0; r < level.rows; r++) grid.push(new Array(level.cols).fill(null));
  for (const e of level.entrances) grid[e.row][e.col] = { type: 'entrance' };
  grid[level.exit.row][level.exit.col] = { type: 'exit' };
  // v0.4：标记外环路径格为不可摆塔
  const paths = level.paths || (level.path ? [level.path] : []);
  for (const p of paths) for (const c of p) {
    if (grid[c[1]] && grid[c[1]][c[0]] === null) grid[c[1]][c[0]] = { type: 'path' };
  }
  return grid;
}

function bfs(grid, level, start) {
  const q = [start];
  const prev = {};
  const seen = new Set([key(start.col, start.row)]);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (q.length) {
    const cur = q.shift();
    if (cur.col === level.exit.col && cur.row === level.exit.row) {
      const path = [];
      let k = key(cur.col, cur.row);
      while (k) {
        const [c, r] = k.split(',').map(Number);
        path.unshift({ col: c, row: r });
        k = prev[k];
      }
      return path;
    }
    for (const [dc, dr] of dirs) {
      const nc = cur.col + dc, nr = cur.row + dr;
      if (nc < 0 || nr < 0 || nc >= level.cols || nr >= level.rows) continue;
      const cell = grid[nr][nc];
      if (cell && cell.type === 'tower') continue;
      const nk = key(nc, nr);
      if (seen.has(nk)) continue;
      seen.add(nk);
      prev[nk] = key(cur.col, cur.row);
      q.push({ col: nc, row: nr });
    }
  }
  return null;
}

// 选对关卡病毒平均克制系数最高的 dps 战斗塔
function pickMainTower(level) {
  const types = ['neutrophil', 'macrophage', 'tcell', 'nk'];
  const virusSet = new Set();
  for (const w of level.waves) virusSet.add(w.virus);
  let best = 'neutrophil', bestAvg = -1;
  for (const t of types) {
    let sum = 0;
    for (const v of virusSet) sum += (MATRIX[v][t] || 0);
    const avg = sum / virusSet.size;
    if (avg > bestAvg) { bestAvg = avg; best = t; }
  }
  return best;
}

// 简单 greedy bot：1 红细胞启动产能 + 沿路径旁摆主战塔 + 每4格抗体 + 末尾补红细胞
function simpleBot(level) {
  const grid = buildGrid(level);
  const paths = level.entrances.map(e => bfs(grid, level, e)).filter(Boolean);
  const pathCells = new Set();
  for (const p of paths) for (const c of p) pathCells.add(key(c.col, c.row));
  const plan = [];
  const occupied = new Set(pathCells);
  for (const e of level.entrances) occupied.add(key(e.col, e.row));
  occupied.add(key(level.exit.col, level.exit.row));

  const corners = [
    { col: 0, row: level.rows - 1 }, { col: level.cols - 1, row: level.rows - 1 },
    { col: 0, row: 0 }, { col: level.cols - 1, row: 0 },
  ];
  let firstRc = null;
  for (const c of corners) {
    if (!occupied.has(key(c.col, c.row))) { firstRc = c; break; }
  }
  if (firstRc) {
    plan.push({ col: firstRc.col, row: firstRc.row, type: 'redcell', cost: CELLS.redcell.cost });
    occupied.add(key(firstRc.col, firstRc.row));
  }

  const main = pickMainTower(level);
  const used = new Set(occupied);
  for (const p of paths) {
    for (let i = 1; i < p.length - 1; i += 2) {
      const cell = p[i];
      const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dc, dr] of adj) {
        const nc = cell.col + dc, nr = cell.row + dr;
        if (nc < 0 || nr < 0 || nc >= level.cols || nr >= level.rows) continue;
        const k = key(nc, nr);
        if (used.has(k)) continue;
        plan.push({ col: nc, row: nr, type: main, cost: CELLS[main].cost });
        used.add(k);
        break;
      }
      if (i % 4 === 1) {
        for (const [dc, dr] of adj) {
          const nc = cell.col + dc, nr = cell.row + dr;
          if (nc < 0 || nr < 0 || nc >= level.cols || nr >= level.rows) continue;
          const k = key(nc, nr);
          if (used.has(k)) continue;
          plan.push({ col: nc, row: nr, type: 'antibody', cost: CELLS.antibody.cost });
          used.add(k);
          break;
        }
      }
    }
  }
  let extraRc = 0;
  for (const c of corners) {
    if (extraRc >= 2) break;
    if (!occupied.has(key(c.col, c.row))) {
      plan.push({ col: c.col, row: c.row, type: 'redcell', cost: CELLS.redcell.cost });
      occupied.add(key(c.col, c.row)); extraRc++;
    }
  }
  return plan;
}

function countActivated(activated) {
  const m = {};
  for (const a of activated) m[a.type] = (m[a.type] || 0) + 1;
  return m;
}

function simulate(level, plan) {
  const grid = buildGrid(level);
  const paths = level.entrances.map(e => bfs(grid, level, e));

  let schedule = [];
  let t = 0, ei = 0;
  for (const w of level.waves) {
    for (let i = 0; i < w.count; i++) {
      schedule.push({ time: t, virus: w.virus, entrance: level.entrances[ei % level.entrances.length] });
      ei++; t += w.interval;
    }
    t += 2;
  }
  schedule.sort((a, b) => a.time - b.time);

  let viruses = [];
  let body = [];
  const activated = [];
  const activatedSet = new Set();
  let energy = level.energyStart;
  let temp = BALANCE.baseTemp;
  let leaks = 0, peakTemp = temp, inBody = 0, spawned = 0, killed = 0;
  const tick = BALANCE.tickSec;
  let now = 0;
  const maxTicks = 6000;
  let si = 0;

  function recomputeAura() {
    for (const a of activated) a.auraMult = 1.0;
    for (const a of activated) {
      if (CELLS[a.type].role !== 'aura') continue;
      const aura = CELLS[a.type].aura;
      for (const b of activated) {
        if (b === a) continue;
        if (dist(a, b) <= CELLS[a.type].range) b.auraMult *= aura.dmg;
      }
    }
  }

  for (let tickIdx = 0; tickIdx < maxTicks; tickIdx++) {
    now = tickIdx * tick;

    let regen = BALANCE.baseEnergyRegen;
    for (const a of activated) if (a.type === 'redcell') regen += CELLS.redcell.energyRate;
    energy += regen * tick;

    for (const d of plan) {
      const k = key(d.col, d.row);
      if (activatedSet.has(k)) continue;
      if (energy >= d.cost && grid[d.row][d.col] === null) {
        energy -= d.cost;
        grid[d.row][d.col] = { type: 'tower', cell: d.type };
        activated.push({ col: d.col, row: d.row, type: d.type, auraMult: 1 });
        activatedSet.add(k);
      }
    }
    recomputeAura();

    while (si < schedule.length && schedule[si].time <= now) {
      const s = schedule[si];
      const idx = level.entrances.indexOf(s.entrance);
      const path = paths[idx];
      if (!path) { si++; continue; }
      spawned++;
      viruses.push({
        id: si, virus: s.virus, pathIdx: idx, progress: 0,
        hp: VIRUSES[s.virus].hp, speed: VIRUSES[s.virus].speed,
        vulnUntil: -1, dead: false,
      });
      si++;
    }

    // 更新病毒实时坐标（基于 progress，供塔索敌用 dist）
    for (const v of viruses) {
      if (v.dead) continue;
      const path = paths[v.pathIdx];
      const idx = Math.min(Math.floor(v.progress), path.length - 1);
      v.col = path[idx].col; v.row = path[idx].row;
    }

    for (const a of activated) {
      const def = CELLS[a.type];
      if (def.dps <= 0) {
        if (def.role === 'debuff') {
          for (const v of viruses) if (!v.dead && dist(a, v) <= def.range) v.vulnUntil = now + 1.0;
        }
        continue;
      }
      const targets = viruses.filter(v => !v.dead && dist(a, v) <= def.range);
      if (targets.length === 0) continue;
      const dmgPerTick = def.dps * tick * (a.auraMult || 1);
      if (def.atkType === 'aoe') {
        for (const v of targets) {
          const mult = MATRIX[v.virus][a.type] || 1;
          const vuln = (v.vulnUntil > now) ? 1.5 : 1;
          v.hp -= dmgPerTick * mult * vuln;
        }
      } else {
        targets.sort((x, y) => dist(a, x) - dist(a, y));
        const v = targets[0];
        const mult = MATRIX[v.virus][a.type] || 1;
        const vuln = (v.vulnUntil > now) ? 1.5 : 1;
        v.hp -= dmgPerTick * mult * vuln;
      }
    }

    for (const v of viruses) {
      if (v.dead) continue;
      if (v.hp <= 0) { v.dead = true; killed++; continue; }
      v.progress += v.speed * tick;
      const path = paths[v.pathIdx];
      if (path && v.progress >= path.length - 1) {
        v.dead = true; v.leaked = true; leaks++; body.push({ enterTime: now });
      }
    }
    viruses = viruses.filter(v => !v.dead);

    body = body.filter(b => now - b.enterTime < BODY_DURATION);
    inBody = body.length;

    if (inBody > 0) temp += BALANCE.tempPerVirus * inBody * tick;
    else temp += BALANCE.naturalCool * tick;
    if (temp < BALANCE.baseTemp) temp = BALANCE.baseTemp;
    if (temp > peakTemp) peakTemp = temp;

    if (temp >= level.feverThreshold) {
      return { win: false, peakTemp, leaks, spawned, killed, timeSec: now, activated: countActivated(activated), reason: 'fever' };
    }
    if (si >= schedule.length && viruses.length === 0 && inBody === 0) {
      return { win: true, peakTemp, leaks, spawned, killed, timeSec: now, activated: countActivated(activated) };
    }
  }
  return { win: false, peakTemp, leaks, spawned, killed, timeSec: now, activated: countActivated(activated), reason: 'timeout' };
}

// ===== 随机商店模式（用户 2026-07-17 参数）=====
const { SHOP, WEIGHTS } = require('./config');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedDraw(rng) {
  let total = 0; for (const k in WEIGHTS) total += WEIGHTS[k];
  let r = rng() * total;
  for (const k in WEIGHTS) { r -= WEIGHTS[k]; if (r <= 0) return k; }
  return Object.keys(WEIGHTS).pop();
}

function drawShop(rng, slots) {
  const s = [];
  for (let i = 0; i < slots; i++) s.push(weightedDraw(rng));
  return s;
}

function canPlace(grid, level, col, row, size) {
  for (let dr = 0; dr < size; dr++) for (let dc = 0; dc < size; dc++) {
    const c = col + dc, r = row + dr;
    if (c < 0 || r < 0 || c >= level.cols || r >= level.rows) return false;
    if (grid[r][c] !== null) return false;
  }
  return true;
}

function placeTower(grid, level, col, row, size, type) {
  for (let dr = 0; dr < size; dr++) for (let dc = 0; dc < size; dc++) {
    grid[row + dr][col + dc] = { type: 'tower', cell: type };
  }
}

// 老手：贴路径的空格中，选离"已有战斗塔"最远的那个 → 沿全路径均匀铺开覆盖
function findAdjPlacement(grid, level, pathSet, size, activated) {
  const cands = [];
  for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) {
    if (!canPlace(grid, level, c, r, size)) continue;
    let adj = false;
    for (let dr = 0; dr < size && !adj; dr++) for (let dc = 0; dc < size && !adj; dc++) {
      const cc = c + dc, rr = r + dr;
      for (const [adc, adr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (pathSet.has(key(cc + adc, rr + adr))) { adj = true; break; }
      }
    }
    if (adj) cands.push({ col: c, row: r });
  }
  if (!cands.length) return null;
  const combat = (activated || []).filter(a => CELLS[a.type].dps > 0);
  if (!combat.length) return cands[0];
  let best = cands[0], bestD = -1;
  for (const cd of cands) {
    let md = Infinity;
    for (const t of combat) {
      const d = Math.hypot(cd.col - t.col, cd.row - t.row);
      if (d < md) md = d;
    }
    if (md > bestD) { bestD = md; best = cd; }
  }
  return best;
}

// 手残新手：全图任意空格随机扔（含远离路径的角落）→ 最坏情况建模
function randomAnywhere(grid, level, size, rng) {
  const cands = [];
  for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) {
    if (canPlace(grid, level, c, r, size)) cands.push({ col: c, row: r });
  }
  if (!cands.length) return null;
  return cands[Math.floor(rng() * cands.length)];
}

// 用户质疑场景：战斗塔全部往"离入口最远"处堆（出口侧/下方），入口上方留真空带
function findFarFromEntrance(grid, level, pathSet, size, entrance) {
  const cands = [];
  for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) {
    if (!canPlace(grid, level, c, r, size)) continue;
    let adj = false;
    for (let dr = 0; dr < size && !adj; dr++) for (let dc = 0; dc < size && !adj; dc++) {
      const cc = c + dc, rr = r + dr;
      for (const [adc, adr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (pathSet.has(key(cc + adc, rr + adr))) { adj = true; break; }
      }
    }
    if (adj) cands.push({ col: c, row: r });
  }
  if (!cands.length) return null;
  let best = cands[0], bestD = -1;
  for (const cd of cands) {
    const d = Math.hypot(cd.col - entrance.col, cd.row - entrance.row);
    if (d > bestD) { bestD = d; best = cd; }
  }
  return best;
}

function findEmptyNonPath(grid, level, pathSet, size) {
  for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) {
    if (pathSet.has(key(c, r))) continue;
    if (canPlace(grid, level, c, r, size)) return { col: c, row: r };
  }
  // 退路：任意空格
  for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) {
    if (canPlace(grid, level, c, r, size)) return { col: c, row: r };
  }
  return null;
}

function shopHasDps(shop) {
  for (const ty of shop) if (ty && CELLS[ty].dps > 0) return true;
  return false;
}

function recomputeAuraList(activated) {
  for (const a of activated) a.auraMult = 1.0;
  for (const a of activated) {
    if (CELLS[a.type].role !== 'aura') continue;
    for (const b of activated) {
      if (b === a) continue;
      if (dist(a, b) <= CELLS[a.type].range) b.auraMult *= CELLS[a.type].aura.dmg;
    }
  }
}

function simulateShop(level, seed, opts = {}) {
  const rng = mulberry32(seed || 1);
  const grid = buildGrid(level);
  // v0.4：若关卡显式定义了 paths（外环固定路径，每入口一条），直接用；否则 BFS 自动寻路（迷宫模式）
  let paths;
  if (level.paths && level.paths.length) {
    paths = level.paths.map(p => p.map(c => ({ col: c[0], row: c[1] })));
  } else {
    paths = level.entrances.map(e => bfs(grid, level, e)).filter(Boolean);
  }
  const pathSet = new Set();
  for (const p of paths) for (const c of p) pathSet.add(key(c.col, c.row));

  // 带 waveIdx 的出怪表
  let schedule = []; let t = 0, ei = 0, wi = 0;
  for (const w of level.waves) {
    for (let i = 0; i < w.count; i++) {
      schedule.push({ time: t, virus: w.virus, entrance: level.entrances[ei % level.entrances.length], waveIdx: wi });
      ei++; t += w.interval;
    }
    t += 2; wi++;
  }
  schedule.sort((a, b) => a.time - b.time);

  let viruses = []; let body = [];
  const activated = []; const activatedSet = new Set();
  let energy = level.energyStart; let temp = BALANCE.baseTemp;
  let leaks = 0, peakTemp = temp, inBody = 0, spawned = 0, killed = 0;
  const tick = BALANCE.tickSec; let now = 0; const maxTicks = 6000; let si = 0;

  let currentWave = -1;
  let shop = drawShop(rng, SHOP.slots);
  let rerollsThisWave = 0;
  let redDeployed = 0;
  let rerollTotal = 0, redSeenTotal = 0, deployTotal = 0;

  function deployAt(i, pos, ty) {
    energy -= CELLS[ty].cost;
    placeTower(grid, level, pos.col, pos.row, CELLS[ty].size, ty);
    activated.push({ col: pos.col, row: pos.row, type: ty, auraMult: 1 });
    activatedSet.add(key(pos.col, pos.row));
    shop[i] = null;
    deployTotal++;
    if (ty === 'redcell') redDeployed++;
  }

  // 新手乱摆：往"路径 2 格内"随机空格扔（大致往路边，但不精确贴格）
  function randomNearPath(size) {
    const cands = [];
    for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) {
      if (!canPlace(grid, level, c, r, size)) continue;
      let near = false;
      for (const pk of pathSet) {
        const [pc, pr] = pk.split(',').map(Number);
        if (Math.abs(pc - c) + Math.abs(pr - r) <= 2) { near = true; break; }
      }
      if (near) cands.push({ col: c, row: r });
    }
    if (!cands.length) return null;
    return cands[Math.floor(rng() * cands.length)];
  }

  // mode='smart'：老手，沿路径均匀铺开；'naive'：半懂，路边2格内随机；'clueless'：手残，全图乱扔
  // 三档经济部署一致，隔离出"摆放水平 × range 容错"这个单一变量
  function botDeploy(mode) {
    let changed = true;
    while (changed) {
      changed = false;
      if (redDeployed < SHOP.targetRed) {
        const ri = shop.indexOf('redcell');
        if (ri >= 0 && energy >= CELLS.redcell.cost) {
          const pos = findEmptyNonPath(grid, level, pathSet, CELLS.redcell.size);
          if (pos) { deployAt(ri, pos, 'redcell'); changed = true; continue; }
        }
      }
      let bestIdx = -1, bestDps = -1;
      for (let i = 0; i < shop.length; i++) {
        const ty = shop[i]; if (!ty) continue;
        const d = CELLS[ty]; if (d.dps <= 0) continue;
        if (energy < d.cost) continue;
        if (d.dps > bestDps) { bestDps = d.dps; bestIdx = i; }
      }
      if (bestIdx >= 0) {
        const ty = shop[bestIdx]; const sz = CELLS[ty].size;
        let pos;
        if (mode === 'clueless') pos = randomAnywhere(grid, level, sz, rng);
        else if (mode === 'naive') pos = randomNearPath(sz);
        else if (mode === 'bottom') pos = findFarFromEntrance(grid, level, pathSet, sz, level.entrances[0]);
        else pos = findAdjPlacement(grid, level, pathSet, sz, activated);
        if (pos) { deployAt(bestIdx, pos, ty); changed = true; continue; }
      }
      break;
    }
  }

  // 预置开局塔（v0.4：保卫向日葵模板——开局已有基础防线，降低新手门槛）
  if (level.preplaced) {
    for (const pp of level.preplaced) {
      const def = CELLS[pp.type];
      if (!def) continue;
      if (pp.col < 0 || pp.col >= level.cols || pp.row < 0 || pp.row >= level.rows) continue;
      if (!canPlace(grid, level, pp.col, pp.row, def.size)) {
        console.warn(`[preplaced] ${pp.type}@(${pp.col},${pp.row}) 无法放置，跳过`);
        continue;
      }
      placeTower(grid, level, pp.col, pp.row, def.size, pp.type);
      activated.push({ col: pp.col, row: pp.row, type: pp.type, auraMult: 1 });
      activatedSet.add(key(pp.col, pp.row));
      deployTotal++;
      if (pp.type === 'redcell') redDeployed++;
    }
  }

  for (let tickIdx = 0; tickIdx < maxTicks; tickIdx++) {
    now = tickIdx * tick;

    // 波次边界 → 自动刷新 + 回合初手动刷新（最多 maxRerollsPerWave 次）
    if (si < schedule.length) {
      const nw = schedule[si].waveIdx;
      if (nw !== currentWave) {
        currentWave = nw;
        shop = drawShop(rng, SHOP.slots);
        rerollsThisWave = 0;
        for (let rr = 0; rr < SHOP.maxRerollsPerWave; rr++) {
          if (energy < SHOP.rerollCost) break;
          const needRed = (redDeployed < SHOP.targetRed) && !shop.includes('redcell');
          const noDps = !shopHasDps(shop);
          if (needRed || noDps) {
            energy -= SHOP.rerollCost; shop = drawShop(rng, SHOP.slots);
            rerollTotal++; rerollsThisWave++;
          } else break;
        }
      }
    }

    let regen = BALANCE.baseEnergyRegen;
    for (const a of activated) if (a.type === 'redcell') regen += CELLS.redcell.energyRate;
    energy += regen * tick;

    botDeploy(opts.mode || 'smart');
    recomputeAuraList(activated);

    while (si < schedule.length && schedule[si].time <= now) {
      const s = schedule[si];
      const idx = level.entrances.indexOf(s.entrance);
      const path = paths[idx];
      if (!path) { si++; continue; }
      spawned++;
      viruses.push({
        id: si, virus: s.virus, pathIdx: idx, progress: 0,
        hp: VIRUSES[s.virus].hp, speed: VIRUSES[s.virus].speed,
        vulnUntil: -1, dead: false,
      });
      si++;
    }

    for (const v of viruses) {
      if (v.dead) continue;
      const path = paths[v.pathIdx];
      const idx = Math.min(Math.floor(v.progress), path.length - 1);
      v.col = path[idx].col; v.row = path[idx].row;
    }

    for (const a of activated) {
      const def = CELLS[a.type];
      if (def.dps <= 0) {
        if (def.role === 'debuff') {
          for (const v of viruses) if (!v.dead && dist(a, v) <= def.range) v.vulnUntil = now + 1.0;
        }
        continue;
      }
      const targets = viruses.filter(v => !v.dead && dist(a, v) <= def.range);
      if (targets.length === 0) continue;
      const dmgPerTick = def.dps * tick * (a.auraMult || 1);
      if (def.atkType === 'aoe') {
        for (const v of targets) {
          const mult = MATRIX[v.virus][a.type] || 1;
          const vuln = (v.vulnUntil > now) ? 1.5 : 1;
          v.hp -= dmgPerTick * mult * vuln;
        }
      } else {
        targets.sort((x, y) => dist(a, x) - dist(a, y));
        const v = targets[0];
        const mult = MATRIX[v.virus][a.type] || 1;
        const vuln = (v.vulnUntil > now) ? 1.5 : 1;
        v.hp -= dmgPerTick * mult * vuln;
      }
    }

    for (const v of viruses) {
      if (v.dead) continue;
      if (v.hp <= 0) { v.dead = true; killed++; continue; }
      v.progress += v.speed * tick;
      const path = paths[v.pathIdx];
      if (path && v.progress >= path.length - 1) {
        v.dead = true; v.leaked = true; leaks++; body.push({ enterTime: now });
      }
    }
    viruses = viruses.filter(v => !v.dead);

    body = body.filter(b => now - b.enterTime < BODY_DURATION);
    inBody = body.length;

    if (inBody > 0) temp += BALANCE.tempPerVirus * inBody * tick;
    else temp += BALANCE.naturalCool * tick;
    if (temp < BALANCE.baseTemp) temp = BALANCE.baseTemp;
    if (temp > peakTemp) peakTemp = temp;

    if (temp >= level.feverThreshold) {
      return { win: false, peakTemp, leaks, spawned, killed, timeSec: now, activated: countActivated(activated), reason: 'fever', rerollTotal, redDeployed, deployTotal };
    }
    if (si >= schedule.length && viruses.length === 0 && inBody === 0) {
      return { win: true, peakTemp, leaks, spawned, killed, timeSec: now, activated: countActivated(activated), rerollTotal, redDeployed, deployTotal };
    }
  }
  return { win: false, peakTemp, leaks, spawned, killed, timeSec: now, activated: countActivated(activated), reason: 'timeout', rerollTotal, redDeployed, deployTotal };
}

module.exports = { simulate, simpleBot, bfs, buildGrid, simulateShop, drawShop, SHOP };
