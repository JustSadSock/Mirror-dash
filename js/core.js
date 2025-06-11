/* Mirror Runner — базовый каркас
   Всё в одном файле, чтобы быстро стартовать. */

(() => {
  // === DOM & Canvas ==========================================================
  const canvas  = document.getElementById('gameCanvas');
  const ctx     = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');

  // подгоняем канву под окно
  const resize = () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    laneH = canvas.height / 2;           // высота одного «измерения»
    groundYTop    = laneH * 0.82;        // относительные «земли»
    groundYBottom = canvas.height * 0.82;
  };
  window.addEventListener('resize', resize);
  resize();

  // === Глобальные константы ==================================================
  const GRAVITY      = 0.0020;           // px/ms^2
  const JUMP_VEL     = -0.7;             // начальная скорость прыжка
  const GAME_SPEED   = 0.25;             // скорость прокрутки (px/ms)
  const SLIDE_TIME   = 350;              // длительность подката (мс)
  const SPAWN_BASE   = 1200;             // базовый интервал спавна (мс)
  const DIFF_GROW    = 0.00006;          // на сколько уменьшаем интервал/мс

  let laneH, groundYTop, groundYBottom;

  // ==========================================================================

  class Runner {
    constructor(lane) {
      this.lane = lane;                       // 0 = верх, 1 = низ
      this.w = 40;
      this.h = 60;
      this.x = canvas.width * 0.15;
      this.y = this.groundY() - this.h;
      this.vy = 0;
      this.isSliding = false;
      this.slideTimer = 0;
    }
    groundY() { return this.lane === 0 ? groundYTop : groundYBottom; }

    jump() {
      if (this.isSliding) return;             // во время слайда не прыгаем
      if (this.onGround()) this.vy = JUMP_VEL;
    }
    startSlide() {
      if (this.onGround() && !this.isSliding) {
        this.isSliding = true;
        this.slideTimer = SLIDE_TIME;
        this.h = 30; this.y = this.groundY() - this.h;
      }
    }
    update(dt) {
      if (this.isSliding) {
        this.slideTimer -= dt;
        if (this.slideTimer <= 0) {
          this.isSliding = false;
          this.h = 60; this.y = this.groundY() - this.h;
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
    onGround() { return this.y >= this.groundY() - this.h - 0.5; }

    draw() {
      ctx.fillStyle = this.lane === 0 ? '#2ecc71' : '#3498db';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
  }

  // --------------------------------------------------------------------------

  class Obstacle {
    constructor(lane, width, height) {
      this.lane = lane;       // 0 = верх, 1 = низ
      this.w = width; this.h = height;
      this.x = canvas.width + this.w;
      this.y = (lane === 0 ? groundYTop : groundYBottom) - this.h;
      this.passed = false;
    }
    update(dt) { this.x -= GAME_SPEED * dt; }
    offScreen() { return this.x + this.w < 0; }
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

  // === Инпут ===============================================================
  let touchStartTime = 0;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touchStartTime = performance.now();
  });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const duration = performance.now() - touchStartTime;
    if (duration < 180) runners.forEach(r => r.jump());
    else                runners.forEach(r => r.startSlide());
  });

  // дебаг-клавиши (ПК): Space = jump, Ctrl = slide
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') runners.forEach(r => r.jump());
    if (e.code === 'ControlLeft') runners.forEach(r => r.startSlide());
  });

  // === Главный цикл =========================================================
  let last = performance.now();
  function loop(now) {
    const dt = now - last;           // миллисекунды
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // --------------------------------------------------------------------------
  function update(dt) {
    // сложность растёт: уменьшаем интервал спавна
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      const minInterval = 600;
      const max = Math.max(minInterval, SPAWN_BASE - elapsed * DIFF_GROW);
      spawnTimer = max * (0.7 + Math.random()*0.6);
    }
    elapsed += dt;

    // апдейтим бегунов
    runners.forEach(r => r.update(dt));

    // апдейтим препятствия
    obstacles.forEach(o => o.update(dt));

    // коллизии + удаление вышедших
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      if (o.offScreen()) obstacles.splice(i, 1);
      else checkCollision(o);
    }

    // очки = время выживания (можно позже усложнить)
    score += dt * 0.01;
    scoreEl.textContent = Math.floor(score);
  }

  // --------------------------------------------------------------------------
  function spawnObstacle() {
    // случайная высота и ширина в пределах
    const h = 40 + Math.random()*20;
    const w = 20 + Math.random()*30;
    const lane = Math.random() < 0.5 ? 0 : 1;
    obstacles.push(new Obstacle(lane, w, h));
  }

  // --------------------------------------------------------------------------
  function checkCollision(o) {
    const r = runners[o.lane];
    if (r.x < o.x + o.w &&
        r.x + r.w > o.x &&
        r.y < o.y + o.h &&
        r.y + r.h > o.y) {
      // Game Over: перезапускаем счётчик
      obstacles.length = 0;
      score = 0; elapsed = 0; spawnTimer = SPAWN_BASE;
      r.y = r.groundY() - r.h; r.vy = 0;   // ресет первого
      const other = runners[1 - o.lane];
      other.y = other.groundY() - other.h; other.vy = 0;
    }
  }

  // --------------------------------------------------------------------------
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // фон (два простых прямоугольника — позже заменишь на параллакс)
    ctx.fillStyle = '#222';
    ctx.fillRect(0,            0, canvas.width, laneH - 3);
    ctx.fillRect(0, laneH + 3, canvas.width, laneH - 3);

    // земля-линии
    ctx.fillStyle = '#555';
    ctx.fillRect(0, groundYTop, canvas.width, 3);
    ctx.fillRect(0, groundYBottom, canvas.width, 3);

    // рисуем препятствия и бегунов
    obstacles.forEach(o => o.draw());
    runners.forEach(r => r.draw());
  }
})();