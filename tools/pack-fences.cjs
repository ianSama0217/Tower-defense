const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),source=path.join(root,'art/fences/source-four-cross.png'),varied=path.join(root,'art/fences/source-varied.png'),out=path.join(root,'dist/assets/fences');
async function scan(source){
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const cells=[],runs=[];let start=-1;
 // Alpha-separated columns prevent uneven generated spacing from clipping tips.
 for(let x=0;x<=info.width;x++){let occupied=false;if(x<info.width)for(let y=0;y<info.height;y++)if(data[(y*info.width+x)*4+3]>=128){occupied=true;break;}
  if(occupied&&start<0)start=x;if(!occupied&&start>=0){runs.push([start,x]);start=-1;}
 }
 if(runs.length!==5)throw Error(`Expected five separate fences, found ${runs.length}`);
 for(let i=0;i<5;i++){
  const [x0,x1]=runs[i];let left=x1,right=x0,top=info.height,bottom=0;
  for(let y=0;y<info.height;y++)for(let x=x0;x<x1;x++)if(data[(y*info.width+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(left>right)throw Error('Empty fence frame');cells.push({left,top,width:right-left+1,height:bottom-top+1});
 }
 return cells;
}
(async()=>{
 const cells=await scan(source),variations=await scan(varied);
 fs.mkdirSync(out,{recursive:true});const scale=Math.min(96/Math.max(...cells.map(c=>c.width)),36/Math.max(...cells.map(c=>c.height)));
 for(const [i,hp] of [100,80,50,25,0].entries()){
  const changed=hp===100||hp===50,c=changed?variations[i]:cells[i],w=Math.round(cells[i].width*scale),h=changed?Math.min(36,Math.round(c.height*w/c.width)):Math.round(c.height*scale);
  const input=await sharp(changed?varied:source).extract(c).resize(w,h,{kernel:'nearest'}).png().toBuffer();
  await sharp({create:{width:96,height:36,channels:4,background:'#00000000'}}).composite([{input,left:Math.floor((96-w)/2),top:36-h}]).png().toFile(path.join(out,`fence-${hp}.png`));
 }
 fs.writeFileSync(path.join(out,'sprites.json'),JSON.stringify({stages:[100,80,50,25,0],width:96,height:36,baseline:36,crosses:4,repeat:false,verticalRotation:90,sourceCells:cells,variationSource:'art/fences/source-varied.png',variationCells:{100:variations[0],50:variations[2]}},null,2)+'\n');
 console.log('Packed five transparent fence damage stages.');
})().catch(e=>{console.error(e);process.exitCode=1;});
