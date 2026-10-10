const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,createScenario,ENEMIES,position,targetDistance}=require('../dist/engine.js');
const sprites=require('../dist/enemy-sprites.js');
function setup(scale=1){const g=new Game(Math.random,createScenario({paths:[[[0,100],[2000,100]]],slots:[[400,100]],worldScale:scale}));g.start();g.countdown=Infinity;return g;}
function orc(g,x=0){const s=ENEMIES[2],e={id:g.nextId++,level:2,hp:s.hp,maxHp:s.hp,routeIndex:0,distance:x,...position(x,g.level.routes[0])};g.enemies.push(e);return e;}
function tower(g,hp=100){const t=g.slots[0];Object.assign(t,{level:1,hp,maxHp:hp,cooldown:Infinity});return t;}
test('orc starts charging at 1.5x base speed, including scaled worlds and wave spawns',()=>{
  for(const scale of [1,2]){
    const g=setup(scale);g.spawnQueue=[2];g.update(.1);const e=g.enemies[0];
    assert.equal(e.charging,true);assert.equal(e.x,49*1.5*scale*.1);
    g.update(1);assert.equal(e.charging,true);assert.ok(Math.abs(e.x-49*1.5*scale*1.1)<1e-7);
    g.damageEnemy(e,1);assert.equal(sprites.sample(e,g.time).state,'charge');
  }
});
test('tower detection does not consume charge; first contact deals 120 exactly once',()=>{
  for(const scale of [1,2]){
    const g=setup(scale),t=tower(g,300),e=orc(g,400-64*scale);
    g.update(.01);assert.equal(t.hp,300);assert.equal(e.charging,true);
    g.update(10);assert.equal(e.x,400-32*scale);assert.equal(t.hp,180);
    assert.equal(e.charging,false);assert.equal(e.chargeConsumed,true);
    g.attackTowers(.5);assert.equal(t.hp,180);
    g.attackTowers(.5);assert.equal(t.hp,170);assert.equal(sprites.sample(e,g.time).state,'attack');
    g.damageTower(t,999);const before=e.x;g.update(.1);
    assert.ok(Math.abs(e.x-before-49*scale*.1)<1e-7);assert.equal(e.charging,false);
  }
});
test('charge destroys a 100 HP tower and does not charge again at the next building',()=>{
  const g=setup(),t=tower(g),e=orc(g);g.update(10);
  assert.equal(t.hp,0);assert.equal(t.level,0);assert.equal(e.chargeConsumed,true);
  const other={id:1,x:e.x+20,y:100,level:1,hp:300,maxHp:300,cooldown:Infinity};g.slots.push(other);
  g.update(.5);assert.equal(other.hp,300);g.update(.5);assert.equal(other.hp,290);
});
test('wall contact uses its edge, absorbs 120 and then receives ordinary attacks',()=>{
  for(const scale of [1,2]){
    const g=setup(scale),e=orc(g),wall={id:-1,kind:'wall',x:400,y:100,width:16*scale,height:96,level:1,hp:300};g.walls.push(wall);
    g.update(10);assert.ok(Math.abs(targetDistance(wall,e)-8*scale)<1e-7);
    assert.equal(wall.hp,180);assert.equal(e.chargeConsumed,true);
    g.update(1);assert.equal(wall.hp,170);
  }
});
test('removed targets and hits below the break threshold preserve charge; dead orcs deal no collision damage',()=>{
  const g=setup(),t=tower(g),e=orc(g,340);g.update(.01);g.damageEnemy(e,1);g.damageTower(t,100);
  g.update(.1);assert.equal(e.charging,true);assert.notEqual(e.chargeConsumed,true);
  t.level=1;t.hp=100;g.damageEnemy(e,999);g.update(10);assert.equal(t.hp,100);
  assert.equal(sprites.sample(g.corpses[0]||{level:2,charging:true,deathAt:0},g.time).state,'death');
});
test('49 accumulated damage preserves charge, the 50th point restores normal movement and attacks permanently',()=>{
  for(const scale of [1,2]){
    const g=setup(scale),e=orc(g);g.update(.1);
    for(const damage of [12,12,24,1])g.damageEnemy(e,damage);
    assert.equal(e.chargeDamageTaken,49);assert.equal(e.charging,true);assert.equal(g.isCharging(e),true);
    assert.equal(sprites.sample(e,g.time).state,'charge');
    g.damageEnemy(e,1);
    assert.equal(e.hp,62);assert.equal(e.chargeConsumed,true);assert.equal(e.charging,false);
    assert.notEqual(sprites.sample(e,g.time).state,'charge');
    const x=e.x;g.update(.1);assert.ok(Math.abs(e.x-x-49*scale*.1)<1e-7);
    const t=tower(g,300);g.update(10);assert.equal(t.hp,290);assert.equal(e.chargeImpactAt,undefined);
    g.damageTower(t,999);g.update(.1);assert.equal(e.charging,false);
    const fresh=orc(g);g.moveEnemy(fresh,.1);assert.equal(fresh.charging,true);
  }
});
test('a single 50+ hit interrupts charge and a lethal hit only resolves death once',()=>{
  for(const damage of [50,60,999]){
    const g=setup(),e=orc(g);g.damageEnemy(e,damage);
    assert.equal(e.charging,false);assert.equal(g.isCharging(e),false);
    assert.equal(e.chargeDamageTaken,Math.min(112,damage));
    if(damage>=112){g.damageEnemy(e,999);assert.equal(g.corpses.length,1);assert.equal(g.kills,1);}
  }
});
test('bomber explosion damage also interrupts a nearby orc charge',()=>{
  const g=setup(),e=orc(g),b={...e,id:g.nextId++,level:4,hp:60,maxHp:60,x:10};g.enemies.push(b);
  g.moveEnemy(e,.01);g.damageEnemy(b,60);
  assert.equal(e.hp,52);assert.equal(e.chargeDamageTaken,60);assert.equal(e.charging,false);
  assert.equal(e.chargeConsumed,true);assert.equal(g.corpses.length,1);
});
test('arrows can interrupt charge on the contact update before collision damage is applied',()=>{
  const g=setup(),t=tower(g,300),e=orc(g,367);
  g.bullets.push({x:e.x,y:e.y,target:e,damage:50});g.update(.02);
  assert.equal(e.chargeConsumed,true);assert.equal(e.chargeImpactAt,undefined);
  assert.equal(t.hp,290);assert.equal(e.charging,false);
});
test('charge frames loop at fixed 32px offsets and death takes priority',()=>{
  const spec=sprites.specs[2],meta=require('../dist/assets/enemies/sprites.json').enemies[2];
  assert.equal(meta.frames,24);assert.equal(meta.width,768);assert.deepEqual(meta.animations,spec.animations);
  for(let i=0;i<12;i++){
    const f=sprites.sample({id:0,level:2,charging:true,hurtAt:0},i/12+.001);
    assert.equal(f.state,'charge');assert.equal(f.sx,(20+i%4)*32);assert.equal(f.sw,32);
  }
  assert.equal(sprites.sample({level:2,charging:true,deathAt:0},.1).state,'death');
});
