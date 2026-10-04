const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game,createScenario,ENEMIES,TOWERS}=require('../dist/engine.js');
const {state}=require('../dist/tower-menu.js');
function setup(){const g=new Game(()=>0,createScenario({paths:[[[0,100],[1000,100]]],slots:[[100,80],[160,80]],worldScale:2,initialMoney:1000}));g.start();g.build(0);g.build(1);g.updateTowerActions(5);return g;}
function enemy(g,level=5,x=100){const e={id:g.nextId++,level,hp:ENEMIES[level].hp,maxHp:ENEMIES[level].hp,x,y:100,distance:x,remaining:1000-x,routeIndex:0};g.enemies.push(e);return e;}
test('only the final blow increments the firing tower, once per enemy',()=>{
 const g=setup(),e=enemy(g),a=g.slots[0],b=g.slots[1];g.damageEnemy(e,10,a.towerId);g.damageEnemy(e,100,b.towerId);g.damageEnemy(e,100,b.towerId);g.killEnemy(e,true,b.towerId);
 assert.equal(a.kills,0);assert.equal(b.kills,1);assert.equal(g.kills,1);
});
test('real projectiles carry tower identity through damage resolution',()=>{
 const g=setup();g.slots[1].cooldown=999;enemy(g);for(let i=0;i<180&&g.kills===0;i++)g.update(1/60);
 assert.equal(g.slots[0].kills,1);assert.equal(g.slots[1].kills,0);
});
test('upgrade preserves kills while demolition, destruction and restart cannot credit replacement towers',()=>{
 const g=setup(),s=g.slots[0];g.damageEnemy(enemy(g),100,s.towerId);g.build(0);g.updateTowerActions(5);assert.equal(s.kills,1);assert.equal(s.level,2);
 const originalId=s.towerId;g.demolish(0);g.updateTowerActions(3);g.build(0);assert.notEqual(s.towerId,originalId);assert.equal(s.kills,0);g.damageEnemy(enemy(g),100,originalId);assert.equal(s.kills,0);
 const rebuiltId=s.towerId;g.damageTower(s,100);g.build(0);g.damageEnemy(enemy(g),100,rebuiltId);assert.equal(s.kills,0);g.start();assert.ok(g.slots.every(t=>t.kills===0));
});
test('chain kills credit the triggering tower; enemy self-destruction grants no tower kills',()=>{
 const g=setup(),s=g.slots[0];const bomb=enemy(g,4,110);enemy(g,5,115);g.damageEnemy(bomb,100,s.towerId);assert.equal(s.kills,2);
 const self=enemy(g,4,500);enemy(g,5,510);g.killEnemy(self,false);assert.equal(s.kills,2);
});
test('tower statistics follow live level, configured interval, unscaled range and kill count',()=>{
 const g=setup(),s=g.slots[0];let stats=state(g,0).stats;assert.equal(stats.damage,TOWERS[1].damage);assert.equal(stats.range,TOWERS[1].range);assert.equal(stats.interval,TOWERS[1].interval);assert.deepEqual(stats.targets,['ground','air']);
 s.kills=7;g.build(0);g.updateTowerActions(5);stats=state(g,0).stats;assert.equal(stats.damage,TOWERS[2].damage);assert.equal(stats.range,TOWERS[2].range);assert.equal(stats.interval,TOWERS[2].interval);assert.equal(stats.kills,7);
 g.demolish(0);g.updateTowerActions(3);assert.equal(state(g,0).stats,null);
});
