const {combatScenario}=require('./fixtures.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,ENEMIES,position,TOWER_MAX_HP,createScenario,enemyRanges}=require('../dist/engine.js');

function setup(){const g=new Game(Math.random,combatScenario());g.start();g.countdown=999;return g;}
function tower(g,id){assert.equal(g.build(id).ok,true);g.updateTowerActions(5);g.slots[id].cooldown=999;return g.slots[id];}
function enemy(g,distance=16,routeIndex=0,level=1){
  distance*=g.worldScale;
  const route=g.level.routes[routeIndex],spec=ENEMIES[level];
  const e={id:g.nextId++,level,hp:spec.hp,maxHp:spec.hp,distance,routeIndex,remaining:route.length-distance,attackCooldown:0,...position(distance,route)};
  g.enemies.push(e);return e;
}

test('enemies attack the nearest active tower and respect range and cooldown',()=>{
  const g=setup(),far=tower(g,0),near=tower(g,1),e=enemy(g);
  g.update(.01);
  assert.equal(e.targetId,near.id);assert.equal(near.hp,94);assert.equal(far.hp,100);
  for(let i=0;i<20;i++)g.update(.01);
  assert.equal(near.hp,94);
  for(let i=0;i<110;i++)g.update(.01);
  // A locked attacker stays in place and attacks the same tower again.
  assert.equal(near.hp,88);assert.equal(far.hp,100);assert.equal(e.targetId,near.id);
  const isolated=setup(),outOfRange=tower(isolated,2);enemy(isolated);isolated.update(.01);
  assert.equal(outOfRange.hp,100);assert.equal(isolated.enemies[0].targetId,null);
});

test('a newly built nearer tower does not interrupt a locked target',()=>{
  const g=setup(),far=tower(g,0),e=enemy(g);g.update(.01);
  assert.equal(far.hp,94);
  const near=tower(g,1);e.attackCooldown=0;g.update(.01);
  assert.equal(e.targetId,0);assert.equal(near.hp,100);assert.equal(far.hp,88);
});

test('attacking enemies stop on their route and resume after destroying the tower',()=>{
  const g=setup(),t=tower(g,1),e=enemy(g),before=e.distance;g.update(.1);
  assert.equal(e.distance,before);assert.equal(e.moving,false);
  assert.deepEqual({x:e.x,y:e.y},position(e.distance,g.level.routes[0]));
  assert.equal(t.hp,94);assert.ok(g.effects.some(effect=>effect.kind==='enemy-attack'));
  t.hp=6;e.attackCooldown=0;g.update(.01);assert.equal(t.level,0);
  g.update(.1);assert.equal(e.targetId,null);assert.equal(e.moving,true);
  assert.equal(e.distance,before+ENEMIES[e.level].speed*g.worldScale*.1);
});

test('all tower levels cap at 100 HP; successful upgrades heal, rejected upgrades do not',()=>{
  const g=setup();const t=tower(g,1);assert.equal(t.hp,TOWER_MAX_HP);assert.equal(t.maxHp,100);
  t.hp=25;assert.equal(g.build(1).ok,true);assert.equal(t.level,1);assert.equal(t.hp,25);g.update(5);assert.equal(t.level,2);assert.equal(t.hp,100);assert.equal(t.maxHp,100);
  t.hp=40;assert.equal(g.build(1).ok,false);assert.equal(t.hp,40);
  g.money=125;assert.equal(g.build(1).ok,true);g.update(5);assert.equal(t.level,3);assert.equal(t.hp,100);assert.equal(t.maxHp,100);
  t.hp=60;g.money=1000;assert.equal(g.build(1).ok,false);assert.equal(t.hp,60);
});

test('destroyed towers stop being targets, give no refund, and can be rebuilt at full HP',()=>{
  const g=setup(),far=tower(g,0),near=tower(g,1);near.hp=1;
  enemy(g);const second=enemy(g);const money=g.money;g.update(.01);
  assert.equal(near.hp,0);assert.equal(near.level,0);assert.equal(near.cooldown,0);assert.notEqual(near.destroyedAt,null);
  assert.equal(second.targetId,far.id);assert.equal(far.hp,94);assert.equal(g.money,money);
  assert.equal(g.demolish(1).ok,false);
  assert.equal(g.build(1).ok,true);assert.equal(near.hp,100);assert.equal(near.level,1);assert.equal(near.destroyedAt,null);g.updateTowerActions(5);
  assert.equal(g.demolish(1).ok,true);assert.equal(near.hp,100);g.update(3);assert.equal(near.hp,0);
});

test('dead enemies never attack and enemy levels use their configured damage',()=>{
  const g=setup(),t=tower(g,1);const dead=enemy(g);dead.hp=0;g.update(.01);assert.equal(t.hp,100);
  for(const level of [1,2,3]){
    const levelGame=setup(),target=tower(levelGame,1);enemy(levelGame,16,0,level);levelGame.update(.01);
    assert.equal(target.hp,100-ENEMIES[level].attackDamage);
  }
});

function arena(paths,slots,scale=1){const g=new Game(Math.random,createScenario({paths,slots,worldScale:scale}));g.start();return g;}
test('all attackers stop at range entry even during a large movement step',()=>{
  for(const type of [1,2,3])for(const scale of [1,2]){
    const g=arena([[[0,100],[1000,100]]],[[400,100]],scale),s=tower(g,0),e=enemy(g,0,0,type);
    g.update(10);
    assert.equal(e.x,400-enemyRanges(type,scale).attack);assert.equal(e.y,100);
    assert.equal(e.moving,false);assert.equal(e.targetId,s.id);assert.equal(e.facing,1);
    assert.equal(s.hp,100-ENEMIES[type].attackDamage);
    const distance=e.distance;g.update(.1);assert.equal(e.distance,distance);
  }
});
test('range interception follows bends and ignores towers outside the route corridor',()=>{
  const g=arena([[[0,0],[100,0],[100,200]]],[[200,40],[100,160]]);
  const outside=tower(g,0),inside=tower(g,1),e=enemy(g,0);g.update(10);
  assert.equal(e.x,100);assert.equal(e.y,160-ENEMIES[1].attackRange);
  assert.equal(e.targetId,inside.id);assert.equal(outside.hp,100);assert.equal(inside.hp,94);
});
test('demolition holds attackers until completion and then releases them without a stale target',()=>{
  const g=arena([[[0,100],[1000,100]]],[[20,100]]),s=tower(g,0),e=enemy(g,0);
  assert.equal(g.demolish(0).ok,true);g.update(1);assert.equal(e.moving,false);assert.equal(e.distance,0);
  g.update(2);assert.equal(s.level,0);g.update(.1);
  assert.equal(e.targetId,null);assert.equal(e.moving,true);assert.equal(e.x,ENEMIES[1].speed*.1);
});
test('a tower at the exit is attacked before the enemy can escape',()=>{
  const g=arena([[[0,0],[100,0]]],[[100,0]]),s=tower(g,0),e=enemy(g,0);
  g.update(10);assert.equal(e.x,100-ENEMIES[1].attackRange);assert.equal(g.lives,3);assert.equal(e.escaped,undefined);
  g.damageTower(s,100);g.update(10);assert.equal(e.escaped,true);assert.equal(g.lives,2);
});

test('after destroying a tower attackers pursue a nearby tower behind them before resuming',()=>{
  for(const type of [1,2,3]){
    const g=arena([[[0,100],[1000,100]]],[[120,100],[50,100]]);
    const first=tower(g,0),second=tower(g,1),e=enemy(g,100,0,type);
    first.hp=second.hp=ENEMIES[type].attackDamage;
    g.update(.01);assert.equal(first.level,0);assert.equal(second.level,1);
    g.update(.01);assert.equal(e.targetId,second.id);assert.ok(e.x<100);assert.equal(e.facing,-1);
    assert.equal(e.attackAt,.01);assert.equal(second.hp,ENEMIES[type].attackDamage);
    for(let i=0;i<200&&second.level;i++)g.update(.01);
    assert.equal(second.level,0);const stoppedX=e.x;
    assert.ok(stoppedX<100);assert.equal(e.distance,100);
    for(let i=0;i<100;i++){
      const before={x:e.x,y:e.y};g.update(.01);
      assert.ok(Math.hypot(e.x-before.x,e.y-before.y)<=ENEMIES[type].speed*.01+1e-7);
    }
    assert.equal(e.targetId,null);assert.equal(e.offRoute,false);assert.equal(e.y,100);assert.ok(e.distance>100);
  }
});

test('detection acquires targets at the boundary but never deals damage outside attack range',()=>{
  for(const scale of [1,2]){
    const r=enemyRanges(1,scale),g=arena([[[0,0],[1000,0]]],[[0,r.detection],[0,-r.detection-.01]],scale);
    const inside=tower(g,0),outside=tower(g,1),e=enemy(g,0);
    g.attackTowers(.01);assert.equal(e.targetId,inside.id);assert.equal(inside.hp,100);assert.equal(e.attackAt,undefined);
    g.update(.1);assert.ok(e.y>0);assert.equal(inside.hp,100);assert.equal(outside.hp,100);
    g.damageTower(inside,100);g.update(.01);assert.equal(e.targetId,null);assert.equal(outside.hp,100);
  }
});

test('off-road detection uses the remaining movement budget and returns continuously when the target is removed',()=>{
  for(const scale of [1,2]){
    const g=arena([[[0,100],[1000,100]]],[[400,100+50*scale]],scale),s=tower(g,0),e=enemy(g,0);
    g.update(10);
    assert.equal(e.targetId,s.id);assert.equal(e.moving,false);assert.equal(e.offRoute,true);
    assert.ok(Math.abs(Math.hypot(e.x-s.x,e.y-s.y)-32*scale)<1e-7);
    assert.equal(s.hp,94);const anchor=position(e.distance,g.level.routes[0]);
    const before={x:e.x,y:e.y};g.damageTower(s,100);g.update(.01);
    assert.equal(e.targetId,null);assert.ok(Math.hypot(e.x-before.x,e.y-before.y)<=ENEMIES[1].speed*scale*.01+1e-7);
    for(let i=0;i<100;i++)g.update(.01);
    assert.equal(e.offRoute,false);assert.equal(e.y,anchor.y);assert.ok(e.x>anchor.x);
  }
});
