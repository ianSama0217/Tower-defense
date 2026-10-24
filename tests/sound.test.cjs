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
function resultAudio(){
  const ctx=audioContext(),media=[],links=[];
  ctx.createMediaElementSource=element=>({connect(target){links.push({element,target});},disconnect(){}});
  const sound=new SoundManager({contextFactory:()=>ctx,createAudio:()=>{
    const element={currentTime:0,paused:true,plays:0,async play(){this.paused=false;this.plays++;},pause(){this.paused=true;}};
    media.push(element);return element;
  }});
  return {ctx,media,links,sound};
}
test('result WAVs preload once, use the effects gain, and switch without overlap',async()=>{
  const {sound,media,links}=resultAudio();
  assert.equal(await sound.playVictory(),false);assert.equal(media.length,0);
  await sound.unlock();await sound.unlock();assert.equal(media.length,2);
  assert.match(media[0].src,/victory_01_8bit\.wav$/);assert.match(media[1].src,/gameover_01_8bit\.wav$/);
  for(const link of links){assert.equal(link.target,sound.master);assert.equal(link.element.loop,false);}
  assert.equal(sound.master.gain.value,1);sound.setVolume(1);assert.equal(sound.master.gain.events.at(-1)[0],2);
  assert.equal(await sound.playVictory(),true);assert.equal(media[0].plays,1);
  media[0].currentTime=1;
  assert.equal(await sound.playGameOver(),true);assert.equal(media[0].paused,true);assert.equal(media[0].currentTime,0);assert.equal(media[1].plays,1);
  sound.stopAll();assert.equal(media[1].paused,true);assert.equal(media[1].currentTime,0);
});
test('result sounds respect mute/zero volume and safely handle interruption or playback failure',async()=>{
  const {sound,media}=resultAudio();await sound.unlock();
  sound.setMuted(true);assert.equal(await sound.playVictory(),false);
  sound.setMuted(false);sound.setVolume(0);assert.equal(await sound.playGameOver(),false);
  assert.equal(media.reduce((sum,m)=>sum+m.plays,0),0);sound.setVolume(.5);
  let finish;media[0].play=()=>new Promise(resolve=>{finish=resolve;});
  const pending=sound.playVictory();sound.stopAll();finish();assert.equal(await pending,false);assert.equal(media[0].paused,true);
  media[1].play=async()=>{throw Error('Unavailable audio');};assert.equal(await sound.playGameOver(),false);
});
test('bundled result files are RIFF/WAVE audio and retain their license',()=>{
  const fs=require('node:fs'),path=require('node:path'),dir=path.join(__dirname,'../dist/assets/tunoron_sfx_pack_8bit');
  for(const name of ['victory_01_8bit.wav','gameover_01_8bit.wav']){
    const wav=fs.readFileSync(path.join(dir,name));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');assert.ok(wav.length>44);
  }
  assert.match(fs.readFileSync(path.join(dir,'LICENSE.txt'),'utf8'),/including in commercial games/);
});
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
  events.length=0;g.build(0);g.damageTower(g.slots[0],g.slots[0].maxHp);g.updateTowerActions(5);assert.deepEqual(events,[]);
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
test('separate bomber deaths play explosions, rewards and death cues once; self-detonation grants no coin',()=>{
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
