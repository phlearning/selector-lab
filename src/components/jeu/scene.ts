/**
 * Rendu et marquage de la Scène d'un Niveau dans son iframe.
 *
 * Le style est appliqué par `adoptedStyleSheets` : aucune balise `<style>` n'est ajoutée au document,
 * qui reste identique à celui des vérifications en CI. Les marques (cibles, nœuds trouvés, survol)
 * sont des attributs retirés avant chaque évaluation, pour que le joueur ne puisse jamais les sélectionner.
 */

export const MARQUES = ['data-jeu-cible', 'data-jeu-trouve', 'data-jeu-survol', 'data-jeu-reussi'] as const;
export type Marque = (typeof MARQUES)[number];

const STYLE_SCENE = `
html { background: #f4ecdc; color-scheme: light; }
body {
  margin: 0; min-height: 100vh; box-sizing: border-box; padding: 40px 24px 28px;
  display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 44px;
  font-family: system-ui, sans-serif;
}
etagere {
  position: relative; display: flex; align-items: flex-end; justify-content: center; gap: 8px;
  min-width: min(560px, 90%); min-height: 132px; padding: 0 18px;
  border-bottom: 14px solid #8b5a2b; box-shadow: 0 6px 0 #5c3a1a;
}
etagere[id]::after {
  content: attr(id); position: absolute; bottom: -14px; left: 14px;
  font: 600 10px/14px ui-monospace, monospace; color: #fbe9cf;
}
livre, magazine {
  position: relative; display: flex; align-items: center; justify-content: center;
  writing-mode: vertical-rl; box-sizing: border-box; overflow: visible;
  font-weight: 600; text-align: center; border-radius: 3px 3px 2px 2px;
}
livre {
  width: 36px; height: 122px; padding: 8px 0; font-size: 12px; color: #fff;
  background: var(--couleur, #6b7280); box-shadow: inset -5px 0 0 rgb(0 0 0 / 0.18), inset 3px 0 0 rgb(255 255 255 / 0.15);
}
livre[genre="sf"] { --couleur: #2563eb; }
livre[genre="polar"] { --couleur: #991b1b; }
livre[genre="poesie"] { --couleur: #7c3aed; }
livre[genre="bd"] { --couleur: #eab308; color: #1f2937; }
livre[genre="cuisine"] { --couleur: #15803d; }
livre.ancien { filter: sepia(0.7); border-radius: 7px 7px 3px 3px; }
livre.abime { rotate: -8deg; transform-origin: bottom left; box-shadow: inset -5px 0 0 rgb(0 0 0 / 0.18), inset 0 -30px 0 rgb(0 0 0 / 0.12); }
livre[annee]::after, magazine[annee]::after {
  content: attr(annee); position: absolute; bottom: 3px; font-size: 9px; opacity: 0.85;
}
magazine {
  width: 24px; height: 92px; font-size: 10px; color: #1f2937; background: #e7e0d0;
  box-shadow: inset -3px 0 0 rgb(0 0 0 / 0.1);
}
magazine.ancien { filter: sepia(0.8); }
boite {
  display: flex; align-items: flex-end; gap: 6px; min-width: 44px; min-height: 64px; padding: 10px 8px 0;
  background: #c9a27e; border: 3px solid #a0785a; border-top: 0; border-radius: 0 0 4px 4px;
}
boite livre { height: 104px; }
plante { display: block; width: 44px; height: 64px; position: relative; }
plante::before { content: "🪴"; position: absolute; bottom: -6px; left: -2px; font-size: 46px; line-height: 1; }
marque-page {
  position: absolute; top: -18px; left: 10px; width: 9px; height: 30px; writing-mode: horizontal-tb;
  background: #9ca3af; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%);
}
marque-page[couleur="rouge"] { background: #dc2626; }
marque-page[couleur="vert"] { background: #059669; }

[data-jeu-cible] { animation: danse 0.7s ease-in-out infinite alternate; }
[data-jeu-trouve] { outline: 3px dashed #0f766e; outline-offset: 4px; }
[data-jeu-survol] { outline: 3px solid #f59e0b; outline-offset: 4px; }
[data-jeu-reussi] { animation: envol 0.8s ease-in forwards; }
@keyframes danse { from { translate: 0 0; } to { translate: 0 -8px; } }
@keyframes envol { to { translate: 0 -120px; opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  [data-jeu-cible] { animation: none; box-shadow: 0 0 0 3px #f59e0b; }
  [data-jeu-reussi] { animation: none; opacity: 0.3; }
}
`;

/**
 * Scénarios e2e : la Page d'exemple garde son rendu par défaut. Les cibles clignotent (ombre) au lieu de
 * sauter, ce qui fonctionne aussi sur les lignes de tableau ; le contour reste libre pour les nœuds trouvés.
 */
const STYLE_SCENARIO = `
html { background: #fff; color: #111; color-scheme: light; }
body { margin: 16px; font-family: system-ui, sans-serif; line-height: 1.45; }
img { width: 48px; height: 48px; background: #e5e7eb; }
[data-jeu-cible] { animation: cible 0.9s ease-in-out infinite alternate; }
[data-jeu-trouve] { outline: 3px dashed #0f766e; outline-offset: 3px; }
[data-jeu-survol] { background-color: rgb(245 158 11 / 0.25) !important; }
[data-jeu-reussi] { box-shadow: 0 0 0 4px #16a34a; background-color: rgb(22 163 74 / 0.15) !important; transition: all 0.4s; }
@keyframes cible { from { box-shadow: 0 0 0 2px rgb(245 158 11 / 0.4); } to { box-shadow: 0 0 0 5px #f59e0b; } }
@media (prefers-reduced-motion: reduce) {
  [data-jeu-cible] { animation: none; box-shadow: 0 0 0 4px #f59e0b; }
}
`;

/** Applique le style de la Scène sans modifier le DOM du document. */
export function styler(doc: Document, scenario = false): void {
  const fenetre = doc.defaultView as (Window & typeof globalThis) | null;
  if (!fenetre) return;
  // La feuille doit être construite dans le contexte de l'iframe pour pouvoir y être adoptée.
  const feuille = new fenetre.CSSStyleSheet();
  feuille.replaceSync(scenario ? STYLE_SCENARIO : STYLE_SCENE);
  doc.adoptedStyleSheets = [feuille];
}

/** Une Scène ne doit jamais naviguer ni envoyer de formulaire quand le joueur clique dedans. */
export function figer(doc: Document): void {
  doc.addEventListener('click', (e) => e.preventDefault());
  doc.addEventListener('submit', (e) => e.preventDefault());
}

export function elementsDeScene(doc: Document): Element[] {
  return doc.body ? Array.from(doc.body.querySelectorAll('*')) : [];
}

export function retirerMarques(doc: Document): void {
  for (const marque of MARQUES) doc.querySelectorAll(`[${marque}]`).forEach((el) => el.removeAttribute(marque));
}

export function marquer(noeuds: Node[], marque: Marque): void {
  for (const noeud of noeuds) {
    const el = noeud.nodeType === Node.ELEMENT_NODE ? (noeud as Element) : noeud.parentElement;
    el?.setAttribute(marque, '');
  }
}
