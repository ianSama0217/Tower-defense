// Pack the generated reference arrow as a compact RGBA projectile sprite.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..');
async function main(){
  const {data,info}=await sharp(path.join(root,'art/projectiles/arrow-source.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left)throw Error('Empty arrow source');
  const width=right-left+1,height=bottom-top+1,scale=Math.min(30/width,10/height),w=Math.round(width*scale),h=Math.round(height*scale);
  const raw=await sharp(data,{raw:info}).extract({left,top,width,height}).resize(w,h,{kernel:'nearest'}).raw().toBuffer();
  const pixels=Buffer.alloc(32*12*4),dx=31-w,dy=Math.floor((12-h)/2);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const src=(y*w+x)*4,dst=((dy+y)*32+dx+x)*4;if(raw[src+3]<128)continue;raw.copy(pixels,dst,src,src+3);pixels[dst+3]=255;}
  const out=path.join(root,'dist/assets/projectiles');fs.mkdirSync(out,{recursive:true});
  await sharp(pixels,{raw:{width:32,height:12,channels:4}}).png().toFile(path.join(out,'arrow.png'));
  await sharp(pixels,{raw:{width:32,height:12,channels:4}}).resize(640,240,{kernel:'nearest'}).png().toFile(path.join(root,'art/projectiles/arrow-preview.png'));
  console.log({canvas:[32,12],opaqueBounds:[dx,dy,w,h],alpha:'0 or 255',tip:[30,6]});
}
main().catch(error=>{console.error(error);process.exitCode=1;});
