const {test}=require('node:test'),assert=require('node:assert/strict');
const TD=require('../dist/engine.js'),F=require('../dist/test/fences.js'),T=require('../dist/tower-sprites.js'),{BombTowerGame}=require('../dist/bomb-towers.js');
test('sandbox and all campaign stages share combat scale and later-stage road dimensions',()=>{
 const levels=[require('../dist/tutorial-level.js').scenario(),require('../dist/level-two.js').scenario(),require('../dist/level-three.js').scenario()];
 for(const level of levels)assert.equal(F.scenario.worldScale,level.worldScale);
 assert.deepEqual(F.scenario.mapConfig,levels[2].mapConfig);
 const sim=new BombTowerGame(Math.random,F.createScenario());sim.start();
 assert.equal(sim.worldScale,2);assert.equal(TD.enemyRanges(1,sim.worldScale).attack,64);
 const second=F.createScenario();sim.level.routes.push({});assert.equal(second.routes.length,2);assert.equal(F.scenario.routes.length,2);
});
test('sandbox tower geometry matches the campaign pad-relative placement at all levels',()=>{
 for(const level of [1,2,3]){const scale=TD.CAMPAIGN_WORLD_SCALE,p=T.placement(level,TD.MAP_CONFIG.towerSlotSize,scale),r=T.worldRect(level,500,400,TD.MAP_CONFIG.towerSlotSize,scale);
 assert.deepEqual(r,{x:500-p.anchorX*scale,y:400+p.groundOffset-p.anchorY*scale,w:p.width*scale,h:p.height*scale});}
 assert.equal(T.worldRect(1,500,400,64,2).w,83.2);
});
