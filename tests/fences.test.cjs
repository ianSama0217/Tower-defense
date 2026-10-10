const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../dist/test/fences.js'),TD=require('../dist/engine.js');
const asset={category:'fence',orientation:'vertical'};
test('fence artwork extends equally beyond the road while collision stays at 96px',()=>{
 const sprites=require('../dist/fence-sprites.js');
 for(const orientation of ['horizontal','vertical'])for(const hp of [150,120,75,37.5,0]){
  const w={x:300,y:384,orientation,hp,maxHp:150,...TD.wallSize(orientation,2,96)};
  const visual=sprites.bounds(w);
  assert.equal(orientation==='horizontal'?visual.w:visual.h,168);
  assert.equal(orientation==='horizontal'?w.width:w.height,96);
  assert.equal(orientation==='horizontal'?visual.x:visual.y,(orientation==='horizontal'?w.x:w.y)-84);
 }
});
test('fences snap to roads at a fixed 96px span in both orientations',()=>{
 assert.deepEqual(F.placement(245,390,'vertical').placement,{x:240,y:384,orientation:'vertical',width:32,height:96});
 assert.deepEqual(F.placement(900,210,'horizontal').placement,{x:896,y:208,orientation:'horizontal',width:96,height:32});
 for(const p of [[400,250],[0,384],[896,60]])assert.equal(F.placement(...p,'vertical').ok,false);
});
test('fences reject overlaps, allow moving self, and permit replacing rubble',()=>{
 const fence={id:1,asset,x:240,y:384,condition:100};
 assert.equal(F.placement(240,384,'vertical',[fence]).ok,false);
 assert.equal(F.placement(240,384,'vertical',[fence],1).ok,true);
 assert.equal(F.placement(240,384,'vertical',[{...fence,condition:0}]).ok,true);
 for(const category of ['tower','bomb-tower','enemy'])assert.equal(F.placement(240,384,'vertical',[{...fence,asset:{category}}]).ok,false);
});
test('five damage stages and inherited wall combat support destruction',()=>{
 assert.deepEqual([150,120,75,37.5,0].map(hp=>F.stage(hp)),F.stages);
 const game=new TD.Game(Math.random,F.scenario);game.start();
 const fence={...F.unit({asset,x:240,y:384}),kind:'wall',id:-1,level:1};game.walls=[fence];
 assert.equal(game.wallTarget({level:5,x:200,y:384}),fence);
 game.damageTower(fence,120);assert.equal(F.stage(fence.hp),25);
 game.damageTower(fence,30);assert.equal(fence.level,0);assert.equal(game.wallTarget({level:5,x:200,y:384}),null);
});
