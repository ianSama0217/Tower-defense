const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,MAP_CONFIG,LEVELS,position,refundFor}=require('../dist/engine.js');

test('level two sends independent enemies down all three routes and merges at the exit',()=>{
  let count=0;
  const g=new Game(()=>[.1,.5,.9][count++%3]);g.start(1);
  for(let i=0;i<600;i++)g.update(1/30);
  assert.deepEqual(g.enemies.slice(0,3).map(e=>e.routeIndex),[0,1,2]);
  const forkDistance=470+170;
  assert.deepEqual(position(forkDistance+100,LEVELS[1].routes[0]),{x:420,y:220});
  assert.deepEqual(position(forkDistance+100,LEVELS[1].routes[1]),{x:520,y:320});
  assert.deepEqual(position(forkDistance+100,LEVELS[1].routes[2]),{x:620,y:220});
  for(const route of LEVELS[1].routes){
    assert.deepEqual(position(route.length-700,route),{x:520,y:530});
    assert.deepEqual(position(route.length,route),{x:40,y:750});
    assert.equal(new Set(route.path.map(p=>`${p.x},${p.y}`)).size,route.path.length);
  }
});

test('arrow tower upgrade, demolition refund and rebuilding cannot generate free coins',()=>{
  const g=new Game();g.start();g.countdown=999;
  assert.equal(g.build(0).ok,true);assert.equal(g.money,120);
  assert.equal(g.build(0).ok,true);assert.equal(g.money,40);
  assert.equal(g.slots[0].level,1);g.update(5);
  assert.equal(g.build(0).ok,false);
  assert.equal(refundFor(2),70);
  assert.equal(g.demolish(0).refund,70);assert.equal(g.money,40);g.update(3);
  assert.equal(g.money,110);assert.equal(g.slots[0].level,0);
  assert.equal(g.demolish(0).ok,false);assert.equal(g.money,110);
  assert.equal(g.build(0).ok,true);assert.equal(g.money,50);
  assert.equal(g.build(-1).ok,false);assert.equal(g.demolish(500).ok,false);
  g.money=500;g.build(0);g.update(5);g.build(0);g.update(5);
  assert.equal(g.slots[0].level,3);assert.equal(g.build(0).ok,false);
  assert.equal(g.demolish(0).refund,132);
});

test('switching and replaying levels reset towers, health, money and combat state',()=>{
  const g=new Game();g.start(0);g.build(0);g.lives=1;
  g.start(1);assert.equal(g.slots.length,28);assert.equal(g.slots.every(s=>s.level===0),true);
  assert.equal(g.lives,3);assert.equal(g.money,180);assert.equal(g.wave,0);
  g.start();assert.equal(g.levelIndex,1);
  g.start(0);assert.equal(g.slots.length,27);assert.equal(g.level.routes.length,1);
});

test('each route costs exactly one heart on escape; zero health ends the game',()=>{
  const g=new Game();g.start(1);
  for(let i=0;i<3;i++){
    const route=g.level.routes[i];
    g.enemies.push({id:i,routeIndex:i,level:1,hp:44,maxHp:44,distance:route.length-.1,...position(route.length-.1,route)});
    g.update(1/30);assert.equal(g.lives,2-i);
  }
  assert.equal(g.phase,'lost');assert.equal(g.demolish(0).ok,false);
});

test('all build pads stay clear of roads in both levels',()=>{
  function distance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
  for(const level of LEVELS)for(const slot of level.slots)for(const route of level.routes)for(let i=1;i<route.path.length;i++)assert.ok(distance(slot,route.path[i-1],route.path[i])>=(level.mapConfig.roadWidth+level.mapConfig.towerSlotSize)/2,`${level.name} pad overlaps road`);
});

test('level one uses the requested tile configuration and follows the right-to-left sketch',()=>{
  assert.deepEqual(MAP_CONFIG,{width:1280,height:768,tileSize:32,cols:40,rows:24,roadWidth:96,towerSlotSize:64,debugGrid:false});
  const level=LEVELS[0],route=level.routes[0];
  assert.equal(level.mapConfig,MAP_CONFIG);
  assert.deepEqual(route.path, [{x:1280,y:464},{x:944,y:464},{x:944,y:272},{x:688,y:272},{x:688,y:624},{x:432,y:624},{x:432,y:464},{x:0,y:464}]);
  assert.deepEqual(position(1,route),{x:1279,y:464});
  assert.deepEqual(position(route.length,route),{x:0,y:464});
  assert.equal(MAP_CONFIG.cols*MAP_CONFIG.tileSize,MAP_CONFIG.width);
  assert.equal(MAP_CONFIG.rows*MAP_CONFIG.tileSize,MAP_CONFIG.height);
  for(const slot of level.slots){
    assert.equal((slot.x-32)%32,0);assert.equal((slot.y-32)%32,0);
    assert.ok(slot.x>=32&&slot.x<=1248&&slot.y>=32&&slot.y<=736);
  }
  for(let i=1;i<route.path.length;i++){
    const a=route.path[i-1],b=route.path[i];
    assert.ok(a.x===b.x||a.y===b.y);
    assert.equal(((a.x===b.x?a.x:a.y)-MAP_CONFIG.roadWidth/2)%MAP_CONFIG.tileSize,0);
  }
});
