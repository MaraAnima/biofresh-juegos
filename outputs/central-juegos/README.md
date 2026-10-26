# Central de juegos · Google Sheets + Apps Script

El paquete contiene el servidor, el puente de comunicación, un SDK común y el prompt para conectar otros juegos. La planilla está inicializada y el catálogo incluye **Fresh Slice** y **Puzzle**, ambos de Biofresh. **La central está publicada; Fresh Slice y `config-puzzle.js` ya tienen su endpoint y sus claves propias.** La configuración de Puzzle está también en `CONFIG-PUZZLE.md` y el mensaje listo para compartir está en `PROMPT-PUZZLE.md`.

**Conexión verificada en la planilla para ambos juegos.** Se recibieron registro, inicio y cierre de una prueba técnica de Puzzle y de una ronda jugada de Fresh Slice. En Fresh Slice, el resultado de Sheets coincidió con la pantalla: **1435 puntos, 54 ingredientes y mejor racha de 11**. La ronda quedó en una sola fila de Partidas, con el mismo participante, sesión e ID de partida que sus eventos. Las validaciones del servidor, SDK y formulario también pasaron en pruebas locales.

El **SDK 1.1.0** conserva la corrección del origen de los archivos locales e incorpora conexión anticipada, prioridad para inscripciones aún sin iniciar y confirmaciones por evento. Una respuesta ya recibida no espera a que termine toda la cola. `client.onReceipt(callback)` permite actualizar el estado cuando un reintento automático se confirma. Se mantienen el origen de Google, el nonce y la ventana verificada. Referencia: [Window.origin](https://developer.mozilla.org/en-US/docs/Web/API/Window/origin).

El servidor **1.1.0** agrupa las lecturas antes de escribir y guarda en caché solo pistas numéricas de filas. Cada pista se verifica contra la clave de la fila; marca, clave pública y estado activo se leen de Sheets en cada solicitud, así que desactivar un juego tiene efecto sin esperar a que venza una caché de permisos. Una caché ausente o desactualizada no impide guardar ni duplica participantes. Esta mejora sigue las [recomendaciones de rendimiento de Google](https://developers.google.com/apps-script/guides/support/best-practices).

Esto reduce trabajo y espera visible; no garantiza escrituras instantáneas en Google. No se midió aún la latencia real de esta actualización ni su capacidad con concurrencia alta.

## Publicación inicial

1. Este proyecto ya está cargado en [Central de juegos · Biofresh](https://script.google.com/u/0/home/projects/1A0mevS0lTqxqBwN3tuPWS5ley_bgFb4nIgoJt9MNi2lkhooIdokfcl9g/edit), asociado a [Base de datos - Juegos](https://docs.google.com/spreadsheets/d/1z_p7Xqqwh2WKjDwiDt4U5RxOOsyOth5DGzNQLdtE3N0/edit). Para una instalación nueva, creá tu propio proyecto.
2. Pegá `Code.gs` en el archivo de código. Creá tres archivos HTML: **Bridge**, **Integracion** y **SDK**; pegá el contenido de los archivos `.html` correspondientes.
3. En Configuración del proyecto, activá la vista del archivo de manifiesto y reemplazá `appsscript.json` por el del paquete.
4. `INITIAL_SPREADSHEET_ID_` ya apunta a la planilla elegida por el propietario. Para otra instalación, reemplazalo por su ID o dejalo vacío para crear una nueva. La propiedad de script **SPREADSHEET_ID**, si existe, tiene prioridad.
5. Las funciones terminadas en `_` no aparecen en el selector del editor. Para inicializar, agregá temporalmente `function prepararCentral(){ return configurarCentral_(); }`, guardá y ejecutá **prepararCentral**. El propietario debe autorizar el acceso a Sheets. La función crea las pestañas sin borrar datos existentes. **Retirá esa función temporal y guardá antes de publicar**. Los enlaces aparecen en el registro de ejecución.
6. Abrí **Implementar → Nueva implementación → Aplicación web**. Elegí ejecutar como el propietario y acceso de **Cualquier persona**, incluso sin iniciar sesión. La planilla no se comparte públicamente. Si la cuenta de Workspace no permite acceso anónimo, el administrador debe habilitar una modalidad de publicación compatible; no elijas acceso solo al dominio para un juego público.
7. Copiá la URL que termina en `/exec`. Abrila: debe responder `{"ok":true,"service":"gamehub",...}`. Usá la implementación, no la URL `/dev` del editor.
8. En la pestaña **Juegos**, copiá `clave_publica` de la fila `biofresh-fresh-slice`. Completá `endpoint` y `gameKey` en `platform-config.js`; poné `allowPreview:false`. Para el HTML único del juego, regenerá el paquete o pasale esos dos valores a quien lo mantiene.
9. Probá un registro de prueba y una partida. Confirmá filas en **Participantes**, **Eventos** y **Partidas**. Reintentá el mismo evento: no debe crear otra fila.

**Enlace para compartir con otros desarrolladores:**

[Guía de integración y prompt](https://script.google.com/macros/s/AKfycbyEasUVM53vQA3QbCkak3Zqg_pMYvFBLZlWmQr30YZL7gNeTYYzPVfv1WCBIoY2rdam/exec?view=integracion)

Ese enlace reúne instrucciones, un prompt listo para copiar y acceso al SDK. No muestra datos personales ni las claves del catálogo. El endpoint se obtuvo del diálogo de publicación de Google; no se dedujo de una URL `/dev`.

## Estructura de la planilla

| Pestaña | Contenido |
| --- | --- |
| Juegos | IDs únicos, marca, nombre comercial, clave pública de integración y estado activo. |
| Participantes | Una persona por teléfono normalizado; ID derivado con HMAC y sal privada del servidor. |
| Partidas | Una fila por `gameId + runId`, con usuario, marca, juego, puntaje, duración y estado. |
| Eventos | Historial de registros, inicios y finales, con ID de envío y huella para detectar duplicados. |

Los celulares se conservan como texto internacional, no como números. Los textos se protegen frente a fórmulas de planilla. Las escrituras usan `LockService`; los reintentos conservan el ID del evento. La marca y el nombre comercial guardados se toman del catálogo del servidor, no de valores libres enviados por el navegador.

## Agregar otro juego

Agregá una fila en la pestaña **Juegos**, respetando los encabezados. Usá un `game_id` en minúsculas y con guiones que no exista, por ejemplo `biofresh-memoria`, su `brand_id`, marca, nombre comercial, una UUID nueva como `clave_publica` y `TRUE` en `activo`. Para otra marca, asigná su propio ID y nombre. También podés editar **agregarOtroJuego_** y ejecutarla con una función temporal del editor, retirando esa función antes de actualizar la implementación.

La función crea una clave de integración y devuelve la configuración. Compartí con el compañero **solo la URL `/exec`, la configuración de su juego y el enlace `?view=integracion`**. No necesita acceso a los celulares ni editar el servidor. También se puede administrar el catálogo desde la pestaña Juegos, respetando sus encabezados.

La clave es pública porque vive en el navegador: identifica el juego y ayuda a rechazar mezclas de configuración; **no prueba quién juega ni garantiza que un puntaje sea auténtico**. No otorgar premios automáticamente basándose solo en estos datos. Para tráfico masivo o promociones con premios, usar un backend con controles adicionales y verificar las cuotas vigentes de Apps Script.

## Uso del SDK

```js
const client = new GameHub.Client({
  endpoint: 'https://script.google.com/macros/s/IMPLEMENTACION/exec',
  gameKey: 'CLAVE_DE_ESE_JUEGO',
  brandId: 'biofresh', brandName: 'Biofresh',
  gameId: 'ID-UNICO-DEL-JUEGO', gameName: 'Nombre del juego',
  gameVersion: '1.0.0', allowPreview: false
});
const participant = {
  name: GameHub.normalizeName(nombreIngresado),
  phone: GameHub.normalizePhone(celularIngresado, '598')
};
const sessionId = GameHub.uuid();
const registration = client.event('registration', { participant, sessionId, metrics: {} });
const ack = await client.send(registration);
if (!ack.ok) throw new Error('No hay registro confirmado');
// Recién ahora permitir jugar.
const runId = GameHub.uuid();
await client.send(client.event('game_started', { participant, sessionId, runId, metrics: {} }));
await client.send(client.event('game_completed', {
  participant, sessionId, runId,
  metrics: { score: puntajeFinal, durationSeconds: segundosJugados, finishReason: 'time' }
}));
```

Tipos admitidos: `registration`, `game_started`, `game_completed`, `game_abandoned`. Cada reintento de un mismo envío conserva `eventId`, fecha y contenido. Cada ronda nueva tiene otro `runId`. No reenviar como nuevo un evento que quedó pendiente.

El SDK usa un iframe oculto con un nonce, verifica el origen de Google y la ventana de respuesta, y confirma la escritura con `google.script.run`. Sirve para juegos HTML locales y juegos alojados, sin poner datos personales en la URL y sin tratar una respuesta opaca como éxito. Las respuestas solo contienen confirmación e identificadores; el servidor no ofrece búsquedas públicas de personas.

Los envíos no confirmados se guardan en **sessionStorage** de la pestaña con un límite de 80 y vencimiento de 6 horas. Se eliminan al confirmarse. Los reintentos automáticos de Fresh Slice ocurren con conexión cada 20 segundos. Cerrar definitivamente la pestaña puede eliminar esa cola; la inscripción en producción exige confirmación antes de jugar. No se promete entrega offline al cerrar la pestaña.

## Fresh Slice

El primer paso pide nombre y celular, ambos obligatorios. Las instrucciones se abren inmediatamente después de validar esos campos, mientras llega la confirmación de registro. La ronda solo se habilita cuando la central confirma el registro; si falla, vuelve al formulario conservando los datos para reintentar. Con el país por defecto Uruguay, `099 123 456` se normaliza a formato `+598…`; para otros países, se ingresa el prefijo internacional. Es una validación de formato, no una verificación por SMS.

El botón **Cambiar participante** limpia el formulario y crea una sesión nueva. Las repeticiones dentro de una misma participación conservan al participante y generan otra partida. El resultado incluye puntaje, duración activa (sin pausas), ingredientes cortados, mejor racha y cortes de bonus.

Mientras el endpoint y la clave estén vacíos y `allowPreview:true`, se muestra **Modo de prueba: los datos no se envían**. Nunca se indica que una prueba local haya sido guardada en la central.

## Fuentes técnicas

- [Aplicaciones web de Apps Script](https://developers.google.com/apps-script/guides/web)
- [Comunicación con funciones del servidor](https://developers.google.com/apps-script/guides/html/communication)
- [HTML y opciones de iframe](https://developers.google.com/apps-script/reference/html/html-output)
- [Servicio de contenido y redirecciones](https://developers.google.com/apps-script/guides/content)
