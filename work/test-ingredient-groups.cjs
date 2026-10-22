const fs=require('fs'),Module=require('module'),path=require('path');
const file=path.resolve(__dirname,'test-fullscreen.cjs');
let suite=fs.readFileSync(file,'utf8');
const access='get remaining(){return remaining},get photoCount';
const marker='  console.log(`OK ${width}';
if(!suite.includes(access)||!suite.includes(marker))throw new Error('No se encontró el punto de verificación');
suite=suite.replace(access,'get remaining(){return remaining},set remaining(value){remaining=value},get elapsed(){return elapsed},set elapsed(value){elapsed=value},get nextGroupAt(){return nextGroupAt},set nextGroupAt(value){nextGroupAt=value},set groupsBlockedUntil(value){groupsBlockedUntil=value},set spawnClock(value){spawnClock=value},set bagSpawnAt(value){bagSpawnAt=value},get specialBag(){return specialBag},get ingredientsCut(){return ingredientsCut},spawnIngredientGroup,spawnSpecialBag,activateBagBonus,endBagBonus,get photoCount');
suite=suite.replace(marker,`
  function beginGroupCheck(){
    if(debug.state==='playing')debug.finishGame();
    elements.overlayButton.emit('click');
    assert(debug.nextGroupAt>=9&&debug.nextGroupAt<13,'El primer grupo debe esperar hasta después de la bolsa temprana');
    debug.objects.length=0;debug.spawnClock=Infinity;debug.bagSpawnAt=Infinity;
    debug.nextGroupAt=Infinity;debug.groupsBlockedUntil=0;debug.elapsed=12;debug.remaining=20;
  }
  const gameMath=vm.runInNewContext('Math',sandbox);
  function chooseNextGroupSize(count){
    const original=gameMath.random;
    gameMath.random=()=>{gameMath.random=original;return(count-3+.5)/3;};
  }
  beginGroupCheck();
  for(let i=0;i<3;i++){debug.spawn();const item=debug.objects.at(-1);item.y=height/2;item.vx=0;item.vy=0;item.gravity=0;}
  debug.nextGroupAt=0;debug.spawnClock=0;debug.update(.01);
  assert.strictEqual(debug.objects.length,3,'Con tres ingredientes debe esperar, sin agregar otra tanda');
  assert(!debug.objects.some(item=>item.grouped));
  debug.objects.length=2;debug.update(.01);assert.strictEqual(debug.objects.length,2,'La tanda reserva espacio hasta que se despeje la pantalla');
  debug.objects.length=0;chooseNextGroupSize(3);debug.update(.01);
  for(let expected=3;expected<=5;expected++){
  if(expected>3){beginGroupCheck();chooseNextGroupSize(expected);assert.strictEqual(debug.spawnIngredientGroup(),true);}
  const group=debug.objects.slice();
  assert.strictEqual(group.length,expected);assert(group.every(item=>item.grouped));
  assert.strictEqual(new Set(group.map(item=>item.id)).size,expected,'Los ingredientes del grupo deben ser diferentes');
  assert(debug.nextGroupAt>=debug.elapsed+8&&debug.nextGroupAt<debug.elapsed+12,'Las tandas deben tener separación aleatoria');
  const apex=-group[0].vy/group[0].gravity;
  for(let t=0;t<apex;t+=.02)debug.update(.02);
  assert.strictEqual(debug.objects.length,expected,'No debe agregar ingredientes normales durante la tanda');
  for(let i=0;i<group.length;i++){
    const item=group[i];assert(item.seen&&item.x-item.r>=0&&item.x+item.r<=width&&item.y-item.r>150&&item.y+item.r<height,'Todo el grupo debe quedar visible dentro del área de corte');
    assert(Math.abs(item.y-group[0].y)<.01,'Todo el grupo debe poder cortarse con un trazo');
    if(i)assert(item.x-group[i-1].x>=item.r+group[i-1].r+8,'Las fotos no deben superponerse');
  }
  elements.gameCanvas.emit('pointerdown',pointer(group[0].x-group[0].r-12,group[0].y));clock+=80;
  const last=group.at(-1);
  elements.gameCanvas.emit('pointermove',pointer(last.x+last.r+12,last.y));elements.gameCanvas.emit('pointerup');
  assert(group.every(item=>item.sliced));assert.strictEqual(debug.ingredientsCut,expected);assert.strictEqual(debug.combo,expected,'Un solo movimiento debe permitir cortar el grupo completo');
  }

  beginGroupCheck();debug.bagSpawnAt=debug.elapsed+4;
  assert.strictEqual(debug.spawnIngredientGroup(),false,'No debe salir poco antes de la bolsa');
  debug.bagSpawnAt=Infinity;debug.spawnSpecialBag();
  assert.strictEqual(debug.spawnIngredientGroup(),false,'No debe salir mientras vuela la bolsa');
  debug.activateBagBonus();assert.strictEqual(debug.spawnIngredientGroup(),false,'No debe salir durante el bonus');
  debug.endBagBonus();debug.update(2.9);
  assert.strictEqual(debug.spawnIngredientGroup(),false,'Debe dejar tres segundos después del bonus');
  debug.update(.11);assert.strictEqual(debug.spawnIngredientGroup(),true);

  beginGroupCheck();debug.spawnSpecialBag();const escapingBag=debug.specialBag;
  escapingBag.seen=true;escapingBag.y=height+escapingBag.h;escapingBag.vy=100;debug.update(.01);
  assert.strictEqual(debug.specialBag,null);assert.strictEqual(debug.spawnIngredientGroup(),false,'También debe dejar descanso si no se corta la bolsa');
  debug.update(3.01);debug.remaining=4.5;
  assert.strictEqual(debug.spawnIngredientGroup(),false,'No debe lanzar una tanda sin tiempo suficiente al final');
  console.log('OK: grupos de 3, 4 y 5 alcanzables con un trazo, pantalla despejada y separación antes y después de la bolsa.');
`+marker);
suite=suite.replace('await environment(390,844,false)','await environment(390,844,false);await environment(320,568,false)');
const runner=new Module(file,module);runner.filename=file;runner.paths=module.paths;runner._compile(suite,file);
