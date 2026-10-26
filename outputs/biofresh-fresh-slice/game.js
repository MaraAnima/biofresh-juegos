(() => {
  'use strict';

  const INGREDIENTS = [
    { id: 'apple', name: 'Manzana', category: 'Fruta', color: '#dd4b51' },
    { id: 'papaya', name: 'Papaya', category: 'Fruta', color: '#f3923d' },
    { id: 'pineapple', name: 'Piña', category: 'Fruta', color: '#efbb42' },
    { id: 'carrot', name: 'Zanahoria', category: 'Verdura', color: '#ec7735' },
    { id: 'beet', name: 'Remolacha', category: 'Verdura', color: '#a43860' },
    { id: 'chicken', name: 'Pollo', category: 'Carne', color: '#e9ab91' },
    { id: 'salmon', name: 'Salmón', category: 'Pescado', color: '#ed8c79' },
    { id: 'fish', name: 'Pescado blanco', category: 'Pescado', color: '#90afaa' },
    { id: 'pork', name: 'Lomo', category: 'Carne', color: '#e3a2a0' }
  ];
  const JUICE_COLORS={apple:'#e6b858',papaya:'#f29b42',pineapple:'#e5c43f',carrot:'#e58230',beet:'#ad4775',chicken:'#e7b782',salmon:'#ed9b76',fish:'#a8c6bb',pork:'#dfb097'};
  const COMBO_WINDOW=.9;
  const BAG_BONUS_SECONDS=4;
  const BAG_FOCUS_SECONDS=.8;
  const BAG_HIT_POINTS=5;
  const BAG_SLOW_MOTION=.18;
  const ROUND_SECONDS=35;
  const GROUP_BAG_BUFFER=3;
  const STREAK_ORANGE='#e58a31';
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const arena = document.getElementById('arena');
  const overlay = document.getElementById('overlay');
  const celebration = document.getElementById('celebration');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const comboEl = document.getElementById('combo');
  const livesEl = document.getElementById('lives');
  const bestEl = document.getElementById('best');
  const soundButton = document.getElementById('soundButton');
  const pauseButton = document.getElementById('pauseButton');
  const overlayButton = document.getElementById('overlayButton');
  const entryPanel = document.getElementById('entryPanel');
  const gameScreen = document.getElementById('gameScreen');
  const entryBest = document.getElementById('entryBest');
  const playButton = document.getElementById('heroPlay');
  const fullscreenButton = document.getElementById('fullscreenButton');
  const nextButton = document.getElementById('entryNext');
  const backButton = document.getElementById('entryBack');
  const tutorialPanels = [1,2,3].map(n=>document.getElementById('tutorialPanel'+n));
  const tutorialSteps = [1,2,3].map(n=>document.getElementById('tutorialStep'+n));
  let tutorialStep = 0;
  let width = 0, height = 0, dpr = 1;
  let state = 'ready', score = 0, lives = 3, remaining = ROUND_SECONDS, combo = 0;
  let best = 0, spawnClock = 0, elapsed = 0, lastSlice = -10;
  let roundDuration=0,ingredientsCut=0,maxCombo=0,bonusCuts=0;
  let nextGroupAt=Infinity,groupsBlockedUntil=0;
  let objects = [], fragments = [], particles = [], splashes = [], labels = [], trail = [];
  let specialBag=null,bagBonus=null,bagSpawnAt=Infinity,bagSparks=[],bagBurst=null,visualTime=0;
  let comboPulse=0;
  let pointerActive = false, activePointerId = null, lastFrame = performance.now(), soundOn = true, audioContext = null;
  const WHIP_VARIANTS=[
    {duration:.26,peak:.4,low:450,high:3300,tail:850,q:.55,rate:.9,body:.55,crack:.14,snap:1900,texture:0},
    {duration:.18,peak:.35,low:950,high:6200,tail:2000,q:.9,rate:1.25,body:.44,crack:.34,snap:3400,texture:0},
    {duration:.29,peak:.38,low:300,high:2200,tail:550,q:.65,rate:.78,body:.62,crack:.2,snap:1400,texture:1},
    {duration:.215,peak:.52,low:1100,high:5000,tail:900,q:1.1,rate:1.05,body:.48,crack:.27,snap:2700,texture:2},
    ...(window.BIOFRESH_WHIP_SOUNDS?.clips||[]).map((_,clip)=>({clip}))
  ];
  let audioOutput=null,whipNoises=[],whipBag=[],lastWhipVariant=-1,lastPointer=null;
  const foodAudioBuffers=new Map(),lastFoodVariant=new Map();
  let whipAudioBuffers=[];
  let bagSparkleBuffer=null;
  let clockTickBuffers=[];
  let roundEndBuffers=null,roundEndSource=null;
  let swipeHasSound=false,swipeDirection=null,swipeVector={x:0,y:0},turnVector=null;
  let bag = [];

  function setTutorialStep(index,focus=true){
    tutorialStep=Math.max(0,Math.min(tutorialPanels.length-1,index));
    tutorialPanels.forEach((panel,i)=>{panel.hidden=i!==tutorialStep;});
    tutorialSteps.forEach((button,i)=>{
      button.classList.toggle('is-current',i===tutorialStep);
      button.classList.toggle('is-complete',i<tutorialStep);
      button.setAttribute('aria-current',i===tutorialStep?'step':'false');
    });
    backButton.disabled=tutorialStep===0;
    nextButton.hidden=tutorialStep===tutorialPanels.length-1;
    playButton.hidden=tutorialStep!==tutorialPanels.length-1;
    document.getElementById('tutorialStatus').textContent=`Paso ${tutorialStep+1} de ${tutorialPanels.length}`;
    entryPanel.scrollTop=0;
    if(focus)document.getElementById('tutorialHeading'+(tutorialStep+1)).focus({preventScroll:true});
  }
  nextButton.addEventListener('click',()=>setTutorialStep(tutorialStep+1));
  backButton.addEventListener('click',()=>setTutorialStep(tutorialStep-1));
  tutorialSteps.forEach((button,i)=>button.addEventListener('click',()=>setTutorialStep(i)));
  setTutorialStep(0,false);

  try { best = Number(localStorage.getItem('biofresh-fresh-slice-best')) || 0; } catch (_) {}
  bestEl.textContent = String(best).padStart(3, '0');
  entryBest.textContent = String(best).padStart(3, '0');

  function resizeCanvas() {
    const rect = arena.getBoundingClientRect();
    if (width && height && rect.width && rect.height) {
      for (const collection of [objects, fragments, particles, splashes, labels]) {
        for (const item of collection) { item.x *= rect.width / width; item.y *= rect.height / height; }
      }
      if(specialBag){specialBag.x*=rect.width/width;specialBag.y*=rect.height/height;specialBag.h*=rect.height/height;}
      if(bagBonus){bagBonus.startX*=rect.width/width;bagBonus.startY*=rect.height/height;bagBonus.startH*=rect.height/height;bagBonus.driftX*=rect.width/width;bagBonus.driftY*=rect.height/height;}
      for(const spark of bagSparks){spark.x*=rect.width/width;spark.y*=rect.height/height;spark.x0*=rect.width/width;spark.y0*=rect.height/height;spark.dx*=rect.width/width;spark.dy*=rect.height/height;}
      if(bagBurst){bagBurst.x*=rect.width/width;bagBurst.y*=rect.height/height;bagBurst.h*=rect.height/height;}
    }
    width = rect.width; height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(resizeCanvas).observe(arena);
  resizeCanvas();

  const PHOTO_SPECS=window.BIOFRESH_PHOTOS;
  const BAG_SPECS=window.BIOFRESH_BAGS||[];
  const photoSprites=new Map();
  const bagSprites=new Map();
  const bagAuraSprites=new Map();
  const cardCanvases=new Map();
  let photosReady=false, photosLoading=null;

  function drawIngredient(c,id,x,y,scale=1,rotation=0,shadow=true){
    const sprite=photoSprites.get(id);
    if(!sprite)return;
    const fit=108/Math.max(sprite.width,sprite.height);
    c.save();c.translate(x,y);c.rotate(rotation);c.scale(scale,scale);
    if(shadow){c.shadowColor='#33333318';c.shadowBlur=6;c.shadowOffsetY=4;}
    c.drawImage(sprite,-sprite.width*fit/2,-sprite.height*fit/2,sprite.width*fit,sprite.height*fit);
    c.restore();
  }
  function makePhotoSprite(photo,spec){
    const [x,y,w,h]=spec.box;
    const sprite=document.createElement('canvas');
    sprite.width=Math.ceil(w+12);sprite.height=Math.ceil(h+12);
    const sc=sprite.getContext('2d');
    sc.translate(6-x,6-y);
    if(spec.mask)sc.clip(new Path2D(spec.mask));
    sc.drawImage(photo,0,0);
    return sprite;
  }
  function makeBagSprite(photo,spec){
    const [x,y,w,h]=spec.box;
    const sprite=document.createElement('canvas');
    sprite.width=w;sprite.height=h;
    const sc=sprite.getContext('2d');
    sc.translate(-x,-y);
    sc.clip(new Path2D(spec.mask));
    sc.drawImage(photo,0,0,spec.design[0],spec.design[1]);
    return sprite;
  }
  function makeBagAura(spec){
    // Bake the gradients before rotation so the halo always shares the bag's pose.
    const aura=document.createElement('canvas');aura.width=640;aura.height=640;
    const c=aura.getContext('2d'),h=320,w=h*spec.box[2]/spec.box[3];
    c.translate(320,320);
    for(const patch of [[-.19,-.16,.88,.43],[.24,.08,.65,.57],[-.13,.29,.76,.34]]){
      c.save();c.translate(patch[0]*w,patch[1]*h);c.scale(patch[2]*w,patch[3]*h);
      const glow=c.createRadialGradient(0,0,.04,0,0,1);
      glow.addColorStop(0,spec.color+'50');glow.addColorStop(.45,spec.color+'20');glow.addColorStop(1,spec.color+'00');
      c.fillStyle=glow;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.restore();
    }
    return aura;
  }
  function loadIngredientPhotos(){
    if(photosLoading)return photosLoading;
    playButton.disabled=true;playButton.textContent='Cargando fotos…';
    photosLoading=Promise.all([...INGREDIENTS.map(item=>new Promise((resolve,reject)=>{
      const photo=new Image();
      photo.onload=()=>{
        try{
          photoSprites.set(item.id,makePhotoSprite(photo,PHOTO_SPECS[item.id]));
          const cardContext=cardCanvases.get(item.id).getContext('2d');
          cardContext.clearRect(0,0,220,220);
          drawIngredient(cardContext,item.id,110,110,1.7,0,false);
          resolve();
        }catch(error){reject(error)}
      };
      photo.onerror=()=>reject(new Error('No se pudo cargar '+item.name));
      photo.src=PHOTO_SPECS[item.id].src;
    })),...BAG_SPECS.map(spec=>new Promise((resolve,reject)=>{
      const photo=new Image();
      photo.onload=()=>{try{bagSprites.set(spec.id,makeBagSprite(photo,spec));bagAuraSprites.set(spec.id,makeBagAura(spec));resolve();}catch(error){reject(error)}};
      photo.onerror=()=>reject(new Error('No se pudo cargar una bolsa Biofresh'));
      photo.src=spec.src;
    }))]).then(()=>{
      [['tutorialFruit1','apple',-.1],['tutorialFruit2','carrot',0],['tutorialFruit3','pineapple',.08]].forEach(([elementId,id,rotation])=>{
        const demoContext=document.getElementById(elementId).getContext('2d');
        demoContext.clearRect(0,0,220,220);
        drawIngredient(demoContext,id,110,110,1.7,rotation,false);
      });
      photosReady=true;playButton.disabled=false;
      playButton.innerHTML='Jugar ahora <span aria-hidden="true">↗</span>';
      document.getElementById('photoStatus').hidden=true;
      return true;
    }).catch(()=>{
      photosReady=false;photosLoading=null;playButton.disabled=false;
      playButton.textContent='Reintentar carga';
      const status=document.getElementById('photoStatus');
      status.textContent='No se pudieron cargar las fotos. Tocá para intentar otra vez.';status.hidden=false;
      return false;
    });
    return photosLoading;
  }
  const grid=document.getElementById('ingredientGrid');
  const creditsList=document.getElementById('photoCredits');
  INGREDIENTS.forEach(item=>{
    const card=document.createElement('div');card.className='ingredient-card';
    card.innerHTML=`<canvas class="ingredient-icon" width="220" height="220" aria-hidden="true"></canvas><div class="ingredient-text"><strong>${item.name}</strong><small>${item.category}</small></div>`;
    grid.appendChild(card);cardCanvases.set(item.id,card.querySelector('canvas'));
    const credit=PHOTO_SPECS[item.id].credit;
    const li=document.createElement('li');
    const sourceLink=document.createElement('a');sourceLink.href=credit.page;sourceLink.textContent=item.name+' — '+credit.author;sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';
    li.appendChild(sourceLink);li.appendChild(document.createTextNode(' · '));
    if(credit.licenseUrl){const licenseLink=document.createElement('a');licenseLink.href=credit.licenseUrl;licenseLink.textContent=credit.license;licenseLink.target='_blank';licenseLink.rel='noopener noreferrer';li.appendChild(licenseLink);}
    else li.appendChild(document.createTextNode(credit.license));
    creditsList.appendChild(li);
  });
  loadIngredientPhotos();

  function updateUI() {
    scoreEl.textContent=String(score).padStart(3,'0');
    timeEl.innerHTML=`${Math.ceil(remaining)}<span class="unit">s</span>`;
    const streakText=combo>1?`Racha de ${combo} cortes. +${10+Math.min(combo-1,4)*5} puntos por corte.`:'';
    if(comboEl.textContent!==streakText)comboEl.textContent=streakText;
    livesEl.textContent='♥ '.repeat(lives).trim() + (lives<3?'  ♡'.repeat(3-lives):'');
    livesEl.setAttribute('aria-label',`${lives} ${lives===1?'vida':'vidas'}`);
  }
  updateUI();

  function showOverlay(kind) {
    const kicker=document.getElementById('overlayKicker'), title=document.getElementById('overlayTitle'), body=document.getElementById('overlayText');
    document.getElementById('resultStats').hidden=kind!=='gameover';
    if(kind==='paused') { kicker.textContent='UN RESPIRO NATURAL';title.textContent='En pausa.';body.textContent='Cuando quieras, seguí cortando ingredientes frescos.';overlayButton.innerHTML='Continuar <span aria-hidden="true">↗</span>'; }
    else if(kind==='gameover') {
      const completed=remaining<=0;
      kicker.textContent=completed?'RONDA COMPLETADA':'RONDA TERMINADA';
      title.textContent=(completed||(score>=best&&score>0))?'¡Qué frescura!':'Buen intento.';
      body.textContent=completed?`Lograste terminar la ronda. Sumaste ${score} puntos.`:`Sumaste ${score} puntos. ¿Podés superar tu mejor marca?`;
      document.getElementById('resultIngredients').textContent=String(ingredientsCut);
      document.getElementById('resultStreak').textContent=String(maxCombo);
      document.getElementById('resultStreakUnit').textContent=maxCombo===1?'corte seguido':'cortes seguidos';
      overlayButton.innerHTML='Jugar otra vez <span aria-hidden="true">↗</span>';
    }
    else { kicker.textContent='LISTOS, FRESCOS... ¡YA!';title.textContent='Cortá la frescura.';body.textContent='Arrastrá el mouse o deslizá el dedo sobre los ingredientes que vuelan.';overlayButton.innerHTML='Empezar a jugar <span aria-hidden="true">↗</span>'; }
    bestEl.textContent=String(best).padStart(3,'0');
    overlay.classList.remove('hidden');
    overlay.inert=false;
    overlay.setAttribute('aria-hidden','false');
    overlayButton.focus({preventScroll:true});
  }
  function hideOverlay(){overlay.classList.add('hidden');overlay.inert=true;overlay.setAttribute('aria-hidden','true')}
  function celebrate(){
    celebration.innerHTML='';
    if(reducedMotion)return;
    // El rosa original y matices rosa palo, con una caída ligera de papel.
    const colors=['#d7a5b7','#e6c2cf','#f9e9ee','#c992a7'];
    const count=width<600?58:96;
    for(let i=0;i<count;i++){
      const piece=document.createElement('i');
      piece.setAttribute('style',`left:${rand(0,100)}%;width:${rand(5,9)}px;height:${rand(9,15)}px;background:${colors[i%colors.length]};border-radius:${i%4===0?'50% 20%':'1px'};--drift:${rand(-110,110)}px;--spin:${rand(280,650)*(i%2?1:-1)}deg;--tilt:${rand(-80,80)}deg;animation-duration:${rand(3.8,5.1)}s;animation-delay:${rand(0,.85)}s;`);
      piece.addEventListener('animationend',()=>piece.remove(),{once:true});
      celebration.appendChild(piece);
    }
  }
  function requestGameFullscreen(){
    if(!document.fullscreenElement&&document.documentElement.requestFullscreen){
      try{Promise.resolve(document.documentElement.requestFullscreen({navigationUI:'hide'})).catch(()=>{});}catch(_){}
    }
  }
  function startGame() {
    if(!window.BIOFRESH_REGISTRATION?.require())return;
    if(!photosReady){loadIngredientPhotos();return;}
    if(!window.BIOFRESH_REGISTRATION.startRun())return;
    stopRoundEndSound();
    celebration.innerHTML='';
    if(soundOn)getAudioContext();
    state='playing';score=0;lives=3;remaining=ROUND_SECONDS;combo=0;spawnClock=.42;elapsed=0;lastSlice=-10;
    roundDuration=0;ingredientsCut=0;maxCombo=0;bonusCuts=0;
    objects=[];fragments=[];particles=[];splashes=[];labels=[];trail=[];comboPulse=0;bag=[];
    specialBag=null;bagBonus=null;bagSparks=[];bagBurst=null;visualTime=0;
    // Show the surprise early enough to be testable in every round.
    bagSpawnAt=BAG_SPECS.length?rand(2,4):Infinity;
    nextGroupAt=rand(9,13);groupsBlockedUntil=0;
    pointerActive=false;lastFrame=performance.now();
    entryPanel.hidden=true;
    gameScreen.inert=false;gameScreen.setAttribute('aria-hidden','false');
    pauseButton.disabled=false;pauseButton.setAttribute('aria-label','Pausar juego');pauseButton.title='Pausar juego';
    updateUI();hideOverlay();
    requestGameFullscreen();
    resizeCanvas();
    pauseButton.focus({preventScroll:true});
  }
  function returnToMenu(){
    stopRoundEndSound();
    celebration.innerHTML='';
    if(state==='playing'||state==='paused')window.BIOFRESH_REGISTRATION?.abandon(roundMetrics('menu'));
    state='ready';pointerActive=false;pauseButton.disabled=true;
    objects=[];fragments=[];particles=[];splashes=[];labels=[];trail=[];comboPulse=0;combo=0;
    specialBag=null;bagBonus=null;bagSparks=[];bagBurst=null;bagSpawnAt=Infinity;
    nextGroupAt=Infinity;groupsBlockedUntil=0;
    updateUI();
    hideOverlay();
    gameScreen.inert=true;gameScreen.setAttribute('aria-hidden','true');
    entryPanel.hidden=false;
    entryBest.textContent=String(best).padStart(3,'0');
    setTutorialStep(0,false);
    nextButton.focus({preventScroll:true});
  }
  function pauseGame() {
    if(state==='playing'){state='paused';pointerActive=false;if(specialBag)specialBag.contact=false;pauseButton.setAttribute('aria-label','Continuar juego');pauseButton.title='Continuar juego';showOverlay('paused');}
    else if(state==='paused'){state='playing';lastFrame=performance.now();pauseButton.setAttribute('aria-label','Pausar juego');pauseButton.title='Pausar juego';hideOverlay();pauseButton.focus({preventScroll:true});}
  }
  function finishGame() {
    if(state!=='playing')return;
    const newRecord=score>best;
    state='gameover';pauseButton.disabled=true;pointerActive=false;combo=0;comboPulse=0;updateUI();
    if(newRecord){best=score;try{localStorage.setItem('biofresh-fresh-slice-best',String(best));}catch(_){}}
    entryBest.textContent=String(best).padStart(3,'0');
    showOverlay('gameover');
    playRoundEndSound(remaining<=0);
    if(newRecord)document.getElementById('overlayKicker').textContent=remaining<=0?'RONDA COMPLETADA · NUEVO RÉCORD':'NUEVO RÉCORD';
    if(remaining<=0||newRecord)celebrate();
    window.BIOFRESH_REGISTRATION?.complete(roundMetrics(remaining<=0?'time':'lives'));
  }
  function roundMetrics(finishReason){return{score,durationSeconds:Math.round(roundDuration*1000)/1000,finishReason,ingredientsCut,maxCombo,bonusCuts};}
  window.addEventListener('gamehub:participant-changed',returnToMenu);
  overlayButton.addEventListener('click',()=>state==='paused'?pauseGame():startGame());
  playButton.addEventListener('click',()=>{if(tutorialStep===2)startGame();});
  document.getElementById('menuButton').addEventListener('click',returnToMenu);
  document.getElementById('overlayMenu').addEventListener('click',returnToMenu);
  pauseButton.addEventListener('click',pauseGame);
  fullscreenButton.hidden=!document.documentElement.requestFullscreen;
  fullscreenButton.addEventListener('click',()=>{
    if(document.fullscreenElement){try{Promise.resolve(document.exitFullscreen()).catch(()=>{});}catch(_){}}
    else requestGameFullscreen();
  });
  document.addEventListener('fullscreenchange',()=>{
    const label=document.fullscreenElement?'Salir de pantalla completa':'Pantalla completa';
    fullscreenButton.setAttribute('aria-label',label);fullscreenButton.title=label;
    resizeCanvas();
  });
  document.addEventListener('keydown',e=>{
    if(e.code==='Space'&&!e.target.closest('button,a,input,summary')){
      e.preventDefault();
      if(state==='ready'&&!window.BIOFRESH_REGISTRATION?.isReady()){window.BIOFRESH_REGISTRATION?.require();return;}
      if(state==='ready'&&tutorialStep<2)setTutorialStep(tutorialStep+1);
      else if(state==='ready'||state==='gameover')startGame();
      else pauseGame();
    }
    if(e.code==='Escape'&&state==='playing')pauseGame();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pauseGame()});

  soundButton.addEventListener('click',()=>{
    soundOn=!soundOn;
    syncSoundButton();
    if(audioOutput)audioOutput.gain.setValueAtTime(soundOn ? .65 : 0,audioContext.currentTime);
    if(soundOn)playWhip(950,width/2,width/2);
  });
  function syncSoundButton(){
    soundButton.classList.toggle('muted',!soundOn);
    soundButton.setAttribute('aria-label',soundOn?'Silenciar sonido':'Activar sonido');
    soundButton.title=soundOn?'Silenciar sonido':'Activar sonido';
  }
  syncSoundButton();
  function getAudioContext(){
    try{
      if(!audioContext){
        const AudioEngine=window.AudioContext||window.webkitAudioContext;
        if(!AudioEngine){soundOn=false;syncSoundButton();return null;}
        audioContext=new AudioEngine();
        audioOutput=audioContext.createGain();audioOutput.gain.value=.65;
        if(audioContext.createDynamicsCompressor){
          const limiter=audioContext.createDynamicsCompressor();
          limiter.threshold.value=-10;limiter.knee.value=8;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.09;
          audioOutput.connect(limiter);limiter.connect(audioContext.destination);
        }else audioOutput.connect(audioContext.destination);
        whipNoises=[.9,.35,.6].map(brightness=>{
          const buffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*.65),audioContext.sampleRate);
          const samples=buffer.getChannelData(0);let smooth=0;
          for(let i=0;i<samples.length;i++){
            const noise=Math.random()*2-1;smooth=.82*smooth+.18*noise;samples[i]=noise*brightness+smooth*(1-brightness);
          }
          return buffer;
        });
        prepareFoodSounds(audioContext);
        const whipBank=window.BIOFRESH_WHIP_SOUNDS;
        if(whipBank)whipAudioBuffers=whipBank.clips.map(encoded=>decodePcmSound(audioContext,encoded,whipBank.sampleRate));
        bagSparkleBuffer=makeBagSparkleSound(audioContext);
        clockTickBuffers=makeClockTickSounds(audioContext);
        roundEndBuffers={win:makeRoundEndSound(audioContext,true),lose:makeRoundEndSound(audioContext,false)};
      }
      if(audioContext.state==='suspended')Promise.resolve(audioContext.resume()).catch(()=>{});
      return audioContext;
    }catch(_){soundOn=false;syncSoundButton();return null;}
  }
  function decodePcmSound(audio,encoded,sampleRate){
    const pcm=atob(encoded),buffer=audio.createBuffer(1,pcm.length/2,sampleRate),samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++){
      let value=pcm.charCodeAt(i*2)|(pcm.charCodeAt(i*2+1)<<8);
      if(value>=32768)value-=65536;
      samples[i]=value/32768;
    }
    return buffer;
  }
  function makeClockTickSounds(audio){
    return [1900,1450].map(frequency=>{
      const rate=audio.sampleRate,buffer=audio.createBuffer(1,Math.ceil(rate*.085),rate),samples=buffer.getChannelData(0);
      let previousNoise=0;
      for(let i=0;i<samples.length;i++){
        const t=i/rate,noise=Math.random()*2-1,click=noise-previousNoise;
        previousNoise=noise;
        const body=Math.sin(2*Math.PI*frequency*t)+.28*Math.sin(2*Math.PI*frequency*2.47*t);
        const attack=1-Math.exp(-t/.0007),fade=Math.min(1,(samples.length-1-i)/(rate*.008));
        samples[i]=attack*fade*(body*.48*Math.exp(-t/.012)+click*.24*Math.exp(-t/.0035));
      }
      return buffer;
    });
  }
  function makeRoundEndSound(audio,won){
    const rate=audio.sampleRate,duration=won?1.3:1;
    const buffer=audio.createBuffer(1,Math.ceil(rate*duration),rate),samples=buffer.getChannelData(0);
    const notes=won?
      [[0,523.25,.3,.23],[.13,659.25,.32,.23],[.26,783.99,.38,.25],[.43,1046.5,.75,.27],[.43,659.25,.75,.09],[.43,783.99,.75,.09]]:
      [[0,392,.28,.27],[.18,329.63,.3,.25],[.36,261.63,.52,.28]];
    for(const [start,frequency,length,volume] of notes){
      const offset=Math.round(start*rate),count=Math.min(Math.ceil(length*rate),samples.length-offset);
      for(let i=0;i<count;i++){
        const t=i/rate,phase=2*Math.PI*frequency*t;
        const envelope=(1-Math.exp(-t/.005))*Math.exp(-t/(length*.32))*Math.min(1,(count-1-i)/(rate*.045));
        const tone=won?Math.sin(phase)+.2*Math.sin(phase*2.01)*Math.exp(-t/.12)+.055*Math.sin(phase*3.97)*Math.exp(-t/.06):Math.sin(phase)+.12*Math.sin(phase*2);
        samples[offset+i]+=tone*envelope*volume;
      }
    }
    let peak=0;for(const sample of samples)peak=Math.max(peak,Math.abs(sample));
    const gain=.65/Math.max(peak,.001);
    for(let i=0;i<samples.length;i++)samples[i]*=gain;
    return buffer;
  }
  function stopRoundEndSound(){
    if(!roundEndSource)return;
    try{roundEndSource.stop();}catch(_){}
    roundEndSource=null;
  }
  function playRoundEndSound(won){
    if(!soundOn)return;
    const audio=getAudioContext();if(!audio||!roundEndBuffers)return;
    try{
      stopRoundEndSound();
      const source=audio.createBufferSource(),gain=audio.createGain();
      source.buffer=roundEndBuffers[won?'win':'lose'];gain.gain.value=.8;
      source.connect(gain);gain.connect(audioOutput);roundEndSource=source;
      source.onended=()=>{source.disconnect();gain.disconnect();if(roundEndSource===source)roundEndSource=null;};
      source.start(audio.currentTime);source.stop(audio.currentTime+source.buffer.duration);
    }catch(_){/* El resultado debe mostrarse aunque el audio no esté disponible. */}
  }
  function playClockTick(second){
    if(!soundOn)return;
    const audio=getAudioContext();if(!audio||!clockTickBuffers.length)return;
    try{
      const source=audio.createBufferSource(),gain=audio.createGain();
      source.buffer=clockTickBuffers[second%2];gain.gain.value=.62;
      source.connect(gain);gain.connect(audioOutput);
      source.onended=()=>{source.disconnect();gain.disconnect();};
      source.start(audio.currentTime);source.stop(audio.currentTime+source.buffer.duration);
    }catch(_){/* El aviso de tiempo no debe interrumpir la ronda. */}
  }
  function prepareFoodSounds(audio){
    const bank=window.BIOFRESH_SOUNDS;if(!bank)return;
    for(const [id,clips] of Object.entries(bank.clips)){
      const buffers=clips.map(encoded=>decodePcmSound(audio,encoded,bank.sampleRate));
      foodAudioBuffers.set(id,buffers);
    }
  }
  function playIngredientSound(id,x){
    if(!soundOn)return;
    const audio=getAudioContext(),buffers=foodAudioBuffers.get(id);
    if(!audio||!buffers?.length)return;
    try{
      const previous=lastFoodVariant.get(id);
      const variant=previous===undefined?Math.floor(Math.random()*buffers.length):(previous+1)%buffers.length;
      lastFoodVariant.set(id,variant);
      const source=audio.createBufferSource(),gain=audio.createGain(),nodes=[source,gain];
      const t=audio.currentTime,rate=.985+Math.random()*.03;
      source.buffer=buffers[variant];source.playbackRate.value=rate;gain.gain.value=.92;
      source.connect(gain);
      if(audio.createStereoPanner){
        const pan=audio.createStereoPanner();nodes.push(pan);
        pan.pan.value=Math.max(-.55,Math.min(.55,(x/Math.max(width,1)*2-1)*.55));
        gain.connect(pan);pan.connect(audioOutput);
      }else gain.connect(audioOutput);
      source.onended=()=>nodes.forEach(node=>node.disconnect());
      source.start(t);source.stop(t+source.buffer.duration/rate+.015);
    }catch(_){/* A missed food cue must not interrupt a cut or the movement sound. */}
  }
  function makeBagSparkleSound(audio){
    const rate=audio.sampleRate,duration=1.45;
    const buffer=audio.createBuffer(1,Math.ceil(rate*duration),rate),samples=buffer.getChannelData(0);
    const notes=[[0,1568,.19],[.045,2637,.085],[.12,1976,.14],[.23,3136,.09],[.34,2349,.12],[.46,1760,.1],[.62,2794,.08],[.79,2093,.075],[.94,3136,.065]];
    notes.forEach(([start,frequency,volume],index)=>{
      const offset=Math.round(start*rate),length=Math.min(Math.ceil(rate*.5),samples.length-offset);
      for(let i=0;i<length;i++){
        const t=i/rate,phase=Math.PI*2*frequency*t;
        const envelope=(1-Math.exp(-t/.003))*Math.exp(-t/(.105+index%3*.018));
        const bell=Math.sin(phase)+.26*Math.sin(phase*2.01)*Math.exp(-t/.06)+.08*Math.sin(phase*3.97)*Math.exp(-t/.025);
        samples[offset+i]+=bell*volume*envelope;
      }
    });
    let peak=0;for(const sample of samples)peak=Math.max(peak,Math.abs(sample));
    const gain=.65/Math.max(peak,.001),fade=Math.ceil(rate*.035);
    for(let i=0;i<samples.length;i++)samples[i]*=gain*Math.min(1,(samples.length-1-i)/fade);
    return buffer;
  }
  function playBagSparkles(x){
    if(!soundOn)return;
    const audio=getAudioContext();if(!audio||!bagSparkleBuffer)return;
    try{
      const source=audio.createBufferSource(),gain=audio.createGain(),nodes=[source,gain];
      source.buffer=bagSparkleBuffer;gain.gain.value=.64;source.connect(gain);
      if(audio.createStereoPanner){
        const pan=audio.createStereoPanner();nodes.push(pan);
        pan.pan.value=Math.max(-.5,Math.min(.5,(x/Math.max(width,1)*2-1)*.5));
        gain.connect(pan);pan.connect(audioOutput);
      }else gain.connect(audioOutput);
      source.onended=()=>nodes.forEach(node=>node.disconnect());
      source.start(audio.currentTime);source.stop(audio.currentTime+bagSparkleBuffer.duration+.01);
    }catch(_){/* The sparkle cue must never interrupt the bag's entrance. */}
  }
  function nextWhipVariant(){
    if(!whipBag.length){
      whipBag=WHIP_VARIANTS.map((_,i)=>i);
      for(let i=whipBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[whipBag[i],whipBag[j]]=[whipBag[j],whipBag[i]];}
      if(whipBag[whipBag.length-1]===lastWhipVariant){const end=whipBag.length-1;[whipBag[0],whipBag[end]]=[whipBag[end],whipBag[0]];}
    }
    lastWhipVariant=whipBag.pop();
    return WHIP_VARIANTS[lastWhipVariant];
  }
  function playWhip(speed=950,fromX=width/2,toX=width/2){
    if(!soundOn)return;
    const audio=getAudioContext();if(!audio)return;
    try{
      const t=audio.currentTime,strength=Math.max(.6,Math.min(1,speed/1900)),variant=nextWhipVariant();
      if(variant.clip!==undefined){
        const buffer=whipAudioBuffers[variant.clip];
        if(!buffer)return;
        const source=audio.createBufferSource(),gain=audio.createGain(),nodes=[source,gain];
        const rate=.97+Math.random()*.06,duration=buffer.duration/rate;
        source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=.8*strength;
        source.connect(gain);
        if(audio.createStereoPanner){
          const pan=audio.createStereoPanner();nodes.push(pan);
          const position=x=>Math.max(-.65,Math.min(.65,(x/Math.max(width,1)*2-1)*.65));
          pan.pan.setValueAtTime(position(fromX),t);pan.pan.linearRampToValueAtTime(position(toX),t+duration*.9);
          gain.connect(pan);pan.connect(audioOutput);
        }else gain.connect(audioOutput);
        source.onended=()=>nodes.forEach(node=>node.disconnect());
        source.start(t);source.stop(t+duration+.008);
        return;
      }
      const duration=variant.duration*(.97+Math.random()*.06),peak=duration*variant.peak,crackTime=peak+.005;
      const body=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
      const crack=audio.createBufferSource(),crackFilter=audio.createBiquadFilter(),crackGain=audio.createGain();
      const nodes=[body,filter,gain,crack,crackFilter,crackGain];
      let output=audioOutput;
      if(audio.createStereoPanner){
        const pan=audio.createStereoPanner();nodes.push(pan);
        const position=x=>Math.max(-.65,Math.min(.65,(x/Math.max(width,1)*2-1)*.65));
        pan.pan.setValueAtTime(position(fromX),t);pan.pan.linearRampToValueAtTime(position(toX),t+duration*.9);
        pan.connect(audioOutput);output=pan;
      }
      // Alternate airy, sharp, low and rising sweeps without repeating a variant in a row.
      body.buffer=whipNoises[variant.texture];body.playbackRate.value=variant.rate*(.96+Math.min(speed/10000,.16));
      filter.type='bandpass';filter.Q.value=variant.q;
      filter.frequency.setValueAtTime(variant.low,t);filter.frequency.exponentialRampToValueAtTime(variant.high,t+peak);filter.frequency.exponentialRampToValueAtTime(variant.tail,t+duration*.94);
      gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.16*strength,t+peak*.33);gain.gain.exponentialRampToValueAtTime(variant.body*strength,t+peak);gain.gain.exponentialRampToValueAtTime(.0001,t+duration*.98);
      body.connect(filter);filter.connect(gain);gain.connect(output);
      crack.buffer=whipNoises[0];crack.playbackRate.value=1.1+variant.rate*.2;
      crackFilter.type='highpass';crackFilter.frequency.value=variant.snap;
      crackGain.gain.setValueAtTime(.0001,t+crackTime);crackGain.gain.exponentialRampToValueAtTime(variant.crack*strength,t+crackTime+.003);crackGain.gain.exponentialRampToValueAtTime(.0001,t+crackTime+.044);
      crack.connect(crackFilter);crackFilter.connect(crackGain);crackGain.connect(output);
      body.onended=()=>nodes.forEach(node=>node.disconnect());
      body.start(t,Math.random()*.08);body.stop(t+duration+.008);
      crack.start(t+crackTime,.12+Math.random()*.08);crack.stop(t+crackTime+.05);
    }catch(_){soundOn=false;syncSoundButton();}
  }

  function nextIngredient(){
    if(!bag.length)bag=INGREDIENTS.map(i=>i.id).sort(()=>Math.random()-.5);
    return bag.pop();
  }
  function rand(a,b){return a+Math.random()*(b-a)}
  function spawn(){
    const count=elapsed>32&&Math.random()<.42?2:elapsed>14&&Math.random()<.25?2:1;
    const radius=Math.max(34,Math.min(66,width*.045,height*.095));
    const gravity=Math.max(900,height*1.65)*1.1;
    for(let n=0;n<count;n++){
      const id=nextIngredient();
      const x=rand(radius+15,width-radius-15);
      const rise=rand(height*.57,height*.82);
      objects.push({id,x,y:height+radius+5,vx:rand(-105,105),vy:-Math.sqrt(2*gravity*rise),gravity,r:radius,rot:rand(-.35,.35),spin:rand(-1.7,1.7),seen:false,sliced:false});
    }
  }
  function groupWindowIsClear(){
    return state==='playing'&&remaining>4.5&&!specialBag&&!bagBonus&&!bagBurst&&elapsed>=groupsBlockedUntil&&bagSpawnAt-elapsed>=GROUP_BAG_BUFFER+3;
  }
  function spawnIngredientGroup(){
    // Reservar toda la pantalla para la tanda, incluso si quedan uno o dos anteriores.
    if(!groupWindowIsClear()||objects.some(item=>!item.sliced))return false;
    const count=3+Math.floor(Math.random()*3);
    const normalRadius=Math.max(34,Math.min(66,width*.045,height*.095));
    const available=width-32;
    const radius=Math.min(normalRadius,(available-(count-1)*10)/(count*2),available/(count*2+(count-1)*.3)),gap=Math.max(10,radius*.3);
    const span=radius*count*2+gap*(count-1),shift=Math.max(0,Math.min(width*.08,(width-span)/2-16));
    const left=(width-span)/2+rand(-shift,shift),gravity=Math.max(560,height*.85);
    const rise=rand(height*.64,height*.72),vy=-Math.sqrt(2*gravity*rise),vx=rand(-6,6);
    const chosen=new Set();
    for(let n=0;n<count;n++){
      let id;do{id=nextIngredient();}while(chosen.has(id));chosen.add(id);
      objects.push({id,x:left+radius+n*(radius*2+gap),y:height+radius+5,vx,vy,gravity,r:radius,rot:rand(-.3,.3),spin:rand(-.8,.8),seen:false,sliced:false,grouped:true});
    }
    nextGroupAt=elapsed+rand(8,12);spawnClock=.5;
    return true;
  }
  function spawnSpecialBag(){
    bagSpawnAt=Infinity;
    const spec=BAG_SPECS[Math.floor(Math.random()*BAG_SPECS.length)];
    if(!spec||!bagSprites.has(spec.id))return;
    const h=Math.max(115,Math.min(205,height*.245,width*.30));
    const gravity=Math.max(810,height*1.42);
    specialBag={spec,x:rand(width*.35,width*.65),y:height+h*.55,vx:rand(-36,36),vy:-Math.sqrt(2*gravity*height*.63),gravity,h,rot:rand(-.4,.4),spin:rand(.3,.75)*(Math.random()<.5?-1:1),seen:false,contact:false,age:0,glints:Array.from({length:6},(_,index)=>makeBagGlint(index))};
    groupsBlockedUntil=Infinity;
    playBagSparkles(specialBag.x);
  }
  function makeBagGlint(index=0){
    const anchors=[[-.68,-.31],[.67,-.12],[-.58,.33],[.47,.49],[.2,-.6],[-.32,-.55]];
    const [x,y]=anchors[index%anchors.length];
    return{x:x+rand(-.035,.035),y:y+rand(-.025,.025),dx:rand(-.018,.018),dy:rand(-.03,-.01),size:rand(2,3.4),rotation:rand(-.25,.25),life:rand(1.9,2.8),age:-index*.17};
  }
  function bagGeometry(){
    if(!specialBag)return null;
    const sprite=bagSprites.get(specialBag.spec.id);
    if(!sprite)return null;
    if(!bagBonus)return{x:specialBag.x,y:specialBag.y,h:specialBag.h,w:specialBag.h*sprite.width/sprite.height,rot:specialBag.rot,focus:0};
    const progress=Math.min(1,bagBonus.age/BAG_FOCUS_SECONDS);
    // Ease both acceleration and braking into the close-up.
    const eased=progress**3*(10+progress*(-15+6*progress));
    const targetHeight=Math.min(370,height*.54,width*.79);
    const recoil=reducedMotion?0:bagBonus.hitGlow*eased;
    const inertia=reducedMotion?0:16*(progress*(1-progress))**2;
    const h=(bagBonus.startH+(targetHeight-bagBonus.startH)*eased)*(1+recoil*.008);
    return{x:bagBonus.startX+(width*.5-bagBonus.startX)*eased+bagBonus.driftX*inertia,y:bagBonus.startY+(height*.53-bagBonus.startY)*eased+bagBonus.driftY*inertia,h,w:h*sprite.width/sprite.height,rot:bagBonus.startRot,focus:eased};
  }
  function bagIsTouched(a,b,geometry){
    // Test the swipe in the package's own orientation.
    const cos=Math.cos(geometry.rot),sin=Math.sin(geometry.rot);
    const local=p=>({x:(p.x-geometry.x)*cos+(p.y-geometry.y)*sin,y:-(p.x-geometry.x)*sin+(p.y-geometry.y)*cos});
    const start=local(a),end=local(b);
    const ratio=geometry.w/geometry.h;
    return segmentDistance(0,0,start.x,start.y*ratio,end.x,end.y*ratio)<geometry.w*.46;
  }
  function addBagSparks(x,y,color,count=3,force=1,cutAngle=null){
    const available=Math.max(0,24-bagSparks.length);
    for(let i=0;i<Math.min(count,available);i++){
      const direction=cutAngle===null?rand(0,Math.PI*2):cutAngle+(i%2?Math.PI:0)+rand(-.3,.3);
      const distance=rand(13,32)*force,life=rand(.6,.85);
      bagSparks.push({x,y,x0:x,y0:y,dx:Math.cos(direction)*distance,dy:Math.sin(direction)*distance-8,size:rand(1.6,2.8),life,ttl:life,color,angle:rand(-.35,.35)});
    }
  }
  function registerBagHit(geometry,cutAngle=0){
    if(!bagBonus)return;
    bagBonus.hits++;
    bonusCuts++;
    score+=BAG_HIT_POINTS;updateUI();
    if(bagBonus.age-bagBonus.lastSparkAt>=.11){
      addBagSparks(geometry.x+rand(-geometry.w*.08,geometry.w*.08),geometry.y+rand(-geometry.h*.13,geometry.h*.13),specialBag.spec.color,3,1,cutAngle);
      bagBonus.lastSparkAt=bagBonus.age;
    }
    bagBonus.flash=.16;
    bagBonus.impactAngle=cutAngle;
    if(bagBonus.hits===1)bagBonus.strokeTravel=0;
  }
  function activateBagBonus(cutAngle=0){
    const geometry=bagGeometry();
    if(!geometry)return;
    bagBonus={age:0,hits:0,startX:geometry.x,startY:geometry.y,startH:geometry.h,startRot:geometry.rot,driftX:Math.max(-30,Math.min(30,specialBag.vx*.07)),driftY:Math.max(-45,Math.min(45,specialBag.vy*.055)),impactAngle:cutAngle,strokeTravel:0,flash:0,hitGlow:0,lastSparkAt:-Infinity};
    specialBag.contact=true;
    registerBagHit(geometry,cutAngle);
  }
  function endBagBonus(){
    const geometry=bagGeometry();
    if(geometry){
      bagBurst={x:geometry.x,y:geometry.y,h:geometry.h,rot:geometry.rot,spec:specialBag.spec,age:0};
      addBagSparks(geometry.x,geometry.y,specialBag.spec.color,7,1.15);
    }
    bagBonus=null;specialBag=null;
    groupsBlockedUntil=elapsed+GROUP_BAG_BUFFER;
  }
  function miss(){if(state!=='playing')return;lives=Math.max(0,lives-1);combo=0;comboPulse=0;updateUI();if(lives===0&&remaining>0)finishGame();}
  function makeJuiceStamp(color){
    const stamp=document.createElement('canvas');stamp.width=256;stamp.height=256;
    const c=stamp.getContext('2d');c.translate(128,128);
    const points=[];
    for(let i=0;i<18;i++){
      const angle=i/18*Math.PI*2,r=rand(34,53);
      points.push({x:Math.cos(angle)*r*1.12,y:Math.sin(angle)*r*.85});
    }
    const last=points[points.length-1],first=points[0];
    c.beginPath();c.moveTo((last.x+first.x)/2,(last.y+first.y)/2);
    points.forEach((p,i)=>{const next=points[(i+1)%points.length];c.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);});
    c.closePath();
    const pool=c.createRadialGradient(-8,-8,5,0,0,63);
    pool.addColorStop(0,color+'c7');pool.addColorStop(.65,color+'a3');pool.addColorStop(1,color+'30');
    c.fillStyle=pool;c.fill();
    c.fillStyle=color;c.strokeStyle=color;c.lineCap='round';
    for(let i=0;i<9;i++){
      const angle=rand(0,Math.PI*2),inner=rand(24,38),outer=rand(56,97);
      const x=Math.cos(angle)*outer,y=Math.sin(angle)*outer;
      c.globalAlpha=rand(.28,.65);c.lineWidth=rand(1.7,4.5);
      c.beginPath();c.moveTo(Math.cos(angle)*inner,Math.sin(angle)*inner);
      c.quadraticCurveTo(x*.72+rand(-8,8),y*.72+rand(-8,8),x,y);c.stroke();
      c.beginPath();c.ellipse(x,y,rand(2.3,5.5),rand(1.8,3.8),angle,0,Math.PI*2);c.fill();
    }
    for(let i=0;i<28;i++){
      const angle=rand(0,Math.PI*2),distance=rand(48,115),r=rand(.8,3.4);
      c.globalAlpha=rand(.3,.8);c.beginPath();
      c.ellipse(Math.cos(angle)*distance,Math.sin(angle)*distance,r*rand(1,1.65),r,angle,0,Math.PI*2);c.fill();
    }
    // Fine transparent pores let the plaster texture show through the wet mark.
    c.globalCompositeOperation='destination-out';
    for(let i=0;i<120;i++){
      c.globalAlpha=rand(.05,.23);c.beginPath();c.arc(rand(-57,57),rand(-50,50),rand(.4,1.3),0,Math.PI*2);c.fill();
    }
    return stamp;
  }
  function burstJuice(item,cutAngle){
    const color=JUICE_COLORS[item.id],scale=item.r/46;
    for(let i=0;i<24;i++){
      const angle=i<15?cutAngle+Math.PI/2+(i%2?Math.PI:0)+rand(-.65,.65):rand(0,Math.PI*2);
      const speed=rand(110,390)*scale,life=rand(.48,1.02);
      particles.push({x:item.x+rand(-5,5),y:item.y+rand(-5,5),vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-65,r:rand(2.2,6.2)*scale,life,ttl:life,opacity:rand(.7,.95),color});
    }
    const life=rand(4.3,5.3);
    splashes.push({x:item.x,y:item.y,size:item.r*5.5,rotation:cutAngle+rand(-.6,.6),life,ttl:life,sprite:makeJuiceStamp(color)});
    if(particles.length>360)particles.splice(0,particles.length-360);
    if(splashes.length>24)splashes.splice(0,splashes.length-24);
  }
  function slice(item,cutAngle=0){
    item.sliced=true;
    ingredientsCut++;
    combo=elapsed-lastSlice<COMBO_WINDOW?combo+1:1;
    lastSlice=elapsed;
    maxCombo=Math.max(maxCombo,combo);
    const points=10+Math.min(combo-1,4)*5;
    score+=points;updateUI();playIngredientSound(item.id,item.x);
    for(let side of [-1,1]) fragments.push({id:item.id,x:item.x+side*3,y:item.y,vx:item.vx+side*150,vy:item.vy*.35-100,rot:item.rot,spin:side*4,side,life:.75,r:item.r});
    burstJuice(item,cutAngle);
    labels.push({x:item.x,y:item.y-35,points,level:combo>1?Math.min(combo,5):0,life:.8,ttl:.8});
    if(combo>1)comboPulse=.24;
  }
  function segmentDistance(px,py,ax,ay,bx,by){
    const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
    const t=len?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len)):0;
    return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
  }
  function checkSlice(a,b){
    const cutAngle=Math.atan2(b.y-a.y,b.x-a.x);
    if(specialBag){
      const geometry=bagGeometry();
      if(geometry){
        const touched=bagIsTouched(a,b,geometry);
        if(bagBonus){
          if(touched){
            if(!specialBag.contact){registerBagHit(geometry,cutAngle);bagBonus.strokeTravel=0;}
            else if(a.x!==b.x||a.y!==b.y){
              bagBonus.strokeTravel+=Math.hypot(b.x-a.x,b.y-a.y);
              if(bagBonus.strokeTravel>=Math.max(38,geometry.w*.3)){
                registerBagHit(geometry,cutAngle);bagBonus.strokeTravel=0;
              }
            }
          }else bagBonus.strokeTravel=0;
          specialBag.contact=touched;
          return;
        }
        if(touched){activateBagBonus(cutAngle);return;}
      }
    }
    for(const item of objects){if(!item.sliced&&segmentDistance(item.x,item.y,a.x,a.y,b.x,b.y)<item.r*.8)slice(item,cutAngle);}
  }
  function pointerPosition(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top,t:performance.now()}}
  function resetSwipeSound(){
    swipeHasSound=false;swipeDirection=null;swipeVector={x:0,y:0};turnVector=null;
  }
  function trackSwipeSound(a,b){
    const dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy);
    const speed=distance/Math.max((b.t-a.t)/1000,.008);
    if(!swipeDirection){
      swipeVector.x+=dx;swipeVector.y+=dy;
      const length=Math.hypot(swipeVector.x,swipeVector.y);
      if(length<12)return;
      swipeDirection={x:swipeVector.x/length,y:swipeVector.y/length};
      if(!swipeHasSound)playWhip(speed,a.x,b.x);
      swipeHasSound=true;return;
    }
    const direction={x:dx/distance,y:dy/distance};
    // A real turn of at least 60 degrees must travel 12 px; tiny hand jitter stays silent.
    if(direction.x*swipeDirection.x+direction.y*swipeDirection.y>.5){turnVector=null;return;}
    const turnLength=turnVector?Math.hypot(turnVector.x,turnVector.y):0;
    if(!turnVector||(turnVector.x*direction.x+turnVector.y*direction.y)/turnLength<.65)turnVector={x:dx,y:dy};
    else {turnVector.x+=dx;turnVector.y+=dy;}
    const length=Math.hypot(turnVector.x,turnVector.y);
    if(length<12)return;
    playWhip(speed,a.x,b.x);
    swipeDirection={x:turnVector.x/length,y:turnVector.y/length};turnVector=null;
  }
  canvas.addEventListener('pointerdown',e=>{
    if(state!=='playing'||pointerActive||e.isPrimary===false||(e.button!==undefined&&e.button!==0))return;
    e.preventDefault();pointerActive=true;activePointerId=e.pointerId;
    try{canvas.setPointerCapture?.(e.pointerId);}catch(_){/* El corte sigue funcionando aunque Safari no pueda capturar este toque. */}
    resetSwipeSound();
    const p=pointerPosition(e),previousScore=score;lastPointer=p;trail=[p];checkSlice(p,p);
    if(score>previousScore){playWhip(950,p.x,p.x);swipeHasSound=true;}
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pointerActive||state!=='playing'||e.pointerId!==activePointerId)return;
    e.preventDefault();const p=pointerPosition(e),old=lastPointer||p;
    const distance=Math.hypot(p.x-old.x,p.y-old.y);
    if(distance>2){
      lastPointer=p;
      trackSwipeSound(old,p);
      if(!trail.length)trail.push({...old,t:p.t});
      trail.push(p);checkSlice(old,p);if(trail.length>18)trail.shift();
    }
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{
    if(e.pointerId!==undefined&&e.pointerId!==activePointerId)return;
    pointerActive=false;activePointerId=null;lastPointer=null;if(specialBag)specialBag.contact=false;if(bagBonus)bagBonus.strokeTravel=0;
  });

  function roundedRect(c,x,y,w,h,radius){
    if(typeof c.roundRect==='function'){c.roundRect(x,y,w,h,radius);return;}
    const r=Math.max(0,Math.min(radius,w/2,h/2));
    c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
    c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);
    c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
  }

  function update(dt){
    if(state!=='playing')return;
    roundDuration+=dt;
    visualTime+=dt;
    const wasCounting=remaining>0&&!bagBonus;
    if(!bagBonus){
      const previousSecond=Math.ceil(remaining);
      remaining=Math.max(0,remaining-dt);elapsed+=dt;
      const second=Math.ceil(remaining);
      if(second>0&&second<=4&&second!==previousSecond)playClockTick(second);
    }
    if(wasCounting&&remaining===0)updateUI();
    if(!bagBonus&&remaining>0){
      if(elapsed>=bagSpawnAt)spawnSpecialBag();
      const groupActive=objects.some(item=>item.grouped&&!item.sliced);
      if(groupActive)spawnClock=Math.max(spawnClock,.45);
      else if(elapsed>=nextGroupAt&&groupWindowIsClear())spawnIngredientGroup();
      else{
        spawnClock-=dt;
        if(spawnClock<=0&&objects.length<8){spawn();spawnClock=rand(Math.max(.43,.88-elapsed*.006),Math.max(.58,1.13-elapsed*.006))*.94;}
      }
    }
    if(bagBonus){
      bagBonus.age+=dt;
      bagBonus.flash=Math.max(0,bagBonus.flash-dt);
      const glowTarget=bagBonus.flash>0?1:0;
      bagBonus.hitGlow+=(glowTarget-bagBonus.hitGlow)*(1-Math.exp(-dt*(glowTarget?12:6)));
      if(bagBonus.age>=BAG_BONUS_SECONDS)endBagBonus();
    }else if(specialBag){
      const item=specialBag;
      item.x+=item.vx*dt;item.y+=item.vy*dt;item.vy+=item.gravity*dt;item.rot+=item.spin*dt;
      if(item.y<height-item.h*.45)item.seen=true;
      if(item.seen&&item.y>height+item.h*.55&&item.vy>0){specialBag=null;groupsBlockedUntil=elapsed+GROUP_BAG_BUFFER;}
    }
    if(specialBag){
      specialBag.age+=dt;
      specialBag.glints=specialBag.glints.map(glint=>{
        glint.age+=dt;
        if(glint.age>=glint.life)glint.age=-rand(.25,.55);
        return glint;
      });
    }
    const worldDt=bagBonus?dt*BAG_SLOW_MOTION:dt;
    for(const item of objects){
      if(item.sliced)continue;
      item.x+=item.vx*worldDt;item.y+=item.vy*worldDt;item.vy+=item.gravity*worldDt;item.rot+=item.spin*worldDt;
      if(item.x<item.r){item.x=item.r;item.vx=Math.abs(item.vx)}
      if(item.x>width-item.r){item.x=width-item.r;item.vx=-Math.abs(item.vx)}
      if(item.y<height-item.r)item.seen=true;
      if(item.seen&&item.y>height+item.r&&item.vy>0){item.sliced=true;if(!bagBonus)miss();}
      if(state!=='playing')break;
    }
    objects=objects.filter(i=>!i.sliced);
    for(const f of fragments){f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=870*dt;f.rot+=f.spin*dt;f.life-=dt;}
    fragments=fragments.filter(f=>f.life>0);
    const drag=Math.exp(-1.3*dt);
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=drag;p.vy=p.vy*drag+650*dt;p.life-=dt;}
    particles=particles.filter(p=>p.life>0);
    for(const splash of splashes)splash.life-=dt;
    splashes=splashes.filter(splash=>splash.life>0);
    for(const l of labels){l.y-=35*dt;l.life-=dt;}
    labels=labels.filter(l=>l.life>0);
    for(const spark of bagSparks){
      spark.life-=dt;
      const progress=Math.min(1,Math.max(0,1-spark.life/spark.ttl)),eased=progress*progress*(3-2*progress);
      spark.x=spark.x0+spark.dx*eased;spark.y=spark.y0+spark.dy*eased;
    }
    bagSparks=bagSparks.filter(spark=>spark.life>0);
    if(bagBurst){bagBurst.age+=dt;if(bagBurst.age>.65)bagBurst=null;}
    comboPulse=Math.max(0,comboPulse-dt);
    if(elapsed-lastSlice>=COMBO_WINDOW&&combo){combo=0;comboPulse=0;updateUI();}
    trail=trail.filter(p=>performance.now()-p.t<175);
    if(remaining===0&&!objects.length&&!fragments.length&&!specialBag&&!bagBonus&&!bagBurst){finishGame();return;}
    if(Math.ceil(remaining)!==Number(timeEl.textContent.replace('s','')))updateUI();
  }
  function drawFragment(f){
    ctx.save();ctx.globalAlpha=Math.min(1,f.life*2);ctx.translate(f.x,f.y);ctx.rotate(f.rot);
    ctx.scale(f.r/46,f.r/46);
    ctx.beginPath();if(f.side<0)ctx.rect(-65,-65,65,130);else ctx.rect(0,-65,65,130);ctx.clip();
    drawIngredient(ctx,f.id,0,0,1,0,false);ctx.restore();
  }
  function drawJuiceSplash(splash){
    const age=splash.ttl-splash.life;
    const bloom=.8+.2*(1-Math.pow(1-Math.min(age/.16,1),3));
    const fade=Math.pow(Math.min(1,Math.max(0,splash.life/(splash.ttl-.35))),1.3);
    const size=splash.size*bloom;
    ctx.save();ctx.globalAlpha=.64*fade;
    ctx.translate(splash.x,splash.y);ctx.rotate(splash.rotation);
    ctx.drawImage(splash.sprite,-size/2,-size/2,size,size);ctx.restore();
  }
  function drawJuiceDrop(p){
    const stretch=1+Math.min(Math.hypot(p.vx,p.vy)/430,.9);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));
    ctx.globalAlpha=Math.min(1,p.life/.25)*p.opacity;ctx.fillStyle=p.color;
    ctx.beginPath();ctx.ellipse(0,0,p.r*stretch,p.r,0,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha*=.48;ctx.fillStyle='#fff';
    ctx.beginPath();ctx.ellipse(-p.r*.24,-p.r*.38,p.r*.32*stretch,p.r*.16,-.15,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function drawStreakMeter(){
    if(combo<2||(state!=='playing'&&state!=='paused'))return;
    const compact=width<=700||height<600,cardWidth=compact?160:200,cardHeight=compact?46:58;
    const left=width-cardWidth-(compact?14:25);
    const top=height<500?126:width<380?209:width<=700?158:190;
    const pop=reducedMotion?1:1+.06*Math.sin((1-comboPulse/.24)*Math.PI);
    const fade=Math.min(1,Math.max(0,(COMBO_WINDOW-(elapsed-lastSlice))/.15));
    ctx.save();ctx.globalAlpha=fade;
    ctx.translate(left+cardWidth/2,top+cardHeight/2);ctx.scale(pop,pop);
    ctx.shadowColor='#53361824';ctx.shadowBlur=12;ctx.shadowOffsetY=4;
    ctx.beginPath();roundedRect(ctx,-cardWidth/2,-cardHeight/2,cardWidth,cardHeight,12);ctx.fillStyle=STREAK_ORANGE;ctx.fill();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.fillStyle='#fff';ctx.font='700 '+(compact?20:25)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('RACHA ×'+combo,0,1);
    ctx.restore();
  }
  function drawSliceLabel(label){
    const fade=Math.min(1,label.life/.25),x=Math.max(45,Math.min(width-45,label.x)),y=Math.max(32,Math.min(height-32,label.y));
    ctx.save();ctx.globalAlpha=fade;ctx.translate(x,y);ctx.textAlign='center';
    const pop=reducedMotion?1:1+.07*Math.sin((1-label.life/label.ttl)*Math.PI);ctx.scale(pop,pop);
    ctx.font='700 '+(label.level>1?22:17)+'px Arial';ctx.lineJoin='round';
    ctx.strokeStyle='#ffffffeb';ctx.lineWidth=4;ctx.strokeText('+'+label.points,0,0);
    ctx.fillStyle=label.level>1?STREAK_ORANGE:'#234733';ctx.fillText('+'+label.points,0,0);ctx.restore();
  }
  function drawBagSpark(x,y,size,color,alpha=1,rotation=0){
    ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.globalAlpha=alpha;
    ctx.shadowColor=color;ctx.shadowBlur=size*3;ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(0,-size*1.9);ctx.quadraticCurveTo(size*.35,-size*.35,size*1.1,0);
    ctx.quadraticCurveTo(size*.35,size*.35,0,size*1.9);
    ctx.quadraticCurveTo(-size*.35,size*.35,-size*1.1,0);
    ctx.quadraticCurveTo(-size*.35,-size*.35,0,-size*1.9);ctx.closePath();ctx.fill();
    ctx.restore();
  }
  function drawSpecialBag(){
    if(!specialBag)return;
    const geometry=bagGeometry(),sprite=bagSprites.get(specialBag.spec.id);
    if(!geometry||!sprite)return;
    const {x,y,w,h,rot}=geometry;
    const entryProgress=Math.min(1,(specialBag.age??1)/.45);
    const entryFade=entryProgress*entryProgress*(3-2*entryProgress);
    if(bagBonus){
      ctx.save();ctx.globalAlpha=geometry.focus*.71;ctx.fillStyle='#f9faf5';ctx.fillRect(0,0,width,height);ctx.restore();
    }
    const aura=bagAuraSprites.get(specialBag.spec.id);
    if(aura){
      ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.globalAlpha=(.7+.3*geometry.focus)*entryFade;
      ctx.drawImage(aura,-h,-h,h*2,h*2);ctx.restore();
    }
    ctx.save();ctx.translate(x,y);ctx.rotate(rot);
    if(bagBonus&&bagBonus.hitGlow>.001){
      ctx.save();ctx.globalAlpha=bagBonus.hitGlow*.12;ctx.fillStyle='#fff';
      ctx.beginPath();ctx.ellipse(0,0,w*.64,h*.55,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha=1;
    ctx.shadowColor='#1a332b66';ctx.shadowBlur=21+11*geometry.focus;ctx.shadowOffsetY=10+7*geometry.focus;
    ctx.drawImage(sprite,-w/2,-h/2,w,h);ctx.restore();
    for(const glint of specialBag.glints){
      if(glint.age<0)continue;
      const progress=glint.age/glint.life,twinkle=Math.sin(progress*Math.PI)**2;
      const drift=reducedMotion?0:Math.sin(progress*Math.PI)**2;
      const localX=(glint.x+glint.dx*drift)*w,localY=(glint.y+glint.dy*drift)*h;
      const sx=x+localX*Math.cos(rot)-localY*Math.sin(rot),sy=y+localX*Math.sin(rot)+localY*Math.cos(rot);
      drawBagSpark(sx,sy,glint.size*(1+.1*geometry.focus)*(.8+.2*twinkle),specialBag.spec.color,.54*twinkle*entryFade,glint.rotation+drift*.05);
    }
    if(bagBonus)drawBagBonusBanner(geometry);
  }
  function drawBagBonusBanner(geometry){
    const compact=width<600,cardWidth=Math.min(compact?315:372,width-24),cardHeight=compact?72:82;
    const extentY=Math.abs(Math.cos(geometry.rot))*geometry.h*.5+Math.abs(Math.sin(geometry.rot))*geometry.w*.5;
    const x=width*.5-cardWidth*.5,y=Math.min(height-cardHeight-22,Math.max(height*.79,geometry.y+extentY+23))+(1-geometry.focus)*10;
    const color=specialBag.spec.color,seconds=Math.max(0,Math.ceil(BAG_BONUS_SECONDS-bagBonus.age));
    ctx.save();ctx.globalAlpha=geometry.focus;ctx.shadowColor='#233c3029';ctx.shadowBlur=23;ctx.shadowOffsetY=8;
    ctx.fillStyle='#fffffff2';ctx.beginPath();roundedRect(ctx,x,y,cardWidth,cardHeight,17);ctx.fill();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=color+'80';ctx.lineWidth=1.5;ctx.stroke();
    ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#335340';
    ctx.font='700 '+(compact?10:11)+'px Arial';ctx.fillText('BIOFRESH · CORTES SIN LÍMITE',x+17,y+20);
    ctx.font='700 '+(compact?25:29)+'px Arial';ctx.fillText(String(bagBonus.hits),x+17,y+47);
    ctx.font='700 '+(compact?10:11)+'px Arial';ctx.fillStyle='#63776a';ctx.fillText('CORTES',x+(compact?52:57),y+48);
    ctx.textAlign='right';ctx.font='700 '+(compact?25:29)+'px Arial';ctx.fillStyle=color;ctx.fillText(seconds+'s',x+cardWidth-18,y+47);
    ctx.fillStyle='#e4ebe4';ctx.beginPath();roundedRect(ctx,x+17,y+cardHeight-12,cardWidth-34,4,2);ctx.fill();
    ctx.fillStyle=color;ctx.beginPath();roundedRect(ctx,x+17,y+cardHeight-12,(cardWidth-34)*Math.max(0,1-bagBonus.age/BAG_BONUS_SECONDS),4,2);ctx.fill();
    ctx.restore();
  }
  function drawBagEffects(){
    if(bagBurst){
      const progress=Math.min(1,bagBurst.age/.65),aura=bagAuraSprites.get(bagBurst.spec.id);
      if(aura){
        const size=bagBurst.h*2*(1+.06*progress*progress*(3-2*progress));
        ctx.save();ctx.translate(bagBurst.x,bagBurst.y);ctx.rotate(bagBurst.rot);ctx.globalAlpha=.28*(1-progress)**2;
        ctx.drawImage(aura,-size/2,-size/2,size,size);ctx.restore();
      }
    }
    for(const spark of bagSparks){
      const progress=1-spark.life/spark.ttl,fade=Math.sin(progress*Math.PI)**2;
      drawBagSpark(spark.x,spark.y,spark.size*(.85+.15*fade),spark.color,.62*fade,spark.angle);
    }
  }
  function draw(){
    ctx.clearRect(0,0,width,height);
    ctx.fillStyle='#8b8b8b18';
    for(let i=0;i<25;i++){let x=(i*79+17)%Math.max(width,1),y=(i*113+35)%Math.max(height,1);ctx.beginPath();ctx.arc(x,y,i%4===0?2:1,0,Math.PI*2);ctx.fill();}
    splashes.forEach(drawJuiceSplash);
    drawStreakMeter();
    for(const item of objects)drawIngredient(ctx,item.id,item.x,item.y,item.r/46,item.rot);
    fragments.forEach(drawFragment);
    drawSpecialBag();
    particles.forEach(drawJuiceDrop);
    labels.forEach(drawSliceLabel);
    drawBagEffects();
    if(trail.length>1){
      ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(trail[0].x,trail[0].y);for(let i=1;i<trail.length;i++)ctx.lineTo(trail[i].x,trail[i].y);
      ctx.shadowColor='#47936b';ctx.shadowBlur=17;ctx.strokeStyle='#326b49b8';ctx.lineWidth=14;ctx.stroke();
      ctx.shadowBlur=0;ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.stroke();
    }
  }
  function loop(now){
    const dt=Math.min((now-lastFrame)/1000,.045);lastFrame=now;
    update(dt);draw();requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
