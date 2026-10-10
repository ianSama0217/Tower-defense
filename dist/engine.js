(function(root) {
  'use strict';
  const sprites=typeof module!=='undefined'&&module.exports?require('./enemy-sprites.js'):root.EnemySprites;
  const CAMPAIGN_WORLD_SCALE = 2;
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
  const TOWERS = [null, {damage:12,range:95,interval:.65,cost:60}, {damage:18,range:95,interval:.55,cost:80}, {damage:24,range:115,interval:.5,cost:125}];
  const TOWER_MAX_HP = 100;
  const WALL = {cost:10,limit:3,hp:300,length:36,thickness:16,detectionRange:64,attackDamage:6,attackRange:12,attackInterval:1.2};
  const FENCE = {...WALL,hp:150,name:'柵欄',type:'fence',material:'wood'};
  function wallSize(orientation,scale=1,roadWidth=WALL.length*scale){const thickness=Math.min(roadWidth,WALL.thickness*scale);return orientation==='vertical'?{width:thickness,height:roadWidth}:{width:roadWidth,height:thickness};}
  function targetPoint(target,from){
    if(target.kind!=='wall')return target;
    return {x:Math.max(target.x-target.width/2,Math.min(target.x+target.width/2,from.x)),y:Math.max(target.y-target.height/2,Math.min(target.y+target.height/2,from.y))};
  }
  function targetDistance(target,from){const p=targetPoint(target,from);return Math.hypot(p.x-from.x,p.y-from.y);}
  const TOWER_ACTIONS = {build:{duration:5},upgrade:{duration:5},repair:{duration:3,cost:50},demolish:{duration:3}};
  const ENEMY_TYPES = {goblin:1,orc:2,cyclops:3,bomber:4,slime:5,archer:6};
  // Compact ground footprints leave room for crowds to reach a building's attack perimeter.
  const ENEMY_RADII = [0,5,7,10,6,5,5];
  const enemyRadius=(type,worldScale=1)=>(ENEMY_RADII[type]??8)*worldScale;
  const ENEMIES = [null,
    {name:'哥布林',behavior:'attacker',detectionRange:64,hp:44,speed:57,reward:11,attackDamage:6,attackRange:32,attackInterval:1.2},
    {name:'獸人',behavior:'attacker',detectionRange:64,hp:112,speed:49,reward:18,attackDamage:10,attackRange:32,attackInterval:1,chargeDamage:120,chargeSpeedMultiplier:1.5,chargeBreakDamage:50},
    {name:'獨眼巨人',behavior:'attacker',detectionRange:128,hp:245,speed:42,reward:28,attackDamage:15,attackRange:32,attackInterval:0.9},
    {name:'炸彈哥布林',behavior:'bomber',detectionRange:Infinity,hp:60,speed:57,reward:14,attackDamage:0,attackRange:0,attackInterval:0,triggerRange:22,blastRadius:64,blastDamage:60},
    {name:'史萊姆',behavior:'passive',detectionRange:0,hp:32,speed:49,reward:8,attackDamage:0,attackRange:0,attackInterval:0},
    {name:'哥布林弓箭手',behavior:'archer',detectionRange:90,hp:40,speed:49,reward:12,attackDamage:6,attackRange:112,attackInterval:1.4,attackWindup:.2,projectileSpeed:220}
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
      // Later stages share one road width; the first two keep their legacy layouts.
      this.level=Number.isInteger(scenario.stageIndex)&&scenario.stageIndex>=2?{...scenario,mapConfig:{...scenario.mapConfig,roadWidth:MAP_CONFIG.roadWidth}}:scenario;
      this.waves=this.level.waves;
      this.worldScale=this.level.worldScale;
      this.money=this.level.initialMoney??180;this.lives=3;this.wave=0;this.kills=0;this.towersBuilt=0;this.time=0;this.phase='ready';
      this.awaitingWave=!!this.level.manualWaves&&this.waves.length>0;
      this.countdown=this.waves.length&&!this.awaitingWave?15:Infinity;
      this.enemies=[];this.corpses=[];this.bullets=[];this.enemyArrows=[];this.effects=[];this.spawnQueue=[];this.pendingSpawns=[];this.spawnTimer=0;this.nextId=1;
      this.lastEnemySpawnAt=null;
      this.nextTowerId=1;
      this.walls=[];this.wallsUsed=0;
      this.wallsUnlocked=!!scenario.wallsUnlocked;
      this.slots=this.level.slots.map((s,id)=>({...s,id,level:0,cooldown:0,hp:0,maxHp:TOWER_MAX_HP,destroyedAt:null,action:null,towerId:null,kills:0}));
    }
    start(scenario=this.level){this.reset(scenario);this.phase='playing';}
    get roadBuilding(){return this.level.roadBuilding==='fence'?FENCE:{...WALL,name:'城牆',type:'wall',material:'stone'};}
    get wallsRemaining(){return this.roadBuilding.limit-this.wallsUsed;}
    wallAvailability(){
      const {name,cost,limit}=this.roadBuilding;
      if(this.phase!=='playing')return {ok:false,message:`目前無法放置${name}。`};
      if(Number.isInteger(this.level.stageIndex)){
        if(this.level.stageIndex<2)return {ok:false,message:'城牆是第二關通關獎勵，從第三關開始使用。'};
        if(!this.wallsUnlocked)return {ok:false,message:`通過第二關後解鎖${name}。`};
      }
      if(!this.wallsRemaining)return {ok:false,message:`本場 ${limit} 個${name}已用完，摧毀後不會補回。`};
      if(this.money<cost)return {ok:false,message:`金幣不足，${name}需要 ${cost} 金幣。`};
      return {ok:true};
    }
    buildingBlockReason(x,y,width,height){
      const distance=(this.level.entranceProtectionTiles||0)*this.level.mapConfig.roadWidth;
      if(!distance)return '';
      const half=this.level.mapConfig.roadWidth/2;
      for(const route of this.level.routes){
        let remaining=distance;
        for(let i=0;i<route.segments.length&&remaining>0;i++){
          const length=route.segments[i];if(!length)continue;
          const a=route.path[i],b=route.path[i+1],span=Math.min(remaining,length);
          const end={x:a.x+(b.x-a.x)*span/length,y:a.y+(b.y-a.y)*span/length},horizontal=a.y===b.y;
          const left=Math.min(a.x,end.x)-(horizontal?0:half),top=Math.min(a.y,end.y)-(horizontal?half:0);
          const right=Math.max(a.x,end.x)+(horizontal?0:half),bottom=Math.max(a.y,end.y)+(horizontal?half:0);
          if(x-width/2<right&&x+width/2>left&&y-height/2<bottom&&y+height/2>top)return '敵人入口前兩格為禁建區，不能放置建築。';
          remaining-=span;
        }
      }
      return '';
    }
    canPlaceWall(x,y,orientation='horizontal'){
      const available=this.wallAvailability();if(!available.ok)return available;
      return this.wallPlacement(x,y,orientation);
    }
    // Geometry is separate from price/stock so valid ground remains selectable.
    wallPlacement(x,y,orientation='horizontal'){
      const name=this.roadBuilding.name;
      if(!Number.isFinite(x)||!Number.isFinite(y)||!['horizontal','vertical'].includes(orientation))return {ok:false,message:'請選擇有效的位置與方向。'};
      const map=this.level.mapConfig,size=wallSize(orientation,this.worldScale,map.roadWidth);
      // Snap to the nearest road segment and half-tile steps along its centerline.
      // Keep the transverse span equal to the actual road width, including non-tile multiples.
      let snapped=null,nearest=Infinity;
      for(const route of this.level.routes)for(let i=0;i<route.segments.length;i++){
        const length=route.segments[i];if(!length)continue;
        const a=route.path[i],b=route.path[i+1],ux=(b.x-a.x)/length,uy=(b.y-a.y)/length;
        const along=Math.max(0,Math.min(length,(x-a.x)*ux+(y-a.y)*uy));
        const distance=Math.hypot(x-a.x-along*ux,y-a.y-along*uy);
        if(distance<nearest){nearest=distance;const step=map.tileSize/2,grid=Math.max(0,Math.min(length,Math.round(along/step)*step));snapped={x:a.x+grid*ux,y:a.y+grid*uy};}
      }
      if(!snapped||nearest>map.roadWidth/2)return {ok:false,message:`${name}必須放在道路範圍內。`};
      ({x,y}=snapped);
      const blocked=this.buildingBlockReason(x,y,size.width,size.height);if(blocked)return {ok:false,message:blocked};
      const onRoad=(px,py)=>this.level.routes.some(route=>route.segments.some((length,i)=>{
        if(!length)return false;const a=route.path[i],b=route.path[i+1],t=Math.max(0,Math.min(1,((px-a.x)*(b.x-a.x)+(py-a.y)*(b.y-a.y))/(length*length)));
        return Math.hypot(px-a.x-t*(b.x-a.x),py-a.y-t*(b.y-a.y))<=map.roadWidth/2;
      }));
      for(const dx of [-size.width/2,0,size.width/2])for(const dy of [-size.height/2,0,size.height/2]){
        if(x+dx<0||x+dx>map.width||y+dy<0||y+dy>map.height||!onRoad(x+dx,y+dy))return {ok:false,message:`${name}必須完整放在道路範圍內。`};
      }
      if(this.walls.some(w=>w.hp>0&&Math.abs(w.x-x)<(w.width+size.width)/2+4&&Math.abs(w.y-y)<(w.height+size.height)/2+4)||this.slots.some(s=>Math.abs(s.x-x)<(map.towerSlotSize+size.width)/2&&Math.abs(s.y-y)<(map.towerSlotSize+size.height)/2))return {ok:false,message:`此處已有${name}或建造臺座。`};
      if(this.enemies.some(e=>e.hp>0&&Math.abs(e.x-x)<size.width/2+enemyRadius(e.level,this.worldScale)&&Math.abs(e.y-y)<size.height/2+enemyRadius(e.level,this.worldScale)))return {ok:false,message:'此處有敵人，請選擇空的道路。'};
      return {ok:true,placement:{x,y,orientation,...size}};
    }
    placeWall(x,y,orientation='horizontal'){
      const result=this.canPlaceWall(x,y,orientation);if(!result.ok)return result;
      const spec=this.roadBuilding;
      this.money-=spec.cost;this.wallsUsed++;
      const wall={id:-this.wallsUsed,kind:'wall',buildingType:spec.type,material:spec.material,...result.placement,level:1,hp:spec.hp,maxHp:spec.hp,towerId:this.nextTowerId++,destroyedAt:null};
      wall.blockedTime=0;
      this.walls.push(wall);this.sound?.playBuild();
      return {ok:true,wall,message:`已放置${spec.name}，剩餘 ${this.wallsRemaining} 個；無法修復。`};
    }
    wallTarget(e){
      const range=Math.max(WALL.detectionRange,enemyRanges(e.level,this.worldScale).detection/this.worldScale)*this.worldScale;
      const locked=this.walls.find(w=>w.id===e.targetId&&w.hp>0);
      if(locked)return locked;
      let target=null,nearest=Infinity;
      for(const wall of this.walls){const distance=Math.hypot(wall.x-e.x,wall.y-e.y);if(wall.hp>0&&distance<=range+Math.hypot(wall.width,wall.height)/2+1e-7&&distance<nearest){target=wall;nearest=distance;}}
      return target;
    }
    isCharging(e){return !!ENEMIES[e.level].chargeDamage&&!e.chargeConsumed;}
    attackRange(e,target){
      // Towers use their 32px footprint radius; walls use their nearest edge plus the orc's body radius.
      if(this.isCharging(e))return (target?.kind==='wall'?8:32)*this.worldScale;
      return target?.kind==='wall'&&!ENEMIES[e.level].attackDamage?WALL.attackRange*this.worldScale:enemyRanges(e.level,this.worldScale).attack;
    }
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
      const blocked=this.buildingBlockReason(s.x,s.y,this.level.mapConfig.towerSlotSize,this.level.mapConfig.towerSlotSize);
      if(blocked)return{ok:false,message:blocked};
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
      s.towerId=this.nextTowerId++;s.kills=0;
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
          if(action.kind==='build')this.towersBuilt++;
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
      this.effects.push({kind:'damage',x:target.x,y:target.y,amount:Math.min(target.hp,damage),life:.7});
      target.hp=Math.max(0,target.hp-damage);
      if(target.hp===0){
        target.level=0;target.cooldown=0;target.action=null;target.destroyedAt=this.time;
        this.effects.push({kind:'destroyed',x:target.x,y:target.y,life:.5});
      }
    }
    resolveEnemyExit(enemy) {
      enemy.hp=0;enemy.escaped=true;this.lives=Math.max(0,this.lives-1);
      this.effects.push({x:enemy.x,y:enemy.y,life:.5,kind:'escape'});
    }
    recordChargeDamage(enemy,damage) {
      if(!this.isCharging(enemy))return;
      enemy.chargeDamageTaken=(enemy.chargeDamageTaken||0)+damage;
      if(enemy.chargeDamageTaken>=ENEMIES[enemy.level].chargeBreakDamage){
        enemy.chargeConsumed=true;enemy.charging=false;
      }
    }
    damageEnemy(enemy,damage,sourceTowerId=null) {
      if(enemy.hp<=0||enemy.deathAt!=null||enemy.escaped)return;
      this.recordChargeDamage(enemy,Math.min(enemy.hp,damage));
      this.effects.push({kind:'damage',x:enemy.x,y:enemy.y,amount:Math.min(enemy.hp,damage),life:.7});
      enemy.hp=Math.max(0,enemy.hp-damage);enemy.hurtAt=this.time;
      if(enemy.hp===0)this.killEnemy(enemy,true,sourceTowerId);
    }
    killEnemy(enemy,reward=true,sourceTowerId=null) {
      // Queue chain reactions: each death, blast, reward and corpse is resolved exactly once.
      const pending=[{enemy,reward}];
      for(let i=0;i<pending.length;i++){
        const {enemy:e,reward:grant}=pending[i];
        if(e.deathAt!=null||e.escaped)continue;
        e.hp=0;e.deathAt=this.time;e.moving=false;e.targetId=null;
        this.corpses.push({...e});
        this.sound?.playEnemyDeath();
        const spec=ENEMIES[e.level];
        if(grant){
          this.money+=spec.reward;this.kills++;this.sound?.playCoin();
          // The projectile remembers the building instance, never just a reusable pad.
          const tower=sourceTowerId==null?null:this.slots.find(s=>s.towerId===sourceTowerId&&s.level>0&&s.hp>0);
          if(tower)tower.kills=(tower.kills||0)+1;
        }
        if(spec.behavior!=='bomber')continue;
        const radius=enemyRanges(e.level,this.worldScale).blast;
        this.effects.push({kind:'bomb-explosion',x:e.x,y:e.y,radius,life:sprites.deathDuration});
        this.sound?.playExplosion();
        for(const s of [...this.slots,...this.walls])if(targetDistance(s,e)<=radius)this.damageTower(s,spec.blastDamage);
        for(const other of this.enemies){
          if(other.hp<=0||other.deathAt!=null||other.escaped||Math.hypot(other.x-e.x,other.y-e.y)>radius)continue;
          this.recordChargeDamage(other,Math.min(other.hp,spec.blastDamage));
          this.effects.push({kind:'damage',x:other.x,y:other.y,amount:Math.min(other.hp,spec.blastDamage),life:.7});
          other.hp=Math.max(0,other.hp-spec.blastDamage);other.hurtAt=this.time;
          if(other.hp===0)pending.push({enemy:other,reward:true});
        }
      }
    }
    attackTarget(e) {
      const wall=this.wallTarget(e);if(wall){e.targetId=wall.id;return wall;}
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
          for(const s of [...this.slots,...this.walls]){
            if(!s.level||s.hp<=0)continue;
            if(s.kind!=='wall'&&!ENEMIES[e.level].attackDamage)continue;
            const detection=s.kind==='wall'?Math.max(range,WALL.detectionRange*this.worldScale)+Math.hypot(s.width,s.height)/2:range;
            const dx=s.x-a.x,dy=s.y-a.y,along=dx*ux+dy*uy;
            const perpendicular=dx*uy-dy*ux,disc=detection*detection-perpendicular*perpendicular;
            if(disc<0)continue;
            const half=Math.sqrt(disc),entry=Math.max(from,along-half);
            if(entry<=to&&entry<=along+half)stop=Math.min(stop,offset+entry);
          }
        }
        offset+=length;
      }
      return stop;
    }
    enemySpaceFree(e,x,y) {
      const radius=enemyRadius(e.level,this.worldScale);
      return !this.enemies.some(other=>other!==e&&other.hp>0&&!other.escaped&&other.deathAt==null&&
        Math.hypot(x-other.x,y-other.y)<radius+enemyRadius(other.level,this.worldScale)-1e-7);
    }
    onEnemyRoad(e,x,y) {
      const half=Math.max(0,this.level.mapConfig.roadWidth/2-enemyRadius(e.level,this.worldScale));
      return this.level.routes[e.routeIndex].segments.some((length,i)=>{
        if(!length)return false;
        const a=this.level.routes[e.routeIndex].path[i],b=this.level.routes[e.routeIndex].path[i+1];
        const t=Math.max(0,Math.min(1,((x-a.x)*(b.x-a.x)+(y-a.y)*(b.y-a.y))/(length*length)));
        return Math.hypot(x-a.x-t*(b.x-a.x),y-a.y-t*(b.y-a.y))<=half+1e-7;
      });
    }
    enemyStepFraction(e,dx,dy) {
      const length=Math.hypot(dx,dy);if(length<1e-9)return 1;
      const ux=dx/length,uy=dy/length,radius=enemyRadius(e.level,this.worldScale);
      let allowed=length;
      // Swept circles prevent fast enemies and large updates from passing through a body.
      for(const other of this.enemies){
        if(other===e||other.hp<=0||other.escaped||other.deathAt!=null)continue;
        const ox=other.x-e.x,oy=other.y-e.y,along=ox*ux+oy*uy;
        if(along<=0)continue;
        const clearance=radius+enemyRadius(other.level,this.worldScale),side=ox*uy-oy*ux;
        if(Math.abs(side)>=clearance)continue;
        allowed=Math.min(allowed,Math.max(0,along-Math.sqrt(clearance*clearance-side*side)-1e-6));
      }
      // Avoidance must not provide a shortcut through an intact wall.
      for(const wall of this.walls){
        if(wall.hp<=0)continue;
        const margin=8*this.worldScale;
        let entry=0,exit=1;
        for(const [origin,delta,center,half] of [[e.x,dx,wall.x,wall.width/2+margin],[e.y,dy,wall.y,wall.height/2+margin]]){
          if(Math.abs(delta)<1e-9){if(origin<=center-half||origin>=center+half){exit=-1;break;}continue;}
          let a=(center-half-origin)/delta,b=(center+half-origin)/delta;
          if(a>b)[a,b]=[b,a];entry=Math.max(entry,a);exit=Math.min(exit,b);
        }
        if(entry<exit&&exit>0&&entry<=1)allowed=Math.min(allowed,Math.max(0,entry*length));
      }
      return allowed/length;
    }
    moveEnemyBody(e,dx,dy,onRoad=false) {
      const length=Math.hypot(dx,dy);if(length<1e-9)return 0;
      const fraction=this.enemyStepFraction(e,dx,dy);
      if(fraction>=1-1e-9){e.x+=dx;e.y+=dy;return length;}
      const ux=dx/length,uy=dy/length,step=Math.min(length,enemyRadius(e.level,this.worldScale)/2);
      // Use a consistent right-hand preference at head-on merges; never push a waiting attacker.
      let best={dx:dx*fraction,dy:dy*fraction,score:length*fraction};
      const directions=[Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2].map(angle=>{
        const c=Math.cos(angle),s=Math.sin(angle);return {vx:ux*c-uy*s,vy:ux*s+uy*c};
      });
      // Exact tangents let a body leave a tight pocket between two neighbours.
      for(const other of this.enemies){
        if(other===e||other.hp<=0||other.escaped||other.deathAt!=null)continue;
        const ox=e.x-other.x,oy=e.y-other.y,d=Math.hypot(ox,oy);
        if(d<1e-9||d>enemyRadius(e.level,this.worldScale)+enemyRadius(other.level,this.worldScale)+step)continue;
        for(const side of [1,-1]){
          const vx=(-oy*side+ox*.025)/d,vy=(ox*side+oy*.025)/d,n=Math.hypot(vx,vy);
          directions.push({vx:vx/n,vy:vy/n});
        }
      }
      for(const {vx,vy} of directions){
        if(this.enemyStepFraction(e,vx*step,vy*step)<1-1e-9)continue;
        const x=e.x+vx*step,y=e.y+vy*step;
        if(onRoad&&!this.onEnemyRoad(e,x,y))continue;
        const score=step*(.2+.8*(vx*ux+vy*uy));
        if(score>best.score+1e-9)best={dx:vx*step,dy:vy*step,score};
      }
      e.x+=best.dx;e.y+=best.dy;return Math.hypot(best.dx,best.dy);
    }
    separateEnemyOverlaps() {
      // Hand-placed test scenes may start with overlapping bodies. Only relocate the later body.
      const settled=[];
      for(const e of this.enemies){
        if(e.hp<=0||e.escaped||e.deathAt!=null)continue;
        const radius=enemyRadius(e.level,this.worldScale),free=(x,y)=>settled.every(other=>
          Math.hypot(x-other.x,y-other.y)>=radius+enemyRadius(other.level,this.worldScale)-1e-7)&&
          this.walls.every(w=>w.hp<=0||targetDistance(w,{x,y})>=8*this.worldScale);
        if(!free(e.x,e.y)){
          const onRoad=this.onEnemyRoad(e,e.x,e.y),x=e.x,y=e.y;
          const ahead=position(e.distance+1,this.level.routes[e.routeIndex]),anchor=position(e.distance,this.level.routes[e.routeIndex]);
          const forward=Math.atan2(ahead.y-anchor.y,ahead.x-anchor.x);
          search:for(let ring=1;ring<=this.enemies.length*4;ring++)for(let i=0;i<16;i++){
            const angle=forward+i*Math.PI/8,px=x+Math.cos(angle)*ring*radius/2,py=y+Math.sin(angle)*ring*radius/2;
            if((!onRoad||this.onEnemyRoad(e,px,py))&&free(px,py)){
              e.x=px;e.y=py;e.offRoute=true;break search;
            }
          }
        }
        settled.push(e);
      }
    }
    nearestRoutePoint(e) {
      const route=this.level.routes[e.routeIndex];
      let nearest={...route.path[0],distance:0},gap=Infinity,offset=0;
      // Project onto every segment of this enemy's route, including bends ahead of its old anchor.
      for(let i=0;i<route.segments.length;i++){
        const length=route.segments[i],a=route.path[i],b=route.path[i+1];
        if(length>0){
          const t=Math.max(0,Math.min(1,((e.x-a.x)*(b.x-a.x)+(e.y-a.y)*(b.y-a.y))/(length*length)));
          const point={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,distance:offset+length*t};
          const separation=Math.hypot(e.x-point.x,e.y-point.y);
          // At equally close branches, prefer the one nearest the previous route progress.
          if(separation<gap-1e-7||Math.abs(separation-gap)<=1e-7&&Math.abs(point.distance-e.distance)<Math.abs(nearest.distance-e.distance)){
            nearest=point;gap=separation;
          }
        }
        offset+=length;
      }
      return nearest;
    }
    moveEnemy(e,dt) {
      e.charging=this.isCharging(e);
      const spec=ENEMIES[e.level],route=this.level.routes[e.routeIndex],speed=spec.speed*this.worldScale*(e.charging?spec.chargeSpeedMultiplier:1),oldX=e.x,oldY=e.y;
      let travel=speed*dt;
      const approach=(point,stop=0)=>{
        const dx=point.x-e.x,dy=point.y-e.y,distance=Math.hypot(dx,dy),step=Math.min(travel,Math.max(0,distance-stop));
        if(distance>0)this.moveEnemyBody(e,dx/distance*step,dy/distance*step);
        travel-=step;return Math.hypot(point.x-e.x,point.y-e.y);
      };
      const returnToRoute=()=>{
        const point=this.nearestRoutePoint(e);
        // Keep moving through a crowded road corridor instead of waiting for one shared pixel.
        if(!this.enemySpaceFree(e,point.x,point.y)&&this.onEnemyRoad(e,e.x,e.y)){
          e.distance=point.distance;e.offRoute=false;
        }else if(approach(point)<=1e-9){Object.assign(e,point);e.offRoute=false;}
      };
      let chasing=false,attackTarget=null;
      const pursue=target=>{
        chasing=true;attackTarget=target;
        const range=this.attackRange(e,target),distance=targetDistance(target,e),radius=enemyRadius(e.level,this.worldScale);
        // A front rank standing at maximum reach must leave room for the next rank to attack.
        // Only ordinary melee crowds close in; ranged units and charge contact retain their distances.
        const crowded=spec.behavior==='attacker'&&!e.charging&&distance<=range+1e-7&&this.enemies.some(other=>
          other!==e&&other.hp>0&&other.deathAt==null&&!other.escaped&&other.targetId===target.id&&
          targetDistance(target,other)>distance+1e-7&&
          Math.hypot(other.x-e.x,other.y-e.y)<=radius+enemyRadius(other.level,this.worldScale)+4*this.worldScale);
        const stop=crowded?Math.min(range,target.kind==='wall'?8*this.worldScale:range/2):range;
        approach(targetPoint(target,e),stop);
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
      if(spec.behavior!=='bomber'){
        const target=this.attackTarget(e);
        if(target)pursue(target);
        else if(e.offRoute)returnToRoute();
      }
      if(spec.behavior==='bomber'){
        let target=this.wallTarget(e),nearest=Infinity;
        if(!target)for(const s of this.slots){if(!s.level||s.hp<=0)continue;const distance=Math.hypot(s.x-e.x,s.y-e.y);if(distance<=enemyRanges(e.level,this.worldScale).detection&&distance<nearest){nearest=distance;target=s;}}
        e.targetId=target?.id??null;
        if(target){
          chasing=true;e.offRoute=true;
          const trigger=enemyRanges(e.level,this.worldScale).trigger;
          if(approach(targetPoint(target,e),trigger)<=trigger+1e-9){this.killEnemy(e,false);return;}
        }else if(e.offRoute){
          // Rejoin the nearest part of the assigned route if every tower was removed.
          returnToRoute();
        }
      }
      if(!chasing&&!e.offRoute){
        // Move each segment continuously so bends, merges and lateral avoidance share the same sweep.
        while(travel>1e-9&&e.distance<route.length){
          let offset=0,index=0;
          while(index<route.segments.length-1&&offset+route.segments[index]<=e.distance+1e-9)offset+=route.segments[index++];
          const length=route.segments[index],a=route.path[index],b=route.path[index+1];
          if(!length)break;
          // A crowd need not occupy the exact same corner pixel to enter the next road segment.
          if(index<route.segments.length-1&&Math.hypot(e.x-b.x,e.y-b.y)<=Math.min(this.level.mapConfig.roadWidth/2,enemyRadius(e.level,this.worldScale)*2)){
            e.distance=offset+length;continue;
          }
          const stop=spec.attackDamage||this.walls.some(w=>w.hp>0)?this.detectionStopDistance(e,travel):e.distance+travel;
          const lookAhead=Math.abs(stop-e.distance-travel)<1e-7?e.distance+Math.max(travel,enemyRadius(e.level,this.worldScale)*3):stop;
          const next=Math.min(lookAhead,offset+length),point=position(next,route),dx=point.x-e.x,dy=point.y-e.y,d=Math.hypot(dx,dy);
          if(d<1e-9)break;
          const before=e.distance,anchor=position(before,route),centered=Math.hypot(e.x-anchor.x,e.y-anchor.y)<1e-9;
          const step=Math.min(travel,d),moved=this.moveEnemyBody(e,dx/d*step,dy/d*step,true);
          travel-=step;
          const along=((e.x-a.x)*(b.x-a.x)+(e.y-a.y)*(b.y-a.y))/length;
          e.distance=Math.max(e.distance,Math.min(next,offset+along));
          if(centered&&Math.abs((e.x-a.x)*(b.y-a.y)-(e.y-a.y)*(b.x-a.x))/length<1e-9&&moved>=step-1e-9){
            e.distance=Math.min(next,before+step);Object.assign(e,position(e.distance,route));
          }
          if(moved<step-1e-7||Math.hypot(e.x-point.x,e.y-point.y)>1e-7)break;
          e.distance=next;
          if(next===stop)break;
        }
        if(spec.behavior!=='bomber'){const target=this.attackTarget(e);if(target)pursue(target);}
        const exit=route.path.at(-1);
        if(e.distance>=route.length-1e-7&&Math.hypot(e.x-exit.x,e.y-exit.y)<1e-7)e.distance=route.length;
        if(!chasing&&e.distance>=route.length)this.resolveEnemyExit(e);
      }
      e.remaining=route.length-e.distance;e.moving=e.x!==oldX||e.y!==oldY;
      if(e.x!==oldX)e.facing=e.x>oldX?1:-1;else e.facing??=-1;
      if(attackTarget&&targetDistance(attackTarget,e)<=this.attackRange(e,attackTarget)+1e-7)this.stopToAttack(e,attackTarget);
    }
    updateWallBlockedTime(dt) {
      // Count elapsed combat time once per barrier, even when several enemies attack it.
      const blocked=new Set();
      for(const e of this.enemies){
        if(e.hp<=0||e.escaped)continue;
        const wall=this.walls.find(w=>w.id===e.targetId&&w.hp>0);
        if(wall&&targetDistance(wall,e)<=this.attackRange(e,wall)+1e-7)blocked.add(wall);
      }
      for(const wall of blocked)wall.blockedTime=(wall.blockedTime??0)+dt;
    }
    attackTowers(dt) {
      for(const e of this.enemies) {
        if(e.hp<=0||e.shieldPushRemaining>0)continue;
        const spec=ENEMIES[e.level];
        if(spec.behavior==='bomber')continue;
        e.attackCooldown=Math.max(0,(e.attackCooldown??0)-dt);
        if(e.pendingShot){
          const shot=e.pendingShot;
          if(this.time+1e-9<shot.releaseAt)continue;
          e.pendingShot=null;
          const target=shot.target;
          if(target.level>0&&target.hp>0&&target.towerId===shot.towerId&&this.attackTarget(e)===target&&targetDistance(target,e)<=this.attackRange(e,target)+1e-7){
            this.enemyArrows.push({x:e.x,y:e.y,target,targetTowerId:shot.towerId,damage:spec.attackDamage,speed:spec.projectileSpeed*this.worldScale});
            this.sound?.playArrow(1);
          }
        }
        const target=this.attackTarget(e);
        if(!target||targetDistance(target,e)>this.attackRange(e,target)+1e-7)continue;
        this.stopToAttack(e,target);
        if(this.isCharging(e)){
          e.chargeConsumed=true;e.charging=false;e.chargeImpactAt=this.time;
          e.attackCooldown=spec.attackInterval;e.attackAt=this.time;
          this.damageTower(target,spec.chargeDamage);
          this.effects.push({kind:'enemy-attack',x:e.x,y:e.y,toX:target.x,toY:target.y,life:.18});
          continue;
        }
        if(e.attackCooldown>0)continue;
        e.attackCooldown=spec.attackInterval||WALL.attackInterval;
        e.attackAt=this.time;
        if(spec.behavior==='archer'){
          e.pendingShot={target,towerId:target.towerId,releaseAt:this.time+spec.attackWindup};
          continue;
        }
        this.damageTower(target,spec.attackDamage||WALL.attackDamage);
        this.effects.push({kind:'enemy-attack',x:e.x,y:e.y,toX:target.x,toY:target.y,life:.18});
      }
    }
    updateEnemyArrows(dt) {
      this.enemyArrows=this.enemyArrows.filter(arrow=>{
        const s=arrow.target;
        // A removed tower's replacement must not inherit projectiles aimed at the old building.
        if(!s.level||s.hp<=0||s.towerId!==arrow.targetTowerId)return false;
        const dx=s.x-arrow.x,dy=s.y-arrow.y,distance=Math.hypot(dx,dy),step=arrow.speed*dt;
        if(distance<=step){this.damageTower(s,arrow.damage);return false;}
        if(distance>0){arrow.x+=dx/distance*step;arrow.y+=dy/distance*step;}
        return true;
      });
    }
    fireTowers(dt){
      for(const s of this.slots){if(!s.level||s.action||s.kind==='bomb')continue;s.cooldown-=dt;if(s.cooldown>0)continue;const spec=TOWERS[s.level];let target=null;for(const e of this.enemies)if(e.hp>0&&Math.hypot(e.x-s.x,e.y-s.y)<=spec.range*this.worldScale&&(!target||e.remaining<target.remaining))target=e;if(target){this.bullets.push({x:s.x,y:s.y,target,damage:spec.damage,sourceTowerId:s.towerId});this.sound?.playArrow(s.level);s.cooldown=spec.interval;}}
    }
    hasFriendlyProjectiles(){return false;}
    update(dt) {
      if(this.phase!=='playing'){
        if(this.corpses.length){this.time+=dt;this.corpses=this.corpses.filter(e=>this.time-e.deathAt<sprites.deathDuration);}
        return;
      }
      this.time+=dt;this.effects=this.effects.filter(e=>(e.life-=dt)>0);
      this.corpses=this.corpses.filter(e=>this.time-e.deathAt<sprites.deathDuration);
      if(this.countdown>0){this.countdown=Math.max(0,this.countdown-dt);if(this.countdown===0){this.spawnQueue=[...this.waves[this.wave]];this.wave++;this.spawnTimer=0;this.sound?.playWaveStart();}}
      if(this.spawnQueue.length){
        this.spawnTimer-=dt;
        while(this.spawnQueue.length&&this.spawnTimer<=1e-9){
          const wait=this.spawnQueue[0]?.afterPreviousSpawn;
          if(wait!==undefined){
            // Batch delays begin after actual entry, including entrance congestion.
            this.spawnTimer=0;
            if(this.pendingSpawns.length||this.lastEnemySpawnAt===null||this.time-this.lastEnemySpawnAt<wait-1e-9)break;
          }
          // Numeric entries preserve the original random-route waves. Objects pin a lane
          // and may set the delay before the next spawn, including simultaneous lanes.
          const entry=this.spawnQueue.shift(),level=typeof entry==='number'?entry:entry.level;
          const routeIndex=entry.routeIndex??Math.floor(this.random()*this.level.routes.length);
          this.pendingSpawns.push({level,routeIndex});
          this.spawnTimer+=this.spawnQueue[0]?.delay??this.level.spawnInterval??1.35;
        }
      }
      const blockedRoutes=new Set();
      this.pendingSpawns=this.pendingSpawns.filter(({level,routeIndex})=>{
        const s=ENEMIES[level],route=this.level.routes[routeIndex],e={level,hp:s.hp,maxHp:s.hp,charging:!!s.chargeDamage,chargeConsumed:false,distance:0,routeIndex,remaining:route.length,...position(0,route)};
        if(blockedRoutes.has(routeIndex)||!this.enemySpaceFree(e,e.x,e.y)){blockedRoutes.add(routeIndex);return true;}
        e.id=this.nextId++;this.enemies.push(e);this.lastEnemySpawnAt=this.time;this.onEnemySpawn?.(level);return false;
      });
      this.separateEnemyOverlaps();
      for(const e of this.enemies)if(e.hp>0)this.moveEnemy(e,dt);
      this.updateWallBlockedTime(dt);
      if(this.lives===0){this.phase='lost';return;}
      this.fireTowers(dt);
      this.bullets=this.bullets.filter(b=>{const e=b.target;if(e.hp<=0)return false;const d=Math.hypot(e.x-b.x,e.y-b.y);if(d<640*this.worldScale*dt){this.sound?.playHit();this.damageEnemy(e,b.damage,b.sourceTowerId);return false;}b.x+=(e.x-b.x)/d*640*this.worldScale*dt;b.y+=(e.y-b.y)/d*640*this.worldScale*dt;return true;});
      this.enemies=this.enemies.filter(e=>e.hp>0);
      this.updateEnemyArrows(dt);
      // Resolve only surviving enemies, keeping their target locked while approaching or attacking.
      this.attackTowers(dt);
      this.updateTowerActions(dt);
      if(this.countdown===0&&!this.spawnQueue.length&&!this.pendingSpawns.length&&!this.enemies.length&&!this.enemyArrows.length&&!this.hasFriendlyProjectiles()){if(this.wave===this.waves.length){if(!this.corpses.length)this.phase='won';}else if(!this.level.manualWaves||!this.corpses.length){
        this.money+=this.level.waveRewards?.[this.wave-1]??30;
        if((this.level.waveRewards?.[this.wave-1]??30)>0)this.sound?.playCoin();
        this.awaitingWave=!!this.level.manualWaves;this.countdown=this.awaitingWave?Infinity:8;
      }}
    }
  }
  const api={Game,MAP_CONFIG,CAMPAIGN_WORLD_SCALE,createScenario,TOWERS,TOWER_MAX_HP,TOWER_ACTIONS,WALL,FENCE,wallSize,targetPoint,targetDistance,ENEMY_TYPES,ENEMIES,enemyRadius,enemyRanges,position,refundFor};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TD=api;
})(typeof globalThis!=='undefined'?globalThis:this);
