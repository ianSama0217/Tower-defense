const {combatScenario}=require('./fixtures.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game,TOWER_ACTIONS,ENEMIES,position,refundFor}=require('../dist/engine.js');
function setup(level=1){const g=new Game(Math.random,combatScenario());g.start();g.countdown=999;g.money=1000;g.build(1);g.updateTowerActions(5);const s=g.slots[1];Object.assign(s,{x:1248,y:380});s.level=level;return {g,s};}
function threat(g){const r=g.level.routes[0],distance=32;const e={id:g.nextId++,level:1,hp:10000,maxHp:10000,distance,routeIndex:0,remaining:r.length-distance,...position(distance,r)};g.enemies.push(e);return e;}
function advance(g,time){for(let t=0;t<time-1e-9;t+=.01)g.update(Math.min(.01,time-t));}

test('new construction charges once and blocks attacks and other work until five seconds',()=>{
  const g=new Game(Math.random,combatScenario());g.start();g.countdown=999;
  const before=g.money;assert.equal(g.build(1).ok,true);const s=g.slots[1];
  Object.assign(s,{x:1248,y:380});const enemy=threat(g);
  assert.equal(s.action.kind,'build');assert.equal(s.action.duration,5);assert.equal(g.money,before-60);
  assert.equal(g.build(1).ok,false);assert.equal(g.demolish(1).ok,false);assert.equal(g.money,before-60);
  advance(g,4.99);assert.ok(s.action);assert.equal(g.bullets.length,0);assert.equal(enemy.hp,enemy.maxHp);
  g.update(.01);assert.equal(s.action,null);assert.equal(s.level,1);
  g.update(.01);assert.ok(g.bullets.length>0);assert.equal(g.money,before-60);
});

test('destroyed construction does not complete or refund; reset clears pending construction',()=>{
  const g=new Game(Math.random,combatScenario());g.start();g.countdown=999;g.build(1);
  const money=g.money;g.damageTower(g.slots[1],100);g.update(6);
  assert.equal(g.slots[1].level,0);assert.equal(g.slots[1].action,null);assert.equal(g.money,money);
  g.build(1);g.start();assert.ok(g.slots.every(s=>!s.action&&!s.level));
});
test('upgrade charges once, preserves level and HP until exactly five seconds, then heals',()=>{
  const {g,s}=setup();s.hp=34;const before=g.money;
  assert.equal(g.build(1).ok,true);assert.equal(g.money,before-80);assert.equal(s.level,1);assert.equal(s.hp,34);
  assert.equal(g.build(1).ok,false);assert.equal(g.demolish(1).ok,false);assert.equal(g.repair(1).ok,false);assert.equal(g.money,before-80);
  advance(g,4.99);assert.equal(s.level,1);assert.equal(s.hp,34);g.update(.01);
  assert.equal(s.level,2);assert.equal(s.hp,100);assert.equal(s.action,null);
});
test('repair is only for damaged max-level towers with 50 coins and finishes after three seconds',()=>{
  const {g,s}=setup(2);s.hp=40;assert.equal(g.repair(1).ok,false);
  s.level=3;s.hp=100;const money=g.money;assert.equal(g.repair(1).ok,false);assert.equal(g.money,money);
  s.hp=40;g.money=49;assert.equal(g.repair(1).ok,false);assert.equal(g.money,49);
  g.money=50;assert.equal(g.repair(1).ok,true);assert.equal(g.money,0);assert.equal(s.hp,40);
  g.update(2.99);assert.equal(s.hp,40);g.update(.01);assert.equal(s.hp,100);assert.equal(s.level,3);assert.equal(s.action,null);
  for(const id of [-1,999,1.5,null])assert.equal(g.repair(id).ok,false);
});
test('all operations stop new shots; already-fired projectiles remain valid; completed work resumes fire',()=>{
  for(const kind of ['upgrade','repair','demolish']){
    const {g,s}=setup(kind==='repair'?3:1);s.hp=80;threat(g);
    assert.equal(g[kind==='upgrade'?'build':kind](1).ok,true);
    advance(g,TOWER_ACTIONS[kind].duration-.01);assert.equal(g.bullets.length,0);
    g.update(.01);assert.equal(s.action,null);assert.equal(g.bullets.length,0);
    if(kind!=='demolish'){g.enemies=[];threat(g);g.update(.01);assert.equal(g.bullets.length,1);}
  }
  const {g,s}=setup();const e=threat(g);g.update(.01);assert.equal(g.bullets.length,1);
  assert.equal(g.build(1).ok,true);g.update(.1);assert.ok(e.hp<e.maxHp);assert.ok(s.action);
});
test('demolition keeps its tower for three seconds, refunds once and selects wood vs stone debris',()=>{
  for(const level of [1,2,3]){
    const {g,s}=setup(level),money=g.money;
    assert.equal(g.demolish(1).ok,true);assert.equal(g.money,money);
    assert.equal(g.demolish(1).ok,false);assert.equal(g.build(1).ok,false);
    advance(g,2.99);assert.equal(s.level,level);assert.equal(g.money,money);
    g.update(.01);assert.equal(s.level,0);assert.equal(s.hp,0);assert.equal(g.money,money+refundFor(level));
    const effect=g.effects.find(e=>e.kind==='demolition');assert.equal(effect.material,level===1?'wood':'stone');
    assert.equal(g.demolish(1).ok,false);g.update(1);assert.equal(g.money,money+refundFor(level));assert.equal(g.effects.length,0);
    assert.equal(g.build(1).ok,true);assert.equal(s.level,1);
  }
});
test('destruction interrupts every operation without completing, reviving or issuing a demolition refund',()=>{
  for(const kind of ['upgrade','repair','demolish']){
    const {g,s}=setup(kind==='upgrade'?1:3);s.hp=1;g[kind==='upgrade'?'build':kind](1);const money=g.money;threat(g);g.update(.01);
    assert.equal(s.level,0);assert.equal(s.action,null);assert.equal(g.money,money);
    g.enemies=[];g.update(6);assert.equal(s.level,0);assert.equal(g.money,money);assert.equal(g.effects.some(e=>e.kind==='demolition'),false);
  }
});
test('operation clocks advance only with simulation time and resets discard pending work',()=>{
  const {g,s}=setup(3);s.hp=50;g.repair(1);advance(g,1.5);assert.ok(Math.abs(s.action.elapsed-1.5)<1e-8);
  const elapsed=s.action.elapsed;g.phase='lost';g.update(20);assert.equal(s.action.elapsed,elapsed);assert.equal(s.hp,50);
  g.start();assert.ok(g.slots.every(s=>s.action===null&&s.level===0));assert.equal(g.money,180);
});
