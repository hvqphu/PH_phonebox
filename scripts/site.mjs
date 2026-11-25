import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const WWW = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'www');
export const AGENT = path.join(ROOT, 'agent', 'PhoneBox.Agent');
export const PAGES = path.join(ROOT, 'tools', 'pages');

export function getVersion() {
  const csproj = fs.readFileSync(path.join(AGENT, 'PhoneBox.Agent.csproj'), 'utf8');
  const match = csproj.match(/<Version>([^<]+)<\/Version>/);
  if (!match) {
    throw new Error('Could not find <Version> in PhoneBox.Agent.csproj');
  }
  return match[1];
}

export function demoTag({ panel = false, relay = false } = {}) {
  const attrs = [`src="../demo.js"`, `data-version="${getVersion()}"`];
  if (panel) attrs.push('data-panel');
  if (relay) attrs.push('data-relay');
  return `<script ${attrs.join(' ')}></script>\n`;
}

export function landingHtml() {
  const count = (file) => JSON.parse(fs.readFileSync(path.join(AGENT, file), 'utf8')).length;
  let html = fs.readFileSync(path.join(PAGES, 'index.html'), 'utf8');
  const values = {
    widgets: String(count('widgets.json')),
    templates: String(count('templates.json')),
    version: getVersion(),
  };
  for (const [key, value] of Object.entries(values)) {
    const token = `{{${key}}}`;
    if (!html.includes(token)) {
      throw new Error(`Missing template token ${token} in tools/pages/index.html`);
    }
    html = html.replaceAll(token, value);
  }
  if (html.includes('{{')) {
    throw new Error('Unreplaced template token remaining in tools/pages/index.html');
  }
  if (!html.includes('property="og:title"')) {
    html = html.replace(
      '<meta name="description" content="Turn an old Android phone into a desk panel for your computer. Try the panel and the layout editor in your browser.">',
      '<meta name="description" content="Turn an old Android phone into a desk panel for your computer. Try the panel and the layout editor in your browser.">\n<meta property="og:title" content="PhoneBox — live demo">\n<meta property="og:description" content="Turn an old Android phone into a desk panel for your computer. Try the panel and the layout editor in your browser.">'
    );
  }
  return html;
}

export function panelHtml({ relay = false } = {}) {
  const html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
  const tag = '<script type="module" src="main.js"></script>';
  if (!html.includes(tag)) {
    throw new Error('Could not find main.js script tag in panel index.html');
  }
  return html.replace(tag, `${demoTag({ panel: true, relay })}${tag}`);
}

export function settingsHtml({ relay = false } = {}) {
  const html = fs.readFileSync(path.join(AGENT, 'settings.html'), 'utf8');
  if (!html.includes('<script>')) {
    throw new Error('Could not find <script> tag in agent settings.html');
  }
  return html
    .replace('<script>', `${demoTag({ relay })}<script>`)
    .replaceAll('href="/favicon.ico"', 'href="../favicon.ico"')
    .replaceAll('src="/favicon.ico"', 'src="../favicon.ico"');
}
