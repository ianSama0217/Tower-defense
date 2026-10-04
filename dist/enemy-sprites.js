(function(root){
  'use strict';
  const animations={idle:{start:0,count:4,fps:5,loop:true},walk:{start:4,count:4,fps:8,loop:true},attack:{start:8,count:4,fps:10,loop:false},hurt:{start:12,count:2,fps:10,loop:false},death:{start:14,count:6,fps:8,loop:false}};
  const passiveAnimations={idle:{start:0,count:6,fps:6,loop:true},walk:{start:6,count:6,fps:10,loop:true},hurt:{start:12,count:6,fps:20,loop:false},death:{start:18,count:6,fps:8,loop:false}};
  const specs=[null,
    {file:'enemy_lv1_goblin.png',size:24,anchor:{x:12,y:21}},
    {file:'enemy_lv2_orc.png',size:32,frames:24,anchor:{x:16,y:29},animations:{...animations,charge:{start:20,count:4,fps:12,loop:true}}},
    {file:'enemy_lv3_cyclops.png',size:48,anchor:{x:24,y:45}},
    {file:'enemy_bomber_goblin.png',name:'炸彈哥布林',size:32,frames:24,anchor:{x:16,y:29},animations:passiveAnimations},
    {file:'enemy_slime.png',name:'史萊姆',size:24,frames:24,anchor:{x:12,y:21},animations:passiveAnimations},
    {file:'enemy_goblin_archer.png',name:'哥布林弓箭手',size:24,frames:20,anchor:{x:12,y:21}}
  ];
  const deathDuration=animations.death.count/animations.death.fps;
  function sample(enemy,time){
    const states=specs[enemy.level].animations||animations;
    let state=enemy.moving===false?'idle':'walk',elapsed=time+(enemy.id||0)*.073;
    if(enemy.deathAt!=null){state='death';elapsed=time-enemy.deathAt;}
    else if(states.charge&&enemy.charging){state='charge';}
    else if(enemy.hurtAt!=null&&time-enemy.hurtAt<states.hurt.count/states.hurt.fps){state='hurt';elapsed=time-enemy.hurtAt;}
    else if(states.attack&&enemy.attackAt!=null&&time-enemy.attackAt<states.attack.count/states.attack.fps){state='attack';elapsed=time-enemy.attackAt;}
    const a=states[state],tick=Math.floor(Math.max(0,elapsed)*a.fps+1e-8);
    const index=a.start+(a.loop?tick%a.count:Math.min(tick,a.count-1));
    const s=specs[enemy.level];
    return {state,index,sx:index*s.size,sy:0,sw:s.size,sh:s.size};
  }
  const api={animations,specs,deathDuration,sample};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EnemySprites=api;
})(typeof globalThis!=='undefined'?globalThis:this);
