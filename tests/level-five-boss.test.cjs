const {test}=require('node:test'),assert=require('node:assert/strict');
const TD=require('../dist/engine.js'),{LevelFiveGame}=require('../dist/level-five.js');
function setup(){
  const g=new LevelFiveGame();g.start({...TD.createScenario({paths:[[[0,200],[2000,200]]],manualWaves:true,waves:Array.from({length:6},()=>[])}),stageIndex:4});
  g.wave=6;g.awaitingWave=false;g.countdown=0;
  const boss={id:1,level:7,hp:500,maxHp:500,x:500,y:200,routeIndex:0,distance:500,remaining:1500,spawnedAt:0};
  const other={...boss,id:2,level:1,hp:50,maxHp:50,x:1000,distance:1000,remaining:1000};
  g.enemies=[boss,other];return {g,boss,other};
}
test('boss death wins immediately with live enemies and queued reinforcements, granting rewards once',()=>{
  const {g,boss,other}=setup();g.spawnQueue=[{level:1,delay:5}];g.pendingSpawns=[{level:6,routeIndex:0}];
  const money=g.money;g.damageEnemy(boss,500);
  assert.equal(g.phase,'won');assert.equal(g.kills,1);assert.equal(g.money,money+10);assert.equal(other.hp,50);
  assert.equal(g.corpses.length,1);assert.equal(g.spawnQueue.length,0);assert.equal(g.pendingSpawns.length,0);
  g.damageEnemy(boss,500);g.damageEnemy(other,999);g.resolveEnemyExit(other);g.update(1);
  assert.equal(g.phase,'won');assert.equal(g.kills,1);assert.equal(g.lives,3);assert.equal(other.hp,50);
  g.start();assert.equal(g.phase,'playing');assert.equal(g.wave,0);assert.equal(g.lives,3);
});
test('arrows, bombs and arrow rain all trigger boss victory without a later same-frame defeat',()=>{
  for(const source of ['arrow','bomb','rain']){
    const {g,boss,other}=setup();
    if(source==='arrow')g.bullets=[{x:boss.x,y:boss.y,target:boss,damage:500}];
    if(source==='bomb')g.bombs=[{toX:boss.x,toY:boss.y,radius:90,damage:500,launchedAt:-1,duration:.65}];
    if(source==='rain'){boss.hp=200;g.fireArrowRain();}else g.update(.02);
    assert.equal(g.phase,'won',source);assert.equal(g.kills,1);assert.equal(other.hp,50);
    assert.equal(g.bullets.length,0);assert.equal(g.bombs.length,0);
    g.resolveEnemyExit(other);assert.equal(g.phase,'won');assert.equal(g.lives,3);
  }
});
test('boss crossing the line loses with full lives and active shield grace, without kill reward',()=>{
  const {g,boss,other}=setup(),money=g.money,route=g.level.routes[0];
  boss.distance=route.length-1;boss.x=route.path.at(-1).x-1;g.lineGraceUntil=Infinity;
  g.bullets=[{x:boss.x,y:boss.y,target:boss,damage:500}];
  g.update(.1);
  assert.equal(g.phase,'lost');assert.equal(g.lives,0);assert.equal(boss.escaped,true);
  assert.equal(g.kills,0);assert.equal(g.money,money);assert.equal(g.corpses.length,0);assert.equal(g.shieldSoldiers.length,0);
  assert.equal(g.bullets.length,0);g.killEnemy(boss);g.damageEnemy(other,999);assert.equal(g.phase,'lost');
});
test('ordinary goblin deaths and escapes retain the normal wave and life rules',()=>{
  const a=setup();a.g.damageEnemy(a.other,999);assert.equal(a.g.phase,'playing');
  const b=setup();b.g.resolveEnemyExit(b.other);assert.equal(b.g.phase,'playing');assert.equal(b.g.lives,2);assert.equal(b.boss.hp,500);
});
