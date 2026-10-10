const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const F=require('../dist/friendly-sprites.js'),spec=F.shield,meta=require('../dist/assets/friendly/shield-soldier.json');
test('shield soldier is friendly and has exactly 22 nonattacking frames with fixed offsets',()=>{
  assert.equal(spec.faction,'friendly');assert.equal(spec.canAttack,false);assert.equal(spec.animations.attack,undefined);
  assert.deepEqual(Object.values(spec.animations).map(a=>a.count),[4,4,6,3,5]);assert.deepEqual(meta.animations,spec.animations);assert.deepEqual(meta.anchor,{x:24,y:44});
  for(const [state,a] of Object.entries(spec.animations))for(let i=0;i<a.count;i++)assert.deepEqual(F.sample(state,i/a.fps+.001),{index:a.start+i,sx:(a.start+i)*48,sy:0,sw:48,sh:48});
  assert.equal(F.sample('push',6/9).index,8);assert.equal(F.sample('death',10).index,21);assert.equal(F.sample('attack',0).index,0);
});
test('all frames are true RGBA 48x48 with transparent margins and stable ground',()=>{
  const data=fs.readFileSync(path.join(__dirname,'../dist/assets/friendly',spec.file)),chunks=[];let w,h;
  for(let p=8;p<data.length;){const n=data.readUInt32BE(p),type=data.toString('ascii',p+4,p+8),c=data.subarray(p+8,p+8+n);p+=n+12;if(type==='IHDR'){w=c.readUInt32BE(0);h=c.readUInt32BE(4);assert.equal(c[8],8);assert.equal(c[9],6);}if(type==='IDAT')chunks.push(c);}
  assert.equal(w,1056);assert.equal(h,48);assert.equal(meta.width,w);assert.equal(meta.height,h);
  const raw=zlib.inflateSync(Buffer.concat(chunks)),stride=w*4,pixels=Buffer.alloc(w*h*4);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<h;y++)for(let x=0;x<stride;x++){const p=y*stride+x,a=x>=4?pixels[p-4]:0,b=y?pixels[p-stride]:0,c=y&&x>=4?pixels[p-stride-4]:0;pixels[p]=(raw[y*(stride+1)+x+1]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][raw[y*(stride+1)]])&255;}
  for(let frame=0;frame<22;frame++){
    let count=0,bottom=-1;
    for(let y=0;y<48;y++)for(let x=0;x<48;x++){const p=(y*w+frame*48+x)*4,a=pixels[p+3];assert.ok(a===0||a===255);if(a){count++;bottom=y;}else assert.equal(pixels.readUIntBE(p,3),0);if(x===0||x===47||y===0||y===47)assert.equal(a,0,`Clipped ${frame}`);}
    assert.ok(count>100);assert.equal(bottom,43);
  }
});
test('defensive advance follows facing without attacking, clamps at edges and preserves other unit fields',()=>{
  for(const facing of [-1,1]){
    const unit={x:300,y:150,scale:2,facing,animation:'push',hp:100,attackDamage:0};F.advancePreview(unit,.5,1280);
    assert.equal(unit.x,300+facing*32);assert.equal(unit.y,150);assert.equal(unit.hp,100);assert.equal(unit.attackDamage,0);assert.equal(unit.targetId,undefined);
    F.advancePreview(unit,100,1280);assert.equal(unit.x,facing===1?1232:48);F.advancePreview(unit,1,1280);assert.equal(unit.animation,'idle');
  }
  for(const animation of ['hurt','death']){const unit={x:300,y:150,animation};F.advancePreview(unit,5,1280);assert.equal(unit.x,300);assert.equal(unit.animation,animation);}
});
