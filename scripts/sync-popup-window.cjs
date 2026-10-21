// Keep the readable window controller in sync with the shipped content bundle.
const fs = require('node:fs');
const file = 'content-script/index.js';
const bundle = fs.readFileSync(file, 'utf8');
const start = bundle.indexOf('function it(');
const end = bundle.indexOf('function nt(', start);
if (start < 0 || end < 0) throw new Error('Popup controller boundaries were not found');
fs.writeFileSync(file, bundle.slice(0, start) + fs.readFileSync('shared/popup-window.js', 'utf8') + bundle.slice(end));
