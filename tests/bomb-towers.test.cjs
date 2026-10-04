const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const TD=require('../dist/engine.js'),B=require('../dist/bomb-towers.js'),S=require('../dist/bomb-tower-sprites.js');
function setup(level=1,scale=1){const g=new B.BombTowerGame(()=>0,TD.createScenario({paths:[[[0,200],[2000,200]]],slots:[[400,200]],worldScale:scale}));g.start();const s=g.slots[0];Object.assign(s,{kind:'bomb',level,hp:100,maxHp:100,towerId:g.nextTowerId++,cooldown:0});return {g,s};}
function enemy(g,x,y=200,type=5,hp=100){const e={id:g.nextId++,x,y,level:type,hp,maxHp:hp,distance:x,routeIndex:0,remaining:2000-x};g.enemies.push(e);return e;}
function tickFire(g,dt){g.time+=dt;g.fireTowers(dt);}
test('all three levels use inclusive 55–125 range and exclude both near and far targets',()=>{
 for(const level of [1,2,3])for(const scale of [1,2]){const {g,s}=setup(level,scale);for(const [distance,valid] of [[54.9,false],[55,true],[125,true],[125.1,false]])assert.equal(B.canTarget(s,{x:400+distance*scale,y:200,hp:100},scale),valid);assert.equal(B.ranges(level,scale).blast,64*scale);}
});
test('bomb tower winds up, releases a bomb, then damages only at landing without firing arrows',()=>{
 const {g,s}=setup(),e=enemy(g,490);tickFire(g,.01);assert.ok(s.pendingBomb);assert.equal(g.bombs.length,0);assert.equal(g.bullets.length,0);
 tickFire(g,.29);assert.equal(g.bombs.length,0);tickFire(g,.01);assert.equal(g.bombs.length,1);assert.equal(e.hp,100);
 tickFire(g,.64);assert.equal(e.hp,100);tickFire(g,.01);assert.equal(e.hp,70);assert.equal(g.bombs.length,0);assert.equal(g.effects.filter(e=>e.kind==='tower-bomb-explosion').length,1);
});
test('dead or too-close targets cancel unreleased bombs',()=>{
 for(const cancel of ['dead','close','far']){const {g,s}=setup(),e=enemy(g,490);tickFire(g,.01);if(cancel==='dead')e.hp=0;else e.x=cancel==='close'?450:540;tickFire(g,.3);assert.equal(g.bombs.length,0);assert.equal(s.pendingBomb,null);}
});
test('landings remain at their released coordinates even when targets move or die',()=>{
 const {g}=setup(),e=enemy(g,490);tickFire(g,.01);tickFire(g,.3);assert.equal(g.bombs[0].toX,490);e.x=650;const other=enemy(g,500);tickFire(g,.65);assert.equal(e.hp,100);assert.equal(other.hp,70);
});
test('area damage includes self, friendly towers and wall edges and excludes objects outside radius',()=>{
 const {g,s}=setup(2),a=enemy(g,455),b=enemy(g,519),outside=enemy(g,519.1);
 const friend={id:1,level:1,x:500,y:200,hp:100,maxHp:100,cooldown:Infinity};g.slots.push(friend);
 const wall={id:-1,kind:'wall',level:1,x:530,y:200,width:24,height:64,hp:300,maxHp:300};g.walls.push(wall);
 g.detonate({toX:455,toY:200,radius:64,damage:45,sourceTowerId:s.towerId});
 assert.equal(s.hp,55);assert.equal(friend.hp,55);assert.equal(wall.hp,255);assert.equal(a.hp,55);assert.equal(b.hp,55);assert.equal(outside.hp,100);
});
test('blast radius scales with the world independently of sprite display scale',()=>{
 const {g,s}=setup(1,2);s.visualScale=4;enemy(g,520);tickFire(g,.01);tickFire(g,.3);assert.equal(g.bombs[0].radius,128);assert.equal(g.bombs[0].sourceScale,4);
});
test('destroyed tower cancels a pending throw but its already released bomb still lands',()=>{
 for(const released of [false,true]){const {g,s}=setup(),e=enemy(g,490);tickFire(g,.01);if(released)tickFire(g,.3);g.damageTower(s,100);tickFire(g,1);assert.equal(g.bombs.length,0);assert.equal(e.hp,released?70:100);}
});
test('friendly fire can kill the firing tower without cancelling its blast',()=>{
 const {g,s}=setup(3);s.hp=40;const e=enemy(g,455);g.detonate({toX:455,toY:200,radius:64,damage:60,sourceTowerId:s.towerId});assert.equal(s.hp,0);assert.equal(s.level,0);assert.equal(e.hp,40);
});
test('exploding goblins chain normally without duplicate rewards',()=>{
 const {g,s}=setup(3),a=enemy(g,490,200,4,60),b=enemy(g,520,200,4,60),money=g.money;
 g.detonate({toX:490,toY:200,radius:64,damage:60,sourceTowerId:s.towerId});assert.equal(a.hp,0);assert.equal(b.hp,0);assert.equal(g.kills,2);assert.equal(g.money,money+28);assert.equal(g.corpses.length,2);
});
test('pause freezes bomb travel, disabling fire cancels preparation, reset clears bombs',()=>{
 const {g,s}=setup();enemy(g,490);tickFire(g,.01);g.bombFireEnabled=false;tickFire(g,.3);assert.equal(s.pendingBomb,null);assert.equal(g.bombs.length,0);
 g.bombFireEnabled=true;s.cooldown=0;tickFire(g,.01);tickFire(g,.3);g.phase='ready';const time=g.time;g.update(10);assert.equal(g.time,time);assert.equal(g.bombs.length,1);g.start();assert.equal(g.bombs.length,0);
});
test('operator release frame aligns with the actual .3 second windup',()=>{const s={throwAt:2};assert.equal(S.operatorFrame(s,2),2);assert.equal(S.operatorFrame(s,2.15),3);assert.equal(S.operatorFrame(s,2.3),4);assert.ok(S.operatorFrame(s,3)<2);});
test('assets have fixed sprite dimensions and only the test page loads the bomb tower modules',()=>{
 const base=path.join(__dirname,'../dist');for(const [file,w,h] of [['tower_lv1.png',64,64],['tower_lv2.png',80,80],['tower_lv3.png',96,96],['operator.png',192,24],['bomb.png',80,16],['explosion.png',320,64]]){const data=fs.readFileSync(path.join(base,'assets/bomb-towers',file));assert.equal(data.readUInt32BE(16),w);assert.equal(data.readUInt32BE(20),h);}
 for(const file of ['tutorial.html','level-two.html'])assert.doesNotMatch(fs.readFileSync(path.join(base,file),'utf8'),/bomb-towers\.js|bomb-tower-sprites\.js/);
 assert.match(fs.readFileSync(path.join(base,'test/index.html'),'utf8'),/bomb-towers\.js/);
});
