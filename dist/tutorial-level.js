(function(root){
  'use strict';
  const TD=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.TD;
  function scenario(){return TD.createScenario({
    paths:[[[1280,400],[0,400]]],slots:[[832,288],[832,512],[448,288],[448,512]],worldScale:2,
    initialMoney:120,manualWaves:true,waveRewards:[0,80,0],
    waves:[[5,5,5,5],[5,5,5,5,5,5],[5,5,1,5,1,5,1,1],[1,1,1,1,1,1,1,1]]
  });}
  class TutorialGame extends TD.Game {
    constructor(random=Math.random){super(random,scenario());}
    reset(level=this.level){super.reset(level);this.upgradeLearned=false;}
    get lesson(){
      if(this.phase==='won'||this.phase==='lost')return this.phase;
      if(!this.awaitingWave)return `wave${this.wave}`;
      if(this.wave===0)return 'build';
      if(this.wave===1)return 'slimes';
      if(this.wave===2){
        if(this.upgradeLearned)return 'goblins';
        return this.slots.some(s=>s.action?.kind==='upgrade')?'upgrading':'upgrade';
      }
      return 'final';
    }
    get canStartWave(){return this.phase==='playing'&&this.awaitingWave&&this.slots.some(s=>s.level>0)&&
      (this.wave!==2||this.upgradeLearned)&&!this.slots.some(s=>s.action);}
    startNextWave(){return this.canStartWave?super.startNextWave():false;}
    build(id){
      const slot=this.slots[id];
      if(slot?.level&&this.wave<2)return{ok:false,message:'先完成前兩波史萊姆，再學習升級。'};
      if(slot?.level&&this.wave===2&&!this.awaitingWave)return{ok:false,message:'第二波結束後會提供升級教學與獎勵。'};
      if(!slot?.level&&['upgrade','upgrading'].includes(this.lesson))return{ok:false,message:'先選取已建好的塔，完成這次升級教學。'};
      return super.build(id);
    }
    // Keep the teaching tower available until the required upgrade has been learned.
    demolish(id){if(!this.upgradeLearned)return{ok:false,message:'完成升級教學後即可拆除。'};return super.demolish(id);}
    update(dt){super.update(dt);if(this.wave>=2&&this.slots.some(s=>s.level>=2))this.upgradeLearned=true;}
  }
  const api={TutorialGame,scenario};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Tutorial=api;
})(typeof globalThis!=='undefined'?globalThis:this);
