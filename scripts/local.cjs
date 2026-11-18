const {spawn} = require('child_process');
const path = require('path');
if (process.versions.node !== '20.11.0') throw new Error('Execute nvm use antes: este projeto usa Node 20.11.0');
const children = ['local-callback.cjs', '../dist/indexprod.js'].map(file => spawn(process.execPath, [path.resolve(__dirname, file)], {stdio: 'inherit'}));
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', error => { console.error(error); stop(1); });
  child.on('exit', code => stop(code || 0));
}
process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop());
