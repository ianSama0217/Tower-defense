(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const TD=node?require('./engine.js'):root.TD;
  const {TimedWaveGame}=node?require('./timed-waves.js'):root.TimedWaves;
  const {withBombTowers}=node?require('./bomb-towers.js'):root.BombTowers;
  const Captain=node?require('./goblin-captain.js'):root.GoblinCaptain;
  const SPAWN_INTERVAL=1.35;
  const FAST_SPAWN_INTERVAL=.8;
  const REINFORCEMENT_DELAYS=[0,3,5,0,0,5];
  const WAVE_BATCHES=[
    [{goblin:5,archer:5}],
    [{goblin:10,archer:5},{bomber:3}],
    [{goblin:10,archer:8},{goblin:8,bomber:4,archer:6}],
    [{goblin:12,bomber:2,archer:8}],
    [{goblin:15,bomber:2,archer:10}],
    [{goblin:10,archer:5},{captain:1,goblin:8,bomber:4,archer:6}]
  ];
  function scenario(){
    const waves=WAVE_BATCHES.map((batches,wave)=>batches.flatMap((counts,batch)=>{
      const interval=[2,5].includes(wave)?FAST_SPAWN_INTERVAL:SPAWN_INTERVAL;
      const units=Object.entries(counts).flatMap(([type,count])=>Array(count).fill(TD.ENEMY_TYPES[type]));
      return units.map((level,index)=>({level,routeIndex:0,delay:index?interval:batch?REINFORCEMENT_DELAYS[wave]:0,
        ...(batch&&index===0?{afterPreviousSpawn:REINFORCEMENT_DELAYS[wave]}:{})}));
    }));
    return {...TD.createScenario({
      // Reference silhouette, with room for full-width fences and tower pads.
      paths:[[[1280,400],[960,400],[960,608],[768,608],[768,144],[448,144],[448,608],[256,608],[256,400],[0,400]]],
      slots:[[160,320],[160,496],[352,400],[352,528],
        [536,240],[536,400],[680,240],[680,400],[864,400],[864,528]],
      worldScale:TD.CAMPAIGN_WORLD_SCALE,initialMoney:150,manualWaves:true,
      spawnInterval:SPAWN_INTERVAL,waveRewards:[30,30,30,30,30,0],waves
    }),stageIndex:4,environment:'cave-mouth',entranceProtectionTiles:2,
      roadBuilding:'fence',bombTowers:true};
  }
  class LevelFiveGame extends withBombTowers(TimedWaveGame) {
    constructor(random=Math.random){super(random,scenario());}
    warcryEffect(enemy){return Captain.effect(enemy,this.enemies,this.time,this.worldScale);}
    enemyHaste(enemy){return this.warcryEffect(enemy)?.haste??1;}
    stopBattle(){
      this.spawnQueue=[];this.pendingSpawns=[];this.bullets=[];this.enemyArrows=[];this.bombs=[];
      this.awaitingWave=false;this.countdown=Infinity;this.intermissionRemaining=null;this.shieldSoldiers=[];
      for(const enemy of this.enemies)enemy.pendingShot=null;
      for(const slot of this.slots)slot.pendingBomb=null;
    }
    killEnemy(enemy,reward=true,sourceTowerId=null){
      if(this.phase!=='playing'||enemy.deathAt!=null||enemy.escaped)return;
      super.killEnemy(enemy,reward,sourceTowerId);
      if(enemy.level===TD.ENEMY_TYPES.captain){this.phase='won';this.stopBattle();}
    }
    damageEnemy(enemy,damage,sourceTowerId=null){
      if(this.phase==='playing')super.damageEnemy(enemy,damage,sourceTowerId);
    }
    damageTower(target,damage){if(this.phase==='playing')super.damageTower(target,damage);}
    resolveEnemyExit(enemy){
      if(this.phase!=='playing'||enemy.escaped)return;
      if(enemy.level!==TD.ENEMY_TYPES.captain){super.resolveEnemyExit(enemy);return;}
      enemy.hp=0;enemy.escaped=true;this.lives=0;this.phase='lost';this.stopBattle();
    }
    update(dt){
      super.update(dt);
      // Projectile filters may have been in flight when the terminal event fired.
      if(this.phase==='won'||this.phase==='lost')this.stopBattle();
    }
    build(id,kind){
      const slot=this.slots[id];
      if(!slot||slot.level)return super.build(id);
      const chosen=kind??'arrow';
      if(!['arrow','bomb'].includes(chosen))return {ok:false,message:'請選擇箭塔或炸彈塔。'};
      const previous=slot.kind;slot.kind=chosen;
      const result=super.build(id);
      if(!result.ok)slot.kind=previous;
      else if(chosen==='bomb')slot.visualScale=this.worldScale*.65;
      return result;
    }
    updateTowerActions(dt){
      super.updateTowerActions(dt);
      for(const slot of this.slots)if(!slot.level){slot.kind='arrow';slot.pendingBomb=null;slot.throwAt=null;}
    }
  }
  const api={LevelFiveGame,scenario,WAVE_BATCHES,SPAWN_INTERVAL,FAST_SPAWN_INTERVAL,REINFORCEMENT_DELAYS};
  if(node)module.exports=api;else root.LevelFive=api;
})(typeof globalThis!=='undefined'?globalThis:this);
