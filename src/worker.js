/*
  Serveur du site de la maison (Cloudflare Worker).
  - Toutes les pages sont rendues à chaque visite depuis le contenu enregistré (KV « CONTENU »).
  - /admin : l'espace maison (fichiers statiques dans public/admin), protégé par mot de passe.
  - /api/… : lecture et enregistrement du contenu, envoi de photos, demandes de commande reçues.
  Secrets à définir : ADMIN_HASH (npm run mot-de-passe), SESSION_SECRET (texte aléatoire).
  Variable : MAQUETTE = "oui" tant que le site n'est pas validé (bandeau + formulaire en démonstration).
*/
import { rendrePage, lignesPanier, routes, euros } from '../public/assets/rendu.js';
import initial from '../contenu-initial.json';

const COOKIE = 'boutique_session';
const DUREE_SESSION = 30 * 24 * 3600;
const enc = new TextEncoder();

/* ---------- Petits outils ---------- */
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
});
const html = (corps, status = 200) => new Response(corps, {
  status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' },
});
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function egal(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const ip = (req) => req.headers.get('CF-Connecting-IP') || 'local';
const estMaquette = (env) => String(env.MAQUETTE || '').toLowerCase() === 'oui';

async function lireContenu(env, frais) {
  const c = await env.CONTENU.get('contenu', frais ? { type: 'json' } : { type: 'json', cacheTtl: 30 });
  return c || structuredClone(initial);
}

/* ---------- Limite de tentatives (connexion, commandes) ---------- */
async function essais(env, cle) { return parseInt((await env.CONTENU.get('limite:' + cle)) || '0', 10); }
async function compter(env, cle, n, secondes) { await env.CONTENU.put('limite:' + cle, String(n + 1), { expirationTtl: Math.max(60, secondes) }); }
async function limite(env, cle, max, secondes) {
  const n = await essais(env, cle);
  if (n >= max) return false;
  await compter(env, cle, n, secondes);
  return true;
}

/* ---------- Mot de passe et session ---------- */
async function verifierMotDePasse(env, mdp) {
  const parts = String(env.ADMIN_HASH || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return null;
  const iter = parseInt(parts[1], 10);
  const cle = await crypto.subtle.importKey('raw', enc.encode(mdp), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deB64(parts[2]), iterations: iter }, cle, 256);
  return egal(btoa(String.fromCharCode(...new Uint8Array(bits))), parts[3]);
}
async function signer(env, texte) {
  const cle = await crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', cle, enc.encode(texte)));
}
async function connecte(req, env) {
  if (!env.SESSION_SECRET) return false;
  const m = (req.headers.get('Cookie') || '').match(new RegExp(COOKIE + '=([0-9]+)\\.([A-Za-z0-9_-]+)'));
  if (!m || +m[1] < Date.now() / 1000) return false;
  return egal(await signer(env, 'boutique.' + m[1]), m[2]);
}
async function cookieSession(env) {
  const exp = Math.floor(Date.now() / 1000) + DUREE_SESSION;
  return `${COOKIE}=${exp}.${await signer(env, 'boutique.' + exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DUREE_SESSION}`;
}

/* ---------- Vérification du contenu envoyé par l'espace boutique ---------- */
const CLES_OBJETS = ['maison', 'annonce', 'accueil', 'pages', 'commandes', 'mentions'];
const CLES_LISTES = ['collections', 'types', 'pieces'];
/* Réglés par Grégoire, jamais modifiables depuis l'espace maison */
const CLES_FIXES = ['_schema', 'theme', 'reglages'];
const STATUTS = ['nouvelle', 'confirmee', 'payee', 'expediee', 'annulee'];
function nettoyer(c, actuel) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Error('Contenu illisible.');
  const out = {};
  CLES_OBJETS.forEach((k) => { out[k] = c[k] && typeof c[k] === 'object' && !Array.isArray(c[k]) ? c[k] : (actuel[k] || {}); });
  CLES_LISTES.forEach((k) => { out[k] = Array.isArray(c[k]) ? c[k].filter((x) => x && typeof x === 'object').slice(0, 200) : (actuel[k] || []); });
  out.credits_photos = String(c.credits_photos || '').slice(0, 800);
  CLES_FIXES.forEach((k) => { out[k] = actuel[k] || {}; });
  return out;
}

/* ---------- Routes ---------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    const methode = req.method;

    try {
      /* Robots et plan du site */
      if (methode === 'GET' && p === '/robots.txt') {
        const C = await lireContenu(env), base = ((C.reglages || {}).url || url.origin).replace(/\/$/, '');
        const corps = estMaquette(env) ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nDisallow: /admin/\nDisallow: /panier\nSitemap: ${base}/sitemap.xml\n`;
        return new Response(corps, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      if (methode === 'GET' && p === '/sitemap.xml') {
        const C = await lireContenu(env), base = ((C.reglages || {}).url || url.origin).replace(/\/$/, '');
        const corps = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes(C).filter((r) => r !== '/panier').map((r) => `<url><loc>${base}${r}</loc></url>`).join('')}</urlset>`;
        return new Response(corps, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
      }
      if (methode === 'GET' && p.startsWith('/photos/')) {
        const id = p.slice(8);
        if (!/^[a-z0-9-]{6,40}$/.test(id)) return new Response('Introuvable', { status: 404 });
        const { value, metadata } = await env.CONTENU.getWithMetadata('photo:' + id, { type: 'arrayBuffer', cacheTtl: 86400 });
        if (!value) return new Response('Introuvable', { status: 404 });
        return new Response(value, { headers: { 'Content-Type': (metadata && metadata.type) || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
      }

      /* Demande de commande envoyée par un client (rien n'est payé en ligne) */
      if (methode === 'POST' && p === '/api/commande') {
        if (estMaquette(env)) return json({ ok: false, erreur: 'Site en démonstration : la demande n’a pas été envoyée.' }, 403);
        const Cc = await lireContenu(env);
        if ((Cc.commandes || {}).actif === false) return json({ ok: false, erreur: 'Les demandes en ligne sont fermées.' }, 403);
        if (!(await limite(env, 'cmd:' + ip(req), 6, 600))) return json({ ok: false, erreur: 'Trop de demandes, réessayez dans quelques minutes.' }, 429);
        const corps = await req.json().catch(() => null);
        const t2 = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
        if (!corps || !t2(corps.nom, 120) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t2(corps.email, 200)) || String(corps.telephone || '').replace(/\D/g, '').length < 6) return json({ ok: false, erreur: 'Demande incomplète.' }, 400);
        const articles = lignesPanier(Cc, corps.articles);
        if (!articles.length) return json({ ok: false, erreur: 'Aucune pièce valable dans la demande.' }, 400);
        const total = articles.every((a) => a.prix) ? articles.reduce((s, a) => s + a.prix * a.qte, 0) : null;
        const lignes = articles.map((a) => [a.nom + (a.qte > 1 ? ' × ' + a.qte : ''), [a.taille ? 'Taille ' + a.taille : '', a.gravure ? 'Gravure « ' + a.gravure + ' »' : '', a.prix ? euros(a.prix * a.qte) : 'Prix sur demande'].filter(Boolean).join(', ')]);
        lignes.push(['Total indicatif', total ? euros(total) : 'À confirmer'], ['E-mail', t2(corps.email, 200)], ['Téléphone', t2(corps.telephone, 40)], ['Pays', t2(corps.pays, 80) || 'Non précisé']);
        if (t2(corps.message, 1500)) lignes.push(['Message', t2(corps.message, 1500)]);
        const id = (9999999999999 - Date.now()).toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        const cmd = { id, recue: new Date().toISOString(), statut: 'nouvelle', nom: t2(corps.nom, 120), telephone: t2(corps.telephone, 40), email: t2(corps.email, 200), articles, total, lignes };
        await env.CONTENU.put('commande:' + id, JSON.stringify(cmd), { expirationTtl: 180 * 24 * 3600 });
        return json({ ok: true });
      }

      /* Espace maison : connexion */
      if (methode === 'POST' && p === '/api/connexion') {
        if (!env.ADMIN_HASH || !env.SESSION_SECRET) return json({ ok: false, erreur: 'Espace maison pas encore configuré : demandez à Grégoire.' }, 503);
        const n = await essais(env, 'cnx:' + ip(req));
        if (n >= 8) return json({ ok: false, erreur: 'Trop d’essais. Réessayez dans un quart d’heure.' }, 429);
        const corps = await req.json().catch(() => ({}));
        const ok = await verifierMotDePasse(env, String(corps.motdepasse || ''));
        if (!ok) { await compter(env, 'cnx:' + ip(req), n, 900); return json({ ok: false, erreur: 'Mot de passe incorrect.' }, 401); }
        return json({ ok: true }, 200, { 'Set-Cookie': await cookieSession(env) });
      }
      if (methode === 'POST' && p === '/api/deconnexion') {
        return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
      }

      /* Nom et couleurs de la boutique pour l'écran de connexion */
      if (methode === 'GET' && p === '/api/apparence') {
        const C = await lireContenu(env);
        return json({ ok: true, boutique: { nom: (C.maison || {}).nom || '' }, theme: C.theme || {}, logo: (C.maison || {}).logo || '' });
      }

      /* Tout le reste de /api demande d'être connecté */
      if (p.startsWith('/api/')) {
        if (!(await connecte(req, env))) return json({ ok: false, erreur: 'Session expirée : reconnectez-vous.' }, 401);

        if (methode === 'GET' && p === '/api/contenu') {
          return json({ ok: true, contenu: await lireContenu(env, true), maquette: estMaquette(env) });
        }
        if (methode === 'PUT' && p === '/api/contenu') {
          const texte = await req.text();
          if (texte.length > 400000) return json({ ok: false, erreur: 'Contenu trop long.' }, 413);
          const actuel = await lireContenu(env, true);
          const C = nettoyer(JSON.parse(texte), actuel);
          await env.CONTENU.put('contenu:precedent', JSON.stringify(actuel));
          await env.CONTENU.put('contenu', JSON.stringify(C));
          return json({ ok: true, enregistre: new Date().toISOString() });
        }
        if (methode === 'POST' && p === '/api/annuler') {
          const prec = await env.CONTENU.get('contenu:precedent');
          if (!prec) return json({ ok: false, erreur: 'Aucune version précédente.' }, 404);
          const actuel = await env.CONTENU.get('contenu');
          await env.CONTENU.put('contenu', prec);
          if (actuel) await env.CONTENU.put('contenu:precedent', actuel);
          return json({ ok: true, contenu: JSON.parse(prec) });
        }
        if (methode === 'POST' && p === '/api/photo') {
          const type = (req.headers.get('Content-Type') || '').split(';')[0];
          if (!/^image\/(jpeg|png|webp)$/.test(type)) return json({ ok: false, erreur: 'Format de photo non accepté.' }, 415);
          const buf = await req.arrayBuffer();
          if (buf.byteLength > 3 * 1024 * 1024) return json({ ok: false, erreur: 'Photo trop lourde (3 Mo au plus).' }, 413);
          const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
          await env.CONTENU.put('photo:' + id, buf, { metadata: { type } });
          return json({ ok: true, url: '/photos/' + id });
        }
        if (methode === 'GET' && p === '/api/commandes') {
          const liste = await env.CONTENU.list({ prefix: 'commande:', limit: 60 });
          const cmds = (await Promise.all(liste.keys.map((k) => env.CONTENU.get(k.name, { type: 'json' })))).filter(Boolean);
          return json({ ok: true, commandes: cmds });
        }
        const m = p.match(/^\/api\/commandes\/([a-z0-9-]{4,40})$/);
        if (m && methode === 'PATCH') {
          const cle = 'commande:' + m[1];
          const cmd = await env.CONTENU.get(cle, { type: 'json' });
          if (!cmd) return json({ ok: false, erreur: 'Commande introuvable.' }, 404);
          const corps = await req.json().catch(() => ({}));
          if (!STATUTS.includes(corps.statut)) return json({ ok: false, erreur: 'Statut inconnu.' }, 400);
          cmd.statut = corps.statut;
          await env.CONTENU.put(cle, JSON.stringify(cmd), { expirationTtl: 180 * 24 * 3600 });
          return json({ ok: true });
        }
        return json({ ok: false, erreur: 'Adresse inconnue.' }, 404);
      }

      if (p === '/admin') return Response.redirect(url.origin + '/admin/', 301);
      if (/^\/(assets|fonts|admin)\//.test(p) || /\.[a-z0-9]{2,5}$/i.test(p)) return env.ASSETS.fetch(req);

      /* Toutes les autres adresses : les pages du site */
      if (methode === 'GET' || methode === 'HEAD') {
        const C = await lireContenu(env);
        const { statut, html: page } = rendrePage(C, p + url.search, { maquette: estMaquette(env), lienAdmin: '/admin/', apiCommande: '/api/commande' });
        return html(page, statut);
      }
      return new Response('Méthode non permise', { status: 405 });
    } catch (e) {
      return json({ ok: false, erreur: 'Erreur du serveur : réessayez.' }, 500);
    }
  },
};
