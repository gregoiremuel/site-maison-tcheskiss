/* Maison : menu, galerie, panier et demande de commande. Sans bibliothèque. */
(function () {
  'use strict';
  var M = window.MAISON || { pieces: [] };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var euros = function (n) { var p = n.toFixed(n % 1 ? 2 : 0).split('.'); return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (p[1] ? ',' + p[1] : '') + ' €'; };
  document.documentElement.classList.add('js');

  /* Vidéo de fond : pause au clic, et à l'arrêt si le visiteur a demandé moins d'animations */
  (function () {
    var PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>', LECTURE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5l11 6.5-11 6.5z"/></svg>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-video-fond]'), function (v) {
      var b = v.parentNode.querySelector('[data-video-pause]');
      var etat = function (pause) { if (!b) return; b.setAttribute('aria-pressed', String(pause)); b.setAttribute('aria-label', pause ? 'Lancer la vidéo' : 'Mettre la vidéo en pause'); b.innerHTML = pause ? LECTURE : PAUSE; };
      var calme = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (calme) { v.removeAttribute('autoplay'); try { v.pause(); } catch (e) { /* rien */ } etat(true); }
      v.addEventListener('error', function () { setTimeout(function () { if (b && (v.error || v.networkState === 3)) b.hidden = true; }, 0); }, true);
      if (b) b.addEventListener('click', function () { if (v.paused) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); etat(false); } else { v.pause(); etat(true); } });
    });
  })();

  /* Photos manquantes : on les cache */
  $$('img').forEach(function (im) { im.addEventListener('error', function () { im.style.visibility = 'hidden'; }); });

  /* Aperçu (espace maison, démonstration) : les liens internes changent la page affichée par le parent */
  if (M.apercu) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var h = a.getAttribute('href');
      if (h && h.charAt(0) === '/') { e.preventDefault(); try { parent.postMessage({ maison: 'aller', chemin: h }, '*'); } catch (x) { /* rien */ } }
    }, true);
  }

  /* Menu */
  var btn = $('#menu-btn'), volet = $('#menu');
  if (btn && volet) {
    var ouvrir = function (o) {
      volet.hidden = !o; btn.setAttribute('aria-expanded', String(o));
      document.documentElement.classList.toggle('menu-ouvert', o);
      if (o) { var a = $('a', volet); if (a) a.focus(); } else btn.focus();
    };
    btn.addEventListener('click', function () { ouvrir(volet.hidden); });
    volet.addEventListener('click', function (e) { if (e.target === volet || e.target.closest('[data-fermer]')) ouvrir(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !volet.hidden) ouvrir(false); });
  }

  /* Panier : mémoire du navigateur, ou de secours, ou celle de l'aperçu */
  var CLE = 'maison-panier', memoire = null;
  var piece = function (id) { for (var i = 0; i < M.pieces.length; i++) if (M.pieces[i].id === id) return M.pieces[i]; return null; };
  var lire = function () {
    var p = null;
    if (M.apercu) p = memoire || M.panier;
    else { try { var v = localStorage.getItem(CLE); if (v) p = JSON.parse(v); } catch (e) { p = memoire; } if (!p) p = memoire; }
    return (Array.isArray(p) ? p : []).filter(function (a) { var x = a && piece(a.id); return x && !x.vendue; });
  };
  var compte = $('[data-compte]');
  var majCompte = function () { var n = lire().reduce(function (s, a) { return s + (+a.qte || 1); }, 0); if (compte) { compte.textContent = n; compte.hidden = !n; } };
  var ecrire = function (p) {
    memoire = p;
    if (M.apercu) { try { parent.postMessage({ maison: 'panier', panier: p }, '*'); } catch (e) { /* rien */ } }
    else { try { localStorage.setItem(CLE, JSON.stringify(p)); } catch (e) { /* mémoire de secours */ } }
    majCompte();
  };
  majCompte();

  /* Galerie de la pièce */
  var gal = $('[data-galerie]');
  if (gal) {
    var piste = $('.galerie-piste', gal), num = $('[data-num]', gal), vues = $$('.galerie-vue', gal), vigs = $$('[data-vue]', gal);
    var aller = function (i) { i = Math.max(0, Math.min(vues.length - 1, i)); piste.scrollTo({ left: i * piste.clientWidth, behavior: 'smooth' }); };
    var courant = function () { return Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth)); };
    piste.addEventListener('scroll', function () {
      var i = courant(); if (num) num.textContent = i + 1;
      vigs.forEach(function (b, j) { if (j === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    }, { passive: true });
    gal.addEventListener('click', function (e) {
      if (e.target.closest('[data-prec]')) aller(courant() - 1);
      else if (e.target.closest('[data-suiv]')) aller(courant() + 1);
      else { var v = e.target.closest('[data-vue]'); if (v) aller(+v.getAttribute('data-vue')); }
    });
    piste.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') aller(courant() - 1); if (e.key === 'ArrowRight') aller(courant() + 1); });
  }

  /* Ajout au panier */
  var pf = $('.piece-form');
  if (pf) {
    var graver = $('[name="graver"]', pf), gravure = $('[name="gravure"]', pf), taille = $('[name="taille"]', pf);
    var err = $('.piece-erreur', pf), ok = $('.piece-ok', pf);
    if (graver) graver.addEventListener('change', function () { gravure.hidden = !graver.checked; if (graver.checked) gravure.focus(); });
    $('[data-ajouter]', pf).addEventListener('click', function () {
      err.hidden = true; ok.hidden = true;
      if (taille && !taille.value) { err.textContent = 'Choisissez une taille (voir le guide des tailles).'; err.hidden = false; taille.focus(); return; }
      var g = graver && graver.checked ? gravure.value.trim() : '';
      if (graver && graver.checked && !g) { err.textContent = 'Écrivez le texte à graver, ou décochez la gravure.'; err.hidden = false; gravure.focus(); return; }
      var a = { id: pf.getAttribute('data-piece'), taille: taille ? +taille.value : null, gravure: g, qte: 1 };
      var p = lire(), deja = null;
      p.forEach(function (b) { if (b.id === a.id && (b.taille || null) === a.taille && (b.gravure || '') === a.gravure) deja = b; });
      if (deja) deja.qte = Math.min(5, (+deja.qte || 1) + 1); else p.push(a);
      ecrire(p); ok.hidden = false;
    });
  }

  /* Page panier */
  var liste = $('[data-panier]');
  if (liste) {
    var total = $('[data-total]'), form = $('#demande'), okBox = $('.demande-ok');
    var options = function (a, x) { var o = []; if (x.tailles && a.taille) o.push('Taille ' + a.taille); if (a.gravure) o.push('Gravure « ' + a.gravure + ' »'); return o.join(', '); };
    var dessiner = function () {
      var p = lire();
      if (!p.length) {
        liste.innerHTML = '<li class="vide">Votre panier est vide. <a href="/bijoux">Voir les pièces</a></li>';
        total.hidden = true; if (form) form.hidden = true; return;
      }
      var somme = 0, surDemande = 0;
      liste.innerHTML = p.map(function (a, i) {
        var x = piece(a.id), q = +a.qte || 1;
        if (x.prix) somme += x.prix * q; else surDemande++;
        return '<li>' + (x.photo ? '<img class="vig" src="' + esc(x.photo) + '" alt="">' : '<span class="vig"></span>') +
          '<div><a href="/piece/' + esc(x.id) + '"><b>' + esc(x.nom) + '</b></a>' +
          (options(a, x) ? '<span class="opt">' + esc(options(a, x)) + '</span>' : '') +
          '<span class="opt">' + (x.prix ? esc(euros(x.prix * q)) : 'Prix sur demande') + '</span>' +
          '<div class="ligne-bas"><span class="qte"><button type="button" data-moins="' + i + '" aria-label="Un de moins">−</button><span>' + q + '</span><button type="button" data-plus="' + i + '" aria-label="Un de plus">+</button></span>' +
          '<button type="button" class="retirer" data-retirer="' + i + '">Retirer</button></div></div></li>';
      }).join('');
      total.innerHTML = somme ? 'Total indicatif : <b>' + esc(euros(somme)) + '</b>' + (surDemande ? ', hors pièces au prix sur demande' : '') : 'Prix confirmés par la maison';
      total.hidden = false; if (form) form.hidden = false;
    };
    liste.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var p = lire();
      if (b.hasAttribute('data-retirer')) p.splice(+b.getAttribute('data-retirer'), 1);
      else if (b.hasAttribute('data-plus')) { var a = p[+b.getAttribute('data-plus')]; a.qte = Math.min(5, (+a.qte || 1) + 1); }
      else if (b.hasAttribute('data-moins')) { var c = p[+b.getAttribute('data-moins')]; c.qte = Math.max(1, (+c.qte || 1) - 1); }
      ecrire(p); dessiner();
    });
    dessiner();

    if (form) {
      var erreur = $('.demande-erreur', form), bouton = $('[data-envoyer]', form);
      var montrer = function (h) { erreur.innerHTML = h; erreur.hidden = false; };
      var envoyer = function (e) {
        if (e) e.preventDefault();
        erreur.hidden = true;
        var p = lire(), nom = form.nom.value.trim(), mail = form.email.value.trim(), tel = form.telephone.value.trim(), pays = form.pays.value.trim(), msg = form.message.value.trim();
        var manque = [];
        if (!p.length) manque.push('une pièce dans le panier');
        if (!nom) manque.push('votre nom');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) manque.push('une adresse e-mail valide');
        if (tel.replace(/\D/g, '').length < 6) manque.push('un numéro de téléphone');
        if (manque.length) { montrer('Il manque ' + manque.join(', ') + '.'); return; }
        var lignes = p.map(function (a) { var x = piece(a.id), q = +a.qte || 1; return [x.nom + (q > 1 ? ' × ' + q : ''), [options(a, x), x.prix ? euros(x.prix * q) : 'Prix sur demande'].filter(Boolean).join(', ')]; });
        var recap = lignes.concat([['Nom', nom], ['E-mail', mail], ['Téléphone', tel], ['Pays', pays || 'Non précisé']]);
        if (msg) recap.push(['Message', msg]);
        var sujet = 'Demande de commande : ' + p.map(function (a) { return piece(a.id).nom; }).join(', ');
        var fini = function (titre, texte) {
          okBox.innerHTML = '<h2>' + esc(titre) + '</h2><p>' + esc(texte) + '</p><dl>' + recap.map(function (l) { return '<dt>' + esc(l[0]) + '</dt><dd>' + esc(l[1]) + '</dd>'; }).join('') + '</dl>';
          form.hidden = true; okBox.hidden = false; okBox.focus();
        };
        if (form.botcheck.checked) { fini('Demande envoyée', M.confirmation); return; }
        if (M.maquette) { fini('Aperçu de la demande', 'Démonstration : rien n’a été envoyé. Une fois le site en ligne, la maison reçoit exactement ce message.'); return; }
        var reussi = function () { ecrire([]); dessiner(); fini('Demande envoyée', M.confirmation); };
        var envois = [];
        if (M.api) envois.push(fetch(M.api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom: nom, email: mail, telephone: tel, pays: pays, message: msg, articles: p }) }).then(function (r) { if (!r.ok) throw new Error('refus'); }));
        if (M.cle) {
          var fd = new FormData();
          fd.append('access_key', M.cle); fd.append('subject', sujet); fd.append('from_name', 'Site ' + M.nom); fd.append('email', mail);
          recap.forEach(function (l) { fd.append(l[0], l[1]); });
          envois.push(fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { Accept: 'application/json' }, body: fd }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.success) throw new Error('refus'); }); }));
        }
        if (!envois.length) {
          if (M.email) { location.href = 'mailto:' + M.email + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(recap.map(function (l) { return l[0] + ' : ' + l[1]; }).join('\n')); fini('Dernière étape', 'Votre messagerie s’ouvre avec la demande déjà rédigée : envoyez-la.'); return; }
          montrer('Les demandes en ligne ne sont pas encore ouvertes.'); return;
        }
        bouton.disabled = true; bouton.textContent = 'Envoi…';
        var ok = false, restants = envois.length;
        envois.forEach(function (pr) {
          pr.then(function () { ok = true; }, function () {}).then(function () {
            if (--restants) return;
            bouton.disabled = false; bouton.textContent = 'Envoyer la demande';
            if (ok) reussi(); else montrer('L’envoi n’a pas abouti. Réessayez dans un instant' + (M.email ? ', ou écrivez à <a href="mailto:' + esc(M.email) + '">' + esc(M.email) + '</a>' : '') + '.');
          });
        });
      };
      bouton.addEventListener('click', envoyer);
      form.addEventListener('submit', envoyer);
    }
  }
})();
