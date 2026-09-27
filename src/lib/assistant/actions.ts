/**
 * Actions de l'Assistant : des tâches cadrées (prompt précis, contexte limité, sortie structurée quand un
 * Sélecteur est attendu), parce qu'un petit modèle est fiable sur une consigne étroite, pas sur un chat ouvert.
 */
import { etiquette, memeResultat, type Langage, type ResultatType } from '../resultat';
import type { Message } from './moteurs';

const NOMS: Record<Langage, string> = {
  css: 'CSS',
  xpath: 'XPath 1.0',
  aria: 'Requête ARIA (syntaxe Testing Library, ex : getByRole(\'button\', { name: \'Envoyer\' }))',
  dom: 'expression JavaScript de l\'API DOM',
};

const SYSTEME = `Tu es l'Assistant de Selector Lab, un site qui enseigne les sélecteurs pour les tests end-to-end : CSS, XPath 1.0, API DOM et requêtes ARIA (Testing Library).
Règles :
- Réponds toujours en français, en 5 phrases maximum, sans introduction ni formule de politesse.
- Ne parle que des éléments présents dans le HTML fourni ; n'invente jamais d'attribut ni de texte.
- Les navigateurs n'implémentent que XPath 1.0 : n'utilise jamais lower-case(), upper-case(), matches(), ends-with(), replace() ni aucune autre fonction XPath 2.0.
- Un bon sélecteur de test s'appuie sur ce que voit l'utilisateur (rôle, nom accessible, texte, libellé) ou sur un attribut stable (data-testid, name, id métier), jamais sur des positions ou des classes générées.`;

const LONGUEUR_HTML = 3000;

/** Extrait du Document cible fourni au modèle : sans les marques du site, espaces réduits, tronqué. */
export function extraitHtml(doc: Document): string {
  const copie = doc.body.cloneNode(true) as HTMLElement;
  copie.querySelectorAll('[data-selector-lab], [data-jeu-cible], [data-jeu-trouve], [data-jeu-survol], [data-jeu-reussi]').forEach((el) => {
    for (const attr of ['data-selector-lab', 'data-jeu-cible', 'data-jeu-trouve', 'data-jeu-survol', 'data-jeu-reussi']) el.removeAttribute(attr);
  });
  const html = copie.innerHTML.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
  return html.length > LONGUEUR_HTML ? `${html.slice(0, LONGUEUR_HTML)} [...]` : html;
}

function contexte(html: string): string {
  return `HTML de la page (extrait) :\n${html}`;
}

export function messagesExpliquer(langage: Langage, selecteur: string, html: string): Message[] {
  return [
    { role: 'system', content: SYSTEME },
    {
      role: 'user',
      content: `${contexte(html)}\n\nExplique simplement ce que désigne ce sélecteur (${NOMS[langage]}), partie par partie, puis dis quels éléments de la page il trouve :\n${selecteur}`,
    },
  ];
}

export function messagesRobustesse(langage: Langage, selecteur: string, html: string): Message[] {
  return [
    { role: 'system', content: SYSTEME },
    {
      role: 'user',
      content: `${contexte(html)}\n\nCe sélecteur (${NOMS[langage]}) est utilisé dans un test end-to-end :\n${selecteur}\n\nÉvalue sa robustesse : cite au plus trois risques concrets de casse (position, classe générée, texte susceptible de changer, structure), puis propose une alternative plus robuste.`,
    },
  ];
}

export function messagesQuestion(question: string, langage: Langage, selecteur: string, html: string): Message[] {
  const sel = selecteur.trim() ? `\n\nSélecteur actuel (${NOMS[langage]}) :\n${selecteur}` : '';
  return [
    { role: 'system', content: SYSTEME },
    { role: 'user', content: `${contexte(html)}${sel}\n\nQuestion : ${question}` },
  ];
}

/** Réponse structurée des Actions qui produisent un Sélecteur. */
export const SCHEMA_SELECTEUR = {
  type: 'object',
  properties: {
    possible: { type: 'boolean' },
    selecteur: { type: 'string' },
    explication: { type: 'string' },
  },
  required: ['possible', 'selecteur', 'explication'],
  additionalProperties: false,
};

export function messagesConvertir(de: Langage, vers: Langage, selecteur: string, html: string): Message[] {
  return [
    { role: 'system', content: SYSTEME },
    {
      role: 'user',
      content: `${contexte(html)}\n\nConvertis ce sélecteur ${NOMS[de]} en ${NOMS[vers]}, en gardant exactement les mêmes éléments :\n${selecteur}\n\nSi c'est impossible (par exemple, CSS ne sait pas lire le texte), mets "possible" à false et explique pourquoi. Réponds en JSON : {"possible": true, "selecteur": "...", "explication": "..."}.`,
    },
  ];
}

export function messagesGenerer(vers: Langage, description: string, html: string): Message[] {
  return [
    { role: 'system', content: SYSTEME },
    {
      role: 'user',
      content: `${contexte(html)}\n\nÉcris un sélecteur ${NOMS[vers]} robuste qui désigne : ${description}\n\nSi aucun élément ne correspond, mets "possible" à false. Réponds en JSON : {"possible": true, "selecteur": "...", "explication": "..."}.`,
    },
  ];
}

export interface ReponseSelecteur {
  possible: boolean;
  selecteur: string;
  explication: string;
}

/** Lit la réponse structurée, avec un repli pour les modèles qui entourent le JSON de texte. */
export function lireReponseSelecteur(brut: string): ReponseSelecteur | null {
  const debut = brut.indexOf('{');
  const fin = brut.lastIndexOf('}');
  if (debut >= 0 && fin > debut) {
    try {
      const lu = JSON.parse(brut.slice(debut, fin + 1)) as Partial<ReponseSelecteur>;
      if (typeof lu.selecteur === 'string') {
        return { possible: lu.possible !== false, selecteur: lu.selecteur.trim(), explication: String(lu.explication ?? '') };
      }
    } catch {
      // Repli ci-dessous.
    }
  }
  const code = /`([^`\n]+)`/.exec(brut);
  return code ? { possible: true, selecteur: code[1].trim(), explication: '' } : null;
}

export type Validation =
  | { statut: 'valide'; nombre: number; etiquettes: string[] }
  | { statut: 'different'; attendu: number; obtenu: number }
  | { statut: 'vide' }
  | { statut: 'invalide'; message: string };

function decrire(r: ResultatType): { nombre: number; etiquettes: string[] } {
  if (r.type === 'noeuds') return { nombre: r.noeuds.length, etiquettes: r.noeuds.slice(0, 5).map(etiquette) };
  return { nombre: 1, etiquettes: [String(r.type === 'erreur' ? '' : r.valeur)] };
}

/**
 * Validation : le Sélecteur produit par l'Assistant est évalué par le vrai moteur du navigateur avant
 * d'être proposé. Pour une conversion, il doit trouver exactement les mêmes nœuds que l'original.
 */
export function valider(
  evaluerSurPage: (langage: Langage, selecteur: string) => ResultatType,
  langage: Langage,
  selecteur: string,
  original?: { langage: Langage; selecteur: string },
): Validation {
  const obtenu = evaluerSurPage(langage, selecteur);
  if (obtenu.type === 'erreur') return { statut: 'invalide', message: obtenu.message };
  if (obtenu.type === 'noeuds' && obtenu.noeuds.length === 0) return { statut: 'vide' };
  if (original) {
    const attendu = evaluerSurPage(original.langage, original.selecteur);
    if (!memeResultat(obtenu, attendu)) {
      return { statut: 'different', attendu: decrire(attendu).nombre, obtenu: decrire(obtenu).nombre };
    }
  }
  return { statut: 'valide', ...decrire(obtenu) };
}

/* ---------- Jeu : Indice personnalisé ---------- */

export interface ContexteIndice {
  consigne: string;
  langage: Langage;
  reponse: string;
  html: string;
  /** Étiquettes des nœuds attendus, trouvés en trop et manquants (jamais la Solution de référence). */
  attendus: string[];
  enTrop: string[];
  manquants: string[];
  typeAttendu: string;
  typeObtenu: string;
}

export function messagesIndice(c: ContexteIndice): Message[] {
  const liste = (titre: string, l: string[]) => (l.length ? `\n${titre} : ${l.slice(0, 6).join(' ; ')}` : '');
  return [
    {
      role: 'system',
      content: `${SYSTEME}\n- Tu donnes un indice à un joueur qui apprend. Ne donne JAMAIS la réponse complète : oriente-le en 2 phrases maximum, en expliquant ce qui ne va pas dans sa tentative.`,
    },
    {
      role: 'user',
      content: `${contexte(c.html)}\n\nConsigne du niveau : ${c.consigne}\nLangage : ${NOMS[c.langage]}\nTentative du joueur : ${c.reponse || '(vide)'}\nRésultat attendu : ${c.typeAttendu} ; résultat obtenu : ${c.typeObtenu}${liste('Éléments attendus', c.attendus)}${liste('Trouvés en trop', c.enTrop)}${liste('Manquants', c.manquants)}\n\nDonne un indice qui aide le joueur à corriger sa tentative, sans écrire la solution.`,
    },
  ];
}

function normaliser(texte: string): string {
  return texte.replace(/\s+/g, '').replace(/"/g, "'").toLowerCase();
}

/** Vrai si l'indice contient l'une des solutions : il ne doit alors pas être affiché. */
export function devoileLaSolution(indice: string, solutions: (string | null)[]): boolean {
  const texte = normaliser(indice);
  return solutions.some((s) => s && normaliser(s).length > 3 && texte.includes(normaliser(s)));
}

/* ---------- Affichage ---------- */

/** Texte du modèle rendu sans risque : tout est échappé, seuls les `morceaux de code` deviennent <code>. */
export function formater(texte: string): string {
  const echappe = texte.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  return echappe
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>');
}
