// Vérifie la syntaxe YAML du contenu (plus lisible que l'erreur du build), les pièges connus,
// et que les styles des Pages d'exemple ne peuvent pas modifier le résultat d'un sélecteur.
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
// Styles des Pages d'exemple : ils ne doivent rien masquer ni générer de texte, sinon un sélecteur
// (surtout une Requête ARIA) donnerait un résultat différent selon qu'ils sont appliqués ou non.
for (const chemin of globSync('src/pages-exemple/styles/*.css')) {
  const css = readFileSync(chemin, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [motif, raison] of [
    [/display\s*:\s*none/, 'display: none masquerait des éléments'],
    [/(^|[^-])content\s*:/m, 'content: ajouterait du texte au nom accessible'],
    [/\[hidden\]/, "[hidden] ne doit pas être redéfini"],
    [/visibility\s*:\s*hidden/, 'visibility: hidden masquerait des éléments'],
  ]) {
    if (motif.test(css)) {
      erreurs++;
      console.error(`${chemin}\n  Règle interdite : ${raison}.`);
    }
  }
}

process.exit(erreurs ? 1 : 0);
