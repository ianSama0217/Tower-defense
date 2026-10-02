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
  const TOWERS = [null, {damage:12,range:155,interval:.68,cost:60}, {damage:27,range:180,interval:.53,cost:80}, {damage:48,range:205,interval:.4,cost:125}];
  const TOWER_MAX_HP = 100;
  const TOWER_ACTIONS = {build:{duration:5},upgrade:{duration:5},repair:{duration:3,cost:50},demolish:{duration:3}};
  const ENEMY_TYPES = {goblin:1,orc:2,cyclops:3,bomber:4,slime:5};
  const ENEMIES = [null,
    {name:'哥布林',behavior:'attacker',detectionRange:64,hp:44,speed:57,reward:11,attackDamage:6,attackRange:32,attackInterval:1.2},
    {name:'獸人',behavior:'attacker',detectionRange:64,hp:112,speed:49,reward:18,attackDamage:10,attackRange:32,attackInterval:1},
    {name:'獨眼巨人',behavior:'attacker',detectionRange:128,hp:245,speed:42,reward:28,attackDamage:15,attackRange:32,attackInterval:0.9},
    {name:'炸彈哥布林',behavior:'bomber',detectionRange:Infinity,hp:60,speed:57,reward:14,attackDamage:0,attackRange:0,attackInterval:0,triggerRange:22,blastRadius:64,blastDamage:60},
    {name:'史萊姆',behavior:'passive',detectionRange:0,hp:32,speed:49,reward:8,attackDamage:0,attackRange:0,attackInterval:0}
  ];
  function makeRoute(points) {
    const path = points.map(([x,y]) => ({x,y}));
    const segments = path.slice(1).map((p,i) => Math.hypot(p.x-path[i].x,p.y-path[i].y));
    return {path,segments,length:segments.reduce((a,b)=>a+b,0)};
  }
  // Scenarios are supplied by callers; the runtime contains no built-in levels.
  function createScenario({paths=[],slots=[],waves=[],worldScale=1,mapConfig=MAP_CONFIG,initialMoney=180,waveRewards=null,manualWaves=false,spawnInterval=1.35}={}) {
    return {mapConfig,worldScale,waves,initialMoney,waveRewards,manualWaves,spawnInterval,routes:paths.map(makeRoute),slots:slots.map(([x,y])=>({x,y}))};
  }
  function enemyRanges(type,worldScale=1) {
    const spec=ENEMIES[type];
    return {detection:(spec.detectionRange??spec.attackRange)*worldScale,attack:spec.attackDamage?spec.attackRange*worldScale:0,trigger:(spec.triggerRange||0)*worldScale,blast:(spec.blastRadius||0)*worldScale};
  }
  function position(distance, level) {
    let d=Math.max(0,distance);
    for(let i=0;i<level.segments.length;i++) {
      if(d<=level.segments[i]) {const t=d/level.segments[i];return {x:level.path[i].x+(level.path[i+1].x-level.path[i].x)*t,y:level.path[i].y+(level.path[i+1].y-level.path[i].y)*t};}
      d-=level.segments[i];
    }
    return {...level.path.at(-1)};
  }
  function refundFor(level) {return Math.floor(TOWERS.slice(1,level+1).reduce((sum,t)=>sum+t.cost,0)*.5);}
  class Game {
    constructor(random=Math.random,scenario=createScenario()){this.random=random;this.reset(scenario);}
    reset(scenario=this.level) {
      if(!scenario||!Array.isArray(scenario.routes)||!Array.isArray(scenario.slots)||!Array.isArray(scenario.waves))throw new TypeError('A scenario is required');
      this.level=scenario;
      this.waves=this.level.waves;
      this.worldScale=this.level.worldScale;
      this.money=this.level.initialMoney??180;this.lives=3;this.wave=0;this.kills=0;this.time=0;this.phase='ready';
      this.awaitingWave=!!this.level.manualWaves&&this.waves.length>0;
      this.countdown=this.waves.length&&!this.awaitingWave?15:Infinity;
      this.enemies=[];this.corpses=[];this.bullets=[];this.effects=[];this.spawnQueue=[];this.spawnTimer=0;this.nextId=1;
      this.slots=this.level.slots.map((s,id)=>({...s,id,level:0,cooldown:0,hp:0,maxHp:TOWER_MAX_HP,destroyedAt:null,action:null}));
    }
    start(scenario=this.level){this.reset(scenario);this.phase='playing';}
    startNextWave() {
      if(this.phase!=='playing'||!this.awaitingWave||this.wave>=this.waves.length)return false;
      this.awaitingWave=false;this.countdown=0;this.spawnQueue=[...this.waves[this.wave++]];this.spawnTimer=0;
      this.sound?.playWaveStart();
      return true;
    }
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
      s.action={kind:'build',elapsed:0,duration:TOWER_ACTIONS.build.duration,cost};
      return{ok:true,message:'建造開始，5 秒後完成並開始攻擊。'};
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
          if(action.refund>0)this.sound?.playCoin();
          this.effects.push({kind:'demolition',x:s.x,y:s.y,level:s.level,material:s.level===1?'wood':'stone',life:.85,duration:.85});
          s.level=0;s.hp=0;s.destroyedAt=null;
        }else{
          if(action.kind==='upgrade')s.level=action.targetLevel;
          if(action.kind!=='build')s.hp=s.maxHp=TOWER_MAX_HP;
          if(action.kind==='upgrade')this.sound?.playUpgrade();
          else this.sound?.playBuild();
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
        this.sound?.playEnemyDeath();
        const spec=ENEMIES[e.level];
        if(grant){this.money+=spec.reward;this.kills++;this.sound?.playCoin();}
        if(spec.behavior!=='bomber')continue;
        const radius=enemyRanges(e.level,this.worldScale).blast;
        this.effects.push({kind:'bomb-explosion',x:e.x,y:e.y,radius,life:sprites.deathDuration});
        this.sound?.playExplosion();
        for(const s of this.slots)if(Math.hypot(s.x-e.x,s.y-e.y)<=radius)this.damageTower(s,spec.blastDamage);
        for(const other of this.enemies){
          if(other.hp<=0||other.deathAt!=null||other.escaped||Math.hypot(other.x-e.x,other.y-e.y)>radius)continue;
          other.hp=Math.max(0,other.hp-spec.blastDamage);other.hurtAt=this.time;
          if(other.hp===0)pending.push({enemy:other,reward:true});
        }
      }
    }
    attackTarget(e) {
      if(!ENEMIES[e.level].attackDamage)return null;
      const range=enemyRanges(e.level,this.worldScale).detection;
      const valid=s=>s&&s.level>0&&s.hp>0;
      // Keep attacking the same tower until it disappears; new towers cannot lure a locked enemy away.
      let target=this.slots.find(s=>s.id===e.targetId);
      if(!valid(target)){
        target=null;let nearest=Infinity;
        for(const s of this.slots){
          if(!valid(s))continue;
          const distance=Math.hypot(s.x-e.x,s.y-e.y);
          if(distance>range+1e-7)continue;
          if(distance<nearest){nearest=distance;target=s;}
        }
      }
      e.targetId=target?.id??null;
      return target;
    }
    stopToAttack(e,target) {
      e.moving=false;
      if(target.x!==e.x)e.facing=target.x>e.x?1:-1;
      else e.facing??=1;
    }
    detectionStopDistance(e,travel) {
      // Sweep the route against tower ranges so a large update cannot skip a tower or a bend.
      const route=this.level.routes[e.routeIndex],range=enemyRanges(e.level,this.worldScale).detection;
      let stop=Math.min(route.length,e.distance+travel),offset=0;
      for(let i=0;i<route.segments.length;i++){
        const length=route.segments[i],a=route.path[i],b=route.path[i+1];
        if(length>0&&offset+length>=e.distance&&offset<=stop){
          const from=Math.max(0,e.distance-offset),to=Math.min(length,stop-offset);
          const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length;
          for(const s of this.slots){
            if(!s.level||s.hp<=0)continue;
            const dx=s.x-a.x,dy=s.y-a.y,along=dx*ux+dy*uy;
            const perpendicular=dx*uy-dy*ux,disc=range*range-perpendicular*perpendicular;
            if(disc<0)continue;
            const half=Math.sqrt(disc),entry=Math.max(from,along-half);
            if(entry<=to&&entry<=along+half)stop=Math.min(stop,offset+entry);
          }
        }
        offset+=length;
      }
      return stop;
    }
    moveEnemy(e,dt) {
      const spec=ENEMIES[e.level],route=this.level.routes[e.routeIndex],speed=spec.speed*this.worldScale,oldX=e.x,oldY=e.y;
      let travel=speed*dt;
      const approach=(point,stop=0)=>{
        const dx=point.x-e.x,dy=point.y-e.y,distance=Math.hypot(dx,dy),step=Math.min(travel,Math.max(0,distance-stop));
        if(distance>0){e.x+=dx/distance*step;e.y+=dy/distance*step;}
        travel-=step;return distance-step;
      };
      let chasing=false,attackTarget=null;
      const pursue=target=>{
        chasing=true;attackTarget=target;
        approach(target,enemyRanges(e.level,this.worldScale).attack);
        // Preserve forward progress when pursuit stays on the current route segment.
        let offset=0;
        for(let i=0;i<route.segments.length;i++){
          const length=route.segments[i];
          if(length>0&&e.distance<offset+length){
            const a=route.path[i],b=route.path[i+1],ux=(b.x-a.x)/length,uy=(b.y-a.y)/length;
            const dx=e.x-a.x,dy=e.y-a.y,along=dx*ux+dy*uy;
            if(Math.abs(dx*uy-dy*ux)<1e-7&&along>=e.distance-offset&&along<=length)e.distance=offset+along;
            break;
          }
          offset+=length;
        }
        const anchor=position(e.distance,route);
        e.offRoute=Math.hypot(e.x-anchor.x,e.y-anchor.y)>1e-7;
      };
      if(spec.attackDamage){
        const target=this.attackTarget(e);
        if(target)pursue(target);
        else if(e.offRoute&&approach(position(e.distance,route))<=1e-9)e.offRoute=false;
      }
      if(spec.behavior==='bomber'){
        let target=null,nearest=Infinity;
        for(const s of this.slots){if(!s.level||s.hp<=0)continue;const distance=Math.hypot(s.x-e.x,s.y-e.y);if(distance<=enemyRanges(e.level,this.worldScale).detection&&distance<nearest){nearest=distance;target=s;}}
        e.targetId=target?.id??null;
        if(target){
          chasing=true;e.offRoute=true;
          const trigger=enemyRanges(e.level,this.worldScale).trigger;
          if(approach(target,trigger)<=trigger+1e-9){this.killEnemy(e,false);return;}
        }else if(e.offRoute){
          // Return to the last route position continuously if every tower was removed.
          if(approach(position(e.distance,route))<=1e-9)e.offRoute=false;
        }
      }
      if(!chasing&&!e.offRoute){
        const before=e.distance;
        e.distance=spec.attackDamage?this.detectionStopDistance(e,travel):e.distance+travel;
        travel=Math.max(0,travel-(e.distance-before));
        Object.assign(e,position(e.distance,route));
        if(spec.attackDamage){const target=this.attackTarget(e);if(target)pursue(target);}
        if(!chasing&&e.distance>=route.length){e.hp=0;e.escaped=true;this.lives=Math.max(0,this.lives-1);this.effects.push({x:e.x,y:e.y,life:.5,kind:'escape'});}
      }
      e.remaining=route.length-e.distance;e.moving=e.x!==oldX||e.y!==oldY;
      if(e.x!==oldX)e.facing=e.x>oldX?1:-1;else e.facing??=-1;
      if(attackTarget&&Math.hypot(attackTarget.x-e.x,attackTarget.y-e.y)<=enemyRanges(e.level,this.worldScale).attack+1e-7)this.stopToAttack(e,attackTarget);
    }
    attackTowers(dt) {
      for(const e of this.enemies) {
        if(e.hp<=0)continue;
        const spec=ENEMIES[e.level];
        if(!spec.attackDamage)continue;
        e.attackCooldown=Math.max(0,(e.attackCooldown??0)-dt);
        const target=this.attackTarget(e);
        if(!target||Math.hypot(target.x-e.x,target.y-e.y)>enemyRanges(e.level,this.worldScale).attack+1e-7)continue;
        this.stopToAttack(e,target);
        if(e.attackCooldown>0)continue;
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
      if(this.countdown>0){this.countdown=Math.max(0,this.countdown-dt);if(this.countdown===0){this.spawnQueue=[...this.waves[this.wave]];this.wave++;this.spawnTimer=0;this.sound?.playWaveStart();}}
      if(this.spawnQueue.length){this.spawnTimer-=dt;if(this.spawnTimer<=0){const level=this.spawnQueue.shift(),s=ENEMIES[level],routeIndex=Math.floor(this.random()*this.level.routes.length),route=this.level.routes[routeIndex];this.enemies.push({id:this.nextId++,level,hp:s.hp,maxHp:s.hp,distance:0,routeIndex,remaining:route.length,...position(0,route)});this.spawnTimer=this.level.spawnInterval??1.35;}}
      for(const e of this.enemies)if(e.hp>0)this.moveEnemy(e,dt);
      if(this.lives===0){this.phase='lost';return;}
      for(const s of this.slots){if(!s.level||s.action)continue;s.cooldown-=dt;if(s.cooldown>0)continue;const spec=TOWERS[s.level];let target=null;for(const e of this.enemies)if(e.hp>0&&Math.hypot(e.x-s.x,e.y-s.y)<=spec.range*this.worldScale&&(!target||e.remaining<target.remaining))target=e;if(target){this.bullets.push({x:s.x,y:s.y,target,damage:spec.damage});this.sound?.playArrow(s.level);s.cooldown=spec.interval;}}
      this.bullets=this.bullets.filter(b=>{const e=b.target;if(e.hp<=0)return false;const d=Math.hypot(e.x-b.x,e.y-b.y);if(d<640*this.worldScale*dt){this.sound?.playHit();this.damageEnemy(e,b.damage);return false;}b.x+=(e.x-b.x)/d*640*this.worldScale*dt;b.y+=(e.y-b.y)/d*640*this.worldScale*dt;return true;});
      this.enemies=this.enemies.filter(e=>e.hp>0);
      // Resolve only surviving enemies, keeping their target locked while approaching or attacking.
      this.attackTowers(dt);
      this.updateTowerActions(dt);
      if(this.countdown===0&&!this.spawnQueue.length&&!this.enemies.length){if(this.wave===this.waves.length){if(!this.corpses.length)this.phase='won';}else if(!this.level.manualWaves||!this.corpses.length){
        this.money+=this.level.waveRewards?.[this.wave-1]??30;
        if((this.level.waveRewards?.[this.wave-1]??30)>0)this.sound?.playCoin();
        this.awaitingWave=!!this.level.manualWaves;this.countdown=this.awaitingWave?Infinity:8;
      }}
    }
  }
  const api={Game,MAP_CONFIG,createScenario,TOWERS,TOWER_MAX_HP,TOWER_ACTIONS,ENEMY_TYPES,ENEMIES,enemyRanges,position,refundFor};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TD=api;
})(typeof globalThis!=='undefined'?globalThis:this);
