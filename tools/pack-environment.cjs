const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),out=path.join(root,'dist/assets/environment');
const crops={
  oak:[10,10,245,289,64],roundTree:[261,32,207,264,56],birch:[470,30,168,268,52],pine:[640,20,192,278,60],limeTree:[832,60,181,238,52],oldOak:[1015,0,291,302,80],goldTree:[1308,26,221,276,60],
  sapling:[20,300,164,154,36],youngTree:[203,299,161,160,36],smallTree:[380,304,182,157,40],smallOak:[560,305,162,156,36],
  bush:[727,339,134,108,28],flowers:[864,339,161,110,32],orangeBush:[1027,340,179,108,32],berryBush:[1213,337,140,110,28],log:[1354,340,165,107,36],
  boulders:[28,451,230,147,48],standingRock:[270,455,165,143,36],rockCluster:[442,470,243,129,48],mossRock:[697,465,151,133,34],rock:[854,490,123,96,28],pebble:[985,494,88,82,20],lowRock:[1080,491,105,88,24],stump:[1195,470,130,112,28],fallenLog:[1330,470,172,112,36],
  grass:[24,612,152,151,48],grassDirt:[183,613,147,151,48],dirt:[337,615,144,149,48],meadow:[493,612,148,153,48],flowerGrass:[651,612,154,154,48],
  fern:[1070,587,90,81,20],tuft:[1163,590,76,77,18],reeds:[1251,587,110,83,24],whiteFlowers:[1377,674,69,67,16],pinkFlowers:[1453,676,63,65,16],
  buildPad:[89,779,274,219,40]
};
(async()=>{
  fs.mkdirSync(out,{recursive:true});const specs={};
  for(const [name,[left,top,width,height,size]] of Object.entries(crops)){
    const {data,info}=await sharp(path.join(root,'art/environment/atlas-source.png')).extract({left,top,width,height}).resize({width:size,height:size,fit:'inside',kernel:'nearest'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(let p=0;p<data.length;p+=4){if(data[p+3]<128)data.fill(0,p,p+4);else data[p+3]=255;}
    await sharp(data,{raw:info}).png().toFile(path.join(out,name+'.png'));
    specs[name]={file:name+'.png',width:info.width,height:info.height};
  }
  fs.writeFileSync(path.join(out,'sprites.json'),JSON.stringify(specs,null,2)+'\n');console.log('Packed',Object.keys(specs).length,'environment sprites');
})().catch(e=>{console.error(e);process.exitCode=1;});
