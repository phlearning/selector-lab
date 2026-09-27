/** Aide contextuelle affichée par le Testeur quand un Sélecteur échoue ou ne trouve rien. */
import { dernierAppel, nomsDisponibles } from './aria';
import type { Langage, ResultatType } from './resultat';

export interface Diagnostic {
  message: string;
  /** Chemin interne vers la Référence (sans la base du site). */
  lien?: { texte: string; chemin: string };
}

const FONCTIONS_XPATH_2 =
  /\b(lower-case|upper-case|ends-with|matches|replace|tokenize|string-join|exists|empty|distinct-values|max|min|avg|abs|format-number|current-date|index-of|reverse|subsequence)\s*\(/;

const PSEUDO_NON_STANDARD = /:(contains|has-text|text|text-is|visible|eq|first|last|gt|lt|nth-match)\(|:(visible|hidden|first|last)(?![-\w(])/;

/** `doc` permet des aides plus précises (noms accessibles présents dans la page) pour les Requêtes ARIA. */
export function diagnostiquer(langage: Langage, selecteur: string, resultat: ResultatType, doc?: Document): Diagnostic[] {
  const s = selecteur.trim();
  const aide: Diagnostic[] = [];
  const erreur = resultat.type === 'erreur';
  const vide = resultat.type === 'noeuds' && resultat.noeuds.length === 0;

  if (langage === 'xpath') {
    const xpath2 = FONCTIONS_XPATH_2.exec(s);
    if (erreur && xpath2) {
      aide.push({
        message: `${xpath2[1]}() est une fonction XPath 2.0 ou plus récente : aucun navigateur ne l'implémente.`,
        lien: { texte: 'Voir les équivalents en XPath 1.0', chemin: 'reference/xpath/xpath-2/' },
      });
    }
    if (erreur && /^[.#[]|^[a-z][\w-]*[.#[:]/i.test(s) && !s.startsWith('..')) {
      aide.push({ message: 'Ce sélecteur ressemble à du CSS. Choisissez le langage CSS, ou écrivez-le en XPath (//balise[@id="..."]).' });
    }
    if (vide && /^[a-z][\w-]*(\[|\/|$)/i.test(s)) {
      aide.push({
        message: `Une expression XPath relative part du document lui-même : « ${s} » cherche un enfant direct du document. Commencez par // pour chercher partout.`,
        lien: { texte: 'Chemins et nœuds', chemin: 'reference/xpath/bases/#descendant' },
      });
    }
  }

  if (langage === 'css') {
    if (erreur && /^\(?\/|^\.\/|@\w|\/\//.test(s)) {
      aide.push({ message: 'Ce sélecteur ressemble à du XPath. Choisissez le langage XPath 1.0.' });
    }
    const nonStandard = PSEUDO_NON_STANDARD.exec(s);
    if (erreur && nonStandard) {
      aide.push({
        message: `:${nonStandard[1] ?? nonStandard[2]} n'est pas une pseudo-classe CSS : elle vient de jQuery ou d'un framework e2e (Playwright, Cypress), qui la traitent eux-mêmes. Le navigateur la refuse.`,
        lien: { texte: 'Trouver un élément par son texte en XPath', chemin: 'reference/xpath/recettes/#texte-exact' },
      });
    }
    if (!erreur && vide && /::[\w-]+/.test(s)) {
      aide.push({
        message: 'Les pseudo-éléments (::before, ::after...) ne sont pas des nœuds du DOM : ils ne sont jamais renvoyés.',
        lien: { texte: 'Pseudo-éléments', chemin: 'reference/css/contexte/#pseudo-elements' },
      });
    }
  }

  if (langage === 'aria' && !erreur && resultat.type === 'noeuds') {
    const appel = dernierAppel(s);
    const nombre = resultat.noeuds.length;
    if (appel?.unique && nombre > 1) {
      aide.push({
        message: `Dans un vrai test, ${appel.methode} lèverait une erreur : ${nombre} éléments correspondent. Précisez le nom, partez d'un conteneur (chaînage), ou utilisez la variante getAllBy.`,
        lien: { texte: 'Variantes des requêtes', chemin: 'reference/aria/pratique/#variantes' },
      });
    }
    const options = appel?.args[1];
    const nom = options && typeof options === 'object' && !(options instanceof RegExp) ? options.name : undefined;
    if (nombre === 0 && appel?.requete === 'Role' && typeof appel.args[0] === 'string' && doc) {
      const noms = nomsDisponibles(doc, appel.args[0]);
      aide.push({
        message: noms.length
          ? `Noms accessibles des éléments « ${appel.args[0]} » de la page : ${noms.map((n) => `« ${n} »`).join(', ')}.`
          : `Aucun élément de rôle « ${appel.args[0]} » dans la page.`,
      });
    }
    if (nombre === 0 && typeof nom === 'string') {
      aide.push({
        message: 'Testing Library compare le nom exactement. Pour une correspondance partielle sans tenir compte de la casse (comme Playwright), utilisez une expression régulière : { name: /texte/i }.',
        lien: { texte: 'Écarts avec Playwright', chemin: 'reference/aria/pratique/#ecarts-playwright' },
      });
    }
  }

  if (erreur && aide.length === 0) {
    const nom = { css: 'Sélecteur CSS', xpath: 'Expression XPath', dom: 'Expression JavaScript', aria: 'Requête ARIA' }[langage];
    aide.push({ message: `${nom} invalide pour ce navigateur.` });
  }
  return aide;
}
