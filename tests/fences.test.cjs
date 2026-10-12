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
test('right-edge artwork and health bar share a visual anchor without moving the collision geometry',()=>{
 const sprites=require('../dist/fence-sprites.js'),frame={x:960,y:352,w:96,h:96};
 for(const orientation of ['horizontal','vertical']){
  const fence={x:1008,y:400,hp:150,maxHp:150,orientation,...TD.wallSize(orientation,2,96)},before={...fence};
  const visual=sprites.atCellRight(fence,frame),translations=[],bars=[];
  const ctx={save(){},restore(){},rotate(){},translate(x,y){translations.push({x,y});},drawImage(){},fillRect(x,y,w,h){bars.push({x,y,w,h});}};
  sprites.draw(ctx,{100:{}},visual);sprites.drawHealth(ctx,visual);
  assert.deepEqual(translations,[{x:1032,y:400}]);assert.deepEqual(fence,before);
  assert.equal(visual.x,fence.x);assert.equal(visual.y,fence.y);assert.equal(visual.width,fence.width);assert.equal(visual.height,fence.height);
  assert.equal(bars[0].x+bars[0].w/2,1032);assert.equal(bars[0].y,sprites.bounds(visual).y-10);
  if(orientation==='vertical')assert.equal(sprites.bounds(visual).x+sprites.bounds(visual).w,frame.x+frame.w);
 }
});
test('destroyed fence fades with the game clock and stops rendering at three seconds',()=>{
 const sprites=require('../dist/fence-sprites.js'),drawn=[];
 const ctx={save(){},restore(){},translate(){},rotate(){},drawImage(){drawn.push(this.globalAlpha);}};
 const fence={...F.unit({asset,x:240,y:384}),hp:0,destroyedAt:0};
 sprites.draw(ctx,{0:{}},fence,1,0);sprites.draw(ctx,{0:{}},fence,1,1.5);
 sprites.draw(ctx,{0:{}},fence,1,2.99);sprites.draw(ctx,{0:{}},fence,1,3);sprites.draw(ctx,{0:{}},fence,1,30);
 assert.equal(drawn.length,3);assert.equal(drawn[0],1);assert.equal(drawn[1],.5);assert.ok(drawn[2]>0&&drawn[2]<.01);
 // A static damage-stage preview has no destruction timestamp and remains visible.
 sprites.draw(ctx,{0:{}},{...fence,destroyedAt:null},1,30);assert.equal(drawn.at(-1),1);
});
test('rubble immediately stops blocking and its fade neither refunds stock nor hides a replacement',()=>{
 const {LevelThreeGame}=require('../dist/level-three.js'),sprites=require('../dist/fence-sprites.js');
 const game=new LevelThreeGame(()=>0);game.start();game.wallsUnlocked=true;game.money=1000;
 const fence=game.placeWall(1008,400,'vertical').wall;game.damageTower(fence,150);
 assert.equal(game.wallTarget({level:1,x:1008,y:400}),null);
 assert.equal(game.enemyStepFraction({level:1,x:960,y:400},100,0),1);
 const fresh=game.placeWall(1008,400,'vertical').wall;assert.ok(fresh.hp>0);assert.equal(game.wallsRemaining,1);
 game.update(1.5);assert.equal(sprites.opacity(fence,game.time),.5);
 game.update(1.5);assert.equal(sprites.opacity(fence,game.time),0);assert.equal(sprites.opacity(fresh,game.time),1);
 assert.equal(game.wallsRemaining,1);assert.equal(fresh.hp,150);
});
