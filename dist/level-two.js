(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const TD=node?require('./engine.js'):root.TD;
  const {TimedWaveGame}=node?require('./timed-waves.js'):root.TimedWaves;
  // Each pair is [goblins, archers]; routes are upper, then lower.
  const WAVE_COUNTS=[[[4,0],[4,0]],[[6,0],[0,3]],[[6,3],[4,3]],[[10,0],[0,8]],[[0,8],[10,0]],[[14,6],[6,8]]];
  const SPAWN_INTERVAL=1.35;
  function scenario(){
    const waves=WAVE_COUNTS.map(lanes=>{
      const events=lanes.flatMap(([goblins,archers],routeIndex)=>[
        ...Array(goblins).fill(TD.ENEMY_TYPES.goblin),...Array(archers).fill(TD.ENEMY_TYPES.archer)
      ].map((level,index)=>({level,routeIndex,at:index*SPAWN_INTERVAL})));
      events.sort((a,b)=>a.at-b.at||a.routeIndex-b.routeIndex);
      return events.map((event,index)=>({level:event.level,routeIndex:event.routeIndex,delay:index?event.at-events[index-1].at:0}));
    });
    return {...TD.createScenario({
      paths:[[[1280,184],[890,184],[890,392],[0,392]],[[1280,584],[890,584],[890,392],[0,392]]],
      slots:[[56,288],[276,288],[504,288],[750,288],[56,504],[276,504],[504,504],[750,504],[1006,392]],
      mapConfig:{...TD.MAP_CONFIG,roadWidth:80},worldScale:2,initialMoney:120,
      manualWaves:true,spawnInterval:SPAWN_INTERVAL,waveRewards:[30,30,30,30,30,0],waves
    }),stageIndex:1,environment:'deep-forest'};
  }
  class LevelTwoGame extends TimedWaveGame {
    constructor(random=Math.random){super(random,scenario());}
  }
  const api={LevelTwoGame,scenario,WAVE_COUNTS,SPAWN_INTERVAL};
  if(node)module.exports=api;else root.LevelTwo=api;
})(typeof globalThis!=='undefined'?globalThis:this);
