/**
 * Styles des Pages d'exemple (`src/pages-exemple/styles/`). Ils sont appliqués par `adoptedStyleSheets`,
 * sans ajouter de balise au document : un sélecteur donne ainsi le même résultat avec ou sans style
 * (Testeur, Jeu, vérifications en CI).
 */
import commun from '../pages-exemple/styles/commun.css?raw';

const parPage = import.meta.glob<string>('../pages-exemple/styles/*.css', { query: '?raw', import: 'default', eager: true });

export function cssDePage(id: string): string {
  return `${commun}\n${parPage[`../pages-exemple/styles/${id}.css`] ?? ''}`;
}

/** Feuille construite dans le contexte du document (obligatoire pour l'adopter), ajoutée avant `suite`. */
export function adopterStyles(doc: Document, css: string[]): void {
  const fenetre = doc.defaultView as (Window & typeof globalThis) | null;
  if (!fenetre) return;
  doc.adoptedStyleSheets = css.map((texte) => {
    const feuille = new fenetre.CSSStyleSheet();
    feuille.replaceSync(texte);
    return feuille;
  });
}

export function stylerPageExemple(doc: Document, id: string, suite: string[] = []): void {
  adopterStyles(doc, [cssDePage(id), ...suite]);
}
