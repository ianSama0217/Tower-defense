// Cut the generated settings atlas into reusable transparent UI components.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),source=path.join(root,'art/settings/source.png'),out=path.join(root,'dist/assets/ui/settings-kit');
const regions={title:[762,8,555,138],close:[1360,16,130,131],speaker:[755,208,144,131],music:[963,207,122,128],checked:[1169,214,118,113],unchecked:[1380,214,113,113],divider:[757,422,345,51],track:[40,582,399,42],fill:[483,581,402,44],thumb:[968,581,84,102],badge:[1135,586,154,78],button:[28,862,338,107],parchment:[713,741,349,225],frame:[1074,737,315,230]};
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const manifest={source:'art/settings/source.png',sprites:{}};
 for(const [name,[x,y,w,h]] of Object.entries(regions)){
  let left=x+w,top=y+h,right=-1,bottom=-1;
  for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){
   if(data[(py*info.width+px)*4+3]<32)continue;
   left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py);
  }
  if(right<left)throw Error(`Empty asset: ${name}`);
  const crop={left,top,width:right-left+1,height:bottom-top+1};
  await sharp(source).extract(crop).png().toFile(path.join(out,`${name}.png`));manifest.sprites[name]=crop;
 }
 fs.writeFileSync(path.join(out,'sprites.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log('Packed fourteen settings components.');
})().catch(error=>{console.error(error);process.exitCode=1;});
