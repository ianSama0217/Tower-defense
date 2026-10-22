(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const TD=node?require('./engine.js'):root.TD;
  const {TimedWaveGame}=node?require('./timed-waves.js'):root.TimedWaves;
  const SPAWN_INTERVAL=1.35,REINFORCEMENT_DELAY=5;
  const WAVE_BATCHES=[
    [{goblin:5,archer:5}],
    [{goblin:10,archer:6},{orc:1}],
    [{goblin:10,archer:6},{orc:2,bomber:1}],
    [{orc:2,goblin:6,bomber:2,archer:8}],
    [{orc:2,goblin:10,bomber:2,archer:8}],
    [{orc:2,bomber:2,archer:8},{orc:2,goblin:8,bomber:4,archer:6}]
  ];
  function scenario(){
    const waves=WAVE_BATCHES.map(batches=>batches.flatMap((counts,batch)=>{
      const units=Object.entries(counts).flatMap(([type,count])=>Array(count).fill(TD.ENEMY_TYPES[type]));
      // Reinforcements wait for the previous batch's last actual spawn, including congestion.
      return units.map((level,index)=>({level,routeIndex:0,delay:index?SPAWN_INTERVAL:batch?REINFORCEMENT_DELAY:0,...(batch&&index===0?{afterPreviousSpawn:REINFORCEMENT_DELAY}:{})}));
    }));
    return {...TD.createScenario({
      // Reference proportions on the campaign's 1280 × 768 canvas, with a full 96px lane.
      paths:[[[1280,432],[912,432],[912,288],[720,288],[720,608],[512,608],[512,288],[304,288],[304,432],[0,432]]],
      slots:[[72,352],[220,352],[64,536],[220,536],
        [404,192],[408,368],[400,528],
        [612,360],[616,520],[616,704],
        [816,176],[816,368],[824,536]],
      worldScale:TD.CAMPAIGN_WORLD_SCALE,initialMoney:150,manualWaves:true,
      spawnInterval:SPAWN_INTERVAL,waveRewards:[30,30,30,30,30,0],waves
    }),stageIndex:3,environment:'cave-approach',entranceProtectionTiles:2,
      roadBuilding:'fence'};
  }
  class LevelFourGame extends TimedWaveGame {
    constructor(random=Math.random){super(random,scenario());}
  }
  const api={LevelFourGame,scenario,WAVE_BATCHES,SPAWN_INTERVAL,REINFORCEMENT_DELAY};
  if(node)module.exports=api;else root.LevelFour=api;
})(typeof globalThis!=='undefined'?globalThis:this);
