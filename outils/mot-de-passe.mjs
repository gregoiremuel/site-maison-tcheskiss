// Crée le mot de passe de l'espace boutique et son empreinte (à mettre dans le secret ADMIN_HASH).
// Usage : node outils/mot-de-passe.mjs            -> mot de passe tiré au hasard
//         node outils/mot-de-passe.mjs "mon mot"  -> mot de passe choisi (12 caractères au moins)
import { pbkdf2Sync, randomBytes, randomInt } from 'node:crypto';
const MOTS = ['soleil', 'jardin', 'marche', 'riviere', 'pomme', 'orange', 'balcon', 'lumiere', 'violon', 'piano', 'nuage', 'etoile', 'sapin', 'tilleul', 'cerise', 'prairie', 'voilier', 'bateau', 'colline', 'fenetre', 'biscuit', 'chemin', 'plume', 'ruisseau', 'olive', 'citron', 'lavande', 'renard', 'hibou', 'ardoise'];
let mdp = process.argv[2];
if (!mdp) mdp = Array.from({ length: 4 }, () => MOTS[randomInt(MOTS.length)]).join('-') + '-' + randomInt(10, 99);
if (mdp.length < 12) { console.error('Mot de passe trop court : 12 caractères au moins.'); process.exit(1); }
const sel = randomBytes(16);
const iter = 10000; // limite de calcul de l'offre gratuite Cloudflare (10 ms par requête)
const hash = pbkdf2Sync(mdp, sel, iter, 32, 'sha256').toString('base64');
const secret = randomBytes(32).toString('base64url');
console.log('\nMot de passe à donner à la boutique :\n  ' + mdp);
console.log('\nPuis, dans ce dossier :');
console.log(`  npx wrangler secret put ADMIN_HASH       (coller : pbkdf2$${iter}$${sel.toString('base64')}$${hash})`);
console.log(`  npx wrangler secret put SESSION_SECRET   (coller : ${secret})\n`);
