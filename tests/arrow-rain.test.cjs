const {test}=require('node:test'),assert=require('node:assert/strict');
const TD=require('../dist/engine.js');
const {TimedWaveGame,ARROW_RAIN_SECONDS,ARROW_RAIN_DAMAGE}=require('../dist/timed-waves.js');
const {sample}=require('../dist/wave-clock.js');

function setup(waves=[[3,3],[3]],spawnInterval=40){
  const scenario=TD.createScenario({paths:[[[1280,400],[0,400]]],slots:[],manualWaves:true,waves,spawnInterval,worldScale:1});
  const game=new TimedWaveGame(()=>0,scenario);game.start();game.startNextWave();
  // Keep targets alive and stationary so only spawn scheduling controls the clock.
  game.moveEnemy=()=>{};game.enemySpaceFree=()=>true;
  return game;
}

test('rain and red clock wait for the final actual spawn, then count 30 seconds and damage all enemies once',()=>{
  const game=setup();
  game.update(.01);assert.equal(game.enemies.length,1);
  game.update(39.98);
  assert.equal(game.arrowRainStartedAt,null);assert.equal(game.battleTime,0);assert.equal(game.arrowRainFired,false);
  assert.equal(sample(game).waitingForSpawns,true);assert.equal(sample(game).angle,Math.PI/2);assert.equal(sample(game).remaining,30);
  game.update(.01);assert.equal(game.enemies.length,2);
  assert.equal(game.arrowRainStartedAt,game.lastEnemySpawnAt);assert.equal(game.arrowRainStartedAt,game.time);
  assert.equal(game.battleTime,0);assert.equal(sample(game).waitingForSpawns,false);
  const [healthy,frail]=game.enemies;healthy.hp=healthy.maxHp=250;frail.hp=frail.maxHp=150;
  game.update(15);assert.equal(sample(game).angle,Math.PI*1.25);assert.equal(sample(game).remaining,15);
  const paused=JSON.stringify(sample(game));game.update(0);assert.equal(JSON.stringify(sample(game)),paused);
  game.update(14.99);assert.equal(game.arrowRainFired,false);assert.equal(healthy.hp,250);assert.equal(frail.hp,150);
  game.update(.01);
  assert.equal(game.arrowRainFired,true);assert.equal(game.battleTime,ARROW_RAIN_SECONDS);
  assert.ok(Math.abs(game.arrowRain.startedAt-game.arrowRainStartedAt-30)<1e-8);
  assert.equal(healthy.hp,250-ARROW_RAIN_DAMAGE);assert.equal(frail.hp,0);
  assert.equal(game.kills,1);assert.equal(game.enemies.length,1);assert.equal(sample(game).angle,2*Math.PI);
  game.update(1);assert.equal(healthy.hp,50);assert.equal(game.kills,1);
  game.damageEnemy(healthy,999);game.update(1);assert.equal(game.awaitingWave,true);
  game.update(15);assert.equal(game.wave,2);assert.equal(game.arrowRainStartedAt,null);assert.equal(game.lastEnemySpawnAt,null);
  assert.equal(game.battleTime,0);assert.equal(game.arrowRainFired,false);assert.equal(sample(game).waitingForSpawns,true);
  game.update(.01);assert.equal(game.arrowRainStartedAt,game.time);assert.equal(game.battleTime,0);
  game.start();assert.equal(game.battleTime,0);assert.equal(game.arrowRainStartedAt,null);assert.equal(game.arrowRainFired,false);assert.equal(game.arrowRain,null);
});

test('an empty spawn queue does not start the countdown while the final enemy is blocked at the entrance',()=>{
  const game=setup([[3,3]],0);let open=false;
  game.enemySpaceFree=()=>game.enemies.length===0||open;
  game.update(.01);assert.equal(game.spawnQueue.length,0);assert.equal(game.pendingSpawns.length,1);
  game.update(40);assert.equal(game.arrowRainStartedAt,null);assert.equal(sample(game).remaining,30);assert.equal(game.arrowRainFired,false);
  open=true;game.update(.01);assert.equal(game.pendingSpawns.length,0);assert.equal(game.enemies.length,2);
  assert.equal(game.arrowRainStartedAt,game.time);assert.equal(game.battleTime,0);
  game.update(29.99);assert.equal(game.arrowRainFired,false);
  game.update(.01);assert.equal(game.arrowRainFired,true);
});

test('reinforcement gaps belong to the same wave and do not start the arrow rain countdown early',()=>{
  const game=setup([[{level:3,delay:0},{level:3,delay:5,afterPreviousSpawn:5}]]);
  game.update(.01);const firstSpawn=game.lastEnemySpawnAt;
  game.update(4.99);assert.equal(game.enemies.length,1);assert.equal(game.arrowRainStartedAt,null);
  game.update(.01);assert.equal(game.enemies.length,2);assert.ok(game.lastEnemySpawnAt-firstSpawn>=5-1e-9);
  assert.equal(game.arrowRainStartedAt,game.lastEnemySpawnAt);assert.equal(game.battleTime,0);
  game.update(29.99);assert.equal(game.arrowRainFired,false);
  game.update(.01);assert.equal(game.arrowRainFired,true);
});

test('clearing a wave before the countdown ends cancels that wave rain',()=>{
  const game=setup([[3],[3]]);game.update(.01);game.update(29);
  game.damageEnemy(game.enemies[0],999);game.update(1);
  assert.equal(game.awaitingWave,true);assert.equal(game.arrowRainFired,false);assert.equal(game.arrowRain,null);
  game.update(15);assert.equal(game.wave,2);assert.equal(game.arrowRainStartedAt,null);assert.equal(game.battleTime,0);
});
