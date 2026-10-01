const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,createScenario,position,refundFor}=require('../dist/engine.js');
const {combatScenario}=require('./fixtures.cjs');

test('default sandbox has no built-in stages, roads, pads or waves',()=>{
  const g=new Game();g.start();g.update(120);
  assert.equal(g.slots.length,0);assert.equal(g.level.routes.length,0);assert.equal(g.waves.length,0);
  assert.equal(g.enemies.length,0);assert.equal(g.wave,0);assert.equal(g.phase,'playing');
});
test('restarting a supplied scenario clears combat and operations',()=>{
  const g=new Game(Math.random,combatScenario());g.start();g.build(0);g.build(0);g.lives=1;
  g.start();assert.equal(g.money,180);assert.equal(g.lives,3);assert.equal(g.wave,0);
  assert.ok(g.slots.every(s=>s.level===0&&s.action===null));assert.equal(g.enemies.length,0);
  g.start(createScenario());assert.equal(g.slots.length,0);assert.equal(g.level.routes.length,0);
});
test('escaping enemies each cost one life and zero lives ends combat',()=>{
  const g=new Game(Math.random,combatScenario());g.start();const route=g.level.routes[0];
  for(let i=0;i<3;i++){
    g.enemies.push({id:i,routeIndex:0,level:1,hp:44,maxHp:44,distance:route.length-.1,...position(route.length-.1,route)});
    g.update(1/30);assert.equal(g.lives,2-i);
  }
  assert.equal(g.phase,'lost');assert.equal(g.demolish(0).ok,false);
});

test('arrow tower upgrade, demolition refund and rebuilding cannot generate free coins',()=>{
  const g=new Game(Math.random,combatScenario());g.start();g.countdown=999;
  assert.equal(g.build(0).ok,true);assert.equal(g.money,120);
  assert.equal(g.build(0).ok,true);assert.equal(g.money,40);
  assert.equal(g.slots[0].level,1);g.update(5);
  assert.equal(g.build(0).ok,false);
  assert.equal(refundFor(2),70);
  assert.equal(g.demolish(0).refund,70);assert.equal(g.money,40);g.update(3);
  assert.equal(g.money,110);assert.equal(g.slots[0].level,0);
  assert.equal(g.demolish(0).ok,false);assert.equal(g.money,110);
  assert.equal(g.build(0).ok,true);assert.equal(g.money,50);
  assert.equal(g.build(-1).ok,false);assert.equal(g.demolish(500).ok,false);
  g.money=500;g.build(0);g.update(5);g.build(0);g.update(5);
  assert.equal(g.slots[0].level,3);assert.equal(g.build(0).ok,false);
  assert.equal(g.demolish(0).refund,132);
});
