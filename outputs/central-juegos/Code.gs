/** Central de juegos v1. Todas las funciones administrativas terminan en _. */
const HUB_VERSION_='1.0.0';
// Recursos elegidos por el propietario. Se usan solo durante la configuración inicial.
const INITIAL_SPREADSHEET_ID_='1z_p7Xqqwh2WKjDwiDt4U5RxOOsyOth5DGzNQLdtE3N0';
const INITIAL_FRESH_SLICE_KEY_='474b9773-05d0-4cd9-a93d-8147d3129e88';
const HEADERS_={
  Juegos:['game_id','brand_id','marca','juego','clave_publica','activo'],
  Participantes:['participante_id','celular','nombre','creado_utc','actualizado_utc'],
  Partidas:['run_key','partida_id','game_id','brand_id','marca','juego','participante_id','nombre','celular','sesion_id','estado','inicio_utc','fin_utc','puntaje','duracion_segundos','motivo_fin','metricas_json'],
  Eventos:['evento_id','recibido_utc','tipo','game_id','brand_id','marca','juego','participante_id','nombre','celular','sesion_id','partida_id','fecha_cliente_utc','version_juego','metricas_json','payload_hash']
};

/** Ejecutar UNA VEZ desde el editor. Puede ejecutarse otra vez sin borrar datos. */
function configurarCentral_(){
  const properties=PropertiesService.getScriptProperties();
  let id=properties.getProperty('SPREADSHEET_ID')||INITIAL_SPREADSHEET_ID_;
  const book=id?SpreadsheetApp.openById(id):SpreadsheetApp.create('Central de juegos · Participantes y resultados');
  if(!properties.getProperty('SPREADSHEET_ID'))properties.setProperty('SPREADSHEET_ID',book.getId());
  if(!properties.getProperty('PARTICIPANT_SALT'))properties.setProperty('PARTICIPANT_SALT',Utilities.getUuid()+Utilities.getUuid());
  book.setSpreadsheetTimeZone('America/Montevideo');
  Object.keys(HEADERS_).forEach(name=>ensureSheet_(book,name));
  const games=book.getSheetByName('Juegos');
  if(!findRow_(games,1,'biofresh-fresh-slice')){
    games.appendRow(['biofresh-fresh-slice','biofresh','Biofresh','Fresh Slice',INITIAL_FRESH_SLICE_KEY_||Utilities.getUuid(),true]);
  }
  const result={planilla:book.getUrl(),proyecto:'https://script.google.com/home/projects/'+ScriptApp.getScriptId()+'/edit',endpoint:ScriptApp.getService().getUrl()||'Publicar como aplicación web para obtener /exec'};
  console.log(JSON.stringify(result));return result;
}

/** Editar estos valores y ejecutar desde el editor para dar de alta otro juego. */
function agregarOtroJuego_(){
  return registrarJuego_({gameId:'CAMBIAR-ID-DEL-JUEGO',brandId:'biofresh',brandName:'Biofresh',gameName:'CAMBIAR NOMBRE DEL JUEGO'});
}
function registrarJuego_(game){
  if(String(game.gameId).indexOf('CAMBIAR')>=0||String(game.gameName).indexOf('CAMBIAR')>=0)throw new Error('Completá los datos reales del nuevo juego.');
  validId_(game.gameId,'gameId');validId_(game.brandId,'brandId');
  text_(game.gameName,2,80);text_(game.brandName,2,80);
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const sheet=book_().getSheetByName('Juegos');
    if(findRow_(sheet,1,game.gameId))throw new Error('Ya existe ese gameId. Editá su fila en Juegos si necesitás cambiarlo.');
    const key=Utilities.getUuid();
    sheet.appendRow([game.gameId,game.brandId,safeText_(game.brandName),safeText_(game.gameName),key,true]);
    return{gameId:game.gameId,gameKey:key,endpoint:ScriptApp.getService().getUrl()};
  }finally{lock.releaseLock();}
}

function doGet(e){
  const p=e&&e.parameter||{};
  if(p.view==='bridge'){
    if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(p.nonce||''))return json_({ok:false,error:{code:'INVALID_NONCE'}});
    const origin=String(p.parentOrigin||'');
    if(origin!=='null'&&!/^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin))return json_({ok:false,error:{code:'INVALID_ORIGIN'}});
    const template=HtmlService.createTemplateFromFile('Bridge');template.nonce=p.nonce;template.parentOrigin=origin;
    return template.evaluate().setTitle('Conexión de juegos').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if(p.view==='sdk'){
    const source=HtmlService.createHtmlOutputFromFile('SDK').getContent().replace(/^\s*<script>\s*/,'').replace(/\s*<\/script>\s*$/,'');
    return ContentService.createTextOutput(source).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  if(p.view==='integracion'){
    const template=HtmlService.createTemplateFromFile('Integracion');template.endpoint=ScriptApp.getService().getUrl()||'';
    return template.evaluate().setTitle('Central de juegos · Integración').addMetaTag('viewport','width=device-width, initial-scale=1');
  }
  return json_({ok:true,service:'gamehub',schemaVersion:1,version:HUB_VERSION_});
}
function doPost(e){
  try{
    const raw=e&&e.postData&&e.postData.contents||'';
    if(!raw||raw.length>24000)throw hubError_('INVALID_PAYLOAD','Solicitud inválida.',false);
    return json_(recibirEvento(JSON.parse(raw)));
  }catch(_){return json_({ok:false,eventId:'',error:{code:'INVALID_PAYLOAD',message:'Solicitud inválida.',retryable:false}});}
}

/** Único método público usado por google.script.run. Repite todas las validaciones. */
function recibirEvento(input){
  let eventId='';let lock;
  try{
    eventId=String(input&&input.eventId||'').slice(0,64);
    const event=validateEvent_(input);
    lock=LockService.getScriptLock();
    if(!lock.tryLock(10000))throw hubError_('BUSY','Volvé a intentar.',true);
    const book=book_(),games=book.getSheetByName('Juegos');
    const gameRow=findRow_(games,1,event.gameId);
    if(!gameRow)throw hubError_('UNKNOWN_GAME','Juego no habilitado.',false);
    const game=games.getRange(gameRow,1,1,6).getValues()[0];
    if(game[5]!==true&&String(game[5]).toLowerCase()!=='true')throw hubError_('DISABLED_GAME','Juego no habilitado.',false);
    if(String(game[4])!==event.gameKey)throw hubError_('INVALID_GAME_KEY','Configuración del juego inválida.',false);
    if(String(game[1])!==event.brandId)throw hubError_('BRAND_MISMATCH','Marca del juego inválida.',false);
    const hash=hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(event),Utilities.Charset.UTF_8));
    const events=book.getSheetByName('Eventos'),existingEvent=findRow_(events,1,event.eventId);
    if(existingEvent){
      const saved=events.getRange(existingEvent,1,1,16).getValues()[0];
      if(String(saved[15])!==hash)throw hubError_('EVENT_CONFLICT','El identificador del envío ya fue utilizado.',false);
      return{ok:true,eventId:event.eventId,duplicate:true,receivedAt:String(saved[1]),schemaVersion:1};
    }
    const now=new Date().toISOString();
    const participantId='p_'+hex_(Utilities.computeHmacSha256Signature(event.participant.phone,PropertiesService.getScriptProperties().getProperty('PARTICIPANT_SALT'))).slice(0,32);
    const participants=book.getSheetByName('Participantes');
    const participantRow=findRow_(participants,1,participantId);
    const created=participantRow?participants.getRange(participantRow,4).getValue():now;
    const participantValues=[participantId,safeText_(event.participant.phone),safeText_(event.participant.name),String(created),now];
    if(participantRow)participants.getRange(participantRow,1,1,5).setValues([participantValues]);else participants.appendRow(participantValues);
    if(event.type!=='registration')upsertRun_(book.getSheetByName('Partidas'),event,game,participantId,now);
    // La marca y el nombre del juego salen del catálogo del administrador.
    events.appendRow([event.eventId,now,event.type,event.gameId,String(game[1]),safeText_(String(game[2])),safeText_(String(game[3])),participantId,safeText_(event.participant.name),safeText_(event.participant.phone),event.sessionId,event.runId||'',event.occurredAt,safeText_(event.gameVersion),JSON.stringify(event.metrics),hash]);
    SpreadsheetApp.flush();
    return{ok:true,eventId:event.eventId,participantId,receivedAt:now,duplicate:false,schemaVersion:1};
  }catch(error){
    return{ok:false,eventId,error:{code:error.hubCode||'SERVER_ERROR',message:error.hubCode?error.message:'No se pudo guardar. Volvé a intentar.',retryable:error.hubCode?error.retryable:true}};
  }finally{if(lock&&lock.hasLock())lock.releaseLock();}
}

function upsertRun_(sheet,event,game,participantId,now){
  const key=event.gameId+'::'+event.runId,row=findRow_(sheet,1,key);
  const values=row?sheet.getRange(row,1,1,17).getValues()[0]:[key,event.runId,event.gameId,game[1],safeText_(String(game[2])),safeText_(String(game[3])),participantId,safeText_(event.participant.name),safeText_(event.participant.phone),event.sessionId,'iniciada','','',0,0,'','{}'];
  if(row&&(String(values[6])!==participantId||String(values[9])!==event.sessionId))throw hubError_('RUN_CONFLICT','La partida ya pertenece a otra participación.',false);
  if(event.type==='game_started'){
    if(!values[11])values[11]=now;
  }else if(values[10]!=='completada'){
    values[10]=event.type==='game_completed'?'completada':'abandonada';values[12]=now;
    values[13]=event.metrics.score||0;values[14]=event.metrics.durationSeconds||0;
    values[15]=safeText_(event.metrics.finishReason||'');values[16]=JSON.stringify(event.metrics);
  }
  if(row)sheet.getRange(row,1,1,17).setValues([values]);else sheet.appendRow(values);
}
function validateEvent_(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>24000)throw hubError_('INVALID_PAYLOAD','Solicitud inválida.',false);
  if(input.schemaVersion!==1)throw hubError_('INVALID_VERSION','Versión de integración inválida.',false);
  const id=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
  if(!id.test(input.eventId||'')||!id.test(input.sessionId||''))throw hubError_('INVALID_ID','Identificador inválido.',false);
  if(['registration','game_started','game_completed','game_abandoned'].indexOf(input.type)<0)throw hubError_('INVALID_TYPE','Evento inválido.',false);
  if(input.type!=='registration'&&!id.test(input.runId||''))throw hubError_('INVALID_RUN','Partida inválida.',false);
  validId_(input.gameId,'gameId');validId_(input.brandId,'brandId');
  if(!input.participant||typeof input.participant!=='object')throw hubError_('INVALID_PARTICIPANT','Completá tus datos.',false);
  const name=text_(input.participant.name,2,80).replace(/\s+/g,' '),phone=String(input.participant.phone||'');
  if(!/^\+[1-9]\d{7,14}$/.test(phone))throw hubError_('INVALID_PHONE','Celular inválido.',false);
  if(typeof input.occurredAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(input.occurredAt))throw hubError_('INVALID_DATE','Fecha inválida.',false);
  const date=new Date(input.occurredAt);if(!Number.isFinite(date.getTime()))throw hubError_('INVALID_DATE','Fecha inválida.',false);
  const metrics=input.metrics||{};
  if(typeof metrics!=='object'||Array.isArray(metrics)||Object.keys(metrics).length>20||JSON.stringify(metrics).length>4000)throw hubError_('INVALID_METRICS','Resultado inválido.',false);
  const cleanMetrics={};
  Object.keys(metrics).sort().forEach(key=>{
    const value=metrics[key];
    if(!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)||!['number','string','boolean'].includes(typeof value)||(typeof value==='number'&&!Number.isFinite(value))||(typeof value==='string'&&value.length>160))throw hubError_('INVALID_METRICS','Resultado inválido.',false);
    cleanMetrics[key]=value;
  });
  if(cleanMetrics.score!==undefined&&(!Number.isInteger(cleanMetrics.score)||cleanMetrics.score<0||cleanMetrics.score>1e9))throw hubError_('INVALID_SCORE','Puntaje inválido.',false);
  if(cleanMetrics.durationSeconds!==undefined&&(typeof cleanMetrics.durationSeconds!=='number'||cleanMetrics.durationSeconds<0||cleanMetrics.durationSeconds>86400))throw hubError_('INVALID_DURATION','Duración inválida.',false);
  return{schemaVersion:1,eventId:input.eventId,type:input.type,sessionId:input.sessionId,runId:input.runId||'',gameId:input.gameId,brandId:input.brandId,gameKey:text_(input.gameKey,8,100),gameVersion:text_(input.gameVersion||'1.0.0',1,30),participant:{name,phone},occurredAt:date.toISOString(),metrics:cleanMetrics};
}
function book_(){
  const properties=PropertiesService.getScriptProperties(),id=properties.getProperty('SPREADSHEET_ID');
  if(!id||!properties.getProperty('PARTICIPANT_SALT'))throw hubError_('NOT_CONFIGURED','La central todavía no está configurada.',true);
  return SpreadsheetApp.openById(id);
}
function ensureSheet_(book,name){
  const headers=HEADERS_[name],sheet=book.getSheetByName(name)||book.insertSheet(name);
  if(sheet.getLastRow()===0){sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1);sheet.getRange(1,1,1,headers.length).setBackground('#305c43').setFontColor('#ffffff').setFontWeight('bold');}
  else if(JSON.stringify(sheet.getRange(1,1,1,headers.length).getValues()[0])!==JSON.stringify(headers))throw new Error('Encabezados incompatibles en '+name+'. No se modificaron los datos.');
  return sheet;
}
function findRow_(sheet,column,value){
  if(sheet.getLastRow()<2)return 0;
  const cell=sheet.getRange(2,column,sheet.getLastRow()-1,1).createTextFinder(String(value)).matchEntireCell(true).useRegularExpression(false).findNext();
  return cell?cell.getRow():0;
}
function validId_(value,label){if(typeof value!=='string'||!/^[a-z0-9][a-z0-9-]{1,79}$/.test(value))throw hubError_('INVALID_ID',label+' inválido.',false);}
function text_(value,min,max){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))throw hubError_('INVALID_TEXT','Campo de texto inválido.',false);return value.trim();}
function safeText_(value){const text=String(value);return /^[=+\-@\t\r\n]/.test(text)?"'"+text:text;}
function hex_(bytes){return bytes.map(value=>('0'+(value&255).toString(16)).slice(-2)).join('');}
function hubError_(code,message,retryable){const error=new Error(message);error.hubCode=code;error.retryable=retryable;return error;}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
