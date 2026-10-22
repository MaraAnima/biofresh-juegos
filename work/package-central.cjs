const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../outputs'),central=path.join(root,'central-juegos'),game=path.join(root,'biofresh-fresh-slice');
const sdk=fs.readFileSync(path.join(central,'shared-sdk.js'),'utf8');
fs.writeFileSync(path.join(central,'SDK.html'),'<script>\n'+sdk+'\n</script>\n','utf8');
fs.writeFileSync(path.join(game,'platform-sdk.js'),sdk,'utf8');
fs.copyFileSync(path.join(game,'platform-config.js'),path.join(central,'config-fresh-slice.js'));
console.log('SDK, configuración y archivos de publicación sincronizados.');
