const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const {createCanvas,loadImage,Path2D}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'../outputs/biofresh-fresh-slice');
const code=fs.readFileSync(path.join(root,'game.js'),'utf8');
const sandbox={window:{},document:{createElement:()=>createCanvas(1,1)},Path2D,Math};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'photos.js'),'utf8'),sandbox);
vm.runInContext(code.slice(code.indexOf('  function makeBagSprite('),code.indexOf('  function loadIngredientPhotos(')),sandbox);
vm.runInContext(code.slice(code.indexOf('  function drawBagSpark('),code.indexOf('  function drawBagBonusBanner(')),sandbox);
const proof=createCanvas(1500,1020),ctx=proof.getContext('2d');
ctx.fillStyle='#f5f5f0';ctx.fillRect(0,0,proof.width,proof.height);
const angles=[-Math.PI/2,-Math.PI/4,0,Math.PI/4,Math.PI/2];
function moments(canvas){
  const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let mass=0,x=0,y=0;
  for(let p=0;p<data.length/4;p++){const alpha=data[p*4+3];mass+=alpha;x+=(p%canvas.width+.5)*alpha;y+=(Math.floor(p/canvas.width)+.5)*alpha;}
  return{mass,x:x/mass,y:y/mass};
}
(async()=>{
  for(const [row,spec] of sandbox.window.BIOFRESH_BAGS.entries()){
    const photo=await loadImage(fs.readFileSync(path.join(root,spec.src)));
    const bag=sandbox.makeBagSprite(photo,spec),aura=sandbox.makeBagAura(spec),reference=moments(aura);
    const pixels=aura.getContext('2d').getImageData(0,0,640,640).data;
    for(let p=0;p<640;p++){
      assert.strictEqual(pixels[(p*640)*4+3],0);assert.strictEqual(pixels[(p*640+639)*4+3],0);
      assert.strictEqual(pixels[p*4+3],0);assert.strictEqual(pixels[(639*640+p)*4+3],0);
    }
    let firstMass;
    for(const [column,angle] of angles.entries()){
      const layer=createCanvas(600,600),c=layer.getContext('2d');
      c.translate(300,300);c.rotate(angle);c.drawImage(aura,-160,-160,320,320);
      const actual=moments(layer),dx=(reference.x-320)*.5,dy=(reference.y-320)*.5;
      const expectedX=300+dx*Math.cos(angle)-dy*Math.sin(angle),expectedY=300+dx*Math.sin(angle)+dy*Math.cos(angle);
      if(firstMass===undefined)firstMass=actual.mass;
      assert(Math.abs(actual.mass/firstMass-1)<.025,'El aura no debe perder brillo al girar');
      assert(Math.hypot(actual.x-expectedX,actual.y-expectedY)<1,'El aura debe permanecer unida a la bolsa');
      const h=180,w=h*bag.width/bag.height,x=150+column*300,y=165+row*340;
      Object.assign(sandbox,{ctx,width:1500,height:1020,bagBonus:null,reducedMotion:false,
        specialBag:{spec,glints:[]},bagSprites:new Map([[spec.id,bag]]),bagAuraSprites:new Map([[spec.id,aura]]),
        bagGeometry:()=>({x,y,w,h,rot:angle,focus:1})});
      sandbox.drawSpecialBag();
      ctx.fillStyle='#345541';ctx.font='15px Arial';ctx.textAlign='center';
      ctx.fillText(spec.id+' · '+Math.round(angle*180/Math.PI)+'°',x,y+148);
    }
  }
  fs.writeFileSync(path.join(__dirname,'bag-aura-angles.png'),proof.toBuffer('image/png'));
  console.log('OK: las tres auras conservan su brillo, centro y bordes en 0°, ±45° y ±90°.');
})().catch(error=>{console.error(error);process.exitCode=1});
