(function(root){
  'use strict';
  const {ARROW_RAIN_SECONDS,INTERMISSION_SECONDS}=typeof module!=='undefined'&&module.exports?require('./timed-waves.js'):root.TimedWaves;
  function sample(game){
    if(game.phase==='won'||game.phase==='lost')return{mode:'finished',angle:0,remaining:null};
    if(game.wave===0)return{mode:'ready',angle:0,remaining:null};
    if(game.awaitingWave){const remaining=Math.max(0,game.intermissionRemaining??INTERMISSION_SECONDS);return{mode:'intermission',angle:(INTERMISSION_SECONDS-remaining)/60*Math.PI*2,remaining,green:true};}
    const waitingForSpawns=game.arrowRainStartedAt==null,elapsed=waitingForSpawns?0:(game.battleTime??0);
    const remaining=Math.max(0,ARROW_RAIN_SECONDS-elapsed);
    return{mode:'combat',angle:Math.PI/2+Math.min(1,elapsed/ARROW_RAIN_SECONDS)*Math.PI*1.5,remaining,green:game.wave>1,rainFired:!!game.arrowRainFired,waitingForSpawns};
  }
  function draw(canvas,face,state){
    const ctx=canvas.getContext('2d'),cx=32,cy=32;
    ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,64,64);ctx.drawImage(face,0,0,64,64);
    if(state.green){
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,18,-Math.PI/2,0);ctx.closePath();ctx.fillStyle='#70ed13';ctx.fill();
    }
    ctx.save();ctx.translate(cx,cy);ctx.rotate(state.angle);
    ctx.beginPath();ctx.moveTo(-3,2);ctx.lineTo(-3,-16);ctx.lineTo(0,-23);ctx.lineTo(3,-16);ctx.lineTo(3,2);ctx.closePath();ctx.fillStyle='#15191b';ctx.fill();
    ctx.beginPath();ctx.moveTo(-1,0);ctx.lineTo(-1,-16);ctx.lineTo(0,-20);ctx.lineTo(1,-16);ctx.lineTo(1,0);ctx.closePath();ctx.fillStyle='#eff8ff';ctx.fill();ctx.fillStyle='#a9bac7';ctx.fillRect(1,-15,1,16);ctx.restore();
    ctx.fillStyle='#111719';ctx.fillRect(28,28,8,8);ctx.fillStyle='#788286';ctx.fillRect(30,30,4,4);ctx.fillStyle='#e2e9e7';ctx.fillRect(30,30,2,2);
  }
  const api={sample,draw};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WaveClock=api;
})(typeof globalThis!=='undefined'?globalThis:this);
