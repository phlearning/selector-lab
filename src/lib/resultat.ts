/**
 * Évaluation d'un Sélecteur sur un Document cible et normalisation de son Résultat typé.
 * Ce module tourne dans le navigateur : c'est le vrai moteur du navigateur qui évalue.
 */

export type Langage = 'css' | 'xpath' | 'dom';

export type ResultatType =
  | { type: 'noeuds'; noeuds: Node[] }
  | { type: 'nombre'; valeur: number }
  | { type: 'chaine'; valeur: string }
  | { type: 'booleen'; valeur: boolean }
  | { type: 'erreur'; message: string };

/** Forme sérialisable d'un Résultat typé, identique au champ `attendu` des Exemples. */
export type Attendu =
  | { noeuds: string[] }
  | { nombre: number }
  | { chaine: string }
  | { booleen: boolean }
  | { erreur: true };

const LONGUEUR_TEXTE = 30;

function texteCourt(texte: string): string {
  const normalise = texte.replace(/\s+/g, ' ').trim();
  return normalise.length > LONGUEUR_TEXTE ? `${normalise.slice(0, LONGUEUR_TEXTE)}…` : normalise;
}

/**
 * Étiquette lisible et stable d'un nœud, utilisée pour afficher et comparer les résultats.
 * Élément : `balise#id`, sinon `balise[name="..."]`, suivi du texte s'il y en a (`li "Dune"`),
 * puis de sa ligne ou de son article s'il est dans l'un d'eux (`button "Supprimer" dans tr[data-id="u3"]`).
 */
export function etiquette(node: Node): string {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE: {
      const el = node as Element;
      let base = el.localName;
      const id = el.getAttribute('id');
      const name = el.getAttribute('name');
      if (id) base += `#${id}`;
      else if (name) base += `[name="${name}"]`;
      const texte = texteCourt(el.textContent ?? '');
      const etiquetteEl = texte ? `${base} "${texte}"` : base;
      // Sans id, on situe l'élément dans sa ligne ou son article (Pages d'exemple : data-id, data-sku).
      const porteur = id ? null : el.parentElement?.closest('[data-id], [data-sku]');
      if (!porteur) return etiquetteEl;
      const [nomAttr, valeur] = porteur.hasAttribute('data-id')
        ? ['data-id', porteur.getAttribute('data-id')]
        : ['data-sku', porteur.getAttribute('data-sku')];
      return `${etiquetteEl} dans ${porteur.localName}[${nomAttr}="${valeur}"]`;
    }
    case Node.ATTRIBUTE_NODE: {
      const attr = node as Attr;
      return `@${attr.name}="${texteCourt(attr.value)}"`;
    }
    case Node.TEXT_NODE:
      return `#text "${texteCourt(node.nodeValue ?? '')}"`;
    case Node.COMMENT_NODE:
      return `#comment "${texteCourt(node.nodeValue ?? '')}"`;
    case Node.DOCUMENT_NODE:
      return '#document';
    default:
      return node.nodeName;
  }
}

function evaluerXPath(doc: Document, expression: string): ResultatType {
  const brut = doc.evaluate(expression, doc, null, XPathResult.ANY_TYPE, null);
  switch (brut.resultType) {
    case XPathResult.NUMBER_TYPE:
      return { type: 'nombre', valeur: brut.numberValue };
    case XPathResult.STRING_TYPE:
      return { type: 'chaine', valeur: brut.stringValue };
    case XPathResult.BOOLEAN_TYPE:
      return { type: 'booleen', valeur: brut.booleanValue };
    default: {
      // Ensemble de nœuds : on réévalue en snapshot ordonné pour garantir l'ordre du document.
      const snap = doc.evaluate(expression, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const noeuds: Node[] = [];
      for (let i = 0; i < snap.snapshotLength; i++) noeuds.push(snap.snapshotItem(i)!);
      return { type: 'noeuds', noeuds };
    }
  }
}

// Vérifications structurelles plutôt que `instanceof` : les nœuds d'une iframe (le Testeur)
// appartiennent à un autre contexte JavaScript et ne sont pas des instances du `Node` de la page.
function estNoeud(valeur: unknown): valeur is Node {
  return typeof valeur === 'object' && valeur !== null && typeof (valeur as Node).nodeType === 'number' && 'nodeName' in valeur;
}

function estListeDeNoeuds(valeur: unknown): valeur is ArrayLike<Node> {
  if (Array.isArray(valeur)) return valeur.every(estNoeud);
  if (typeof valeur !== 'object' || valeur === null) return false;
  const liste = valeur as { length?: unknown; item?: unknown };
  return typeof liste.length === 'number' && typeof liste.item === 'function';
}

/** Normalise la valeur renvoyée par une expression de l'API DOM. */
function normaliserValeurDom(valeur: unknown): ResultatType {
  if (valeur === null || valeur === undefined) return { type: 'noeuds', noeuds: [] };
  if (estNoeud(valeur)) return { type: 'noeuds', noeuds: [valeur] };
  if (estListeDeNoeuds(valeur)) return { type: 'noeuds', noeuds: Array.from(valeur) };
  if (typeof valeur === 'number') return { type: 'nombre', valeur };
  if (typeof valeur === 'string') return { type: 'chaine', valeur };
  if (typeof valeur === 'boolean') return { type: 'booleen', valeur };
  return { type: 'erreur', message: `Valeur non prise en charge : ${Object.prototype.toString.call(valeur)}` };
}

/**
 * Évalue un Sélecteur. Pour le langage `dom`, le Sélecteur est une expression JavaScript
 * où `document` désigne le Document cible (ex : `document.querySelector('#email').closest('form')`).
 */
export function evaluer(doc: Document, langage: Langage, selecteur: string): ResultatType {
  try {
    switch (langage) {
      case 'css':
        return { type: 'noeuds', noeuds: Array.from(doc.querySelectorAll(selecteur)) };
      case 'xpath':
        return evaluerXPath(doc, selecteur);
      case 'dom': {
        const fn = new Function('document', `"use strict"; return (${selecteur});`);
        return normaliserValeurDom(fn(doc));
      }
    }
  } catch (e) {
    // Les erreurs levées dans une iframe ne sont pas des instances du `Error` de la page.
    const message = typeof e === 'object' && e !== null && 'message' in e ? String(e.message) : String(e);
    return { type: 'erreur', message };
  }
}

export function serialiser(resultat: ResultatType): Attendu {
  switch (resultat.type) {
    case 'noeuds':
      return { noeuds: resultat.noeuds.map(etiquette) };
    case 'nombre':
      return { nombre: resultat.valeur };
    case 'chaine':
      return { chaine: resultat.valeur };
    case 'booleen':
      return { booleen: resultat.valeur };
    case 'erreur':
      return { erreur: true };
  }
}

/**
 * Réussite d'un Niveau : même type de résultat et, pour un ensemble de nœuds, exactement les mêmes nœuds
 * (identité, pas seulement étiquette), dans le même ordre.
 */
export function memeResultat(a: ResultatType, b: ResultatType): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'noeuds': {
      const autres = (b as typeof a).noeuds;
      return a.noeuds.length === autres.length && a.noeuds.every((n, i) => n === autres[i]);
    }
    case 'nombre': {
      const autre = (b as typeof a).valeur;
      return a.valeur === autre || (Number.isNaN(a.valeur) && Number.isNaN(autre));
    }
    case 'chaine':
    case 'booleen':
      return a.valeur === (b as typeof a).valeur;
    case 'erreur':
      return false;
  }
}
