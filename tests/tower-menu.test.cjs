const {test}=require('node:test'),assert=require('node:assert/strict');
const TD=require('../dist/engine.js'),{TutorialGame}=require('../dist/tutorial-level.js'),{state}=require('../dist/tower-menu.js');
function game(){const g=new TutorialGame(()=>0);g.start();return g;}
test('unselected pads have no menu, empty pads show the configured build price',()=>{
  const g=game();assert.equal(state(g,null),null);assert.equal(state(g,-1),null);
  assert.equal(state(g,0).build.amount,60);assert.equal(state(g,0).build.disabled,false);
  const menu=state(g,0);
  for(const kind of ['build','upgrade','repair','demolish'])assert.equal(menu[kind].duration,TD.TOWER_ACTIONS[kind].duration);
  g.money=59;assert.equal(state(g,0).build.reason,'金幣不足');
});
test('upgrade prices and tutorial locks agree with actual transactions',()=>{
  const g=game();g.build(0);g.update(5);let m=state(g,0);assert.equal(m.upgrade.amount,80);assert.equal(m.upgrade.disabled,true);
  g.wave=2;g.money=300;m=state(g,0);assert.equal(m.upgrade.disabled,false);
  const before=g.money;g.build(0);assert.equal(before-g.money,m.upgrade.amount);assert.equal(state(g,0).upgrade.reason,'工程進行中');
  g.update(5);m=state(g,0);assert.equal(m.upgrade.amount,125);assert.equal(m.investment,140);
  g.build(0);g.update(5);m=state(g,0);assert.equal(m.upgrade.amount,null);assert.equal(m.upgrade.reason,'已達最高等級');
});
test('repair price matches engine and full-health or unfinished towers cannot be repaired',()=>{
  const g=game();g.slots[0].level=1;g.slots[0].hp=40;
  assert.equal(state(g,0).repair.reason,'滿級箭塔才能修復');
  g.slots[0].level=3;g.money=50;const m=state(g,0);assert.equal(m.repair.amount,TD.TOWER_ACTIONS.repair.cost);assert.equal(m.repair.disabled,false);
  assert.equal(g.repair(0).ok,true);assert.equal(g.money,0);g.update(3);assert.equal(state(g,0).repair.reason,'生命已滿');
});
test('demolition previews positive refunds for each level and credits only on completion',()=>{
  for(const level of [1,2,3]){const g=game();g.upgradeLearned=true;Object.assign(g.slots[0],{level,hp:100});
    const m=state(g,0),before=g.money;assert.equal(m.demolish.amount,TD.refundFor(level));assert.equal(m.demolish.income,true);
    g.demolish(0);assert.equal(g.money,before);g.update(3);assert.equal(g.money-before,m.demolish.amount);assert.equal(g.slots[0].level,0);
  }
});
test('paused, loading, finished and busy states block every engineering action',()=>{
  const g=game();g.build(0);
  for(const opts of [{paused:true},{ready:false}])for(const key of ['build','upgrade','repair','demolish'])assert.equal(state(g,0,opts)[key].disabled,true);
  g.phase='lost';for(const key of ['build','upgrade','repair','demolish'])assert.equal(state(g,0)[key].disabled,true);
});
