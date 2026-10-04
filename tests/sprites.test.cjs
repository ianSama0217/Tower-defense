const {combatScenario}=require('./fixtures.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const sprites=require('../dist/enemy-sprites.js');
const {Game,ENEMIES,position}=require('../dist/engine.js');
const manifest=require('../dist/assets/enemies/sprites.json');

// Decode the delivered 8-bit RGBA PNGs with Node built-ins so tests need no packages.
function readPNG(file){
  const png=fs.readFileSync(file),chunks=[];let width,height;
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  for(let p=8;p<png.length;){const n=png.readUInt32BE(p),type=png.toString('ascii',p+4,p+8),data=png.subarray(p+8,p+8+n);p+=n+12;
    if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(data[8],8);assert.equal(data[9],6,'Must be actual RGBA');assert.equal(data[12],0);}
    if(type==='IDAT')chunks.push(data);
  }
  const raw=zlib.inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=Buffer.alloc(width*height*4);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];assert.ok(filter<=4);
    for(let x=0;x<stride;x++){const p=y*stride+x,a=x>=4?pixels[p-4]:0,b=y?pixels[p-stride]:0,c=y&&x>=4?pixels[p-stride-4]:0;pixels[p]=(raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;}
  }
  return {width,height,pixels};
}
test('goblin archer has twenty transparent 24px frames with fixed slicing and anchors',()=>{
  const spec=sprites.specs[6],meta=require('../dist/assets/enemies/archer.json'),png=readPNG(path.join(__dirname,'../dist/assets/enemies',spec.file));
  assert.equal(png.width,480);assert.equal(png.height,24);assert.deepEqual(meta.anchor,spec.anchor);assert.deepEqual(meta.animations,sprites.animations);
  for(let frame=0;frame<20;frame++){
    let opaque=0;
    for(let y=0;y<24;y++)for(let x=0;x<24;x++){
      const p=(y*480+frame*24+x)*4,a=png.pixels[p+3];assert.ok(a===0||a===255);if(a)opaque++;else assert.equal(png.pixels.readUIntBE(p,3),0);
      if(x===0||x===23||y===0||y===23)assert.equal(a,0,`Clipped frame ${frame}`);
    }
    assert.ok(opaque>25);
  }
  for(const [state,a] of Object.entries(sprites.animations))for(let frame=0;frame<a.count;frame++){
    const e={id:0,level:6,moving:state!=='idle'};if(['attack','hurt','death'].includes(state))e[state+'At']=0;
    const f=sprites.sample(e,frame/a.fps+.001);assert.equal(f.state,state);assert.equal(f.sx,(a.start+frame)*24);
  }
});

test('tower work atlas has sixteen isolated transparent effect cells',()=>{
  const manifest=require('../dist/assets/tower-work/sprites.json');
  const png=readPNG(path.join(__dirname,'../dist/assets/tower-work',manifest.file));
  assert.equal(png.width,manifest.cellSize*manifest.columns);assert.equal(png.height,manifest.cellSize*manifest.rows);
  for(let cell=0;cell<16;cell++){
    let opaque=0;const size=manifest.cellSize;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const index=((Math.floor(cell/4)*size+y)*png.width+cell%4*size+x)*4,alpha=png.pixels[index+3];
      assert.ok(alpha===0||alpha===255);if(alpha)opaque++;else assert.equal(png.pixels.readUIntBE(index,3),0);
      if(x===0||y===0||x===size-1||y===size-1)assert.equal(alpha,0,`effect ${cell} bleeds into its neighbour`);
    }
    assert.ok(opaque>20,`effect ${cell} is empty`);
  }
});

test('tower PNGs have exact requested sizes, real transparency and shared footprint metadata',()=>{
  const towerSprites=require('../dist/tower-sprites.js'),towerManifest=require('../dist/assets/towers/sprites.json');
  for(let level=1;level<=3;level++){
    const s=towerSprites.specs[level],m=towerManifest.towers[level],png=readPNG(path.join(__dirname,'../dist/assets/towers',s.file));
    assert.equal(png.width,[0,64,80,96][level]);assert.equal(png.height,png.width);
    assert.deepEqual(m.anchor,s.anchor);assert.deepEqual(s.footprintTiles,{width:2,height:2});assert.equal(m.archers,level);
    let opaque=0,transparent=0;
    for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){
      const p=(y*s.size+x)*4,a=png.pixels[p+3];assert.ok(a===0||a===255);
      if(a)opaque++;else transparent++;
      if(x===0||y===0||x===s.size-1||y===s.size-1)assert.equal(a,0);
    }
    assert.ok(opaque>200);assert.ok(transparent>200);
  }
});
test('all original enemy frames have exact RGBA dimensions, transparent margins and fixed slicing metadata',()=>{
  assert.deepEqual(manifest.animations,sprites.animations);
  for(let level=1;level<=3;level++){
    const s=sprites.specs[level],m=manifest.enemies[level],png=readPNG(path.join(__dirname,'../dist/assets/enemies',s.file));
    assert.equal(png.width,s.size*(s.frames||20));assert.equal(png.height,s.size);assert.deepEqual(m.anchor,s.anchor);
    for(let frame=0;frame<(s.frames||20);frame++){
      let opaque=0,transparent=0;
      for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){
        const p=(y*png.width+frame*s.size+x)*4,a=png.pixels[p+3];assert.ok(a===0||a===255);
        if(a)opaque++;else{transparent++;assert.equal(png.pixels.readUIntBE(p,3),0);}
        if(x===0||y===0||x===s.size-1||y===s.size-1)assert.equal(a,0,`${s.file} frame ${frame} clipped`);
      }
      assert.ok(opaque>20);assert.ok(transparent>20);
    }
  }
});
test('animation ranges, priorities, loop and terminal death frame select fixed source coordinates',()=>{
  for(let level=1;level<=3;level++)for(const [state,a] of Object.entries(sprites.animations)){
    const e={level,id:0,moving:state!=='idle'};if(['attack','hurt','death'].includes(state))e[state+'At']=0;
    for(let i=0;i<a.count;i++){const f=sprites.sample(e,i/a.fps+.001);assert.equal(f.state,state);assert.equal(f.index,a.start+i);assert.equal(f.sx,(a.start+i)*sprites.specs[level].size);}
  }
  assert.equal(sprites.sample({level:1,deathAt:0,hurtAt:0,attackAt:0},100).index,19);
  assert.equal(sprites.sample({level:1,hurtAt:0,attackAt:0},.1).state,'hurt');
  assert.equal(sprites.sample({level:1,hurtAt:0,attackAt:0},.25).state,'attack');
  assert.equal(sprites.sample({level:1,id:0},.5).index,4);
});
test('new monster frames have exact dimensions, fixed anchors, transparent edges and no attack animation',()=>{
  const extra=require('../dist/assets/enemies/monsters.json');
  for(const level of [4,5]){
    const s=sprites.specs[level],m=extra.enemies[level],png=readPNG(path.join(__dirname,'../dist/assets/enemies',s.file));
    assert.equal(png.width,s.size*24);assert.equal(png.height,s.size);assert.deepEqual(m.anchor,s.anchor);assert.deepEqual(m.animations,s.animations);assert.equal(s.animations.attack,undefined);
    for(let frame=0;frame<24;frame++){
      let opaque=0;
      for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){
        const p=(y*png.width+frame*s.size+x)*4,a=png.pixels[p+3];assert.ok(a===0||a===255);
        if(a)opaque++;else assert.equal(png.pixels.readUIntBE(p,3),0);
        if(x===0||y===0||x===s.size-1||y===s.size-1)assert.equal(a,0,`${s.file} frame ${frame} clipped`);
      }
      assert.ok(opaque>5,`${s.file} frame ${frame} empty`);
    }
    for(const [state,a] of Object.entries(s.animations))for(let i=0;i<a.count;i++){
      const e={level,id:0,moving:state!=='idle'};if(state==='hurt'||state==='death')e[state+'At']=0;
      const f=sprites.sample(e,i/a.fps+.001);assert.equal(f.state,state);assert.equal(f.sx,(a.start+i)*s.size);
    }
    assert.equal(sprites.sample({level,attackAt:0},.1).state,'walk');assert.equal(sprites.sample({level,deathAt:0},10).index,23);
  }
});
function enemy(g,level=1,distance=16){const s=ENEMIES[level],route=g.level.routes[0];const e={id:1,level,hp:s.hp,maxHp:s.hp,distance,remaining:route.length-distance,routeIndex:0,...position(distance,route)};g.enemies.push(e);return e;}
test('hit, attack, movement and death events drive animation without changing rewards or routes',()=>{
  const g=new Game(Math.random,combatScenario());g.start();g.countdown=999;g.build(1);g.slots[1].cooldown=999;Object.assign(g.slots[1],{x:1248,y:380});
  const e=enemy(g);g.update(.01);assert.equal(e.facing,-1);assert.equal(e.attackAt,g.time);
  g.bullets.push({x:e.x,y:e.y,target:e,damage:1});g.update(.01);assert.equal(sprites.sample(e,g.time).state,'hurt');
  const money=g.money;g.bullets.push({x:e.x,y:e.y,target:e,damage:999},{x:e.x,y:e.y,target:e,damage:999});g.update(.01);
  assert.equal(g.enemies.length,0);assert.equal(g.corpses.length,1);assert.equal(g.money,money+ENEMIES[1].reward);assert.equal(g.kills,1);
  const corpse=g.corpses[0],x=corpse.x,y=corpse.y,hp=g.slots[1].hp;
  g.update(.63);assert.equal(sprites.sample(corpse,g.time).index,19);assert.equal(corpse.x,x);assert.equal(corpse.y,y);assert.equal(g.slots[1].hp,hp);
  g.update(.13);assert.equal(g.corpses.length,0);
});
test('victory waits for death playback, resets clear corpses and escapes create no corpse',()=>{
  const g=new Game(Math.random,combatScenario());g.start();g.countdown=0;g.wave=g.waves.length;const e=enemy(g);g.bullets.push({x:e.x,y:e.y,target:e,damage:999});g.update(.01);
  assert.equal(g.phase,'playing');g.update(.76);assert.equal(g.phase,'won');
  g.start();g.countdown=999;enemy(g,1,g.level.routes[0].length-.1);g.update(.01);assert.equal(g.corpses.length,0);assert.equal(g.lives,2);
  g.corpses.push({level:1,deathAt:g.time});g.start();assert.equal(g.corpses.length,0);
});
