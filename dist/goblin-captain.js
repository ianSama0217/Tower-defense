(function(root){
  'use strict';
  const FIRST_DELAY=5,INTERVAL=15,DURATION=5,PREVIEW_RADIUS=160,HASTE=1.2;
  const captain={file:'boss_goblin_captain.png',name:'Boss 哥布林隊長',size:48,frames:27,anchor:{x:24,y:44},animations:{
    idle:{start:0,count:4,fps:5,loop:true},walk:{start:4,count:4,fps:7,loop:true},attack:{start:8,count:4,fps:8,loop:false},
    warcry:{start:12,count:6,fps:8,loop:false},hurt:{start:18,count:3,fps:10,loop:false},death:{start:21,count:6,fps:7,loop:false}
  }};
  const aura={file:'goblin_warcry_aura.png',name:'戰吼增益光環',size:48,frames:4,anchor:{x:24,y:34},animations:{aura:{start:0,count:4,fps:8,loop:true}}};
  function cycle(time,start=0){
    const elapsed=Math.max(0,time-start);
    if(elapsed<FIRST_DELAY-1e-9)return {active:false,age:elapsed,count:0,remaining:FIRST_DELAY-elapsed,casting:false};
    const count=Math.floor((elapsed-FIRST_DELAY+1e-9)/INTERVAL)+1,age=Math.max(0,elapsed-FIRST_DELAY-(count-1)*INTERVAL);
    const active=age<DURATION-1e-9;
    return {active,age,count,remaining:active?DURATION-age:INTERVAL-age,casting:active&&age<captain.animations.warcry.count/captain.animations.warcry.fps};
  }
  // Shared eligibility for the combat effect and its visual indicator.
  function recipients(caster,units,radius=PREVIEW_RADIUS){
    return units.filter(u=>[1,4,6].includes(u.level)&&u.hp!==0&&!(u.hp<0)&&u.deathAt==null&&!u.escaped&&Math.hypot(u.x-caster.x,u.y-caster.y)<=radius+1e-9);
  }
  function effect(unit,units,time,worldScale=1){
    if(![1,4,6].includes(unit.level)||unit.hp<=0||unit.deathAt!=null||unit.escaped)return null;
    for(const caster of units){
      if(caster.level!==7||caster.hp<=0||caster.deathAt!=null||caster.escaped)continue;
      const state=cycle(time,caster.spawnedAt??0);
      if(state.active&&Math.hypot(unit.x-caster.x,unit.y-caster.y)<=PREVIEW_RADIUS*worldScale+1e-9)
        return {haste:HASTE,age:state.age,sourceId:caster.id};
    }
    return null;
  }
  function sample(spec,state,time){
    const a=spec.animations[state]||Object.values(spec.animations)[0],tick=Math.floor(Math.max(0,time)*a.fps+1e-8),index=a.start+(a.loop?tick%a.count:Math.min(tick,a.count-1));
    return {index,sx:index*spec.size,sy:0,sw:spec.size,sh:spec.size};
  }
  const api={captain,aura,FIRST_DELAY,INTERVAL,DURATION,PREVIEW_RADIUS,HASTE,cycle,recipients,effect,sample};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GoblinCaptain=api;
})(typeof globalThis!=='undefined'?globalThis:this);
