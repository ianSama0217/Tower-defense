(function(root) {
  'use strict';
  const sprites=typeof module!=='undefined'&&module.exports?require('./enemy-sprites.js'):root.EnemySprites;
  const MAP_CONFIG = {
    width: 1280,
    height: 768,
    tileSize: 32,
    cols: 40,
    rows: 24,
    roadWidth: 96,
    towerSlotSize: 64,
    debugGrid: false
  };
  const SECOND_MAP_CONFIG = {width:1000,height:800,tileSize:50,cols:20,rows:16,roadWidth:48,towerSlotSize:63,debugGrid:true};
  const TOWERS = [null, {damage:12,range:155,interval:.68,cost:60}, {damage:27,range:180,interval:.53,cost:80}, {damage:48,range:205,interval:.4,cost:125}];
  const TOWER_MAX_HP = 100;
  const TOWER_ACTIONS = {upgrade:{duration:5},repair:{duration:3,cost:50},demolish:{duration:3}};
  const ENEMY_TYPES = {goblin:1,orc:2,cyclops:3,bomber:4,slime:5};
  const ENEMIES = [null,
    {hp:44,speed:57,reward:11,attackDamage:6,attackRange:128,attackInterval:1.2},
    {hp:112,speed:49,reward:18,attackDamage:10,attackRange:128,attackInterval:1},
    {hp:245,speed:42,reward:28,attackDamage:15,attackRange:128,attackInterval:.9},
    {name:'炸彈哥布林',behavior:'bomber',hp:60,speed:57,reward:14,attackDamage:0,attackRange:0,attackInterval:0,triggerRange:22,blastRadius:64,blastDamage:60},
    {name:'史萊姆',behavior:'passive',hp:32,speed:49,reward:8,attackDamage:0,attackRange:0,attackInterval:0}
  ];
  const WAVES = [[5,5,5,5,5,5,5,5],[1,1,2,1,1,2,1,2,1,1],[2,1,4,2,1,2,4,1,2,2],[2,2,3,2,2,3,2,2,3,2],[2,4,2,3,3,2,4,2,3,3,2,3],[3,2,3,4,3,2,3,3,4,3,3,3,3,3]];
  function makeRoute(points) {
    const path = points.map(([x,y]) => ({x,y}));
    const segments = path.slice(1).map((p,i) => Math.hypot(p.x-path[i].x,p.y-path[i].y));
    return {path,segments,length:segments.reduce((a,b)=>a+b,0)};
  }
  function makeLevel(name, paths, slots, mapConfig=SECOND_MAP_CONFIG,worldScale=1) {return {name,mapConfig,worldScale,routes:paths.map(points=>makeRoute(points.map(([x,y])=>[x*worldScale,y*worldScale]))),slots:slots.map(([x,y])=>({x:x*worldScale,y:y*worldScale}))};}
  // Pad edges align with tile boundaries; each pad occupies exactly 2 × 2 tiles.
  const firstSlots = [];
  for(const x of [32,80,128,176])for(const y of [176,288])firstSlots.push([x,y]);
  for(const x of [256,304])for(const y of [208,272])firstSlots.push([x,y]);
  firstSlots.push([304,144]);
  for(const x of [384,432,480])firstSlots.push([x,80]);
  for(const x of [384,432])for(const y of [192,240])firstSlots.push([x,y]);
  firstSlots.push([384,288]);
  for(const x of [528,576,624])for(const y of [176,288])firstSlots.push([x,y]);
  const secondSlots = [[80,140],[200,140],[380,140],[600,140],[720,140],[840,140],[950,140]];
  for(const y of [300,395,465]) for(const x of [180,380,610,840]) secondSlots.push([x,y]);
  for(const y of [610,690]) for(const x of [200,380,610,840]) secondSlots.push([x,y]);
  secondSlots.push([80,690]);
  const LEVELS = [
    // Right-to-left route: upper step, lower step, then the straight exit.
    // Odd-width roads use half-tile centers so their 48px edges align to the grid.
    makeLevel('第一關', [[[640,232],[472,232],[472,136],[344,136],[344,312],[216,312],[216,232],[0,232]]], firstSlots, MAP_CONFIG,2),
    // Each enemy independently selects left, center, or right at the upper junction.
    makeLevel('第二關', [[[990,50],[520,50],[520,220],[270,220],[270,530],[520,530],[520,750],[40,750]], [[990,50],[520,50],[520,220],[520,530],[520,750],[40,750]], [[990,50],[520,50],[520,220],[750,220],[750,530],[520,530],[520,750],[40,750]]], secondSlots)
  ];
  function position(distance, level=LEVELS[0].routes[0]) {
    let d=Math.max(0,distance);
    for(let i=0;i<level.segments.length;i++) {
      if(d<=level.segments[i]) {const t=d/level.segments[i];return {x:level.path[i].x+(level.path[i+1].x-level.path[i].x)*t,y:level.path[i].y+(level.path[i+1].y-level.path[i].y)*t};}
      d-=level.segments[i];
    }
    return {...level.path.at(-1)};
  }
  function refundFor(level) {return Math.floor(TOWERS.slice(1,level+1).reduce((sum,t)=>sum+t.cost,0)*.5);}
  class Game {
    constructor(random=Math.random){this.random=random;this.reset(0);}
    reset(levelIndex=this.levelIndex??0) {
      if(!Number.isInteger(levelIndex)||!LEVELS[levelIndex]) throw new RangeError('Invalid level');
      this.levelIndex=levelIndex;this.level=LEVELS[levelIndex];
      this.worldScale=this.level.worldScale;
      this.money=180;this.lives=3;this.wave=0;this.kills=0;this.time=0;this.phase='ready';this.countdown=15;
      this.enemies=[];this.corpses=[];this.bullets=[];this.effects=[];this.spawnQueue=[];this.spawnTimer=0;this.nextId=1;
      this.slots=this.level.slots.map((s,id)=>({...s,id,level:0,cooldown:0,hp:0,maxHp:TOWER_MAX_HP,destroyedAt:null,action:null}));
    }
    start(levelIndex=this.levelIndex){this.reset(levelIndex);this.phase='playing';}
    build(id) {
      if(this.phase!=='playing')return{ok:false,message:'請先開始遊戲。'};
      const s=Number.isInteger(id)?this.slots[id]:null;
      if(!s)return{ok:false,message:'請點選可建造的底座。'};
      if(s.action)return{ok:false,message:'箭塔正在作業中，暫時無法操作。'};
      if(s.level===3)return{ok:false,message:'箭塔已達最高等級。'};
      const cost=TOWERS[s.level+1].cost;
      if(this.money<cost)return{ok:false,message:'金幣不足，擊敗敵人可取得金幣。'};
      this.money-=cost;
      if(s.level){
        s.action={kind:'upgrade',elapsed:0,duration:TOWER_ACTIONS.upgrade.duration,targetLevel:s.level+1,cost};
        return{ok:true,message:`升級開始，5 秒後升至 ${s.level+1} 級並回滿 100 HP；期間停止攻擊。`};
      }
      s.level=1;s.cooldown=0;s.hp=s.maxHp=TOWER_MAX_HP;s.destroyedAt=null;
      return{ok:true,message:'箭塔已建造。'};
    }
    repair(id) {
      if(this.phase!=='playing')return{ok:false,message:'目前無法修復。'};
      const s=Number.isInteger(id)?this.slots[id]:null;
      if(s?.level!==3)return{ok:false,message:'只有滿級箭塔可以修復。'};
      if(s.action)return{ok:false,message:'箭塔正在作業中，暫時無法操作。'};
      if(s.hp>=s.maxHp)return{ok:false,message:'箭塔生命已滿，無需修復。'};
      const {cost,duration}=TOWER_ACTIONS.repair;
      if(this.money<cost)return{ok:false,message:'金幣不足，修復需要 50 金幣。'};
      this.money-=cost;s.action={kind:'repair',elapsed:0,duration,cost};
      return{ok:true,message:'修復開始，3 秒後回復至 100 HP；期間停止攻擊。'};
    }
    demolish(id) {
      if(this.phase!=='playing')return{ok:false,message:'目前無法拆除。'};
      const s=Number.isInteger(id)?this.slots[id]:null;
      if(!s?.level)return{ok:false,message:'請點選已建造的箭塔。'};
      if(s.action)return{ok:false,message:'箭塔正在作業中，暫時無法操作。'};
      const refund=refundFor(s.level);
      s.action={kind:'demolish',elapsed:0,duration:TOWER_ACTIONS.demolish.duration,refund};
      return{ok:true,refund,message:`拆除開始，3 秒後返還 ${refund} 金幣；期間停止攻擊。`};
    }
    updateTowerActions(dt) {
      for(const s of this.slots){
        const action=s.action;if(!action)continue;
        if(!s.level||s.hp<=0){s.action=null;continue;}
        action.elapsed=Math.min(action.duration,action.elapsed+dt);
        if(action.elapsed+1e-9<action.duration)continue;
        if(action.kind==='demolish'){
          this.money+=action.refund;
          this.effects.push({kind:'demolition',x:s.x,y:s.y,level:s.level,material:s.level===1?'wood':'stone',life:.85,duration:.85});
          s.level=0;s.hp=0;s.destroyedAt=null;
        }else{
          if(action.kind==='upgrade')s.level=action.targetLevel;
          s.hp=s.maxHp=TOWER_MAX_HP;
        }
        s.cooldown=0;s.action=null;
      }
    }
    damageTower(target,damage) {
      if(!target.level||target.hp<=0)return;
      target.hp=Math.max(0,target.hp-damage);
      if(target.hp===0){
        target.level=0;target.cooldown=0;target.action=null;target.destroyedAt=this.time;
        this.effects.push({kind:'destroyed',x:target.x,y:target.y,life:.5});
      }
    }
    damageEnemy(enemy,damage) {
      if(enemy.hp<=0||enemy.deathAt!=null||enemy.escaped)return;
      enemy.hp=Math.max(0,enemy.hp-damage);enemy.hurtAt=this.time;
      if(enemy.hp===0)this.killEnemy(enemy);
    }
    killEnemy(enemy,reward=true) {
      // Queue chain reactions: each death, blast, reward and corpse is resolved exactly once.
      const pending=[{enemy,reward}];
      for(let i=0;i<pending.length;i++){
        const {enemy:e,reward:grant}=pending[i];
        if(e.deathAt!=null||e.escaped)continue;
        e.hp=0;e.deathAt=this.time;e.moving=false;e.targetId=null;
        this.corpses.push({...e});
        const spec=ENEMIES[e.level];
        if(grant){this.money+=spec.reward;this.kills++;}
        if(spec.behavior!=='bomber')continue;
        const radius=spec.blastRadius*this.worldScale;
        this.effects.push({kind:'bomb-explosion',x:e.x,y:e.y,radius,life:sprites.deathDuration});
        for(const s of this.slots)if(Math.hypot(s.x-e.x,s.y-e.y)<=radius)this.damageTower(s,spec.blastDamage);
        for(const other of this.enemies){
          if(other.hp<=0||other.deathAt!=null||other.escaped||Math.hypot(other.x-e.x,other.y-e.y)>radius)continue;
          other.hp=Math.max(0,other.hp-spec.blastDamage);other.hurtAt=this.time;
          if(other.hp===0)pending.push({enemy:other,reward:true});
        }
      }
    }
    moveEnemy(e,dt) {
      const spec=ENEMIES[e.level],route=this.level.routes[e.routeIndex],speed=spec.speed*this.worldScale,oldX=e.x,oldY=e.y;
      let travel=speed*dt;
      const approach=(point,stop=0)=>{
        const dx=point.x-e.x,dy=point.y-e.y,distance=Math.hypot(dx,dy),step=Math.min(travel,Math.max(0,distance-stop));
        if(distance>0){e.x+=dx/distance*step;e.y+=dy/distance*step;}
        travel-=step;return distance-step;
      };
      let chasing=false;
      if(spec.behavior==='bomber'){
        let target=null,nearest=Infinity;
        for(const s of this.slots){if(!s.level||s.hp<=0)continue;const distance=Math.hypot(s.x-e.x,s.y-e.y);if(distance<nearest){nearest=distance;target=s;}}
        e.targetId=target?.id??null;
        if(target){
          chasing=true;e.offRoute=true;
          const trigger=spec.triggerRange*this.worldScale;
          if(approach(target,trigger)<=trigger+1e-9){this.killEnemy(e,false);return;}
        }else if(e.offRoute){
          // Return to the last route position continuously if every tower was removed.
          if(approach(position(e.distance,route))<=1e-9)e.offRoute=false;
        }
      }
      if(!chasing&&!e.offRoute){
        e.distance+=travel;Object.assign(e,position(e.distance,route));
        if(e.distance>=route.length){e.hp=0;e.escaped=true;this.lives=Math.max(0,this.lives-1);this.effects.push({x:e.x,y:e.y,life:.5,kind:'escape'});}
      }
      e.remaining=route.length-e.distance;e.moving=e.x!==oldX||e.y!==oldY;
      if(e.x!==oldX)e.facing=e.x>oldX?1:-1;else e.facing??=-1;
    }
    attackTowers(dt) {
      for(const e of this.enemies) {
        if(e.hp<=0)continue;
        const spec=ENEMIES[e.level];
        if(!spec.attackDamage)continue;
        e.attackCooldown=Math.max(0,(e.attackCooldown??0)-dt);
        let target=null,nearest=Infinity;
        for(const s of this.slots) {
          if(!s.level||s.hp<=0)continue;
          const distance=Math.hypot(s.x-e.x,s.y-e.y);
          if(distance<=spec.attackRange*this.worldScale&&distance<nearest){target=s;nearest=distance;}
        }
        e.targetId=target?.id??null;
        if(!target||e.attackCooldown>0)continue;
        e.attackCooldown=spec.attackInterval;
        e.attackAt=this.time;
        this.damageTower(target,spec.attackDamage);
        this.effects.push({kind:'enemy-attack',x:e.x,y:e.y,toX:target.x,toY:target.y,life:.18});
      }
    }
    update(dt) {
      if(this.phase!=='playing'){
        if(this.corpses.length){this.time+=dt;this.corpses=this.corpses.filter(e=>this.time-e.deathAt<sprites.deathDuration);}
        return;
      }
      this.time+=dt;this.effects=this.effects.filter(e=>(e.life-=dt)>0);
      this.corpses=this.corpses.filter(e=>this.time-e.deathAt<sprites.deathDuration);
      if(this.countdown>0){this.countdown=Math.max(0,this.countdown-dt);if(this.countdown===0){this.spawnQueue=[...WAVES[this.wave]];this.wave++;this.spawnTimer=0;}}
      if(this.spawnQueue.length){this.spawnTimer-=dt;if(this.spawnTimer<=0){const level=this.spawnQueue.shift(),s=ENEMIES[level],routeIndex=Math.floor(this.random()*this.level.routes.length),route=this.level.routes[routeIndex];this.enemies.push({id:this.nextId++,level,hp:s.hp,maxHp:s.hp,distance:0,routeIndex,remaining:route.length,...position(0,route)});this.spawnTimer=1.35;}}
      for(const e of this.enemies)if(e.hp>0)this.moveEnemy(e,dt);
      if(this.lives===0){this.phase='lost';return;}
      for(const s of this.slots){if(!s.level||s.action)continue;s.cooldown-=dt;if(s.cooldown>0)continue;const spec=TOWERS[s.level];let target=null;for(const e of this.enemies)if(e.hp>0&&Math.hypot(e.x-s.x,e.y-s.y)<=spec.range*this.worldScale&&(!target||e.remaining<target.remaining))target=e;if(target){this.bullets.push({x:s.x,y:s.y,target,damage:spec.damage});s.cooldown=spec.interval;}}
      this.bullets=this.bullets.filter(b=>{const e=b.target;if(e.hp<=0)return false;const d=Math.hypot(e.x-b.x,e.y-b.y);if(d<640*this.worldScale*dt){this.damageEnemy(e,b.damage);return false;}b.x+=(e.x-b.x)/d*640*this.worldScale*dt;b.y+=(e.y-b.y)/d*640*this.worldScale*dt;return true;});
      this.enemies=this.enemies.filter(e=>e.hp>0);
      // Resolve only surviving enemies; attacks never change their path position or movement.
      this.attackTowers(dt);
      this.updateTowerActions(dt);
      if(this.countdown===0&&!this.spawnQueue.length&&!this.enemies.length){if(this.wave===WAVES.length){if(!this.corpses.length)this.phase='won';}else{this.money+=30;this.countdown=8;}}
    }
  }
  const api={Game,MAP_CONFIG,LEVELS,TOWERS,TOWER_MAX_HP,TOWER_ACTIONS,ENEMY_TYPES,ENEMIES,WAVES,position,refundFor};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TD=api;
})(typeof globalThis!=='undefined'?globalThis:this);
