/** Aide contextuelle affichée par le Testeur quand un Sélecteur échoue ou ne trouve rien. */
import type { Langage, ResultatType } from './resultat';

export interface Diagnostic {
  message: string;
  /** Chemin interne vers la Référence (sans la base du site). */
  lien?: { texte: string; chemin: string };
}

const FONCTIONS_XPATH_2 =
  /\b(lower-case|upper-case|ends-with|matches|replace|tokenize|string-join|exists|empty|distinct-values|max|min|avg|abs|format-number|current-date|index-of|reverse|subsequence)\s*\(/;

const PSEUDO_NON_STANDARD = /:(contains|has-text|text|text-is|visible|eq|first|last|gt|lt|nth-match)\(|:(visible|hidden|first|last)(?![-\w(])/;

export function diagnostiquer(langage: Langage, selecteur: string, resultat: ResultatType): Diagnostic[] {
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

  if (erreur && aide.length === 0) {
    const nom = { css: 'Sélecteur CSS', xpath: 'Expression XPath', dom: 'Expression JavaScript' }[langage];
    aide.push({ message: `${nom} invalide pour ce navigateur.` });
  }
  return aide;
}
