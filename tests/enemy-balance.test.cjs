const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game,createScenario,ENEMIES}=require('../dist/engine.js');
function setup(type,scale=1,GameType=Game){
  const game=new GameType(()=>0,createScenario({paths:[[[0,100],[2000,100]]],worldScale:scale}));
  game.start();game.spawnQueue=[type];game.update(.1);
  return {game,enemy:game.enemies[0]};
}

test('balanced units spawn with the requested health, move at scaled speed and pay one kill reward',()=>{
  for(const scale of [1,2])for(const [type,hp,speed,reward] of [[1,50,50,10],[6,36,50,10],[2,80,60,20]]){
    const {game,enemy}=setup(type,scale),money=game.money;
    assert.equal(enemy.hp,hp);assert.equal(enemy.maxHp,hp);
    assert.equal(enemy.x,speed*scale*.1);
    game.damageEnemy(enemy,enemy.hp);
    if(type===2){assert.equal(enemy.hp,80);assert.equal(enemy.chargeHp,0);assert.equal(game.money,money);game.damageEnemy(enemy,enemy.hp);}
    assert.equal(enemy.hp,0);assert.equal(game.money,money+reward);assert.equal(game.kills,1);
    game.damageEnemy(enemy,999);
    assert.equal(game.money,money+reward);assert.equal(game.corpses.length,1);
  }
});

test('balanced ordinary attacks apply the requested damage at contact or arrow impact',()=>{
  for(const [type,damage] of [[1,12],[6,15],[2,20]]){
    const {game,enemy}=setup(type);
    if(type===2)game.endCharge(enemy);
    const tower={id:0,towerId:1,level:1,hp:100,maxHp:100,x:enemy.x+20,y:100,cooldown:Infinity};
    game.slots.push(tower);game.attackTowers(.01);
    if(type===6){
      assert.equal(tower.hp,100);game.time+=ENEMIES[type].attackWindup;
      game.attackTowers(ENEMIES[type].attackWindup);assert.equal(tower.hp,100);
      game.updateEnemyArrows(1);
    }
    assert.equal(tower.hp,100-damage);
  }
});

test('charge shield absorbs damage once, disappears at impact and cannot return at the next tower',()=>{
  for(const damage of [0,20,39]){
    const {game,enemy}=setup(2);
    if(damage)game.damageEnemy(enemy,damage);
    assert.equal(enemy.hp,80);assert.equal(enemy.maxHp,80);assert.equal(enemy.chargeHp,40-damage);
    game.moveEnemy(enemy,.1);assert.equal(enemy.chargeHp,40-damage);
    const tower={id:0,towerId:1,level:1,hp:100,x:enemy.x+20,y:100};game.slots.push(tower);
    game.attackTowers(.01);
    assert.equal(tower.hp,50);assert.equal(enemy.hp,80);assert.equal(enemy.chargeHp,0);
    assert.equal(enemy.maxHp,80);assert.equal(enemy.charging,false);
    const hp=enemy.hp;game.damageTower(tower,999);const x=enemy.x;
    game.moveEnemy(enemy,.1);assert.ok(Math.abs(enemy.x-x-4)<1e-7);assert.equal(enemy.hp,hp);
    const next={id:1,towerId:2,level:1,hp:100,x:enemy.x+20,y:100};game.slots.push(next);
    game.attackTowers(1);assert.equal(next.hp,80);assert.equal(enemy.hp,hp);
  }
});

test('40 accumulated damage cancels charge without spilling into base health; later hits damage the base',()=>{
  const {game,enemy}=setup(2);
  game.damageEnemy(enemy,20);assert.equal(enemy.hp,80);assert.equal(enemy.chargeHp,20);assert.equal(enemy.charging,true);
  game.damageEnemy(enemy,30);assert.equal(enemy.hp,80);assert.equal(enemy.chargeHp,0);assert.equal(enemy.maxHp,80);
  assert.equal(enemy.chargeConsumed,true);assert.equal(enemy.charging,false);
  assert.equal(enemy.chargeDamageTaken,40);
  game.damageEnemy(enemy,20);assert.equal(enemy.hp,60);assert.equal(enemy.maxHp,80);
  game.moveEnemy(enemy,.1);assert.equal(enemy.hp,60);
});

test('even a 200 or 999 damage hit only removes the gray shield and never grants a premature kill reward',()=>{
  for(const damage of [40,80,119,120,200,999]){
    const {game,enemy}=setup(2),money=game.money;
    game.damageEnemy(enemy,damage);
    assert.equal(enemy.hp,80);assert.equal(enemy.maxHp,80);assert.equal(enemy.chargeHp,0);assert.equal(enemy.charging,false);
    assert.equal(game.kills,0);assert.equal(game.money,money);assert.equal(game.corpses.length,0);
    assert.equal(game.effects.at(-1).amount,40);
    game.damageEnemy(enemy,80);assert.equal(game.kills,1);assert.equal(game.money,money+20);
  }
  const {game,enemy}=setup(2);
  const bomber={id:99,level:4,hp:60,maxHp:60,x:enemy.x,y:enemy.y};game.enemies.push(bomber);
  game.damageEnemy(bomber,60);
  assert.equal(enemy.hp,80);assert.equal(enemy.chargeHp,0);assert.equal(enemy.maxHp,80);assert.equal(enemy.charging,false);
  game.damageEnemy(enemy,80);assert.equal(game.kills,2);
});

test('the actual 200 damage arrow rain changes charge form once while leaving the orc alive',()=>{
  const {TimedWaveGame}=require('../dist/timed-waves.js');
  const {game,enemy}=setup(2,1,TimedWaveGame),money=game.money;
  game.damageEnemy(enemy,12);assert.equal(enemy.chargeHp,28);
  assert.equal(game.fireArrowRain(),true);
  assert.equal(enemy.hp,80);assert.equal(enemy.chargeHp,0);assert.equal(enemy.charging,false);
  assert.equal(game.enemies.length,1);assert.equal(game.money,money);assert.equal(game.kills,0);
  assert.equal(game.effects.at(-1).amount,28);assert.equal(game.fireArrowRain(),false);assert.equal(enemy.hp,80);
});

test('bomb tower explosions and bomber chain reactions use the same non-spilling shield rule',()=>{
  const {BombTowerGame}=require('../dist/bomb-towers.js');
  const {game,enemy}=setup(2,1,BombTowerGame);
  game.detonate({toX:enemy.x,toY:enemy.y,radius:64,damage:200});
  assert.equal(enemy.hp,80);assert.equal(enemy.chargeHp,0);assert.equal(game.kills,0);
  game.detonate({toX:enemy.x,toY:enemy.y,radius:64,damage:20});assert.equal(enemy.hp,60);
  const chain=setup(2),a={id:99,level:4,hp:40,x:chain.enemy.x,y:100},b={...a,id:100};
  chain.game.enemies.push(a,b);chain.game.damageEnemy(a,60);
  assert.equal(chain.enemy.hp,30);assert.equal(chain.enemy.chargeHp,0);
  assert.equal(chain.game.kills,2);assert.equal(chain.game.corpses.length,2);
});

test('gray health is visible immediately, shrinks independently and disappears after charge ends',()=>{
  const S=require('../dist/enemy-sprites.js'),{game,enemy}=setup(2),draws=[];
  const ctx={fillStyle:'',fillRect(x,y,width,height){draws.push({color:this.fillStyle,x,y,width,height});}};
  S.drawHealth(ctx,enemy,0,0);assert.equal(draws.length,2);
  assert.equal(draws[1].color,'#aeb4bd');assert.equal(draws[1].width,40);
  game.damageEnemy(enemy,20);draws.length=0;S.drawHealth(ctx,enemy,0,0);
  assert.equal(draws[1].color,'#aeb4bd');assert.equal(draws[1].width,20);assert.equal(enemy.hp,80);
  game.phase='ready';game.update(10);assert.equal(enemy.chargeHp,20);
  game.phase='playing';game.damageEnemy(enemy,20);draws.length=0;S.drawHealth(ctx,enemy,0,0);
  assert.equal(draws.length,0);assert.equal(S.healthBar(enemy).charge,false);
  game.damageEnemy(enemy,20);S.drawHealth(ctx,enemy,0,0);
  assert.equal(draws[1].color,'#badc7d');assert.equal(draws[1].width,30);
  game.damageEnemy(enemy,999);draws.length=0;S.drawHealth(ctx,enemy,0,0,40,true);assert.equal(draws.length,0);
  game.start();game.spawnQueue=[2];game.update(.1);
  assert.equal(game.enemies[0].chargeHp,40);assert.equal(game.enemies[0].hp,80);
});
