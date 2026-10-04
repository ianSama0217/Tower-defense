// Technical atlas packing only; character artwork is generated with imagegen.
// Run with sharp available on NODE_PATH. No per-frame scaling or painted backgrounds.
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const root=path.join(__dirname,'..');
const out=path.join(root,'dist/assets/enemies');
const sources=path.join(root,'art/enemies');
const specs=[
  {name:'goblin',level:1,size:24,file:'goblin-source.png',xs:[0,229,458,687,916,1145,1374],ys:[0,250,465,705,925,1145],centers:[128,354,582,810,1038,1260],feet:[224,450,681,902,1108]},
  {name:'orc',level:2,size:32,file:'orc-source.png',xs:[0,220,415,644,820,1020,1230],ys:[0,280,516,775,1020,1278],centers:[114,320,525,730,930,1120],feet:[250,498,747,988,1230]},
  {name:'cyclops',level:3,size:48,file:'cyclops-source.png',xs:[0,229,458,687,916,1145,1374],ys:[0,250,461,714,930,1145],centers:[116,346,574,802,1030,1260],feet:[222,452,694,917,1115]}
];
const animations={idle:{start:0,count:4,fps:5,loop:true},walk:{start:4,count:4,fps:8,loop:true},attack:{start:8,count:4,fps:10,loop:false},hurt:{start:12,count:2,fps:10,loop:false},death:{start:14,count:6,fps:8,loop:false}};
function isolate(data,width,x0,y0,x1,y1){
  const seen=new Set(),components=[];
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const start=y*width+x;if(seen.has(start)||data[start*4+3]<128)continue;
    const pixels=[start];seen.add(start);let l=x,r=x,t=y,b=y;
    for(let i=0;i<pixels.length;i++){
      const p=pixels[i],px=p%width,py=Math.floor(p/width);
      l=Math.min(l,px);r=Math.max(r,px);t=Math.min(t,py);b=Math.max(b,py);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=px+dx,ny=py+dy,np=ny*width+nx;
        if(nx<x0||nx>=x1||ny<y0||ny>=y1||seen.has(np)||data[np*4+3]<128)continue;
        seen.add(np);pixels.push(np);
      }
    }
    components.push({pixels,l,r,t,b});
  }
  components.sort((a,b)=>b.pixels.length-a.pixels.length);
  const main=components[0],keep=new Set(main.pixels);
  // Reject disconnected slivers of a neighboring pose at an imperfect source-grid edge.
  // Keep nearby separate hit/swing accents belonging to this character.
  for(const c of components.slice(1)){
    const dx=Math.max(0,main.l-c.r,c.l-main.r),dy=Math.max(0,main.t-c.b,c.t-main.b);
    if(c.pixels.length>=4&&Math.hypot(dx,dy)<=12)for(const p of c.pixels)keep.add(p);
  }
  return keep;
}
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const manifest={layout:'horizontal',columns:20,rows:1,spacing:0,margin:0,animations,enemies:{}};
  const report=[];
  for(const s of specs){
    const {data,info}=await sharp(path.join(sources,s.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const frames=[];
    for(let row=0;row<5;row++)for(let col=0;col<[4,4,4,2,6][row];col++){
      let left=info.width,top=info.height,right=-1,bottom=-1;
      const keep=isolate(data,info.width,s.xs[col],s.ys[row],s.xs[col+1],s.ys[row+1]);
      for(const p of keep){const x=p%info.width,y=Math.floor(p/info.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      if(right<left)throw Error(`Empty ${s.name} ${row}/${col}`);
      // Standing poses use the authored foot line; fallen bodies rest on the same ground.
      const ay=row===4?bottom+1:s.feet[row];
      frames.push({left,top,right,bottom,ax:s.centers[col],ay,row,col,keep});
    }
    const anchor={x:s.size/2,y:s.size-3};
    let scale=Infinity;
    for(const f of frames){
      scale=Math.min(scale,(anchor.x-1)/(f.ax-f.left),(s.size-anchor.x-1)/(f.right+1-f.ax),(anchor.y-1)/(f.ay-f.top));
      if(f.bottom+1>f.ay)scale=Math.min(scale,(s.size-anchor.y-1)/(f.bottom+1-f.ay));
    }
    const pixels=Buffer.alloc(s.size*20*s.size*4);
    const bounds=[];
    for(let i=0;i<frames.length;i++){
      const f=frames[i];let l=s.size,t=s.size,r=-1,b=-1;
      // One fixed nearest-neighbor scale across the entire character, anchored to feet.
      for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){
        const sx=Math.floor(f.ax+(x+.5-anchor.x)/scale),sy=Math.floor(f.ay+(y+.5-anchor.y)/scale);
        if(sx<f.left||sx>f.right||sy<f.top||sy>f.bottom)continue;
        const src=(sy*info.width+sx)*4,dst=(y*s.size*20+i*s.size+x)*4;
        if(!f.keep.has(sy*info.width+sx))continue;
        data.copy(pixels,dst,src,src+3);pixels[dst+3]=255;
        l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
      }
      if(r<l)throw Error('Empty output frame');
      if(l===0||r===s.size-1||t===0||b===s.size-1)throw Error(`Clipped ${s.name} frame ${i}`);
      bounds.push({frame:i,left:l,top:t,right:r,bottom:b,sourceAnchor:{x:f.ax,y:f.ay}});
    }
    const filename=`enemy_lv${s.level}_${s.name}.png`;
    await sharp(pixels,{raw:{width:s.size*20,height:s.size,channels:4}}).png().toFile(path.join(out,filename));
    manifest.enemies[s.level]={file:filename,frameWidth:s.size,frameHeight:s.size,width:s.size*20,height:s.size,anchor,facing:'right'};
    report.push({name:s.name,scale,anchor,frames:bounds});
  }
  fs.writeFileSync(path.join(out,'sprites.json'),JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(sources,'packing-report.json'),JSON.stringify(report,null,2)+'\n');
  if(fs.existsSync(path.join(root,'art/orc-charge/source.png')))await require('./pack-orc-charge.cjs')();
  console.log(JSON.stringify(manifest,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
