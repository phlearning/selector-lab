// Vérifie la syntaxe YAML du contenu (plus lisible que l'erreur du build) et les pièges connus.
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { parse } from 'yaml';

let erreurs = 0;
for (const chemin of globSync('src/content/**/*.yaml')) {
  const source = readFileSync(chemin, 'utf8');
  // Un « #» précédé d'un espace dans une valeur sans guillemets est lu comme un commentaire YAML :
  // le sélecteur serait tronqué sans erreur. On exige des guillemets dans ce cas.
  source.split('\n').forEach((ligne, i) => {
    if (/^\s*(-\s)?(selecteur|css|xpath|syntaxe|titre): [^'"|>].* #/.test(ligne)) {
      erreurs++;
      console.error(`${chemin}:${i + 1}\n  « #» non protégé par des guillemets : ${ligne.trim()}`);
    }
  });
  try {
    parse(source);
  } catch (e) {
    erreurs++;
    console.error(`${chemin}\n  ${e.message.split('\n')[0]}`);
  }
}
process.exit(erreurs ? 1 : 0);
