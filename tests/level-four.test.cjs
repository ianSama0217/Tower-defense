const {test}=require('node:test'),assert=require('node:assert/strict');
const {LevelFourGame,scenario}=require('../dist/level-four.js');
const E=require('../dist/environment.js'),Road=require('../dist/road-building.js');
const specs=require('../dist/assets/environment/sprites.json');
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

test('six-wave battle waits for manual start and resets cleanly',()=>{
  const g=new LevelFourGame();g.start();
  assert.equal(g.waves.length,6);assert.equal(g.level.wavesPending,undefined);
  assert.equal(g.canStartWave,true);
  assert.equal(g.build(0).ok,true);
  for(let i=0;i<600;i++)g.update(1);
  assert.equal(g.slots[0].action,null);assert.equal(g.wave,0);
  assert.equal(g.phase,'playing');assert.equal(g.enemies.length,0);assert.equal(g.lives,3);
  const stage=require('../dist/level-progress.js').stages[3];
  assert.equal(stage.preview,undefined);assert.equal(stage.href,'level-four.html');assert.deepEqual(stage.enemies,[1,6,2,4]);
  assert.equal(g.startNextWave(),true);g.update(.01);assert.equal(g.enemies.length,1);
  g.start();assert.equal(g.wave,0);assert.equal(g.money,150);assert.equal(g.enemies.length,0);assert.equal(g.canStartWave,true);
  assert.equal(require('../dist/tower-menu.js').state(g,0).build.label,'建造箭塔');
  assert.equal(g.roadBuilding.type,'fence');
});

test('six waves spawn all 118 requested units in order with actual-entry reinforcement timing',()=>{
  const expected=[[[1,5],[6,5]],[[1,10],[6,6],[2,1]],[[1,10],[6,6],[2,2],[4,1]],
    [[2,2],[1,6],[4,2],[6,8]],[[2,2],[1,10],[4,2],[6,8]],[[2,2],[4,2],[6,8],[2,2],[1,8],[4,4],[6,6]]];
  const g=new LevelFourGame(),seen=[];g.start();
  g.onEnemySpawn=()=>{const e=g.enemies.at(-1);seen.push({wave:g.wave,type:e.level,route:e.routeIndex,time:g.time});g.damageEnemy(e,999);if(e.hp>0)g.damageEnemy(e,999);};
  g.startNextWave();
  for(let i=0;i<40000&&g.phase==='playing';i++)g.update(1/60);
  assert.equal(g.phase,'won');assert.equal(g.wave,6);assert.equal(g.kills,118);
  assert.deepEqual([...new Set(seen.map(e=>e.route))],[0]);
  for(let wave=1;wave<=6;wave++){
    const events=seen.filter(e=>e.wave===wave);
    assert.deepEqual(events.map(e=>e.type),expected[wave-1].flatMap(([type,count])=>Array(count).fill(type)));
    for(let i=1;i<events.length;i++){
      const delay=(wave===2||wave===3)&&i===16||wave===6&&i===12?5:1.35;
      assert.ok(Math.abs(events[i].time-events[i-1].time-delay)<.025,`wave ${wave}, unit ${i+1}`);
    }
    if(wave>1)assert.ok(events[0].time-seen.filter(e=>e.wave===wave-1).at(-1).time>=15);
  }
  assert.equal(g.money,150+49*10+47*10+11*20+11*15+5*30);
  const P=require('../dist/level-progress.js'),data=new Map([[P.KEY,'[3,3,3,0,0]']]);
  const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const result=require('../dist/result-panel.js').summarize(g,storage);
  assert.equal(result.stars,3);assert.deepEqual(P.read(storage),[3,3,3,3,0]);assert.equal(P.unlocked(P.read(storage),4),true);
  assert.equal(result.bombTowerReward,'unlocked');assert.equal(P.bombTowersUnlocked(P.read(storage)),true);
});

test('waves 2, 3 and 6 delay reinforcements until five seconds after a blocked batch actually enters',()=>{
  for(const [wave,batchSize] of [[2,16],[3,16],[6,12]]){
    const g=new LevelFourGame(),seen=[];let open=false;
    g.start();g.wave=wave-1;g.launchWave();g.enemySpaceFree=()=>open;
    g.onEnemySpawn=()=>{const e=g.enemies.at(-1);seen.push({type:e.level,time:g.time});g.damageEnemy(e,999);if(e.hp>0)g.damageEnemy(e,999);};
    for(let i=0;i<1500;i++)g.update(1/60);
    assert.equal(seen.length,0);assert.equal(g.pendingSpawns.length,batchSize);
    open=true;g.update(1/60);assert.equal(seen.length,batchSize);
    for(let i=0;i<294;i++)g.update(1/60);assert.equal(seen.length,batchSize);
    for(let i=0;i<8;i++)g.update(1/60);assert.equal(seen.length,batchSize+1);
    assert.ok(Math.abs(seen[batchSize].time-seen[batchSize-1].time-5)<.02);
  }
});

test('full-width road cells support perpendicular fences through both switchbacks',()=>{
  const g=new LevelFourGame();g.start();g.wallsUnlocked=true;
  assert.equal(g.worldScale,2);assert.equal(g.level.mapConfig.roadWidth,96);
  assert.equal(g.slots.length,13);assert.equal(g.level.routes.length,1);
  const cells=Road.cells(g.level);
  for(let i=0;i<cells.length;i++){
    const cell=cells[i],p=Road.at(g,cell.x,cell.y);
    assert.ok(p,`missing placement at ${cell.x},${cell.y}`);
    if(!p.blocked){assert.equal(g.canPlaceWall(p.x,p.y,p.orientation).ok,true);assert.equal(Math.max(p.width,p.height),96);}
    for(const other of cells.slice(i+1))assert.equal(overlap(cell.frame,other.frame),false);
  }
  for(const pad of g.slots)for(const road of E.roadRects(g.level)){
    assert.equal(overlap({x:pad.x-36,y:pad.y-30,w:72,h:60},road),false);
  }
  for(const point of [[160,432],[720,432]]){
    const p=Road.at(g,...point);assert.equal(g.placeWall(p.x,p.y,p.orientation).ok,true);
  }
  assert.deepEqual(g.walls.map(w=>w.orientation),['vertical','horizontal']);
});

test('rock density rises in the right third while scenery clears roads and towers',()=>{
  const s=scenario(),images=Object.fromEntries(Object.entries(specs).map(([k,v])=>[k,{naturalWidth:v.width,naturalHeight:v.height}]));
  images.enemyEntranceFlag={naturalWidth:48,naturalHeight:80};
  const items=E.placements(s,images,2),trees=new Set(E.names.slice(0,11));
  const rocks=new Set(['boulders','standingRock','rockCluster','mossRock','rock','pebble','lowRock']);
  const right=items.filter(p=>p.x>=s.mapConfig.width*2/3),left=items.filter(p=>p.x<s.mapConfig.width*2/3);
  assert.ok(items.filter(p=>trees.has(p.name)).length<=12);
  assert.equal(right.filter(p=>trees.has(p.name)).length,0);
  assert.ok(right.filter(p=>rocks.has(p.name)).length>left.filter(p=>rocks.has(p.name)).length);
  for(const item of items){
    for(const road of E.roadRects(s,4))assert.equal(overlap(item,road),false);
    for(const pad of s.slots)assert.equal(overlap(item,{x:pad.x-48,y:pad.y-112,w:96,h:156}),false);
    for(const flag of E.entranceFlags(s,2))assert.equal(overlap(item,flag),false);
  }
});
