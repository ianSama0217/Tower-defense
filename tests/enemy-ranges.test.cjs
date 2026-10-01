const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game,ENEMIES,enemyRanges}=require('../dist/engine.js');

test('debug radii match enemy configuration and world scale',()=>{
  for(const scale of [1,2]){
    for(const type of [1,2,3])assert.deepEqual(enemyRanges(type,scale),{detection:ENEMIES[type].detectionRange*scale,attack:ENEMIES[type].attackRange*scale,trigger:0,blast:0});
    assert.deepEqual(enemyRanges(4,scale),{detection:Infinity,attack:0,trigger:22*scale,blast:64*scale});
    assert.deepEqual(enemyRanges(5,scale),{detection:0,attack:0,trigger:0,blast:0});
  }
});
test('attack and explosion boundaries use the same radii as the overlay',()=>{
  for(const scale of [1,2]){
    const g=new Game();g.start();g.worldScale=scale;
    const radius=enemyRanges(1,scale).attack;
    const inside={id:0,x:radius,y:0,level:1,hp:100},outside={id:1,x:radius+.01,y:0,level:1,hp:100};
    g.slots=[outside,inside];g.enemies=[{id:1,level:1,x:0,y:0,hp:44}];g.attackTowers(.01);
    assert.equal(inside.hp,94);assert.equal(outside.hp,100);
    const blast=enemyRanges(4,scale).blast;
    inside.x=blast;outside.x=blast+.01;inside.hp=100;
    g.killEnemy({id:2,level:4,x:0,y:0,hp:60});
    assert.equal(inside.hp,40);assert.equal(outside.hp,100);
  }
});
