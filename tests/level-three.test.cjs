const {test}=require('node:test'),assert=require('node:assert/strict');
const {LevelThreeGame,scenario}=require('../dist/level-three.js');
const E=require('../dist/environment.js'),P=require('../dist/level-progress.js');
const specs=require('../dist/assets/environment/sprites.json');
const Road=require('../dist/road-building.js');
test('third stage builds wooden fences with existing fence durability instead of stone walls',()=>{
 const g=new LevelThreeGame();g.start();g.wallsUnlocked=true;
 const p=Road.at(g,1008,400);assert.equal(Road.item(g,p).label,'建造柵欄');
 const result=g.placeWall(p.x,p.y,p.orientation);assert.equal(result.ok,true);
 assert.equal(result.wall.buildingType,'fence');assert.equal(result.wall.material,'wood');
 assert.equal(result.wall.hp,150);assert.equal(result.wall.maxHp,150);assert.equal(g.money,120-g.roadBuilding.cost);
 g.damageTower(result.wall,120);assert.equal(result.wall.hp,30);
 g.damageTower(result.wall,30);assert.equal(result.wall.level,0);assert.equal(g.wallsRemaining,2);
});
test('road selection uses stable cells with no overlapping frames, including junctions',()=>{
  const g=new LevelThreeGame();g.start();g.wallsUnlocked=true;
  const cells=Road.cells(g.level);
  for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++){
    const a=cells[i].frame,b=cells[j].frame;
    assert.equal(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y,false);
  }
  assert.deepEqual(Road.at(g,1100,400),Road.at(g,1150,400));
  assert.notDeepEqual(Road.at(g,1008,400).frame,Road.at(g,1120,400).frame);
  for(const cell of cells){
    assert.equal(cell.frame.w,96);assert.equal(cell.frame.h,96);
    const placement=Road.at(g,cell.x,cell.y);assert.ok(placement);
    assert.equal(g.canPlaceWall(placement.x,placement.y,placement.orientation).ok,!placement.blocked);
  }
  for(const [x,y] of [[24,400],[368,400],[832,336],[1200,400],[1260,400]]){
    const placement=Road.at(g,x,y);assert.ok(placement);assert.equal(placement.frame.w,placement.frame.h);
  }
});
test('road menu chooses perpendicular walls and separates selectable ground from funds and stock',()=>{
  const g=new LevelThreeGame();g.start();assert.equal(Road.at(g,1008,400),null);
  g.wallsUnlocked=true;
  const straight=Road.at(g,1008,400),bend=Road.at(g,832,336);
  assert.equal(straight.orientation,'vertical');assert.equal(bend.orientation,'horizontal');
  assert.equal(straight.height,96);assert.equal(bend.width,96);
  assert.equal(Road.at(g,1120,200),null);assert.equal(Road.at(g,640,400),null);
  assert.equal(Road.item(g,straight).disabled,false);
  assert.equal(Road.item(g,straight,{paused:true}).disabled,true);
  g.money=0;assert.ok(Road.at(g,1008,400));assert.equal(Road.item(g,straight).disabled,g.roadBuilding.cost>0);
  g.money=500;assert.equal(g.placeWall(straight.x,straight.y,straight.orientation).ok,true);
  assert.equal(Road.at(g,1008,400).wall,g.walls[0]);
  assert.equal(Road.item(g,Road.at(g,1008,400)).disabled,true);
  for(const x of [928,96]){const p=Road.at(g,x,400);assert.equal(g.placeWall(p.x,p.y,p.orientation).ok,true);}
  assert.equal(g.wallsRemaining,0);assert.ok(Road.at(g,256,400));
  assert.equal(Road.item(g,Road.at(g,256,400)).disabled,true);
  const {LevelTwoGame}=require('../dist/level-two.js'),second=new LevelTwoGame();second.start();second.wallsUnlocked=true;
  assert.equal(Road.at(second,1120,184),null);
});
test('first two entrance cells reject every building and leave funds and stock unchanged',()=>{
  const g=new LevelThreeGame();g.start();g.wallsUnlocked=true;g.money=1000;
  assert.equal(Road.cells(g.level).filter(c=>Road.at(g,c.x,c.y)?.blocked).length,2);
  for(const x of [1100,1120,1200,1260]){
    const p=Road.at(g,x,400);assert.equal(p.blocked,true);assert.equal(Road.item(g,p).disabled,true);
    for(const orientation of ['horizontal','vertical']){
      const result=g.placeWall(x,400,orientation);assert.equal(result.ok,false);assert.match(result.message,/禁建區/);
    }
  }
  assert.equal(g.money,1000);assert.equal(g.wallsRemaining,3);assert.equal(g.walls.length,0);
  g.slots[0].x=1200;g.slots[0].y=400;
  assert.equal(g.build(0).ok,false);assert.equal(g.slots[0].level,0);assert.equal(g.money,1000);
  assert.equal(Road.at(g,1008,400).blocked,undefined);
  assert.equal(g.placeWall(1040,400,'vertical').ok,true);
  assert.equal(g.build(1).ok,true);
});
test('third-stage reference has equal approaches and branches, with two inner pads replacing the center',()=>{
  const s=scenario(),[upper,lower]=s.routes;
  assert.equal(upper.length,lower.length);
  for(const route of s.routes){
    assert.equal(route.segments[0],route.segments.at(-1));
    assert.deepEqual(route.path[0],{x:1280,y:400});
    assert.deepEqual(route.path.at(-1),{x:0,y:400});
  }
  assert.equal(s.slots.length,10);
  assert.deepEqual(s.slots.filter(pad=>pad.y===400),[{x:544,y:400},{x:736,y:400}]);
  assert.ok(s.slots.every(pad=>pad.x!==1152));
  assert.equal(s.mapConfig.roadWidth,96);
  assert.deepEqual(P.stages[2].enemies,[1,6,2]);
  assert.equal(P.stages[2].href,'level-three.html');
});
test('first wave waits for the player while construction works, and restart resets combat',()=>{
  const g=new LevelThreeGame();g.start();
  assert.equal(g.waves.length,6);assert.equal(g.level.wavesPending,undefined);
  assert.equal(g.canStartWave,true);
  g.money=500;assert.equal(g.build(5).ok,true);g.update(5);
  assert.equal(g.slots[5].action,null);
  assert.equal(g.build(5).ok,true);g.update(5);assert.equal(g.slots[5].level,2);
  assert.equal(g.demolish(5).ok,true);g.update(3);assert.equal(g.slots[5].level,0);
  for(let i=0;i<600;i++)g.update(1);
  assert.equal(g.phase,'playing');assert.equal(g.wave,0);assert.equal(g.enemies.length,0);
  assert.equal(g.lives,3);assert.equal(g.kills,0);
  assert.equal(g.startNextWave(),true);g.update(.01);assert.ok(g.enemies.length>0);
  g.start();assert.equal(g.money,120);assert.equal(g.wave,0);assert.equal(g.pendingSpawns.length,0);assert.equal(g.enemies.length,0);assert.equal(g.canStartWave,true);
});
test('all six waves match the requested counts, order and five-second reinforcement gaps',()=>{
  const expected=[[[1,6],[6,4]],[[1,10],[6,6]],[[1,10],[6,6],[2,2]],[[2,2],[1,8],[6,8]],[[2,2],[1,12],[6,8]],[[2,2],[6,8],[2,2],[1,12],[6,8]]];
  let seed=123;const g=new LevelThreeGame(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)),seen=[];
  g.start();g.onEnemySpawn=()=>{const e=g.enemies.at(-1);seen.push({wave:g.wave,type:e.level,route:e.routeIndex,time:g.time});g.damageEnemy(e,999);};
  g.startNextWave();
  for(let i=0;i<40000&&g.phase==='playing';i++)g.update(1/60);
  assert.equal(g.phase,'won');assert.equal(g.wave,6);assert.equal(g.kills,116);
  assert.deepEqual([...new Set(seen.map(e=>e.route))].sort(),[0,1]);
  for(let wave=1;wave<=6;wave++){
    const events=seen.filter(e=>e.wave===wave);
    assert.deepEqual(events.map(e=>e.type),expected[wave-1].flatMap(([type,count])=>Array(count).fill(type)));
    for(let i=1;i<events.length;i++){
      const delay=wave===3&&i===16||wave===6&&i===10?5:1.35;
      assert.ok(Math.abs(events[i].time-events[i-1].time-delay)<.025,`wave ${wave}, spawn ${i}: ${events[i].time-events[i-1].time}`);
    }
    if(wave>1)assert.ok(events[0].time-seen.filter(e=>e.wave===wave-1).at(-1).time>=15);
  }
  const rewards=58*11+48*12+10*18;
  assert.equal(g.money,120+rewards+5*30);g.update(60);assert.equal(g.money,120+rewards+5*30);
  const data=new Map([[P.KEY,'[3,3,0,0,0]']]),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const result=require('../dist/result-panel.js').summarize(g,storage);
  assert.equal(result.stars,3);assert.deepEqual(P.read(storage),[3,3,3,0,0]);assert.equal(P.unlocked(P.read(storage),3),true);
});
test('random choices follow the matching middle branch without changing the shared entrance',()=>{
  for(const [random,routeIndex,direction] of [[()=>0,0,-1],[()=>.999,1,1]]){
    const g=new LevelThreeGame(random);g.start();g.startNextWave();g.update(.01);
    const e=g.enemies[0];assert.equal(e.routeIndex,routeIndex);assert.equal(e.y,400);
    for(let i=0;i<300;i++)g.update(1/60);
    assert.equal(Math.sign(e.y-400),direction);assert.ok(e.x<832&&e.x>448);assert.ok(Math.abs(e.y-(routeIndex?528:272))<=48);
  }
});
test('reinforcements wait five seconds after actual batch entry even when the entrance was blocked',()=>{
  const g=new LevelThreeGame(()=>0),seen=[];let open=false;
  g.start();g.wave=2;g.launchWave();g.enemySpaceFree=()=>open;
  g.onEnemySpawn=()=>{const e=g.enemies.at(-1);seen.push({type:e.level,time:g.time});g.damageEnemy(e,999);};
  for(let i=0;i<1500;i++)g.update(1/60);
  assert.equal(seen.length,0);assert.equal(g.pendingSpawns.length,16);
  open=true;g.update(1/60);assert.equal(seen.length,16);
  for(let i=0;i<294;i++)g.update(1/60);assert.equal(seen.length,16);
  for(let i=0;i<8;i++)g.update(1/60);assert.equal(seen.length,17);
  assert.ok(Math.abs(seen[16].time-seen[15].time-5)<.02);
});
test('richer forest decorations keep roads and tower areas free',()=>{
  const s=scenario(),images=Object.fromEntries(Object.entries(specs).map(([k,v])=>[k,{naturalWidth:v.width,naturalHeight:v.height}]));
  const items=E.placements(s,images,2),overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  assert.ok(items.length>=500);
  assert.ok(items.filter(p=>['whiteFlowers','pinkFlowers','flowers'].includes(p.name)).length>=100);
  for(const item of items){
    for(const road of E.roadRects(s,4))assert.equal(overlap(item,road),false);
    for(const pad of s.slots)assert.equal(overlap(item,{x:pad.x-48,y:pad.y-112,w:96,h:156}),false);
  }
});
