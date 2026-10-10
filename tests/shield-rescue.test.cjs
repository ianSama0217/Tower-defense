const {test}=require('node:test'),assert=require('node:assert/strict');
const TD=require('../dist/engine.js');
const {TimedWaveGame,SHIELD_GRACE_SECONDS,SHIELD_PUSH_SECONDS}=require('../dist/timed-waves.js');

function game(paths=[[[1280,400],[0,400]]]){
  const g=new TimedWaveGame(()=>0,TD.createScenario({paths,slots:[],worldScale:2,manualWaves:true,waves:[[1]]}));
  g.start();g.startNextWave();g.spawnQueue=[];return g;
}
function addAtExit(g,routeIndex,id){
  const route=g.level.routes[routeIndex],distance=route.length-.1;
  const enemy={id,routeIndex,level:1,hp:44,maxHp:44,distance,remaining:.1,...TD.position(distance,route)};
  g.enemies.push(enemy);return enemy;
}
function advance(g,seconds){for(let left=seconds;left>1e-9;){const step=Math.min(1/60,left);g.update(step);left-=step;}}

test('a breaching enemy costs one life and leaves permanently without a kill reward or pushback',()=>{
  const g=game(),enemy=addAtExit(g,0,1),money=g.money;
  g.update(1/60);
  assert.equal(g.lives,2);assert.equal(enemy.escaped,true);assert.equal(enemy.hp,0);
  assert.equal(g.lineGraceUntil,g.time+SHIELD_GRACE_SECONDS);
  assert.equal(enemy.shieldPushRemaining,undefined);assert.equal(g.shieldSoldiers.length,0);
  assert.equal(g.enemies.includes(enemy),false);assert.equal(g.corpses.length,0);
  assert.equal(g.kills,0);assert.equal(g.money,money);
  advance(g,5);assert.equal(g.lives,2);
  g.start();assert.equal(g.shieldSoldiers.length,0);assert.equal(g.lineGraceUntil,0);
});

test('two vertically aligned soldiers push only the two goblins still inside the defense line',()=>{
  const g=game(),route=g.level.routes[0],distances=[route.length-.1,route.length-60,route.length-120];
  const enemies=distances.map((distance,i)=>{
    const enemy={id:i+1,routeIndex:0,level:1,hp:44,maxHp:44,distance,remaining:route.length-distance,...TD.position(distance,route)};
    g.enemies.push(enemy);return enemy;
  });
  g.update(1/60);
  assert.equal(g.lives,2);assert.equal(g.shieldSoldiers.length,2);
  assert.equal(enemies[0].escaped,true);assert.equal(enemies[0].shieldPushRemaining,undefined);
  assert.deepEqual(g.enemies,enemies.slice(1));
  for(const soldier of g.shieldSoldiers)assert.deepEqual(soldier.targets,enemies.slice(1));
  const [upper,lower]=g.shieldSoldiers;
  assert.equal(upper.x,lower.x);assert.equal(upper.facing,lower.facing);assert.equal(upper.startedAt,lower.startedAt);
  assert.equal(upper.y,400-g.level.mapConfig.roadWidth/4);assert.equal(lower.y,400+g.level.mapConfig.roadWidth/4);
  assert.ok(enemies.slice(1).every(enemy=>enemy.shieldPushRemaining>SHIELD_PUSH_SECONDS-.02));
  advance(g,SHIELD_PUSH_SECONDS);
  enemies.slice(1).forEach((enemy,i)=>assert.ok(Math.abs(enemy.distance-(distances[i+1]-g.level.mapConfig.width/3))<3));
  assert.equal(enemies[0].distance,route.length);assert.equal(g.lives,2);
  assert.equal(g.shieldSoldiers.length,0);
});

test('the one-second line grace prevents rapid breaches from draining all lives',()=>{
  const g=game([[[1280,150],[800,150],[800,400],[0,400]],[[1280,400],[0,400]],[[1280,650],[800,650],[800,400],[0,400]]]);
  const first=addAtExit(g,0,1);
  const trailing=addAtExit(g,0,4),route=g.level.routes[0];
  trailing.distance=route.length-120;trailing.remaining=120;Object.assign(trailing,TD.position(trailing.distance,route));
  g.update(1/60);assert.equal(g.lives,2);
  advance(g,.5);const second=addAtExit(g,1,2);g.update(1/60);
  assert.equal(g.lives,2);assert.equal(g.shieldSoldiers.length,2);
  assert.equal(first.escaped,true);assert.equal(second.escaped,true);
  for(const soldier of g.shieldSoldiers)assert.deepEqual(soldier.targets,[trailing]);
  advance(g,.5);const third=addAtExit(g,2,3);g.update(1/60);
  assert.equal(g.lives,1);assert.equal(third.escaped,true);assert.equal(g.shieldSoldiers.length,2);
  g.damageEnemy(trailing,999);g.update(1/60);assert.equal(g.shieldSoldiers.length,0);
});

test('overlapping enemies already at the exit all escape and cannot be recruited for rescue',()=>{
  const g=game(),enemies=[1,2,3].map(id=>addAtExit(g,0,id)),route=g.level.routes[0];
  for(const enemy of enemies){enemy.distance=route.length;Object.assign(enemy,TD.position(enemy.distance,route));}
  for(const enemy of enemies)g.resolveEnemyExit(enemy);
  assert.equal(g.lives,2);assert.equal(g.shieldSoldiers.length,0);
  assert.ok(enemies.every(enemy=>enemy.escaped&&enemy.hp===0&&enemy.shieldPushRemaining===undefined));
});
