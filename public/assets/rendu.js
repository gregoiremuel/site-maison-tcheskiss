/*
  Moteur de rendu de la maison : toutes les pages du site à partir du contenu (un seul objet JSON).
  Utilisé par le serveur (src/worker.js), par l'aperçu de l'espace maison et par outils/apercu.mjs.
*/
import { cssPolices } from './polices.js';

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
export const slug = (s) => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const hex = (c, d) => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : d);
export const prixNombre = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[\s\u202f\u00a0]/g, '').replace(',', '.')); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
export const euros = (n) => { const [e, d] = n.toFixed(n % 1 ? 2 : 0).split('.'); return e.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + (d ? ',' + d : '') + '\u00a0€'; };
export const prixTexte = (v) => { const n = prixNombre(v); return n == null ? 'Prix sur demande' : euros(n); };
export const TAILLES = Array.from({ length: 23 }, (_, i) => 44 + i); // tailles françaises de bague = tour de doigt en mm

export const PAGES = { atelier: '/atelier', maison: '/maison', entretien: '/entretien', tailles: '/guide-des-tailles', commande: '/commande-et-livraison', conditions: '/conditions-de-vente' };

/* Données utiles, nettoyées */
export function donnees(C) {
  const collections = (C.collections || []).filter((c) => c && c.id && c.nom && c.visible !== false);
  const types = (C.types || []).filter((t) => t && t.id && t.nom);
  const pieces = (C.pieces || []).filter((x) => x && x.id && x.nom && x.visible !== false)
    .map((x) => ({ ...x, photos: (Array.isArray(x.photos) ? x.photos : []).filter(Boolean) }));
  const coll = (id) => collections.find((c) => c.id === id) || null;
  const type = (id) => types.find((t) => t.id === id) || null;
  const pages = C.pages || {};
  const pageVisible = (k) => !!(pages[k] && pages[k].afficher !== false && (pages[k].texte || k === 'tailles'));
  return { collections, types, pieces, coll, type, pages, pageVisible };
}

/* Lignes d'une demande de commande, prix recalculés à partir du contenu (serveur et navigateur) */
export function lignesPanier(C, articles) {
  const { pieces } = donnees(C);
  const out = [];
  (Array.isArray(articles) ? articles : []).slice(0, 20).forEach((a) => {
    const x = pieces.find((p) => p.id === (a && a.id));
    if (!x || x.vendue) return;
    const qte = Math.min(5, Math.max(1, Math.round(+a.qte || 1)));
    const taille = x.tailles && TAILLES.includes(+a.taille) ? +a.taille : null;
    const gravure = x.gravure ? String(a.gravure || '').slice(0, 30).trim() : '';
    out.push({ id: x.id, nom: x.nom, prix: prixNombre(x.prix), qte, taille, gravure, photo: x.photos[0] || '', tailles: !!x.tailles });
  });
  return out;
}

function src(p, largeur) {
  if (!p) return '';
  p = String(p).trim();
  if (/^https:\/\/images\.unsplash\.com\//.test(p)) return p.split('?')[0] + `?auto=format&fit=crop&w=${largeur}&q=70`;
  if (/^(https:\/\/|data:image\/|\/photos\/|\/assets\/)/i.test(p)) return p;
  return '';
}
/* Vidéo de fond (accueil) : fichier envoyé depuis l'espace de modification, lien https .mp4/.webm, ou fichier du site */
export const videoSrc = (v) => { v = String(v || '').trim(); return /^(https:\/\/\S+\.(mp4|webm)(\?\S*)?|\/videos\/[a-z0-9-]+|\/assets\/\S+\.(mp4|webm)|data:video\/(mp4|webm);base64,\S+)$/i.test(v) ? v : ''; };
const ICO_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>';
function videoFond(v, poster, cls) {
  const s = videoSrc(v);
  if (!s) return '';
  const type = /^data:video\/webm|\.webm(\?|$)/i.test(s) ? 'video/webm' : 'video/mp4';
  return `<video class="${cls}" autoplay muted loop playsinline preload="auto"${poster ? ` poster="${esc(poster)}"` : ''} aria-hidden="true" data-video-fond><source src="${esc(s)}" type="${type}"></video><button class="video-pause" type="button" data-video-pause aria-label="Mettre la vidéo en pause" aria-pressed="false">${ICO_PAUSE}</button>`;
}
function img(p, largeur, cls, prio, alt) {
  const s = src(p, largeur);
  return s ? `<img class="${cls}" src="${esc(s)}" alt="${esc(alt || '')}" ${prio ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">` : '';
}

/* Texte enrichi très simple : paragraphes, « ## titre », « - liste », jetons {delai} {maison} {mediateur} */
function texteRiche(s, jetons) {
  const t = String(s || '').replace(/\{(\w+)\}/g, (m, k) => (k in jetons ? jetons[k] : m));
  return t.split(/\n\s*\n/).map((bloc) => {
    let html = '', liste = [], para = [];
    const finL = () => { if (liste.length) { html += '<ul>' + liste.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>'; liste = []; } };
    const finP = () => { if (para.length) { html += '<p>' + para.map(esc).join('<br>') + '</p>'; para = []; } };
    bloc.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => {
      if (l.startsWith('## ')) { finP(); finL(); html += '<h2>' + esc(l.slice(3)) + '</h2>'; } else if (l.startsWith('- ')) { finP(); liste.push(l.slice(2)); } else { finL(); para.push(l); }
    });
    finP(); finL();
    return html;
  }).join('\n');
}
const jetons = (C) => ({ delai: (C.commandes || {}).delai_reponse || '48 heures', maison: (C.maison || {}).nom || 'la maison', mediateur: (C.mentions || {}).mediateur || 'à compléter' });

/* Icônes simples (trait) */
const ico = {
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
  fermer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  tel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5h3l1.5 4-2 1.3a12 12 0 0 0 6.1 6.1l1.3-2 4 1.5v3a1.8 1.8 0 0 1-1.9 1.8A16.6 16.6 0 0 1 4.8 5.4a1.8 1.8 0 0 1 1.8-1.9z"/></svg>',
  sac: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12.5H6L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
  gauche: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  droite: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  lieu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  metal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 17.5l3-8h11l3 8z"/><path d="M6.5 9.5l2-3h7l2 3"/></svg>',
  pierre: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5h11l3.5 5-9 10.5-9-10.5z"/><path d="M3 9.5h18M9 4.5l3 5 3-5M12 20l-3-10.5M12 20l3-10.5"/></svg>',
  poids: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9h10l2 11H5z"/><circle cx="12" cy="6.5" r="2.5"/></svg>',
  gravure: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"/><path d="M14 7l3 3"/></svg>',
  bague: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="14.5" r="6"/><path d="M9.5 6.5L12 4l2.5 2.5L12 8.5z"/></svg>',
};

export const favicon = (C) => src((C.maison || {}).logo, 64) || 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#161616"/></svg>');

/* o = { maquette, urlPolice, css | cssHref, js | jsHref, lienAdmin, apiCommande, apercu, panierInitial } */
function document_(C, o, page) {
  const M = C.maison || {}, T = C.theme || {}, D = donnees(C), K = C.commandes || {};
  const nom = M.nom || 'Maison';
  const theme = `${cssPolices(o.urlPolice || ((f) => '/fonts/' + f))}\n:root{--fond:${hex(T.fond, '#faf8f4')};--encre:${hex(T.encre, '#161616')};--gris:${hex(T.gris, '#5f5a54')};--trait:${hex(T.trait, '#e3ded5')}}`;
  const style = o.css != null ? `<style>\n${o.css}\n${theme}\n</style>` : `<link rel="stylesheet" href="${o.cssHref || '/assets/site.css'}">\n<style>${theme}</style>`;
  const accent = page.accent ? ` style="--accent:${hex(page.accent.couleur, '#161616')};--pale:${hex(page.accent.pale, '#f1eee8')}"` : '';
  const motsNom = nom.split(' ');
  const marque = src(M.logo_texte, 600)
    ? `<img src="${esc(src(M.logo_texte, 600))}" alt="${esc(nom)}">`
    : (motsNom.length > 1 ? `<em>${esc(motsNom[0])}</em> ${esc(motsNom.slice(1).join(' '))}` : esc(nom));
  const telHref = M.telephone ? 'tel:' + String(M.telephone).replace(/[^\d+]/g, '').replace(/^0/, '+33') : '/commande-et-livraison#contact';

  const pagesInfo = [['atelier', 'L’atelier'], ['maison', 'La maison'], ['entretien', 'Entretien'], ['tailles', 'Guide des tailles'], ['commande', 'Commande et livraison']]
    .filter(([k]) => D.pageVisible(k)).map(([k, t]) => `<li><a href="${PAGES[k]}">${esc((D.pages[k] && D.pages[k].titre) || t)}</a></li>`).join('');
  const typesAvecPieces = D.types.filter((t) => D.pieces.some((x) => x.type === t.id));
  const volet = `<div class="volet" id="menu" hidden>
  <div class="volet-in">
    <button class="ico ico-fermer" type="button" data-fermer aria-label="Fermer le menu">${ico.fermer}</button>
    ${D.collections.length ? `<p class="volet-tit">Collections</p><ul class="volet-coll">${D.collections.map((c) => `<li><a href="/collections/${esc(c.id)}" style="--accent:${hex(c.couleur, '#161616')}">${esc(c.nom)}</a></li>`).join('')}</ul>` : ''}
    <p class="volet-tit">Bijoux</p><ul><li><a href="/bijoux">Toutes les pièces</a></li>${typesAvecPieces.map((t) => `<li><a href="/bijoux/${esc(t.id)}">${esc(t.nom)}</a></li>`).join('')}</ul>
    ${pagesInfo ? `<p class="volet-tit">La maison</p><ul>${pagesInfo}</ul>` : ''}
  </div>
</div>`;

  const reseaux = [['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['pinterest', 'Pinterest'], ['youtube', 'YouTube']].filter(([k]) => /^https:\/\//.test(M[k] || ''));
  const pied = `<footer class="pied">
  <div class="wrap">
    <a class="pied-marque" href="/">${src(M.logo, 120) ? `<img src="${esc(src(M.logo, 120))}" alt="" width="56" height="26">` : ''}<span>${esc(nom)}</span></a>
    <div class="pied-cols">
      ${D.collections.length ? `<div><h2>Collections</h2><ul>${D.collections.map((c) => `<li><a href="/collections/${esc(c.id)}">${esc(c.nom)}</a></li>`).join('')}<li><a href="/bijoux">Toutes les pièces</a></li></ul></div>` : ''}
      <div><h2>Informations</h2><ul>${pagesInfo}${D.pageVisible('conditions') ? `<li><a href="${PAGES.conditions}">${esc(D.pages.conditions.titre || 'Conditions de vente')}</a></li>` : ''}</ul></div>
      <div id="contact-pied"><h2>Contact</h2><ul>
        ${M.email ? `<li><a href="mailto:${esc(M.email)}">${esc(M.email)}</a></li>` : ''}
        ${M.telephone ? `<li><a href="${telHref}">${esc(M.telephone)}</a></li>` : ''}
        ${M.ville ? `<li>${esc(M.ville)}</li>` : ''}
        ${reseaux.map(([k, t]) => `<li><a href="${esc(M[k])}" target="_blank" rel="noopener">${t}</a></li>`).join('')}
      </ul></div>
    </div>
    <div class="legal">
      <a href="/mentions-legales">Mentions légales</a>
      <a href="/confidentialite">Confidentialité</a>
      ${o.lienAdmin ? `<a href="${o.lienAdmin}">Espace maison</a>` : ''}
      <span>© ${new Date().getFullYear()} ${esc(nom)}</span>
      ${C.credits_photos ? `<span>${esc(C.credits_photos)}</span>` : ''}
    </div>
  </div>
</footer>`;

  const MAISON = {
    nom, api: o.apiCommande || '', maquette: !!o.maquette, apercu: !!o.apercu, cle: K.cle_web3forms || '', email: K.email || M.email || '',
    actif: K.actif !== false, delai: K.delai_reponse || '48 heures',
    confirmation: String(K.confirmation || 'Merci, votre demande est partie.').replace(/\{delai\}/g, K.delai_reponse || '48 heures'),
    pieces: D.pieces.map((x) => ({ id: x.id, nom: x.nom, prix: prixNombre(x.prix), photo: src(x.photos[0], 300), tailles: !!x.tailles, gravure: !!x.gravure, vendue: !!x.vendue })),
    panier: o.panierInitial || null,
  };
  const donneesJs = `var MAISON=${JSON.stringify(MAISON).replace(/</g, '\\u003c')};`;
  const scripts = o.js != null ? `<script>\n${donneesJs}\n${o.js}\n</script>` : `<script>${donneesJs}</script>\n<script src="${o.jsHref || '/assets/site.js'}" defer></script>`;
  const titre = page.titre ? `${page.titre}, ${nom}` : nom;
  const desc = page.description || M.description_google || '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(desc)}">
${o.maquette ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
${page.image ? `<meta property="og:image" content="${esc(src(page.image, 1200))}">` : ''}
<meta name="theme-color" content="${hex(T.fond, '#faf8f4')}">
<link rel="icon" href="${esc(favicon(C))}">
${style}
</head>
<body class="${page.classe || ''}"${accent}>
<a class="skip" href="#contenu">Aller au contenu</a>
${o.maquette ? `<div class="maquette" role="note">Proposition de site pour ${esc(nom)}, préparée par Grégoire Muel. Version de travail non publiée : textes, prix et photos à valider.</div>` : ''}
${C.annonce && C.annonce.afficher && C.annonce.texte ? `<div class="annonce" role="status">${esc(C.annonce.texte)}</div>` : ''}
<header class="tete">
  <button class="ico" type="button" id="menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="menu">${ico.menu}</button>
  <a class="marque" href="/" aria-label="${esc(nom)}, accueil">${marque}</a>
  <div class="tete-droite">
    <a class="ico" href="${telHref}" aria-label="${M.telephone ? 'Appeler la maison' : 'Contact'}">${ico.tel}</a>
    <a class="ico panier-lien" href="/panier" aria-label="Panier">${ico.sac}<span class="compte" data-compte hidden></span></a>
  </div>
</header>
${volet}
<main id="contenu">
${page.corps}
</main>
${pied}
${page.jsonld ? `<script type="application/ld+json">${JSON.stringify(page.jsonld).replace(/</g, '\\u003c')}</script>` : ''}
${scripts}
</body>
</html>
`;
}

/* ---------- Morceaux ---------- */
const carte = (D, x) => `<li class="carte"><a href="/piece/${esc(x.id)}">
      <span class="carte-img${x.photo_portee ? ' a-portee' : ''}">${img(x.photos[0], 900, 'p1', false, '')}${x.photo_portee ? img(x.photo_portee, 900, 'p2', false, '') : ''}</span>
      <span class="carte-nom">${esc(x.nom)}</span>
      <span class="carte-prix">${x.vendue ? 'Vendue' : esc(prixTexte(x.prix))}</span>
    </a></li>`;
const grille = (D, liste, vide) => (liste.length ? `<ul class="grille">\n    ${liste.map((x) => carte(D, x)).join('\n    ')}\n  </ul>` : `<p class="vide">${esc(vide)}</p>`);
const filtres = (D, liste, actif, base) => {
  const ts = D.types.filter((t) => liste.some((x) => x.type === t.id));
  if (ts.length < 2) return '';
  return `<nav class="filtres" aria-label="Filtrer par type"><a href="${base}"${!actif ? ' aria-current="page"' : ''}>Tout</a>${ts.map((t) => `<a href="${base === '/bijoux' ? '/bijoux/' + esc(t.id) : base + '?type=' + esc(t.id)}"${actif === t.id ? ' aria-current="page"' : ''}>${esc(t.nom)}</a>`).join('')}</nav>`;
};

/* ---------- Pages ---------- */
function accueil(C, D) {
  const A = C.accueil || {}, M = C.maison || {};
  const video = A.fond_video !== false ? videoSrc(A.video) : '';
  const choix = D.pieces.slice(0, 8);
  return {
    classe: 'p-accueil', image: A.photo,
    jsonld: { '@context': 'https://schema.org', '@type': 'Organization', name: M.nom, description: M.description_google || '', ...((C.reglages || {}).url ? { url: C.reglages.url } : {}), sameAs: ['instagram', 'linkedin', 'pinterest', 'youtube'].map((k) => M[k]).filter((u) => /^https:\/\//.test(u || '')) },
    corps: `
  <section class="hero">
    ${video ? videoFond(video, src(A.photo, 2000), 'hero-media') : img(A.photo, 2200, 'hero-media', true, '')}
    <div class="hero-txt wrap">
      <h1>${esc(A.titre || M.nom)}</h1>
      ${A.texte ? `<p>${esc(A.texte)}</p>` : ''}
      ${D.collections.length ? '<a class="lien" href="#collections">Voir les collections</a>' : '<a class="lien" href="/bijoux">Voir les pièces</a>'}
    </div>
  </section>
  ${D.collections.length ? `
  <section class="colls" id="collections" aria-label="Collections">
    <ul>
      ${D.collections.map((c) => `<li style="--accent:${hex(c.couleur, '#161616')}"><a href="/collections/${esc(c.id)}">${img(c.photo, 1200, 'coll-img', false, '')}<span class="coll-nom">${esc(c.nom)}</span></a></li>`).join('\n      ')}
    </ul>
  </section>` : ''}
  ${choix.length ? `
  <section class="sec" aria-labelledby="t-pieces">
    <div class="wrap">
      <div class="sec-tete"><h2 id="t-pieces">Les pièces</h2><a class="lien" href="/bijoux">Toutes les pièces</a></div>
      ${grille(D, choix, '')}
    </div>
  </section>` : ''}
  ${A.mission || D.pageVisible('atelier') ? `
  <section class="bande">
    ${img(A.photo_atelier, 1400, 'bande-img', false, '')}
    <div class="bande-txt">
      <h2>${esc((D.pages.atelier && D.pages.atelier.titre) || 'L’atelier')}</h2>
      ${A.mission ? `<p>${esc(A.mission)}</p>` : ''}
      ${D.pageVisible('atelier') ? `<a class="lien" href="${PAGES.atelier}">Voir l’atelier</a>` : ''}
    </div>
  </section>` : ''}`,
  };
}

function pageListe(C, D, typeId) {
  const t = typeId ? D.type(typeId) : null;
  if (typeId && !t) return null;
  const liste = t ? D.pieces.filter((x) => x.type === t.id) : D.pieces;
  return {
    classe: 'p-liste', titre: t ? t.nom : 'Toutes les pièces',
    corps: `
  <section class="sec sec-haut">
    <div class="wrap">
      <h1>${esc(t ? t.nom : 'Toutes les pièces')}</h1>
      ${filtres(D, D.pieces, typeId, '/bijoux')}
      ${grille(D, liste, 'Aucune pièce en ligne pour le moment.')}
    </div>
  </section>`,
  };
}

function pageCollection(C, D, id, typeId) {
  const c = D.coll(id);
  if (!c) return null;
  const toutes = D.pieces.filter((x) => x.collection === c.id);
  const liste = typeId ? toutes.filter((x) => x.type === typeId) : toutes;
  return {
    classe: 'p-collection', titre: c.nom, description: c.texte, image: c.photo, accent: c,
    corps: `
  <section class="coll-tete">
    <div class="coll-tete-txt">
      <p class="sur">Collection</p>
      <h1>${esc(c.nom)}</h1>
      ${c.texte ? `<p>${esc(c.texte)}</p>` : ''}
    </div>
    ${img(c.photo, 1400, 'coll-tete-img', true, '')}
  </section>
  <section class="sec">
    <div class="wrap">
      ${filtres(D, toutes, typeId, '/collections/' + c.id)}
      ${grille(D, liste, 'Aucune pièce en ligne pour le moment dans cette collection.')}
    </div>
  </section>`,
  };
}

function pagePiece(C, D, id) {
  const x = D.pieces.find((p) => p.id === id);
  if (!x) return null;
  const c = D.coll(x.collection), t = D.type(x.type), M = C.maison || {};
  const images = [...x.photos, ...(x.photo_portee ? [x.photo_portee] : [])];
  const carac = [
    M.fabrication ? [ico.lieu, 'Fabrication', M.fabrication] : null,
    x.metal ? [ico.metal, 'Métal', x.metal] : null,
    x.pierres ? [ico.pierre, 'Pierres', x.pierres] : null,
    x.poids ? [ico.poids, 'Poids', x.poids] : null,
    x.gravure ? [ico.gravure, 'Gravure', 'Possible, à préciser dans la demande'] : null,
    x.tailles ? [ico.bague, 'Tailles', `${TAILLES[0]} à ${TAILLES[TAILLES.length - 1]}`] : null,
  ].filter(Boolean);
  const autres = D.pieces.filter((p) => p.id !== x.id && ((c && p.collection === c.id) || (!c && t && p.type === t.id))).slice(0, 4);
  const prix = prixNombre(x.prix);
  return {
    classe: 'p-piece', titre: x.nom, description: x.description || `${x.nom}${c ? ', collection ' + c.nom : ''}. ${M.nom || ''}`, image: images[0], accent: c,
    jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: x.nom, description: x.description || undefined, image: images.map((u) => src(u, 1200)).filter(Boolean), brand: { '@type': 'Brand', name: M.nom }, ...(prix ? { offers: { '@type': 'Offer', price: prix, priceCurrency: 'EUR', availability: x.vendue ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock' } } : {}) },
    corps: `
  <section class="piece wrap">
    <nav class="fil" aria-label="Fil d’Ariane"><a href="/bijoux">Bijoux</a>${c ? ` <span aria-hidden="true">/</span> <a href="/collections/${esc(c.id)}">${esc(c.nom)}</a>` : ''}${t ? ` <span aria-hidden="true">/</span> <a href="/bijoux/${esc(t.id)}">${esc(t.nom)}</a>` : ''}</nav>
    <div class="piece-grille">
      <div class="galerie" data-galerie>
        <div class="galerie-piste" tabindex="0" aria-label="Photos de la pièce">
          ${images.length ? images.map((u, i) => `<figure class="galerie-vue">${img(u, 1600, 'galerie-img', i === 0, i === images.length - 1 && x.photo_portee ? x.nom + ', portée' : x.nom)}${i === images.length - 1 && x.photo_portee ? '<figcaption>Portée</figcaption>' : ''}</figure>`).join('') : '<figure class="galerie-vue vide-photo"><span>Photo à venir</span></figure>'}
        </div>
        ${images.length > 1 ? `<div class="galerie-nav">
          <button class="ico" type="button" data-prec aria-label="Photo précédente">${ico.gauche}</button>
          <span class="galerie-compte" aria-live="polite"><span data-num>1</span> / ${images.length}</span>
          <button class="ico" type="button" data-suiv aria-label="Photo suivante">${ico.droite}</button>
        </div>
        <div class="galerie-vignettes">${images.map((u, i) => `<button type="button" data-vue="${i}" aria-label="Photo ${i + 1}"${i === 0 ? ' aria-current="true"' : ''}>${img(u, 200, 'vignette', false, '')}</button>`).join('')}</div>` : ''}
      </div>
      <div class="piece-txt">
        ${c ? `<p class="sur"><a href="/collections/${esc(c.id)}">${esc(c.nom)}</a></p>` : ''}
        <h1>${esc(x.nom)}</h1>
        <p class="piece-prix">${x.vendue ? 'Pièce vendue' : esc(prixTexte(x.prix))}</p>
        ${x.description ? `<div class="piece-desc">${texteRiche(x.description, jetons(C))}</div>` : ''}
        ${x.vendue ? '' : `<form class="piece-form" data-piece="${esc(x.id)}" novalidate>
          ${x.tailles ? `<div class="champ"><label for="taille">Taille</label><select id="taille" name="taille" class="saisie"><option value="">Choisir</option>${TAILLES.map((n) => `<option value="${n}">${n}</option>`).join('')}</select>${D.pageVisible('tailles') ? `<a class="petit-lien" href="${PAGES.tailles}">Guide des tailles</a>` : ''}</div>` : ''}
          ${x.gravure ? `<div class="champ"><label class="case"><input type="checkbox" name="graver"> Ajouter une gravure</label><input class="saisie" name="gravure" maxlength="30" placeholder="Texte à graver, 30 signes au plus" hidden></div>` : ''}
          <p class="piece-erreur" role="alert" hidden></p>
          <button class="btn" type="button" data-ajouter>Ajouter au panier</button>
          <p class="piece-ok" role="status" hidden>Ajoutée au panier. <a href="/panier">Voir le panier</a></p>
          <p class="note">Rien n’est payé en ligne : la maison vous répond sous ${esc((C.commandes || {}).delai_reponse || '48 heures')} pour confirmer la pièce, le prix et la livraison.</p>
        </form>`}
        ${carac.length ? `<ul class="carac">${carac.map(([i, l, v]) => `<li>${i}<span><b>${esc(l)}</b>${esc(v)}</span></li>`).join('')}</ul>` : ''}
        <ul class="liens-piece">
          ${D.pageVisible('entretien') ? `<li><a href="${PAGES.entretien}">Entretien</a></li>` : ''}
          ${D.pageVisible('commande') ? `<li><a href="${PAGES.commande}">Commande et livraison</a></li>` : ''}
        </ul>
      </div>
    </div>
  </section>
  ${autres.length ? `
  <section class="sec">
    <div class="wrap">
      <h2>${c ? 'Dans la même collection' : 'Dans le même esprit'}</h2>
      ${grille(D, autres, '')}
    </div>
  </section>` : ''}`,
  };
}

function pagePanier(C) {
  const K = C.commandes || {};
  return {
    classe: 'p-panier', titre: 'Panier',
    corps: `
  <section class="sec sec-haut">
    <div class="wrap panier">
      <h1>Panier</h1>
      <div class="panier-grille">
        <div>
          <ul class="panier-liste" data-panier aria-live="polite"><li class="vide">Votre panier est vide.</li></ul>
          <p class="panier-total" data-total hidden></p>
          <noscript><p>Le panier a besoin de JavaScript.</p></noscript>
        </div>
        ${K.actif === false ? `<div class="demande"><p>Les demandes en ligne sont fermées pour le moment. Écrivez à la maison : voir <a href="${PAGES.commande}#contact">Contact</a>.</p></div>` : `<form class="demande" id="demande" novalidate hidden>
          <h2>Envoyer la demande</h2>
          <p class="note">Rien n’est payé en ligne. La maison vous répond sous ${esc(K.delai_reponse || '48 heures')} pour confirmer la disponibilité, le délai, le prix, le paiement et la livraison.</p>
          <div class="champ"><label for="d-nom">Nom</label><input class="saisie" id="d-nom" name="nom" autocomplete="name" required></div>
          <div class="champ"><label for="d-mail">E-mail</label><input class="saisie" id="d-mail" name="email" type="email" autocomplete="email" required></div>
          <div class="champ"><label for="d-tel">Téléphone</label><input class="saisie" id="d-tel" name="telephone" type="tel" autocomplete="tel" inputmode="tel" required></div>
          <div class="champ"><label for="d-pays">Pays de livraison</label><input class="saisie" id="d-pays" name="pays" autocomplete="country-name" value="France"></div>
          <div class="champ"><label for="d-msg">Message <span class="fac">(facultatif)</span></label><textarea class="saisie" id="d-msg" name="message" rows="3"></textarea></div>
          <input type="checkbox" name="botcheck" class="piege" tabindex="-1" autocomplete="off" aria-hidden="true">
          <p class="demande-erreur" role="alert" hidden></p>
          <button class="btn" type="button" data-envoyer>Envoyer la demande</button>
          <p class="note">Vos coordonnées servent uniquement à traiter cette demande. <a href="/confidentialite">Confidentialité</a></p>
        </form>
        <div class="demande-ok" tabindex="-1" hidden></div>`}
      </div>
    </div>
  </section>`,
  };
}

function pageInfo(C, D, k) {
  const P = D.pages[k];
  if (!D.pageVisible(k)) return null;
  const M = C.maison || {};
  const photos = (P.photos || []).filter(Boolean);
  let extra = '';
  if (k === 'tailles') extra = `<table class="tailles"><caption>Correspondance des tailles</caption><thead><tr><th scope="col">Taille</th><th scope="col">Tour de doigt</th><th scope="col">Diamètre intérieur</th></tr></thead><tbody>${TAILLES.map((n) => `<tr><td>${n}</td><td>${n} mm</td><td>${(n / Math.PI).toFixed(1).replace('.', ',')} mm</td></tr>`).join('')}</tbody></table>`;
  if (k === 'commande') extra = `<div class="contact" id="contact"><h2>Contact</h2>${M.email || M.telephone ? `<ul>${M.email ? `<li><a href="mailto:${esc(M.email)}">${esc(M.email)}</a></li>` : ''}${M.telephone ? `<li><a href="tel:${esc(String(M.telephone).replace(/[^\d+]/g, '').replace(/^0/, '+33'))}">${esc(M.telephone)}</a></li>` : ''}${M.adresse ? `<li>${esc(M.adresse)}, ${esc(M.code_postal || '')} ${esc((M.ville || '').replace(/ \d+e$/, ''))}</li>` : ''}</ul>` : `<p>Écrivez à la maison en envoyant une demande depuis le <a href="/panier">panier</a>, même sans pièce : précisez votre question dans le message.</p>`}</div>`;
  return {
    classe: 'p-info p-' + k, titre: P.titre,
    corps: `
  <section class="sec sec-haut">
    <div class="wrap info${photos.length ? ' avec-photos' : ''}">
      <div class="info-txt">
        <h1>${esc(P.titre)}</h1>
        ${texteRiche(P.texte, jetons(C))}
        ${extra}
      </div>
      ${photos.length ? `<div class="info-photos">${photos.map((u) => img(u, 1200, 'info-img', false, '')).join('')}</div>` : ''}
    </div>
  </section>`,
  };
}

function pageMentions(C) {
  const M = C.mentions || {}, B = C.maison || {};
  const k = (v) => (v ? esc(v) : '<em>à compléter</em>');
  return {
    classe: 'p-info', titre: 'Mentions légales',
    corps: `
  <section class="sec sec-haut"><div class="wrap info"><div class="info-txt">
    <h1>Mentions légales</h1>
    <h2>Éditeur du site</h2>
    <p>${k(M.raison_sociale)}${M.forme ? ', ' + esc(M.forme) : ''}<br>Adresse : ${k(M.adresse)}<br>SIRET : ${k(M.siret)}<br>Directeur de la publication : ${k(M.directeur_publication)}<br>Contact : ${k(M.email || B.email)}</p>
    <h2>Hébergement</h2>
    <p>Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, États-Unis.</p>
    <h2>Médiation de la consommation</h2>
    <p>${k(M.mediateur)}</p>
    <h2>Photos</h2>
    <p>${esc(C.credits_photos || 'Photos : ' + (B.nom || ''))}</p>
  </div></div></section>`,
  };
}

function pageConfidentialite(C) {
  const K = C.commandes || {}, B = C.maison || {};
  return {
    classe: 'p-info', titre: 'Confidentialité',
    corps: `
  <section class="sec sec-haut"><div class="wrap info"><div class="info-txt">
    <h1>Confidentialité</h1>
    <h2>Ce que le site enregistre</h2>
    <p>Le site ne dépose aucun cookie de mesure d’audience ni de publicité. Le contenu de votre panier reste dans votre navigateur.</p>
    <h2>Les demandes de commande</h2>
    <p>Quand vous envoyez une demande, vos nom, e-mail, téléphone, pays et message sont transmis à ${esc(B.nom || 'la maison')}${K.cle_web3forms ? ', par e-mail via le service Web3Forms' : ''}. Ils servent uniquement à traiter votre demande et sont conservés 180 jours au plus, sauf si une vente est conclue.</p>
    <h2>Vos droits</h2>
    <p>Vous pouvez demander l’accès, la correction ou la suppression de vos données${B.email ? ` en écrivant à <a href="mailto:${esc(B.email)}">${esc(B.email)}</a>` : ' auprès de la maison'}, et saisir la CNIL.</p>
  </div></div></section>`,
  };
}

function page404() {
  return { classe: 'p-info', titre: 'Page introuvable', corps: `
  <section class="sec sec-haut"><div class="wrap info"><div class="info-txt">
    <h1>Page introuvable</h1>
    <p>Cette page n’existe pas ou plus.</p>
    <p><a class="lien" href="/">Retour à l’accueil</a> <a class="lien" href="/bijoux">Toutes les pièces</a></p>
  </div></div></section>` };
}

/* Toutes les adresses du site (plan du site, démonstration, tests) */
export function routes(C) {
  const D = donnees(C);
  return ['/', '/bijoux', ...D.types.filter((t) => D.pieces.some((x) => x.type === t.id)).map((t) => '/bijoux/' + t.id),
    ...D.collections.map((c) => '/collections/' + c.id), ...D.pieces.map((x) => '/piece/' + x.id), '/panier',
    ...Object.keys(PAGES).filter((k) => D.pageVisible(k)).map((k) => PAGES[k]), '/mentions-legales', '/confidentialite'];
}

/* Rend une adresse : { statut, html } */
export function rendrePage(C, chemin, o = {}) {
  const D = donnees(C);
  const [p0, requete = ''] = String(chemin || '/').split('?');
  const p = decodeURI(p0).replace(/\/+$/, '') || '/';
  const typeQ = (new URLSearchParams(requete).get('type') || '').slice(0, 60);
  let page = null, m;
  if (p === '/') page = accueil(C, D);
  else if (p === '/bijoux') page = pageListe(C, D, '');
  else if ((m = p.match(/^\/bijoux\/([a-z0-9-]+)$/))) page = pageListe(C, D, m[1]);
  else if ((m = p.match(/^\/collections\/([a-z0-9-]+)$/))) page = pageCollection(C, D, m[1], D.type(typeQ) ? typeQ : '');
  else if ((m = p.match(/^\/piece\/([a-z0-9-]+)$/))) page = pagePiece(C, D, m[1]);
  else if (p === '/panier') page = pagePanier(C);
  else if (p === '/mentions-legales') page = pageMentions(C);
  else if (p === '/confidentialite') page = pageConfidentialite(C);
  else { const k = Object.keys(PAGES).find((x) => PAGES[x] === p); if (k) page = pageInfo(C, D, k); }
  const statut = page ? 200 : 404;
  return { statut, html: document_(C, o, page || page404()) };
}
