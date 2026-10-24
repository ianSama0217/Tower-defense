const {test}=require('node:test'),assert=require('node:assert/strict');
const TD=require('../dist/engine.js'),C=require('../dist/goblin-captain.js');
const {LevelFiveGame}=require('../dist/level-five.js');
function setup(type=1,scale=1){
  const g=new LevelFiveGame();g.start({...TD.createScenario({paths:[[[0,200*scale],[3000,200*scale]]],worldScale:scale,manualWaves:true,waves:[[]]}),stageIndex:4});
  const make=(level,id,x,y)=>({id,level,x,y,routeIndex:0,distance:x,remaining:3000-x,hp:TD.ENEMIES[level].hp,maxHp:TD.ENEMIES[level].hp,spawnedAt:0});
  const e=make(type,1,200*scale,200*scale),captain=make(7,2,160*scale,250*scale);
  g.enemies=[e,captain];g.time=5;return {g,e,captain};
}
test('warcry increases actual movement by 20% for each goblin variant at both world scales',()=>{
  for(const type of [1,4,6])for(const scale of [1,2]){
    const {g,e}=setup(type,scale),x=e.x;g.moveEnemy(e,.1);
    assert.ok(Math.abs(e.x-x-TD.ENEMIES[type].speed*scale*.1*1.2)<1e-7);
    g.time=10;const before=e.x;g.moveEnemy(e,.1);
    assert.ok(Math.abs(e.x-before-TD.ENEMIES[type].speed*scale*.1)<1e-7);
  }
});
test('melee and archer attacks recur 20% faster while individual hit damage stays unchanged',()=>{
  for(const type of [1,6]){
    const {g,e,captain}=setup(type);const target={id:0,towerId:1,level:1,x:600,y:200,hp:10000,maxHp:10000};
    g.slots=[target];e.x=type===6?520:580;e.targetId=0;captain.x=e.x;captain.y=270;
    g.attackTowers(0);const first=e.attackAt;
    for(let i=0;i<1000&&e.attackAt===first;i++){g.time+=1/600;g.attackTowers(1/600);}
    assert.ok(Math.abs(e.attackAt-first-TD.ENEMIES[type].attackInterval/1.2)<.004);
    if(type===1)assert.equal(target.hp,10000-12*2);
    else{assert.ok(g.enemyArrows.length>0);assert.ok(g.enemyArrows.every(a=>a.damage===15));}
  }
});
test('aura uses the 160-unit radius, excludes other types and never stacks',()=>{
  const {g,e,captain}=setup();captain.x=e.x+160;captain.y=e.y;
  assert.equal(g.enemyHaste(e),1.2);captain.x+=.01;assert.equal(g.enemyHaste(e),1);
  captain.x=e.x+40;g.enemies.push({...captain,id:3});assert.equal(g.enemyHaste(e),1.2);
  for(const type of [2,3,5,7]){e.level=type;assert.equal(g.enemyHaste(e),1);}
  e.level=1;for(const field of ['escaped','deathAt']){
    e[field]=field==='escaped'?true:15;assert.equal(g.enemyHaste(e),1);delete e[field];
  }
  e.hp=0;assert.equal(g.enemyHaste(e),1);
});
test('first cast waits 5 seconds; expiry, source death/escape, pause and restart behave correctly',()=>{
  const {g,e,captain}=setup();g.time=4.999;assert.equal(g.enemyHaste(e),1);
  g.time=5;assert.equal(g.enemyHaste(e),1.2);g.phase='ready';g.update(3);
  assert.equal(g.time,5);assert.equal(g.enemyHaste(e),1.2);g.phase='playing';
  captain.hp=0;assert.equal(g.enemyHaste(e),1);captain.hp=500;
  captain.escaped=true;assert.equal(g.enemyHaste(e),1);captain.escaped=false;
  captain.deathAt=15;assert.equal(g.enemyHaste(e),1);delete captain.deathAt;
  g.time=10;assert.equal(g.enemyHaste(e),1);g.time=20;assert.equal(g.enemyHaste(e),1.2);
  g.start();assert.equal(g.enemies.length,0);assert.equal(g.enemyHaste(e),1);
});
test('captain survives 200-damage arrow rain with 300 HP and buffs never mutate shared stats',()=>{
  const {g,e,captain}=setup(),before=JSON.stringify(TD.ENEMIES);
  for(let i=0;i<100;i++){g.warcryEffect(e);g.enemyHaste(e);C.recipients(captain,g.enemies);}
  assert.equal(JSON.stringify(TD.ENEMIES),before);g.fireArrowRain();assert.equal(captain.hp,300);
});
