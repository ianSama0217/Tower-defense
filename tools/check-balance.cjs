const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {LevelTwoGame}=require('../dist/level-two.js'),{LevelThreeGame}=require('../dist/level-three.js');
function simulate(GameClass,seed,priority){
 let state=seed;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 const g=new GameClass(random);g.start();g.wallsUnlocked=true;
 const shots={},fire=g.fireTowers.bind(g);
 g.fireTowers=dt=>{const before=g.bullets.length;fire(dt);for(const bullet of g.bullets.slice(before)){
  const slot=g.slots.find(s=>s.towerId===bullet.sourceTowerId);if(slot)shots[slot.id]=(shots[slot.id]||0)+1;
 }};
 g.build(priority[0]);if(priority[1]!=null)g.build(priority[1]);
 for(let i=0;i<301;i++)g.update(1/60);g.startNextWave();let prepared=0;
 for(let i=0;i<50000&&g.phase==='playing';i++){
  if(g.awaitingWave&&g.wave>0&&g.wave!==prepared){
   prepared=g.wave;
   // Establish overlapping coverage before concentrating funds in one high-level tower.
   const order=[...priority].sort((a,b)=>g.slots[a].level-g.slots[b].level);
   for(const id of order){const s=g.slots[id];if(s.level<3&&!s.action&&!g.build(id).ok)break;}
  }
  g.update(1/60);
 }
 return {phase:g.phase,wave:g.wave,lives:g.lives,kills:g.kills,money:g.money,shots};
}
const report=[];
for(const [name,C,orders] of [
 ['第二關',LevelTwoGame,[[3,7,2,6,1,5,0,4,8],[3,7,6,2,5,1,4,0,8],[8,3,7,2,6,1,5,0,4]]],
 ['第三關',LevelThreeGame,[[8,9,6,5,4,7,1,3,0,2],[1,3,5,6,8,9,4,7,0,2],[0,2,1,3,5,6,4,7,8,9]]]
])for(const priority of orders){
 const runs=Array.from({length:10},(_,i)=>({seed:i+1,...simulate(C,i+1,priority)}));
 report.push({stage:name,priority,wins:runs.filter(r=>r.phase==='won').length,threeStars:runs.filter(r=>r.phase==='won'&&r.lives===3).length,runs});
}
for(const stage of ['第二關','第三關'])assert.ok(report.some(r=>r.stage===stage&&r.wins===10),`${stage} has no reliable winning layout`);
const guards=report[0];assert.equal(guards.wins,10,'second-stage junction guards plus support must remain viable');
assert.equal(report[1].wins,10,'second-stage support order must allow both upper and lower priority');
assert.equal(report[3].wins,10,'third-stage entrance guards must remain viable');
assert.ok(guards.runs.every(r=>(r.shots[2]||0)>0&&(r.shots[6]||0)>0),'both support pads must contribute actual shots');
const target=path.join(__dirname,'../art/balance');fs.mkdirSync(target,{recursive:true});
fs.writeFileSync(path.join(target,'simulations.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.map(({stage,priority,wins,threeStars})=>({stage,firstPads:priority.slice(0,2),wins,threeStars})),null,2));
