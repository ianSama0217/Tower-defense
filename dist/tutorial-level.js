(function(root){
  'use strict';
  const TD=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.TD;
  const INTERMISSION_SECONDS=15;
  function scenario(){return TD.createScenario({
    paths:[[[1280,400],[0,400]]],slots:[[832,288],[832,512],[448,288],[448,512]],worldScale:2,
    initialMoney:120,manualWaves:true,waveRewards:[0,80,0],
    waves:[[5,5,5,5],[5,5,5,5,5,5],[5,5,1,5,1,5,1,1],[1,1,1,1,1,1,1,1]]
  });}
  class TutorialGame extends TD.Game {
    constructor(random=Math.random){super(random,scenario());}
    reset(level=this.level){super.reset(level);this.upgradeLearned=false;this.intermissionRemaining=null;this.battleTime=0;this.waveStartKills=0;}
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
    // Only the first wave is user-started. Later waves use game-time intermissions.
    get canStartWave(){return this.phase==='playing'&&this.awaitingWave&&this.wave===0;}
    startNextWave(){return this.canStartWave?this.launchWave():false;}
    launchWave(){const started=super.startNextWave();if(started){this.intermissionRemaining=null;this.battleTime=0;this.waveStartKills=this.kills;}return started;}
    build(id){
      const slot=this.slots[id];
      if(slot?.level&&(this.wave<2||this.wave===2&&!this.awaitingWave))return{ok:false,message:'第二波結束後開放升級。'};
      if(!slot?.level&&['upgrade','upgrading'].includes(this.lesson))return{ok:false,message:'先選取已建好的塔，完成這次升級。'};
      return super.build(id);
    }
    demolish(id){if(!this.upgradeLearned)return{ok:false,message:'完成首次升級後即可拆除。'};return super.demolish(id);}
    update(dt){
      if(dt<=0)return;
      if(this.phase!=='playing'){super.update(dt);return;}
      if(this.awaitingWave&&this.wave>0){
        const step=Math.min(dt,this.intermissionRemaining??INTERMISSION_SECONDS);
        super.update(step);
        this.intermissionRemaining=Math.max(0,(this.intermissionRemaining??INTERMISSION_SECONDS)-step);
        if(this.intermissionRemaining<=1e-9){this.launchWave();if(dt>step)this.update(dt-step);}
      }else{
        const fighting=!this.awaitingWave;
        super.update(dt);
        if(fighting)this.battleTime+=dt;
        if(fighting&&this.awaitingWave&&this.phase==='playing')this.intermissionRemaining=INTERMISSION_SECONDS;
      }
      if(this.slots.some(s=>s.level>=2))this.upgradeLearned=true;
    }
  }
  const api={TutorialGame,scenario,INTERMISSION_SECONDS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Tutorial=api;
})(typeof globalThis!=='undefined'?globalThis:this);
