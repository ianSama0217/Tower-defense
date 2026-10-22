(function(root){
  'use strict';
  class MusicManager {
    constructor({volume=.6,createAudio=()=>new root.Audio()}={}){
      this.volume=volume;this.createAudio=createAudio;this.media=null;
      this.wanted=false;this.suspended=false;
    }
    start(src){
      this.stop();
      if(!this.media){this.media=this.createAudio();this.media.loop=true;this.media.preload='auto';}
      if(this.src!==src){this.src=src;this.media.src=src;}
      this.media.volume=this.volume;this.wanted=true;this.play();
    }
    play(){
      if(!this.media||!this.wanted||this.suspended||!this.media.paused)return;
      // Autoplay may be blocked on direct entry; the next user gesture retries.
      try{
        Promise.resolve(this.media.play()).catch(()=>{}).finally(()=>{
          if(!this.wanted||this.suspended)this.media.pause();
        });
      }catch{}
    }
    setVolume(value){
      if(!Number.isFinite(value))return;
      this.volume=Math.max(0,Math.min(1,value));
      if(this.media)this.media.volume=this.volume;
    }
    suspend(value){
      this.suspended=!!value;
      if(this.suspended)this.media?.pause();else this.play();
    }
    stop(){
      this.wanted=false;
      if(this.media){this.media.pause();this.media.currentTime=0;}
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=MusicManager;else root.MusicManager=MusicManager;
})(typeof globalThis!=='undefined'?globalThis:this);
