/**
 * Gestion du Document cible affiché dans l'iframe du Testeur : construction, marquage des nœuds
 * trouvés et restauration après une expression JavaScript qui l'aurait modifié.
 *
 * Le marquage modifie le DOM (un attribut et une feuille de style) : il est toujours retiré avant
 * l'évaluation suivante, pour que le Sélecteur de l'utilisateur ne le voie jamais.
 */

import { envelopper } from '../../lib/document';

const ATTRIBUT = 'data-selector-lab';
const ID_STYLE = 'selector-lab-marquage';

const STYLE = `
[${ATTRIBUT}] { outline: 3px solid #f59e0b !important; outline-offset: 2px; background-color: rgb(245 158 11 / 0.18) !important; }
[${ATTRIBUT}="actif"] { outline-color: #dc2626 !important; background-color: rgb(220 38 38 / 0.2) !important; }
`;

/** Document HTML complet : un document collé tel quel, ou un fragment enveloppé comme les Pages d'exemple. */
export function documentCible(html: string, titre: string): string {
  if (/<!doctype|<html[\s>]/i.test(html)) return html;
  return envelopper(html, titre);
}

/** Élément à mettre en évidence pour un nœud : lui-même, l'élément d'un attribut, ou le parent d'un texte. */
function elementDe(noeud: Node): Element | null {
  if (noeud.nodeType === Node.ELEMENT_NODE) return noeud as Element;
  if (noeud.nodeType === Node.ATTRIBUTE_NODE) return (noeud as Attr).ownerElement;
  return noeud.parentElement;
}

export function nettoyer(doc: Document): void {
  doc.querySelectorAll(`[${ATTRIBUT}]`).forEach((el) => el.removeAttribute(ATTRIBUT));
  doc.getElementById(ID_STYLE)?.remove();
}

function faireDefiler(doc: Document, el: Element): void {
  const fenetre = doc.defaultView;
  if (!fenetre) return;
  // Pas de scrollIntoView : il ferait aussi défiler la page du Testeur.
  const rect = el.getBoundingClientRect();
  const haut = rect.top + fenetre.scrollY - fenetre.innerHeight / 3;
  fenetre.scrollTo({ top: Math.max(0, haut), behavior: 'smooth' });
}

export function marquer(doc: Document, noeuds: Node[]): void {
  const elements = noeuds.map(elementDe).filter((el): el is Element => el !== null && el.ownerDocument === doc);
  if (elements.length === 0) return;
  const style = doc.createElement('style');
  style.id = ID_STYLE;
  style.textContent = STYLE;
  (doc.head ?? doc.documentElement).append(style);
  for (const el of elements) el.setAttribute(ATTRIBUT, '');
  faireDefiler(doc, elements[0]);
}

export function selectionner(doc: Document, noeuds: Node[], index: number): void {
  doc.querySelectorAll(`[${ATTRIBUT}="actif"]`).forEach((el) => el.setAttribute(ATTRIBUT, ''));
  const el = elementDe(noeuds[index]);
  if (!el) return;
  el.setAttribute(ATTRIBUT, 'actif');
  faireDefiler(doc, el);
}

/** Remet le document dans son état d'origine, sans recharger l'iframe. */
export function restaurer(doc: Document, html: string): void {
  const neuf = new DOMParser().parseFromString(html, 'text/html');
  doc.replaceChild(doc.importNode(neuf.documentElement, true), doc.documentElement);
}
