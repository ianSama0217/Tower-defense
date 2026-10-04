const {test}=require('node:test'),assert=require('node:assert/strict');
const {summarize}=require('../dist/result-panel.js');
const {TutorialGame}=require('../dist/tutorial-level.js');
const store=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
test('result stars use remaining lives and preserve the best record across loss and weaker wins',()=>{
 const s=store(),g={phase:'won',lives:3,wave:4,waves:[1,2,3,4],kills:26,towersBuilt:3};
 assert.deepEqual(summarize(g,s),{won:true,stars:3,best:3,saved:true,waves:4,kills:26,lives:3,towers:3,nextHref:'level-two.html',wallReward:null});
 assert.equal(summarize({...g,lives:1},s).best,3);
 const lost=summarize({...g,phase:'lost',wave:3,lives:0,kills:18},s);
 assert.equal(lost.waves,2);assert.equal(lost.stars,0);assert.equal(lost.best,3);assert.equal(lost.nextHref,null);
 assert.equal(summarize({...g,phase:'lost',wave:1,lives:0},s).waves,0);
});
test('save failures preserve the earned result for display',()=>{const r=summarize({phase:'won',lives:2,wave:4,waves:[1,2,3,4],kills:24,towersBuilt:2},null);assert.equal(r.saved,false);assert.equal(r.stars,2);assert.equal(r.best,2);});
test('second-level victory unlocks walls from stars, persists on reload and repeats without a second reward',()=>{
 const P=require('../dist/level-progress.js'),s=store();s.setItem(P.KEY,'[3,0,0,0,0]');
 const g={level:{stageIndex:1},phase:'lost',lives:0,wave:6,waves:[1,2,3,4,5,6],kills:80};
 assert.equal(summarize(g,s).wallReward,null);assert.equal(P.wallsUnlocked(P.read(s)),false);
 g.phase='won';g.lives=1;assert.equal(summarize(g,s).wallReward,'unlocked');assert.equal(P.wallsUnlocked(P.read(s)),true);
 assert.equal(summarize(g,s).wallReward,'owned');g.phase='lost';assert.equal(summarize(g,s).wallReward,null);assert.equal(P.wallsUnlocked(P.read(s)),true);
 assert.equal(P.wallsUnlocked([3,3,0,0,0]),true);assert.equal(P.wallsUnlocked([3,0,0,0,0]),false);assert.equal(P.wallsUnlocked(null),false);
});
test('tower count records completed new buildings only, survives destruction, and resets',()=>{
 const g=new TutorialGame(()=>0);g.start();g.build(0);assert.equal(g.towersBuilt,0);g.update(5);assert.equal(g.towersBuilt,1);
 g.money=1000;g.wave=2;g.awaitingWave=true;g.build(0);g.update(5);assert.equal(g.towersBuilt,1);
 g.damageTower(g.slots[0],100);assert.equal(g.towersBuilt,1);g.upgradeLearned=true;g.build(1);g.damageTower(g.slots[1],100);g.update(5);assert.equal(g.towersBuilt,1);
 g.start();assert.equal(g.towersBuilt,0);
});
