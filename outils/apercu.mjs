// Fabrique demonstration.html : un seul fichier à ouvrir sur un téléphone, sans serveur.
// Il s'ouvre sur le site (navigation, panier, demande en démonstration), puis « Essayer l'espace maison »
// (n'importe quel mot de passe, les essais restent sur le téléphone).
// Usage : node outils/apercu.mjs [fichier de contenu]   (par défaut : contenu-initial.json)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { POLICES } from '../public/assets/polices.js';
import { verifier } from './verifier.mjs';

const ici = (f) => new URL('../' + f, import.meta.url);
const lire = (f) => readFileSync(ici(f), 'utf8');
const C = JSON.parse(readFileSync(resolve(process.argv[2] || new URL('../contenu-initial.json', import.meta.url).pathname), 'utf8'));
const { erreurs } = verifier(C);
if (erreurs.length) { console.error(`Le contenu a ${erreurs.length} erreur(s) : lancez « npm run verifier » pour les voir. Aucun fichier fabriqué.`); process.exit(1); }
/* Les images du site (logo, photos dans /assets/) sont intégrées au fichier de démonstration */
const TYPES_IMG = { svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif' };
const dejaVu = new Map();
const integrer = (u) => {
  const ext = typeof u === 'string' && u.startsWith('/assets/') ? (u.match(/\.([a-z0-9]+)$/i) || [])[1] : '';
  const type = ext && TYPES_IMG[ext.toLowerCase()];
  if (!type) return u;
  if (!dejaVu.has(u)) dejaVu.set(u, `data:${type};base64,` + readFileSync(ici('public' + u)).toString('base64'));
  return dejaVu.get(u);
};
const parcourir = (o) => { if (Array.isArray(o)) return o.map(parcourir); if (o && typeof o === 'object') { for (const k of Object.keys(o)) o[k] = parcourir(o[k]); return o; } return integrer(o); };
parcourir(C);
const css = lire('public/assets/site.css');
const js = lire('public/assets/site.js');
const polices = {};
POLICES.maison.fichiers.forEach(([, , f]) => { polices[f] = 'data:font/woff2;base64,' + readFileSync(ici('public/fonts/' + f)).toString('base64'); });

const surScript = (t) => t.replace(/<\/script/gi, '<\\/script');
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const sansExport = (t) => t.replace(/^import .*;\s*$/gm, '').replace(/^export (const|function|async function)/gm, '$1');
const sources = [lire('public/assets/polices.js'), lire('public/assets/rendu.js'), lire('public/assets/admin.js')].map(sansExport);
/* Les trois fichiers sont réunis en un seul script : deux noms identiques au premier niveau le casseraient */
const vus = new Map();
sources.forEach((src, i) => { for (const m of src.matchAll(/^(?:const|let|var|function|async function|class) ([A-Za-z_$][\w$]*)/gm)) { if (vus.has(m[1])) { console.error(`Nom « ${m[1]} » déclaré deux fois (fichiers ${vus.get(m[1])} et ${i}) : renommez-en un.`); process.exit(1); } vus.set(m[1], i); } });
const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#161616">
<title>${C.maison.nom} : démonstration</title>
<link rel="icon" href="${C.maison.logo || ''}">
<style>
${lire('public/assets/admin.css')}
</style>
</head>
<body>
<div id="app"></div>
<script>window.ESPACE_DEMO = { siteDabord: true, contenu: ${json(C)}, polices: ${json(polices)}, css: ${json(css)}, js: ${json(js)} };</script>
<script type="module">
${surScript(sources.join('\n'))}
</script>
</body>
</html>
`;
writeFileSync('demonstration.html', page);
/* La même démonstration, prête à déposer sur Cloudflare Pages (un iPhone n'ouvre pas un fichier HTML : il lui faut un lien) */
mkdirSync('demo-en-ligne', { recursive: true });
writeFileSync('demo-en-ligne/index.html', page);
writeFileSync('demo-en-ligne/_headers', '/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n');
console.log('demonstration.html et demo-en-ligne/ prêts (' + C.maison.nom + ')');
