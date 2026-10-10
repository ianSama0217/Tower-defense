const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),art=path.join(root,'art/shield-soldier'),out=path.join(root,'dist/assets/friendly');
const spec=require('../dist/friendly-sprites.js').shield;
async function main(){
  const {data,info}=await sharp(path.join(art,'source.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const seen=new Uint8Array(info.width*info.height),parts=[];
  for(let p=0;p<seen.length;p++){
    if(seen[p]||data[p*4+3]<128)continue;
    const q=[p];seen[p]=1;let l=info.width,r=0,t=info.height,b=0;
    for(let i=0;i<q.length;i++){
      const at=q[i],x=at%info.width,y=Math.floor(at/info.width);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,np=ny*info.width+nx;if(nx<0||nx>=info.width||ny<0||ny>=info.height||seen[np]||data[np*4+3]<128)continue;seen[np]=1;q.push(np);}
    }
    if(q.length>=5)parts.push({l,r,t,b,keep:new Set(q)});
  }
  const main=parts.filter(p=>p.keep.size>800);
  for(const f of main){f.ax=(f.l+f.r+1)/2;f.ay=f.b+1;}
  for(const p of parts.filter(p=>p.keep.size<=800)){
    const near=main.map(f=>({f,d:Math.hypot(Math.max(0,f.l-p.r,p.l-f.r),Math.max(0,f.t-p.b,p.t-f.b))})).sort((a,b)=>a.d-b.d)[0];
    if(near?.d<=24){const f=near.f;for(const at of p.keep)f.keep.add(at);f.l=Math.min(f.l,p.l);f.r=Math.max(f.r,p.r);f.t=Math.min(f.t,p.t);f.b=Math.max(f.b,p.b);}
  }
  const rows=[0,270,500,700,930,1145],counts=[4,4,6,3,5],frames=[];
  for(let row=0;row<5;row++){
    const group=main.filter(p=>p.t>=rows[row]&&p.t<rows[row+1]).sort((a,b)=>a.l-b.l);
    if(group.length!==counts[row])throw Error(`Wrong pose count in row ${row}`);
    frames.push(...group);
  }
  let scale=.196;const {x:ax,y:ay}=spec.anchor,n=48,width=48*22;
  for(const f of frames){scale=Math.min(scale,(ax-1)/(f.ax-f.l),(n-ax-1)/(f.r+1-f.ax),(ay-1)/(f.ay-f.t));if(f.b+1>f.ay)scale=Math.min(scale,(n-ay-1)/(f.b+1-f.ay));}
  const pixels=Buffer.alloc(width*n*4),report=[];
  for(let i=0;i<frames.length;i++){
    const f=frames[i];let left=n,top=n,right=-1,bottom=-1;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const sx=Math.floor(f.ax+(x+.5-ax)/scale),sy=Math.floor(f.ay+(y+.5-ay)/scale),p=sy*info.width+sx;
      if(sx<f.l||sx>f.r||sy<f.t||sy>f.b||!f.keep.has(p))continue;
      if(x===0||y===0||x===n-1||y===n-1)throw Error(`Clipped frame ${i}`);
      const at=(y*width+i*n+x)*4;data.copy(pixels,at,p*4,p*4+3);pixels[at+3]=255;
      left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
    }
    if(right<left)throw Error(`Empty frame ${i}`);
    report.push({frame:i,left,top,right,bottom,sourceAnchor:{x:f.ax,y:f.ay}});
  }
  fs.mkdirSync(out,{recursive:true});await sharp(pixels,{raw:{width,height:n,channels:4}}).png().toFile(path.join(out,spec.file));
  fs.writeFileSync(path.join(out,'shield-soldier.json'),JSON.stringify({...spec,width,height:n,frameWidth:n,frameHeight:n,layout:'horizontal',spacing:0,margin:0},null,2)+'\n');
  fs.writeFileSync(path.join(art,'packing-report.json'),JSON.stringify({scale,anchor:spec.anchor,frames:report},null,2)+'\n');
  const composites=[];let index=0;
  for(let row=0;row<5;row++)for(let col=0;col<counts[row];col++)composites.push({input:await sharp(pixels,{raw:{width,height:n,channels:4}}).extract({left:index++*48,top:0,width:48,height:48}).png().toBuffer(),left:col*48,top:row*48});
  await sharp({create:{width:288,height:240,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composites).png().toFile(path.join(art,'contact-sheet.png'));
  console.log(JSON.stringify({file:spec.file,width,height:n,frames:22,anchor:spec.anchor,scale}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
