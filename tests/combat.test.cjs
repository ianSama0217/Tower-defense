const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,ENEMIES,position,TOWER_MAX_HP}=require('../dist/engine.js');

function setup(level=0){const g=new Game();g.start(level);g.countdown=999;return g;}
function tower(g,id){assert.equal(g.build(id).ok,true);g.slots[id].cooldown=999;return g.slots[id];}
function enemy(g,distance=16,routeIndex=0,level=1){
  distance*=g.worldScale;
  const route=g.level.routes[routeIndex],spec=ENEMIES[level];
  const e={id:g.nextId++,level,hp:spec.hp,maxHp:spec.hp,distance,routeIndex,remaining:route.length-distance,attackCooldown:0,...position(distance,route)};
  g.enemies.push(e);return e;
}

test('enemies attack the nearest active tower and respect range and cooldown',()=>{
  const g=setup(),far=tower(g,21),near=tower(g,25),e=enemy(g);
  g.update(.01);
  assert.equal(e.targetId,near.id);assert.equal(near.hp,94);assert.equal(far.hp,100);
  for(let i=0;i<20;i++)g.update(.01);
  assert.equal(near.hp,94);
  for(let i=0;i<110;i++)g.update(.01);
  // Walking left makes the other tower closest before the next attack.
  assert.equal(near.hp,94);assert.equal(far.hp,94);assert.equal(e.targetId,far.id);
  const isolated=setup(),outOfRange=tower(isolated,0);enemy(isolated);isolated.update(.01);
  assert.equal(outOfRange.hp,100);assert.equal(isolated.enemies[0].targetId,null);
});

test('a newly built nearer tower becomes the next attack target',()=>{
  const g=setup(),far=tower(g,21),e=enemy(g);g.update(.01);
  assert.equal(far.hp,94);
  const near=tower(g,25);e.attackCooldown=0;g.update(.01);
  assert.equal(e.targetId,25);assert.equal(near.hp,94);assert.equal(far.hp,94);
});

test('attacking enemies remain on their chosen routes and keep moving',()=>{
  for(const routeIndex of [0,1,2]){
    const g=setup(1);tower(g,3);const e=enemy(g,650,routeIndex);
    const before=e.distance;g.update(.1);
    assert.equal(e.distance,before+ENEMIES[e.level].speed*.1);
    assert.deepEqual({x:e.x,y:e.y},position(e.distance,g.level.routes[routeIndex]));
    assert.ok(g.effects.some(effect=>effect.kind==='enemy-attack'));
  }
});

test('all tower levels cap at 100 HP; successful upgrades heal, rejected upgrades do not',()=>{
  const g=setup();const t=tower(g,25);assert.equal(t.hp,TOWER_MAX_HP);assert.equal(t.maxHp,100);
  t.hp=25;assert.equal(g.build(25).ok,true);assert.equal(t.level,1);assert.equal(t.hp,25);g.update(5);assert.equal(t.level,2);assert.equal(t.hp,100);assert.equal(t.maxHp,100);
  t.hp=40;assert.equal(g.build(25).ok,false);assert.equal(t.hp,40);
  g.money=125;assert.equal(g.build(25).ok,true);g.update(5);assert.equal(t.level,3);assert.equal(t.hp,100);assert.equal(t.maxHp,100);
  t.hp=60;g.money=1000;assert.equal(g.build(25).ok,false);assert.equal(t.hp,60);
});

test('destroyed towers stop being targets, give no refund, and can be rebuilt at full HP',()=>{
  const g=setup(),far=tower(g,21),near=tower(g,25);near.hp=1;
  enemy(g);const second=enemy(g);const money=g.money;g.update(.01);
  assert.equal(near.hp,0);assert.equal(near.level,0);assert.equal(near.cooldown,0);assert.notEqual(near.destroyedAt,null);
  assert.equal(second.targetId,far.id);assert.equal(far.hp,94);assert.equal(g.money,money);
  assert.equal(g.demolish(25).ok,false);
  assert.equal(g.build(25).ok,true);assert.equal(near.hp,100);assert.equal(near.level,1);assert.equal(near.destroyedAt,null);
  assert.equal(g.demolish(25).ok,true);assert.equal(near.hp,100);g.update(3);assert.equal(near.hp,0);
});

test('dead enemies never attack and enemy levels use their configured damage',()=>{
  const g=setup(),t=tower(g,25);const dead=enemy(g);dead.hp=0;g.update(.01);assert.equal(t.hp,100);
  for(const level of [1,2,3]){
    const levelGame=setup(),target=tower(levelGame,25);enemy(levelGame,16,0,level);levelGame.update(.01);
    assert.equal(target.hp,100-ENEMIES[level].attackDamage);
  }
});
