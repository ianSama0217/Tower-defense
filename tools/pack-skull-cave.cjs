const path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..');
// Preserve the supplied artwork and alpha; only downsample for the scenery palette.
sharp(path.join(root,'art/skull-cave/source.png'))
  .resize({width:320,kernel:'nearest'}).png()
  .toFile(path.join(root,'dist/assets/environment/skullCave.png'))
  .catch(error=>{console.error(error);process.exitCode=1;});
