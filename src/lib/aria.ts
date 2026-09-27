/**
 * Requêtes ARIA : `getByRole('button', { name: 'Supprimer' })` et les autres requêtes de Testing Library,
 * évaluées par @testing-library/dom sur le Document cible.
 *
 * La requête est **analysée**, jamais exécutée comme du JavaScript : un lien partagé vers le Testeur ne peut
 * donc pas faire exécuter de code. Les appels peuvent s'enchaîner comme dans Playwright :
 * `getByRole('row', { name: /Chloé/ }).getByRole('button', { name: 'Supprimer' })` cherche le bouton
 * à l'intérieur de chaque ligne trouvée.
 */
import {
  queryAllByAltText,
  queryAllByDisplayValue,
  queryAllByLabelText,
  queryAllByPlaceholderText,
  queryAllByRole,
  queryAllByTestId,
  queryAllByText,
  queryAllByTitle,
} from '@testing-library/dom';
import { computeAccessibleName } from 'dom-accessibility-api';

type Valeur = string | number | boolean | RegExp | { [cle: string]: Valeur };

export interface Appel {
  /** Nom tel qu'écrit (`getAllByRole`). */
  methode: string;
  /** Type de requête (`Role`, `LabelText`...). */
  requete: string;
  /** `getBy` / `queryBy` / `findBy` : un seul élément attendu (les frameworks échouent sinon). */
  unique: boolean;
  args: Valeur[];
}

type Requete = (conteneur: HTMLElement, ...args: never[]) => HTMLElement[];

const REQUETES: Record<string, Requete> = {
  Role: queryAllByRole as Requete,
  LabelText: queryAllByLabelText as Requete,
  PlaceholderText: queryAllByPlaceholderText as Requete,
  Text: queryAllByText as Requete,
  DisplayValue: queryAllByDisplayValue as Requete,
  AltText: queryAllByAltText as Requete,
  Title: queryAllByTitle as Requete,
  TestId: queryAllByTestId as Requete,
};

export class ErreurAria extends Error {}

/* ---------- Analyse ---------- */

class Lecteur {
  private i = 0;
  constructor(private readonly source: string) {}

  private espaces() {
    while (this.i < this.source.length && /\s/.test(this.source[this.i])) this.i++;
  }

  voir(): string {
    this.espaces();
    return this.source[this.i] ?? '';
  }

  fini(): boolean {
    return this.voir() === '';
  }

  attendre(caractere: string) {
    if (this.voir() !== caractere) {
      throw new ErreurAria(`« ${caractere} » attendu à la position ${this.i + 1}${this.fini() ? ' (fin de la requête)' : `, « ${this.source[this.i]} » trouvé`}.`);
    }
    this.i++;
  }

  identifiant(): string {
    this.espaces();
    const m = /^[A-Za-z_$][\w$]*/.exec(this.source.slice(this.i));
    if (!m) throw new ErreurAria(`Nom attendu à la position ${this.i + 1}.`);
    this.i += m[0].length;
    return m[0];
  }

  valeur(): Valeur {
    const c = this.voir();
    if (c === "'" || c === '"' || c === '`') return this.chaine(c);
    if (c === '/') return this.regex();
    if (c === '{') return this.objet();
    if (c === '-' || /\d/.test(c)) {
      const m = /^-?\d+(\.\d+)?/.exec(this.source.slice(this.i));
      if (!m) throw new ErreurAria(`Nombre invalide à la position ${this.i + 1}.`);
      this.i += m[0].length;
      return Number(m[0]);
    }
    const mot = this.identifiant();
    if (mot === 'true') return true;
    if (mot === 'false') return false;
    throw new ErreurAria(`Valeur inattendue « ${mot} » : utilisez une chaîne, une expression régulière, un nombre, true, false ou un objet { ... }.`);
  }

  private chaine(delimiteur: string): string {
    this.i++;
    let resultat = '';
    while (this.i < this.source.length && this.source[this.i] !== delimiteur) {
      if (this.source[this.i] === '\\' && this.i + 1 < this.source.length) this.i++;
      if (delimiteur === '`' && this.source[this.i] === '$' && this.source[this.i + 1] === '{') {
        throw new ErreurAria('Les gabarits `${...}` ne sont pas pris en charge : écrivez la valeur directement.');
      }
      resultat += this.source[this.i++];
    }
    if (this.source[this.i] !== delimiteur) throw new ErreurAria('Chaîne non terminée.');
    this.i++;
    return resultat;
  }

  private regex(): RegExp {
    const debut = this.i++;
    let dansClasse = false;
    while (this.i < this.source.length) {
      const c = this.source[this.i];
      if (c === '\\') this.i += 2;
      else {
        if (c === '[') dansClasse = true;
        else if (c === ']') dansClasse = false;
        else if (c === '/' && !dansClasse) break;
        this.i++;
      }
    }
    if (this.source[this.i] !== '/') throw new ErreurAria('Expression régulière non terminée.');
    const corps = this.source.slice(debut + 1, this.i++);
    const drapeaux = /^[dgimsuvy]*/.exec(this.source.slice(this.i))![0];
    this.i += drapeaux.length;
    try {
      return new RegExp(corps, drapeaux);
    } catch (e) {
      throw new ErreurAria(`Expression régulière invalide : ${(e as Error).message}`);
    }
  }

  private objet(): { [cle: string]: Valeur } {
    this.attendre('{');
    const objet: { [cle: string]: Valeur } = {};
    while (this.voir() !== '}') {
      const c = this.voir();
      const cle = c === "'" || c === '"' ? (this.valeur() as string) : this.identifiant();
      this.attendre(':');
      objet[cle] = this.valeur();
      if (this.voir() === ',') this.attendre(',');
      else break;
    }
    this.attendre('}');
    return objet;
  }
}

export function analyser(source: string): Appel[] {
  const lecteur = new Lecteur(source.trim().replace(/^(screen|page|cy)\s*\./, ''));
  const appels: Appel[] = [];
  do {
    const methode = lecteur.identifiant();
    const m = /^(get|getAll|query|queryAll|find|findAll)By([A-Za-z]+)$/.exec(methode);
    if (!m || !REQUETES[m[2]]) {
      throw new ErreurAria(
        `« ${methode} » n'est pas une requête connue. Requêtes disponibles : getByRole, getByLabelText, getByPlaceholderText, getByText, getByDisplayValue, getByAltText, getByTitle, getByTestId (et leurs variantes getAllBy, queryBy...).`,
      );
    }
    lecteur.attendre('(');
    const args: Valeur[] = [];
    while (lecteur.voir() !== ')') {
      args.push(lecteur.valeur());
      if (lecteur.voir() === ',') lecteur.attendre(',');
      else break;
    }
    lecteur.attendre(')');
    appels.push({ methode, requete: m[2], unique: !m[1].endsWith('All'), args });
    if (lecteur.fini()) break;
    lecteur.attendre('.');
  } while (true);
  return appels;
}

/* ---------- Évaluation ---------- */

function enDocumentOrdre(elements: HTMLElement[]): HTMLElement[] {
  const uniques = [...new Set(elements)];
  return uniques.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}

/** Évalue une requête ARIA (éventuellement chaînée) et renvoie les éléments trouvés, dans l'ordre du document. */
export function evaluerAria(doc: Document, source: string): HTMLElement[] {
  if (!doc.defaultView) throw new ErreurAria("Les requêtes ARIA ont besoin d'un document affiché (avec sa fenêtre).");
  const appels = analyser(source);
  let conteneurs: HTMLElement[] = [doc.body];
  for (const appel of appels) {
    const requete = REQUETES[appel.requete];
    const trouves = conteneurs.flatMap((c) => requete(c, ...(appel.args as never[])));
    conteneurs = enDocumentOrdre(trouves);
  }
  return conteneurs;
}

/** Dernier appel d'une requête, pour les diagnostics (unicité, noms disponibles). */
export function dernierAppel(source: string): Appel | null {
  try {
    const appels = analyser(source);
    return appels[appels.length - 1] ?? null;
  } catch {
    return null;
  }
}

/** Noms accessibles des éléments d'un rôle, pour aider quand `name` ne correspond à rien. */
export function nomsDisponibles(doc: Document, role: string, limite = 8): string[] {
  if (!doc.defaultView) return [];
  const noms = queryAllByRole(doc.body, role).map((el) => computeAccessibleName(el));
  return [...new Set(noms)].filter(Boolean).slice(0, limite);
}
