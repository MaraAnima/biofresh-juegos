# Configuración de Puzzle · Biofresh

El juego ya está dado de alta en la pestaña **Juegos** de la central.

| Campo | Valor |
| --- | --- |
| endpoint | `https://script.google.com/macros/s/AKfycbyEasUVM53vQA3QbCkak3Zqg_pMYvFBLZlWmQr30YZL7gNeTYYzPVfv1WCBIoY2rdam/exec` |
| gameKey | `b5ee5aca-9981-49bb-a51f-b830758594fa` |
| brandId | `biofresh` |
| brandName | `Biofresh` |
| gameId | `biofresh-puzzle` |
| gameName | `Puzzle` |

La central está publicada y la configuración de `config-puzzle.js` está completa. Usar ese archivo y el SDK compartido. [Guía de integración y prompt](https://script.google.com/macros/s/AKfycbyEasUVM53vQA3QbCkak3Zqg_pMYvFBLZlWmQr30YZL7gNeTYYzPVfv1WCBIoY2rdam/exec?view=integracion). [SDK común](https://script.google.com/macros/s/AKfycbyEasUVM53vQA3QbCkak3Zqg_pMYvFBLZlWmQr30YZL7gNeTYYzPVfv1WCBIoY2rdam/exec?view=sdk).

El SDK recibe `participant: {name, phone}`, un `sessionId` por participación y un `runId` nuevo por partida. Enviar `registration`, `game_started` y `game_completed` o `game_abandoned`, esperando confirmaciones reales. Ver `README.md` y `PROMPT-COMPANERO.md`.

En la planilla se verificaron los tres eventos de una prueba técnica de Puzzle: `registration`, `game_started` y `game_completed`. El inicio y el resultado pertenecen a la misma partida, y sus datos se guardaron en la central publicada. Esta comprobación confirma la recepción de eventos de Puzzle; no sustituye las pruebas de jugabilidad ni la validación de Fresh Slice.

El SDK incluido es **1.1.0**, con conexión anticipada y confirmaciones individuales, además de compatibilidad con archivos locales. Si integraste una copia anterior, reemplazá `platform-sdk.js` por el `shared-sdk.js` de este paquete y creá el cliente al abrir tu juego. La URL, el ID y la clave de Puzzle siguen siendo los de la tabla anterior. La recepción de la actualización debe probarse en el navegador de Puzzle; las comprobaciones históricas de la planilla corresponden a la integración anterior.
