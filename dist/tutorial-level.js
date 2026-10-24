(function(root){
  'use strict';
  const TD=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.TD;
  const {TimedWaveGame,INTERMISSION_SECONDS}=typeof module!=='undefined'&&module.exports?require('./timed-waves.js'):root.TimedWaves;
  function scenario(){return {...TD.createScenario({
    paths:[[[1280,400],[0,400]]],slots:[[832,288],[832,512],[448,288],[448,512]],worldScale:TD.CAMPAIGN_WORLD_SCALE,
    initialMoney:120,manualWaves:true,waveRewards:[0,80,0],
    waves:[[5,5,5,5],[5,5,5,5,5,5],[5,5,1,5,1,5,1,1],[1,1,1,1,1,1,1,1]]
  }),stageIndex:0};}
  class TutorialGame extends TimedWaveGame {
    constructor(random=Math.random){super(random,scenario());}
  }
  const api={TutorialGame,scenario,INTERMISSION_SECONDS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Tutorial=api;
})(typeof globalThis!=='undefined'?globalThis:this);
