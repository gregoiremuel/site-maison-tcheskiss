/* Espace maison. Fonctionne avec le serveur (mode normal) ou seul dans un fichier (mode démonstration). */
import { rendrePage, donnees, slug, prixTexte, prixNombre, euros, favicon, PAGES } from './rendu.js';
import { cssPolices } from './polices.js';

const DEMO = window.ESPACE_DEMO || null;
const $ = (s, r) => (r || document).querySelector(s);
const el = (tag, attrs, ...enfants) => {
  const e = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (v == null || v === false) return;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  });
  enfants.flat(Infinity).forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return e;
};
const copie = (o) => JSON.parse(JSON.stringify(o));
let nId = 0; const uid = (p) => (p || 'c') + (++nId);

/* ---------- Accès aux données ---------- */
const vraiApi = {
  async charger() {
    const r = await fetch('/api/contenu', { credentials: 'same-origin' });
    if (r.status === 401) return null;
    const j = await r.json();
    if (!j.ok) throw new Error(j.erreur || 'Erreur');
    return j;
  },
  async connexion(mdp) {
    const r = await fetch('/api/connexion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motdepasse: mdp }) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.erreur || 'Connexion impossible.');
  },
  async deconnexion() { await fetch('/api/deconnexion', { method: 'POST' }); },
  async enregistrer(C) {
    const r = await fetch('/api/contenu', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(C) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) throw Object.assign(new Error(j.erreur), { session: true });
    if (!j.ok) throw new Error(j.erreur || 'Enregistrement impossible.');
  },
  async annuler() {
    const r = await fetch('/api/annuler', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.erreur || 'Impossible de revenir en arrière.');
    return j.contenu;
  },
  async video(fichier) {
    const r = await fetch('/api/video', { method: 'POST', headers: { 'Content-Type': fichier.type }, body: fichier });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.erreur || 'Envoi de la vidéo impossible.');
    return j.url;
  },
  async photo(blob) {
    const r = await fetch('/api/photo', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.erreur || 'Envoi de la photo impossible.');
    return j.url;
  },
  async commandes() {
    const r = await fetch('/api/commandes');
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.erreur || 'Commandes indisponibles.');
    return j.commandes;
  },
  async statut(id, statut) {
    const r = await fetch('/api/commandes/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut }) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.erreur || 'Modification impossible.');
  },
};

/* Petite mémoire du navigateur. Si le navigateur la refuse (aperçu protégé, navigation privée),
   on garde tout en mémoire le temps de la visite : la démonstration fonctionne quand même. */
const memoire = {};
/* La mémoire du navigateur est-elle utilisable ? (non dans l'aperçu de l'app Claude) */
const stockageOk = (() => { try { localStorage.setItem('espace-test', '1'); localStorage.removeItem('espace-test'); return true; } catch (e) { return false; } })();
/* Démonstration : les images déjà dans le fichier ne sont pas recopiées dans la mémoire du navigateur (place limitée à quelques Mo) */
const imagesDemo = [], indexDemo = new Map();
if (DEMO) JSON.stringify(DEMO.contenu, (k, x) => { if (typeof x === 'string' && x.length > 2000 && x.startsWith('data:') && !indexDemo.has(x)) { indexDemo.set(x, imagesDemo.length); imagesDemo.push(x); } return x; });
const versTexte = (v) => JSON.stringify(v, (k, x) => (typeof x === 'string' && indexDemo.has(x) ? '@image-demo:' + indexDemo.get(x) : x));
const depuisTexte = (t) => JSON.parse(t, (k, x) => (typeof x === 'string' && x.startsWith('@image-demo:') ? imagesDemo[+x.slice(12)] || '' : x));
/* Chaque démonstration a sa propre mémoire : tous les fichiers ouverts depuis l'ordinateur partagent la même mémoire du navigateur,
   la clé dépend donc du site et de sa version (une nouvelle démonstration repart toujours de zéro). */
const empreinte = (t) => { let h = 5381; for (let i = 0; i < t.length; i += 7) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36) + t.length.toString(36); };
const PREFIXE = DEMO ? 'demo-' + empreinte(JSON.stringify(DEMO.contenu)) + '-' : 'espace-';
if (DEMO) { try { Object.keys(localStorage).filter((k) => k.startsWith('espace-demo-')).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* rien */ } }
function remettreAZero() {
  Object.keys(memoire).forEach((k) => { if (k.startsWith(PREFIXE)) delete memoire[k]; });
  try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIXE)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* rien */ }
}
const memo = {
  persiste: true,
  lire(k, d) {
    const c = PREFIXE + k;
    if (c in memoire) return depuisTexte(memoire[c]);
    try { const v = localStorage.getItem(c); return v ? depuisTexte(v) : d; } catch (e) { return d; }
  },
  ecrire(k, v) {
    const c = PREFIXE + k, s = versTexte(v);
    let ok = true;
    try { localStorage.setItem(c, s); } catch (e) { ok = false; }
    if (ok || DEMO) memoire[c] = s;
    if (DEMO && k === 'contenu') memo.persiste = ok;
    return ok || !!DEMO;
  },
};
const demoApi = {
  async charger() { return memo.lire('connecte', false) ? { contenu: memo.lire('contenu', copie(DEMO.contenu)), maquette: true } : null; },
  async connexion() { memo.ecrire('connecte', true); },
  async deconnexion() { memo.ecrire('connecte', false); },
  async enregistrer(C) {
    const avant = memo.lire('contenu', copie(DEMO.contenu));
    if (!memo.ecrire('contenu', C)) throw new Error('Mémoire du téléphone pleine : retirez une photo.');
    /* « Revenir en arrière » de la démonstration : gardé pendant la visite, pour laisser la place au contenu */
    memoire[PREFIXE + 'precedent'] = versTexte(avant);
    try { localStorage.removeItem(PREFIXE + 'precedent'); } catch (e) { /* rien */ }
  },
  async annuler() { const p = memo.lire('precedent', null); if (!p) throw new Error('Aucune version précédente.'); memo.ecrire('contenu', p); return p; },
  async photo(blob) { return await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(blob); }); },
  async video(fichier) { return await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(fichier); }); },
  async commandes() {
    const C = E.C || DEMO.contenu, P = donnees(C).pieces;
    const a = P[0] || { nom: 'Pièce', prix: '' }, b = P[1] || a;
    const ex = (id, h, statut, nom, lignesPieces) => ({ id, recue: new Date(Date.now() - h * 3600e3).toISOString(), statut, nom,
      lignes: [...lignesPieces, ['E-mail', 'exemple@exemple.fr'], ['Téléphone', '06 00 00 00 0' + id.slice(-1)], ['Pays', 'France']] });
    return memo.lire('commandes', [
      ex('ex1', 2, 'nouvelle', 'Exemple : Mme Martin', [[b.nom, [b.tailles ? 'Taille 54' : '', prixTexte(b.prix)].filter(Boolean).join(', ')]]),
      ex('ex2', 30, 'confirmee', 'Exemple : M. Durand', [[a.nom, prixTexte(a.prix)]]),
    ]);
  },
  async statut(id, statut) { const l = await demoApi.commandes(); l.forEach((c) => { if (c.id === id) c.statut = statut; }); memo.ecrire('commandes', l); },
};
const api = DEMO ? demoApi : vraiApi;

/* ---------- État ---------- */
const E = { C: null, base: '', maquette: false, ouverts: new Set(['pieces']), page: '/bijoux', panierApercu: [] };
const modifie = () => JSON.stringify(E.C) !== E.base;
const racine = $('#app');

function toast(t) {
  let b = $('.toast'); if (!b) { b = el('div', { class: 'toast', role: 'status' }); document.body.append(b); }
  b.textContent = t; b.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { b.hidden = true; }, Math.max(3200, t.length * 55));
}

/* ---------- Connexion ---------- */
function ecranConnexion(message) {
  racine.replaceChildren();
  if (DEMO) appliquerTheme(DEMO.contenu);
  else if (!E.apparence) fetch('/api/apparence').then((r) => r.json()).then((j) => { if (j && j.ok) { E.apparence = j; appliquerTheme(j); const h = document.querySelector('.connexion h1'); if (h) h.textContent = j.boutique.nom; } }).catch(() => {});
  const nom = (DEMO && DEMO.contenu.maison.nom) || (E.apparence && E.apparence.boutique.nom) || 'Votre maison';
  const input = el('input', { id: 'mdp', type: 'password', autocomplete: 'current-password', required: true, placeholder: DEMO ? 'Tapez n’importe quoi' : '' });
  const voir = el('button', { type: 'button', text: 'Afficher', onclick: () => { input.type = input.type === 'password' ? 'text' : 'password'; voir.textContent = input.type === 'password' ? 'Afficher' : 'Masquer'; } });
  const err = el('p', { class: 'erreur', role: 'alert', hidden: !message, text: message || '' });
  /* bouton simple (pas « submit ») : fonctionne aussi dans les aperçus qui bloquent les formulaires */
  const seConnecter = async (e) => {
    if (e) e.preventDefault();
    if (bouton.disabled) return;
    err.hidden = true; bouton.disabled = true; bouton.textContent = 'Connexion…';
    try { await api.connexion(input.value); await demarrer(); }
    catch (x) { err.textContent = x.message; err.hidden = false; bouton.disabled = false; bouton.textContent = 'Se connecter'; }
  };
  const bouton = el('button', { class: 'btn', type: 'button', id: 'btn-connexion', text: 'Se connecter', onclick: seConnecter });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') seConnecter(e); });
  const form = el('form', {
    onsubmit: seConnecter,
  },
  el('h1', { text: nom }),
  el('p', { class: 'sous', text: 'Espace maison' }),
  DEMO ? el('p', { class: 'aide', text: 'Démonstration : aucun mot de passe n’est demandé, vos essais restent sur ce téléphone.' }) : null,
  el('div', { class: 'champ' }, el('label', { for: 'mdp', text: 'Mot de passe' }), el('div', { class: 'mdp' }, input, voir)),
  err, bouton,
  el('p', { class: 'aide', text: 'Mot de passe oublié ? Appelez Grégoire.' }),
  DEMO ? el('button', { type: 'button', class: 'btn sec', text: 'Revoir le site', onclick: vueSiteDemo }) : null,
  DEMO ? el('button', { type: 'button', class: 'btn discret', text: 'Remettre la démonstration à zéro', onclick: () => { remettreAZero(); ecranConnexion(); toast('Démonstration remise à zéro : le site est revenu à sa version d’origine.'); } }) : null);
  racine.append(el('main', { class: 'connexion' }, form));
  input.focus();
}

/* ---------- Champs ---------- */
function lire(obj, chemin) { return chemin.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function ecrire(obj, chemin, v) { const ks = chemin.split('.'); const der = ks.pop(); let o = obj; ks.forEach((k) => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }); o[der] = v; }

function champ(obj, def, apres) {
  const id = uid('f');
  const val = lire(obj, def.k);
  const maj = (v) => { ecrire(obj, def.k, v); changement(); if (apres) apres(); };
  const lab = el('label', { for: id }, def.l, def.ex ? el('span', { class: 'ex', text: ' (' + def.ex + ')' }) : null);
  if (def.t === 'case') {
    const c = el('input', { id, type: 'checkbox', checked: !!val, onchange: (e) => maj(e.target.checked) });
    return el('div', { class: 'champ' }, el('label', { class: 'interrupteur', for: id }, c, el('span', { class: 'rail', 'aria-hidden': 'true' }), def.l));
  }
  if (def.t === 'zone') return el('div', { class: 'champ' }, lab, el('textarea', { id, class: 'saisie', rows: def.lignes || 3, placeholder: def.ph || '', oninput: (e) => maj(e.target.value) }, val || ''));
  if (def.t === 'choix') {
    const opts = (typeof def.options === 'function' ? def.options() : def.options).map((o) => (Array.isArray(o) ? o : [o, o]));
    const s = el('select', { id, class: 'saisie', onchange: (e) => maj(e.target.value) }, el('option', { value: '', text: def.vide || '—' }), opts.map(([v, l]) => el('option', { value: v, text: l, selected: v === val })));
    return el('div', { class: 'champ' }, lab, s);
  }
  if (def.t === 'nombre') return el('div', { class: 'champ' }, lab, el('input', { id, class: 'saisie', type: 'number', inputmode: 'numeric', min: def.min, max: def.max, value: val == null ? '' : val, oninput: (e) => maj(e.target.value === '' ? '' : +e.target.value) }));
  if (def.t === 'photo') return champPhoto(id, def, val, maj);
  if (def.t === 'video') return champVideo(id, def, val, maj);
  if (def.t === 'photos') return champPhotos(obj, def, apres);
  if (def.t === 'couleur') {
    const avis = el('span', { class: 'ex', 'aria-live': 'polite' });
    const verifier = (v) => { avis.textContent = /^#[0-9a-f]{6}$/i.test(v) && contraste(v, def.contre || '#ffffff') < 4.5 ? ' Trop clair : le texte sera difficile à lire, prenez une teinte plus foncée.' : ''; };
    const texte = el('input', { class: 'saisie', value: val || '', 'aria-label': def.l + ' (code)', oninput: (e) => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) { pick.value = e.target.value; maj(e.target.value); verifier(e.target.value); } } });
    const pick = el('input', { id, type: 'color', class: 'pastille-couleur', value: /^#[0-9a-f]{6}$/i.test(val || '') ? val : '#888888', oninput: (e) => { texte.value = e.target.value; maj(e.target.value); verifier(e.target.value); } });
    verifier(val || '');
    return el('div', { class: 'champ' }, lab, el('div', { class: 'couleur' }, pick, texte), avis);
  }
  return el('div', { class: 'champ' }, lab, el('input', { id, class: 'saisie', type: def.type || 'text', inputmode: def.mode, placeholder: def.ph || '', value: val || '', oninput: (e) => maj(e.target.value) }));
}

async function reduire(fichier, maxCote, qualite) {
  const url = URL.createObjectURL(fichier);
  try {
    const im = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Photo illisible : essayez une autre.')); i.src = url; });
    const r = Math.min(1, maxCote / Math.max(im.naturalWidth, im.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(im.naturalWidth * r); cv.height = Math.round(im.naturalHeight * r);
    cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    return await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', qualite));
  } finally { URL.revokeObjectURL(url); }
}

/* Vidéo de fond : fichier MP4 ou WebM (20 Mo au plus), ou lien */
const VIDEO_OK = /^(https:\/\/\S+\.(mp4|webm)(\?\S*)?|\/videos\/[a-z0-9-]+|\/assets\/\S+\.(mp4|webm)|data:video\/(mp4|webm);base64,\S+)$/i;
function champVideo(id, def, val, maj) {
  const etat = el('span', { class: 'ex', 'aria-live': 'polite' });
  const apercu = el('div', { class: 'video-apercu' });
  const montrer = (v) => {
    apercu.replaceChildren();
    if (v && VIDEO_OK.test(v)) apercu.append(el('video', { src: v, muted: true, loop: true, playsinline: true, autoplay: true, preload: 'metadata', 'aria-hidden': 'true' }));
    retirer.hidden = !v; lien.value = v && !/^data:/.test(v) ? v : '';
  };
  const max = DEMO ? 8 : 20;
  const fichier = el('input', {
    id, type: 'file', accept: 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov',
    onchange: async (e) => {
      const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
      if (!/^video\/(mp4|webm)$/.test(f.type)) { etat.textContent = 'Ce format (souvent .mov sur iPhone) ne se lit pas partout : il faut un fichier MP4. Voir « Vidéo de fond » dans le guide, ou envoyez la vidéo à Grégoire.'; return; }
      if (f.size > max * 1024 * 1024) { etat.textContent = `Vidéo trop lourde (${Math.round(f.size / 1048576)} Mo) : ${max} Mo au plus${DEMO ? ' dans la démonstration' : ''}. Raccourcissez-la (10 à 20 secondes suffisent) ou réduisez sa qualité.`; return; }
      etat.textContent = 'Envoi de la vidéo…';
      try { const u = await api.video(f); maj(u); montrer(u); etat.textContent = 'Vidéo prête : cochez « Vidéo en fond » si besoin, puis enregistrez.'; } catch (x) { etat.textContent = x.message; }
    },
  });
  const choisir = el('label', { class: 'btn sec petit', for: id, text: val ? 'Changer la vidéo' : 'Choisir une vidéo' });
  const retirer = el('button', { type: 'button', class: 'btn discret petit', text: 'Retirer', onclick: () => { maj(''); montrer(''); etat.textContent = 'Vidéo retirée : la photo reprend sa place.'; } });
  const lien = el('input', { class: 'saisie', type: 'url', placeholder: 'ou collez un lien https://….mp4', 'aria-label': 'Lien de la vidéo', onchange: (e) => { const v = e.target.value.trim(); if (!v) return; if (!VIDEO_OK.test(v)) { etat.textContent = 'Lien non valable : il doit commencer par https:// et finir par .mp4 ou .webm.'; return; } maj(v); montrer(v); etat.textContent = 'Lien enregistré : pensez à enregistrer.'; } });
  montrer(val);
  return el('div', { class: 'champ' }, el('span', { class: 'lab', text: def.l }), def.ex ? el('span', { class: 'ex', text: def.ex }) : null,
    el('div', { class: 'video-champ' }, apercu, el('div', {}, el('div', { class: 'actions' }, choisir, retirer, fichier), lien, etat)));
}

function champPhoto(id, def, val, maj) {
  const vignette = el('div', { class: 'vignette', 'aria-hidden': 'true' });
  const montrer = (v) => { vignette.style.backgroundImage = v ? `url("${String(v).replace(/"/g, '%22')}")` : ''; retirer.hidden = !v; };
  const etat = el('span', { class: 'ex', 'aria-live': 'polite' });
  const fichier = el('input', {
    id, type: 'file', accept: 'image/*',
    onchange: async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      etat.textContent = 'Préparation de la photo…';
      try {
        const blob = await reduire(f, DEMO ? 1200 : 1800, DEMO ? 0.72 : 0.82);
        etat.textContent = 'Envoi…';
        const u = await api.photo(blob);
        maj(u); montrer(u); etat.textContent = 'Photo prête : pensez à enregistrer.';
      } catch (x) { etat.textContent = x.message; }
      e.target.value = '';
    },
  });
  const choisir = el('label', { class: 'btn sec petit', for: id, text: val ? 'Changer la photo' : 'Choisir une photo' });
  const retirer = el('button', { type: 'button', class: 'btn discret petit', text: 'Retirer', onclick: () => { maj(''); montrer(''); choisir.textContent = 'Choisir une photo'; } });
  montrer(val);
  return el('div', { class: 'champ' }, el('span', { class: 'lab', text: def.l }),
    el('div', { class: 'photo' }, vignette, el('div', {}, el('div', { class: 'actions' }, choisir, retirer, fichier), etat)));
}

/* ---------- Listes (fromages, plateaux, questions, presse) ---------- */
function editeurListe(cle, cfg) {
  const boite = el('div', { class: 'liste' });
  const dessiner = (ouvrir) => {
    const L = E.C[cle] = E.C[cle] || [];
    boite.replaceChildren();
    L.forEach((it, i) => {
      const titre = el('b', { text: it[cfg.titre] || cfg.sansTitre });
      const sous = el('span', { class: 's', text: cfg.sous ? cfg.sous(it) : '' });
      const ph = () => (typeof cfg.photo === 'function' ? cfg.photo(it) : it[cfg.photo]) || '';
      const mini = cfg.photo ? el('span', { class: 'mini', hidden: !ph(), style: ph() ? `background-image:url("${String(ph()).replace(/"/g, '%22')}")` : '' }) : null;
      const majResume = () => { titre.textContent = it[cfg.titre] || cfg.sansTitre; sous.textContent = cfg.sous ? cfg.sous(it) : ''; if (mini) { mini.hidden = !ph(); mini.style.backgroundImage = ph() ? `url("${String(ph()).replace(/"/g, '%22')}")` : ''; } if (cfg.apres) cfg.apres(it); };
      const sup = el('button', {
        type: 'button', class: 'btn danger petit', text: 'Supprimer',
        onclick: () => {
          if (!sup.classList.contains('confirmer')) { sup.classList.add('confirmer'); sup.textContent = 'Confirmer la suppression'; setTimeout(() => { sup.classList.remove('confirmer'); sup.textContent = 'Supprimer'; }, 4000); return; }
          L.splice(i, 1); changement(); dessiner();
        },
      });
      const bouger = (d) => { const j = i + d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; changement(); dessiner(j); };
      const corps = el('div', { class: 'item-corps' },
        el('div', { class: 'grille' }, cfg.champs.map((def) => champ(it, def, majResume))),
        el('div', { class: 'item-outils' },
          el('div', { class: 'ordre' },
            el('button', { type: 'button', class: 'btn sec petit', disabled: i === 0, onclick: () => bouger(-1), 'aria-label': 'Monter', text: 'Monter' }),
            el('button', { type: 'button', class: 'btn sec petit', disabled: i === L.length - 1, onclick: () => bouger(1), 'aria-label': 'Descendre', text: 'Descendre' })),
          sup));
      const det = el('details', { class: 'item', open: ouvrir === i }, el('summary', {}, mini, el('span', { class: 'txt' }, titre, sous)), corps);
      if (cfg.ouvert) det.addEventListener('toggle', () => { if (det.open) cfg.ouvert(it); });
      boite.append(det);
    });
    if (!L.length) boite.append(el('p', { class: 'vide', text: cfg.vide }));
    boite.append(el('button', { type: 'button', class: 'btn sec ajouter', text: cfg.ajouter, onclick: () => { L.push(copie(cfg.nouveau)); changement(); dessiner(L.length - 1); const f = boite.querySelector('details[open] input, details[open] textarea'); if (f) f.focus(); } }));
    if (cfg.vide && !L.length) { /* déjà affiché */ }
  };
  dessiner();
  return boite;
}

/* ---------- Plusieurs photos (pièces, pages) ---------- */
function champPhotos(obj, def, apres) {
  const boite = el('div', { class: 'photos-liste' });
  const id = uid('ph');
  const etat = el('span', { class: 'ex', 'aria-live': 'polite' });
  const L = () => { const v = lire(obj, def.k); if (Array.isArray(v)) return v; ecrire(obj, def.k, []); return lire(obj, def.k); };
  const dessiner = () => {
    boite.replaceChildren();
    L().forEach((u, i) => {
      boite.append(el('div', { class: 'photo-el' },
        el('div', { class: 'vignette', style: `background-image:url("${String(u).replace(/"/g, '%22')}")`, 'aria-hidden': 'true' }),
        el('div', { class: 'actions' },
          i > 0 ? el('button', { type: 'button', class: 'btn sec petit', text: 'Mettre en premier', onclick: () => { const a = L(); a.unshift(a.splice(i, 1)[0]); changement(); if (apres) apres(); dessiner(); } }) : el('span', { class: 'ex', text: 'Photo principale' }),
          el('button', { type: 'button', class: 'btn discret petit', text: 'Retirer', onclick: () => { L().splice(i, 1); changement(); if (apres) apres(); dessiner(); } }))));
    });
    if (L().length < (def.max || 8)) {
      const fichier = el('input', {
        id, type: 'file', accept: 'image/*', multiple: true,
        onchange: async (e) => {
          const fs = Array.from(e.target.files || []).slice(0, (def.max || 8) - L().length);
          for (const f of fs) {
            etat.textContent = 'Préparation de la photo…';
            try { const blob = await reduire(f, DEMO ? 1200 : 1800, DEMO ? 0.72 : 0.82); etat.textContent = 'Envoi…'; L().push(await api.photo(blob)); changement(); if (apres) apres(); etat.textContent = 'Photo prête : pensez à enregistrer.'; } catch (x) { etat.textContent = x.message; }
          }
          e.target.value = ''; dessiner();
        },
      });
      boite.append(el('div', { class: 'actions' }, el('label', { class: 'btn sec petit', for: id, text: 'Ajouter des photos' }), fichier), etat);
    }
  };
  dessiner();
  return el('div', { class: 'champ' }, el('span', { class: 'lab', text: def.l }), def.ex ? el('span', { class: 'ex', text: def.ex }) : null, boite);
}

/* Contraste WCAG, pour prévenir quand une couleur de collection est trop claire */
function contraste(a, b) {
  const l = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const x = l(a), y = l(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/* Identifiants des pièces, collections et types : tirés du nom à la création, puis fixes */
function assurerIds(C) {
  ['pieces', 'collections', 'types'].forEach((k) => {
    const L = C[k] || [], pris = new Set(L.map((x) => x.id).filter(Boolean));
    L.forEach((x) => { if (!x.id && x.nom) { let b = slug(x.nom) || k, id = b, n = 2; while (pris.has(id)) id = b + '-' + n++; x.id = id; pris.add(id); } });
  });
}

/* ---------- Demandes reçues ---------- */
const STATUTS = [['nouvelle', 'Nouvelle'], ['confirmee', 'Confirmée'], ['payee', 'Payée'], ['expediee', 'Envoyée'], ['annulee', 'Annulée']];
function listeCommandes() {
  const boite = el('div', { class: 'cmds' }, el('p', { class: 'aide', text: 'Chargement des demandes…' }));
  const charger = async () => {
    try {
      const L = await api.commandes();
      E.nouvelles = L.filter((c) => c.statut === 'nouvelle').length;
      majResumes();
      boite.replaceChildren();
      if (!L.length) { boite.append(el('p', { class: 'vide', text: 'Aucune demande pour l’instant. Elles arrivent aussi par e-mail.' })); return; }
      L.forEach((c) => {
        const lignes = Array.isArray(c.lignes) ? c.lignes : [];
        const etiquette = el('span', { class: 'etiquette ' + c.statut, text: (STATUTS.find((s) => s[0] === c.statut) || [, c.statut])[1] });
        const carte = el('div', { class: 'cmd ' + c.statut },
          el('div', { class: 'cmd-tete' }, el('b', { text: c.nom || 'Client' }), etiquette),
          el('dl', {}, lignes.map(([k, v]) => [el('dt', { text: k }), el('dd', {}, k === 'Téléphone' ? el('a', { href: 'tel:' + String(v).replace(/[^\d+]/g, ''), text: v }) : (k === 'E-mail' ? el('a', { href: 'mailto:' + v, text: v }) : v))]),
            el('dt', { text: 'Reçue' }), el('dd', { text: new Date(c.recue).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })),
          el('div', { class: 'statuts', role: 'group', 'aria-label': 'Statut' }, STATUTS.map(([v, tx]) => el('button', {
            type: 'button', 'aria-pressed': String(c.statut === v), text: tx,
            onclick: async () => { try { await api.statut(c.id, v); charger(); } catch (x) { toast(x.message); } },
          }))));
        boite.append(carte);
      });
    } catch (x) { boite.replaceChildren(el('p', { class: 'erreur', text: x.message })); }
  };
  charger();
  return el('div', { class: 'pan-corps', style: 'padding:0' },
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px' }, el('h3', { text: 'Demandes reçues', style: 'font-size:1.125rem' }), el('button', { type: 'button', class: 'btn discret petit', text: 'Actualiser', onclick: charger })),
    boite);
}

/* ---------- Rubriques ---------- */
const montrer = (chemin) => { if (E.page !== chemin) { E.page = chemin; rendreApercu(); } };
function panneaux() {
  const D = () => donnees(E.C);
  const nomColl = (id) => ((E.C.collections || []).find((c) => c.id === id) || {}).nom || '';
  const nomType = (id) => ((E.C.types || []).find((c) => c.id === id) || {}).nom || '';
  const groupe = (titre, champs, avant, chemin) => {
    const d = el('details', { class: 'item' }, el('summary', {}, el('span', { class: 'txt' }, el('b', { text: titre }))), el('div', { class: 'item-corps' }, avant || null, champs.map((def) => champ(E.C, def))));
    if (chemin) d.addEventListener('toggle', () => { if (d.open) montrer(chemin); });
    return d;
  };
  const L = [
    {
      id: 'annonce', titre: 'Message en haut du site', page: '/',
      resume: () => (E.C.annonce && E.C.annonce.afficher && E.C.annonce.texte ? 'Affiché : « ' + E.C.annonce.texte + ' »' : 'Aucun message affiché'),
      corps: () => [
        el('p', { class: 'aide', text: 'Pour un lancement de collection, une fermeture, un salon…' }),
        champ(E.C, { k: 'annonce.afficher', l: 'Afficher le message', t: 'case' }),
        champ(E.C, { k: 'annonce.texte', l: 'Texte du message', ph: 'Ex. : Nouvelle collection Magma' }),
      ],
    },
    {
      id: 'pieces', titre: 'Pièces', page: '/bijoux',
      resume: () => { const P = E.C.pieces || [], ex = P.filter((x) => x.exemple).length; return P.filter((x) => x.visible !== false).length + ' en ligne' + (ex ? ', dont ' + ex + ' exemple' + (ex > 1 ? 's' : '') + ' à remplacer' : ''); },
      corps: () => [
        el('p', { class: 'aide', text: 'Touchez une pièce pour changer ses photos, son prix ou ses textes. Prix vide : « Prix sur demande ». La première photo est la principale ; la photo portée apparaît au survol.' }),
        editeurListe('pieces', {
          titre: 'nom', sansTitre: 'Nouvelle pièce', photo: (x) => (x.photos || [])[0],
          sous: (x) => [nomColl(x.collection), nomType(x.type), x.vendue ? 'vendue' : prixTexte(x.prix), x.visible === false ? 'masquée' : '', x.exemple ? 'exemple à remplacer' : ''].filter(Boolean).join(', '),
          vide: 'Aucune pièce pour l’instant.', ajouter: 'Ajouter une pièce',
          nouveau: { id: '', nom: '', collection: '', type: '', prix: '', photos: [], photo_portee: '', description: '', metal: '', pierres: '', poids: '', tailles: false, gravure: false, vendue: false, visible: true, exemple: false },
          ouvert: (x) => { assurerIds(E.C); if (x.id) montrer('/piece/' + x.id); },
          apres: (x) => { assurerIds(E.C); if (x.id && E.page !== '/piece/' + x.id) montrer('/piece/' + x.id); },
          champs: [
            { k: 'nom', l: 'Nom' },
            { k: 'prix', l: 'Prix en euros', ex: 'vide = sur demande', ph: 'Ex. : 2000', mode: 'decimal' },
            { k: 'collection', l: 'Collection', t: 'choix', vide: 'Aucune', options: () => (E.C.collections || []).filter((c) => c.id).map((c) => [c.id, c.nom]) },
            { k: 'type', l: 'Type', t: 'choix', options: () => (E.C.types || []).filter((c) => c.id).map((c) => [c.id, c.nom]) },
            { k: 'photos', l: 'Photos', t: 'photos', max: 8 },
            { k: 'photo_portee', l: 'Photo portée', ex: 'au survol et en dernier', t: 'photo' },
            { k: 'description', l: 'Description', t: 'zone', lignes: 4 },
            { k: 'metal', l: 'Métal', ph: 'Ex. : or jaune 18 carats' },
            { k: 'pierres', l: 'Pierres', ph: 'Ex. : saphirs orange' },
            { k: 'poids', l: 'Poids', ph: 'Ex. : 7,7 g' },
            { k: 'tailles', l: 'Taille à choisir (bague)', t: 'case' },
            { k: 'gravure', l: 'Gravure possible', t: 'case' },
            { k: 'vendue', l: 'Pièce vendue', t: 'case' },
            { k: 'visible', l: 'Afficher sur le site', t: 'case' },
            { k: 'exemple', l: 'Pièce d’exemple (à remplacer)', t: 'case' },
          ],
        }),
      ],
    },
    {
      id: 'collections', titre: 'Collections', page: '/',
      resume: () => (E.C.collections || []).map((c) => c.nom).filter(Boolean).join(', ') || 'Aucune collection',
      corps: () => [
        el('p', { class: 'aide', text: 'Chaque collection a sa couleur : ses titres et sa page se colorent. Choisissez une couleur assez foncée pour du texte blanc.' }),
        editeurListe('collections', {
          titre: 'nom', sansTitre: 'Nouvelle collection', photo: 'photo', sous: (c) => (c.visible === false ? 'masquée' : ''),
          vide: 'Aucune collection.', ajouter: 'Ajouter une collection',
          nouveau: { id: '', nom: '', couleur: '#4a4a4a', pale: '#f1eee8', photo: '', texte: '', visible: true },
          ouvert: (c) => { assurerIds(E.C); if (c.id) montrer('/collections/' + c.id); },
          apres: () => assurerIds(E.C),
          champs: [
            { k: 'nom', l: 'Nom' }, { k: 'texte', l: 'Texte', t: 'zone' }, { k: 'photo', l: 'Photo', t: 'photo' },
            { k: 'couleur', l: 'Couleur', t: 'couleur' }, { k: 'pale', l: 'Couleur claire (fond de la page)', t: 'couleur', contre: '#161616' },
            { k: 'visible', l: 'Afficher sur le site', t: 'case' },
          ],
        }),
      ],
    },
    {
      id: 'types', titre: 'Types de bijoux', page: '/bijoux',
      resume: () => (E.C.types || []).map((c) => c.nom).filter(Boolean).join(', '),
      corps: () => [
        el('p', { class: 'aide', text: 'Les types servent au menu et aux filtres (Bagues, Colliers…). Seuls ceux qui ont des pièces apparaissent sur le site.' }),
        editeurListe('types', { titre: 'nom', sansTitre: 'Nouveau type', vide: 'Aucun type.', ajouter: 'Ajouter un type', nouveau: { id: '', nom: '' }, apres: () => assurerIds(E.C), champs: [{ k: 'nom', l: 'Nom' }] }),
      ],
    },
    {
      id: 'accueil', titre: 'Accueil', page: '/',
      resume: () => (E.C.accueil && E.C.accueil.titre) || '',
      corps: () => [champ(E.C, { k: 'accueil.photo', l: 'Grande photo', t: 'photo' }), champ(E.C, { k: 'accueil.video', l: 'Vidéo de fond', ex: 'MP4 sans son, 10 à 20 secondes, 20 Mo au plus. La photo reste l’image d’attente.', t: 'video' }), champ(E.C, { k: 'accueil.fond_video', l: 'Vidéo en fond (sinon la photo)', t: 'case' }),
        champ(E.C, { k: 'accueil.titre', l: 'Grand titre' }), champ(E.C, { k: 'accueil.texte', l: 'Phrase sous le titre', t: 'zone' }),
        champ(E.C, { k: 'accueil.mission', l: 'Texte de la bande « atelier »', t: 'zone' }), champ(E.C, { k: 'accueil.photo_atelier', l: 'Photo de la bande « atelier »', t: 'photo' })],
    },
    {
      id: 'pages', titre: 'Pages', page: '/atelier',
      resume: () => Object.keys(PAGES).filter((k) => E.C.pages && E.C.pages[k] && E.C.pages[k].afficher !== false).map((k) => E.C.pages[k].titre).join(', '),
      corps: () => [
        el('p', { class: 'aide', text: 'Dans les textes : une ligne vide entre deux paragraphes, « ## » au début d’une ligne pour un intertitre, « - » pour une liste.' }),
        ...Object.keys(PAGES).map((k) => groupe((E.C.pages[k] && E.C.pages[k].titre) || k, [
          { k: `pages.${k}.afficher`, l: 'Afficher cette page', t: 'case' },
          { k: `pages.${k}.titre`, l: 'Titre' },
          { k: `pages.${k}.texte`, l: 'Texte', t: 'zone', lignes: 12 },
          ...(['atelier', 'maison'].includes(k) ? [{ k: `pages.${k}.photos`, l: 'Photos', t: 'photos', max: 6 }] : []),
        ], k === 'maison' ? el('p', { class: 'aide', text: 'Histoire de la maison, poinçon, archives : à remplir avant de l’afficher.' }) : null, PAGES[k])),
      ],
    },
    {
      id: 'demandes', titre: 'Demandes de commande', page: '/panier',
      resume: () => (E.nouvelles ? E.nouvelles + (E.nouvelles > 1 ? ' nouvelles demandes' : ' nouvelle demande') : (E.C.commandes && E.C.commandes.actif !== false ? 'Panier ouvert' : 'Demandes fermées')),
      corps: () => [
        listeCommandes(),
        el('details', { class: 'item' }, el('summary', {}, el('span', { class: 'txt' }, el('b', { text: 'Réglages des demandes' }), el('span', { class: 's', text: 'Ouverture, délai de réponse, e-mail' }))),
          el('div', { class: 'item-corps' },
            champ(E.C, { k: 'commandes.actif', l: 'Accepter les demandes en ligne', t: 'case' }),
            champ(E.C, { k: 'commandes.delai_reponse', l: 'Délai de réponse annoncé', ph: 'Ex. : 48 heures' }),
            champ(E.C, { k: 'commandes.confirmation', l: 'Message affiché après l’envoi', t: 'zone' }),
            champ(E.C, { k: 'commandes.cle_web3forms', l: 'Clé Web3Forms', ex: 'pour recevoir les demandes par e-mail' }),
            champ(E.C, { k: 'commandes.email', l: 'E-mail de secours', ex: 'utilisé si la clé est vide', type: 'email' }))),
      ],
    },
    {
      id: 'infos', titre: 'Coordonnées, logo et mentions', page: '/mentions-legales',
      resume: () => [E.C.maison.email, E.C.maison.telephone, E.C.maison.ville].filter(Boolean).join(', '),
      corps: () => [
        el('div', { class: 'grille' }, [
          { k: 'maison.nom', l: 'Nom de la maison' }, { k: 'maison.ville', l: 'Ville', ph: 'Ex. : Paris 9e' },
          { k: 'maison.email', l: 'E-mail', type: 'email' }, { k: 'maison.telephone', l: 'Téléphone', type: 'tel', ex: 'facultatif' },
          { k: 'maison.adresse', l: 'Adresse', ex: 'facultatif' }, { k: 'maison.code_postal', l: 'Code postal' },
          { k: 'maison.instagram', l: 'Lien Instagram', type: 'url' }, { k: 'maison.linkedin', l: 'Lien LinkedIn', type: 'url' },
          { k: 'maison.pinterest', l: 'Lien Pinterest', type: 'url' }, { k: 'maison.youtube', l: 'Lien YouTube', type: 'url' },
        ].map((d) => champ(E.C, d))),
        champ(E.C, { k: 'maison.fabrication', l: 'Fabrication (fiche des pièces)', ph: 'Ex. : Créée à Paris' }),
        champ(E.C, { k: 'maison.logo', l: 'Logo (masque)', ex: 'icône d’onglet et pied de page', t: 'photo' }),
        champ(E.C, { k: 'maison.logo_texte', l: 'Nom en image', ex: 'facultatif, remplace le nom écrit en haut', t: 'photo' }),
        champ(E.C, { k: 'maison.description_google', l: 'Description pour Google', t: 'zone' }),
        el('h3', { text: 'Mentions légales', style: 'font-size:1.125rem' }),
        el('div', { class: 'grille' }, [{ k: 'mentions.raison_sociale', l: 'Raison sociale' }, { k: 'mentions.forme', l: 'Forme et capital', ph: 'Ex. : SAS au capital de 1 000 €' }, { k: 'mentions.siret', l: 'SIRET', mode: 'numeric' }, { k: 'mentions.adresse', l: 'Adresse du siège' }, { k: 'mentions.directeur_publication', l: 'Directeur de la publication' }, { k: 'mentions.email', l: 'E-mail de contact', type: 'email' }, { k: 'mentions.mediateur', l: 'Médiateur de la consommation', ph: 'Nom et site du médiateur' }].map((d) => champ(E.C, d))),
        champ(E.C, { k: 'credits_photos', l: 'Crédit des photos', ex: 'à vider quand les photos d’essai sont remplacées', t: 'zone' }),
      ],
    },
  ];
  return L;
}
let PANNEAUX = [];

/* ---------- Démonstration en un seul fichier : le site d'abord, puis l'espace maison ---------- */
const optsDemo = (extra) => ({ maquette: true, urlPolice: (f) => DEMO.polices[f] || '', css: DEMO.css, js: DEMO.js, apiCommande: '', apercu: true, ...extra });
let pageDemo = '/', panierDemo = [];
function vueSiteDemo() {
  let v = document.getElementById('demo-site');
  if (!v) {
    v = el('div', { id: 'demo-site', class: 'apercu-plein' },
      el('div', { class: 'barre' }, el('b', { text: 'Le site' }),
        el('button', { type: 'button', class: 'btn petit', text: 'Essayer l’espace maison', onclick: () => { v.hidden = true; document.body.style.overflow = ''; } })),
      el('iframe', { title: 'Le site' }));
    document.body.append(v);
  }
  /* le site tel qu'il est « en ligne » dans la démonstration : la dernière version enregistrée */
  v.querySelector('iframe').srcdoc = rendrePage(memo.lire('contenu', copie(DEMO.contenu)), pageDemo, optsDemo({ panierInitial: panierDemo })).html;
  v.hidden = false; document.body.style.overflow = 'hidden';
}
/* Les pages affichées dans un cadre (aperçu, démonstration) demandent à changer de page ou gardent leur panier */
window.addEventListener('message', (e) => {
  const m = e.data || {};
  if (!m.maison) return;
  const demo = document.getElementById('demo-site');
  const dansDemo = demo && e.source === demo.querySelector('iframe').contentWindow;
  if (m.maison === 'panier') { if (dansDemo) panierDemo = m.panier || []; else E.panierApercu = m.panier || []; return; }
  if (m.maison === 'aller' && typeof m.chemin === 'string') {
    if (dansDemo) { pageDemo = m.chemin; vueSiteDemo(); demo.querySelector('iframe').addEventListener('load', function f() { this.removeEventListener('load', f); try { this.contentWindow.scrollTo(0, 0); } catch (x) { /* rien */ } }); }
    else if (E.C) { E.page = m.chemin; rendreApercu(true); }
  }
});
let siteMontre = false;

/* ---------- Aperçu en direct ---------- */
let cadres = [];
function rendreApercu(enHaut) {
  assurerIds(E.C);
  const o = DEMO
    ? optsDemo({ panierInitial: E.panierApercu || [] })
    : { maquette: E.maquette, cssHref: '/assets/site.css', jsHref: '/assets/site.js', apiCommande: '', apercu: true, panierInitial: E.panierApercu || [] };
  const page = rendrePage(E.C, E.page || '/', o).html;
  cadres.forEach((f) => {
    let y = 0; try { y = enHaut ? 0 : f.contentWindow.scrollY; } catch (e) { /* rien */ }
    f.onload = () => { try { f.contentWindow.scrollTo(0, y); } catch (e) { /* rien */ } };
    f.srcdoc = page;
  });
}
let minuteur;
function changement() {
  majBarre(); majResumes();
  clearTimeout(minuteur); minuteur = setTimeout(rendreApercu, 450);
}
function majResumes() { PANNEAUX.forEach((p) => { const r = document.getElementById('res-' + p.id); if (r) r.textContent = p.resume(); }); }

/* ---------- Barre d'enregistrement ---------- */
let barre, etatBarre, bEnr, bAnn;
function majBarre() {
  const m = modifie();
  etatBarre.textContent = m ? 'Modifications non enregistrées' : 'Tout est enregistré';
  etatBarre.className = 'etat ' + (m ? 'modifie' : 'ok');
  bEnr.disabled = !m; bAnn.textContent = m ? 'Annuler' : 'Revenir en arrière'; bAnn.title = m ? 'Annuler les modifications non enregistrées' : 'Rétablir la version enregistrée juste avant';
}
async function enregistrer() {
  bEnr.disabled = true; bEnr.textContent = 'Enregistrement…';
  try {
    assurerIds(E.C);
    await api.enregistrer(E.C);
    E.base = JSON.stringify(E.C);
    toast(DEMO ? (memo.persiste ? 'Enregistré (démonstration : dans ce navigateur seulement).' : stockageOk ? 'Enregistré pour cette visite seulement : la mémoire du navigateur est pleine. Retirez des photos pour que ça reste.' : 'Enregistré pour cette visite seulement : cet aperçu ne garde rien après fermeture. Ouvrez le fichier dans un navigateur pour garder vos essais.') : 'Enregistré. Le site est à jour d’ici une minute.');
  } catch (x) {
    if (x.session) { toast('Session expirée : reconnectez-vous, vos modifications sont gardées.'); memo.ecrire('brouillon', E.C); ecranConnexion(x.message); return; }
    toast(x.message);
  }
  bEnr.textContent = 'Enregistrer'; majBarre();
}
async function annuler() {
  if (modifie()) { E.C = JSON.parse(E.base); dessinerEditeur(); rendreApercu(); toast('Modifications annulées.'); return; }
  if (!bAnn.classList.contains('confirmer')) { bAnn.classList.add('confirmer'); bAnn.textContent = 'Confirmer'; setTimeout(() => { bAnn.classList.remove('confirmer'); majBarre(); }, 4000); return; }
  bAnn.classList.remove('confirmer');
  try { E.C = await api.annuler(); E.base = JSON.stringify(E.C); dessinerEditeur(); rendreApercu(); toast('Version précédente rétablie.'); } catch (x) { toast(x.message); }
  majBarre();
}

/* ---------- Écran principal ---------- */
let editeur;
function dessinerEditeur() {
  editeur.replaceChildren(
    el('section', { class: 'intro-edit' },
      el('h1', { text: 'Bonjour' }),
      el('p', { class: 'aide', text: 'Touchez une rubrique pour la modifier, puis « Enregistrer » en bas de l’écran. L’aperçu montre le résultat avant d’enregistrer.' })),
    ...PANNEAUX.map((p) => {
      const d = el('details', { class: 'pan', id: 'pan-' + p.id, open: E.ouverts.has(p.id) },
        el('summary', {}, el('h2', { text: p.titre }), el('span', { class: 'resume', id: 'res-' + p.id, text: p.resume() }), el('span', { class: 'chev', 'aria-hidden': 'true' })));
      let rempli = false;
      const remplir = () => { if (rempli) return; rempli = true; d.append(el('div', { class: 'pan-corps' }, p.corps())); };
      if (d.open) remplir();
      d.addEventListener('toggle', () => { if (d.open) { remplir(); E.ouverts.add(p.id); if (p.page) montrer(p.page); } else E.ouverts.delete(p.id); });
      return d;
    }));
}

function ecranPrincipal() {
  racine.replaceChildren();
  const nom = E.C.maison.nom || 'Votre maison';
  document.title = nom + ' : espace maison';
  PANNEAUX = panneaux();
  appliquerTheme(E.C);
  const plein = el('div', { class: 'apercu-plein', hidden: true },
    el('div', { class: 'barre' }, el('b', { text: 'Aperçu' }), el('button', { type: 'button', class: 'btn sec petit', text: 'Fermer l’aperçu', onclick: () => { plein.hidden = true; document.body.style.overflow = ''; } })),
    el('iframe', { title: 'Aperçu du site', sandbox: 'allow-scripts allow-same-origin allow-popups' }));
  editeur = el('div', { class: 'editeur' });
  const colonne = el('aside', { class: 'apercu-col', 'aria-label': 'Aperçu du site' },
    el('div', { class: 'tel-cadre' }, el('p', { text: 'Aperçu, tel que sur un téléphone' }), el('iframe', { title: 'Aperçu du site', sandbox: 'allow-scripts allow-same-origin allow-popups' })));
  cadres = [colonne.querySelector('iframe'), plein.querySelector('iframe')];

  etatBarre = el('span', { class: 'etat' });
  bEnr = el('button', { type: 'button', class: 'btn', text: 'Enregistrer', onclick: enregistrer });
  bAnn = el('button', { type: 'button', class: 'btn danger', onclick: annuler });
  barre = el('div', { class: 'barre-enr' }, el('div', { class: 'in' }, etatBarre,
    el('button', { type: 'button', class: 'btn sec btn-apercu', text: 'Aperçu', onclick: () => { plein.hidden = false; document.body.style.overflow = 'hidden'; rendreApercu(); } }),
    bAnn, bEnr));

  racine.append(
    el('header', { class: 'haut' }, el('div', { class: 'haut-in' },
      el('div', { class: 'haut-titre' }, el('b', { text: nom }), el('span', { text: 'Espace maison' })),
      el('a', { class: 'btn', href: DEMO ? '#' : '/', target: DEMO ? null : '_blank', rel: 'noopener', text: 'Voir le site', onclick: DEMO ? (e) => { e.preventDefault(); plein.hidden = false; rendreApercu(); } : null }),
      el('button', { type: 'button', class: 'btn', text: 'Se déconnecter', onclick: async () => { if (modifie() && !confirm2()) return; await api.deconnexion(); ecranConnexion(); } }))),
    DEMO ? el('p', { class: 'bandeau', text: 'Démonstration : vos essais restent sur ce téléphone, rien n’est publié.' })
      : (E.maquette ? el('p', { class: 'bandeau', text: 'Le site est encore en mode proposition : les demandes ne sont pas envoyées.' }) : null),
    el('div', { class: 'cadre' }, editeur, colonne), barre, plein);
  dessinerEditeur(); majBarre(); rendreApercu();
  api.commandes().then((L) => { E.nouvelles = L.filter((c) => c.statut === 'nouvelle').length; majResumes(); }).catch(() => {});
}
let avertiDeco = false;
function confirm2() { if (avertiDeco) return true; avertiDeco = true; toast('Des modifications ne sont pas enregistrées. Touchez encore « Se déconnecter » pour les abandonner.'); return false; }

function normaliser(C) {
  ['maison', 'annonce', 'accueil', 'pages', 'commandes', 'mentions', 'theme'].forEach((k) => { if (!C[k] || typeof C[k] !== 'object') C[k] = {}; });
  ['collections', 'types', 'pieces'].forEach((k) => { if (!Array.isArray(C[k])) C[k] = []; });
  Object.keys(PAGES).forEach((k) => { C.pages[k] = Object.assign({ afficher: false, titre: k, texte: '', photos: [] }, C.pages[k] || {}); });
  C.pieces.forEach((x) => { if (!Array.isArray(x.photos)) x.photos = x.photos ? [x.photos] : []; });
  return C;
}
function appliquerTheme(C) {
  let st = document.getElementById('theme-boutique');
  if (!st) { st = el('style', { id: 'theme-boutique' }); document.head.append(st); }
  st.textContent = cssPolices(DEMO ? (f) => DEMO.polices[f] || '' : (f) => '/fonts/' + f) + '\n:root{--bleu:#161616;--bleu-fonce:#000000;--bleu-pale:#f1ede6;--paille:#ece3cf}';
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.setAttribute('content', '#161616');
  const icone = document.querySelector('link[rel=icon]'); if (icone && C && (C.maison || C.logo)) icone.setAttribute('href', favicon(C.maison ? C : { maison: { logo: C.logo } }));
}
async function demarrer() {
  try {
    const r = await api.charger();
    if (!r) { ecranConnexion(); return; }
    const brouillon = memo.lire('brouillon', null);
    E.C = normaliser(r.contenu); E.base = JSON.stringify(E.C); E.maquette = !!r.maquette;
    if (brouillon && !DEMO) { E.C = normaliser(brouillon); memo.ecrire('brouillon', null); toast('Vos modifications non enregistrées ont été récupérées.'); }
    ecranPrincipal();
  } catch (x) {
    racine.replaceChildren(el('main', { class: 'connexion' }, el('div', { class: 'erreur', text: 'Impossible de charger l’espace boutique : ' + x.message + ' Vérifiez la connexion internet et rechargez la page.' })));
  } finally {
    /* démonstration : on montre d'abord le site, une seule fois */
    if (DEMO && DEMO.siteDabord && !siteMontre) { siteMontre = true; vueSiteDemo(); }
  }
}

window.addEventListener('beforeunload', (e) => { if (E.C && modifie()) { e.preventDefault(); e.returnValue = ''; } });
demarrer();
