# Maison Tcheskiss : site et espace maison

Un site indépendant, à la maison, hébergé gratuitement chez Cloudflare :

- **Le site** : accueil sur grande photo, collections (Tropical, Désert, Magma) avec chacune sa couleur, toutes les pièces avec filtres par type, une page par pièce (photos, vue portée, caractéristiques, taille, gravure), panier, atelier, entretien, guide des tailles, commande et livraison, conditions de vente, mentions légales, confidentialité.
- **Le panier envoie une demande de commande** : rien n'est payé en ligne. La maison reçoit la demande (dans l'espace maison, et par e-mail avec Web3Forms), rappelle le client, encaisse et expédie. Les prix sont toujours recalculés par le serveur.
- **L'espace maison** (`/admin`, avec mot de passe) : pièces (photos, prix, textes, taille, gravure, vendue, masquée), collections et leurs couleurs, types de bijoux, accueil, pages, demandes reçues avec leur statut (Nouvelle, Confirmée, Payée, Envoyée, Annulée), coordonnées, logo et mentions. Un aperçu montre la bonne page en direct avant d'enregistrer.

## La démonstration

`demonstration.html` (fabriqué par `npm run apercu`) : un seul fichier à ouvrir sur un téléphone. Il s'ouvre sur le site (on navigue, on ajoute au panier, on envoie une demande en démonstration), puis « Essayer l'espace maison » (n'importe quel mot de passe). Ce qu'on enregistre dans l'espace maison apparaît sur le site de la démonstration. Rien n'est publié.

Sur ordinateur et sur Android, le fichier se partage tel quel (e-mail, WhatsApp) et s'ouvre dans le navigateur. **Un iPhone n'ouvre pas un fichier HTML** : il faut un lien. Pour cela, `npm run apercu` prépare aussi le dossier `demo-en-ligne/`, à déposer sur Cloudflare Pages (gratuit, possible depuis un iPhone) :

1. Zipper le dossier `demo-en-ligne` (ou prendre le zip fourni). Sur https://dash.cloudflare.com : « Workers & Pages », « Create application », « Pages », « Drag and drop your files ».
2. Donner un nom au projet, choisir le zip, « Deploy site ». Le lien est `nom-du-projet.pages.dev`.
3. Pour une nouvelle version : dans le projet, « Create a new deployment », même lien.

Le lien est accessible à quiconque l'a, mais pas indexé par Google. Chacun teste de son côté : ce qu'il enregistre reste dans son navigateur (une vingtaine de photos ajoutées au plus) et personne d'autre ne le voit. Pour tester à plusieurs sur le même contenu, il faut le vrai site en ligne (voir plus bas).

## Ce qui est provisoire

- **Les photos** : celles de la maison sont en place (grande photo d'accueil, établi, page atelier, deux pierres sur la Broche Phoenix et le Collier Désert), dans `public/assets/photos/`. Les collections (paysages) et les autres photos de pièces sont des photos d'essai libres (Unsplash) : des pierres, pour ne montrer aucun bijou qui ne serait pas de la maison.
- **Cinq pièces sont des exemples** (« Bague Tropical », « Collier Désert »…), marquées « exemple à remplacer » dans l'espace maison. Seule la Broche Phoenix (2 000 €) vient de leur site d'essai ; sa photo (une pierre) reste à remplacer par celle de la broche.
- **Le logo** est un masque redessiné provisoirement : remplacez-le par le vrai fichier (PNG sur fond transparent) dans « Coordonnées, logo et mentions ».
- **La page « La maison »** (histoire, poinçon, archives) est masquée : à écrire avec Anthony, puis l'afficher.
- `npm run verifier` liste tout ce qui reste à faire.

## Vidéo de fond (accueil)

Dans l'espace maison, rubrique « Accueil » : « Vidéo de fond », puis la case « Vidéo en fond (sinon la photo) ». Case décochée, le site garde la photo, comme avant ; la vidéo reste enregistrée pour plus tard. La photo sert aussi d'image d'attente pendant le chargement, et un petit bouton pause s'affiche en bas à droite (obligatoire pour l'accessibilité). Les visiteurs qui ont demandé moins d'animations voient la vidéo à l'arrêt.

Une vidéo d'exemple est déjà prête : un lent mouvement sur ta photo de la pierre verte (`public/assets/videos/accueil-maison.mp4`). Cochez la case pour la voir.

Une bonne vidéo de fond :
- **MP4**, 10 à 20 secondes, **sans son** (elle est toujours muette), **à l'horizontale** ;
- un mouvement lent et régulier (atelier, gestes, matière, lieu), sans texte incrusté, qui boucle bien ;
- **20 Mo au plus** (8 Mo dans la démonstration). Sur Android, la caméra enregistre déjà en MP4 : coupez la vidéo à 15 secondes dans la galerie, en 1080p ou 720p ;
- **iPhone** : la caméra enregistre en .mov, que tous les navigateurs ne lisent pas. Envoyez la vidéo à Grégoire (ou à Claude) : elle sera convertie en MP4 léger, ou utilisez une application de conversion.
- On peut aussi coller un lien https vers un fichier .mp4 déjà en ligne.

## Mettre en ligne (avec Claude Code)

Compte gratuit sur https://dash.cloudflare.com, puis dans Claude Code, ouvert dans ce dossier :

> Installe les dépendances (`npm install`). Lance `npm test` : tout doit être « ok ». Connecte-moi à Cloudflare (`npx wrangler login`). Crée le stockage KV « CONTENU » (`npx wrangler kv namespace create CONTENU`) et mets son id dans `wrangler.jsonc`. Lance `npm run mot-de-passe`, puis enregistre ADMIN_HASH et SESSION_SECRET avec `npx wrangler secret put`. Déploie avec `npm run deploy`. Donne-moi l'adresse du site et le mot de passe. Laisse MAQUETTE à « oui ».

Le site est alors en ligne en mode proposition (bandeau, non indexé par Google, demandes en démonstration), sur une adresse `maison-tcheskiss.toncompte.workers.dev`. L'espace maison est à la même adresse, suivie de `/admin`.

## Avant la vraie ouverture

1. **Dans l'espace maison** : vraies pièces (photos, prix, textes), décocher « Pièce d'exemple » ou supprimer les exemples, vraies photos d'accueil, de collections et d'atelier, vrai logo, coordonnées et réseaux, puis vider le crédit des photos d'essai.
2. **Mentions légales** : raison sociale, forme et capital, SIRET, adresse, directeur de la publication, médiateur de la consommation (obligatoire pour vendre à des particuliers).
3. **Conditions de vente** (page « Pages ») : le texte fourni est une base ; à faire relire, idéalement par un juriste.
4. **Demandes par e-mail** : sur https://web3forms.com, saisir l'e-mail de la maison ; coller la clé reçue dans « Demandes de commande », « Réglages des demandes ». Faire une demande d'essai.
5. **Nom de domaine** : l'acheter au nom de la maison, l'ajouter dans Cloudflare (« Ajouter un site »), puis dans Claude Code :
   > Dans `wrangler.jsonc`, passe MAQUETTE à « non », ajoute la route `{ "pattern": "nomdedomaine.fr", "custom_domain": true }`, puis redéploie.
6. **Google** : le plan du site (`/sitemap.xml`) se crée tout seul ; ajoutez le site dans Google Search Console pour suivre son référencement.

## Plus tard

- **Paiement en ligne** : on pourra ajouter Stripe (carte, Apple Pay, Google Pay) au panier sans changer le reste.
- **Anglais** : le site est en français ; une version anglaise demandera une traduction de chaque texte et de chaque pièce.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm run verifier` | Contrôle le contenu (forme, couleurs lisibles, photos, prix, textes, rendu de chaque page) et liste ce qui reste à faire avant l'ouverture. |
| `npm test` | Lance le vrai serveur sur l'ordinateur et le teste (pages, images, espace maison, prix, demandes, statuts, sécurité). |
| `npm run apercu` | Fabrique `demonstration.html` et le dossier `demo-en-ligne/` (la même démo, à déposer sur Cloudflare Pages pour avoir un lien). |
| `npm run mot-de-passe` | Crée le mot de passe de l'espace maison et son empreinte. |
| `npm run deploy` | Vérifie le contenu puis met en ligne. |

## Entretien

- **Changer le mot de passe** : `npm run mot-de-passe`, puis `npx wrangler secret put ADMIN_HASH`.
- **Sauvegarde du contenu** : `npx wrangler kv key get contenu --binding CONTENU --remote > sauvegarde.json`.
- **Sécurité** : 8 mauvais mots de passe bloquent la connexion 15 minutes ; 6 demandes au plus par appareil et par 10 minutes ; les demandes sont conservées 180 jours.

## Coûts

Cloudflare gratuit (100 000 visites et 1 000 enregistrements par jour). Web3Forms gratuit jusqu'à 250 e-mails par mois. Seul le nom de domaine se paie.

## Fichiers

| Fichier | Rôle |
|---|---|
| `contenu-initial.json` | Le contenu de départ (chargé tant que rien n'a été enregistré) |
| `src/worker.js` | Le serveur : pages, connexion, enregistrement, photos, demandes |
| `public/assets/rendu.js` | Fabrique toutes les pages à partir du contenu |
| `public/assets/site.css`, `site.js` | Design et fonctionnement du site (menu, galerie, panier, demande) |
| `public/assets/polices.js`, `public/fonts/` | Polices : Bodoni Moda (titres) et Hanken Grotesk (texte), licence libre |
| `public/admin/`, `public/assets/admin.*` | L'espace maison |
| `public/assets/masque.svg` | Logo provisoire |
| `public/assets/photos/` | Photos de la maison livrées avec le site (allégées, sans données GPS). Les photos ajoutées ensuite depuis l'espace maison sont rangées à part, dans le stockage du site. |
| `outils/` | Vérificateur, tests, démonstration, mot de passe |
