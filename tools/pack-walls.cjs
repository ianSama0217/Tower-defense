const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),source=path.join(root,'art/walls/source.png'),out=path.join(root,'dist/assets/walls');
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const sprites=[];
  for(let row=0;row<2;row++){
    const parts=[];
    for(let col=0;col<5;col++){
      const x0=Math.floor(col*info.width/5),x1=Math.floor((col+1)*info.width/5),y0=Math.floor(row*info.height/2),y1=Math.floor((row+1)*info.height/2);
      let l=x1,t=y1,r=x0,b=y0;
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(data[(y*info.width+x)*4+3]>=128){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
      parts.push({left:l,top:t,width:r-l+1,height:b-t+1});
    }
    const scale=Math.min(56/Math.max(...parts.map(p=>p.width)),64/Math.max(...parts.map(p=>p.height)));
    for(let col=0;col<5;col++){
      const p=parts[col],width=Math.round(p.width*scale),height=Math.round(p.height*scale);
      const sprite=await sharp(source).extract(p).resize(width,height,{kernel:'nearest'}).png().toBuffer();
      const file=`wall-${row?'vertical':'horizontal'}-${[100,80,50,25,0][col]}.png`;
      await sharp({create:{width:64,height:80,channels:4,background:'#00000000'}}).composite([{input:sprite,left:Math.floor((64-width)/2),top:76-height}]).png().toFile(path.join(out,file));
      sprites.push(file);
    }
  }
  console.log('Packed',sprites.length,'wall sprites.');
})().catch(e=>{console.error(e);process.exitCode=1;});
