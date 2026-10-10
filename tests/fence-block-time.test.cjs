const {test}=require('node:test'),assert=require('node:assert/strict');
const {LevelThreeGame}=require('../dist/level-three.js'),Road=require('../dist/road-building.js');
function setup(){
 const g=new LevelThreeGame();g.start();g.wallsUnlocked=true;
 const p=Road.at(g,1008,400),wall=g.placeWall(p.x,p.y,p.orientation).wall;
 return {g,wall};
}
test('blocking time excludes idle and approach, counts simultaneous attackers once, and survives destruction',()=>{
 const {g,wall}=setup();g.update(1);assert.equal(wall.blockedTime,0);
 const enemy={id:1,level:1,hp:44,targetId:wall.id,x:wall.x+150,y:wall.y};g.enemies=[enemy];
 g.updateWallBlockedTime(1);assert.equal(wall.blockedTime,0);
 enemy.x=wall.x+wall.width/2+64;
 g.enemies.push({...enemy,id:2,y:wall.y+20});
 for(let i=0;i<8;i++)g.updateWallBlockedTime(1);
 assert.equal(wall.blockedTime,8);
 g.enemies=[];g.updateWallBlockedTime(2);assert.equal(wall.blockedTime,8);
 g.enemies=[enemy];g.updateWallBlockedTime(.5);assert.equal(wall.blockedTime,8.5);
 g.damageTower(wall,150);g.updateWallBlockedTime(2);assert.equal(wall.blockedTime,8.5);
 assert.equal(g.wallsRemaining,2);g.start();assert.equal(g.walls.length,0);assert.equal(g.wallsRemaining,3);
});
test('game updates accumulate simulation seconds while an enemy attacks the selected fence',()=>{
 const {g,wall}=setup();
 g.enemies=[{id:1,level:1,hp:44,maxHp:44,targetId:wall.id,x:wall.x+wall.width/2+64,y:wall.y,routeIndex:0,distance:200,remaining:1000,attackCooldown:100}];
 for(let i=0;i<80;i++)g.update(.1);
 assert.ok(Math.abs(wall.blockedTime-8)<1e-8);
 assert.equal(Road.at(g,wall.x,wall.y).wall,wall);
 g.enemies=[];g.update(2);assert.ok(Math.abs(wall.blockedTime-8)<1e-8);
});
