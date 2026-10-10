const test=require('node:test'),assert=require('node:assert/strict');
const {Game,createScenario,ENEMIES,enemyRadius,position,targetDistance}=require('../dist/engine.js');
const {scenario:secondLevel}=require('../dist/level-two.js');
function setup(scale=1,paths=[[[0,200],[2000,200]]]){
  const g=new Game(()=>0,createScenario({paths,worldScale:scale}));g.start();g.lives=100;return g;
}
function add(g,level,distance,routeIndex=0){
  const e={id:g.nextId++,level,routeIndex,distance,hp:ENEMIES[level].hp,maxHp:ENEMIES[level].hp,...position(distance,g.level.routes[routeIndex])};
  g.enemies.push(e);return e;
}
function separated(g){
  const alive=g.enemies.filter(e=>e.hp>0&&!e.escaped);
  for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){
    const a=alive[i],b=alive[j],distance=Math.hypot(a.x-b.x,a.y-b.y),minimum=enemyRadius(a.level,g.worldScale)+enemyRadius(b.level,g.worldScale);
    assert.ok(distance>=minimum-1e-6,`bodies ${a.id}/${b.id} overlap: ${distance} < ${minimum}`);
  }
}
function advance(g,seconds){for(let i=0;i<seconds*60;i++){g.update(1/60);separated(g);}}

test('mixed sizes and a charging orc keep their distance at both world scales',()=>{
  for(const scale of [1,2]){
    const g=setup(scale);add(g,3,250);add(g,5,180);const orc=add(g,2,100);add(g,1,40);
    advance(g,12);assert.ok(orc.distance>400);assert.equal(orc.chargeConsumed,undefined);
    assert.equal(g.kills,0);assert.ok(enemyRadius(3,scale)>enemyRadius(1,scale));
  }
});

test('swept bodies stop large-step tunneling and do not push a stationary attacker',()=>{
  const g=setup(),front=add(g,1,200),back=add(g,2,0);
  g.moveEnemy(back,10);separated(g);assert.equal(front.x,200);assert.ok(back.x<front.x);
  assert.equal(back.hp,112);assert.equal(back.chargeConsumed,undefined);
  g.damageEnemy(front,999);g.moveEnemy(back,1);assert.ok(back.x>200);assert.equal(g.corpses.length,1);
});

test('both incoming lanes merge and every enemy exits without overlapping or getting stuck',()=>{
  const g=new Game(()=>0,{...secondLevel(),waves:[]});g.start();g.lives=100;
  for(let i=0;i<12;i++)add(g,i%3===0?6:1,40+i*65,i%2);
  advance(g,35);assert.equal(g.enemies.length,0);assert.equal(g.lives,88);
});

test('crowds attack a wall without crossing it and continue after its destruction',()=>{
  const g=setup(2),wall={id:-1,kind:'wall',x:600,y:200,width:32,height:96,level:1,hp:100000};g.walls.push(wall);
  for(let i=0;i<10;i++)add(g,i%2?1:2,50+i*48);
  for(let i=0;i<900;i++){
    g.update(1/60);separated(g);
    assert.ok(g.enemies.every(e=>targetDistance(wall,e)>=16-1e-6));
  }
  assert.ok(wall.hp<100000);g.damageTower(wall,100000);advance(g,35);
  assert.equal(g.enemies.length,0);assert.equal(g.lives,90);
});

test('dense melee crowds can keep attacking a fence instead of idling behind the front rank',()=>{
  for(const scale of [1,2]){
    const g=setup(scale,[[[0,192*scale],[640*scale,192*scale]]]);
    const wall={id:-1,kind:'wall',x:320*scale,y:192*scale,width:16*scale,height:48*scale,level:1,hp:100000};
    g.walls.push(wall);
    for(let row=0;row<4;row++)for(let col=0;col<5;col++){
      const x=(160+col*24)*scale,e=add(g,1,x);e.y=(156+row*24)*scale;
    }
    for(let frame=0;frame<720;frame++){
      const before=g.enemies.map(e=>({x:e.x,y:e.y}));g.update(1/60);separated(g);
      g.enemies.forEach((e,i)=>{
        assert.ok(Math.hypot(e.x-before[i].x,e.y-before[i].y)<=ENEMIES[1].speed*scale/60+1e-6);
        assert.ok(targetDistance(wall,e)>=8*scale-1e-6);
      });
    }
    // The original footprints left only 4 of these 20 enemies able to attack.
    const active=g.enemies.filter(e=>e.attackAt!=null&&g.time-e.attackAt<=ENEMIES[1].attackInterval+.02);
    assert.ok(active.length>=16,`only ${active.length}/20 enemies can attack at scale ${scale}`);
    assert.ok(active.every(e=>targetDistance(wall,e)<=g.attackRange(e,wall)+1e-7));
  }
});

test('attackers rejoin after a shared target disappears instead of blocking at their shared anchor',()=>{
  const g=setup(2),tower={id:0,x:600,y:280,level:1,hp:100000,cooldown:Infinity};g.slots.push(tower);
  for(let i=0;i<8;i++)add(g,1,40+i*48);
  advance(g,12);assert.ok(tower.hp<100000);g.damageTower(tower,100000);
  advance(g,35);assert.equal(g.enemies.length,0);assert.equal(g.lives,92);
});

test('a blocked entrance queues spawns while an independent lane keeps spawning',()=>{
  const g=setup(1,[[[0,200],[2000,200]],[[0,400],[2000,400]]]),blocker=add(g,1,0),seen=[];
  g.spawnQueue=[{level:2,routeIndex:0},{level:5,routeIndex:0,delay:0},{level:6,routeIndex:1,delay:0}];
  g.onEnemySpawn=level=>seen.push(level);g.update(0);separated(g);
  assert.deepEqual(seen,[6]);assert.equal(g.pendingSpawns.length,2);
  g.damageEnemy(blocker,999);g.update(0);separated(g);assert.deepEqual(seen,[6,2]);
  advance(g,2);assert.deepEqual(seen,[6,2,5]);assert.equal(g.pendingSpawns.length,0);
  g.start();assert.equal(g.pendingSpawns.length,0);
});

test('coincident hand-placed bodies separate, paused bodies stay fixed, and corpses do not block',()=>{
  const g=setup();for(let type=1;type<=6;type++)add(g,type,200);
  g.update(0);separated(g);const before=g.enemies.map(e=>[e.x,e.y]);g.phase='paused';g.update(1);
  assert.deepEqual(g.enemies.map(e=>[e.x,e.y]),before);
  g.phase='playing';advance(g,3);assert.ok(g.enemies.some(e=>e.distance>200));
});
