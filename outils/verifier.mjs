// Vérifie le contenu du site de la maison avant toute démonstration ou mise en ligne.
// Usage : node outils/verifier.mjs [fichier]     (par défaut : contenu-initial.json)
// ERREUR = bloquant ; ALERTE = à regarder ; « À faire » = ce qui reste avant la vraie mise en ligne.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rendrePage, routes, PAGES } from '../public/assets/rendu.js';

export const SCHEMA = 'maison v1';
const FORME = {
  '': ['_schema', 'maison', 'theme', 'annonce', 'accueil', 'collections', 'types', 'pieces', 'pages', 'commandes', 'mentions', 'credits_photos', 'reglages'],
  maison: ['nom', 'logo', 'logo_texte', 'ville', 'adresse', 'code_postal', 'email', 'telephone', 'instagram', 'linkedin', 'pinterest', 'youtube', 'fabrication', 'description_google'],
  theme: ['fond', 'encre', 'gris', 'trait'],
  annonce: ['afficher', 'texte'],
  accueil: ['photo', 'video', 'fond_video', 'titre', 'texte', 'mission', 'photo_atelier'],
  pages: Object.keys(PAGES),
  commandes: ['actif', 'delai_reponse', 'cle_web3forms', 'email', 'confirmation'],
  mentions: ['raison_sociale', 'forme', 'siret', 'adresse', 'directeur_publication', 'email', 'mediateur'],
  reglages: ['url'],
};
const ELEMENTS = {
  collections: ['id', 'nom', 'couleur', 'pale', 'photo', 'texte', 'visible'],
  types: ['id', 'nom'],
  pieces: ['id', 'nom', 'collection', 'type', 'prix', 'photos', 'photo_portee', 'description', 'metal', 'pierres', 'poids', 'tailles', 'gravure', 'vendue', 'visible', 'exemple'],
};
const INTERDITS = [
  [/\bbienvenue\b/i, 'Bienvenue'], [/\bdécouvr(ez|ir)\b/i, 'Découvrez'], [/n['’]hésitez pas/i, 'N’hésitez pas'], [/au c(œ|oe)ur d/i, 'au cœur de'],
  [/\bvéritable/i, 'véritable'], [/\bincontournable/i, 'incontournable'], [/\bpassion/i, 'passion'], [/savoir-faire unique/i, 'savoir-faire unique'],
  [/\bsublim/i, 'sublimer'], [/\bécrin d/i, 'écrin de'], [/\bexpérience\b/i, 'expérience'], [/\bunivers\b/i, 'univers'], [/\bauthentique/i, 'authentique'],
  [/\bde qualité\b/i, 'de qualité'], [/\bd['’]exception\b/i, 'd’exception'], [/\bexcellence\b/i, 'excellence'], [/\bintemporel/i, 'intemporel'], [/\ben savoir plus\b/i, 'En savoir plus'],
];
const HEX = /^#[0-9a-f]{6}$/i;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;
const URL_HTTPS = /^https:\/\/[^\s<>"]+\.[^\s<>"]+$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const estTexte = (v) => typeof v === 'string';
const vide = (v) => !estTexte(v) || !v.trim();
function lum(h) { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
export const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

export function verifier(C) {
  const erreurs = [], alertes = [], afaire = [];
  const E = (m) => erreurs.push(m), A = (m) => alertes.push(m);
  if (!C || typeof C !== 'object' || Array.isArray(C)) { E('Le fichier ne contient pas un objet JSON.'); return { erreurs, alertes, afaire }; }
  let casse = false;
  const lire = (chemin) => chemin.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), C);
  for (const [chemin, cles] of Object.entries(FORME)) {
    const o = chemin ? lire(chemin) : C;
    if (!o || typeof o !== 'object' || Array.isArray(o)) { E(`« ${chemin || 'racine'} » doit être un objet.`); casse = true; continue; }
    cles.filter((k) => !(k in o)).forEach((k) => E(`Clé manquante : ${chemin ? chemin + '.' : ''}${k}`));
    Object.keys(o).filter((k) => !cles.includes(k)).forEach((k) => E(`Clé inconnue : ${chemin ? chemin + '.' : ''}${k}`));
  }
  for (const [liste, cles] of Object.entries(ELEMENTS)) {
    if (!Array.isArray(C[liste])) { E(`« ${liste} » doit être une liste.`); casse = true; continue; }
    C[liste].forEach((x, i) => {
      if (!x || typeof x !== 'object') { E(`${liste}[${i}] doit être un objet.`); casse = true; return; }
      cles.filter((k) => !(k in x)).forEach((k) => E(`Clé manquante : ${liste}[${i}].${k}`));
      Object.keys(x).filter((k) => !cles.includes(k)).forEach((k) => E(`Clé inconnue : ${liste}[${i}].${k}`));
    });
  }
  if (casse) return { erreurs, alertes, afaire };
  if (C._schema !== SCHEMA) E(`_schema doit valoir "${SCHEMA}".`);

  /* Maison et couleurs */
  const M = C.maison, T = C.theme;
  if (vide(M.nom)) E('maison.nom est vide.');
  if (M.email && !EMAIL.test(M.email)) E('maison.email n’est pas une adresse valide.');
  ['instagram', 'linkedin', 'pinterest', 'youtube'].forEach((k) => { if (M[k] && !URL_HTTPS.test(M[k])) E(`maison.${k} doit être un lien https://`); });
  ['fond', 'encre', 'gris', 'trait'].forEach((k) => { if (!HEX.test(T[k] || '')) E(`theme.${k} doit être une couleur #rrggbb.`); });
  if (HEX.test(T.fond) && HEX.test(T.encre) && contraste(T.encre, T.fond) < 7) E('theme : texte trop peu contrasté sur le fond.');
  if (HEX.test(T.fond) && HEX.test(T.gris) && contraste(T.gris, T.fond) < 4.5) E('theme.gris trop clair sur le fond.');

  /* Collections, types, pièces */
  const ids = (L, nom) => { const vus = new Set(); L.forEach((x, i) => { if (!/^[a-z0-9-]{1,60}$/.test(x.id || '')) E(`${nom}[${i}].id doit être en minuscules, chiffres et tirets.`); else if (vus.has(x.id)) E(`${nom} : identifiant en double « ${x.id} ».`); vus.add(x.id); if (vide(x.nom)) E(`${nom}[${i}].nom est vide.`); }); return vus; };
  const idsC = ids(C.collections, 'collections'), idsT = ids(C.types, 'types');
  ids(C.pieces, 'pieces');
  C.collections.forEach((c, i) => {
    ['couleur', 'pale'].forEach((k) => { if (!HEX.test(c[k] || '')) E(`collections[${i}].${k} doit être une couleur #rrggbb.`); });
    if (HEX.test(c.couleur || '')) {
      if (contraste('#ffffff', c.couleur) < 4.5) E(`collections[${i}] (${c.nom}) : couleur trop claire pour le texte blanc de sa vignette.`);
      if (HEX.test(T.fond) && contraste(c.couleur, T.fond) < 4.5) E(`collections[${i}] (${c.nom}) : couleur trop claire pour des titres sur le fond.`);
      if (HEX.test(c.pale || '') && contraste(c.couleur, c.pale) < 4.5) E(`collections[${i}] (${c.nom}) : titre peu lisible sur la couleur claire.`);
    }
    if (typeof c.visible !== 'boolean') E(`collections[${i}].visible doit valoir true ou false.`);
  });
  const photoOk = (chemin, v) => {
    if (vide(v)) return;
    if (/googleusercontent|gstatic|ggpht|wixstatic/i.test(v)) E(`${chemin} : photo hébergée par Google ou Wix, à remplacer par un fichier de la maison.`);
    else if (/^https:\/\/images\.unsplash\.com\//.test(v)) { if (/\?/.test(v)) E(`${chemin} : lien Unsplash sans « ? ».`); return 'essai'; }
    else if (!/^(https:\/\/\S+|\/photos\/[a-z0-9-]+|\/assets\/\S+|data:image\/\S+)$/.test(v)) E(`${chemin} : lien de photo invalide.`);
    else if (/^\/assets\//.test(v) && !existsSync(fileURLToPath(new URL('../public' + v, import.meta.url)))) E(`${chemin} : le fichier public${v} n’existe pas.`);
    return '';
  };
  let essais = 0;
  C.pieces.forEach((x, i) => {
    const n = `pieces[${i}] (${x.nom || '?'})`;
    if (x.collection && !idsC.has(x.collection)) E(`${n} : collection « ${x.collection} » inconnue.`);
    if (!x.type) A(`${n} : aucun type, elle n’apparaîtra dans aucun filtre.`); else if (!idsT.has(x.type)) E(`${n} : type « ${x.type} » inconnu.`);
    if (!vide(x.prix) && !/^\d+([,.]\d{1,2})?$/.test(String(x.prix).replace(/[\s ]/g, ''))) E(`${n} : prix « ${x.prix} » : un nombre seul, sans € (vide = prix sur demande).`);
    if (!Array.isArray(x.photos)) E(`${n} : photos doit être une liste.`);
    else { if (!x.photos.length && x.visible !== false) A(`${n} : aucune photo.`); x.photos.forEach((u, j) => { if (photoOk(`${n}.photos[${j}]`, u) === 'essai') essais++; }); }
    if (photoOk(`${n}.photo_portee`, x.photo_portee) === 'essai') essais++;
    ['tailles', 'gravure', 'vendue', 'visible', 'exemple'].forEach((k) => { if (typeof x[k] !== 'boolean') E(`${n}.${k} doit valoir true ou false.`); });
    if (x.exemple && x.visible !== false) A(`${n} : pièce d’exemple, à remplacer par une vraie pièce (ou à masquer).`);
  });
  if (essais) afaire.push(`${essais} photo(s) d’essai sur les pièces : à remplacer par les photos de la maison.`);
  [['accueil.photo', C.accueil.photo], ['accueil.photo_atelier', C.accueil.photo_atelier], ['maison.logo', M.logo], ['maison.logo_texte', M.logo_texte], ...C.collections.map((c, i) => [`collections[${i}].photo`, c.photo])].forEach(([k, v]) => photoOk(k, v));
  if (C.accueil.video && !/^(https:\/\/\S+\.(mp4|webm)(\?\S*)?|\/videos\/[a-z0-9-]+|\/assets\/\S+\.(mp4|webm)|data:video\/(mp4|webm);base64,\S+)$/i.test(C.accueil.video)) E('accueil.video : un fichier envoyé, ou un lien https se terminant par .mp4 ou .webm.');
  else if (/^\/assets\//.test(C.accueil.video || '') && !existsSync(fileURLToPath(new URL('../public' + C.accueil.video, import.meta.url)))) E(`accueil.video : le fichier public${C.accueil.video} n’existe pas.`);
  if (typeof C.accueil.fond_video !== 'boolean') E('accueil.fond_video doit valoir true ou false.');
  else if (C.accueil.fond_video && !C.accueil.video) A('accueil.fond_video est coché mais aucune vidéo n’est choisie : la photo s’affiche.');

  /* Pages */
  Object.keys(PAGES).forEach((k) => {
    const P = C.pages[k];
    if (!P || typeof P !== 'object') { E(`pages.${k} manquante.`); return; }
    ['afficher', 'titre', 'photos', 'texte'].forEach((c) => { if (!(c in P)) E(`Clé manquante : pages.${k}.${c}`); });
    if (P.afficher && vide(P.titre)) E(`pages.${k} : titre vide.`);
    if (P.afficher && vide(P.texte) && k !== 'tailles') E(`pages.${k} est affichée mais son texte est vide.`);
    (Array.isArray(P.photos) ? P.photos : []).forEach((u, j) => photoOk(`pages.${k}.photos[${j}]`, u));
  });
  if (!C.pages.maison.afficher) afaire.push('Page « La maison » (histoire, poinçon) masquée : à écrire avec Anthony.');

  /* Demandes */
  const K = C.commandes;
  if (typeof K.actif !== 'boolean') E('commandes.actif doit valoir true ou false.');
  if (K.cle_web3forms && !UUID.test(K.cle_web3forms)) E('commandes.cle_web3forms : format de clé invalide.');
  if (K.email && !EMAIL.test(K.email)) E('commandes.email n’est pas une adresse valide.');
  if (!K.cle_web3forms) afaire.push('Clé Web3Forms vide : les demandes arriveront dans l’espace maison, pas encore par e-mail.');

  /* Mentions */
  const Mn = C.mentions;
  const manque = ['raison_sociale', 'siret', 'adresse', 'directeur_publication', 'mediateur'].filter((k) => vide(Mn[k]));
  if (manque.length) afaire.push('Mentions légales à compléter : ' + manque.join(', ') + '.');
  if (Mn.siret && !/^\d{14}$/.test(String(Mn.siret).replace(/\s/g, ''))) E('mentions.siret doit compter 14 chiffres.');
  afaire.push('Conditions de vente : à faire relire avant la vraie mise en ligne.');
  if (/unsplash/i.test(C.credits_photos || '') && !essais) A('credits_photos cite encore Unsplash.');

  /* Style des textes */
  const textes = [['accueil.titre', C.accueil.titre], ['accueil.texte', C.accueil.texte], ['accueil.mission', C.accueil.mission], ['annonce.texte', C.annonce.texte], ['commandes.confirmation', K.confirmation],
    ...C.collections.map((c, i) => [`collections[${i}].texte`, c.texte]), ...C.pieces.map((x, i) => [`pieces[${i}].description`, x.description]),
    ...Object.keys(PAGES).map((k) => [`pages.${k}.texte`, C.pages[k] && C.pages[k].texte])].filter(([, v]) => estTexte(v) && v.trim());
  textes.forEach(([c, v]) => {
    if (v.includes('!')) E(`${c} : point d’exclamation.`);
    if (/\p{Extended_Pictographic}/u.test(v)) E(`${c} : emoji.`);
    if (/—/.test(v)) E(`${c} : tiret long « — ».`);
    if (/\[|\]|TODO|lorem|xxx|à valider/i.test(v)) E(`${c} : texte provisoire.`);
    INTERDITS.forEach(([re, mot]) => { if (re.test(v)) E(`${c} : « ${mot} » fait « site IA » ou cliché, reformulez.`); });
  });

  /* Rendu réel de chaque page */
  try {
    for (const r of routes(C)) {
      const { statut, html } = rendrePage(C, r, { maquette: true, css: '', js: '' });
      const sansScript = html.replace(/<script[\s\S]*?<\/script>/g, '');
      if (statut !== 200) E(`Rendu : ${r} répond ${statut}.`);
      if (/undefined|NaN|\[object Object\]|>null</.test(sansScript)) E(`Rendu : ${r} contient « undefined » ou « NaN ».`);
      if ((html.match(/<h1[\s>]/g) || []).length !== 1) E(`Rendu : ${r} doit avoir un seul grand titre.`);
      const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
      if (ld) { try { JSON.parse(ld[1]); } catch (e) { E(`Rendu : données pour Google illisibles sur ${r}.`); } }
    }
  } catch (e) { E('Le moteur n’arrive pas à fabriquer le site : ' + e.message); }
  return { erreurs, alertes, afaire };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fichier = resolve(process.argv[2] || fileURLToPath(new URL('../contenu-initial.json', import.meta.url)));
  let C;
  try { C = JSON.parse(readFileSync(fichier, 'utf8')); } catch (e) { console.error(`\nERREUR : ${fichier} n’est pas un JSON valide.\n  ${e.message}\n`); process.exit(1); }
  const { erreurs, alertes, afaire } = verifier(C);
  console.log(`\nVérification de ${fichier}${C.maison && C.maison.nom ? ' (' + C.maison.nom + ')' : ''}\n`);
  erreurs.forEach((m) => console.log('  ERREUR   ' + m));
  alertes.forEach((m) => console.log('  ALERTE   ' + m));
  if (afaire.length) { console.log('\n  À faire avant la vraie mise en ligne :'); afaire.forEach((m) => console.log('   - ' + m)); }
  console.log(`\n${erreurs.length ? erreurs.length + ' erreur(s) à corriger.' : 'Aucune erreur.'} ${alertes.length} alerte(s).\n`);
  process.exit(erreurs.length ? 1 : 0);
}
