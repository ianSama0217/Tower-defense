// Normalize imagegen artwork into exact, transparent, pixel-art game canvases.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),out=path.join(root,'dist/assets/towers'),art=path.join(root,'art/towers');
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const manifest={view:'three-quarter-slightly-elevated',footprintTiles:{width:2,height:2},towers:{}};
  for(const [level,size] of [[1,64],[2,80],[3,96]]){
    const {data,info}=await sharp(path.join(art,`tower-lv${level}-source.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let left=info.width,top=info.height,right=-1,bottom=-1;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(right<left)throw Error('Empty source');
    const width=right-left+1,height=bottom-top+1,scale=Math.min((size-6)/width,(size-6)/height),w=Math.round(width*scale),h=Math.round(height*scale);
    const cropped=await sharp(data,{raw:info}).extract({left,top,width,height}).resize(w,h,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
    const pixels=Buffer.alloc(size*size*4),dx=Math.floor((size-w)/2),dy=size-3-h;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const src=(y*w+x)*4,dst=((y+dy)*size+x+dx)*4;
      if(cropped[src+3]<128)continue;cropped.copy(pixels,dst,src,src+3);pixels[dst+3]=255;
    }
    const file=`tower_lv${level}.png`;
    await sharp(pixels,{raw:{width:size,height:size,channels:4}}).png().toFile(path.join(out,file));
    manifest.towers[level]={file,width:size,height:size,anchor:{x:size/2,y:size-3},archers:level,footprintTiles:{width:2,height:2}};
  }
  fs.writeFileSync(path.join(out,'sprites.json'),JSON.stringify(manifest,null,2)+'\n');
  const tiles=[];
  for(const level of [1,2,3]){const spec=manifest.towers[level];tiles.push({input:await sharp(path.join(out,spec.file)).resize(spec.width*4,spec.height*4,{kernel:'nearest'}).png().toBuffer(),left:(level-1)*400+Math.floor((400-spec.width*4)/2),top:400-spec.height*4});}
  await sharp({create:{width:1200,height:416,channels:4,background:'#dce1cf'}}).composite(tiles).png().toFile(path.join(art,'towers-preview.png'));
  console.log(manifest);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
