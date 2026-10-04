const test=require('node:test'),assert=require('node:assert/strict');
const TD=require('../dist/engine.js'),Sprites=require('../dist/wall-sprites.js');
const {TutorialGame}=require('../dist/tutorial-level.js');
function game(scale=1){const g=new TD.Game(()=>0,TD.createScenario({paths:[[[0,200],[1000,200]]],slots:[[240,310]],waves:[[1]],manualWaves:true,worldScale:scale,initialMoney:1000}));g.start();return g;}
function enemy(g,level,x=220){const spec=TD.ENEMIES[level],e={id:g.nextId++,level,x,y:200,distance:x,routeIndex:0,hp:spec.hp,maxHp:spec.hp};g.enemies.push(e);return e;}
test('three lifetime purchases, exactly $100 each; destruction does not refund stock, restart resets',()=>{
  const g=game();for(const x of [200,400,600])assert.equal(g.placeWall(x,200).ok,true);
  assert.equal(g.money,700);assert.equal(g.wallsRemaining,0);
  g.damageTower(g.walls[0],300);assert.equal(g.placeWall(800,200).ok,false);assert.equal(g.money,700);assert.equal(g.wallsRemaining,0);
  g.start();assert.equal(g.wallsRemaining,3);assert.equal(g.walls.length,0);assert.equal(g.money,1000);
});
test('placement validates road footprint, orientation, enemy occupancy, overlapping walls, money and phase without charging',()=>{
  const g=game();for(const args of [[100,100],[0,200],[100,200,'bad'],[NaN,200]])assert.equal(g.placeWall(...args).ok,false);
  assert.equal(g.money,1000);assert.equal(g.wallsRemaining,3);
  assert.equal(g.placeWall(300,200,'vertical').ok,true);assert.equal(g.placeWall(300,200).ok,false);
  enemy(g,1,500);assert.equal(g.placeWall(500,200).ok,false);
  g.money=99;assert.equal(g.placeWall(700,200).ok,false);g.money=1000;g.phase='lost';assert.equal(g.placeWall(700,200).ok,false);
});
test('orientation swaps footprint, spans road width and scales thickness',()=>{
  const g=game(2),a=g.placeWall(300,200,'vertical').wall,b=g.placeWall(600,200).wall;
  assert.equal(a.width,b.height);assert.equal(a.height,b.width);assert.equal(a.height,96);assert.equal(a.width,32);
});
test('walls cannot be repaired, upgraded or demolished with tower actions',()=>{
  const g=game(),w=g.placeWall(300,200).wall;g.damageTower(w,100);const money=g.money;
  for(const action of ['repair','build','demolish'])assert.equal(g[action](w.id).ok,false);
  g.updateTowerActions(100);assert.equal(w.hp,200);assert.equal(g.money,money);
});
test('every enemy prioritizes a wall over a closer or already locked tower',()=>{
  for(let level=1;level<TD.ENEMIES.length;level++){
    const g=game(),w=g.placeWall(320,200).wall,s=g.slots[0];Object.assign(s,{x:225,y:200,level:1,hp:100,towerId:99});
    const e=enemy(g,level);e.targetId=s.id;
    if(level===4){g.moveEnemy(e,.01);assert.equal(e.targetId,w.id);}else assert.equal(g.attackTarget(e),w);
  }
});
test('slime stops at the wall and attacks it, then resumes route after destruction',()=>{
  const g=game(),w=g.placeWall(300,200,'vertical').wall,e=enemy(g,5,100);
  g.moveEnemy(e,20);assert.equal(e.escaped,undefined);assert.ok(e.x<300);assert.equal(e.moving,false);
  g.attackTowers(.1);assert.equal(w.hp,294);g.damageTower(w,999);g.moveEnemy(e,1);assert.ok(e.x>300);assert.equal(g.lives,3);
});
test('large route step cannot skip a wall and melee hits its edge in both orientations',()=>{
  for(const orientation of ['horizontal','vertical']){
    const g=game(),w=g.placeWall(400,200,orientation).wall,e=enemy(g,1,10);g.moveEnemy(e,30);
    assert.equal(e.escaped,undefined);assert.ok(e.x<w.x);assert.equal(e.targetId,w.id);g.attackTowers(.1);assert.equal(w.hp,294);
  }
});
test('archer arrows damage walls on impact and do not transfer to a replacement',()=>{
  const g=game(),w=g.placeWall(300,200).wall,e=enemy(g,6,210);
  g.attackTowers(.01);assert.equal(w.hp,300);g.time=.3;g.attackTowers(.3);assert.equal(g.enemyArrows.length,1);g.updateEnemyArrows(1);assert.equal(w.hp,294);
  e.attackCooldown=0;g.attackTowers(.01);g.time=1;g.attackTowers(.3);g.damageTower(w,999);const fresh=g.placeWall(300,200).wall;g.updateEnemyArrows(5);assert.equal(fresh.hp,300);
});
test('bomber seeks wall first and explosion damages its footprint',()=>{
  const g=game(),w=g.placeWall(300,200).wall,e=enemy(g,4,100);g.moveEnemy(e,10);assert.equal(e.hp,0);assert.equal(w.hp,240);
});
test('unrelated distant walls do not divert ordinary enemies; destroyed walls cease being targets',()=>{
  const g=game(),w=g.placeWall(800,200).wall,e=enemy(g,1,200),s=g.slots[0];Object.assign(s,{x:220,y:200,level:1,hp:100});
  assert.equal(g.attackTarget(e),s);w.x=260;assert.equal(g.attackTarget(e),w);g.damageTower(w,300);assert.equal(g.attackTarget(e),s);
});
test('five visual states switch at damage thresholds',()=>{
  assert.deepEqual([300,241,240,151,150,76,75,1,0].map(hp=>Sprites.stage(hp,300)),[100,100,80,80,50,50,25,25,0]);
});
test('first and second levels reject walls even with money and the reward unlocked',()=>{
  const {LevelTwoGame}=require('../dist/level-two.js');
  for(const Game of [TutorialGame,LevelTwoGame]){const g=new Game();g.start();g.money=1000;g.wallsUnlocked=true;assert.equal(g.placeWall(600,400).ok,false);assert.equal(g.money,1000);assert.equal(g.wallsRemaining,3);}
});
test('placement centers on each road and snaps along it, preserving exact transverse span',()=>{
  const level=require('../dist/level-two.js').scenario(),g=new TD.Game(()=>0,{...level,stageIndex:undefined});g.start();g.money=1000;
  const a=g.placeWall(609,405,'vertical').wall,b=g.placeWall(899,285,'horizontal').wall;
  assert.ok(a);assert.ok(b);assert.equal(a.y,392);assert.equal(a.height,80);assert.equal(a.x%16,10);
  assert.equal(a.y-a.height/2,352);assert.equal(a.y+a.height/2,432);
  assert.equal(b.x,890);assert.equal(b.width,80);assert.equal(b.x-b.width/2,850);assert.equal(b.x+b.width/2,930);
  const tutorial=new TD.Game(()=>0,{...require('../dist/tutorial-level.js').scenario(),stageIndex:undefined});tutorial.start();tutorial.money=1000;
  const c=tutorial.placeWall(610,410,'vertical').wall;assert.equal(c.y,400);assert.equal(c.height,96);assert.equal(c.x%16,0);
});
test('third and later stages require the saved wall reward and use the common 96px road',()=>{
  const g=game(2);g.start({...g.level,stageIndex:2,mapConfig:{...g.level.mapConfig,roadWidth:80}});assert.equal(g.level.mapConfig.roadWidth,96);
  assert.equal(g.placeWall(600,200,'vertical').ok,false);assert.equal(g.money,1000);
  g.wallsUnlocked=true;const result=g.placeWall(600,200,'vertical');assert.equal(result.ok,true);assert.equal(result.wall.height,96);
});
test('wall art and HP use the occupied bounds, with a six pixel bar gap in either orientation',()=>{
  for(const orientation of ['horizontal','vertical'])for(const hp of [300,240,150,75]){
    const wall={x:200,y:200,orientation,hp,maxHp:300,...TD.wallSize(orientation,2,80)},b=Sprites.bounds(wall),bar=Sprites.healthBar(wall);
    assert.equal(bar.y+bar.h,b.y-6);assert.ok(b.x>=wall.x-wall.width/2);assert.ok(b.y>=wall.y-wall.height/2);
    assert.ok(b.x+b.w<=wall.x+wall.width/2);assert.ok(b.y+b.h<=wall.y+wall.height/2);
    assert.equal(Sprites.file(orientation,hp),Sprites.file('horizontal',hp));
  }
});
