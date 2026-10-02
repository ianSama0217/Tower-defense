const {test}=require('node:test');
const assert=require('node:assert/strict');
const {HeartTimeline,BREAK_DURATION}=require('../dist/game-hud.js');
const {TutorialGame}=require('../dist/tutorial-level.js');

test('invasion breaks only the lost heart and repeated UI updates do not restart it',()=>{
  const h=new HeartTimeline();h.update(2,1000);
  assert.equal(h.sample(0,1180).state,'alive');assert.equal(h.sample(1,1180).state,'alive');
  assert.deepEqual(h.sample(2,1000),{state:'breaking',frame:8});
  h.update(2,1180);assert.deepEqual(h.sample(2,1180),{state:'breaking',frame:10});
  assert.equal(h.isBreaking(1000+BREAK_DURATION-1),true);
  assert.deepEqual(h.sample(2,1000+BREAK_DURATION),{state:'empty',frame:0});
  assert.equal(h.isBreaking(1000+BREAK_DURATION),false);
});

test('consecutive and simultaneous invasions keep separate animation clocks',()=>{
  const h=new HeartTimeline();h.update(2,0);h.update(0,300);
  assert.equal(h.sample(2,720).state,'empty');
  assert.equal(h.sample(1,720).state,'breaking');assert.equal(h.sample(0,720).state,'breaking');
  assert.equal(h.isBreaking(1019),true);assert.equal(h.isBreaking(1020),false);
});

test('restart restores all three hearts and clears pending break animations',()=>{
  const h=new HeartTimeline();h.update(0,500);h.reset(3);
  for(let i=0;i<3;i++)assert.equal(h.sample(i,600).state,'alive');
  assert.equal(h.isBreaking(600),false);
});

test('reduced motion keeps a short cracked frame with no idle pulsing',()=>{
  const h=new HeartTimeline();h.update(2,1000);
  assert.deepEqual(h.sample(0,1100,true),{state:'alive',frame:0});
  assert.deepEqual(h.sample(2,1100,true),{state:'breaking',frame:9});
  assert.equal(h.isBreaking(1179,true),true);assert.equal(h.isBreaking(1180,true),false);
});

test('actual tutorial invasions drain three hearts and allow the final break before defeat',()=>{
  const g=new TutorialGame(()=>0),h=new HeartTimeline();g.start();g.build(3);g.startNextWave();g.slots[3].cooldown=Infinity;
  let now=0,losses=0,old=3;
  for(let i=0;i<15000&&g.phase==='playing';i++){
    g.update(1/60);now+=1000/60;h.update(g.lives,now);
    if(g.lives<old){losses+=old-g.lives;assert.equal(h.isBreaking(now),true);old=g.lives;}
  }
  assert.equal(g.phase,'lost');assert.equal(losses,3);assert.equal(h.isBreaking(now),true);
  assert.equal(h.isBreaking(now+BREAK_DURATION+1),false);
});
