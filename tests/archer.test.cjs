const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game,createScenario,ENEMY_TYPES,ENEMIES,enemyRanges}=require('../dist/engine.js');
const type=ENEMY_TYPES.archer,spec=ENEMIES[type];
function setup(scale=1){
  const g=new Game(Math.random,createScenario({paths:[[[0,100],[1000,100]]],slots:[[500,100]],worldScale:scale}));g.start();
  g.build(0);g.updateTowerActions(5);const s=g.slots[0];s.cooldown=Infinity;
  const e={id:1,level:type,x:500-spec.attackRange*scale,y:100,hp:spec.hp,maxHp:spec.hp,distance:500-spec.attackRange*scale,routeIndex:0,remaining:900};g.enemies.push(e);return {g,s,e};
}
function step(g,seconds){for(let left=seconds;left>1e-9;){const dt=Math.min(.01,left);g.update(dt);left-=dt;}}
test('archer stops at ranged distance, winds up, then deals damage only on arrow impact',()=>{
  const {g,s,e}=setup();g.update(.01);assert.equal(e.moving,false);assert.equal(s.hp,100);assert.equal(g.enemyArrows.length,0);assert.ok(e.pendingShot);
  step(g,.19);assert.equal(g.enemyArrows.length,0);g.update(.01);assert.equal(g.enemyArrows.length,1);assert.equal(s.hp,100);
  assert.equal(g.effects.some(e=>e.kind==='enemy-attack'),false);
  step(g,.5);assert.equal(s.hp,100);g.update(.01);assert.equal(s.hp,94);assert.equal(g.enemyArrows.length,0);
  step(g,.3);assert.equal(e.attackAt,.01);assert.equal(s.hp,94);
});
test('archer detection and attack distance scale with the world and remain separate from melee range',()=>{
  for(const scale of [1,2]){
    assert.equal(enemyRanges(type,scale).attack,112*scale);
    const {g,e,s}=setup(scale);e.x=s.x-170*scale;e.distance=e.x;
    g.update(.1);assert.equal(e.targetId,null);assert.equal(e.attackAt,undefined);
    step(g,2);assert.equal(e.targetId,s.id);assert.equal(e.moving,false);assert.ok(Math.abs(s.x-e.x-112*scale)<1e-7);
  }
});
test('death cancels an unreleased shot but an arrow already in flight still lands',()=>{
  const first=setup();first.g.update(.01);first.g.damageEnemy(first.e,999);step(first.g,1);assert.equal(first.s.hp,100);assert.equal(first.g.enemyArrows.length,0);
  const second=setup();step(second.g,.22);assert.equal(second.g.enemyArrows.length,1);second.g.damageEnemy(second.e,999);step(second.g,.6);assert.equal(second.s.hp,94);assert.equal(second.g.enemyArrows.length,0);
});
test('destroyed and rebuilt tower instances cannot inherit pending or airborne arrows',()=>{
  for(const delay of [.01,.22]){
    const {g,s}=setup();step(g,delay);g.damageTower(s,100);g.money=1000;g.build(0);s.cooldown=Infinity;
    step(g,.8);assert.equal(s.hp,100);assert.equal(g.enemyArrows.length,0);
  }
});
test('archer retargets after destruction and walks onward when no towers remain',()=>{
  const {g,s,e}=setup();g.update(.01);g.damageTower(s,100);
  g.slots.push({id:1,towerId:99,x:e.x+12,y:160,level:1,hp:100,maxHp:100,cooldown:Infinity});step(g,.01);assert.equal(e.targetId,1);
  g.damageTower(g.slots[1],100);const x=e.x;step(g,.3);assert.equal(e.targetId,null);assert.ok(e.x>x);assert.equal(e.pendingShot,null);assert.equal(g.enemyArrows.length,0);
});
test('pause freezes arrows, reset clears them, and large updates cannot tunnel past a tower',()=>{
  const {g,s}=setup();step(g,.22);const x=g.enemyArrows[0].x;g.phase='ready';g.update(1);assert.equal(g.enemyArrows[0].x,x);assert.equal(s.hp,100);
  g.phase='playing';g.updateEnemyArrows(20);assert.equal(s.hp,94);assert.equal(g.enemyArrows.length,0);g.start();assert.equal(g.enemyArrows.length,0);
});
