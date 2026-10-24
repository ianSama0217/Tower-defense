// Pack separate generated sprites without altering their original alpha.
const sharp=require('sharp'),path=require('node:path');
const root=path.join(__dirname,'..'),source=path.join(root,'art/level-select-cave/navigation-source.png');
(async()=>{
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const names=['map-prev','map-next','level-markers/banner-blank'];
 for(let i=0;i<3;i++){
  const start=Math.floor(info.width*i/3),end=Math.floor(info.width*(i+1)/3);
  let left=end,right=-1,top=info.height,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=start;x<end;x++)if(data[(y*info.width+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left)throw Error(`Empty sprite: ${names[i]}`);
  await sharp(source).extract({left,top,width:right-left+1,height:bottom-top+1}).resize(i===2?152:128,i===2?180:128,{fit:'fill',kernel:'nearest'}).png().toFile(path.join(root,'dist/assets/ui',names[i]+'.png'));
 }
 console.log('Packed map arrows and blank flag.');
})().catch(e=>{console.error(e);process.exitCode=1;});
