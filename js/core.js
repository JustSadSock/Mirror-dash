/* Mirror Runner – минимальный рабочий прототип
   Два героя бегут синхронно (верхняя/нижняя дорожка), управление одним тапом.
   • Короткий тап  < 180 мс  → прыжок
   • Долгий тап   ≥ 180 мс  → подкат
   Код ~300 строк: без ассетов, без сборщиков.
*/

(() => {
  // === DOM & Canvas =========================================================
  const canvas  = document.getElementById('gameCanvas');
  const ctx     = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');

  // переменные высоты дорожек объявляем ПЕРЕД resize, чтобы не было ReferenceError
  let laneH, groundYTop, groundYBottom;

  const resize = () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    laneH         = canvas.height / 2;
    groundYTop    = laneH * 0.82;
    groundYBottom = canvas.height * 0.82;
  };
  window.addEventListener('resize', resize);
  resize();

  // === Константы ============================================================
  const GRAVITY    = 0.0020;   // px / ms²
  const JUMP_VEL   = -0.7;     // первая скорость прыжка
  const SLIDE_TIME = 350;      // мс
  const SPEED      = 0.25;     // прокрутка уровня (px/ms)
  const SPAWN_BASE = 1200;     // стартовый интервал спавна       (мс)
  const DIFF_GROW  = 0.00006;  // ускорение сложности             (мс⁻¹)

  // === Классы ===============================================================

  class Runner {
    constructor(lane /*0|1*/) {
      this.lane = lane;
      this.w = 40;
      this.hFull = 60;
      this.hSlide = 30;

      this.x   = canvas.width * 0.15;
      this.vy  = 0;
      this.isSliding = false;
      this.slideTimer = 0;

      this.h = this.hFull;
      this.y = this.groundY() - this.h;
    }
    groundY() { return this.lane === 0 ? groundYTop : groundYBottom; }

    onGround() { return this.y >= this.groundY() - this.h - 0.5; }

    jump() {
      if (this.isSliding) return;
      if (this.onGround()) this.vy = JUMP_VEL;
    }
    slide() {
      if (this.onGround() && !this.isSliding) {
        this.isSliding = true;
        this.slideTimer = SLIDE_TIME;
        this.h = this.hSlide;
        this.y = this.groundY() - this.h;
      }
    }
    update(dt) {
      if (this.isSliding) {
        this.slideTimer -= dt;
        if (this.slideTimer <= 0) {
          this.isSliding = false;
          this.h = this.hFull;
          this.y = this.groundY() - this.h;
        }
      } else {
        this.vy += GRAVITY * dt;
        this.y  += this.vy * dt;
        if (this.y > this.groundY() - this.h) {
          this.y = this.groundY() - this.h;
          this.vy = 0;
        }
      }
    }
    draw() {
      ctx.fillStyle = this.lane === 0 ? '#2ecc71' : '#3498db';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
    reset() {
      this.isSliding = false;
      this.h = this.hFull;
      this.y = this.groundY() - this.h;
      this.vy = 0;
    }
  }

  // -------------------------------------------------------------------------

  class Obstacle {
    constructor(lane, w, h) {
      this.lane = lane;
      this.w = w;
      this.h = h;
      this.x = canvas.width + w;
      this.y = (lane === 0 ? groundYTop : groundYBottom) - h;
    }
    update(dt) { this.x -= SPEED * dt; }
    off()       { return this.x + this.w < 0; }
    draw() {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
  }

  // === Состояние игры =======================================================
  const runners   = [new Runner(0), new Runner(1)];
  const obstacles = [];

  let spawnTimer  = SPAWN_BASE;
  let elapsed     = 0;
  let score       = 0;

  // === Инпут ================================================================
  let touchStart = 0;

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touchStart = performance.now();
  });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const delta = performance.now() - touchStart;
    if (delta < 180) runners.forEach(r => r.jump());
    else             runners.forEach(r => r.slide());
  });

  // ПК-отладка: Space — прыжок, Ctrl — slide
  window.addEventListener('keydown', e => {
    if (e.code === 'Space')        runners.forEach(r => r.jump());
    if (e.code === 'ControlLeft')  runners.forEach(r => r.slide());
  });

  // === Игровой цикл =========================================================
  let last = performance.now();
  requestAnimationFrame(loop);

  function loop(now) {
    const dt = now - last;
    last = now;

    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // -------------------------------------------------------------------------
  function update(dt) {
    // динамический спавн препятствий
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      const min = 600;
      const newInterval = Math.max(min, SPAWN_BASE - elapsed * DIFF_GROW);
      spawnTimer = newInterval * (0.7 + Math.random()*0.6);
    }

    elapsed += dt;

    runners.forEach(r => r.update(dt));
    obstacles.forEach(o => o.update(dt));

    // проверяем коллизии + удаляем вышедшие
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      if (o.off()) obstacles.splice(i, 1);
      else if (collision(runners[o.lane], o)) gameOver();
    }

    score += dt * 0.01;
    scoreEl.textContent = Math.floor(score);
  }

  function spawnObstacle() {
    const h = 40 + Math.random()*20;
    const w = 20 + Math.random()*30;
    const lane = Math.random() < 0.5 ? 0 : 1;
    obstacles.push(new Obstacle(lane, w, h));
  }

  function collision(r, o) {
    return r.x < o.x + o.w &&
           r.x + r.w > o.x &&
           r.y < o.y + o.h &&
           r.y + r.h > o.y;
  }

  function gameOver() {
    obstacles.length = 0;
    score = 0;
    elapsed = 0;
    spawnTimer = SPAWN_BASE;
    runners.forEach(r => r.reset());
    // тут можно триггерить звук "fail" или flash-эффект
  }

  // -------------------------------------------------------------------------
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // фон-полосы
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, laneH - 3);
    ctx.fillRect(0, laneH + 3, canvas.width, laneH - 3);

    // «земля»
    ctx.fillStyle = '#555';
    ctx.fillRect(0, groundYTop, canvas.width, 3);
    ctx.fillRect(0, groundYBottom, canvas.width, 3);

    obstacles.forEach(o => o.draw());
    runners.forEach(r => r.draw());
  }
})();