/* Mirror Runner v0.5 — зеркало-физика, Game-Over overlay,
   двойной прыжок, лайв-слайд и скруглённые фигурки            */
(() => {
  // === DOM --------------------------------------------------------------
  const cvs      = document.getElementById('gameCanvas');
  const ctx      = cvs.getContext('2d');
  const scoreDom = document.getElementById('score');
  const overlay  = document.getElementById('overlay');
  const restartB = document.getElementById('restartBtn');
  const finalDom = document.getElementById('finalScore');

  // === Geometry & resize -------------------------------------------------
  let laneH, topY, botY;                    // topY — «потолок», botY — «земля»
  function resize(){
    cvs.width  = window.innerWidth;
    cvs.height = window.innerHeight;
    laneH = cvs.height/2;
    topY  = laneH*0.10;                     // чуть ниже абсолютного 0
    botY  = cvs.height - laneH*0.10;
  }
  addEventListener('resize', resize); resize();

  // === Consts ------------------------------------------------------------
  const G        = 0.002;                   // базовая «сила тяжести»
  const JUMP_V   = 0.7;                     // модуль скорости прыжка
  const SLIDE_MS = 350;
  const SPEED    = 0.25;                    // прокрутка уровня
  const SPAWN0   = 1200;
  const SPAWN_DEC= 0.00005;
  const TAP_HOLD = 180;
  const DBL_MAX  = 220;

  // === Utils -------------------------------------------------------------
  const rand = (a,b)=>a+Math.random()*(b-a);
  function roundRect(x,y,w,h,r){            // скруглённый прямоуг.
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
  }

  // === Runner ------------------------------------------------------------
  class Runner{
    constructor(lane){                      // 0 — верх, 1 — низ
      this.lane = lane;
      this.dir  = lane===0? -1 : 1;         // направление «тяжести»
      this.w=40; this.hFull=60; this.hSlide=30;
      this.x = cvs.width*0.18;
      this.reset();
    }
    floor(){ return this.lane? botY : topY-this.h; }
    reset(){
      this.h=this.hFull; this.vy=0; this.isSlide=0; this.slideT=0;
      this.y=this.floor(); this.canDbl=false;
    }
    jump(forceDbl=false){
      if(this.isSlide) return;
      if(this.onFloor()|| (this.canDbl&&!forceDbl)){
        this.vy = -this.dir*JUMP_V;
        if(!this.onFloor()) this.canDbl=false;
      }
    }
    startSlide(){ if(this.onFloor()&&!this.isSlide){
        this.isSlide=1; this.slideT=SLIDE_MS;
        this.h=this.hSlide; this.y=this.floor();
      }}
    onFloor(){ return this.dir===1? this.y>=this.floor()-0.5
                                  : this.y<=this.floor()+0.5 }
    update(dt){
      if(this.isSlide){
        this.slideT-=dt;
        if(this.slideT<=0){ this.isSlide=0; this.h=this.hFull; this.y=this.floor(); }
      }else{
        this.vy += this.dir*G*dt;
        this.y  += this.vy*dt;
        if(this.dir===1 && this.y>this.floor()){ this.y=this.floor(); this.vy=0; this.canDbl=true; }
        if(this.dir===-1&& this.y<this.floor()){ this.y=this.floor(); this.vy=0; this.canDbl=true; }
      }
    }
    draw(){
      ctx.fillStyle = this.lane? '#3498db':'#2ecc71';
      roundRect(this.x,this.y,this.w,this.h,6); ctx.fill();
      // декоративный «глаз»
      ctx.fillStyle='#000'; ctx.beginPath();
      ctx.arc(this.x+this.w*0.7,this.y+this.h*0.3,4,0,Math.PI*2); ctx.fill();
    }
  }

  // === Obstacles ----------------------------------------------------------
  class Ob{
    constructor(lane,type){
      this.lane=lane; this.type=type;
      switch(type){
        case'low': this.w=30; this.h=40; break;
        case'high':this.w=30; this.h=80; break;
        case'step':this.w=80; this.h=20; break;
      }
      this.dir=lane?1:-1;
      this.x=cvs.width+this.w;
      if(type==='step'){
        const off=60;
        this.y=lane? (botY-this.h-off) : (topY+off);
      }else{
        this.y=lane? botY-this.h : topY;
      }
    }
    update(dt){ this.x-=SPEED*dt; }
    off(){ return this.x+this.w<0; }
    draw(){
      ctx.fillStyle = this.type==='step'? '#f1c40f' : '#e74c3c';
      roundRect(this.x,this.y,this.w,this.h,5); ctx.fill();
    }
  }

  // === State --------------------------------------------------------------
  const runners=[new Runner(0),new Runner(1)];
  const obs=[];
  let spawnT=SPAWN0,elapsed=0,score=0,alive=true;

  // === Input (tap / hold / double) ----------------------------------------
  let tStart=0,longF=0,lastTap=0,tActive=0;
  cvs.addEventListener('touchstart',e=>{
    e.preventDefault();
    tActive=1; longF=0; tStart=performance.now();
    if(tStart-lastTap<DBL_MAX) runners.forEach(r=>r.jump(true));
    lastTap=tStart;
  });
  cvs.addEventListener('touchend',e=>{
    e.preventDefault(); tActive=0;
    const d=performance.now()-tStart;
    if(d<TAP_HOLD && !longF) runners.forEach(r=>r.jump());
  });

  // === Restart ------------------------------------------------------------
  restartB.onclick = ()=>{ overlay.hidden=true; resetGame(); };

  function resetGame(){
    obs.length=0; spawnT=SPAWN0; elapsed=score=0; alive=true;
    runners.forEach(r=>r.reset()); scoreDom.textContent='0';
  }

  // === Main loop ----------------------------------------------------------
  let last=performance.now(); requestAnimationFrame(loop);
  function loop(now){
    const dt=now-last; last=now;
    if(alive){
      if(tActive){ const held=now-tStart; if(held>=TAP_HOLD&&!longF){ longF=1; runners.forEach(r=>r.startSlide()); } }
      update(dt); render();
    }
    requestAnimationFrame(loop);
  }

  function update(dt){
    spawnT-=dt;
    if(spawnT<=0){
      spawnObstacle();
      spawnT=Math.max(600,SPAWN0-elapsed*SPAWN_DEC)*(0.7+Math.random()*0.6);
    }
    elapsed+=dt;

    runners.forEach(r=>r.update(dt));
    obs.forEach(o=>o.update(dt));
    for(let i=obs.length-1;i>=0;i--){
      const o=obs[i]; if(o.off()) obs.splice(i,1);
      else if(hit(runners[o.lane],o)){ gameOver(); break; }
    }
    score+=dt*0.01; scoreDom.textContent=Math.floor(score);
  }
  function spawnObstacle(){
    const types=['low','high','step'];
    obs.push(new Ob( Math.random()<0.5?0:1, types[Math.random()*types.length|0] ));
  }
  function hit(r,o){
    return r.x < o.x+o.w && r.x+r.w > o.x &&
           ( r.lane ? r.y+r.h > o.y : r.y < o.y+o.h );
  }
  function gameOver(){
    alive=false;
    finalDom.textContent='Score '+Math.floor(score);
    overlay.hidden=false;
  }

  // === Render -------------------------------------------------------------
  function render(){
    ctx.clearRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle='#222';
    ctx.fillRect(0,0,cvs.width,laneH-2);
    ctx.fillRect(0,laneH+2,cvs.width,laneH-2);
    ctx.fillStyle='#555';
    ctx.fillRect(0,topY+this?.h??0,cvs.width,3);
    ctx.fillRect(0,botY-3,cvs.width,3);
    obs.forEach(o=>o.draw());
    runners.forEach(r=>r.draw());
  }
})();