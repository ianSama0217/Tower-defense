const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),art=path.join(root,'art/bat'),out=path.join(root,'dist/assets/enemies');
const spec=require('../dist/bat-sprites.js').bat;
async function main(){
  const {data,info}=await sharp(path.join(art,'source.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const rows=[0,250,470,685,890,1145],cols=[0,380,700,1020,1374],counts=[4,4,4,3,4],frames=[];
  // Authored cell boundaries isolate poses; one scale preserves proportions across all states.
  for(let row=0;row<5;row++)for(let col=0;col<counts[row];col++){
    const f={l:info.width,r:0,t:info.height,b:0,keep:new Set()};
    for(let y=rows[row];y<rows[row+1];y++)for(let x=cols[col];x<cols[col+1];x++){
      const p=y*info.width+x;if(data[p*4+3]<128)continue;
      f.keep.add(p);f.l=Math.min(f.l,x);f.r=Math.max(f.r,x);f.t=Math.min(f.t,y);f.b=Math.max(f.b,y);
    }
    if(!f.keep.size)throw Error('Missing pose');
    f.ax=(f.l+f.r+1)/2;f.ay=f.b+1;frames.push(f);
  }
  const n=24,width=n*frames.length,{x:ax,y:ay}=spec.anchor;
  const scale=Math.min(...frames.map(f=>Math.min(22/(f.r-f.l+1),19/(f.b-f.t+1))));
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
    report.push({frame:i,left,top,right,bottom});
  }
  await sharp(pixels,{raw:{width,height:n,channels:4}}).png().toFile(path.join(out,spec.file));
  fs.writeFileSync(path.join(out,'bat.json'),JSON.stringify({...spec,width,height:n,frameWidth:n,frameHeight:n,layout:'horizontal',spacing:0,margin:0},null,2)+'\n');
  fs.writeFileSync(path.join(art,'packing-report.json'),JSON.stringify({scale,anchor:spec.anchor,frames:report},null,2)+'\n');
  const tiles=[];let i=0;
  for(let row=0;row<5;row++)for(let col=0;col<counts[row];col++)tiles.push({input:await sharp(pixels,{raw:{width,height:n,channels:4}}).extract({left:i++*n,top:0,width:n,height:n}).png().toBuffer(),left:col*n,top:row*n});
  const contact=await sharp({create:{width:96,height:120,channels:4,background:'#26332b'}}).composite(tiles).png().toBuffer();
  await sharp(contact).resize(576,720,{kernel:'nearest'}).png().toFile(path.join(art,'contact-sheet.png'));
  console.log(JSON.stringify({width,height:n,frames:frames.length,scale}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
