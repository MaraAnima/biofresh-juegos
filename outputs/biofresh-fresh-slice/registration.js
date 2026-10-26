(()=>{
  'use strict';
  const hub=window.GameHub,config=window.GAME_PLATFORM_CONFIG,client=new hub.Client(config);
  const get=id=>document.getElementById(id),form=get('participantForm'),nameInput=get('participantName'),phoneInput=get('participantPhone');
  const status=get('registrationStatus'),syncStatus=get('registrationSyncStatus'),button=get('registrationContinue'),saveStatus=get('saveStatus');
  let current=null,candidate=null,activeRun=null,lastResultId=null,lastResultEventId=null,busy=false;
  get('registrationPreview').hidden=!client.preview;
  function showRegistration(){
    get('registrationPanel').hidden=false;get('tutorialFlow').hidden=true;get('changeParticipant').hidden=true;
    get('entryPanel').scrollTop=0;nameInput.focus({preventScroll:true});
    syncStatus.hidden=true;
  }
  function fieldError(input,id,message){input.setAttribute('aria-invalid',message?'true':'false');get(id).textContent=message;}
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    fieldError(nameInput,'participantNameError','');fieldError(phoneInput,'participantPhoneError','');status.textContent='';
    let name,phone,firstError;
    try{name=hub.normalizeName(nameInput.value);}catch(error){fieldError(nameInput,'participantNameError',error.message);firstError=nameInput;}
    try{phone=hub.normalizePhone(phoneInput.value,config.defaultCallingCode);}catch(error){fieldError(phoneInput,'participantPhoneError',error.message);firstError=firstError||phoneInput;}
    if(firstError){firstError.focus();return;}
    if(!client.configured&&!client.preview){status.textContent='La conexión central todavía no está configurada.';return;}
    if(!candidate||candidate.participant.name!==name||candidate.participant.phone!==phone){
      const participant={name,phone},sessionId=hub.uuid();
      candidate={participant,sessionId,event:client.event('registration',{participant,sessionId,metrics:{}})};
    }
    const attempt=candidate;
    busy=true;
    // La validación local habilita jugar; la confirmación de guardado llega por separado.
    current={participant:Object.assign({},attempt.participant),sessionId:attempt.sessionId,registrationEventId:attempt.event.eventId,registrationConfirmed:false};
    get('registrationPanel').hidden=true;get('tutorialFlow').hidden=false;get('changeParticipant').hidden=false;
    syncStatus.hidden=client.preview;syncStatus.textContent=client.preview?'':'Podés jugar. Tu registro se está enviando.';
    get('entryPanel').scrollTop=0;get('tutorialHeading1').focus({preventScroll:true});
    busy=false;
    window.dispatchEvent(new CustomEvent('gamehub:registered'));
    try{
      const response=await client.send(attempt.event);
      if(current?.registrationEventId!==attempt.event.eventId)return;
      if(response.ok||response.preview){current.registrationConfirmed=!!response.ok;syncStatus.hidden=true;status.textContent='';}
      else{syncStatus.hidden=false;syncStatus.textContent=response.error?.retryable===false?'No se pudo guardar el registro. '+(response.error.message||'Revisá la configuración.'):'Registro pendiente de envío. Podés seguir jugando.';}
    }catch(_){
      if(current?.registrationEventId===attempt.event.eventId){syncStatus.hidden=false;syncStatus.textContent='Registro pendiente de envío. Podés seguir jugando.';}
    }
  });
  function send(type,run,metrics){
    return client.send(client.event(type,{participant:run.participant,sessionId:run.sessionId,runId:run.runId,metrics}));
  }
  function endRun(type,metrics){
    if(!activeRun)return;
    const run=activeRun;activeRun=null;lastResultId=run.runId;
    saveStatus.hidden=client.preview;
    saveStatus.textContent=client.preview?'':'Guardando resultado…';
    const event=client.event(type,{participant:run.participant,sessionId:run.sessionId,runId:run.runId,metrics});lastResultEventId=event.eventId;
    client.send(event).then(response=>{
      if(lastResultId!==run.runId)return;
      saveStatus.textContent=response.ok?'Resultado guardado.':response.preview?'':'Resultado pendiente de envío.';
    }).catch(()=>{if(lastResultId===run.runId)saveStatus.textContent='Resultado pendiente de envío. Se reintentará con conexión.';});
  }
  client.onReceipt?.(response=>{
    if(response.eventId===current?.registrationEventId&&response.ok){current.registrationConfirmed=true;syncStatus.hidden=true;status.textContent='';}
    if(response.eventId===lastResultEventId&&response.ok)saveStatus.textContent='Resultado guardado.';
  });
  get('changeParticipant').addEventListener('click',()=>{
    if(busy)return;
    if(activeRun)endRun('game_abandoned',{finishReason:'participant_changed'});
    current=null;candidate=null;nameInput.value='';phoneInput.value='';status.textContent='';
    window.dispatchEvent(new CustomEvent('gamehub:participant-changed'));showRegistration();
  });
  window.BIOFRESH_REGISTRATION={
    isReady:()=>!!current,
    require:()=>{if(!current)showRegistration();return!!current;},
    startRun(){
      if(!current)return false;
      activeRun={participant:Object.assign({},current.participant),sessionId:current.sessionId,runId:hub.uuid()};
      lastResultId=null;lastResultEventId=null;saveStatus.hidden=true;
      send('game_started',activeRun,{}).catch(()=>{});return true;
    },
    complete:metrics=>endRun('game_completed',metrics),
    abandon:metrics=>endRun('game_abandoned',metrics)
  };
  if(client.configured){
    client.flush().catch(()=>{});
    window.setInterval(()=>client.flush().catch(()=>{}),20000);
  }
})();
