const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),art=path.join(root,'art/bomb-towers'),out=path.join(root,'dist/assets/bomb-towers');
async function atlas(name,cols,rows){
 const image=await sharp(path.join(art,name)).ensureAlpha().raw().toBuffer({resolveWithObject:true}),cells=[];
 const runs=[];
 if(rows===1){
  let start=-1;const {data,info}=image;
  for(let x=0;x<=info.width;x++){let occupied=false;if(x<info.width)for(let y=0;y<info.height;y++)if(data[(y*info.width+x)*4+3]>=128){occupied=true;break;}
   if(occupied&&start<0)start=x;if(!occupied&&start>=0){runs.push([start,x]);start=-1;}
  }
  if(runs.length!==cols)throw Error(`Expected ${cols} isolated sprites in ${name}, found ${runs.length}`);
 }
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const {data,info}=image,x0=runs[col]?.[0]??Math.floor(col*info.width/cols),x1=runs[col]?.[1]??Math.floor((col+1)*info.width/cols),y0=Math.floor(row*info.height/rows),y1=Math.floor((row+1)*info.height/rows);
  let left=x1,top=y1,right=x0,bottom=y0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(data[(y*info.width+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(left>right)throw Error(`Empty cell ${name} ${col} ${row}`);
  cells.push({left,top,width:right-left+1,height:bottom-top+1});
 }
 return {file:path.join(art,name),cells};
}
async function frame(file,rect,size,scale,baseline){
 const w=Math.round(rect.width*scale),h=Math.round(rect.height*scale),{data}=await sharp(file).extract(rect).resize(w,h,{kernel:'nearest'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const pixels=Buffer.alloc(size*size*4),dx=Math.floor((size-w)/2),dy=baseline-h;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const src=(y*w+x)*4,dst=((y+dy)*size+x+dx)*4;if(data[src+3]<128)continue;data.copy(pixels,dst,src,src+3);pixels[dst+3]=255;}
 return sharp(pixels,{raw:{width:size,height:size,channels:4}}).png().toBuffer();
}
async function strip(source,cells,size,baseline,name){
 const scale=Math.min((size-4)/Math.max(...cells.map(c=>c.width)),(baseline-1)/Math.max(...cells.map(c=>c.height))),parts=[];
 for(let i=0;i<cells.length;i++)parts.push({input:await frame(source,cells[i],size,scale,baseline),left:i*size,top:0});
 await sharp({create:{width:cells.length*size,height:size,channels:4,background:'#00000000'}}).composite(parts).png().toFile(path.join(out,name));
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const bases=await atlas('towers-source.png',3,1);
 for(let i=0;i<3;i++){const size=[64,80,96][i],r=bases.cells[i],scale=Math.min((size-6)/r.width,(size-6)/r.height);fs.writeFileSync(path.join(out,`tower_lv${i+1}.png`),await frame(bases.file,r,size,scale,size-3));}
 const operator=await atlas('operator-source.png',8,1);await strip(operator.file,operator.cells,24,22,'operator.png');
 const fx=await atlas('effects-source.png',5,2);await strip(fx.file,fx.cells.slice(0,5),16,15,'bomb.png');await strip(fx.file,fx.cells.slice(5),64,60,'explosion.png');
 fs.writeFileSync(path.join(out,'sprites.json'),JSON.stringify({towers:require('../dist/bomb-tower-sprites.js').specs.slice(1),operator:{file:'operator.png',frameSize:24,frames:8,anchor:{x:12,y:22},order:['idle1','idle2','prepare','windup','release','followThrough','recover','settle'],releaseAt:.3},bomb:{file:'bomb.png',frameSize:16,frames:5},explosion:{file:'explosion.png',frameSize:64,frames:5,anchor:{x:32,y:60}}},null,2)+'\n');
 console.log('Packed three bomb towers, eight operator frames, five bomb and five explosion frames.');
})().catch(e=>{console.error(e);process.exitCode=1;});
