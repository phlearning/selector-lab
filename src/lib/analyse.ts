/**
 * Analyse d'un Sélecteur CSS : sa décomposition en fonctionnalités, chacune associée à sa clé
 * de compatibilité MDN pour afficher son Support navigateur.
 */
import { RECURSIVE_PSEUDO_CLASSES, tokenize, type Token } from 'parsel-js';

export interface Fonctionnalite {
  /** Clé des données de compatibilité MDN (`css.selectors.has`). */
  cle: string;
  libelle: string;
}

const combinateurs: Record<string, Fonctionnalite> = {
  ' ': { cle: 'css.selectors.descendant', libelle: 'combinateur descendant (A B)' },
  '>': { cle: 'css.selectors.child', libelle: 'combinateur enfant (A > B)' },
  '+': { cle: 'css.selectors.next-sibling', libelle: 'frère adjacent (A + B)' },
  '~': { cle: 'css.selectors.subsequent-sibling', libelle: 'frères suivants (A ~ B)' },
};

function parcourir(selecteur: string, trouve: (f: Fonctionnalite) => void): void {
  for (const token of tokenize(selecteur) as Token[]) {
    switch (token.type) {
      case 'type':
        trouve({ cle: 'css.selectors.type', libelle: 'sélecteur de type (balise)' });
        break;
      case 'universal':
        trouve({ cle: 'css.selectors.universal', libelle: 'sélecteur universel (*)' });
        break;
      case 'id':
        trouve({ cle: 'css.selectors.id', libelle: 'identifiant (#id)' });
        break;
      case 'class':
        trouve({ cle: 'css.selectors.class', libelle: 'classe (.classe)' });
        break;
      case 'attribute': {
        trouve({ cle: 'css.selectors.attribute', libelle: `attribut ([attr${token.operator ?? ''}])` });
        const casse = token.caseSensitive?.toLowerCase();
        if (casse === 'i') trouve({ cle: 'css.selectors.attribute.case_insensitive_modifier', libelle: 'modificateur i (insensible à la casse)' });
        if (casse === 's') trouve({ cle: 'css.selectors.attribute.case_sensitive_modifier', libelle: 'modificateur s (sensible à la casse)' });
        break;
      }
      case 'combinator': {
        const combinateur = combinateurs[token.content];
        if (combinateur) trouve(combinateur);
        break;
      }
      case 'comma':
        trouve({ cle: 'css.selectors.list', libelle: 'liste de sélecteurs (A, B)' });
        break;
      case 'pseudo-element':
        trouve({ cle: `css.selectors.${token.name}`, libelle: `pseudo-élément ::${token.name}` });
        break;
      case 'pseudo-class': {
        const nom = token.name;
        const argument = token.argument;
        trouve({ cle: `css.selectors.${nom}`, libelle: `:${nom}${argument !== undefined ? '()' : ''}` });
        if (!argument) break;
        if (nom === 'nth-child' || nom === 'nth-last-child') {
          const of = /\s+of\s+(.+)$/.exec(argument);
          if (of) {
            trouve({ cle: `css.selectors.${nom}.of_syntax`, libelle: `:${nom}(An+B of S)` });
            parcourir(of[1], trouve);
          }
        } else if (RECURSIVE_PSEUDO_CLASSES.has(nom)) {
          if (nom === 'not' && /[,>+~\s]/.test(argument.trim())) {
            trouve({ cle: 'css.selectors.not.selector_list', libelle: ':not() avec une liste ou un sélecteur complexe' });
          }
          parcourir(argument, trouve);
        }
        break;
      }
    }
  }
}

/** Fonctionnalités utilisées, sans doublon, dans l'ordre d'apparition. Lève une erreur si le sélecteur est illisible. */
export function analyserCss(selecteur: string): Fonctionnalite[] {
  const vues = new Map<string, Fonctionnalite>();
  parcourir(selecteur, (f) => {
    if (!vues.has(f.cle)) vues.set(f.cle, f);
  });
  return [...vues.values()];
}
