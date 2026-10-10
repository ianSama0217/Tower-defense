(function(root){
  'use strict';
  const TD=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.TD;
  const INTERMISSION_SECONDS=15;
  const ARROW_RAIN_SECONDS=30,ARROW_RAIN_DAMAGE=200;
  const SHIELD_GRACE_SECONDS=1,SHIELD_PUSH_SECONDS=3;
  function fireArrowRain(game){
    if(game.arrowRainFired)return false;
    game.arrowRainFired=true;game.arrowRain={startedAt:game.time};
    for(const enemy of [...game.enemies])if(enemy.hp>0)game.damageEnemy(enemy,ARROW_RAIN_DAMAGE);
    game.enemies=game.enemies.filter(enemy=>enemy.hp>0);
    return true;
  }
  function updateArrowRainClock(game){
    if(game.phase!=='playing'||game.awaitingWave||game.arrowRainFired)return;
    // Wait for actual entry, including queued reinforcements and blocked entrances.
    if(game.arrowRainStartedAt==null){
      if(game.lastEnemySpawnAt==null||game.spawnQueue.length||game.pendingSpawns.length)return;
      game.arrowRainStartedAt=game.lastEnemySpawnAt;
    }
    game.battleTime=Math.min(ARROW_RAIN_SECONDS,Math.max(0,game.time-game.arrowRainStartedAt));
    if(game.battleTime>=ARROW_RAIN_SECONDS-1e-9){game.battleTime=ARROW_RAIN_SECONDS;fireArrowRain(game);}
  }
  class TimedWaveGame extends TD.Game {
    reset(level=this.level){super.reset(level);this.intermissionRemaining=null;this.battleTime=0;this.arrowRainStartedAt=null;this.arrowRainFired=false;this.arrowRain=null;this.shieldSoldiers=[];this.lineGraceUntil=0;}
    get canStartWave(){return this.phase==='playing'&&this.awaitingWave&&this.wave===0;}
    startNextWave(){return this.canStartWave?this.launchWave():false;}
    launchWave(){const started=super.startNextWave();if(started){this.intermissionRemaining=null;this.battleTime=0;this.arrowRainStartedAt=null;this.lastEnemySpawnAt=null;this.arrowRainFired=false;this.arrowRain=null;}return started;}
    fireArrowRain(){return fireArrowRain(this);}
    resolveEnemyExit(enemy){
      enemy.hp=0;enemy.escaped=true;
      if(this.time>=this.lineGraceUntil-1e-9){
        this.lives=Math.max(0,this.lives-1);this.lineGraceUntil=this.time+SHIELD_GRACE_SECONDS;
        this.effects.push({x:enemy.x,y:enemy.y,life:.5,kind:'escape'});
      }
      if(this.lives===0)return;
      const route=this.level.routes[enemy.routeIndex],exit=route.path.at(-1),distance=this.level.mapConfig.width/3;
      const targets=[];
      for(const target of this.enemies){
        if(target.hp<=0||target.escaped||target.shieldPushRemaining>0||target.offRoute)continue;
        const targetRoute=this.level.routes[target.routeIndex],targetExit=targetRoute.path.at(-1);
        if(target.distance>=targetRoute.length||Math.hypot(targetExit.x-exit.x,targetExit.y-exit.y)>1e-7||targetRoute.length-target.distance>distance)continue;
        target.shieldPushRemaining=SHIELD_PUSH_SECONDS;target.targetId=null;target.pendingShot=null;target.offRoute=false;
        targets.push(target);
      }
      if(!targets.length)return;
      let soldiers=this.shieldSoldiers.filter(unit=>Math.hypot(unit.exit.x-exit.x,unit.exit.y-exit.y)<1e-7);
      if(!soldiers.length){
        soldiers=[-1,1].map(row=>({exit,routeIndex:enemy.routeIndex,targets:[],rowOffset:row*this.level.mapConfig.roadWidth/4,x:enemy.x,y:enemy.y,facing:enemy.facing===1?-1:1,startedAt:this.time}));
        this.shieldSoldiers.push(...soldiers);
      }
      for(const soldier of soldiers)soldier.targets.push(...targets);
    }
    moveEnemy(enemy,dt){
      if(!(enemy.shieldPushRemaining>0)){super.moveEnemy(enemy,dt);return;}
      const step=Math.min(dt,enemy.shieldPushRemaining),route=this.level.routes[enemy.routeIndex],oldX=enemy.x,oldY=enemy.y;
      enemy.shieldPushRemaining=Math.max(0,enemy.shieldPushRemaining-step);
      if(enemy.shieldPushRemaining<1e-9)enemy.shieldPushRemaining=0;
      enemy.distance=Math.max(0,enemy.distance-this.level.mapConfig.width/3/SHIELD_PUSH_SECONDS*step);
      Object.assign(enemy,TD.position(enemy.distance,route));enemy.remaining=route.length-enemy.distance;
      enemy.moving=enemy.x!==oldX||enemy.y!==oldY;enemy.offRoute=false;enemy.targetId=null;enemy.pendingShot=null;
      if(enemy.x!==oldX)enemy.facing=enemy.x>oldX?1:-1;
      if(dt>step)super.moveEnemy(enemy,dt-step);
    }
    update(dt){
      if(dt<=0)return;
      if(this.phase!=='playing'){super.update(dt);this.shieldSoldiers=[];return;}
      if(this.awaitingWave&&this.wave>0){
        const step=Math.min(dt,this.intermissionRemaining??INTERMISSION_SECONDS);
        super.update(step);
        this.intermissionRemaining=Math.max(0,(this.intermissionRemaining??INTERMISSION_SECONDS)-step);
        if(this.intermissionRemaining<=1e-9){this.launchWave();if(dt>step)this.update(dt-step);}
      }else{
        const fighting=!this.awaitingWave;
        const step=fighting&&this.arrowRainStartedAt!=null&&!this.arrowRainFired?Math.min(dt,Math.max(0,ARROW_RAIN_SECONDS-this.battleTime)):dt;
        super.update(step);
        if(fighting)updateArrowRainClock(this);
        if(fighting&&this.awaitingWave&&this.phase==='playing')this.intermissionRemaining=INTERMISSION_SECONDS;
        if(dt>step&&this.phase==='playing')this.update(dt-step);
      }
      this.shieldSoldiers=this.shieldSoldiers.filter(unit=>{
        unit.targets=unit.targets.filter(enemy=>enemy.hp>0&&enemy.shieldPushRemaining>0);
        if(!unit.targets.length)return false;
        const enemy=unit.targets.reduce((a,b)=>a.remaining<b.remaining?a:b),route=this.level.routes[enemy.routeIndex];
        const point=TD.position(Math.min(route.length,enemy.distance+28*this.worldScale),route);
        unit.x=point.x;unit.y=point.y+unit.rowOffset;unit.facing=enemy.facing;return true;
      });
    }
  }
  const api={TimedWaveGame,INTERMISSION_SECONDS,ARROW_RAIN_SECONDS,ARROW_RAIN_DAMAGE,SHIELD_GRACE_SECONDS,SHIELD_PUSH_SECONDS,fireArrowRain,updateArrowRainClock};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TimedWaves=api;
})(typeof globalThis!=='undefined'?globalThis:this);
