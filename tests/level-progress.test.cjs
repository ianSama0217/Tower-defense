const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../dist/level-progress.js');
function memory(initial={}){const data=new Map(Object.entries(initial));return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}
test('new players can inspect all stops but only the first is unlocked',()=>{
  const stars=P.read(memory());assert.deepEqual(stars,[0,0,0,0,0]);
  assert.deepEqual(P.stages.map((_,i)=>P.unlocked(stars,i)),[true,false,false,false,false]);
  assert.equal(P.unlocked(stars,-1),false);assert.equal(P.unlocked(stars,5),false);
});
test('one star unlocks exactly the next stop; failed or unfinished runs earn none',()=>{
  const save=memory();
  for(const phase of ['playing','lost'])assert.equal(P.starsForResult(phase,3),0);
  assert.equal(P.starsForResult('won',0),0);
  for(let i=0;i<4;i++){
    const result=P.record(save,i,1);assert.equal(result.saved,true);assert.equal(P.unlocked(P.read(save),i+1),true);
    if(i<3)assert.equal(P.unlocked(P.read(save),i+2),false);
  }
});
test('victory stars reflect remaining lives and retries retain the best result',()=>{
  const save=memory();
  for(const lives of [1,2,3])assert.equal(P.starsForResult('won',lives),lives);
  P.record(save,0,3);P.record(save,0,1);P.record(save,0,0);
  assert.equal(P.read(save)[0],3);assert.equal(P.record(save,2,3).saved,false);
});
test('legacy tutorial completion is migrated as one star without overwriting better scores',()=>{
  const save=memory({'td-tutorial-complete':'true'});assert.equal(P.read(save)[0],1);assert.equal(P.unlocked(P.read(save),1),true);
  P.record(save,0,2);assert.equal(P.read(save)[0],2);
});
test('malformed and unavailable storage safely preserve locked defaults',()=>{
  for(const value of ['bad','null','{}','[9,-1,"3",null,1.5]'])assert.deepEqual(P.read(memory({[P.KEY]:value})),[0,0,0,0,0]);
  assert.deepEqual(P.read(null),[0,0,0,0,0]);assert.equal(P.record(null,0,1).saved,false);
});
test('first-level enemy preview matches the actual tutorial waves',()=>{
  const {scenario}=require('../dist/tutorial-level.js');
  assert.deepEqual([...new Set(scenario().waves.flat())].sort(),[...P.stages[0].enemies].sort());
});

test('enemy encounters are unknown until spawned, persist without winning, and do not reveal later waves',()=>{
  const {TutorialGame}=require('../dist/tutorial-level.js'),save=memory(),tracker=P.createEncounterTracker(save),game=new TutorialGame(()=>.5);
  game.onEnemySpawn=id=>tracker.encounter(id);game.start();
  assert.deepEqual(P.readEncountered(save),[]);
  game.startNextWave();assert.deepEqual(P.readEncountered(save),[]);
  game.update(.01);assert.deepEqual(P.readEncountered(save),[5]);
  game.lives=0;game.update(.01);assert.deepEqual(P.readEncountered(save),[5]);
  game.start();assert.equal(P.createEncounterTracker(save).has(5),true);assert.equal(tracker.has(1),false);
  game.startNextWave();game.spawnQueue=[1];game.spawnTimer=0;game.update(.01);
  assert.deepEqual(P.readEncountered(save),[1,5]);
});
test('encounter tracking rejects invalid IDs, deduplicates writes, and tolerates blocked storage',()=>{
  const save=memory();let writes=0;const original=save.setItem;save.setItem=(...args)=>{writes++;original(...args);};
  const tracker=P.createEncounterTracker(save);
  for(const id of [0,7,-1,'1',null,NaN])assert.equal(tracker.encounter(id),false);
  tracker.encounter(5);tracker.encounter(5);assert.equal(writes,1);
  save.setItem(P.ENCOUNTER_KEY,'[2,5]');tracker.encounter(1);assert.deepEqual(P.readEncountered(save),[1,2,5]);
  const blocked=P.createEncounterTracker(null);assert.doesNotThrow(()=>blocked.encounter(1));assert.equal(blocked.has(1),true);
  for(const raw of ['bad','{}','null','[0,7,"1"]'])assert.deepEqual(P.readEncountered(memory({[P.ENCOUNTER_KEY]:raw})),[]);
});
test('goblin archer encounters can be saved without revealing them before they spawn',()=>{
  const save=memory(),tracker=P.createEncounterTracker(save);assert.equal(tracker.has(6),false);assert.equal(tracker.encounter(6),true);assert.deepEqual(P.readEncountered(save),[6]);
});
test('existing completed tutorial saves retain knowledge of both tutorial enemies',()=>{
  for(const save of [memory({'td-tutorial-complete':'true'}),memory({[P.KEY]:'[1,0,0,0,0]'})])assert.deepEqual(P.readEncountered(save),[1,5]);
});
