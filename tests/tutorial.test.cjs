const {test}=require('node:test'),assert=require('node:assert/strict');
const {TutorialGame}=require('../dist/tutorial-level.js');
function runUntil(g,predicate,max=15000){for(let i=0;i<max&&!predicate();i++)g.update(1/60);assert.ok(predicate(),'Simulation did not reach expected state');}
function clearWave(g){assert.equal(g.startNextWave(),true);runUntil(g,()=>g.awaitingWave||g.phase!=='playing');}

test('tutorial has four specified waves, 120 coins and waits for the first tower',()=>{
  const g=new TutorialGame(()=>0);g.start();
  assert.equal(g.money,120);assert.equal(g.lesson,'build');assert.equal(g.startNextWave(),false);
  g.update(120);assert.equal(g.wave,0);assert.equal(g.enemies.length,0);
  assert.equal(g.waves.length,4);for(const w of g.waves.slice(0,2))assert.ok(w.every(t=>t===5));
  assert.deepEqual([...new Set(g.waves[2])].sort(),[1,5]);assert.ok(g.waves[3].every(t=>t===1));
  assert.equal(g.build(0).ok,true);assert.equal(g.money,60);assert.equal(g.build(0).ok,false);
  assert.equal(g.startNextWave(),true);assert.equal(g.startNextWave(),false);assert.equal(g.wave,1);
});

test('wave two awards 80 once and wave three waits for a full five-second upgrade',()=>{
  const g=new TutorialGame(()=>0);g.start();g.build(0);g.build(1);clearWave(g);
  assert.equal(g.wave,1);assert.equal(g.money,32);assert.equal(g.lesson,'slimes');
  clearWave(g);assert.equal(g.wave,2);assert.equal(g.money,32+48+80);assert.equal(g.lesson,'upgrade');
  const reward=g.money;g.update(100);assert.equal(g.money,reward);assert.equal(g.startNextWave(),false);
  assert.equal(g.build(2).ok,false);assert.equal(g.demolish(0).ok,false);
  assert.equal(g.build(0).ok,true);assert.equal(g.money,reward-80);assert.equal(g.lesson,'upgrading');
  g.update(4.99);assert.equal(g.slots[0].level,1);assert.equal(g.startNextWave(),false);
  g.update(.01);assert.equal(g.slots[0].level,2);assert.equal(g.lesson,'goblins');assert.equal(g.startNextWave(),true);
});

test('a beginner can clear all four waves with two towers and one required upgrade',()=>{
  const g=new TutorialGame(()=>0);g.start();g.build(0);g.build(1);
  clearWave(g);clearWave(g);g.build(0);g.update(5);clearWave(g);
  assert.equal(g.wave,3);assert.equal(g.lesson,'final');clearWave(g);
  assert.equal(g.phase,'won');assert.equal(g.wave,4);assert.equal(g.kills,g.waves.flat().length);assert.equal(g.lives,3);
  assert.equal(g.enemies.length,0);assert.equal(g.corpses.length,0);assert.equal(g.startNextWave(),false);
  g.start();assert.equal(g.money,120);assert.equal(g.wave,0);assert.equal(g.upgradeLearned,false);assert.equal(g.lesson,'build');
  assert.ok(g.slots.every(s=>s.level===0&&s.action===null));
});

test('loss cannot start another wave and restart clears failed combat',()=>{
  const g=new TutorialGame(()=>0);g.start();g.build(3);g.startNextWave();g.slots[3].cooldown=Infinity;
  runUntil(g,()=>g.phase==='lost');assert.equal(g.startNextWave(),false);assert.equal(g.lesson,'lost');
  g.start();assert.equal(g.lives,3);assert.equal(g.spawnQueue.length,0);assert.equal(g.enemies.length,0);
});
