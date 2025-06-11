(() => {
  const MAX_R = 4, STEPS = 5;
  const DXY = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  let single = false, aiRand = 0.25;
  let round = 1, step = 1, phase = 'planA';
  let plans = { A: [], B: [] };
  let usedMove = { A: new Set(), B: new Set() };
  let usedAtkDirs = { A: new Set(), B: new Set() };
  let usedAtk = { A: 0, B: 0 }, usedShield = { A: 0, B: 0 };
  let simPos = { A: { x: 0, y: 2 }, B: { x: 4, y: 2 } };
  let units = { A: { x: 0, y: 2, alive: true }, B: { x: 4, y: 2, alive: true } };

  const ms = document.getElementById('modeSelect');
  const ds = document.getElementById('difficultySelect');
  const b1p = document.getElementById('btn1p');
  const b2p = document.getElementById('btn2p');
  const rulesInit = document.getElementById('rulesBtnInitial');
  const rulesOv = document.getElementById('rulesOverlay');
  const rulesClose = document.getElementById('rulesClose');
  const board = document.getElementById('board');
  const ui = document.getElementById('ui');
  const phaseEl = document.getElementById('phase');
  const pcs = [...Array(STEPS)].map((_, i) => document.getElementById('pc' + i));
  const acts = Array.from(document.querySelectorAll('#actions button'));
  const btnDel = document.getElementById('btn-del');
  const btnNext = document.getElementById('btn-next');
  const atkOv = document.getElementById('atkOverlay');

  b1p.onclick = () => { single = true; ms.style.display = 'none'; ds.style.display = 'flex'; };
  b2p.onclick = () => { single = false; ms.style.display = 'none'; startGame(); };
  rulesInit.onclick = () => rulesOv.style.display = 'block';
  rulesClose.onclick = () => rulesOv.style.display = 'none';

  ds.querySelector('.easy').onclick   = () => { aiRand = 0.5;  ds.style.display = 'none'; startGame(); };
  ds.querySelector('.medium').onclick = () => { aiRand = 0.25; ds.style.display = 'none'; startGame(); };
  ds.querySelector('.hard').onclick   = () => { aiRand = 0.1;  ds.style.display = 'none'; startGame(); };

  function startGame() {
    board.style.visibility = 'visible';
    ui.style.visibility = 'visible';
    buildBoard(); bindUI(); render(); updateUI();
  }

  function buildBoard() {
    board.innerHTML = '';
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const c = document.createElement('div');
        c.className = 'cell'; c.id = `c${x}${y}`;
        board.append(c);
      }
    }
  }

  function bindUI() {
    acts.forEach(b => {
      b.onclick = () => {
        const P = phase === 'planA' ? 'A' : 'B';
        if (phase === 'execute' || plans[P].length >= STEPS) return;
        const act = b.dataset.act;
        if (DXY[act] && usedAtkDirs[P].has(act)) return;
        if (act === 'attack' && usedAtk[P] >= 1) return;
        if (act === 'shield' && usedShield[P] >= 1) return;
        act === 'attack' ? openAttack(P) : record(P, act);
      };
    });
    btnDel.onclick = () => { if (phase.startsWith('plan')) deleteLast(); };
    btnNext.onclick = () => nextStep();
  }

  function openAttack(P) {
    atkOv.innerHTML = ''; atkOv.style.visibility = 'visible';
    let tmp = [];
    Object.keys(DXY).filter(d => !usedMove[P].has(d)).forEach(d => {
      const btn = document.createElement('button');
      btn.textContent = { up: '↑', down: '↓', left: '←', right: '→' }[d];
      btn.onclick = () => {
        if (tmp.includes(d)) { tmp = tmp.filter(x => x !== d); btn.classList.remove('sel'); }
        else { tmp.push(d); btn.classList.add('sel'); }
      };
      atkOv.append(btn);
    });
    const ok = document.createElement('button');
    ok.textContent = 'OK'; ok.className = 'confirm';
    ok.onclick = () => {
      record(P, { type: 'attack', dirs: tmp.slice() });
      usedAtk[P]++; tmp.forEach(d => usedAtkDirs[P].add(d));
      atkOv.style.visibility = 'hidden';
    };
    atkOv.append(ok);
  }

  function record(P, act) {
    plans[P].push(act);
    if (typeof act === 'string') {
      if (act === 'shield') usedShield[P]++;
      if (DXY[act]) {
        usedMove[P].add(act);
        simPos[P].x += DXY[act][0];
        simPos[P].y += DXY[act][1];
      }
    }
    updateUI(); drawPlan(P);
  }

  function deleteLast() {
    const P = plans.A.length === STEPS && plans.B.length < STEPS ? 'B' : 'A';
    if (!plans[P].length) return;
    const a = plans[P].pop();
    if (typeof a === 'string') {
      if (a === 'shield') usedShield[P]--;
      if (DXY[a]) {
        usedMove[P].delete(a);
        simPos[P] = { ...units[P] };
        plans[P].forEach(r => {
          if (typeof r === 'string' && DXY[r]) {
            simPos[P].x += DXY[r][0]; simPos[P].y += DXY[r][1];
          }
        });
      }
    } else {
      usedAtk[P]--; a.dirs.forEach(d => usedAtkDirs[P].delete(d));
    }
    updateUI(); drawPlan(P);
  }

  function nextStep() {
    if (phase === 'planA' && single) {
      autoPlanB();
      phase = 'execute';
      btnNext.textContent = '▶ Выполнить';
      clearPlan(); updateUI();
      return;
    }
    if (phase !== 'execute') {
      phase = phase === 'planA' ? 'planB' : 'execute';
      btnNext.textContent = phase === 'execute' ? '▶ Выполнить' : '▶ Далее';
      clearPlan(); updateUI();
      return;
    }
    execStep();
  }

  function autoPlanB() {
    plans.B = []; usedMove.B.clear(); usedAtkDirs.B.clear();
    usedAtk.B = 0; usedShield.B = 0; simPos.B = { ...units.B };
    const opp = units.A;
    for (let i = 0; i < STEPS; i++) {
      const di = Object.entries(DXY).find(([d, [dx, dy]]) =>
        simPos.B.x + dx === opp.x && simPos.B.y + dy === opp.y && !usedMove.B.has(d)
      );
      if (di && usedAtk.B < 1) {
        const [d] = di;
        plans.B.push({ type: 'attack', dirs: [d] });
        usedAtk.B++; usedAtkDirs.B.add(d);
        continue;
      }
      let best = null, bd = Infinity;
      for (const [d, [dx, dy]] of Object.entries(DXY)) {
        if (usedAtkDirs.B.has(d)) continue;
        const nx = simPos.B.x + dx, ny = simPos.B.y + dy;
        if (nx < 0 || nx > 4 || ny < 0 || ny > 4) continue;
        const dist = Math.abs(nx - opp.x) + Math.abs(ny - opp.y);
        if (dist < bd) { bd = dist; best = d; }
      }
      if (Math.random() > aiRand && best) {
        plans.B.push(best);
        usedMove.B.add(best);
        simPos.B.x += DXY[best][0]; simPos.B.y += DXY[best][1];
        continue;
      }
      if (usedShield.B < 1 && Math.random() < 0.3) {
        plans.B.push('shield'); usedShield.B++; continue;
      }
      const opts = [];
      for (const d in DXY) {
        const [dx, dy] = DXY[d], nx = simPos.B.x + dx, ny = simPos.B.y + dy;
        if (nx >= 0 && nx < 5 && ny >= 0 && ny < 5 && !usedAtkDirs.B.has(d)) opts.push(d);
      }
      if (usedAtk.B < 1) opts.push({ type: 'attack', dirs: [] });
      if (usedShield.B < 1) opts.push('shield');
      const choice = opts[Math.floor(Math.random() * opts.length)];
      plans.B.push(choice);
      if (typeof choice === 'string') {
        if (choice === 'shield') usedShield.B++;
        else {
          usedMove.B.add(choice);
          simPos.B.x += DXY[choice][0]; simPos.B.y += DXY[choice][1];
        }
      } else usedAtk.B++;
    }
  }

  function updateUI() {
    const P = phase === 'planA' ? 'A' : 'B';
    phaseEl.textContent =
      `Раунд ${round}/${MAX_R}, ${P}: ` +
      (phase === 'execute' ? 'ход' : 'план') +
      ` ${phase === 'execute' ? step : plans[P].length}/${STEPS}`;
    pcs.forEach((pc, i) => {
      const a = plans[P][i];
      pc.textContent = a
        ? typeof a === 'object' ? '⚔'
          : a === 'shield' ? '🛡'
          : { up: '↑', down: '↓', left: '←', right: '→' }[a]
        : '';
    });
    acts.forEach(b => {
      const a = b.dataset.act;
      b.disabled = false; b.classList.remove('blocked');
      if (DXY[a] && usedAtkDirs[P].has(a)) {
        b.disabled = true; b.classList.add('blocked');
      }
      if (a === 'attack' && usedAtk[P] >= 1) b.disabled = true;
      if (a === 'shield' && usedShield[P] >= 1) b.disabled = true;
    });
    if (single && phase === 'planA') {
      btnNext.disabled = (plans[P].length === 0);
    } else {
      btnNext.disabled = (plans[P].length < STEPS && phase !== 'execute');
    }
    btnDel.style.visibility = phase.startsWith('plan') ? 'visible' : 'hidden';
    document.querySelectorAll('.cell').forEach(c => {
      const x = +c.id[1], y = +c.id[2];
      if (round === 4 && phase.startsWith('plan') && (x === 0 || x === 4 || y === 0 || y === 4)) {
        c.classList.add('dying-cell');
      } else c.classList.remove('dying-cell');
    });
  }

  function drawPlan(P) {
    clearPlan();
    if (phase === 'execute') return;
    let { x, y } = units[P];
    plans[P].forEach(r => {
      if (typeof r === 'string' && DXY[r]) {
        x += DXY[r][0]; y += DXY[r][1];
      }
      x = Math.max(0, Math.min(4, x)); y = Math.max(0, Math.min(4, y));
      const cell = document.getElementById(`c${x}${y}`);
      let ov = document.createElement('div');
      if (typeof r === 'object') {
        ov.className = 'planAttack'; ov.textContent = '•'; cell.append(ov);
        r.dirs.forEach(d => {
          const [dx, dy] = DXY[d], nx = x + dx, ny = y + dy;
          if (nx < 0 || nx > 4 || ny < 0 || ny > 4) return;
          const c2 = document.getElementById(`c${nx}${ny}`), ov2 = document.createElement('div');
          ov2.className = 'planAttack';
          ov2.textContent = { up: '↑', down: '↓', left: '←', right: '→' }[d];
          c2.append(ov2);
        });
      } else if (r === 'shield') {
        ov.className = 'planShield'; cell.append(ov);
      } else {
        ov.className = 'planMove';
        ov.textContent = { up: '↑', down: '↓', left: '←', right: '→' }[r];
        cell.append(ov);
      }
    });
  }

  function clearPlan() {
    document.querySelectorAll('.planMove,.planAttack,.planShield').forEach(e => e.remove());
  }

  function execStep() {
    clearPlan();
    document.querySelectorAll('.attack,.shield').forEach(e => e.remove());
    const [aA, aB] = [plans.A[step - 1], plans.B[step - 1]];
    ['A', 'B'].forEach(pl => {
      const r = pl === 'A' ? aA : aB;
      if (typeof r === 'string' && DXY[r]) {
        units[pl].x = Math.max(0, Math.min(4, units[pl].x + DXY[r][0]));
        units[pl].y = Math.max(0, Math.min(4, units[pl].y + DXY[r][1]));
      }
    });
    render();
    ['A', 'B'].forEach(pl => {
      const r = pl === 'A' ? aA : aB, other = pl === 'A' ? 'B' : 'A';
      if (typeof r === 'object') {
        const u = units[pl], tx = u.x, ty = u.y;
        const sh = plans[other][step - 1] === 'shield';
        const cellS = document.getElementById(`c${tx}${ty}`), ovS = document.createElement('div');
        ovS.className = 'attack'; cellS.append(ovS);
        if (!sh && units[other].x === tx && units[other].y === ty) units[other].alive = false;
        r.dirs.forEach(d => {
          const [dx, dy] = DXY[d], nx = tx + dx, ny = ty + dy;
          if (nx < 0 || nx > 4 || ny < 0 || ny > 4) return;
          const cell2 = document.getElementById(`c${nx}${ny}`), ov2 = document.createElement('div');
          ov2.className = 'attack'; cell2.append(ov2);
          if (!sh && units[other].x === nx && units[other].y === ny) units[other].alive = false;
        });
      }
    });
    ['A', 'B'].forEach(pl => {
      const r = pl === 'A' ? aA : aB;
      if (r === 'shield') {
        const u = units[pl], ov = document.createElement('div');
        ov.className = 'shield'; document.getElementById(`c${u.x}${u.y}`).append(ov);
      }
    });
    render();

    let sim = false, win = null;
    if (!units.A.alive && !units.B.alive) sim = true;
    else if (units.A.alive && !units.B.alive) win = 'A';
    else if (!units.A.alive && units.B.alive) win = 'B';
    else if (step > STEPS && round >= MAX_R) win = 'DRAW';

    if (sim || win) {
      const txt = sim ? 'Смерть с обеих сторон: ничья.' :
        win === 'DRAW' ? 'Изнурённые — ничья.' : `Игрок ${win} победил!`;
      showResult(txt); return;
    }

    step++;
    if (step > STEPS) {
      round++;
      if (round > MAX_R) { showResult('Изнурённые — ничья.'); return; }
      phase = 'planA'; step = 1;
      plans = { A: [], B: [] };
      usedMove = { A: new Set(), B: new Set() };
      usedAtkDirs = { A: new Set(), B: new Set() };
      usedAtk = { A: 0, B: 0 }; usedShield = { A: 0, B: 0 };
      simPos = { A: { x: units.A.x, y: units.A.y }, B: { x: units.B.x, y: units.B.y } };
      btnNext.textContent = '▶ Далее';
    }
    updateUI();
  }

  function render() {
    document.querySelectorAll('.playerA,.playerB,.playerHalf').forEach(e => e.remove());
    if (units.A.alive && units.B.alive && units.A.x === units.B.x && units.A.y === units.B.y) {
      const cell = document.getElementById(`c${units.A.x}${units.A.y}`);
      ['halfA', 'halfB'].forEach(cls => {
        const h = document.createElement('div'); h.className = 'playerHalf ' + cls;
        cell.append(h);
      });
    } else {
      ['A', 'B'].forEach(pl => {
        const u = units[pl]; if (!u.alive) return;
        const cell = document.getElementById(`c${u.x}${u.y}`);
        const p = document.createElement('div'); p.className = pl === 'A' ? 'playerA' : 'playerB';
        cell.append(p);
      });
    }
  }

  function showResult(text) {
    const ov = document.createElement('div'); ov.id = 'resultOverlay';
    ov.innerHTML = `<div>${text}</div><button id="resOk">Ок</button>`;
    document.body.append(ov);
    document.getElementById('resOk').onclick = () => { ov.remove(); resetGame(); };
  }

  function resetGame() {
    round = 1; step = 1; phase = 'planA';
    plans = { A: [], B: [] };
    usedMove = { A: new Set(), B: new Set() };
    usedAtkDirs = { A: new Set(), B: new Set() };
    usedAtk = { A: 0, B: 0 }; usedShield = { A: 0, B: 0 };
    simPos = { A: { x: 0, y: 2 }, B: { x: 4, y: 2 } };
    units = { A: { x: 0, y: 2, alive: true }, B: { x: 4, y: 2, alive: true } };
    clearPlan();
    document.querySelectorAll('.attack,.shield').forEach(e => e.remove());
    render(); btnNext.textContent = '▶ Далее'; updateUI();
  }

  function clearPlan() {
    document.querySelectorAll('.planMove,.planAttack,.planShield').forEach(e => e.remove());
  }
})();
