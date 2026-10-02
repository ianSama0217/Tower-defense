const {test}=require('node:test');
const assert=require('node:assert/strict');
const SoundManager=require('../dist/sound-manager.js');
const {Game,createScenario,ENEMIES}=require('../dist/engine.js');
const {TutorialGame}=require('../dist/tutorial-level.js');

function audioContext(){
  const sources=[],nodes=[];
  const param=()=>({value:0,events:[],setValueAtTime(v,t){this.events.push([v,t]);},linearRampToValueAtTime(v,t){this.events.push([v,t]);},exponentialRampToValueAtTime(v,t){assert.ok(v>0);this.events.push([v,t]);},setTargetAtTime(v,t){this.events.push([v,t]);}});
  const node=()=>{const n={connect(){},disconnect(){this.disconnected=true;}};nodes.push(n);return n;};
  const source=()=>{const n={...node(),frequency:param(),start(time){this.startTime=time;},stop(time){this.stopTime=time;}};sources.push(n);return n;};
  return {sources,nodes,state:'suspended',currentTime:0,sampleRate:48000,destination:{},
    async resume(){this.state='running';},createGain(){return {...node(),gain:param()};},
    createDynamicsCompressor(){return {...node(),threshold:param(),knee:param(),ratio:param()};},
    createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};},
    createOscillator:source,createBufferSource:source,createBiquadFilter(){return {...node(),Q:param(),frequency:param()};}
  };
}
test('audio is lazy; unavailable and rejected audio never throw or queue effects',async()=>{
  let created=0;const ctx=audioContext(),sound=new SoundManager({contextFactory:()=>{created++;return ctx;}});
  assert.equal(sound.playArrow(),false);assert.equal(created,0);
  assert.equal(await sound.unlock(),true);assert.equal(created,1);assert.equal(ctx.sources.length,0);
  await sound.unlock();assert.equal(created,1);
  const missing=new SoundManager({contextFactory:()=>null});assert.equal(await missing.unlock(),false);assert.equal(missing.playHit(),false);
  ctx.state='suspended';ctx.resume=async()=>{throw Error('blocked');};assert.equal(await sound.unlock(),false);assert.equal(sound.playArrow(),false);
});
test('arrow oscillators start at 1000, 900 and 800 Hz',async()=>{
  const ctx=audioContext(),sound=new SoundManager({contextFactory:()=>ctx});await sound.unlock();
  for(const [level,hz] of [[1,1000],[2,900],[3,800],[99,1000]]){
    ctx.currentTime++;const from=ctx.sources.length;assert.equal(sound.playArrow(level),true);
    assert.equal(ctx.sources[from].frequency.events[0][0],hz);
  }
});
test('all effects schedule finite short sources and release voices after completion',async()=>{
  const ctx=audioContext(),sound=new SoundManager({contextFactory:()=>ctx});await sound.unlock();
  for(const method of ['playArrow','playHit','playCoin','playBuild','playUpgrade','playExplosion','playEnemyDeath','playWaveStart']){
    assert.equal(sound[method](),true);
  }
  for(const source of ctx.sources){assert.ok(source.stopTime>source.startTime);assert.ok(source.stopTime<1);source.onended();}
  assert.equal(sound.voices.size,0);
});
test('dense combat is bounded, muted/zero-volume playback is suppressed, stop clears voices',async()=>{
  const ctx=audioContext(),sound=new SoundManager({contextFactory:()=>ctx});await sound.unlock();
  assert.equal(sound.playArrow(),true);assert.equal(sound.playArrow(),false);
  for(let i=0;i<100;i++){ctx.currentTime+=.1;sound.playArrow();}
  assert.equal(sound.voices.size,24);sound.stopAll();assert.equal(sound.voices.size,0);
  sound.setMuted(true);assert.equal(sound.playExplosion(),false);sound.setMuted(false);
  sound.setVolume(0);assert.equal(sound.playCoin(),false);sound.setVolume(2);assert.equal(sound.volume,1);
  sound.setVolume(NaN);assert.equal(sound.volume,1);assert.equal(sound.playUpgrade(),true);
  ctx.state='suspended';assert.equal(sound.playWaveStart(),false);
});
function attach(game){const events=[];game.sound=Object.fromEntries(['Arrow','Hit','Coin','Build','Upgrade','Explosion','EnemyDeath','WaveStart'].map(name=>['play'+name,(...args)=>events.push([name,...args])]));return events;}
function arena(){const game=new Game(Math.random,createScenario({paths:[[[0,0],[1000,0]]],slots:[[80,0]],initialMoney:1000}));game.start();return game;}
function enemy(game,level=5,x=0){const spec=ENEMIES[level];const e={id:game.nextId++,level,hp:spec.hp,maxHp:spec.hp,x,y:0,routeIndex:0,distance:x,remaining:1000-x};game.enemies.push(e);return e;}
test('build/upgrade sounds occur only on completion; failed or destroyed jobs stay silent',()=>{
  const g=arena(),events=attach(g);g.build(0);assert.deepEqual(events,[]);g.updateTowerActions(5);assert.deepEqual(events,[['Build']]);
  events.length=0;g.build(0);g.updateTowerActions(4);assert.deepEqual(events,[]);g.updateTowerActions(1);assert.deepEqual(events,[['Upgrade']]);
  events.length=0;g.build(0);g.damageTower(g.slots[0],100);g.updateTowerActions(5);assert.deepEqual(events,[]);
  g.money=0;g.build(0);assert.deepEqual(events,[]);
});
test('actual tower level reaches arrow audio; misses do not play hit sounds',()=>{
  for(const level of [1,2,3]){
    const g=arena();g.build(0);g.updateTowerActions(5);g.slots[0].level=level;const events=attach(g),e=enemy(g);
    g.update(.01);assert.deepEqual(events,[['Arrow',level]]);
    for(let i=0;i<20&&!events.some(([name])=>name==='Hit');i++)g.update(.01);
    assert.ok(events.some(([name])=>name==='Hit'));
    events.length=0;g.bullets=[{target:e,x:0,y:0,damage:12}];e.hp=0;g.update(.01);assert.ok(!events.some(([name])=>name==='Hit'));
  }
});
test('chain explosions, rewards and death cues happen once; self-detonation grants no coin',()=>{
  const g=arena(),events=attach(g),a=enemy(g,4),b=enemy(g,4,10);g.killEnemy(a);g.killEnemy(a);g.killEnemy(b);
  for(const name of ['Explosion','EnemyDeath','Coin'])assert.equal(events.filter(([event])=>event===name).length,2);
  const other=arena(),otherEvents=attach(other);other.killEnemy(enemy(other,4),false);
  assert.deepEqual(otherEvents,[['EnemyDeath'],['Explosion']]);
});
test('manual and automatic tutorial waves each announce once, and reset keeps sound binding',()=>{
  const g=new TutorialGame();g.start();const events=attach(g);assert.equal(g.startNextWave(),true);assert.equal(g.startNextWave(),false);
  assert.deepEqual(events,[['WaveStart']]);g.spawnQueue=[];g.update(.01);g.update(15);
  assert.equal(events.filter(([name])=>name==='WaveStart').length,2);
  g.start();g.startNextWave();assert.equal(events.filter(([name])=>name==='WaveStart').length,3);
});
