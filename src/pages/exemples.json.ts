import { getCollection } from 'astro:content';
import { cleExemple, themesTries } from '../lib/reference';

/** Liste de tous les Exemples, lignes de comparaison et Solutions de référence du Jeu, consommée par les tests multi-navigateurs. */
export async function GET() {
  const exemples: Array<Record<string, unknown>> = [];
  for (const theme of await themesTries()) {
    for (const entree of theme.data.entrees) {
      entree.exemples.forEach((ex, i) => {
        exemples.push({
          cle: cleExemple(theme, entree, i),
          page: ex.page,
          langage: ex.langage ?? theme.data.langage,
          selecteur: ex.selecteur,
          attendu: ex.attendu ?? null,
        });
      });
    }
  }
  for (const { id, data } of await getCollection('comparaison')) {
    for (const langage of ['css', 'xpath'] as const) {
      const selecteur = data[langage];
      if (selecteur) {
        exemples.push({ cle: `comparaison#${id}/${langage}`, page: data.page, langage, selecteur, attendu: data.attendu ?? null });
      }
    }
  }
  for (const { id, data } of await getCollection('niveaux')) {
    for (const langage of ['css', 'xpath'] as const) {
      const selecteur = data.solutions[langage];
      if (selecteur) {
        exemples.push({ cle: `jeu#${id}/${langage}`, page: null, html: data.scene, langage, selecteur, attendu: data.attendu ?? null });
      }
    }
  }
  return new Response(JSON.stringify(exemples, null, 2), { headers: { 'Content-Type': 'application/json' } });
}
