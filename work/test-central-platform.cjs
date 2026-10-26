const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const dir=path.resolve(__dirname,'../outputs/central-juegos');
const operations=[];
class Range{
  constructor(sheet,row,col,rows=1,cols=1){Object.assign(this,{sheet,row,col,rows,cols});}
  getValues(){operations.push('read');return Array.from({length:this.rows},(_,r)=>Array.from({length:this.cols},(_,c)=>this.sheet.data[this.row+r-1]?.[this.col+c-1]??''));}
  getValue(){return this.getValues()[0][0];}
  setValues(values){operations.push('write');values.forEach((row,r)=>row.forEach((value,c)=>{(this.sheet.data[this.row+r-1]||=[])[this.col+c-1]=value;}));return this;}
  setBackground(){return this;}setFontColor(){return this;}setFontWeight(){return this;}
  createTextFinder(value){operations.push('search');const range=this;return{matchEntireCell(){return this;},useRegularExpression(){return this;},findNext(){for(let r=0;r<range.rows;r++){if(String(range.sheet.data[range.row+r-1]?.[range.col-1])===value)return{getRow:()=>range.row+r};}return null;}};}
}
class Sheet{constructor(){this.data=[];}getRange(...args){return new Range(this,...args);}getLastRow(){operations.push('read');return this.data.length;}appendRow(row){operations.push('write');this.data.push([...row]);}setFrozenRows(){}}
const sheets=new Map(),props=new Map(),rowCache=new Map();let busy=false,cacheUnavailable=false;
const book={getId:()=> 'local-test-book',getUrl:()=> 'https://docs.google.com/spreadsheets/d/local-test-book/edit',setSpreadsheetTimeZone(){},getSheetByName:n=>sheets.get(n),insertSheet:n=>{const sheet=new Sheet();sheets.set(n,sheet);return sheet;}};
const server={console:{log(){}},Date,JSON,Math,Number,String,Error,Array,Object,
  PropertiesService:{getScriptProperties:()=>({getProperties:()=>Object.fromEntries(props),getProperty:k=>props.get(k)||null,setProperty:(k,v)=>{props.set(k,v);}})},
  SpreadsheetApp:{create:()=>book,openById:()=>book,flush(){operations.push('flush');}},
  CacheService:{getScriptCache:()=>({get:key=>{if(cacheUnavailable)throw new Error('cache offline');return rowCache.get(key)||null;},put:(key,value)=>{if(cacheUnavailable)throw new Error('cache offline');rowCache.set(key,value);}})},
  ScriptApp:{getScriptId:()=> 'test-script',getService:()=>({getUrl:()=> 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec'})},
  LockService:{getScriptLock:()=>{let held=false;return{waitLock(){held=true;},tryLock(){held=!busy;return held;},hasLock:()=>held,releaseLock(){held=false;}};}},
  Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},computeDigest:(_,text)=>[...crypto.createHash('sha256').update(text).digest()],computeHmacSha256Signature:(text,key)=>[...crypto.createHmac('sha256',key).update(text).digest()]},
  ContentService:{MimeType:{JSON:'JSON',JAVASCRIPT:'JAVASCRIPT'},createTextOutput:value=>({value,setMimeType(){return this;}})}
};
vm.createContext(server);vm.runInContext(fs.readFileSync(path.join(dir,'Code.gs'),'utf8'),server);
server.configurarCentral_();server.configurarCentral_();
assert.strictEqual(sheets.get('Juegos').data.length,2,'La configuración repetida debe conservar el catálogo');
const key=sheets.get('Juegos').data[1][4],session=crypto.randomUUID(),run=crypto.randomUUID();
const participant={name:'Participante de prueba',phone:'+59899123456'};
const event=(type,extra={})=>Object.assign({schemaVersion:1,eventId:crypto.randomUUID(),type,brandId:'biofresh',brandName:'Marca falsa del cliente',gameId:'biofresh-fresh-slice',gameName:'Nombre falso',gameKey:key,gameVersion:'1.0.0',participant,sessionId:session,runId:type==='registration'?'':run,occurredAt:new Date().toISOString(),metrics:{}},extra);
const registration=event('registration');assert.strictEqual(server.recibirEvento(registration).ok,true);
assert.strictEqual(server.recibirEvento(registration).duplicate,true);
assert.strictEqual(sheets.get('Eventos').data.length,2);
assert.strictEqual(sheets.get('Eventos').data[1][5],'Biofresh');assert.strictEqual(sheets.get('Eventos').data[1][6],'Fresh Slice');
assert.strictEqual(sheets.get('Participantes').data[1][1],"'+59899123456",'El celular debe escribirse como texto seguro');
assert.strictEqual(server.recibirEvento({...registration,participant:{...participant,name:'Otra persona'}}).error.code,'EVENT_CONFLICT');
assert.strictEqual(server.recibirEvento(event('game_started')).ok,true);
operations.length=0;
assert.strictEqual(server.recibirEvento(event('game_completed',{metrics:{score:70,durationSeconds:35,finishReason:'time'}})).ok,true);
assert.strictEqual(operations.filter(x=>x==='search').length,1,'Con la caché preparada solo debe buscarse el nuevo ID de evento');
assert(!operations.slice(operations.indexOf('write')).includes('read'),'Todas las lecturas deben terminar antes de las escrituras');
assert.strictEqual(server.recibirEvento(event('game_started')).ok,true);
assert.strictEqual(sheets.get('Partidas').data[1][10],'completada','Un inicio tardío no debe borrar el final');
assert.strictEqual(sheets.get('Partidas').data[1][13],70);
assert.strictEqual(server.recibirEvento(event('game_completed',{metrics:{score:'=1+1'}})).error.code,'INVALID_SCORE');
assert.strictEqual(server.recibirEvento(event('registration',{gameKey:'invalid-key'})).error.code,'INVALID_GAME_KEY');
assert.strictEqual(server.recibirEvento(event('registration',{brandId:'other-brand'})).error.code,'BRAND_MISMATCH');
busy=true;assert.strictEqual(server.recibirEvento(event('registration')).error.retryable,true);busy=false;
const second=server.registrarJuego_({gameId:'another-game',brandId:'another-brand',brandName:'Otra marca',gameName:'Otro juego'});
assert.strictEqual(server.recibirEvento(event('registration',{gameId:second.gameId,gameKey:second.gameKey,brandId:'another-brand'})).ok,true);
assert.strictEqual(sheets.get('Participantes').data.length,2,'El mismo teléfono debe identificar al participante entre juegos');
const unsafeName=event('registration',{participant:{name:'=HYPERLINK("x")',phone:'+59898123456'}});
assert.strictEqual(server.recibirEvento(unsafeName).ok,true);
assert(sheets.get('Participantes').data.at(-1)[2].startsWith("'="),'El nombre no debe convertirse en fórmula');
const participantRows=sheets.get('Participantes').data;
[participantRows[1],participantRows[2]]=[participantRows[2],participantRows[1]];
assert.strictEqual(server.recibirEvento(event('registration')).ok,true,'Reordenar filas debe invalidar las pistas antiguas');
assert.strictEqual(participantRows.length,3,'Una pista desactualizada no debe duplicar participantes');
const catalog=sheets.get('Juegos').data;catalog[1][5]=false;
assert.strictEqual(server.recibirEvento(event('registration')).error.code,'DISABLED_GAME','La caché no debe conservar permisos antiguos');catalog[1][5]=true;
cacheUnavailable=true;assert.strictEqual(server.recibirEvento(event('registration')).ok,true,'El guardado debe funcionar sin caché');cacheUnavailable=false;
assert([...rowCache.values()].every(value=>/^\d+$/.test(value)),'La caché solo debe guardar números de fila');
const health=JSON.parse(server.doGet({parameter:{}}).value);assert(!JSON.stringify(health).includes(participant.phone));
assert.strictEqual(JSON.parse(server.doPost({postData:{contents:'not-json'}}).value).ok,false);

const storageData=new Map(),storage={getItem:k=>storageData.get(k)||null,setItem:(k,v)=>storageData.set(k,v)};
const root={crypto:{randomUUID:()=>crypto.randomUUID()},addEventListener(){},setTimeout,clearTimeout,sessionStorage:storage};
const sdkContext={window:root,console,URL,Map,Date,JSON,Math,Error};vm.createContext(sdkContext);
vm.runInContext(fs.readFileSync(path.join(dir,'shared-sdk.js'),'utf8'),sdkContext);
const hub=root.GameHub;
assert.strictEqual(hub.normalizePhone('099 123 456'),'+59899123456');assert.strictEqual(hub.normalizePhone('+54 (11) 1234-5678'),'+541112345678');
assert.throws(()=>hub.normalizeName(' '));assert.throws(()=>hub.normalizePhone('abc'));
const config={endpoint:'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec',gameKey:key,brandId:'biofresh',brandName:'Biofresh',gameId:'biofresh-fresh-slice',gameName:'Fresh Slice',gameVersion:'1.0.0'};

async function checkBridgeOrigin(location,windowOrigin,expected){
  const previousLocation=root.location,previousOrigin=root.origin,previousDocument=root.document;
  root.location=location;if(windowOrigin===undefined)delete root.origin;else root.origin=windowOrigin;
  let frame;
  root.document={createElement:()=>({setAttribute(){},remove(){}}),body:{appendChild(value){frame=value;}}};
  const client=new hub.Client(config,{storage:null}),connection=client._connect();
  try{
    assert.strictEqual(new URL(frame.src).searchParams.get('parentOrigin'),expected);
    client._message({data:{channel:'gamehub.v1',type:'ready',nonce:client.nonce},origin:'https://example-script.googleusercontent.com',source:{postMessage(){}}});
    await connection;
  }finally{clearTimeout(client.connectTimer);root.location=previousLocation;root.origin=previousOrigin;root.document=previousDocument;}
}

(async()=>{
  await checkBridgeOrigin({protocol:'file:',origin:'file://'},'null','null');
  await checkBridgeOrigin({protocol:'file:',origin:'file://'},'file://','null');
  await checkBridgeOrigin({protocol:'file:',origin:'file://'},undefined,'null');
  await checkBridgeOrigin({protocol:'https:',origin:'https://game.example'},'https://game.example','https://game.example');
  await checkBridgeOrigin({protocol:'https:',origin:'https://game.example'},'null','null');
  let releaseFirst,releaseSecond;
  const isolated=new hub.Client(config,{storage:null,transport:payload=>new Promise(resolve=>{
    const reply=()=>resolve({ok:true,eventId:payload.eventId});
    if(!releaseFirst)releaseFirst=reply;else releaseSecond=reply;
  })});
  const isolatedFirst=isolated.event('game_started',{participant,sessionId:crypto.randomUUID(),runId:crypto.randomUUID(),metrics:{}});
  const isolatedSecond=isolated.event('game_completed',{participant,sessionId:crypto.randomUUID(),runId:crypto.randomUUID(),metrics:{}});
  const firstAck=isolated.send(isolatedFirst),secondAck=isolated.send(isolatedSecond);
  await Promise.resolve();await Promise.resolve();releaseFirst();
  assert.strictEqual((await firstAck).eventId,isolatedFirst.eventId,'Cada envío debe resolverse con su confirmación, sin esperar toda la cola');
  assert.strictEqual(isolated.queue.length,1);releaseSecond();await secondAck;
  const order=[];
  const priority=new hub.Client(config,{storage:null,transport:async payload=>{order.push(payload.eventId);return{ok:true,eventId:payload.eventId};}});
  priority.queue.push({queuedAt:Date.now(),event:isolatedSecond});
  const incoming=priority.event('registration',{participant,sessionId:crypto.randomUUID(),metrics:{}});
  await priority.send(incoming);await priority.flush();
  assert.strictEqual(order[0],incoming.eventId,'Una inscripción nueva debe adelantarse a los envíos todavía sin iniciar');
  const boundary=new hub.Client(config,{storage:null,transport:async payload=>({ok:true,eventId:payload.eventId})});
  const boundaryResult=await boundary.send(isolatedFirst).then(()=>boundary.send(isolatedSecond));
  assert.strictEqual(boundaryResult.eventId,isolatedSecond.eventId,'No debe quedar detenido un envío iniciado al recibir la confirmación anterior');
  let calls=0;const client=new hub.Client(config,{storage,transport:async payload=>{const response=server.recibirEvento(payload);if(++calls===1)throw new Error('lost acknowledgment');return response;}});
  const payload=client.event('registration',{participant,sessionId:crypto.randomUUID(),metrics:{}}),before=sheets.get('Eventos').data.length;
  await assert.rejects(client.send(payload));assert.strictEqual(client.queue.length,1);
  assert.strictEqual((await client.send(payload)).duplicate,true);assert.strictEqual(client.queue.length,0);
  assert.strictEqual(sheets.get('Eventos').data.length,before+1,'La pérdida de una confirmación no debe duplicar datos');
  const preview=new hub.Client({...config,endpoint:'',gameKey:'',allowPreview:true},{storage:null});
  assert.strictEqual((await preview.send(payload)).preview,true);
  let resolved=false;const bridgeWindow={};client.nonce=crypto.randomUUID();client.bridgeWindow=bridgeWindow;client.bridgeOrigin='https://example-script.googleusercontent.com';
  client.pending.set('request',{timer:setTimeout(()=>{},1000),resolve:()=>{resolved=true;}});
  const message={channel:'gamehub.v1',type:'ack',nonce:client.nonce,requestId:'request',response:{ok:true}};
  client._message({data:message,origin:'https://evil.example',source:bridgeWindow});assert.strictEqual(resolved,false);
  client._message({data:message,origin:client.bridgeOrigin,source:{}});assert.strictEqual(resolved,false);
  client._message({data:message,origin:client.bridgeOrigin,source:bridgeWindow});assert.strictEqual(resolved,true);

  class Element{constructor(){this.hidden=true;this.value='';this.textContent='';this.listeners={};this.attributes={};}addEventListener(type,fn){this.listeners[type]=fn;}setAttribute(k,v){this.attributes[k]=v;}focus(){}emit(type){return this.listeners[type]({preventDefault(){}});}}
  const elements={};const get=id=>elements[id]||(elements[id]=new Element());
  let fail=true,hold=false,releaseRegistration,formClient;const sent=[];
  class FormClient{constructor(){this.configured=true;this.preview=false;formClient=this;}onReceipt(listener){this.listener=listener;}event(type,details){return{eventId:crypto.randomUUID(),type,...details};}send(payload){sent.push(payload);return hold&&payload.type==='registration'?new Promise(resolve=>{releaseRegistration=resolve;}):Promise.resolve(fail?{ok:false,error:{message:'Intentá nuevamente.'}}:{ok:true});}flush(){return Promise.resolve();}}
  const browser={GameHub:{...hub,Client:FormClient},GAME_PLATFORM_CONFIG:{defaultCallingCode:'598'},dispatchEvent(){},setInterval(){}};
  const formContext={window:browser,document:{getElementById:get},CustomEvent:class{constructor(type){this.type=type;}},console};
  vm.runInNewContext(fs.readFileSync(path.resolve(dir,'../biofresh-fresh-slice/registration.js'),'utf8'),formContext);
  assert.strictEqual(browser.BIOFRESH_REGISTRATION.isReady(),false);
  await get('participantForm').emit('submit');assert.strictEqual(sent.length,0,'No se deben enviar campos vacíos');
  get('participantName').value='Usuario de prueba';get('participantPhone').value='099 123 456';
  await get('participantForm').emit('submit');assert.strictEqual(browser.BIOFRESH_REGISTRATION.isReady(),true,'Los datos válidos habilitan jugar aunque el envío no esté confirmado');
  assert.strictEqual(get('registrationPanel').hidden,true,'Un fallo de red no devuelve al participante al formulario');
  fail=false;await get('participantForm').emit('submit');assert.strictEqual(sent[0].eventId,sent[1].eventId,'Reintentar el formulario conserva el envío');
  assert.strictEqual(browser.BIOFRESH_REGISTRATION.isReady(),true);assert.strictEqual(get('tutorialFlow').hidden,false);
  browser.BIOFRESH_REGISTRATION.startRun();browser.BIOFRESH_REGISTRATION.complete({score:55,durationSeconds:35});
  await Promise.resolve();assert.strictEqual(sent.at(-1).runId,sent.at(-2).runId);assert.strictEqual(sent.at(-1).metrics.score,55);
  get('changeParticipant').emit('click');assert.strictEqual(browser.BIOFRESH_REGISTRATION.isReady(),false);assert.strictEqual(get('participantPhone').value,'');
  hold=true;get('participantName').value='Otra prueba';get('participantPhone').value='098 123 456';
  const submitting=get('participantForm').emit('submit');
  assert.strictEqual(get('tutorialFlow').hidden,false,'El tutorial debe abrirse antes de recibir la respuesta');
  assert.strictEqual(get('registrationPanel').hidden,true);
  assert.strictEqual(browser.BIOFRESH_REGISTRATION.require(),true,'Jugar no debe esperar la respuesta del registro');
  assert.strictEqual(browser.BIOFRESH_REGISTRATION.startRun(),true,'La ronda arranca con la inscripción todavía en vuelo');
  browser.BIOFRESH_REGISTRATION.complete({score:42});
  assert.strictEqual(sent.at(-1).runId,sent.at(-2).runId,'Los eventos mantienen la partida aunque el registro esté pendiente');
  assert.strictEqual(get('tutorialFlow').hidden,false,'El registro pendiente no debe interrumpir el juego');
  releaseRegistration({ok:true});await submitting;hold=false;
  assert.strictEqual(browser.BIOFRESH_REGISTRATION.isReady(),true);
  browser.BIOFRESH_REGISTRATION.startRun();fail=true;browser.BIOFRESH_REGISTRATION.complete({score:10});await Promise.resolve();
  const retryResult=sent.at(-1);formClient.listener({ok:true,eventId:retryResult.eventId});
  assert.strictEqual(get('saveStatus').textContent,'Resultado guardado.','Una confirmación de reintento debe actualizar la pantalla final');
  hold=true;fail=false;get('changeParticipant').emit('click');get('participantName').value='Persona anterior';get('participantPhone').value='097 123 456';
  const oldSubmission=get('participantForm').emit('submit'),releaseOld=releaseRegistration;
  get('changeParticipant').emit('click');get('participantName').value='Persona actual';get('participantPhone').value='096 123 456';
  const newSubmission=get('participantForm').emit('submit'),releaseNew=releaseRegistration;
  releaseOld({ok:false,error:{message:'Fallo antiguo.'}});await oldSubmission;
  assert.strictEqual(browser.BIOFRESH_REGISTRATION.isReady(),true,'Una respuesta antigua no revoca a la persona actual');
  assert.strictEqual(get('registrationPanel').hidden,true);
  releaseNew({ok:true});await newSubmission;hold=false;

  // Formulario, SDK real y servidor simulado con la conexión detenida hasta después de jugar.
  const liveElements={},liveGet=id=>liveElements[id]||(liveElements[id]=new Element());
  let releaseNetwork,integratedClient;
  const gate=new Promise(resolve=>{releaseNetwork=resolve;});
  class ConnectedClient extends hub.Client{constructor(){super(config,{storage:null,transport:async payload=>{await gate;return server.recibirEvento(payload);}});integratedClient=this;}}
  const integratedBrowser={GameHub:{...hub,Client:ConnectedClient},GAME_PLATFORM_CONFIG:{...config,defaultCallingCode:'598'},dispatchEvent(){},setInterval(){}};
  vm.runInNewContext(fs.readFileSync(path.resolve(dir,'../biofresh-fresh-slice/registration.js'),'utf8'),{window:integratedBrowser,document:{getElementById:liveGet},CustomEvent:class{},console});
  liveGet('participantName').value='Prueba sin espera';liveGet('participantPhone').value='095 123 456';
  const waitingSubmission=liveGet('participantForm').emit('submit');
  assert(integratedBrowser.BIOFRESH_REGISTRATION.startRun());
  integratedBrowser.BIOFRESH_REGISTRATION.complete({score:321,durationSeconds:35});
  const queued=integratedClient.queue.map(item=>item.event);
  assert.deepStrictEqual(queued.map(item=>item.type),['registration','game_started','game_completed']);
  assert.strictEqual(queued[0].sessionId,queued[2].sessionId);assert.strictEqual(queued[1].runId,queued[2].runId);
  assert.notStrictEqual(liveGet('saveStatus').textContent,'Resultado guardado.','Sin respuesta no debe afirmarse que el resultado se guardó');
  releaseNetwork();await waitingSubmission;await integratedClient.flush();await Promise.resolve();
  assert.strictEqual(integratedClient.queue.length,0);
  assert.strictEqual(liveGet('saveStatus').textContent,'Resultado guardado.');
  const savedRun=sheets.get('Partidas').data.find(row=>row[1]===queued[2].runId);
  assert.strictEqual(savedRun[10],'completada');assert.strictEqual(savedRun[13],321);
  console.log('OK: servidor multijuego, caché verificada, privacidad, reintentos, campos obligatorios y partida inmediata con registro e inicio/resultado en cola.');
})().catch(error=>{console.error(error);process.exitCode=1});
