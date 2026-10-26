const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const path=require('path');
const {Image:NativeImage,Path2D}=require('@napi-rs/canvas');
const base=path.resolve(__dirname,'../outputs/biofresh-fresh-slice');
let source=fs.readFileSync(path.join(base,'game.js'),'utf8');
source=source.replace('  requestAnimationFrame(loop);\n})();',`  globalThis.__debug={get state(){return state},get score(){return score},get combo(){return combo},get comboPulse(){return comboPulse},get labels(){return labels},get objects(){return objects},get particles(){return particles},get splashes(){return splashes},get lives(){return lives},get remaining(){return remaining},get photoCount(){return photoSprites.size},get whipAudioBuffers(){return whipAudioBuffers},get bagSparkleBuffer(){return bagSparkleBuffer},loadIngredientPhotos,spawn,finishGame,update};\n  requestAnimationFrame(loop);\n})();`);
assert(source.includes('globalThis.__debug'));
async function environment(width,height,fullscreenSupported=true,compatibility={}){
  let clock=0,fullscreenRequests=0,audioStarts=0,audioResumes=0;const frames=[],storage={},elements={},audioVoices=[];
  const audioParam=()=>({value:0,setValueAtTime(value){this.value=value;},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}});
  const audioNode=()=>({gain:audioParam(),frequency:audioParam(),Q:audioParam(),pan:audioParam(),playbackRate:audioParam(),connect(){},disconnect(){},start(time){this.startedAt=time;audioVoices.push(this);audioStarts++;},stop(time){this.stoppedAt=time;}});
  class GestureAudio{
    constructor(){this.sampleRate=44100;this.state='suspended';this.destination=audioNode();}
    get currentTime(){return clock/1000;}
    resume(){audioResumes++;this.state='running';return Promise.resolve();}
    createGain(){return audioNode();}
    createBuffer(channels,length,sampleRate){const samples=new Float32Array(length);return {samples,length,sampleRate,duration:length/sampleRate,getChannelData:()=>samples};}
    createBufferSource(){return audioNode();}
    createBiquadFilter(){return audioNode();}
    createStereoPanner(){return audioNode();}
  }
  const context=()=>new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},{get:(target,key)=>key==='roundRect'&&compatibility.noRoundRect?undefined:target[key]||(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
  class Element{
    constructor(id){this.id=id;this.listeners={};this.attributes={};this.classes=new Set();this.hidden=false;this.inert=false;this.textContent='';this.innerHTML='';this.ctx=context();this.children=[];this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,b)=>b?this.classes.add(x):this.classes.delete(x)};}
    getContext(){return this.ctx}
    getBoundingClientRect(){return {left:0,top:0,width,height}}
    addEventListener(type,fn){(this.listeners[type]||=[]).push(fn)}
    emit(type,event={}){for(const fn of this.listeners[type]||[])fn(event)}
    setAttribute(k,v){this.attributes[k]=v}
    appendChild(child){this.children.push(child)}
    querySelector(){return new Element('icon')}
    setPointerCapture(){if(compatibility.captureFailure)throw new Error('No active pointer available');}
    focus(){document.activeElement=this}
  }
  const ids=[...fs.readFileSync(path.join(base,'index.html'),'utf8').matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  ids.forEach(id=>elements[id]=new Element(id));
  elements.gameScreen.inert=true;elements.gameScreen.setAttribute('aria-hidden','true');
  const document=new Element('document');
  document.getElementById=id=>{assert(elements[id],`missing HTML id: ${id}`);return elements[id]};
  document.createElement=()=>new Element('created');
  document.createTextNode=text=>({textContent:text});
  document.documentElement={};document.fullscreenElement=null;
  if(fullscreenSupported)document.documentElement.requestFullscreen=()=>{fullscreenRequests++;document.fullscreenElement=document.documentElement;document.emit('fullscreenchange');return Promise.resolve()};
  document.exitFullscreen=()=>{document.fullscreenElement=null;document.emit('fullscreenchange');return Promise.resolve()};
  class LocalImage extends NativeImage{set src(value){super.src=path.join(base,value)}}
  const gameEvents=[];let registrationReady=true;
  const sandbox={document,window:{devicePixelRatio:2,AudioContext:GestureAudio,addEventListener(){},BIOFRESH_REGISTRATION:{require:()=>registrationReady,isReady:()=>registrationReady,startRun:()=>{gameEvents.push({type:'start'});return true;},complete:metrics=>gameEvents.push({type:'complete',metrics}),abandon:metrics=>gameEvents.push({type:'abandon',metrics})}},Image:LocalImage,Path2D,atob:value=>Buffer.from(value,'base64').toString('binary'),localStorage:{getItem:k=>storage[k],setItem:(k,v)=>storage[k]=v},ResizeObserver:class{observe(){}},performance:{now:()=>clock},requestAnimationFrame:fn=>frames.push(fn),console};
  vm.runInNewContext(fs.readFileSync(path.join(base,'photos.js'),'utf8'),sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(base,'sounds.js'),'utf8'),sandbox);
  vm.runInNewContext(source,sandbox);
  const debug=sandbox.__debug;
  const isRecordedWhip=voice=>debug.whipAudioBuffers.includes(voice.buffer);
  const isSparkleVoice=voice=>voice.buffer===debug.bagSparkleBuffer;
  const countWhips=(voices=audioVoices)=>voices.filter(isRecordedWhip).length+voices.filter(voice=>voice.buffer.sampleRate===44100&&!isSparkleVoice(voice)).length/2;
  assert.strictEqual(await debug.loadIngredientPhotos(),true);
  assert.strictEqual(debug.photoCount,9);
  assert.strictEqual(elements.heroPlay.disabled,false);
  assert.strictEqual(elements.photoCredits.children.length,9);
  assert.strictEqual(debug.state,'ready');
  assert.strictEqual(elements.ingredientGrid.children.length,9);
  assert.strictEqual(elements.entryPanel.hidden,false);
  assert.strictEqual(elements.tutorialPanel1.hidden,false);
  assert.strictEqual(elements.tutorialPanel2.hidden,true);
  assert.strictEqual(elements.tutorialPanel3.hidden,true);
  assert.strictEqual(elements.heroPlay.hidden,true);
  assert.strictEqual(elements.entryBack.disabled,true);
  elements.heroPlay.emit('click');assert.strictEqual(debug.state,'ready');
  elements.entryNext.emit('click');
  assert.strictEqual(elements.tutorialPanel1.hidden,true);
  assert.strictEqual(elements.tutorialPanel2.hidden,false);
  assert.strictEqual(elements.tutorialStatus.textContent,'Paso 2 de 3');
  assert.strictEqual(document.activeElement,elements.tutorialHeading2);
  elements.entryBack.emit('click');assert.strictEqual(elements.tutorialPanel1.hidden,false);
  elements.tutorialStep3.emit('click');
  assert.strictEqual(elements.tutorialPanel3.hidden,false);
  assert.strictEqual(elements.heroPlay.hidden,false);
  assert.strictEqual(elements.entryNext.hidden,true);
  assert.strictEqual(elements.tutorialStep3.attributes['aria-current'],'step');
  assert.strictEqual(elements.tutorialStep1.attributes['aria-current'],'false');
  registrationReady=false;elements.heroPlay.emit('click');
  assert.strictEqual(debug.state,'ready','El juego debe exigir un participante registrado');
  registrationReady=true;
  elements.heroPlay.emit('click');
  assert.strictEqual(debug.state,'playing');
  assert.strictEqual(elements.entryPanel.hidden,true);
  assert.strictEqual(elements.gameScreen.inert,false);
  assert.strictEqual(elements.gameScreen.attributes['aria-hidden'],'false');
  assert.strictEqual(elements.gameCanvas.width,width*2);
  assert.strictEqual(elements.gameCanvas.height,height*2);
  assert.strictEqual(fullscreenRequests,fullscreenSupported?1:0);
  assert.strictEqual(audioResumes,1,'Jugar debe habilitar el audio mediante el gesto del usuario');
  assert.strictEqual(elements.soundButton.attributes['aria-label'],'Silenciar sonido');
  const pointer=(x,y)=>({pointerId:1,clientX:x,clientY:y,preventDefault(){}});
  elements.gameCanvas.emit('pointermove',pointer(45,70));assert.strictEqual(audioStarts,0,'Mover sin arrastrar no debe sonar');
  elements.gameCanvas.emit('pointerdown',pointer(20,70));assert.strictEqual(audioStarts,0,'Un toque al aire no es un corte');
  clock+=20;elements.gameCanvas.emit('pointermove',pointer(55,70));
  assert.strictEqual(countWhips(),1,'Cortar el aire debe reproducir un látigo');
  assert.strictEqual(debug.score,0,'El látigo también debe sonar sin acertar a un ingrediente');
  clock+=10;elements.gameCanvas.emit('pointermove',pointer(110,70));assert.strictEqual(countWhips(),1,'El sonido no debe repetirse por cada evento de movimiento');
  clock+=180;frames.shift()(clock);
  elements.gameCanvas.emit('pointermove',pointer(170,70));assert.strictEqual(countWhips(),1,'Un trazo recto no debe repetir el sonido al pasar el tiempo');
  clock+=900;frames.shift()(clock);
  elements.gameCanvas.emit('pointermove',pointer(220,70));assert.strictEqual(countWhips(),1,'El trazo debe seguir siendo uno aunque la estela visual desaparezca');
  clock+=20;elements.gameCanvas.emit('pointermove',pointer(220,110));assert.strictEqual(countWhips(),2,'Un giro de 90 grados debe disparar un sonido nuevo');
  clock+=20;elements.gameCanvas.emit('pointermove',pointer(220,160));assert.strictEqual(countWhips(),2,'Continuar después del giro no debe repetir');
  clock+=20;elements.gameCanvas.emit('pointermove',pointer(180,160));assert.strictEqual(countWhips(),3);
  clock+=20;elements.gameCanvas.emit('pointermove',pointer(120,160));assert.strictEqual(countWhips(),3);
  clock+=20;elements.gameCanvas.emit('pointermove',pointer(120,120));assert.strictEqual(countWhips(),4);
  for(let i=0;i<4;i++){
    clock+=10;elements.gameCanvas.emit('pointermove',pointer(120,123));
    clock+=10;elements.gameCanvas.emit('pointermove',pointer(120,119));
  }
  assert.strictEqual(countWhips(),4,'Las pequeñas oscilaciones no deben sonar como trazos nuevos');
  const voiceVariant=voice=>{
    const duration=voice.stoppedAt-voice.startedAt-.008;
    return [.26,.18,.29,.215].reduce((nearest,value,i,array)=>Math.abs(duration-value)<Math.abs(duration-array[nearest])?i:nearest,0);
  };
  const chosenWhips=()=>{
    let syntheticBody=true;const variants=[];
    for(const voice of audioVoices){
      if(isRecordedWhip(voice))variants.push(4+debug.whipAudioBuffers.indexOf(voice.buffer));
      else if(voice.buffer.sampleRate===44100&&!isSparkleVoice(voice)){if(syntheticBody)variants.push(voiceVariant(voice));syntheticBody=!syntheticBody;}
    }
    return variants;
  };
  elements.gameCanvas.emit('pointerup');
  elements.gameCanvas.emit('pointerdown',pointer(20,70));clock+=20;elements.gameCanvas.emit('pointermove',pointer(60,70));
  assert.strictEqual(countWhips(),5,'Soltar y empezar otro trazo debe producir un sonido nuevo');
  const variantCount=4+debug.whipAudioBuffers.length;
  for(let i=countWhips();i<variantCount;i++){
    elements.gameCanvas.emit('pointerup');elements.gameCanvas.emit('pointerdown',pointer(20,70));
    clock+=20;elements.gameCanvas.emit('pointermove',pointer(60,70));
  }
  assert.strictEqual(new Set(chosenWhips()).size,variantCount,'Una ronda de selección debe incluir todas las variantes antes de repetir');
  assert.strictEqual(debug.whipAudioBuffers.length,3,'Los tres latigazos aportados deben estar cargados');
  for(const [clip,buffer] of debug.whipAudioBuffers.entries()){
    const uploadedVoice=audioVoices.find(voice=>voice.buffer===buffer);
    assert(uploadedVoice,'Cada video debe participar de la mezcla');
    const uploadedPcm=Buffer.alloc(buffer.samples.length*2);
    buffer.samples.forEach((sample,i)=>uploadedPcm.writeInt16LE(Math.round(sample*32768),i*2));
    assert(uploadedPcm.equals(Buffer.from(sandbox.window.BIOFRESH_WHIP_SOUNDS.clips[clip],'base64')),'La variante debe usar el audio extraído de su video');
  }
  elements.gameCanvas.emit('pointerup');
  const beforeSecondFinger=audioStarts;
  elements.gameCanvas.emit('pointerdown',pointer(20,70));
  elements.gameCanvas.emit('pointerdown',{...pointer(25,70),pointerId:2,isPrimary:false});
  elements.gameCanvas.emit('pointermove',{...pointer(200,70),pointerId:2});
  elements.gameCanvas.emit('pointerup',{pointerId:2});
  assert.strictEqual(audioStarts,beforeSecondFinger,'Un segundo dedo no debe generar cortes ni sonidos');
  clock+=20;elements.gameCanvas.emit('pointermove',pointer(60,70));
  assert(audioStarts>beforeSecondFinger,'Levantar otro dedo no debe cancelar el corte principal');
  elements.gameCanvas.emit('pointerup',{pointerId:1});
  elements.soundButton.emit('click');assert.strictEqual(elements.soundButton.attributes['aria-label'],'Activar sonido');
  const mutedStarts=audioStarts;
  elements.gameCanvas.emit('pointerdown',pointer(20,70));clock+=20;elements.gameCanvas.emit('pointermove',pointer(80,70));elements.gameCanvas.emit('pointerup');
  assert.strictEqual(audioStarts,mutedStarts,'Silenciar debe detener el sonido de cortes al aire');
  const mutedWhips=countWhips();
  elements.soundButton.emit('click');assert.strictEqual(countWhips(),mutedWhips+1,'Activar sonido debe permitir escuchar el efecto');
  const beforeFruit=countWhips();
  debug.spawn();const target=debug.objects[0];target.x=width/2;target.y=height/2;
  elements.gameCanvas.emit('pointerdown',{pointerId:1,clientX:target.x,clientY:target.y,preventDefault(){}});
  clock+=20;elements.gameCanvas.emit('pointermove',pointer(target.x+35,target.y));
  elements.gameCanvas.emit('pointerup');assert.strictEqual(debug.score,10);
  assert.strictEqual(countWhips(),beforeFruit+1,'Acertar debe producir un único látigo');
  assert.strictEqual(audioVoices.filter(voice=>voice.buffer.sampleRate===22050&&!isRecordedWhip(voice)).length,1,'Acertar debe reproducir también el alimento');
  const selectedVariants=chosenWhips();
  for(let i=1;i<selectedVariants.length;i++)assert.notStrictEqual(selectedVariants[i],selectedVariants[i-1],'No debe repetirse la misma variante dos veces seguidas');
  assert(debug.particles.length>0,'El corte debe lanzar gotas de jugo');
  assert(debug.splashes.length>0,'El corte debe dejar una marca en la pared');
  const initialSplashLife=debug.splashes[0].life;
  elements.pauseButton.emit('click');assert.strictEqual(debug.state,'paused');assert.strictEqual(elements.overlay.inert,false);
  const pausedStarts=audioStarts;
  elements.gameCanvas.emit('pointerdown',pointer(20,70));clock+=20;elements.gameCanvas.emit('pointermove',pointer(80,70));
  assert.strictEqual(audioStarts,pausedStarts,'El juego pausado no debe producir látigos');
  debug.update(.4);assert.strictEqual(debug.splashes[0].life,initialSplashLife,'La pausa debe detener los efectos');
  elements.overlayButton.emit('click');assert.strictEqual(debug.state,'playing');assert.strictEqual(elements.overlay.inert,true);
  for(let i=0;i<6;i++){debug.objects.length=0;debug.update(.2);}
  assert.strictEqual(debug.particles.length,0,'Las gotas deben desaparecer antes que la marca');
  assert(debug.splashes.length>0&&debug.splashes[0].life<initialSplashLife,'La marca debe desvanecerse gradualmente');
  for(let i=0;i<24;i++){debug.objects.length=0;debug.update(.2);}
  assert.strictEqual(debug.splashes.length,0,'La marca debe desaparecer por completo');
  debug.finishGame();assert.strictEqual(debug.state,'gameover');assert.strictEqual(storage['biofresh-fresh-slice-best'],'10');
  const firstCompleted=gameEvents.find(event=>event.type==='complete');
  assert(firstCompleted&&firstCompleted.metrics.score===10&&firstCompleted.metrics.ingredientsCut===1,'La central debe recibir los resultados reales de la ronda');
  elements.overlayMenu.emit('click');assert.strictEqual(debug.state,'ready');assert.strictEqual(elements.entryPanel.hidden,false);assert.strictEqual(elements.entryBest.textContent,'010');assert.strictEqual(elements.gameScreen.inert,true);
  assert.strictEqual(elements.tutorialPanel1.hidden,false);
  assert.strictEqual(elements.heroPlay.hidden,true);
  assert.strictEqual(document.activeElement,elements.entryNext);
  const keyboardStep={code:'Space',target:{closest(){return false}},preventDefault(){}};
  document.emit('keydown',keyboardStep);assert.strictEqual(debug.state,'ready');assert.strictEqual(elements.tutorialPanel2.hidden,false);
  document.emit('keydown',keyboardStep);assert.strictEqual(debug.state,'ready');assert.strictEqual(elements.tutorialPanel3.hidden,false);
  elements.heroPlay.emit('click');assert.strictEqual(debug.score,0);assert.strictEqual(debug.particles.length,0);assert.strictEqual(debug.splashes.length,0);
  const foodBank=sandbox.window.BIOFRESH_SOUNDS,heardBuffers=new Set();
  for(const id of ['apple','papaya','pineapple','carrot','beet','chicken','salmon','fish','pork']){
    debug.objects.length=0;debug.spawn();
    const food=debug.objects[0];food.id=id;food.x=width/2;food.y=height/2;
    const before=audioVoices.length;
    elements.gameCanvas.emit('pointerdown',pointer(food.x,food.y));
    clock+=20;elements.gameCanvas.emit('pointermove',pointer(food.x+4,food.y));elements.gameCanvas.emit('pointerup');
    const voices=audioVoices.slice(before),cues=voices.filter(voice=>voice.buffer.sampleRate===22050&&!isRecordedWhip(voice));
    assert.strictEqual(cues.length,1,`Debe sonar una sola vez el ingrediente ${id}`);
    assert.strictEqual(countWhips(voices),1,'El látigo debe conservar un único efecto por trazo');
    const samples=cues[0].buffer.samples,pcm=Buffer.alloc(samples.length*2);
    for(let i=0;i<samples.length;i++)pcm.writeInt16LE(Math.round(samples[i]*32768),i*2);
    assert(foodBank.clips[id].some(encoded=>Buffer.from(encoded,'base64').equals(pcm)),`El sonido debe corresponder a ${id}`);
    assert(samples.some(value=>Math.abs(value)>.05),'La grabación debe contener audio audible');
    heardBuffers.add(cues[0].buffer);
    assert.strictEqual(debug.combo,heardBuffers.size,'La racha debe contar los cortes seguidos');
    const currentLabel=debug.labels[debug.labels.length-1];
    assert.strictEqual(currentLabel.points,10+Math.min(heardBuffers.size-1,4)*5);
    if(heardBuffers.size>1){
      assert(debug.comboPulse>0,'Una racha debe animar brevemente el cartel');
      assert.strictEqual(currentLabel.level,Math.min(heardBuffers.size,5));
    }
  }
  assert.strictEqual(heardBuffers.size,9,'Los nueve ingredientes deben tener grabaciones distintas');
  assert.strictEqual(debug.score,220,'La nueva presentación debe conservar los puntos de las rachas');
  assert(elements.combo.textContent.includes('9 cortes'),'La racha visual debe tener una descripción accesible');
  frames.shift()(clock);
  debug.update(.08);const streakPulse=debug.comboPulse,streakRemaining=debug.remaining;
  elements.pauseButton.emit('click');debug.update(.3);
  assert.strictEqual(debug.combo,9);assert.strictEqual(debug.comboPulse,streakPulse,'La pausa debe detener también el rebote del cartel');assert.strictEqual(debug.remaining,streakRemaining);
  elements.overlayButton.emit('click');
  for(let i=0;i<7;i++){debug.objects.length=0;debug.update(.12);}
  assert.strictEqual(debug.combo,0,'La racha debe terminar al agotarse su tiempo');
  assert.strictEqual(debug.comboPulse,0);assert.strictEqual(elements.combo.textContent,'');
  elements.soundButton.emit('click');
  const beforeMutedFood=audioStarts;
  debug.objects.length=0;debug.spawn();const mutedFood=debug.objects[0];mutedFood.x=width/2;mutedFood.y=height/2;
  elements.gameCanvas.emit('pointerdown',pointer(mutedFood.x,mutedFood.y));elements.gameCanvas.emit('pointerup');
  assert.strictEqual(debug.combo,1,'El siguiente corte debe comenzar una racha nueva');
  assert.strictEqual(audioStarts,beforeMutedFood,'Silenciar debe apagar los sonidos de alimentos y el látigo');
  elements.soundButton.emit('click');
  for(let i=0;i<5;i++)debug.spawn();
  debug.objects.forEach(o=>{o.y=height+o.r+100;o.vy=100;o.seen=true});
  debug.update(.016);assert.strictEqual(debug.lives,0);assert.strictEqual(debug.state,'gameover');
  for(let i=0;i<4;i++){clock+=16;frames.shift()(clock)}
  if(fullscreenSupported){elements.fullscreenButton.emit('click');assert.strictEqual(document.fullscreenElement,null)}
  console.log(`OK ${width}×${height}: cartel de racha con rebote breve, niveles y puntos correctos, pausa y vencimiento, nueve sonidos, látigo, tutorial y jugo${fullscreenSupported?' con Fullscreen API':' con ajuste al viewport'}`);
}
(async()=>{await environment(1440,900);await environment(390,844,false);await environment(375,667,false,{noRoundRect:true,captureFailure:true})})().catch(error=>{console.error(error);process.exitCode=1});
