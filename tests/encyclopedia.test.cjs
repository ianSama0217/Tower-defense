const {test}=require('node:test'),assert=require('node:assert/strict');
const {catalog,towerLevel}=require('../dist/encyclopedia-data.js'),progress=require('../dist/level-progress.js'),TD=require('../dist/engine.js');
const storage=values=>({getItem:key=>values[key]??null,setItem:(key,value)=>values[key]=value,removeItem:key=>delete values[key]});
test('campaign roster excludes sandbox units even when recorded as encountered',()=>{
 const data=catalog(storage({'td-encountered-enemies':'[1,2,3,4,5,6,7,8]'}));
 assert.deepEqual(data.enemies.map(e=>Number(e.id.split('-')[1])).sort(),[1,2,4,5,6,7]);
 assert.ok(data.enemies.every(e=>e.known));assert.deepEqual(data.defenses.map(e=>e.id),['fence']);
});
test('discovery follows actual encounter records, persists, and resets',()=>{
 const store=storage({});assert.ok(catalog(store).enemies.every(e=>!e.known));
 progress.createEncounterTracker(store).encounter(6);
 assert.deepEqual(catalog(store).enemies.filter(e=>e.known).map(e=>e.id),['enemy-6']);
 progress.reset(store);assert.ok(catalog(store).enemies.every(e=>!e.known));
});
test('legacy saves and building unlocks retain progression rules',()=>{
 const legacy=catalog(storage({'td-tutorial-complete':'true'}));
 assert.deepEqual(legacy.enemies.filter(e=>e.known).map(e=>e.id),['enemy-5','enemy-1']);
 assert.ok(!legacy.towers[1].known&&!legacy.defenses[0].known);
 const unlocked=catalog(storage({'td-level-stars':'[3,1,2,1,0]'}));
 assert.ok(unlocked.towers.every(e=>e.known)&&unlocked.defenses[0].known);
 assert.ok(!unlocked.enemies.find(e=>e.id==='enemy-7').known);
});
test('blocked or malformed storage keeps unknown entries and live combat stats',()=>{
 for(const store of [null,storage({'td-encountered-enemies':'invalid'}),{getItem(){throw Error('blocked');}}]){
  const data=catalog(store);assert.ok(data.enemies.every(e=>!e.known));
  for(let level=1;level<=3;level++)assert.equal(towerLevel(data.towers[0],level).stats.find(s=>s[0]==='攻擊力')[1],TD.TOWERS[level].damage);
 }
});
