const fs = require('fs');
const Module = require('module');
const path = require('path');

const file = path.resolve(__dirname, 'test-fullscreen.cjs');
let suite = fs.readFileSync(file, 'utf8');
const access = 'get remaining(){return remaining},get photoCount';
const marker = '  console.log(`OK ${width}';
if (!suite.includes(access) || !suite.includes(marker)) throw new Error('No se encontró el punto de verificación');

suite = suite.replace(access, 'get remaining(){return remaining},set remaining(value){remaining=value},get fragments(){return fragments},set lives(value){lives=value},get photoCount');
suite = suite.replace(marker, `
  // At zero, the last ingredient remains playable and no new wave appears.
  elements.overlayButton.emit('click');
  debug.objects.length=0;debug.spawn();
  const pending=debug.objects[0];pending.x=width/2;pending.y=height/2;pending.vx=0;pending.vy=0;pending.gravity=0;
  debug.remaining=.01;debug.update(.02);
  assert.strictEqual(debug.remaining,0);assert.strictEqual(debug.state,'playing');
  assert(elements.time.innerHTML.startsWith('0<'));
  const pendingCount=debug.objects.length;
  debug.update(1);
  assert.strictEqual(debug.state,'playing');
  assert.strictEqual(debug.objects.length,pendingCount,'No deben aparecer más ingredientes');
  elements.gameCanvas.emit('pointerdown',{pointerId:1,clientX:pending.x,clientY:pending.y,preventDefault(){}});
  elements.gameCanvas.emit('pointerup');
  assert(debug.score>0,'El último ingrediente debe dar puntos después de los 35 s');
  debug.update(.05);
  assert.strictEqual(debug.objects.length,0);assert(debug.fragments.length>0);
  assert.strictEqual(debug.state,'playing','Debe verse la animación del último corte');
  debug.update(.8);
  assert.strictEqual(debug.fragments.length,0);assert.strictEqual(debug.state,'gameover');
  assert.strictEqual(elements.overlayTitle.textContent,'¡Qué frescura!');
  assert(elements.overlayText.textContent.includes('Lograste terminar la ronda'));

  // A naturally departing ingredient closes the round too.
  elements.overlayButton.emit('click');debug.objects.length=0;debug.spawn();
  const escaping=debug.objects[0];escaping.y=height+escaping.r-4;escaping.vy=300;escaping.gravity=0;escaping.seen=true;
  debug.remaining=.01;debug.update(.02);
  assert.strictEqual(debug.state,'gameover');assert.strictEqual(debug.objects.length,0);

  // Expiring the last life at zero cannot hide another ingredient.
  elements.overlayButton.emit('click');debug.objects.length=0;debug.spawn();debug.spawn();
  const first=debug.objects[0],last=debug.objects[1];
  first.y=height+first.r-4;first.vy=300;first.gravity=0;first.seen=true;
  last.x=width/2;last.y=height/2;last.vx=0;last.vy=0;last.gravity=0;
  debug.lives=1;debug.remaining=.01;debug.update(.02);
  assert.strictEqual(debug.lives,0);assert.strictEqual(debug.state,'playing');assert.strictEqual(debug.objects.length,1);
  elements.gameCanvas.emit('pointerdown',{pointerId:1,clientX:last.x,clientY:last.y,preventDefault(){}});
  elements.gameCanvas.emit('pointerup');debug.update(.8);
  assert.strictEqual(debug.state,'gameover');
  console.log('OK: últimos ingredientes jugables hasta desaparecer después de 35 s');
` + marker);

const runner = new Module(file, module);
runner.filename = file;
runner.paths = module.paths;
runner._compile(suite, file);
