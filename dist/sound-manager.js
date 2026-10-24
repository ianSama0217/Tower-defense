(function(root){
  'use strict';
  const ARROW_PITCH=Object.freeze({1:1000,2:900,3:800});
  const MAX_GAIN=2; // 50% = the original full volume; 100% = double gain.
  const RESULT_SOUNDS=Object.freeze({victory:'assets/tunoron_sfx_pack_8bit/victory_01_8bit.wav',gameOver:'assets/tunoron_sfx_pack_8bit/gameover_01_8bit.wav'});
  class SoundManager {
    constructor({volume=.5,muted=false,contextFactory,createAudio}={}){
      this.volume=Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):.5;
      this.muted=!!muted;this.context=null;this.master=null;this.noise=null;
      this.voices=new Set();this.lastPlayed=new Map();this.resuming=null;
      this.resultPlayers=new Map();this.playbackVersion=0;
      this.createAudio=createAudio||(root.Audio?()=>new root.Audio():null);
      this.contextFactory=contextFactory||(()=>{const Audio=root.AudioContext||root.webkitAudioContext;return Audio?new Audio():null;});
    }
    // Call from a pointer/keyboard gesture. Never queue sounds before audio is unlocked.
    async unlock(){
      try{
        if(!this.context||this.context.state==='closed'){
          this.stopAll();
          for(const player of this.resultPlayers.values())player.node.disconnect();
          this.resultPlayers.clear();
          this.context=this.contextFactory();if(!this.context)return false;
          this.master=this.context.createGain();this.master.gain.value=this.muted?0:this.volume*MAX_GAIN;
          const limiter=this.context.createDynamicsCompressor();
          limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=8;
          this.master.connect(limiter);limiter.connect(this.context.destination);
          this.noise=this.context.createBuffer(1,this.context.sampleRate,this.context.sampleRate);
          const data=this.noise.getChannelData(0);
          for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
        }
        if(this.context.state!=='running'){
          if(!this.resuming)this.resuming=this.context.resume().finally(()=>{this.resuming=null;});
          await this.resuming;
        }
        const ready=this.context.state==='running';
        if(ready)for(const kind of Object.keys(RESULT_SOUNDS))this._resultPlayer(kind);
        return ready;
      }catch{return false;}
    }
    setVolume(value){
      if(!Number.isFinite(value))return;
      this.volume=Math.max(0,Math.min(1,value));this._gain();
      if(this.volume===0)this.stopAll();
    }
    setMuted(value){this.muted=!!value;this._gain();if(this.muted)this.stopAll();}
    _gain(){if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.volume*MAX_GAIN,this.context.currentTime,.01);}
    stopAll(){
      this.playbackVersion++;
      for(const {media} of this.resultPlayers.values()){media.pause();media.currentTime=0;}
      for(const voice of this.voices){for(const source of voice.sources){try{source.stop();}catch{}}for(const node of voice.nodes)node.disconnect();}
      this.voices.clear();this.lastPlayed.clear();
    }
    _resultPlayer(kind){
      if(this.resultPlayers.has(kind))return this.resultPlayers.get(kind);
      if(!this.createAudio||!this.context||!RESULT_SOUNDS[kind])return null;
      try{
        const media=this.createAudio();media.preload='auto';media.loop=false;media.src=RESULT_SOUNDS[kind];
        // File audio shares the synthesized effects' gain, mute and compression, including 2x gain.
        const node=this.context.createMediaElementSource(media);node.connect(this.master);
        const player={media,node};this.resultPlayers.set(kind,player);return player;
      }catch{return null;}
    }
    async _playResult(kind){
      if(this.context?.state!=='running'||this.muted||this.volume===0||root.document?.hidden)return false;
      this.stopAll();
      const player=this._resultPlayer(kind),version=this.playbackVersion;
      if(!player)return false;
      try{await player.media.play();return version===this.playbackVersion;}catch{return false;}
    }
    playVictory(){return this._playResult('victory');}
    playGameOver(){return this._playResult('gameOver');}
    _play(key,interval,compose){
      const ctx=this.context;
      if(!ctx||ctx.state!=='running'||this.muted||this.volume===0||root.document?.hidden)return false;
      const now=ctx.currentTime;
      if(now-(this.lastPlayed.get(key)??-Infinity)<interval||this.voices.size>=24)return false;
      const voice={sources:[],nodes:[]};this.voices.add(voice);
      // Every layer is short, has a click-free envelope, and releases its nodes on completion.
      const layer=(type,frequency,endFrequency,duration,amplitude,delay=0)=>{
        const start=now+delay,source=type==='noise'?ctx.createBufferSource():ctx.createOscillator();
        const gain=ctx.createGain();voice.sources.push(source);voice.nodes.push(source,gain);
        if(type==='noise'){
          source.buffer=this.noise;
          const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.Q.value=.7;
          filter.frequency.setValueAtTime(frequency,start);filter.frequency.exponentialRampToValueAtTime(endFrequency,start+duration);
          voice.nodes.push(filter);source.connect(filter);filter.connect(gain);
        }else{
          source.type=type;source.frequency.setValueAtTime(frequency,start);
          source.frequency.exponentialRampToValueAtTime(endFrequency,start+duration);source.connect(gain);
        }
        gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(amplitude,start+.004);
        gain.gain.exponentialRampToValueAtTime(.0001,start+duration);gain.gain.setValueAtTime(0,start+duration+.005);
        gain.connect(this.master);
        source.onended=()=>{voice.sources=voice.sources.filter(s=>s!==source);if(!voice.sources.length){for(const node of voice.nodes)node.disconnect();this.voices.delete(voice);}};
        source.start(start);source.stop(start+duration+.01);
      };
      try{compose(layer);this.lastPlayed.set(key,now);return true;}
      catch{for(const source of voice.sources){try{source.stop();}catch{}}for(const node of voice.nodes)node.disconnect();this.voices.delete(voice);return false;}
    }
    playArrow(level=1){
      const pitch=ARROW_PITCH[level]||ARROW_PITCH[1];
      return this._play(`arrow-${pitch}`,.035,t=>{t('triangle',pitch,pitch*.28,.13,.22);t('noise',4200,700,.09,.16);});
    }
    playHit(){return this._play('hit',.035,t=>{t('noise',1800,350,.075,.24);t('sine',180,65,.09,.24);});}
    playCoin(){return this._play('coin',.09,t=>{t('sine',1319,1319,.13,.15);t('sine',1976,1976,.22,.12,.065);});}
    playBuild(){return this._play('build',.08,t=>{for(const delay of [0,.11,.22]){t('triangle',230,90,.085,.2,delay);t('noise',1300,350,.055,.14,delay);}});}
    playUpgrade(){return this._play('upgrade',.1,t=>{[523.25,659.25,783.99,1046.5].forEach((hz,i)=>t('triangle',hz,hz,.24,.16,i*.09));});}
    playExplosion(){return this._play('explosion',.07,t=>{t('noise',3200,100,.6,.5);t('sine',135,32,.5,.42);});}
    playEnemyDeath(){return this._play('death',.055,t=>{t('triangle',280,55,.22,.2);t('noise',950,160,.16,.1);});}
    playWaveStart(){return this._play('wave',.3,t=>{[392,523.25,659.25].forEach((hz,i)=>t('triangle',hz,hz,.3,.2,i*.14));});}
  }
  SoundManager.ARROW_PITCH=ARROW_PITCH;
  if(typeof module!=='undefined'&&module.exports)module.exports=SoundManager;else root.SoundManager=SoundManager;
})(typeof globalThis!=='undefined'?globalThis:this);
