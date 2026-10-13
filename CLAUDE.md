# Site Maison Tcheskiss : instructions pour Claude

Site et espace maison de la Maison Tcheskiss (joaillerie, Paris). Moteur « catalogue » de la méthode de Greg : la méthode complète est dans le dépôt `gregoiremuel/kit-sites-boutiques` (`METHODE.md`).

- Lis `LISEZMOI.md` avant toute tâche : contenu, ce qui est provisoire, mise en ligne, entretien.
- Le contenu de départ est `contenu-initial.json` ; une fois en ligne, le contenu vit dans l'espace maison (stockage KV) et se modifie depuis `/admin`.
- Photos de la maison : `public/assets/photos/`, 1200 px de large au plus, JPEG ~78, sans métadonnées (position GPS).
- Avant de livrer ou de déployer : `npm run verifier` sans erreur, `npm test` tout « ok », `npm run apercu`, démo essayée.
- Règles : ne rien inventer (prix, pièces, histoire : à valider avec Anthony) ; aucune photo de banque d'images présentée comme une pièce de la maison ; CGV et mentions légales = brouillons à faire relire ; pas de lien public sans l'accord d'Anthony ; pas de paiement en ligne pour l'instant (Stripe plus tard) ; français seul pour l'instant.
- Avec Greg : français, tutoiement, direct. Réponse finale en trois parties : Réponse claire ; Niveau de confiance (0.0 à 1.0, avec la raison) ; Réserves clés.
