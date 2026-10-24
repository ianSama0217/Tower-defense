const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game,ENEMIES,ENEMY_TYPES,position,createScenario}=require('../dist/engine.js');
const {bomber,slime}=ENEMY_TYPES;
function arena(){const g=new Game();g.start();g.worldScale=1;g.countdown=999;g.slots=[];g.level={...g.level,routes:[]};return g;}
function enemy(g,level,x=100,y=100){const routeIndex=g.level.routes.length;g.level.routes.push({path:[{x:0,y},{x:1000,y}],segments:[1000],length:1000});const spec=ENEMIES[level],e={id:g.nextId++,level,x,y,hp:spec.hp,maxHp:spec.hp,distance:x,remaining:1000-x,routeIndex};g.enemies.push(e);return e;}
function tower(g,x,y){const s={id:g.slots.length,x,y,level:1,hp:100,maxHp:100,cooldown:Infinity,action:null,destroyedAt:null};g.slots.push(s);return s;}

test('slimes move at normal speed without attacking',()=>{
  assert.equal(ENEMIES[slime].speed,45);
  const g=arena(),e=enemy(g,slime),s=tower(g,110,100);g.update(.5);
  assert.equal(e.x,100+ENEMIES[slime].speed*.5);assert.equal(e.y,100);assert.equal(s.hp,100);assert.equal(e.attackAt,undefined);assert.equal(g.effects.length,0);
  e.distance=999.9;Object.assign(e,position(e.distance,g.level.routes[0]));g.update(.01);assert.equal(g.lives,2);assert.equal(g.corpses.length,0);
});
test('bombers chase only nearby live towers and retarget new or destroyed towers',()=>{
  const g=arena(),e=enemy(g,bomber),far=tower(g,500,100),near=tower(g,140,140);g.update(.1);
  assert.equal(e.targetId,near.id);assert.ok(e.x>100&&e.y>100);assert.equal(e.distance,100);assert.equal(e.attackAt,undefined);assert.equal(near.hp,100);
  const added=tower(g,e.x,e.y+30);g.update(.1);assert.equal(e.targetId,added.id);
  g.damageTower(added,100);g.update(.1);assert.equal(e.targetId,near.id);assert.equal(far.hp,100);
});

test('bombers follow bends instead of cutting across the map to distant towers or walls',()=>{
  for(const scale of [1,2])for(const kind of ['tower','wall']){
    const paths=[[[0,100],[300,100],[300,400],[600,400]].map(([x,y])=>[x*scale,y*scale])];
    const g=new Game(()=>0,createScenario({paths,worldScale:scale}));g.start();
    const e={id:g.nextId++,level:bomber,hp:40,maxHp:40,x:0,y:100*scale,distance:0,routeIndex:0};g.enemies.push(e);
    const target={id:kind==='wall'?-1:0,kind,level:1,hp:100,maxHp:100,x:500*scale,y:400*scale,width:16*scale,height:36*scale};
    (kind==='wall'?g.walls:g.slots).push(target);
    g.moveEnemy(e,6);
    assert.equal(e.x,300*scale);assert.equal(e.y,160*scale);assert.equal(e.distance,360*scale);
    assert.equal(e.targetId,null);assert.equal(target.hp,100);
    g.moveEnemy(e,10);
    assert.equal(e.hp,0);assert.equal(target.hp,50);
  }
});
test('reaching a tower triggers one suicide blast with no reward or damage to nearby monsters',()=>{
  const g=arena(),e=enemy(g,bomber),s=tower(g,120,100),neighbor=enemy(g,slime,100,145),outside=enemy(g,slime,100,180),money=g.money;
  g.update(.01);assert.equal(e.hp,0);assert.equal(s.hp,50);assert.equal(neighbor.hp,30);assert.equal(outside.hp,30);
  assert.equal(g.effects.filter(e=>e.kind==='bomb-explosion').length,1);assert.equal(g.corpses.length,1);assert.equal(g.kills,0);assert.equal(g.money,money);
  g.update(.1);assert.equal(s.hp,50);assert.equal(g.corpses.length,1);
});
test('shot-down bombers explode once without damaging or chaining to nearby monsters',()=>{
  const g=arena(),first=enemy(g,bomber,100),second=enemy(g,bomber,140),third=enemy(g,bomber,180),victim=enemy(g,slime,220),outside=enemy(g,slime,330),money=g.money;
  g.bullets.push({x:first.x,y:first.y,target:first,damage:999},{x:first.x,y:first.y,target:first,damage:999});g.update(.001);
  assert.equal(first.hp,0);for(const e of [second,third,victim,outside])assert.equal(e.hp,ENEMIES[e.level].hp);
  assert.equal(g.kills,1);assert.equal(g.corpses.length,1);assert.equal(g.money,money+ENEMIES[bomber].reward);assert.equal(g.effects.filter(e=>e.kind==='bomb-explosion').length,1);
  g.damageEnemy(first,999);g.killEnemy(first);g.update(.1);assert.equal(g.kills,1);assert.equal(g.corpses.length,1);
});
test('explosions interrupt destroyed tower work without issuing a demolition refund',()=>{
  const g=arena(),e=enemy(g,bomber),s=tower(g,140,100);s.hp=50;s.action={kind:'demolish',elapsed:2.99,duration:3,refund:30};const money=g.money;
  g.damageEnemy(e,999);g.update(.1);assert.equal(s.level,0);assert.equal(s.hp,0);assert.equal(s.action,null);assert.equal(g.money,money+ENEMIES[bomber].reward);
});
test('bombers without towers follow the route, and rejoin continuously after losing all targets',()=>{
  const g=arena(),e=enemy(g,bomber);g.update(.1);assert.equal(e.x,106);assert.equal(e.y,100);
  const s=tower(g,140,140);g.update(.5);assert.ok(e.y>100);g.damageTower(s,100);const old={x:e.x,y:e.y};g.update(.01);
  assert.equal(e.targetId,null);assert.ok(Math.hypot(e.x-old.x,e.y-old.y)<=ENEMIES[bomber].speed*.01+1e-8);assert.ok(e.y<old.y);
  for(let i=0;i<100;i++)g.update(.01);assert.equal(e.offRoute,false);assert.equal(e.y,100);assert.ok(e.distance>106);
});
test('large movement steps cannot tunnel past a tower and explosion range respects world scale',()=>{
  const g=arena(),e=enemy(g,bomber),s=tower(g,300,100);g.update(10);assert.equal(e.hp,0);assert.equal(s.hp,50);assert.ok(Math.abs(e.x-(300-ENEMIES[bomber].triggerRange))<1e-8);
  const scaled=arena();scaled.worldScale=2;const bomb=enemy(scaled,bomber),inside=tower(scaled,190,100),outside=tower(scaled,205,100);scaled.damageEnemy(bomb,999);assert.equal(inside.hp,50);assert.equal(outside.hp,100);
});
test('victory waits for the explosion and reset clears all new monster state',()=>{
  const g=arena(),e=enemy(g,bomber);g.countdown=0;g.wave=g.waves.length;g.damageEnemy(e,999);g.update(.01);assert.equal(g.phase,'playing');g.update(.75);assert.equal(g.phase,'won');
  g.start();assert.equal(g.corpses.length,0);assert.equal(g.effects.length,0);assert.equal(g.enemies.length,0);
});
