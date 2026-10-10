const path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..');
// Trim transparent margins and retain the generated alpha and original aspect ratio.
sharp(path.join(root,'art/entrance-flags/source.png'))
  .trim({threshold:8})
  .resize(48,80,{fit:'contain',kernel:'nearest',background:'#00000000'})
  .png().toFile(path.join(root,'dist/assets/ui/enemy-entrance-flag.png'))
  .catch(error=>{console.error(error);process.exitCode=1;});
