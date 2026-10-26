# Mensaje para integrar Puzzle de Biofresh

La central ya está publicada. Integrá Puzzle a esta central, usando la configuración siguiente y el SDK común **1.1.0** incluido en el paquete. Si ya integraste una copia anterior, actualizala: prepara la conexión al abrir y confirma cada envío sin esperar el resto de la cola. Conserva la corrección de archivos locales. No hace falta crear otro backend.

```json
{
  "endpoint": "https://script.google.com/macros/s/AKfycbyEasUVM53vQA3QbCkak3Zqg_pMYvFBLZlWmQr30YZL7gNeTYYzPVfv1WCBIoY2rdam/exec",
  "gameKey": "b5ee5aca-9981-49bb-a51f-b830758594fa",
  "brandId": "biofresh",
  "brandName": "Biofresh",
  "gameId": "biofresh-puzzle",
  "gameName": "Puzzle",
  "gameVersion": "1.0.0",
  "defaultCallingCode": "598",
  "allowPreview": false
}
```

Guía: https://script.google.com/macros/s/AKfycbyEasUVM53vQA3QbCkak3Zqg_pMYvFBLZlWmQr30YZL7gNeTYYzPVfv1WCBIoY2rdam/exec?view=integracion

SDK: https://script.google.com/macros/s/AKfycbyEasUVM53vQA3QbCkak3Zqg_pMYvFBLZlWmQr30YZL7gNeTYYzPVfv1WCBIoY2rdam/exec?view=sdk

Implementá:

1. Un primer paso obligatorio con nombre y celular, antes de las instrucciones y de jugar. Mostrá que se registrarán esos datos y los resultados. Normalizá el teléfono al formato internacional; por defecto Uruguay, con opción de ingresar otro prefijo. No agregues suscripciones de marketing ni digas que el celular fue verificado por SMS.
2. Cargá el SDK y creá `GameHub.Client(config)` al abrir el juego. Tras validar nombre y celular, habilitá instrucciones y juego inmediatamente. Encolá `registration`, inicio y resultado con la misma participación y enviá en segundo plano sin esperar a Google para empezar. No marques guardado hasta recibir `ok:true`; usá `client.onReceipt` para actualizar reintentos. Un fallo o respuesta tardía no debe interrumpir la partida ni modificar a otro participante. Indicá claramente cualquier modo de prueba.
3. Usá un `sessionId` por participación y un `runId` nuevo por ronda. Enviá `game_started` y después `game_completed` o `game_abandoned`. La misma ronda debe conservar el mismo `runId`.
4. Enviá la marca, el juego, su versión, el nombre y el celular del participante, la fecha ISO UTC y métricas como `score`, `durationSeconds` y `finishReason`. El SDK agrega `schemaVersion:1` y `eventId`. El servidor toma los nombres comerciales definitivos de su catálogo.
5. Usá el puente del SDK y sus confirmaciones reales. No uses `fetch` con `no-cors`, no marques una respuesta opaca como éxito y no mandes celulares o nombres por query strings. Mantené el `eventId` y todo el contenido al reintentar un envío.
6. Incluí cambio de participante, borrando datos del formulario para la persona siguiente. Una repetición con el mismo participante debe crear otra partida, sin duplicar el participante.
7. Mantené privada la planilla. Las funciones administrativas del Apps Script terminan en `_` y no se invocan desde el navegador. La clave del cliente es un identificador público de integración, no un secreto ni una garantía antifraude.

Probá datos incompletos, teléfonos inválidos, reintentos duplicados, desconexión, cambio de participante, varias rondas y dos juegos usando la misma central. El puntaje del juego debe conservar su funcionamiento. Entregame el juego actualizado y señalá los valores de conexión que todavía falten, sin inventar un endpoint publicado.
