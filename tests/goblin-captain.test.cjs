const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../dist/goblin-captain.js'),TD=require('../dist/engine.js');
test('first warcry starts at 15s, ends at 20s and repeats every 15s for exactly 5s',()=>{
  for(const start of [0,37.5]){
    for(const t of [0,14.999,20,29.999,35,44.999])assert.equal(C.cycle(start+t,start).active,false,`inactive at ${t}`);
    for(const t of [15,19.999,30,34.999,45,49.999])assert.equal(C.cycle(start+t,start).active,true,`active at ${t}`);
    assert.equal(C.cycle(start+15,start).remaining,5);assert.equal(C.cycle(start+20,start).remaining,10);
    assert.equal(C.cycle(start+15.749,start).casting,true);assert.equal(C.cycle(start+15.75,start).casting,false);
    assert.equal(C.cycle(start+301,start).count,20);assert.equal(C.cycle(start+301,start).active,true);
  }
});
test('visual aura only selects living goblin variants within radius without modifying any stats',()=>{
  const units=[1,2,3,4,5,6].map(level=>({level,x:10,y:0,hp:100,speed:49,attackCooldown:1}));
  units.push({level:1,x:160,y:0,hp:1},{level:1,x:160.01,y:0,hp:100},{level:1,x:0,y:0,hp:0},{level:4,x:0,y:0,hp:10,deathAt:0},{level:6,x:0,y:0,hp:10,escaped:true});
  const before=JSON.stringify(units),stats=JSON.stringify(TD.ENEMIES);
  assert.deepEqual(C.recipients({x:0,y:0},units).map(u=>u.level),[1,4,6,1]);
  for(let t=0;t<100;t+=.1)C.cycle(t);
  assert.equal(JSON.stringify(units),before);assert.equal(JSON.stringify(TD.ENEMIES),stats);
});
test('captain and aura have separate exact 48px RGBA sheets, fixed anchors and complete animation ranges',()=>{
  for(const [spec,json] of [[C.captain,'goblin-captain.json'],[C.aura,'goblin-warcry-aura.json']]){
    const meta=require('../dist/assets/boss/'+json),png=fs.readFileSync(path.join(__dirname,'../dist/assets/boss',spec.file));
    assert.equal(png.readUInt32BE(16),48*spec.frames);assert.equal(png.readUInt32BE(20),48);assert.equal(png[24],8);assert.equal(png[25],6);
    assert.deepEqual(meta.anchor,spec.anchor);assert.deepEqual(meta.animations,spec.animations);
    for(const [state,a] of Object.entries(spec.animations))for(let i=0;i<a.count;i++)assert.deepEqual(C.sample(spec,state,i/a.fps+.001),{index:a.start+i,sx:(a.start+i)*48,sy:0,sw:48,sh:48});
  }
  assert.deepEqual(Object.values(C.captain.animations).map(a=>a.count),[4,4,4,6,3,6]);
  assert.equal(C.sample(C.captain,'death',100).index,26);assert.equal(C.sample(C.aura,'aura',.5).index,0);
});
