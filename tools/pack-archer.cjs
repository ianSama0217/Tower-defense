// Normalize generated art into twenty fixed 24px RGBA cells, using one shared scale.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),art=path.join(root,'art/archer'),out=path.join(root,'dist/assets/enemies');
const {animations,specs}=require('../dist/enemy-sprites.js');
async function main(){
  const {data,info}=await sharp(path.join(art,'source.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const seen=new Uint8Array(info.width*info.height),parts=[];
  for(let p=0;p<seen.length;p++){
    if(seen[p]||data[p*4+3]<128)continue;
    const pixels=[p];seen[p]=1;let l=info.width,r=0,t=info.height,b=0;
    for(let i=0;i<pixels.length;i++){
      const at=pixels[i],x=at%info.width,y=Math.floor(at/info.width);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,np=ny*info.width+nx;if(nx<0||ny<0||nx>=info.width||ny>=info.height||seen[np]||data[np*4+3]<128)continue;seen[np]=1;pixels.push(np);}
    }
    if(pixels.length>500)parts.push({l,r,t,b,keep:new Set(pixels)});
  }
  if(parts.length!==30)throw Error(`Expected 30 isolated source poses, found ${parts.length}`);
  const rows=[0,255,470,700,920,1145],columns=[[0,1,2,3],[0,1,2,3],[0,2,3,5],[0,2],[0,1,2,3,4,5]],frames=[];
  for(let row=0;row<5;row++){
    const poses=parts.filter(p=>p.t>=rows[row]&&p.t<rows[row+1]).sort((a,b)=>a.l-b.l);
    if(poses.length!==6)throw Error(`Invalid source row ${row}`);
    for(const col of columns[row]){
      const f=poses[col];let left=f.r,right=f.l;
      // Anchor standing frames at the feet, independent of the outstretched bow.
      for(const p of f.keep)if(Math.floor(p/info.width)>=f.b-12){left=Math.min(left,p%info.width);right=Math.max(right,p%info.width);}
      frames.push({...f,ax:row===4?(f.l+f.r+1)/2:(left+right+1)/2,ay:f.b+1,row,col});
    }
  }
  const s=specs[6],n=s.size,{x:ax,y:ay}=s.anchor;let scale=Infinity;
  for(const f of frames)scale=Math.min(scale,(ax-1)/(f.ax-f.l),(n-ax-1)/(f.r+1-f.ax),(ay-1)/(f.ay-f.t));
  const pixels=Buffer.alloc(n*20*n*4),bounds=[];
  for(let i=0;i<frames.length;i++){
    const f=frames[i];let l=n,r=-1,t=n,b=-1;
    for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){
      const sx=Math.floor(f.ax+(x+.5-ax)/scale),sy=Math.floor(f.ay+(y+.5-ay)/scale),src=sy*info.width+sx;
      if(sx<f.l||sx>f.r||sy<f.t||sy>f.b||!f.keep.has(src))continue;
      const dst=(y*n*20+i*n+x)*4;data.copy(pixels,dst,src*4,src*4+3);pixels[dst+3]=255;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
    }
    if(r<l)throw Error('Empty packed frame');bounds.push({frame:i,left:l,top:t,right:r,bottom:b});
  }
  await sharp(pixels,{raw:{width:480,height:24,channels:4}}).png().toFile(path.join(out,s.file));
  const tiles=[];let frame=0;
  for(let row=0;row<5;row++)for(let col=0;col<columns[row].length;col++)tiles.push({input:await sharp(pixels,{raw:{width:480,height:24,channels:4}}).extract({left:frame++*24,top:0,width:24,height:24}).resize(144,144,{kernel:'nearest'}).png().toBuffer(),left:col*144,top:row*144});
  await sharp({create:{width:864,height:720,channels:4,background:'#334536'}}).composite(tiles).png().toFile(path.join(art,'preview.png'));
  fs.writeFileSync(path.join(out,'archer.json'),JSON.stringify({file:s.file,frameWidth:24,frameHeight:24,width:480,height:24,frames:20,spacing:0,margin:0,anchor:s.anchor,facing:'right',animations},null,2)+'\n');
  fs.writeFileSync(path.join(art,'packing-report.json'),JSON.stringify({scale,anchor:s.anchor,bounds},null,2)+'\n');
  console.log({file:s.file,size:'480x24',frames:20,scale});
}
main().catch(error=>{console.error(error);process.exitCode=1;});
