const {test}=require('node:test'),assert=require('node:assert/strict');
const {LevelFiveGame,scenario}=require('../dist/level-five.js');
const E=require('../dist/environment.js'),Road=require('../dist/road-building.js');
const specs=require('../dist/assets/environment/sprites.json');
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

test('six-wave combat waits for manual start, supports both towers and resets cleanly',()=>{
  const g=new LevelFiveGame();g.start();
  assert.equal(g.waves.length,6);assert.equal(g.level.wavesPending,undefined);
  assert.equal(g.canStartWave,true);
  assert.equal(g.build(0).ok,true);
  assert.equal(g.build(1,'bomb').ok,true);assert.equal(g.money,10);
  for(let i=0;i<600;i++)g.update(1);
  assert.equal(g.phase,'playing');assert.equal(g.wave,0);assert.equal(g.enemies.length,0);
  assert.equal(g.slots[0].action,null);
  const P=require('../dist/level-progress.js');
  assert.equal(P.starsForResult(g.phase,g.lives),0);assert.equal(P.stages[4].preview,undefined);
  assert.equal(P.stages[4].href,'level-five.html');assert.deepEqual(P.stages[4].enemies,[1,6,4,7]);
  assert.equal(g.startNextWave(),true);g.update(.01);assert.equal(g.enemies.length,1);
  g.start();assert.equal(g.money,150);assert.equal(g.wave,0);assert.equal(g.canStartWave,true);assert.deepEqual(g.bombs,[]);
});

test('all 147 enemies follow the specified batch order, 0.8s fast waves, and 3/5s reinforcements',()=>{
  const expected=[[[1,5],[6,5]],[[1,10],[6,5],[4,3]],[[1,10],[6,8],[1,8],[4,4],[6,6]],
    [[1,12],[4,2],[6,8]],[[1,15],[4,2],[6,10]],[[1,10],[6,5],[7,1],[1,8],[4,4],[6,6]]];
  const g=new LevelFiveGame(),seen=[];g.start();
  g.onEnemySpawn=()=>{
    const e=g.enemies.at(-1);seen.push({wave:g.wave,type:e.level,time:g.time,route:e.routeIndex});
    if(e.level!==7)g.damageEnemy(e,999);
    if(seen.length===147)g.damageEnemy(g.enemies.find(e=>e.level===7),999);
  };
  g.startNextWave();for(let i=0;i<40000&&g.phase==='playing';i++)g.update(1/60);
  assert.equal(g.phase,'won');assert.equal(g.wave,6);assert.equal(g.kills,147);assert.equal(g.money,1845);
  for(let wave=1;wave<=6;wave++){
    const events=seen.filter(e=>e.wave===wave);
    assert.deepEqual(events.map(e=>e.type),expected[wave-1].flatMap(([type,count])=>Array(count).fill(type)));
    for(let i=1;i<events.length;i++){
      const delay=wave===2&&i===15?3:(wave===3&&i===18||wave===6&&i===15)?5:[3,6].includes(wave)?.8:1.35;
      assert.ok(Math.abs(events[i].time-events[i-1].time-delay)<.025,`wave ${wave}, unit ${i+1}, delay ${events[i].time-events[i-1].time}`);
    }
    if(wave>1)assert.ok(events[0].time-seen.filter(e=>e.wave===wave-1).at(-1).time>=15);
  }
  assert.ok(seen.every(e=>e.route===0));
  const P=require('../dist/level-progress.js'),data=new Map([[P.KEY,'[3,3,3,3,0]']]);
  const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const result=require('../dist/result-panel.js').summarize(g,storage);
  assert.equal(result.stars,3);assert.deepEqual(P.read(storage),[3,3,3,3,3]);assert.equal(result.nextHref,null);
});

test('blocked entrances delay each reinforcement from the last actual entry',()=>{
  for(const [wave,batchSize,delay] of [[2,15,3],[3,18,5],[6,15,5]]){
    const g=new LevelFiveGame(),seen=[];let open=false;g.start();g.wave=wave-1;g.launchWave();g.enemySpaceFree=()=>open;
    g.onEnemySpawn=()=>{const e=g.enemies.at(-1);seen.push(g.time);g.damageEnemy(e,999);};
    for(let i=0;i<1800;i++)g.update(1/60);
    assert.equal(seen.length,0);assert.equal(g.pendingSpawns.length,batchSize);
    open=true;g.update(1/60);assert.equal(seen.length,batchSize);
    for(let i=0;i<delay*60-2;i++)g.update(1/60);assert.equal(seen.length,batchSize);
    g.phase='ready';g.update(10);assert.equal(seen.length,batchSize);g.phase='playing';
    for(let i=0;i<4;i++)g.update(1/60);assert.equal(seen.length,batchSize+1);
    assert.ok(Math.abs(seen[batchSize]-seen[batchSize-1]-delay)<.02);
  }
});

test('captain has 500 HP and goblin combat values with its own animation and encounter identity',()=>{
  const TD=require('../dist/engine.js'),C=require('../dist/goblin-captain.js'),S=require('../dist/enemy-sprites.js');
  assert.deepEqual({...TD.ENEMIES[7],name:TD.ENEMIES[1].name,hp:TD.ENEMIES[1].hp},TD.ENEMIES[1]);
  assert.equal(TD.enemyRadius(7,2),TD.enemyRadius(1,2));assert.deepEqual(S.specs[7].animations,C.captain.animations);
  const g=new LevelFiveGame();g.start();g.wave=5;g.launchWave();g.spawnQueue=[{level:7,routeIndex:0}];g.update(.01);
  assert.equal(g.enemies[0].hp,500);assert.equal(g.enemies[0].maxHp,500);assert.equal(g.enemies[0].spawnedAt,g.time);
  const before=JSON.stringify(g.enemies);C.recipients(g.enemies[0],g.enemies,320);C.cycle(15);
  assert.equal(JSON.stringify(g.enemies),before);
});

test('bomb tower builds, fires, upgrades, repairs, refunds, and allows an arrow replacement',()=>{
  const g=new LevelFiveGame();g.start();g.money=1000;
  const menu=require('../dist/tower-menu.js');
  assert.equal(menu.state(g,0,{kind:'bomb'}).build.amount,80);
  assert.equal(g.build(0,'bomb').ok,true);g.update(5);
  const s=g.slots[0];assert.equal(s.kind,'bomb');assert.equal(menu.state(g,0).build.label,'建造炸彈塔');
  const e={id:999,level:1,hp:50,maxHp:50,x:s.x+140,y:s.y,remaining:100};g.enemies.push(e);
  g.time+=.01;g.fireTowers(.01);g.time+=.3;g.fireTowers(.3);
  assert.equal(g.bombs.length,1);assert.equal(g.bullets.length,0);assert.equal(g.hasFriendlyProjectiles(),true);
  g.time+=.65;g.fireTowers(.65);assert.equal(e.hp,25);g.enemies=[];
  g.build(0);g.updateTowerActions(5);assert.equal(s.maxHp,150);g.build(0);g.updateTowerActions(5);assert.equal(s.maxHp,200);
  s.hp=10;g.repair(0);g.updateTowerActions(3);assert.equal(s.hp,200);
  const money=g.money;g.demolish(0);g.updateTowerActions(3);assert.equal(g.money,money+150);assert.equal(s.kind,'arrow');
  assert.equal(g.build(0,'arrow').ok,true);assert.equal(s.kind,'arrow');assert.equal(g.towerSpecs(s)[1].cost,60);
  g.money=0;const before=g.slots[1].kind;assert.equal(g.build(1,'bomb').ok,false);assert.equal(g.slots[1].kind,before);
});

test('96px lanes clear all ten pads and support fences along the complete route',()=>{
  const g=new LevelFiveGame();g.start();g.wallsUnlocked=true;
  assert.equal(g.worldScale,2);assert.equal(g.level.mapConfig.roadWidth,96);
  assert.equal(g.slots.length,10);assert.equal(g.level.routes.length,1);
  const cells=Road.cells(g.level);
  for(let i=0;i<cells.length;i++){
    const cell=cells[i],p=Road.at(g,cell.x,cell.y);
    assert.ok(p,`missing placement at ${cell.x},${cell.y}`);
    if(!p.blocked){assert.equal(g.canPlaceWall(p.x,p.y,p.orientation).ok,true);assert.equal(Math.max(p.width,p.height),96);}
    for(const other of cells.slice(i+1))assert.equal(overlap(cell.frame,other.frame),false);
  }
  for(const pad of g.slots)for(const road of E.roadRects(g.level))assert.equal(overlap({x:pad.x-36,y:pad.y-30,w:72,h:60},road),false);
  for(const point of [[144,400],[448,400]]){
    const p=Road.at(g,...point);assert.equal(g.placeWall(p.x,p.y,p.orientation).ok,true);
  }
  assert.deepEqual(g.walls.map(w=>w.orientation),['vertical','horizontal']);
});

test('cave scenery favors rocks and fallen logs and keeps roads and tower areas clear',()=>{
  const s=scenario(),images=Object.fromEntries(Object.entries(specs).map(([k,v])=>[k,{naturalWidth:v.width,naturalHeight:v.height}]));
  images.enemyEntranceFlag={naturalWidth:48,naturalHeight:80};
  const items=E.placements(s,images,2),trees=new Set(E.names.slice(0,11));
  const rocks=new Set(['boulders','standingRock','rockCluster','mossRock','rock','pebble','lowRock']);
  assert.ok(items.filter(p=>trees.has(p.name)).length<=4);
  assert.ok(items.filter(p=>p.name==='log'||p.name==='fallenLog').length>=14);
  assert.ok(items.filter(p=>rocks.has(p.name)).length>=60);
  assert.equal(E.landmarks(s)[0].name,'skullCave');
  for(const item of items){
    for(const road of E.roadRects(s,4))assert.equal(overlap(item,road),false);
    for(const pad of s.slots)assert.equal(overlap(item,{x:pad.x-48,y:pad.y-112,w:96,h:156}),false);
    for(const cave of E.landmarks(s))assert.equal(overlap(item,cave),false);
  }
});
