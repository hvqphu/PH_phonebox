import fs from 'node:fs';
import path from 'node:path';
import { AGENT, PAGES, ROOT, WWW, landingHtml, panelHtml, settingsHtml } from './site.mjs';

const out = path.resolve(ROOT, process.argv[2] || 'dist');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'panel'), { recursive: true });
fs.mkdirSync(path.join(out, 'settings'), { recursive: true });
fs.mkdirSync(path.join(out, 'pair'), { recursive: true });

fs.copyFileSync(path.join(PAGES, 'demo.js'), path.join(out, 'demo.js'));
fs.writeFileSync(path.join(out, 'index.html'), landingHtml(), 'utf8');
for (const name of ['widgets.json', 'templates.json']) {
  fs.copyFileSync(path.join(AGENT, name), path.join(out, name));
}
fs.copyFileSync(path.join(AGENT, 'phonebox.ico'), path.join(out, 'favicon.ico'));

fs.cpSync(WWW, path.join(out, 'panel'), {
  recursive: true,
  filter: (src) => path.basename(src) !== 'index.html',
});
fs.writeFileSync(path.join(out, 'panel', 'index.html'), panelHtml(), 'utf8');
fs.writeFileSync(path.join(out, 'settings', 'index.html'), settingsHtml(), 'utf8');
fs.copyFileSync(path.join(PAGES, 'pair.html'), path.join(out, 'pair', 'index.html'));

console.log(`PhoneBox web demo built to ${out}`);
