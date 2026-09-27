/**
 * Enveloppe un fragment HTML dans un document complet. La même enveloppe sert à vérifier les Exemples
 * et à afficher le Testeur : un Sélecteur donne donc le même résultat aux deux endroits.
 */
export function envelopper(html: string, titre: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${titre}</title></head><body>\n${html}</body></html>`;
}
