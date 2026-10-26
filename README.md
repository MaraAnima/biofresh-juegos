# Biofresh · Juegos

Fresh Slice y una central compartida de registro y resultados con Google Sheets y Apps Script. El catálogo actual contiene **Fresh Slice** y **Puzzle**; permite agregar más juegos con una configuración propia para cada uno.

## Abrir Fresh Slice

Abrí [`outputs/Biofresh-Fresh-Slice.html`](outputs/Biofresh-Fresh-Slice.html) en un navegador. Es la versión de un solo archivo, con imágenes y sonidos incluidos. **La configuración incluida conecta con la central publicada**: el registro y el guardado de resultados requieren conexión a Internet.

Para modificar el juego, trabajá en [`outputs/biofresh-fresh-slice/`](outputs/biofresh-fresh-slice/). También podés abrir su `index.html` conservando la estructura de carpetas.

En **Fresh Slice 1.1.1**, nombre y celular válidos habilitan las instrucciones y la ronda inmediatamente. El SDK **1.1.0** prepara la conexión al abrir y envía registro, inicio y resultado en segundo plano. Una demora o un corte de red no devuelve al participante al formulario ni interrumpe la ronda. Solo se muestra «Resultado guardado» después de una confirmación real; mientras tanto se indica pendiente.

La revisión **1.1.2** agrega una alternativa cuando Canvas no ofrece `roundRect`, tolera errores de captura del toque y mantiene el corte principal al apoyar o levantar otro dedo. El lienzo evita el menú de pulsación larga. Las pruebas simulan esas capacidades ausentes en 375 × 667 y conservan los casos de escritorio y móvil; no sustituyen la comprobación del problema reportado en un iPhone real.

### Probar sin enviar datos

En `outputs/biofresh-fresh-slice/platform-config.js`, dejá `endpoint` y `gameKey` vacíos y cambiá `allowPreview` a `true`. Después ejecutá `npm run build`. La pantalla indica modo de prueba y no confirma guardados reales. Restaurá la configuración de producción antes de distribuir esa versión.

## Desarrollo

Requisitos: **Node.js 20 o posterior**, npm y Git. El juego usa HTML, CSS, JavaScript y Canvas; no necesita dependencias de Node en el navegador. La dependencia de desarrollo se usa para verificar imágenes y comportamiento con Canvas.

```sh
git clone https://github.com/MaraAnima/biofresh-juegos.git
cd biofresh-juegos
npm ci
npm test
npm run build
```

`npm run build` sincroniza el SDK compartido y la configuración de Fresh Slice, genera `SDK.html` para Apps Script y reconstruye el HTML único del juego. Revisá los cambios generados y guardalos junto con el código fuente en el mismo commit.

| Comando | Función |
| --- | --- |
| `npm run build` | Sincroniza la central y reconstruye el HTML único. |
| `npm test` | Ejecuta las pruebas locales de central, registro, juego, bolsa, final de ronda y grupos. |
| `npm run test:central` | Verifica validación, varios juegos, duplicados, confirmaciones y reintentos. |
| `npm run test:aura` | Verifica el aura de las bolsas al girar y genera una imagen local de comprobación. |

Las pruebas usan datos ficticios y simulaciones; **no envían registros a la planilla de producción**. Las pruebas de Canvas no sustituyen la revisión visual y de audio en un navegador real.

## Estructura

```text
outputs/
  Biofresh-Fresh-Slice.html       # Versión lista para abrir
  biofresh-fresh-slice/           # Código y recursos del juego
  central-juegos/                 # Servidor, SDK, configuraciones y guías
  Direccion-fotografica.md        # Créditos y dirección de imágenes
  Direccion-fondo.md              # Dirección del fondo
work/
  build.cjs                      # Construcción completa
  package-central.cjs            # Sincronización del SDK
  build-standalone.cjs            # Generación del HTML único
  run-tests.cjs                   # Ejecución de las pruebas
  test-*.cjs                     # Pruebas locales existentes
```

## Central compartida y nuevos juegos

La documentación completa está en [`outputs/central-juegos/README.md`](outputs/central-juegos/README.md). Incluye publicación, esquema de la planilla, protocolo de eventos y configuración de cada juego.

Para sumar un juego:

1. Agregá su fila activa en **Juegos** con un `game_id` único, marca, nombre y una UUID propia como `clave_publica`.
2. Entregá al desarrollador el endpoint `/exec`, la configuración de su juego y el [prompt de integración](outputs/central-juegos/PROMPT-COMPANERO.md).
3. Integrá [`shared-sdk.js`](outputs/central-juegos/shared-sdk.js) y enviá registro, inicio y cierre usando los mismos identificadores de participante, sesión y partida.
4. Confirmá en la planilla que sus eventos y resultados se guardan bajo el juego correcto.

Los participantes se identifican por celular normalizado entre juegos; cada partida conserva su juego, marca, puntaje y métricas. El catálogo no tiene un límite fijo de dos o cuatro juegos. La capacidad bajo concurrencia alta todavía no fue medida y depende de Sheets y Apps Script.

De **Puzzle** se incluye su configuración y [prompt específico](outputs/central-juegos/PROMPT-PUZZLE.md). Su implementación se desarrolla por separado.

## Configuración y publicación

- `central-juegos/shared-sdk.js` es la fuente del SDK; sus copias se generan con `npm run build`.
- `biofresh-fresh-slice/platform-config.js` es la configuración de Fresh Slice.
- `central-juegos/config-puzzle.js` contiene la configuración de Puzzle.
- `Code.gs`, `Bridge.html`, `Integracion.html`, `SDK.html` y `appsscript.json` se cargan en Apps Script siguiendo la guía de la central.
- Un commit o push **no actualiza automáticamente** la implementación de Apps Script ni activa un sitio web.

Los endpoints, IDs y `gameKey` incluidos son configuración pública del cliente. La clave identifica el juego; no autentica a una persona ni demuestra que un puntaje sea legítimo. La sal privada se mantiene en las propiedades de Apps Script. Este repositorio no contiene las filas de participantes o partidas, credenciales de Google ni grabaciones originales del usuario.

## Recursos y créditos

Ver [`AUDIO-CREDITS.md`](outputs/biofresh-fresh-slice/AUDIO-CREDITS.md), los créditos de fotos en [`photos.js`](outputs/biofresh-fresh-slice/photos.js) y [`NOTICE.md`](NOTICE.md). Las marcas y los recursos de terceros conservan sus condiciones originales.
