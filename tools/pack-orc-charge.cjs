const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const root=path.join(__dirname,'..');
async function pack(){
  const source=path.join(root,'art/orc-charge/source.png'),out=path.join(root,'dist/assets/enemies');
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const size=32,anchor={x:16,y:29},scale=.0445;
  const poses=[{x:330,y:544},{x:955,y:548},{x:335,y:1117},{x:965,y:1117}];
  const charge=Buffer.alloc(128*32*4),bounds=[];
  for(let i=0;i<4;i++){
    const p=poses[i];let left=32,top=32,right=-1,bottom=-1;
    for(let y=1;y<31;y++)for(let x=1;x<31;x++){
      const sx=Math.floor(p.x+(x+.5-anchor.x)/scale),sy=Math.floor(p.y+(y+.5-anchor.y)/scale);
      const x0=Math.floor((i%2)*info.width/2),x1=Math.floor((i%2+1)*info.width/2),y0=Math.floor(Math.floor(i/2)*info.height/2),y1=Math.floor((Math.floor(i/2)+1)*info.height/2);
      if(sx<x0||sx>=x1||sy<y0||sy>=y1)continue;
      const src=(sy*info.width+sx)*4,dst=(y*128+i*32+x)*4;
      if(data[src+3]<128)continue;
      data.copy(charge,dst,src,src+3);charge[dst+3]=255;
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    if(right<left)throw Error('Empty charge frame');
    bounds.push({frame:20+i,left,top,right,bottom,sourceAnchor:p});
  }
  const file=path.join(out,'enemy_lv2_orc.png');
  // Preserve all twenty existing poses byte-for-byte; repeated packing never appends twice.
  const base=await sharp(file).extract({left:0,top:0,width:640,height:32}).ensureAlpha().raw().toBuffer();
  const atlas=Buffer.alloc(768*32*4);
  for(let y=0;y<32;y++){base.copy(atlas,y*768*4,y*640*4,(y+1)*640*4);charge.copy(atlas,(y*768+640)*4,y*128*4,(y+1)*128*4);}
  await sharp(atlas,{raw:{width:768,height:32,channels:4}}).png().toFile(file);
  await sharp(charge,{raw:{width:128,height:32,channels:4}}).png().toFile(path.join(out,'enemy_orc_charge.png'));
  await sharp(charge,{raw:{width:128,height:32,channels:4}}).resize(1024,256,{kernel:'nearest'}).png().toFile(path.join(root,'art/orc-charge/preview.png'));
  const manifestPath=path.join(out,'sprites.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));
  Object.assign(manifest.enemies[2],{width:768,frames:24,columns:24,animations:require('../dist/enemy-sprites.js').specs[2].animations});
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(root,'art/orc-charge/packing-report.json'),JSON.stringify({size,anchor,scale,bounds},null,2)+'\n');
}
module.exports=pack;
if(require.main===module)pack().catch(e=>{console.error(e);process.exitCode=1;});
