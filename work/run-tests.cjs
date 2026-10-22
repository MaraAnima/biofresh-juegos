const path = require('node:path');
const { spawnSync } = require('node:child_process');

const suites = [
  'test-central-platform.cjs',
  'test-fullscreen.cjs',
  'test-round-finish.cjs',
  'test-bag-bonus.cjs',
  'test-ingredient-groups.cjs'
];
for (const suite of suites) {
  console.log('\n' + suite);
  const result = spawnSync(process.execPath, [path.join(__dirname, suite)], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
