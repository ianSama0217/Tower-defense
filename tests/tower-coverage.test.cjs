const {test}=require('node:test'),assert=require('node:assert/strict');
const TD=require('../dist/engine.js'),Sprites=require('../dist/tower-sprites.js'),Environment=require('../dist/environment.js');
const {LevelTwoGame,scenario:second}=require('../dist/level-two.js');
const {scenario:third}=require('../dist/level-three.js');

function tower(game,id,level,towerId){
 const slot=game.slots[id];Object.assign(slot,{level,towerId,hp:TD.TOWERS[level].hp,maxHp:TD.TOWERS[level].hp});return slot;
}

test('a rear tower actually damages a goblin stopped at the second-stage junction guard',()=>{
 const g=new LevelTwoGame(()=>0);g.start();
 const front=tower(g,3,1,1),rear=tower(g,1,1,2),route=g.level.routes[0];
 const enemy={id:1,level:1,hp:50,maxHp:50,x:front.x,y:front.y+TD.enemyRanges(1,2).attack,
  targetId:front.id,routeIndex:0,distance:route.length-front.x,remaining:front.x,offRoute:true};
 g.enemies.push(enemy);g.fireTowers(0);
 assert.deepEqual(g.bullets.map(b=>b.sourceTowerId).sort(),[front.towerId,rear.towerId]);
 g.update(.3);assert.equal(enemy.hp,50-TD.TOWERS[1].damage*2);
 assert.equal(enemy.targetId,front.id);assert.ok(front.hp<front.maxHp);
});

test('third-tier arrows leave an archer alive after one impact and kill it on the next',()=>{
 const g=new TD.Game(()=>0,TD.createScenario({paths:[[[0,0],[1000,0]]],slots:[[200,0]]}));g.start();
 const slot=tower(g,0,3,1),enemy={id:1,level:6,hp:36,maxHp:36,x:200,y:0,routeIndex:0,distance:200,remaining:800};
 g.enemies.push(enemy);g.fireTowers(0);g.damageEnemy(enemy,g.bullets[0].damage,slot.towerId);
 assert.ok(enemy.hp>0);assert.equal(g.kills,0);
 g.bullets=[];g.fireTowers(TD.TOWERS[3].interval);g.damageEnemy(enemy,g.bullets[0].damage,slot.towerId);
 assert.equal(enemy.hp,0);assert.equal(g.kills,1);
});

test('level-one towers can return fire at an archer that stops on its detection boundary',()=>{
 const g=new TD.Game(()=>0,TD.createScenario({paths:[[[0,100],[1000,100]]],slots:[[400,100]],worldScale:2}));g.start();
 const slot=tower(g,0,1,1),distance=TD.enemyRanges(6,2).detection;
 const enemy={id:1,level:6,hp:36,maxHp:36,x:slot.x-distance,y:100,routeIndex:0,distance:slot.x-distance,remaining:600+distance};
 g.enemies.push(enemy);g.moveEnemy(enemy,.1);assert.equal(enemy.moving,false);
 g.fireTowers(0);assert.equal(g.bullets.length,1);assert.equal(g.bullets[0].target,enemy);
});

test('repositioned pads leave roads clear and even the highest tower health bar stays inside the map',()=>{
 const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 for(const level of [second(),third()])for(const pad of level.slots){
  const footprint={x:pad.x-32,y:pad.y-32,w:64,h:64};
  for(const road of Environment.roadRects(level,0))assert.equal(overlap(footprint,road),false);
  const rect=Sprites.worldRect(3,pad.x,pad.y,level.mapConfig.towerSlotSize,level.worldScale);
  assert.ok(rect.y-12>=0&&rect.y+rect.h<=level.mapConfig.height);
 }
});
