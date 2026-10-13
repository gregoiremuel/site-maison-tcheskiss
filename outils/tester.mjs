// Teste le vrai serveur sur cet ordinateur, sans rien mettre en ligne.
// Usage : node outils/tester.mjs [fichier de contenu]   (par défaut : contenu-initial.json)
// Lance « wrangler dev » avec un stockage vide et temporaire, un mot de passe de test et MAQUETTE = non.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { verifier } from './verifier.mjs';
import { routes } from '../public/assets/rendu.js';
import { POLICES } from '../public/assets/polices.js';

const racine = fileURLToPath(new URL('..', import.meta.url));
const fichier = resolve(process.argv[2] || join(racine, 'contenu-initial.json'));
const C = JSON.parse(readFileSync(fichier, 'utf8'));
if (verifier(C).erreurs.length) { console.error('\nLe contenu a des erreurs : lancez d’abord « npm run verifier ».\n'); process.exit(1); }

const PORT = 8799, BASE = `http://127.0.0.1:${PORT}`;
const MDP = 'test-' + randomBytes(6).toString('hex');
const sel = randomBytes(16);
const HASH = `pbkdf2$10000$${sel.toString('base64')}$${pbkdf2Sync(MDP, sel, 10000, 32, 'sha256').toString('base64')}`;
const stockage = mkdtempSync(join(tmpdir(), 'maison-test-'));
const wrangler = join(racine, 'node_modules', '.bin', 'wrangler');
if (process.argv[2]) {
  const r = spawnSync(wrangler, ['kv', 'key', 'put', 'contenu', '--path', fichier, '--binding', 'CONTENU', '--local', '--persist-to', stockage], { cwd: racine, encoding: 'utf8' });
  if (r.status !== 0) { console.error('Impossible de déposer le contenu de test :\n' + r.stderr); process.exit(1); }
}
const serveur = spawn(wrangler, ['dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', stockage, '--show-interactive-dev-session=false',
  '--var', 'ADMIN_HASH:' + HASH, '--var', 'SESSION_SECRET:' + randomBytes(24).toString('hex'), '--var', 'MAQUETTE:non'],
{ cwd: racine, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
let journal = '';
serveur.stdout.on('data', (d) => { journal += d; }); serveur.stderr.on('data', (d) => { journal += d; });
const arreter = () => { try { process.kill(-serveur.pid, 'SIGTERM'); } catch (e) { /* déjà arrêté */ } try { rmSync(stockage, { recursive: true, force: true }); } catch (e) { /* rien */ } };
process.on('SIGINT', () => { arreter(); process.exit(130); });

let ok = 0; const echecs = [];
const verif = (cond, nom) => { if (cond) { ok++; console.log('  ok      ' + nom); } else { echecs.push(nom); console.log('  ÉCHEC   ' + nom); } };
let cookie = '';
const req = (chemin, o = {}) => fetch(BASE + chemin, { redirect: 'manual', ...o, headers: { ...(o.headers || {}), ...(cookie && o.cookie !== false ? { Cookie: cookie } : {}) } });
const corpsJson = (data) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
async function attendre() {
  for (let i = 0; i < 90; i++) { try { const r = await fetch(BASE + '/'); if (r.status === 200) return true; } catch (e) { /* pas prêt */ } await new Promise((r) => setTimeout(r, 1000)); }
  return false;
}

async function tests() {
  console.log(`\nTest du serveur local avec ${fichier} (${C.maison.nom})\n`);
  const R = routes(C);
  let pagesOk = 0;
  for (const r of R) {
    const x = await req(r); const h = await x.text();
    if (x.status === 200 && !/undefined|NaN|\[object Object\]/.test(h.replace(/<script[\s\S]*?<\/script>/g, '')) && h.includes('</html>')) pagesOk++; else console.log('    page en défaut : ' + r + ' ' + x.status);
  }
  verif(pagesOk === R.length, `Les ${R.length} pages du site s’affichent`);
  let r = await req('/nexistepas'); verif(r.status === 404 && (await r.text()).includes('Page introuvable'), 'Adresse inconnue : page 404');
  r = await req('/'); let h = await r.text();
  verif(!h.includes('class="maquette"') && !h.includes('noindex'), 'Pas de bandeau de proposition quand MAQUETTE = non');
  r = await req('/robots.txt'); verif((await r.text()).includes('Sitemap:'), 'robots.txt avec plan du site');
  r = await req('/sitemap.xml'); h = await r.text(); verif(h.includes('/piece/') && !h.includes('/panier'), 'Plan du site avec les pièces');
  for (const f of ['/assets/site.css', '/assets/site.js', '/assets/rendu.js', '/assets/polices.js', '/assets/admin.js', '/assets/admin.css', '/assets/masque.svg', ...POLICES.maison.fichiers.map((x) => '/fonts/' + x[2])]) {
    r = await req(f); verif(r.status === 200, 'Fichier ' + f);
  }
  const imagesSite = [...new Set(JSON.stringify(C).match(/\/assets\/[\w./-]+\.(?:jpe?g|png|webp|avif|svg)/gi) || [])];
  let imagesOk = 0;
  for (const f of imagesSite) { r = await req(f); if (r.status === 200 && /^image\//.test(r.headers.get('content-type') || '')) imagesOk++; else console.log('    image en défaut : ' + f + ' ' + r.status); }
  verif(imagesOk === imagesSite.length, `Les ${imagesSite.length} images du site (dans /assets/) s’affichent`);

  /* Espace maison */
  r = await req('/admin'); verif([301, 302, 307, 308].includes(r.status), '/admin redirige vers /admin/');
  r = await req('/admin/'); verif(r.status === 200 && /no-store/.test(r.headers.get('cache-control') || '') && r.headers.get('x-frame-options') === 'DENY', 'Espace maison : jamais en cache, pas dans un cadre');
  r = await req('/api/apparence'); let j = await r.json(); verif(j.ok && j.boutique.nom === C.maison.nom, 'Nom pour l’écran de connexion');
  r = await req('/api/contenu'); verif(r.status === 401, 'Contenu refusé sans connexion');
  r = await req('/api/connexion', { method: 'POST', ...corpsJson({ motdepasse: 'mauvais' }) }); verif(r.status === 401, 'Mauvais mot de passe refusé');
  r = await req('/api/connexion', { method: 'POST', ...corpsJson({ motdepasse: MDP }) });
  const sc = r.headers.get('set-cookie') || ''; cookie = (sc.match(/boutique_session=[^;]+/) || [''])[0];
  verif(r.status === 200 && cookie && /HttpOnly/i.test(sc) && /SameSite=Strict/i.test(sc), 'Bon mot de passe : session ouverte');
  j = await (await req('/api/contenu')).json(); const base = j.contenu;
  verif(j.ok && base._schema === 'maison v1', 'Lecture du contenu une fois connecté');

  const x0 = base.pieces[0];
  const m = structuredClone(base);
  m.pieces[0].prix = '1450'; m.annonce = { afficher: true, texte: 'Nouvelle collection en ligne' };
  m.theme = { fond: '#ff00ff' }; m._schema = 'pirate';
  r = await req('/api/contenu', { method: 'PUT', ...corpsJson(m) }); verif((await r.json()).ok, 'Enregistrement');
  h = await (await req('/piece/' + x0.id)).text();
  verif(h.includes('1 450 €') && h.includes('Nouvelle collection en ligne'), 'Le nouveau prix et le message apparaissent sur le site');
  j = await (await req('/api/contenu')).json();
  verif(j.contenu.theme.fond === base.theme.fond && j.contenu._schema === 'maison v1', 'Les couleurs du site ne peuvent pas être changées depuis l’espace maison');
  const m2 = structuredClone(j.contenu); m2.pieces[0].visible = false;
  await req('/api/contenu', { method: 'PUT', ...corpsJson(m2) });
  r = await req('/piece/' + x0.id); verif(r.status === 404, 'Pièce masquée : sa page n’existe plus');
  await req('/api/contenu', { method: 'PUT', ...corpsJson(j.contenu) });

  /* Photo */
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  r = await req('/api/photo', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: jpeg }); j = await r.json();
  verif(j.ok && /^\/photos\//.test(j.url), 'Envoi d’une photo');
  if (j.ok) { r = await req(j.url); verif(r.status === 200 && r.headers.get('content-type') === 'image/jpeg', 'La photo envoyée s’affiche'); }

  /* Vidéo de fond : envoi et lecture par morceaux (Safari en a besoin) */
  const fauxMp4 = Buffer.alloc(4096, 7);
  r = await req('/api/video', { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: fauxMp4 }); j = await r.json();
  verif(j.ok && /^\/videos\//.test(j.url), 'Envoi d’une vidéo');
  if (j.ok) {
    r = await req(j.url, { cookie: false, headers: { Range: 'bytes=0-99' } });
    verif(r.status === 206 && r.headers.get('content-range') === 'bytes 0-99/4096' && (await r.arrayBuffer()).byteLength === 100, 'La vidéo se lit par morceaux');
    r = await req(j.url, { cookie: false }); verif(r.status === 200 && r.headers.get('content-type') === 'video/mp4' && r.headers.get('accept-ranges') === 'bytes', 'La vidéo s’affiche en entier');
  }
  r = await req('/api/video', { method: 'POST', headers: { 'Content-Type': 'video/quicktime' }, body: fauxMp4 }); verif(r.status === 415, 'Vidéo .mov refusée (format non lu partout)');

  /* Demande de commande d'un client : prix recalculés par le serveur */
  const client = { nom: 'Client Test', email: 'client@exemple.fr', telephone: '06 12 34 56 78', pays: 'France', message: 'Essai' };
  r = await req('/api/commande', { method: 'POST', cookie: false, ...corpsJson({ ...client, articles: [{ id: x0.id, qte: 1, prix: 1 }, { id: 'nexistepas' }] }) });
  verif(r.status === 200, 'Un client envoie une demande');
  r = await req('/api/commande', { method: 'POST', cookie: false, ...corpsJson({ ...client, articles: [{ id: 'nexistepas' }] }) }); verif(r.status === 400, 'Demande sans pièce valable refusée');
  r = await req('/api/commande', { method: 'POST', cookie: false, ...corpsJson({ ...client, email: 'faux', articles: [{ id: x0.id }] }) }); verif(r.status === 400, 'Demande sans e-mail valable refusée');
  j = await (await req('/api/commandes')).json();
  const cmd = (j.commandes || []).find((c) => c.nom === 'Client Test');
  verif(cmd && cmd.statut === 'nouvelle' && cmd.articles.length === 1 && cmd.articles[0].prix === 1450, 'La demande arrive avec le prix du site, pas celui envoyé par le navigateur');
  if (cmd) {
    for (const s of ['confirmee', 'payee', 'expediee']) { r = await req('/api/commandes/' + cmd.id, { method: 'PATCH', ...corpsJson({ statut: s }) }); verif(r.status === 200, 'Statut « ' + s + ' »'); }
    r = await req('/api/commandes/' + cmd.id, { method: 'PATCH', ...corpsJson({ statut: 'nimportequoi' }) }); verif(r.status === 400, 'Statut inconnu refusé');
  }
  const ferme = structuredClone((await (await req('/api/contenu')).json()).contenu); ferme.commandes.actif = false;
  await req('/api/contenu', { method: 'PUT', ...corpsJson(ferme) });
  r = await req('/api/commande', { method: 'POST', cookie: false, ...corpsJson({ ...client, articles: [{ id: x0.id }] }) }); verif(r.status === 403, 'Demandes fermées : refusées par le serveur');

  /* Retour en arrière, déconnexion, limites */
  r = await req('/api/annuler', { method: 'POST' }); j = await r.json(); verif(j.ok && j.contenu.commandes.actif !== false, 'Revenir en arrière rétablit la version précédente');
  r = await req('/api/deconnexion', { method: 'POST' }); verif(/Max-Age=0/.test(r.headers.get('set-cookie') || ''), 'Déconnexion');
  cookie = '';
  r = await req('/api/contenu'); verif(r.status === 401, 'Après déconnexion, le contenu est refusé');
  for (let i = 0; i < 8; i++) await req('/api/connexion', { method: 'POST', ...corpsJson({ motdepasse: 'faux-' + i }) });
  r = await req('/api/connexion', { method: 'POST', ...corpsJson({ motdepasse: MDP }) }); verif(r.status === 429, 'Après 8 mauvais mots de passe, connexion bloquée un quart d’heure');
}

const pret = await attendre();
if (!pret) { console.error('\nLe serveur local ne démarre pas. Journal :\n' + journal.slice(-3000)); arreter(); process.exit(1); }
try { await tests(); } catch (e) { echecs.push('Erreur pendant les tests : ' + e.message); console.log('  ÉCHEC   ' + e.stack); }
arreter();
console.log(`\n${ok} vérification(s) réussie(s), ${echecs.length} échec(s).\n`);
process.exit(echecs.length ? 1 : 0);
