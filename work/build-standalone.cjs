const fs=require('fs');
const path=require('path');
const dir=path.resolve(__dirname,'../outputs/biofresh-fresh-slice');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
let css=fs.readFileSync(path.join(dir,'styles.css'),'utf8');
css=css.replace(/url\(["']?(assets\/[^"')\s]+)["']?\)/g,(_,file)=>{
  const mime=file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'image/jpeg';
  return 'url("data:'+mime+';base64,'+fs.readFileSync(path.join(dir,file)).toString('base64')+'")';
});
const js=fs.readFileSync(path.join(dir,'game.js'),'utf8');
const sounds=fs.readFileSync(path.join(dir,'sounds.js'),'utf8');
const platformConfig=fs.readFileSync(path.join(dir,'platform-config.js'),'utf8');
const platformSdk=fs.readFileSync(path.join(dir,'platform-sdk.js'),'utf8');
const registration=fs.readFileSync(path.join(dir,'registration.js'),'utf8');
let photos=fs.readFileSync(path.join(dir,'photos.js'),'utf8');
const photoFiles=[...photos.matchAll(/"src":\s*"(assets\/[^"\s]+)"/g)].map(match=>match[1]);
for(const file of photoFiles){
  const mime=file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'image/jpeg';
  const embeddedPhoto='data:'+mime+';base64,'+fs.readFileSync(path.join(dir,file)).toString('base64');
  photos=photos.split(file).join(embeddedPhoto);
}
const standalone=html
  .replace('<link rel="stylesheet" href="styles.css">',()=>`<style>\n${css}\n</style>`)
  .replace('<script src="photos.js"></script>',()=>`<script>\n${photos}\n</script>`)
  .replace('<script src="sounds.js"></script>',()=>`<script>\n${sounds}\n</script>`)
  .replace('<script src="platform-config.js"></script>',()=>`<script>\n${platformConfig}\n</script>`)
  .replace('<script src="platform-sdk.js"></script>',()=>`<script>\n${platformSdk}\n</script>`)
  .replace('<script src="registration.js"></script>',()=>`<script>\n${registration}\n</script>`)
  .replace('<script src="game.js"></script>',()=>`<script>\n${js}\n</script>`);
if(standalone===html||/<script\b[^>]*\bsrc=/.test(standalone)||standalone.includes('href="styles.css"')||standalone.includes('"assets/'))throw new Error('Bundling failed');
const output=path.resolve(dir,'../Biofresh-Fresh-Slice.html');
fs.writeFileSync(output,standalone,'utf8');
console.log(`Updated standalone HTML: ${Buffer.byteLength(standalone)} bytes`);
