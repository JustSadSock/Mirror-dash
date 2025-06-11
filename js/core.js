/* Mirror Runner v0.3 — отражённая геометрия, двойной-тап, live-slide
   ────────────────────────────────────────────────────────────────── */

(() => {
  // === DOM & Canvas ───────────────────────────────────────────────
  const canvas  = document.getElementById('gameCanvas');
  const ctx     = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');

  // высоты дорожек объявляем до первой resize
  let laneH, groundTop, groundBot;      // groundTop ~ потолок (10% от края)

  const resize = () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    laneH      = canvas.height / 2;
    groundTop  = laneH * 0.10;          // бегун «на потолке»
    groundBot  = canvas.height - laneH * 0.10; // нижняя земля
  };
  window.addEventListener('resize', resize);
  resize();

  // === Константы ──────────────────────────────────────────────────
  const GRAVITY    = 0.002;     // px/ms²
  const JUMP_VEL   = -0.7;
  const SLIDE_TIME = 350;       // мс
  const SPEED_BASE = 0.25;      // px/ms
  const SPAWN_BASE = 1200;      // мс
  const DIFF_GROW  = 0.00005;   // уменьшение интервала спавна
  const TAP_HOLD   = 180;       // мс — порог «долгий тап» для подката
  const DOUBLE_MAX = 220;       // мс — окно для двойного тапа

  // === Классы ─────────────────────────────────────────────────────
  class Runner {
    constructor(lane) {
      this.lane = lane;               // 0 = верх, 1 = низ
      this.w = 40;
      this.hFull = 60;
      this.hSlide = 30;

      this.x   = canvas.width * 0.18;
      this.vy  = 0;
      this.isSliding = false;
      this.slideTimer = 0;
      this.canDouble = false;         // доступен ли двойной прыжок

      this.h = this.hFull;
      this.y = this.groundY() - this.h;
    }
    groundY() { return this.lane === 0 ? groundTop : groundBot - this.h; }

    jump(force = false) {
      if (this.isSliding) return;
      if (this.onGround() || (this.canDouble && !force)) {
        this.vy = JUMP_VEL;
        if (!this.onGround()) this.canDouble = false; // израсходовали
      }
    }
    enableDouble() { this.canDouble = true; }

    slideStart() {
      if (this.onGround() && !this.isSliding) {
        this.isSliding = true;
        this.slideTimer = SLIDE_TIME;
        this.h = this.hSlide;
        // для верхнего lane смещаем y к потолку, для нижнего — вниз
        this.y = this.groundY();
      }
    }
    update(dt) {
      if (this.isSliding) {
        this.slideTimer -= dt;
        if (this.slideTimer <= 0) {
          this.isSliding = false;
          this.h = this.hFull;
          this.y = this.groundY();
        }
      } else {
        this.vy += GRAVITY * dt;
        this.y  += this.vy * dt;
        // потолочный или наземный контакт
        const gY = this.groundY();
        if ((this.lane === 1 && this.y > gY) || (this.lane === 0 && this.y < gY)) {
          this.y = gY;
          this.vy = 0;
          this.enableDouble();
        }
      }
    }
    onGround() { return this.vy === 0; }

    draw() {
      ctx.fillStyle = this.lane === 0 ? '#2ecc71' : '#3498db';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
    reset() {
      this.isSliding = false;
      this.h = this.hFull;
      this.y = this.groundY();
      this.vy = 0;
      this.canDouble = false;
    }
  }

  // ----------------------------------------------------------------
  class Obstacle {
    constructor(lane, type) {
      this.lane = lane;                 // 0/1
      this.type = type;                 // 'low', 'high', 'step'
      // параметры
      switch (type) {
        case 'low':  this.w = 30; this.h = 40; break;
        case 'high': this.w = 30; this.h = 80; break;
        case 'step': this.w = 80; this.h = 20; break;
      }
      this.x = canvas.width + this.w;

      if (type === 'step' && lane === 0) {      // «ступенька» к потолку
        this.y = groundTop + 60;                // чуть ниже потолка
      } else if (type === 'step') {             // нижняя
        this.y = groundBot - this.h - 60;
      } else {
        this.y = (lane === 0 ? groundTop : groundBot - this.h);
      }
    }
    update(dt) { this.x -= SPEED_BASE * dt; }
    off()       { return this.x + this.w < 0; }
    draw() {
      ctx.fillStyle = this.type === 'step' ? '#f1c40f' : '#e74c3c';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
  }

  // === Состояние игры ─────────────────────────────────────────────
  const runners   = [new Runner(0), new Runner(1)];
  const obstacles = [];

  let spawnTimer  = SPAWN_BASE;
  let elapsed     = 0;
  let score       = 0;

  // === Инпут: тап, долгий тап, двойной тап ────────────────────────
  let touchStart     = 0;
  let longTapFired   = false;
  let lastTap        = 0;
  let touchActive    = false;

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touchActive   = true;
    longTapFired  = false;
    touchStart    = performance.now();

    // double-tap detection
    const now = touchStart;
    if (now - lastTap < DOUBLE_MAX) {
      runners.forEach(r => r.jump(true));   // force = используем двойной прыжок
    }
    lastTap = now;
  });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    touchActive = false;
    const dt = performance.now() - touchStart;
    if (dt < TAP_HOLD && !longTapFired) {      // короткий тап
      runners.forEach(r => r.jump());
    }
  });

  // ПК-отладка
  window.addEventListener('keydown', e => {
    if (e.code === 'Space')  runners.forEach(r => r.jump());
    if (e.code === 'ArrowDown') runners.forEach(r => r.slideStart());
    if (e.code === 'ShiftLeft')  runners.forEach(r => r.jump(true)); // имитация double
  });

  // === Игровой цикл ───────────────────────────────────────────────
  let last = performance.now();
  requestAnimationFrame(loop);

  function loop(now) {
    const dt = now - last;
    last = now;

    if (touchActive) {                                  // счётчик долгого тапа
      const held = now - touchStart;
      if (held >= TAP_HOLD && !longTapFired) {
        longTapFired = true;
        runners.forEach(r => r.slideStart());
      }
    }

    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ----------------------------------------------------------------
  function update(dt) {
    // генерация препятствий
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      const min = 600;
      spawnTimer = Math.max(min, SPAWN_BASE - elapsed * DIFF_GROW) *
                   (0.7 + Math.random()*0.6);
    }
    elapsed += dt;

    runners.forEach(r => r.update(dt));
    obstacles.forEach(o => o.update(dt));

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      if (o.off()) obstacles.splice(i, 1);
      else if (hit(runners[o.lane], o)) gameOver();
    }

    score += dt * 0.01;
    scoreEl.textContent = Math.floor(score);
  }

  function spawnObstacle() {
    const types = ['low', 'high', 'step'];
    const type  = types[Math.floor(Math.random()*types.length)];
    const lane  = Math.random() < 0.5 ? 0 : 1;
    obstacles.push(new Obstacle(lane, type));
  }

  function hit(r, o) {
    return r.x < o.x + o.w && r.x + r.w > o.x &&
           ((r.lane === 0 && r.y < o.y + o.h) ||
            (r.lane === 1 && r.y + r.h > o.y));
  }

  function gameOver() {
    obstacles.length = 0;
    score = 0; elapsed = 0; spawnTimer = SPAWN_BASE;
    runners.forEach(r => r.reset());
  }

  // ----------------------------------------------------------------
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // верхняя и нижняя зоны
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, laneH - 3);
    ctx.fillRect(0, laneH + 3, canvas.width, laneH - 3);

    // линии «земля/потолок»
    ctx.fillStyle = '#555';
    ctx.fillRect(0, groundTop + 3, canvas.width, 3);      // потолок условный
    ctx.fillRect(0, groundBot - 3, canvas.width, 3);      // земля

    obstacles.forEach(o => o.draw());
    runners.forEach(r => r.draw());
  }
})();