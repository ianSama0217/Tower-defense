(function(root){
  'use strict';
  const shield={file:'friendly_shield_soldier.png',name:'友方盾兵',size:48,frames:22,anchor:{x:24,y:44},faction:'friendly',canAttack:false,animations:{
    idle:{start:0,count:4,fps:5,loop:true},walk:{start:4,count:4,fps:7,loop:true},push:{start:8,count:6,fps:9,loop:true},
    hurt:{start:14,count:3,fps:10,loop:false},death:{start:17,count:5,fps:7,loop:false}
  }};
  function sample(state,time){
    const a=shield.animations[state]||shield.animations.idle,tick=Math.floor(Math.max(0,time)*a.fps+1e-8),index=a.start+(a.loop?tick%a.count:Math.min(tick,a.count-1));
    return {index,sx:index*48,sy:0,sw:48,sh:48};
  }
  // Visual preview only: no target acquisition, contact damage or combat stats.
  function advancePreview(unit,dt,width,speed=32){
    if(unit.animation==='death'||unit.animation==='hurt')return;
    const scale=unit.scale??1,margin=shield.size/2*scale,direction=unit.facing===-1?-1:1;
    const before=unit.x;
    unit.x=Math.max(margin,Math.min(width-margin,unit.x+direction*speed*scale*Math.max(0,dt)));
    unit.animation=unit.x===before?'idle':'push';
  }
  const api={shield,sample,advancePreview};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FriendlySprites=api;
})(typeof globalThis!=='undefined'?globalThis:this);
