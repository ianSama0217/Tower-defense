(function(root){
  'use strict';
  const specs={
    cyclops:{file:'boss_cyclops.png',name:'Boss 獨眼巨人',size:96,frames:27,anchor:{x:48,y:90},animations:{
      idle:{start:0,count:4,fps:5,loop:true},walk:{start:4,count:4,fps:7,loop:true},
      attack:{start:8,count:4,fps:8,loop:false},throw:{start:12,count:6,fps:8,loop:false},
      hurt:{start:18,count:3,fps:10,loop:false},death:{start:21,count:6,fps:7,loop:false}
    }},
    rock:{file:'boss_cyclops_rock.png',name:'Boss 飛行石頭',size:32,frames:6,anchor:{x:16,y:16},animations:{fly:{start:0,count:6,fps:12,loop:true}}},
    impact:{file:'boss_cyclops_rock_impact.png',name:'Boss 石頭落地',size:48,frames:4,anchor:{x:24,y:43},animations:{impact:{start:0,count:4,fps:10,loop:false}}}
  };
  function sample(key,state,time){
    const spec=specs[key];if(!spec)throw new RangeError('Unknown boss asset');
    const a=spec.animations[state]||Object.values(spec.animations)[0];
    const tick=Math.floor(Math.max(0,time)*a.fps+1e-8),index=a.start+(a.loop?tick%a.count:Math.min(tick,a.count-1));
    return {index,sx:index*spec.size,sy:0,sw:spec.size,sh:spec.size};
  }
  const api={specs,sample};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BossSprites=api;
})(typeof globalThis!=='undefined'?globalThis:this);
