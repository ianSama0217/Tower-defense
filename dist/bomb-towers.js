(function(root){
 'use strict';
 const TD=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.TD;
 // Compose the same projectile rules with either the sandbox or campaign clocks.
 const COMMON={minRange:45,range:125,blastRadius:45,windup:.3,flightTime:.65};
 const specs=[null,...[[100,25,2.4,80],[150,40,2.2,90],[200,60,2,130]].map(([hp,damage,interval,cost])=>({...COMMON,hp,damage,interval,cost}))];
 function ranges(level,scale=1){const s=specs[level];return {min:s.minRange*scale,max:s.range*scale,blast:s.blastRadius*scale};}
 function canTarget(tower,enemy,scale=1){if(!enemy||enemy.hp<=0||enemy.escaped||enemy.deathAt!=null)return false;const r=ranges(tower.level,scale),distance=Math.hypot(enemy.x-tower.x,enemy.y-tower.y);return distance>=r.min-1e-7&&distance<=r.max+1e-7;}
 const withBombTowers=Base=>class extends Base{
  towerSpecs(slot){return slot?.kind==='bomb'?specs:super.towerSpecs(slot);}
  reset(scenario=this.level){super.reset(scenario);this.bombs=[];this.bombFireEnabled=true;}
  hasFriendlyProjectiles(){return this.bombs.length>0||super.hasFriendlyProjectiles();}
  detonate(bomb){
   this.effects.push({kind:'tower-bomb-explosion',x:bomb.toX,y:bomb.toY,radius:bomb.radius,life:.65,duration:.65});this.sound?.playExplosion();
   const center={x:bomb.toX,y:bomb.toY};
   for(const enemy of [...this.enemies])if(Math.hypot(enemy.x-center.x,enemy.y-center.y)<=bomb.radius+1e-7)this.damageEnemy(enemy,bomb.damage,bomb.sourceTowerId);
  }
  fireTowers(dt){
   super.fireTowers(dt);
   this.bombs=this.bombs.filter(bomb=>{if(this.time-bomb.launchedAt+1e-9<bomb.duration)return true;this.detonate(bomb);return false;});
   for(const s of this.slots){
    if(s.kind!=='bomb')continue;
    if(!s.level||s.hp<=0||s.action||!this.bombFireEnabled){s.pendingBomb=null;s.throwAt=null;continue;}
    const spec=specs[s.level];s.cooldown=Math.max(0,(s.cooldown||0)-dt);
    if(s.pendingBomb){
     const pending=s.pendingBomb;
     if(!canTarget(s,pending.target,this.worldScale)||s.towerId!==pending.towerId){s.pendingBomb=null;s.throwAt=null;}
     else if(this.time+1e-9>=pending.releaseAt){
      const r=ranges(s.level,this.worldScale),target=pending.target;
      this.bombs.push({fromX:s.x,fromY:s.y,toX:target.x,toY:target.y,launchedAt:this.time,duration:spec.flightTime,radius:r.blast,damage:spec.damage,sourceTowerId:s.towerId,sourceLevel:s.level,sourceScale:s.visualScale??this.worldScale});
      s.pendingBomb=null;
     }
    }
    if(s.pendingBomb||s.cooldown>0)continue;
    let target=null;
    for(const e of this.enemies)if(canTarget(s,e,this.worldScale)&&(!target||(e.remaining??Infinity)<(target.remaining??Infinity)))target=e;
    if(!target)continue;
    s.bombFacing=target.x>=s.x?1:-1;s.throwAt=this.time;s.cooldown=spec.interval;
    s.pendingBomb={target,towerId:s.towerId,releaseAt:this.time+spec.windup};
   }
  }
 };
 const BombTowerGame=withBombTowers(TD.Game);
 const api={specs,ranges,canTarget,BombTowerGame,withBombTowers};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BombTowers=api;
})(typeof globalThis!=='undefined'?globalThis:this);
