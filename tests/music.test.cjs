const {test}=require('node:test');
const assert=require('node:assert/strict');
const MusicManager=require('../dist/music-manager.js');

function setup(){
  const media={paused:true,currentTime:0,plays:0,blocked:false,
    play(){this.plays++;if(this.blocked)return Promise.reject(Error('Autoplay blocked'));this.paused=false;return Promise.resolve();},
    pause(){this.paused=true;}};
  let created=0;
  const music=new MusicManager({volume:.6,createAudio:()=>{created++;return media;}});
  return {music,media,created:()=>created};
}
test('music is lazy, loops, uses independent volume and reuses one player on restart',()=>{
  const {music,media,created}=setup();music.play();assert.equal(created(),0);
  music.start('battle-1.mp3');assert.equal(created(),1);assert.equal(media.loop,true);
  assert.equal(media.paused,false);assert.equal(media.volume,.6);
  media.currentTime=10;music.start('battle-1.mp3');assert.equal(media.currentTime,0);assert.equal(created(),1);
  music.setVolume(0);assert.equal(media.volume,0);music.setVolume(2);assert.equal(media.volume,1);
  music.setVolume(NaN);assert.equal(media.volume,1);
  music.start('battle-2.mp3');assert.equal(media.src,'battle-2.mp3');assert.equal(created(),1);
});
test('blocked autoplay retries on a later gesture, without unhandled rejections',async()=>{
  const {music,media}=setup();media.blocked=true;music.start('battle-1.mp3');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(media.paused,true);
  media.blocked=false;music.play();assert.equal(media.paused,false);
  music.play();assert.equal(media.plays,2);
});
test('background/pagehide suspends without losing position, stopped music stays stopped',()=>{
  const {music,media}=setup();music.start('battle-1.mp3');media.currentTime=12;
  music.suspend(true);music.play();assert.equal(media.paused,true);assert.equal(media.currentTime,12);
  music.suspend(false);assert.equal(media.paused,false);assert.equal(media.currentTime,12);
  music.stop();music.suspend(false);music.play();assert.equal(media.paused,true);assert.equal(media.currentTime,0);
  music.suspend(true);music.start('battle-2.mp3');assert.equal(media.paused,true);
  music.suspend(false);assert.equal(media.paused,false);
});
test('leaving during a pending play cannot leave audio running',async()=>{
  const {music,media}=setup();let finish;
  media.play=()=>new Promise(resolve=>{finish=()=>{media.paused=false;resolve();};});
  music.start('battle-1.mp3');music.suspend(true);finish();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(media.paused,true);
});
