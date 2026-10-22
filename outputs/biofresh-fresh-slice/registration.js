(()=>{
  'use strict';
  const hub=window.GameHub,config=window.GAME_PLATFORM_CONFIG,client=new hub.Client(config);
  const get=id=>document.getElementById(id),form=get('participantForm'),nameInput=get('participantName'),phoneInput=get('participantPhone');
  const status=get('registrationStatus'),button=get('registrationContinue'),saveStatus=get('saveStatus');
  let current=null,candidate=null,activeRun=null,lastResultId=null,busy=false;
  get('registrationPreview').hidden=!client.preview;
  function showRegistration(){
    get('registrationPanel').hidden=false;get('tutorialFlow').hidden=true;get('changeParticipant').hidden=true;
    get('entryPanel').scrollTop=0;nameInput.focus({preventScroll:true});
  }
  function fieldError(input,id,message){input.setAttribute('aria-invalid',message?'true':'false');get(id).textContent=message;}
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    fieldError(nameInput,'participantNameError','');fieldError(phoneInput,'participantPhoneError','');status.textContent='';
    let name,phone,firstError;
    try{name=hub.normalizeName(nameInput.value);}catch(error){fieldError(nameInput,'participantNameError',error.message);firstError=nameInput;}
    try{phone=hub.normalizePhone(phoneInput.value,config.defaultCallingCode);}catch(error){fieldError(phoneInput,'participantPhoneError',error.message);firstError=firstError||phoneInput;}
    if(firstError){firstError.focus();return;}
    if(!candidate||candidate.participant.name!==name||candidate.participant.phone!==phone){
      const participant={name,phone},sessionId=hub.uuid();
      candidate={participant,sessionId,event:client.event('registration',{participant,sessionId,metrics:{}})};
    }
    busy=true;button.disabled=true;button.textContent='Registrando…';status.textContent=client.preview?'':'Estamos registrando tu participación…';
    try{
      const response=await client.send(candidate.event);
      if(!response.ok&&!response.preview)throw new Error(response.error?.message||'No pudimos confirmar tu registro. Intentá nuevamente.');
      current={participant:Object.assign({},candidate.participant),sessionId:candidate.sessionId};
      get('registrationPanel').hidden=true;get('tutorialFlow').hidden=false;get('changeParticipant').hidden=false;
      get('entryPanel').scrollTop=0;get('tutorialHeading1').focus({preventScroll:true});status.textContent='';
      window.dispatchEvent(new CustomEvent('gamehub:registered'));
    }catch(error){status.textContent=error.message||'No pudimos confirmar tu registro. Intentá nuevamente.';}
    finally{busy=false;button.disabled=false;button.innerHTML='Continuar <span aria-hidden="true">→</span>';}
  });
  function send(type,run,metrics){
    return client.send(client.event(type,{participant:run.participant,sessionId:run.sessionId,runId:run.runId,metrics}));
  }
  function endRun(type,metrics){
    if(!activeRun)return;
    const run=activeRun;activeRun=null;lastResultId=run.runId;
    saveStatus.hidden=client.preview;
    saveStatus.textContent=client.preview?'':'Guardando resultado…';
    send(type,run,metrics).then(response=>{
      if(lastResultId!==run.runId)return;
      saveStatus.textContent=response.ok?'Resultado guardado.':response.preview?'':'Resultado pendiente de envío.';
    }).catch(()=>{if(lastResultId===run.runId)saveStatus.textContent='Resultado pendiente de envío. Se reintentará con conexión.';});
  }
  get('changeParticipant').addEventListener('click',()=>{
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
      lastResultId=null;saveStatus.hidden=true;
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
