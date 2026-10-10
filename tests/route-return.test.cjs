const test=require('node:test'),assert=require('node:assert/strict');
const {Game,createScenario,ENEMIES,position}=require('../dist/engine.js');
function setup(paths=[[[0,100],[1000,100]]],scale=1){
  const g=new Game(()=>0,createScenario({paths,worldScale:scale}));g.start();return g;
}
function enemy(g,{level=1,distance=100,x=360,y=160,routeIndex=0}={}){
  const e={id:g.nextId++,level,distance,x,y,routeIndex,offRoute:true,hp:ENEMIES[level].hp,maxHp:ENEMIES[level].hp};
  g.enemies.push(e);return e;
}
function close(actual,expected){assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);}

test('destroying an off-road tower sends its attacker straight to the nearest road point',()=>{
  for(const scale of [1,2]){
    const g=setup(undefined,scale),tower={id:0,x:400,y:100+50*scale,level:1,hp:100,cooldown:Infinity};g.slots.push(tower);
    const e=enemy(g,{distance:0,x:0,y:100});e.offRoute=false;
    g.update(10);assert.equal(e.targetId,0);assert.equal(e.offRoute,true);
    const oldAnchor=position(e.distance,g.level.routes[0]),before={x:e.x,y:e.y};
    assert.ok(before.x>oldAnchor.x+1);g.damageTower(tower,100);g.update(.01);
    close(e.x,before.x);assert.ok(e.y<before.y);assert.equal(e.targetId,null);
    assert.ok(Math.hypot(e.x-before.x,e.y-before.y)<=ENEMIES[1].speed*scale*.01+1e-7);
    for(let i=0;i<120;i++)g.update(1/60);
    assert.equal(e.offRoute,false);close(e.y,100);assert.ok(e.distance>before.x);
  }
});

test('all enemy types rejoin at their current projection and spend only the remaining movement budget',()=>{
  for(let level=1;level<ENEMIES.length;level++)for(const scale of [1,2]){
    const g=setup(undefined,scale),e=enemy(g,{level});
    const speed=ENEMIES[level].speed*scale*(g.isCharging(e)?ENEMIES[level].chargeSpeedMultiplier:1);
    g.moveEnemy(e,(60+20)/speed);
    close(e.x,380);close(e.y,100);close(e.distance,380);close(e.remaining,620);assert.equal(e.offRoute,false);
  }
});

test('nearest re-entry may be on a later segment around a bend',()=>{
  const g=setup([[[0,0],[200,0],[200,400]]]),e=enemy(g,{x:160,y:300});
  g.moveEnemy(e,.1);close(e.x,165.7);close(e.y,300);assert.equal(e.offRoute,true);
  g.moveEnemy(e,(40-5.7)/57);close(e.x,200);close(e.y,300);close(e.distance,500);assert.equal(e.offRoute,false);
  g.moveEnemy(e,.1);close(e.x,200);close(e.y,305.7);close(e.remaining,94.3);
});

test('diagonal roads use the perpendicular projection, not a waypoint or old departure point',()=>{
  const g=setup([[[0,0],[300,300],[600,300]]]),e=enemy(g,{distance:20,x:200,y:100});
  const distance=Math.hypot(50,50);g.moveEnemy(e,distance/57);
  close(e.x,150);close(e.y,150);close(e.distance,Math.hypot(150,150));assert.equal(e.offRoute,false);
});

test('rejoining behind the old route progress does not cause forward teleportation',()=>{
  const g=setup(),e=enemy(g,{distance:500,x:200,y:150});g.moveEnemy(e,50/57);
  close(e.x,200);close(e.y,100);close(e.distance,200);close(e.remaining,800);
  g.moveEnemy(e,.1);close(e.x,205.7);
});

test('return stays on the assigned branch and equally near segments prefer the previous progress',()=>{
  const g=setup([[[0,100],[1000,100]],[[0,175],[1000,175]]]),e=enemy(g,{x:200,y:170});
  g.moveEnemy(e,.1);assert.equal(e.routeIndex,0);close(e.x,200);close(e.y,164.3);
  const loop=setup([[[0,0],[200,0],[200,200],[0,200]]]),other=enemy(loop,{distance:500,x:100,y:100});
  loop.moveEnemy(other,.1);close(other.x,100);close(other.y,105.7);
});

test('nearest points clamp to road endpoints and arrival still resolves an escape once',()=>{
  const g=setup(),e=enemy(g,{distance:100,x:1030,y:140});
  g.moveEnemy(e,50/57);close(e.x,1000);close(e.y,100);assert.equal(e.escaped,true);assert.equal(g.lives,2);
  g.update(1);assert.equal(g.lives,2);
});
