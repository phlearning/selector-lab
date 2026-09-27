import { getCollection, type CollectionEntry } from 'astro:content';

export type Theme = CollectionEntry<'reference'>;
export type Entree = Theme['data']['entrees'][number];
export type Exemple = Entree['exemples'][number];

export const langages = [
  { id: 'css', nom: 'CSS' },
  { id: 'xpath', nom: 'XPath 1.0' },
  { id: 'dom', nom: 'API DOM' },
  { id: 'aria', nom: 'ARIA (Testing Library)' },
] as const;

export function nomLangage(id: string): string {
  return langages.find((l) => l.id === id)?.nom ?? id;
}

/** Identifiant du thème dans l'URL : `css/attributs` donne `attributs`. */
export function slugTheme(theme: Theme): string {
  return theme.id.split('/').pop()!;
}

export async function themesTries(): Promise<Theme[]> {
  const themes = await getCollection('reference');
  const rang = (l: string) => langages.findIndex((x) => x.id === l);
  return themes.sort((a, b) => rang(a.data.langage) - rang(b.data.langage) || a.data.ordre - b.data.ordre);
}

export function cleExemple(theme: Theme, entree: Entree, index: number): string {
  return `${theme.id}#${entree.id}/${index + 1}`;
}

/** Pour chaque clé de compatibilité MDN, le lien vers la première Entrée de référence qui la documente. */
export async function liensReferenceParCle(): Promise<Record<string, string>> {
  const liens: Record<string, string> = {};
  for (const theme of await themesTries()) {
    for (const entree of theme.data.entrees) {
      const cles = entree.bcd ? (Array.isArray(entree.bcd) ? entree.bcd : [entree.bcd]) : [];
      for (const cle of cles) liens[cle] ??= `reference/${theme.data.langage}/${slugTheme(theme)}/#${entree.id}`;
    }
  }
  return liens;
}
