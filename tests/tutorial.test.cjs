const {test}=require('node:test'),assert=require('node:assert/strict');
const {TutorialGame,INTERMISSION_SECONDS}=require('../dist/tutorial-level.js');
const {sample}=require('../dist/wave-clock.js');
function runUntil(g,predicate,max=15000){for(let i=0;i<max&&!predicate();i++)g.update(1/60);assert.ok(predicate(),'Simulation did not reach expected state');}
function setup(){const g=new TutorialGame(()=>0);g.start();g.build(0);g.build(1);return g;}
function clearCurrent(g){runUntil(g,()=>g.awaitingWave||g.phase!=='playing');}

test('preparation waits indefinitely for swords; first wave starts exactly once',()=>{
  const g=new TutorialGame(()=>0);g.start();g.update(120);
  assert.equal(g.money,120);assert.equal(g.wave,0);assert.equal(g.enemies.length,0);assert.equal(sample(g).mode,'ready');
  assert.equal(g.startNextWave(),true);assert.equal(g.startNextWave(),false);assert.equal(g.wave,1);assert.equal(sample(g).mode,'combat');
  assert.equal(g.waves.length,4);for(const w of g.waves.slice(0,2))assert.ok(w.every(t=>t===5));
  assert.deepEqual([...new Set(g.waves[2])].sort(),[1,5]);assert.ok(g.waves[3].every(t=>t===1));
});

test('each cleared wave starts a full 15-second intermission and cannot be skipped',()=>{
  const g=setup();g.startNextWave();clearCurrent(g);
  assert.equal(g.wave,1);assert.equal(g.money,32);assert.equal(g.intermissionRemaining,INTERMISSION_SECONDS);
  assert.equal(sample(g).mode,'intermission');assert.equal(sample(g).angle,0);assert.equal(g.startNextWave(),false);
  g.update(14.99);assert.equal(g.wave,1);assert.ok(g.intermissionRemaining>0);
  g.update(.01);assert.equal(g.wave,2);assert.equal(g.awaitingWave,false);assert.equal(g.intermissionRemaining,null);assert.equal(sample(g).mode,'combat');assert.equal(sample(g).remaining,30);assert.equal(sample(g).waitingForSpawns,true);assert.equal(g.arrowRainFired,false);
});

test('second-wave reward is paid once; the next wave starts even if an upgrade is unfinished',()=>{
  const g=setup();g.startNextWave();clearCurrent(g);g.update(15);clearCurrent(g);
  assert.equal(g.wave,2);assert.equal(g.money,32+48+80);const reward=g.money;
  g.update(13);assert.equal(g.money,reward);assert.equal(g.build(0).ok,true);assert.equal(g.money,reward-80);
  g.update(2);assert.equal(g.wave,3);assert.equal(g.slots[0].level,1);assert.ok(g.slots[0].action);
  g.update(3);assert.equal(g.slots[0].level,2);assert.equal(g.slots[0].action,null);
});

test('timer uses simulation time and its green sector represents a quarter of one minute',()=>{
  const g=setup();g.startNextWave();clearCurrent(g);
  g.update(7.5);assert.equal(g.intermissionRemaining,7.5);assert.equal(sample(g).angle,Math.PI/4);
  const paused=JSON.stringify(sample(g));g.update(0);assert.equal(JSON.stringify(sample(g)),paused);
  const fast=setup();fast.startNextWave();clearCurrent(fast);for(let i=0;i<450;i++)fast.update(2/60);
  assert.equal(fast.wave,2);assert.equal(fast.awaitingWave,false);
});

test('four automatic waves remain winnable and victory has no extra countdown',()=>{
  const g=setup();g.startNextWave();clearCurrent(g);g.update(15);clearCurrent(g);g.build(0);g.update(5);g.update(10);clearCurrent(g);
  assert.equal(g.wave,3);g.update(15);runUntil(g,()=>g.phase==='won');
  assert.equal(g.wave,4);assert.equal(g.kills,g.waves.flat().length);assert.equal(g.lives,3);assert.equal(sample(g).mode,'finished');
  assert.equal(g.intermissionRemaining,null);assert.equal(g.startNextWave(),false);
  g.update(60);assert.equal(g.wave,4);
  g.start();assert.equal(g.wave,0);assert.equal(g.money,120);assert.equal(g.intermissionRemaining,null);assert.equal(g.battleTime,0);assert.equal(sample(g).mode,'ready');
});

test('defeat stops automatic waves and reset clears failed combat',()=>{
  const g=new TutorialGame(()=>0);g.start();g.startNextWave();runUntil(g,()=>g.phase==='lost');
  assert.equal(g.startNextWave(),false);assert.equal(sample(g).mode,'finished');g.update(60);assert.equal(g.wave,1);
  g.start();assert.equal(g.lives,3);assert.equal(g.enemies.length,0);assert.equal(g.intermissionRemaining,null);
});

test('red clock waits for all spawns then maps the 30-second countdown to the red sector',()=>{
  const g=setup();g.startNextWave();
  assert.equal(sample(g).green,false);assert.equal(sample(g).angle,Math.PI/2);
  g.kills=2;assert.equal(sample(g).angle,Math.PI/2);
  assert.equal(sample(g).waitingForSpawns,true);
  g.arrowRainStartedAt=g.time;
  g.battleTime=15;assert.equal(sample(g).angle,Math.PI*1.25);assert.equal(sample(g).remaining,15);
  g.battleTime=30;assert.equal(sample(g).angle,2*Math.PI);assert.equal(sample(g).remaining,0);
  g.start();assert.equal(g.battleTime,0);
});

test('escaped enemies reduce hearts without advancing the clock by their count',()=>{
  const g=new TutorialGame(()=>0);g.start();g.startNextWave();
  runUntil(g,()=>g.lives===2);
  assert.equal(g.kills,0);assert.ok(sample(g).angle>Math.PI/2);
});
