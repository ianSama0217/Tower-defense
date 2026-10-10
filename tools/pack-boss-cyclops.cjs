// Normalize imagegen output; never resize an individual animation pose independently.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),art=path.join(root,'art/boss-cyclops'),out=path.join(root,'dist/assets/boss');
const {specs}=require('../dist/boss-sprites.js');
function bounds(keep,width){let l=Infinity,t=Infinity,r=-1,b=-1;for(const p of keep){const x=p%width,y=Math.floor(p/width);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}return {l,t,r,b,keep};}
function components(data,width,height){
  const seen=new Uint8Array(width*height),parts=[];
  for(let p=0;p<seen.length;p++){
    if(seen[p]||data[p*4+3]<128)continue;
    const queue=[p];seen[p]=1;
    for(let i=0;i<queue.length;i++){
      const at=queue[i],x=at%width,y=Math.floor(at/width);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy,np=ny*width+nx;
        if(nx<0||nx>=width||ny<0||ny>=height||seen[np]||data[np*4+3]<128)continue;
        seen[np]=1;queue.push(np);
      }
    }
    if(queue.length>800)parts.push(bounds(new Set(queue),width));
  }
  return parts;
}
async function pack(key,data,info,frames,scale){
  const s=specs[key],n=s.size,w=n*s.frames,pixels=Buffer.alloc(w*n*4),report=[];
  for(let i=0;i<frames.length;i++){
    const f=frames[i],ax=(f.l+f.r+1)/2,ay=key==='rock'?(f.t+f.b+1)/2:f.b+1;
    let left=n,top=n,right=-1,bottom=-1,count=0;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const sx=Math.floor(ax+(x+.5-s.anchor.x)/scale),sy=Math.floor(ay+(y+.5-s.anchor.y)/scale),src=sy*info.width+sx;
      if(sx<f.l||sx>f.r||sy<f.t||sy>f.b||!f.keep.has(src))continue;
      if(x===0||y===0||x===n-1||y===n-1)throw Error(`Clipped ${key} frame ${i}`);
      const dst=(y*w+i*n+x)*4;data.copy(pixels,dst,src*4,src*4+3);pixels[dst+3]=255;
      left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);count++;
    }
    if(!count)throw Error(`Empty ${key} frame ${i}`);
    report.push({frame:i,left,top,right,bottom,width:right-left+1,height:bottom-top+1,sourceAnchor:{x:ax,y:ay}});
  }
  if(key==='cyclops'&&report.slice(0,4).some(f=>f.height<75||f.height>85))throw Error('Standing height outside 75–85px');
  await sharp(pixels,{raw:{width:w,height:n,channels:4}}).png().toFile(path.join(out,s.file));
  return {...s,width:w,height:n,scale,bounds:report};
}
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const boss=await sharp(path.join(art,'source-final.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let parts=components(boss.data,boss.info.width,boss.info.height);
  // Two walking outlines touch in the source; their authored cell boundary is x=431.
  parts=parts.flatMap(f=>f.t>210&&f.t<415&&f.r-f.l>300?[bounds(new Set([...f.keep].filter(p=>p%boss.info.width<431)),boss.info.width),bounds(new Set([...f.keep].filter(p=>p%boss.info.width>=431)),boss.info.width)]:[f]);
  const cuts=[0,210,415,630,830,1030,1254],counts=[4,4,4,6,3,6],frames=[];
  for(let row=0;row<6;row++){
    const group=parts.filter(f=>f.t>=cuts[row]&&f.t<cuts[row+1]).sort((a,b)=>a.l-b.l);
    if(group.length!==counts[row])throw Error(`Row ${row}: expected ${counts[row]}, found ${group.length}`);
    frames.push(...group);
  }
  const result={cyclops:await pack('cyclops',boss.data,boss.info,frames,.431)};
  const rock=await sharp(path.join(art,'rock-source.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const [key,row,count,xs,scale] of [['rock',0,6,[0,362,724,1086,1448,1810,2172],.105],['impact',1,4,[0,380,730,1100,1500],.112]]){
    const poses=[];
    for(let col=0;col<count;col++){
      const keep=new Set();for(let y=row*362;y<(row+1)*362;y++)for(let x=xs[col];x<xs[col+1];x++){const p=y*rock.info.width+x;if(rock.data[p*4+3]>=128)keep.add(p);}
      poses.push(bounds(keep,rock.info.width));
    }
    result[key]=await pack(key,rock.data,rock.info,poses,scale);
  }
  const manifest={layout:'horizontal',spacing:0,margin:0,format:'RGBA',assets:{}};
  for(const [key,s] of Object.entries(result))manifest.assets[key]={file:s.file,frameWidth:s.size,frameHeight:s.size,frames:s.frames,width:s.width,height:s.height,anchor:s.anchor,animations:s.animations};
  fs.writeFileSync(path.join(out,'sprites.json'),JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(art,'packing-report.json'),JSON.stringify(result,null,2)+'\n');
  const composites=[];let index=0;
  for(let row=0;row<6;row++)for(let col=0;col<counts[row];col++)composites.push({input:await sharp(path.join(out,specs.cyclops.file)).extract({left:index++*96,top:0,width:96,height:96}).toBuffer(),left:col*96,top:row*96});
  await sharp({create:{width:576,height:576,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composites).png().toFile(path.join(art,'contact-sheet.png'));
  console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([k,s])=>[k,{width:s.width,height:s.height,frames:s.frames,firstFrame:s.bounds[0]}])),null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
