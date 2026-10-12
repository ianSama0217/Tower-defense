const test=require('node:test'),assert=require('node:assert/strict');
const TD=require('../dist/engine.js'),Road=require('../dist/road-building.js');
const {LevelThreeGame}=require('../dist/level-three.js');
const setup=()=>{const g=new LevelThreeGame(()=>0);g.start();g.wallsUnlocked=true;g.money=1000;return g;};
const blocked=g=>{
 const before={money:g.money,used:g.wallsUsed,count:g.walls.length};
 const result=g.placeWall(1008,400,'vertical');
 assert.equal(result.ok,false);assert.match(result.message,/戰鬥中/);
 assert.deepEqual({money:g.money,used:g.wallsUsed,count:g.walls.length},before);
};

test('road construction closes on wave launch and reopens only for the next preparation period',()=>{
 const g=setup(),p=Road.at(g,1008,400);
 assert.equal(g.canBuildRoadBuildings,true);assert.equal(Road.item(g,p).disabled,false);
 assert.equal(g.placeWall(928,400,'vertical').ok,true);
 g.startNextWave();assert.equal(g.enemies.length,0);blocked(g);
 assert.equal(Road.item(g,p).disabled,true);assert.match(Road.item(g,p).reason,/戰鬥中/);
 assert.ok(Road.at(g,928,400).wall); // Existing structures remain inspectable.
 g.onEnemySpawn=()=>{const e=g.enemies.at(-1);g.damageEnemy(e,999);if(e.hp>0)g.damageEnemy(e,999);};
 for(let i=0;i<5000&&!g.awaitingWave;i++){
  assert.equal(g.canBuildRoadBuildings,false);g.update(1/60);
 }
 assert.equal(g.awaitingWave,true);assert.equal(g.intermissionRemaining,15);
 assert.equal(Road.item(g,p).disabled,false);
 assert.equal(g.placeWall(p.x,p.y,p.orientation).ok,true);
 g.update(14.99);assert.equal(g.canBuildRoadBuildings,true);
 g.update(.01);assert.equal(g.wave,2);blocked(g);
 g.start();g.wallsUnlocked=true;assert.equal(g.canBuildRoadBuildings,true);
});

test('reinforcement gaps and queued or living enemies do not open road construction',()=>{
 const g=setup();g.wave=2;g.launchWave();
 g.spawnQueue=[{level:2,afterPreviousSpawn:5}];g.pendingSpawns=[];g.enemies=[];
 blocked(g);
 // Pending entry or living hostiles also reject construction in a preparation state.
 g.awaitingWave=true;g.countdown=Infinity;g.spawnQueue=[];g.pendingSpawns=[{level:1,routeIndex:0}];blocked(g);
 g.pendingSpawns=[];g.enemies=[{hp:50}];blocked(g);
 g.enemies[0].hp=0;assert.equal(g.canBuildRoadBuildings,true);
});

test('shared road rule covers stone walls and later stages while tower actions remain available',()=>{
 for(const roadBuilding of ['wall','fence']){
  const level={...TD.createScenario({paths:[[[0,200],[1000,200]]],slots:[[400,350]],waves:[[1],[1]],manualWaves:true,initialMoney:1000}),stageIndex:4,roadBuilding,wallsUnlocked:true};
  const g=new TD.Game(()=>0,level);g.start();
  assert.equal(g.placeWall(200,200).ok,true);
  g.startNextWave();const money=g.money,stock=g.wallsRemaining;
  assert.equal(g.placeWall(600,200).ok,false);
  assert.equal(g.money,money);assert.equal(g.wallsRemaining,stock);
  assert.equal(g.build(0).ok,true);g.updateTowerActions(5);
  assert.equal(g.build(0).ok,true);g.updateTowerActions(5);assert.equal(g.slots[0].level,2);
 }
});

test('automatic-wave preparation is supported without allowing construction after battle ends',()=>{
 const g=new TD.Game(()=>0,TD.createScenario({paths:[[[0,200],[1000,200]]],waves:[[1],[1]],initialMoney:1000}));
 g.start();assert.equal(g.placeWall(200,200).ok,true);
 g.update(15);assert.equal(g.canBuildRoadBuildings,false);
 assert.equal(g.placeWall(600,200).ok,false);
 for(const phase of ['won','lost','ready']){g.phase=phase;assert.equal(g.canBuildRoadBuildings,false);assert.equal(g.placeWall(600,200).ok,false);}
});
