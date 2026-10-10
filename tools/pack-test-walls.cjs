const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),source=path.join(root,'art/walls-topdown/source.png'),out=path.join(root,'dist/assets/walls-topdown');
(async()=>{
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true}),cells=[];
 for(let row=0;row<2;row++)for(let col=0;col<5;col++){
  const x0=Math.floor(col*info.width/5),x1=Math.floor((col+1)*info.width/5),y0=Math.floor(row*info.height/2),y1=Math.floor((row+1)*info.height/2);
  let left=x1,top=y1,right=x0,bottom=y0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(data[(y*info.width+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(left>right)throw Error('Empty wall sprite');cells.push({left,top,width:right-left+1,height:bottom-top+1});
 }
 fs.mkdirSync(out,{recursive:true});const frames={};
 for(let row=0;row<2;row++){
  const group=cells.slice(row*5,row*5+5),scale=row?Math.min(80/Math.max(...group.map(c=>c.height)),88/Math.max(...group.map(c=>c.width))):80/Math.max(...group.map(c=>c.width));
  for(const [col,hp] of [100,80,50,25,0].entries()){
   const c=group[col],w=Math.round(c.width*scale),h=Math.round(c.height*scale),x=Math.floor((96-w)/2),y=row?88-h:64-h;
   const name=`${row?'vertical':'horizontal'}-${hp}`,input=await sharp(source).extract(c).resize(w,h,{kernel:'nearest'}).png().toBuffer();
   await sharp({create:{width:96,height:96,channels:4,background:'#00000000'}}).composite([{input,left:x,top:y}]).png().toFile(path.join(out,`wall-${name}.png`));
   frames[name]={x,y,w,h};
  }
 }
 fs.writeFileSync(path.join(root,'dist/test/wall-topdown-frames.js'),'globalThis.TestWallFrames='+JSON.stringify(frames)+';\n');
 fs.writeFileSync(path.join(out,'sprites.json'),JSON.stringify({size:96,anchor:{x:48,y:48},frames,sourceCells:cells},null,2)+'\n');console.log('Packed ten independently drawn wall sprites.');
})().catch(e=>{console.error(e);process.exitCode=1;});
