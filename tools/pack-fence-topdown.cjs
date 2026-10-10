const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),source=path.join(root,'art/fences/topdown/source.png'),out=path.join(root,'dist/assets/fences');
(async()=>{
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=0,bottom=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 const rect={left,top,width:right-left+1,height:bottom-top+1},width=72,height=Math.round(rect.height*width/rect.width);
 // Discrete sprite-grid export: never interpolate pixels or add a blur filter.
 const input=await sharp(source).extract(rect).resize(width,height,{kernel:'nearest'}).png().toBuffer();
 const x=12,y=Math.floor((32-height)/2),file=path.join(out,'fence-topdown-100.png');
 await sharp({create:{width:96,height:32,channels:4,background:'#00000000'}}).composite([{input,left:x,top:y}]).png().toFile(file);
 await sharp(file).resize(768,256,{kernel:'nearest'}).png().toFile(path.join(root,'art/fences/topdown/preview-8x.png'));
 const metadata={file:'fence-topdown-100.png',state:100,canvas:{width:96,height:32},anchor:{x:48,y:16},visibleBounds:{x,y,width,height},roadWidth:96,roadCoverage:.75,crossPairs:4,rendering:'nearest-neighbor; Canvas imageSmoothingEnabled=false',source:'art/fences/topdown/source.png',scope:'Standalone complete-state candidate; not registered in campaign or damage-state atlas.'};
 fs.writeFileSync(path.join(out,'fence-topdown-100.json'),JSON.stringify(metadata,null,2)+'\n');console.log(metadata);
})().catch(e=>{console.error(e);process.exitCode=1;});
