// Pack the imagegen VFX into fixed cells; preserve each animation's shared scale.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),out=path.join(root,'dist/assets/tower-work');
async function main(){
  const {data,info}=await sharp(path.join(root,'art/tower-work/effects-source.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const size=96,pixels=Buffer.alloc(size*size*16*4);
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const left=Math.round(col*info.width/4),top=Math.round(row*info.height/4);
    const width=Math.round((col+1)*info.width/4)-left,height=Math.round((row+1)*info.height/4)-top;
    // The largest dust puff extends past its nominal generated grid cell.
    // Isolate its full silhouette so individual chips do not become cut rectangles.
    const crop=row===1&&col===2?{left:608,top:360,width:369,height:265}:{left,top,width,height};
    const cell=await sharp(data,{raw:info}).extract(crop).resize(size-4,size-4,{kernel:'nearest',fit:'contain',background:'#00000000'}).raw().toBuffer();
    for(let y=0;y<size-4;y++)for(let x=0;x<size-4;x++){
      const src=(y*(size-4)+x)*4,dst=(((row*size+y+2)*size*4)+col*size+x+2)*4;
      if(cell[src+3]<128)continue;
      cell.copy(pixels,dst,src,src+3);pixels[dst+3]=255;
    }
  }
  fs.mkdirSync(out,{recursive:true});
  await sharp(pixels,{raw:{width:size*4,height:size*4,channels:4}}).png().toFile(path.join(out,'effects.png'));
  fs.writeFileSync(path.join(out,'sprites.json'),JSON.stringify({file:'effects.png',cellSize:size,columns:4,rows:4,animations:{hammer:[0,1,2,3],dust:[4,5,6,7],stone:[8,9,10,11]},scaffold:12,spark:13,woodBurst:14,woodRubble:15},null,2)+'\n');
  console.log('Packed tower work effects: 384 × 384, sixteen 96 px cells.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
