const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const Boss=require('../dist/boss-sprites.js'),manifest=require('../dist/assets/boss/sprites.json');
function png(file){
  const data=fs.readFileSync(file),chunks=[];let w,h;
  for(let p=8;p<data.length;){const n=data.readUInt32BE(p),type=data.toString('ascii',p+4,p+8),chunk=data.subarray(p+8,p+8+n);p+=n+12;
    if(type==='IHDR'){w=chunk.readUInt32BE(0);h=chunk.readUInt32BE(4);assert.equal(chunk[8],8);assert.equal(chunk[9],6);assert.equal(chunk[12],0);}
    if(type==='IDAT')chunks.push(chunk);
  }
  const raw=zlib.inflateSync(Buffer.concat(chunks)),stride=w*4,pixels=Buffer.alloc(w*h*4);
  function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
  for(let y=0;y<h;y++)for(let x=0;x<stride;x++){
    const p=y*stride+x,a=x>=4?pixels[p-4]:0,b=y?pixels[p-stride]:0,c=y&&x>=4?pixels[p-stride-4]:0;
    pixels[p]=(raw[y*(stride+1)+x+1]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][raw[y*(stride+1)]])&255;
  }
  return {w,h,pixels};
}
test('Boss, flying rock and impact are separate RGBA atlases with exact fixed cells and no clipped edges',()=>{
  const files=new Set();
  for(const [key,s] of Object.entries(Boss.specs)){
    const m=manifest.assets[key],p=png(path.join(__dirname,'../dist/assets/boss',s.file));files.add(s.file);
    assert.equal(p.w,s.size*s.frames);assert.equal(p.h,s.size);assert.equal(m.width,p.w);assert.equal(m.frameWidth,s.size);assert.equal(m.frameHeight,s.size);assert.deepEqual(m.anchor,s.anchor);
    assert.deepEqual(m.animations,s.animations);
    for(let frame=0;frame<s.frames;frame++){
      let opaque=0,top=s.size,bottom=-1;
      for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){
        const at=(y*p.w+frame*s.size+x)*4,a=p.pixels[at+3];assert.ok(a===0||a===255);
        if(a){opaque++;top=Math.min(top,y);bottom=Math.max(bottom,y);}else assert.equal(p.pixels.readUIntBE(at,3),0);
        if(x===0||y===0||x===s.size-1||y===s.size-1)assert.equal(a,0,`${key} ${frame} clipped`);
      }
      assert.ok(opaque>5,`${key} ${frame} empty`);
      if(key==='cyclops'){assert.equal(bottom,89);if(frame<4)assert.ok(bottom-top+1>=75&&bottom-top+1<=85);}
    }
  }
  assert.equal(files.size,3);assert.equal(Boss.specs.cyclops.size,96);assert.equal(Boss.specs.cyclops.frames,27);
});
test('all six Boss animations use 96px slicing including throw and death; projectiles sample independently',()=>{
  assert.deepEqual(Object.values(Boss.specs.cyclops.animations).map(a=>a.count),[4,4,4,6,3,6]);
  for(const [key,s] of Object.entries(Boss.specs))for(const [state,a] of Object.entries(s.animations)){
    for(let i=0;i<a.count;i++){
      const f=Boss.sample(key,state,i/a.fps+.001);
      assert.equal(f.index,a.start+i);assert.deepEqual([f.sx,f.sy,f.sw,f.sh],[(a.start+i)*s.size,0,s.size,s.size]);
    }
    assert.equal(Boss.sample(key,state,a.count/a.fps+.001).index,a.loop?a.start:a.start+a.count-1);
  }
  assert.equal(Boss.sample('cyclops','death',100).index,26);
  assert.equal(Boss.sample('cyclops','throw',100).index,17);
});
