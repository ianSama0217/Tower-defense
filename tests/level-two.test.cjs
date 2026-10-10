const {test}=require('node:test'),assert=require('node:assert/strict');
const {LevelTwoGame,scenario}=require('../dist/level-two.js');
const TD=require('../dist/engine.js'),P=require('../dist/level-progress.js');
const {state}=require('../dist/tower-menu.js'),{summarize}=require('../dist/result-panel.js');
const E=require('../dist/environment.js'),specs=require('../dist/assets/environment/sprites.json');
const expected=[[[4,0],[4,0]],[[6,0],[0,3]],[[6,3],[4,3]],[[10,0],[0,8]],[[0,8],[10,0]],[[14,6],[6,8]]];
function advance(g,seconds){for(let left=seconds;left>1e-9;){const dt=Math.min(1/60,left);g.update(dt);left-=dt;}}
test('all six waves spawn the specified types on the correct simultaneous lanes',()=>{
  const g=new LevelTwoGame(()=>.99),seen=[];g.start();g.onEnemySpawn=()=>{const e=g.enemies.at(-1);seen.push({wave:g.wave,type:e.level,route:e.routeIndex,time:g.time,y:e.y});g.damageEnemy(e,999);};
  g.startNextWave();
  for(let i=0;i<20000&&g.phase==='playing';i++)g.update(1/60);
  assert.equal(g.phase,'won');assert.equal(g.wave,6);assert.equal(g.kills,103);
  for(let wave=1;wave<=6;wave++){
    const events=seen.filter(e=>e.wave===wave);
    for(let route=0;route<2;route++){
      const lane=events.filter(e=>e.route===route),[goblins,archers]=expected[wave-1][route];
      assert.deepEqual(lane.map(e=>e.type),[...Array(goblins).fill(1),...Array(archers).fill(6)]);
      assert.ok(lane.every(e=>e.y===(route===0?184:584)));
      assert.equal(lane[0].time,events[0].time);
      for(let i=1;i<lane.length;i++)assert.ok(Math.abs(lane[i].time-lane[i-1].time-1.35)<.02);
    }
  }
  const earned=103;assert.equal(g.kills,earned);g.update(60);assert.equal(g.kills,earned);
  g.start();assert.equal(g.money,120);assert.equal(g.lives,3);assert.equal(g.wave,0);assert.equal(g.spawnQueue.length,0);assert.equal(g.enemyArrows.length,0);assert.equal(g.intermissionRemaining,null);
});
test('both paths turn into the same left exit, with nine buildable pads',()=>{
  const s=scenario();assert.equal(s.slots.length,9);
  for(const r of s.routes){assert.deepEqual(r.path.slice(-2),[{x:890,y:392},{x:0,y:392}]);assert.deepEqual(TD.position(r.length-200,r),{x:200,y:392});}
  assert.deepEqual(P.stages[1].enemies,[1,6]);assert.equal(P.stages[1].href,'level-two.html');
});
test('second level has immediate engineering access, uses game-time intermissions and can lose',()=>{
  const g=new LevelTwoGame();g.start();g.money=1000;g.build(0);advance(g,5);
  assert.equal(state(g,0).upgrade.disabled,false);assert.equal(state(g,0).demolish.disabled,false);
  assert.equal(g.build(0).ok,true);advance(g,5);assert.equal(g.slots[0].level,2);
  assert.equal(g.demolish(0).ok,true);advance(g,3);assert.equal(g.slots[0].level,0);
  g.start();advance(g,60);assert.equal(g.wave,0);g.startNextWave();assert.equal(g.startNextWave(),false);
  for(let i=0;i<8000&&g.phase==='playing';i++)g.update(1/60);
  assert.equal(g.phase,'lost');assert.equal(g.lives,0);assert.equal(g.startNextWave(),false);
});
test('second-level win records only second-level stars and unlocks the third stop',()=>{
  const values=new Map([[P.KEY,'[3,0,0,0,0]']]),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const g=new LevelTwoGame();g.phase='won';g.lives=2;g.wave=6;g.kills=103;
  const result=summarize(g,storage);assert.equal(result.waves,6);assert.equal(result.best,2);assert.equal(result.nextHref,'level-three.html');
  assert.deepEqual(P.read(storage),[3,2,0,0,0]);assert.equal(P.unlocked(P.read(storage),2),true);
  g.phase='lost';g.lives=0;assert.equal(summarize(g,storage).stars,0);assert.deepEqual(P.read(storage),[3,2,0,0,0]);
});
test('deep forest increases vegetation while leaving both roads and tower silhouettes clear',()=>{
  const s=scenario(),images=Object.fromEntries(Object.entries(specs).map(([name,s])=>[name,{naturalWidth:s.width,naturalHeight:s.height}]));
  const items=E.placements(s,images,2),overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  assert.ok(items.filter(p=>E.names.indexOf(p.name)<7).length>=60);
  assert.ok(items.length>=300);
  for(const item of items){
    for(const road of E.roadRects(s,4))assert.equal(overlap(item,road),false);
    for(const pad of s.slots)assert.equal(overlap(item,{x:pad.x-48,y:pad.y-112,w:96,h:156}),false);
  }
});
