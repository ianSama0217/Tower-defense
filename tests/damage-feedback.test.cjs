const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,createScenario}=require('../dist/engine.js');
test('damage feedback uses actual health lost, expires, and ignores already dead targets',()=>{
 const game=new Game(Math.random,createScenario({paths:[[[0,0],[1000,0]]],slots:[[80,0]],initialMoney:1000}));
 game.start();game.build(0);game.updateTowerActions(5);
 game.damageTower(game.slots[0],120);
 const enemy={id:1,level:5,hp:12,maxHp:32,x:40,y:10};
 game.damageEnemy(enemy,27);game.damageEnemy(enemy,27);
 assert.deepEqual(game.effects.filter(e=>e.kind==='damage').map(e=>e.amount),[100,12]);
 game.update(.8);
 assert.equal(game.effects.some(e=>e.kind==='damage'),false);
});
