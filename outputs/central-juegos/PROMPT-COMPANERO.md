Compartí este mensaje junto con la configuración propia del juego. El SDK **1.0.1** está disponible en el enlace indicado y dentro del ZIP de integración; actualizá cualquier copia anterior para incorporar la corrección de conexión desde archivos locales.

---

Estamos conectando varios juegos a una única central de Google Sheets con Apps Script. Fresh Slice, de Biofresh, ya tiene preparada esta integración. Quiero que conectes mi juego al mismo protocolo.

Documentación y prompt online: `https://script.google.com/macros/s/AKfycbyEasUVM53vQA3QbCkak3Zqg_pMYvFBLZlWmQr30YZL7gNeTYYzPVfv1WCBIoY2rdam/exec?view=integracion`.
SDK común: `https://script.google.com/macros/s/AKfycbyEasUVM53vQA3QbCkak3Zqg_pMYvFBLZlWmQr30YZL7gNeTYYzPVfv1WCBIoY2rdam/exec?view=sdk`, también incluido como `shared-sdk.js` en el paquete.

Pedime la configuración de mi juego: `endpoint`, `gameKey`, `brandId`, `brandName`, `gameId` único y `gameName`. El administrador crea esa fila en Juegos. No reutilices el ID ni la clave de Fresh Slice y no crees otro backend independiente.

Implementá:

1. Un primer paso obligatorio con nombre y celular, antes de las instrucciones y de jugar. Mostrá que se registrarán esos datos y los resultados. Normalizá el teléfono al formato internacional; por defecto Uruguay, con opción de ingresar otro prefijo. No agregues suscripciones de marketing ni digas que el celular fue verificado por SMS.
2. Cargá el SDK, creá `GameHub.Client(config)` y enviá `registration`. No habilites jugar hasta recibir `ok:true` de la central en producción. Si hay un modo local de prueba, indicalo explícitamente y no lo marques como guardado.
3. Usá un `sessionId` por participación y un `runId` nuevo por ronda. Enviá `game_started` y después `game_completed` o `game_abandoned`. La misma ronda debe conservar el mismo `runId`.
4. Enviá la marca, el juego, su versión, el nombre y el celular del participante, la fecha ISO UTC y métricas como `score`, `durationSeconds` y `finishReason`. El SDK agrega `schemaVersion:1` y `eventId`. El servidor toma los nombres comerciales definitivos de su catálogo.
5. Usá el puente del SDK y sus confirmaciones reales. No uses `fetch` con `no-cors`, no marques una respuesta opaca como éxito y no mandes celulares o nombres por query strings. Mantené el `eventId` y todo el contenido al reintentar un envío.
6. Incluí cambio de participante, borrando datos del formulario para la persona siguiente. Una repetición con el mismo participante debe crear otra partida, sin duplicar el participante.
7. Mantené privada la planilla. Las funciones administrativas del Apps Script terminan en `_` y no se invocan desde el navegador. La clave del cliente es un identificador público de integración, no un secreto ni una garantía antifraude.

Probá datos incompletos, teléfonos inválidos, reintentos duplicados, desconexión, cambio de participante, varias rondas y dos juegos usando la misma central. El puntaje del juego debe conservar su funcionamiento. Entregame el juego actualizado y señalá los valores de conexión que todavía falten, sin inventar un endpoint publicado.
