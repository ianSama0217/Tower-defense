// Slice the generated transparent atlas into runtime sprites. No recoloring or background removal.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),source=path.join(root,'art/level-select/markers-source.png'),out=path.join(root,'dist/assets/ui/level-markers');
const columns=[0,418,820,1254],rows=[0,450,842,1254];
const items=[['banner-1',152,180],['banner-2',152,180],['banner-3',152,180],['banner-4',152,180],['banner-5',152,180],['pedestal',184,104],['star-gold',64,64],['star-empty',64,64],['lock-chains',200,156]];
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const manifest={source:'art/level-select/markers-source.png',sprites:{}};
 for(let i=0;i<items.length;i++){
  const [name,width,height]=items[i],col=i%3,row=Math.floor(i/3);
  let left=columns[col+1],right=-1,top=rows[row+1],bottom=-1;
  for(let y=rows[row];y<rows[row+1];y++)for(let x=columns[col];x<columns[col+1];x++){
   if(data[(y*info.width+x)*4+3]<32)continue;
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  if(right<left)throw Error(`Empty sprite: ${name}`);
  const crop={left,top,width:right-left+1,height:bottom-top+1};
  await sharp(source).extract(crop).resize(width,height,{fit:'fill',kernel:'nearest'}).png().toFile(path.join(out,`${name}.png`));
  manifest.sprites[name]={width,height,crop};
 }
 fs.writeFileSync(path.join(out,'sprites.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log('Packed nine transparent marker sprites.');
})().catch(error=>{console.error(error);process.exit(1);});
