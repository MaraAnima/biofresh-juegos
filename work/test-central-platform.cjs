const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const dir=path.resolve(__dirname,'../outputs/central-juegos');
class Range{
  constructor(sheet,row,col,rows=1,cols=1){Object.assign(this,{sheet,row,col,rows,cols});}
  getValues(){return Array.from({length:this.rows},(_,r)=>Array.from({length:this.cols},(_,c)=>this.sheet.data[this.row+r-1]?.[this.col+c-1]??''));}
  getValue(){return this.getValues()[0][0];}
  setValues(values){values.forEach((row,r)=>row.forEach((value,c)=>{(this.sheet.data[this.row+r-1]||=[])[this.col+c-1]=value;}));return this;}
  setBackground(){return this;}setFontColor(){return this;}setFontWeight(){return this;}
  createTextFinder(value){const range=this;return{matchEntireCell(){return this;},useRegularExpression(){return this;},findNext(){for(let r=0;r<range.rows;r++){if(String(range.sheet.data[range.row+r-1]?.[range.col-1])===value)return{getRow:()=>range.row+r};}return null;}};}
}
class Sheet{constructor(){this.data=[];}getRange(...args){return new Range(this,...args);}getLastRow(){return this.data.length;}appendRow(row){this.data.push([...row]);}setFrozenRows(){}}
const sheets=new Map(),props=new Map();let busy=false;
const book={getId:()=> 'local-test-book',getUrl:()=> 'https://docs.google.com/spreadsheets/d/local-test-book/edit',setSpreadsheetTimeZone(){},getSheetByName:n=>sheets.get(n),insertSheet:n=>{const sheet=new Sheet();sheets.set(n,sheet);return sheet;}};
const server={console:{log(){}},Date,JSON,Math,Number,String,Error,Array,Object,
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>{props.set(k,v);}})},
  SpreadsheetApp:{create:()=>book,openById:()=>book,flush(){}},
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
assert.strictEqual(server.recibirEvento(event('game_completed',{metrics:{score:70,durationSeconds:35,finishReason:'time'}})).ok,true);
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
  let fail=true;const sent=[];
  class FormClient{constructor(){this.configured=true;this.preview=false;}event(type,details){return{eventId:crypto.randomUUID(),type,...details};}send(payload){sent.push(payload);return Promise.resolve(fail?{ok:false,error:{message:'Intentá nuevamente.'}}:{ok:true});}flush(){return Promise.resolve();}}
  const browser={GameHub:{...hub,Client:FormClient},GAME_PLATFORM_CONFIG:{defaultCallingCode:'598'},dispatchEvent(){},setInterval(){}};
  const formContext={window:browser,document:{getElementById:get},CustomEvent:class{constructor(type){this.type=type;}},console};
  vm.runInNewContext(fs.readFileSync(path.resolve(dir,'../biofresh-fresh-slice/registration.js'),'utf8'),formContext);
  assert.strictEqual(browser.BIOFRESH_REGISTRATION.isReady(),false);
  await get('participantForm').emit('submit');assert.strictEqual(sent.length,0,'No se deben enviar campos vacíos');
  get('participantName').value='Usuario de prueba';get('participantPhone').value='099 123 456';
  await get('participantForm').emit('submit');assert.strictEqual(browser.BIOFRESH_REGISTRATION.isReady(),false,'Un registro rechazado no habilita jugar');
  fail=false;await get('participantForm').emit('submit');assert.strictEqual(sent[0].eventId,sent[1].eventId,'Reintentar el formulario conserva el envío');
  assert.strictEqual(browser.BIOFRESH_REGISTRATION.isReady(),true);assert.strictEqual(get('tutorialFlow').hidden,false);
  browser.BIOFRESH_REGISTRATION.startRun();browser.BIOFRESH_REGISTRATION.complete({score:55,durationSeconds:35});
  await Promise.resolve();assert.strictEqual(sent.at(-1).runId,sent.at(-2).runId);assert.strictEqual(sent.at(-1).metrics.score,55);
  get('changeParticipant').emit('click');assert.strictEqual(browser.BIOFRESH_REGISTRATION.isReady(),false);assert.strictEqual(get('participantPhone').value,'');
  console.log('OK: servidor multijuego, formato de teléfono, fórmulas, catálogo, duplicados, estado final, confirmaciones, cola, origen del puente y registro obligatorio.');
})().catch(error=>{console.error(error);process.exitCode=1});
