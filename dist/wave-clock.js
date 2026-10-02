(function(root){
  'use strict';
  function sample(game){
    if(game.phase==='won'||game.phase==='lost')return{mode:'finished',angle:0,remaining:null};
    if(game.wave===0)return{mode:'ready',angle:0,remaining:null};
    if(game.awaitingWave){const remaining=Math.max(0,game.intermissionRemaining??15);return{mode:'intermission',angle:(15-remaining)/60*Math.PI*2,remaining,green:true};}
    const total=game.waves[game.wave-1].length,kills=Math.max(0,Math.min(total,game.kills-game.waveStartKills));
    return{mode:'combat',angle:Math.PI/2+kills/total*Math.PI*1.5,remaining:null,green:game.wave>1,kills,total};
  }
  function draw(canvas,face,state){
    const ctx=canvas.getContext('2d'),cx=32,cy=32;
    ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,64,64);ctx.drawImage(face,0,0,64,64);
    if(state.green){
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,18,-Math.PI/2,0);ctx.closePath();ctx.fillStyle='#70ed13';ctx.fill();
    }
    if(state.mode==='combat'){
      ctx.strokeStyle='#641a2355';ctx.lineWidth=1;
      for(let i=1;i<state.total;i++){
        const angle=i/state.total*Math.PI*1.5;
        ctx.beginPath();ctx.moveTo(cx+Math.cos(angle)*5,cy+Math.sin(angle)*5);ctx.lineTo(cx+Math.cos(angle)*17,cy+Math.sin(angle)*17);ctx.stroke();
      }
    }
    ctx.save();ctx.translate(cx,cy);ctx.rotate(state.angle);
    ctx.beginPath();ctx.moveTo(-3,2);ctx.lineTo(-3,-16);ctx.lineTo(0,-23);ctx.lineTo(3,-16);ctx.lineTo(3,2);ctx.closePath();ctx.fillStyle='#15191b';ctx.fill();
    ctx.beginPath();ctx.moveTo(-1,0);ctx.lineTo(-1,-16);ctx.lineTo(0,-20);ctx.lineTo(1,-16);ctx.lineTo(1,0);ctx.closePath();ctx.fillStyle='#eff8ff';ctx.fill();ctx.fillStyle='#a9bac7';ctx.fillRect(1,-15,1,16);ctx.restore();
    ctx.fillStyle='#111719';ctx.fillRect(28,28,8,8);ctx.fillStyle='#788286';ctx.fillRect(30,30,4,4);ctx.fillStyle='#e2e9e7';ctx.fillRect(30,30,2,2);
  }
  const api={sample,draw};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WaveClock=api;
})(typeof globalThis!=='undefined'?globalThis:this);
