(function(root){
  'use strict';
  const INTERVAL=15,DURATION=5,PREVIEW_RADIUS=160;
  const captain={file:'boss_goblin_captain.png',name:'Boss 哥布林隊長',size:48,frames:27,anchor:{x:24,y:44},animations:{
    idle:{start:0,count:4,fps:5,loop:true},walk:{start:4,count:4,fps:7,loop:true},attack:{start:8,count:4,fps:8,loop:false},
    warcry:{start:12,count:6,fps:8,loop:false},hurt:{start:18,count:3,fps:10,loop:false},death:{start:21,count:6,fps:7,loop:false}
  }};
  const aura={file:'goblin_warcry_aura.png',name:'戰吼增益光環',size:48,frames:4,anchor:{x:24,y:34},animations:{aura:{start:0,count:4,fps:8,loop:true}}};
  function cycle(time,start=0){
    const elapsed=Math.max(0,time-start),count=Math.floor((elapsed+1e-9)/INTERVAL),age=Math.max(0,elapsed-count*INTERVAL);
    const active=count>0&&age<DURATION-1e-9;
    return {active,age,count,remaining:active?DURATION-age:INTERVAL-age,casting:active&&age<captain.animations.warcry.count/captain.animations.warcry.fps};
  }
  // Read-only visual eligibility. This module never changes movement, cooldowns or damage.
  function recipients(caster,units,radius=PREVIEW_RADIUS){
    return units.filter(u=>[1,4,6].includes(u.level)&&u.hp!==0&&!(u.hp<0)&&u.deathAt==null&&!u.escaped&&Math.hypot(u.x-caster.x,u.y-caster.y)<=radius+1e-9);
  }
  function sample(spec,state,time){
    const a=spec.animations[state]||Object.values(spec.animations)[0],tick=Math.floor(Math.max(0,time)*a.fps+1e-8),index=a.start+(a.loop?tick%a.count:Math.min(tick,a.count-1));
    return {index,sx:index*spec.size,sy:0,sw:spec.size,sh:spec.size};
  }
  const api={captain,aura,INTERVAL,DURATION,PREVIEW_RADIUS,cycle,recipients,sample};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GoblinCaptain=api;
})(typeof globalThis!=='undefined'?globalThis:this);
