(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const TD=node?require('./engine.js'):root.TD;
  const {TimedWaveGame}=node?require('./timed-waves.js'):root.TimedWaves;
  const SPAWN_INTERVAL=1.35,REINFORCEMENT_DELAY=5;
  // Object order preserves the requested order within each batch.
  const WAVE_BATCHES=[
    [{goblin:6,archer:4}],
    [{goblin:10,archer:6}],
    [{goblin:10,archer:6},{orc:2}],
    [{orc:2,goblin:8,archer:8}],
    [{orc:2,goblin:12,archer:8}],
    [{orc:2,archer:8},{orc:2,goblin:12,archer:8}]
  ];
  function scenario(){
    const waves=WAVE_BATCHES.map(batches=>batches.flatMap((counts,batch)=>{
      const units=Object.entries(counts).flatMap(([type,count])=>Array(count).fill(TD.ENEMY_TYPES[type]));
      // Omit routeIndex so each enemy independently rolls its upper/lower route.
      return units.map((level,index)=>({level,delay:index?SPAWN_INTERVAL:batch?REINFORCEMENT_DELAY:0,...(batch&&index===0?{afterPreviousSpawn:REINFORCEMENT_DELAY}:{})}));
    }));
    return {...TD.createScenario({
      // Mirror the junctions about x=640 and the branches about y=400.
      paths:[
        [[1280,400],[832,400],[832,272],[448,272],[448,400],[0,400]],
        [[1280,400],[832,400],[832,528],[448,528],[448,400],[0,400]]
      ],
      slots:[[128,296],[320,296],[128,512],[320,512],
        [640,168],[544,400],[736,400],[640,632],
        [960,296],[960,512]],
      worldScale:TD.CAMPAIGN_WORLD_SCALE,initialMoney:120,manualWaves:true,spawnInterval:SPAWN_INTERVAL,waveRewards:[30,30,30,30,30,0],waves
    }),stageIndex:2,environment:'flower-forest',entranceProtectionTiles:2,roadBuilding:'fence'};
  }
  class LevelThreeGame extends TimedWaveGame {
    constructor(random=Math.random){super(random,scenario());}
  }
  const api={LevelThreeGame,scenario,WAVE_BATCHES,SPAWN_INTERVAL,REINFORCEMENT_DELAY};
  if(node)module.exports=api;else root.LevelThree=api;
})(typeof globalThis!=='undefined'?globalThis:this);
