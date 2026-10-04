(function(root){
  'use strict';
  const TD=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.TD;
  const INTERMISSION_SECONDS=15;
  class TimedWaveGame extends TD.Game {
    reset(level=this.level){super.reset(level);this.intermissionRemaining=null;this.battleTime=0;this.waveStartKills=0;}
    get canStartWave(){return this.phase==='playing'&&this.awaitingWave&&this.wave===0;}
    startNextWave(){return this.canStartWave?this.launchWave():false;}
    launchWave(){const started=super.startNextWave();if(started){this.intermissionRemaining=null;this.battleTime=0;this.waveStartKills=this.kills;}return started;}
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
    }
  }
  const api={TimedWaveGame,INTERMISSION_SECONDS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TimedWaves=api;
})(typeof globalThis!=='undefined'?globalThis:this);
