// Technical packing of generated artwork: one shared scale per character, real RGBA.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),art=path.join(root,'art/monsters'),out=path.join(root,'dist/assets/enemies');
const sprites=require('../dist/enemy-sprites.js');
const definitions=[{key:'bomber',level:4,ys:[0,260,500,742,1024]},{key:'slime',level:5,ys:[0,270,500,760,1024]}];
async function main(){
  const report=[],manifest={layout:'horizontal',spacing:0,margin:0,enemies:{}};
  for(const def of definitions){
    const spec=sprites.specs[def.level],{data,info}=await sharp(path.join(art,`${def.key}-source.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true}),frames=[];
    for(let row=0;row<4;row++)for(let col=0;col<6;col++){
      const x0=col*256,x1=(col+1)*256,y0=def.ys[row],y1=def.ys[row+1];
      let l=x1,r=-1,t=y1,b=-1;const seen=new Set(),components=[];
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
        const p=y*info.width+x;if(data[p*4+3]<128)continue;
        l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
        if(seen.has(p))continue;
        const queue=[p];seen.add(p);let cl=x,cr=x;
        for(let i=0;i<queue.length;i++){
          const px=queue[i]%info.width,py=Math.floor(queue[i]/info.width);cl=Math.min(cl,px);cr=Math.max(cr,px);
          for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const nx=px+dx,ny=py+dy,np=ny*info.width+nx;if(nx<x0||nx>=x1||ny<y0||ny>=y1||seen.has(np)||data[np*4+3]<128)continue;seen.add(np);queue.push(np);}
        }
        components.push({size:queue.length,left:cl,right:cr});
      }
      if(r<l)throw Error(`Empty ${def.key} ${row}/${col}`);
      const body=components.sort((a,b)=>b.size-a.size)[0];
      frames.push({l,r,t,b,ax:row===3?(l+r+1)/2:(body.left+body.right+1)/2,ay:b+1,row,col});
    }
    const {x:ax,y:ay}=spec.anchor,n=spec.size;let scale=Infinity;
    for(const f of frames)scale=Math.min(scale,(ax-1)/(f.ax-f.l),(n-ax-1)/(f.r+1-f.ax),(ay-1)/(f.ay-f.t));
    const pixels=Buffer.alloc(n*24*n*4),bounds=[];
    for(let i=0;i<frames.length;i++){
      const f=frames[i];let left=n,top=n,right=-1,bottom=-1;
      for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){
        const sx=Math.floor(f.ax+(x+.5-ax)/scale),sy=Math.floor(f.ay+(y+.5-ay)/scale);
        if(sx<f.l||sx>f.r||sy<f.t||sy>f.b)continue;
        const src=(sy*info.width+sx)*4,dst=(y*n*24+i*n+x)*4;if(data[src+3]<128)continue;
        data.copy(pixels,dst,src,src+3);pixels[dst+3]=255;
        left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
      }
      if(right<left)throw Error('Empty packed frame');bounds.push({left,top,right,bottom});
    }
    await sharp(pixels,{raw:{width:n*24,height:n,channels:4}}).png().toFile(path.join(out,spec.file));
    // Readable 6 x 4 review sheet, assembled from final game frames.
    const tiles=[];for(let i=0;i<24;i++)tiles.push({input:await sharp(pixels,{raw:{width:n*24,height:n,channels:4}}).extract({left:i*n,top:0,width:n,height:n}).resize(n*5,n*5,{kernel:'nearest'}).png().toBuffer(),left:(i%6)*n*5,top:Math.floor(i/6)*n*5});
    await sharp({create:{width:n*30,height:n*20,channels:4,background:'#344337'}}).composite(tiles).png().toFile(path.join(art,`${def.key}-preview.png`));
    manifest.enemies[def.level]={file:spec.file,frameWidth:n,frameHeight:n,width:n*24,height:n,frames:24,anchor:spec.anchor,animations:spec.animations,facing:'right'};
    report.push({key:def.key,scale,frames:bounds});
  }
  fs.writeFileSync(path.join(out,'monsters.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(art,'packing-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(manifest));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
