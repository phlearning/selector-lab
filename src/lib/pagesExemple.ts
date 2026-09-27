/** Les Pages d'exemple : ressource unique partagée par la Référence, le Testeur et les Scénarios e2e. */

const sources = import.meta.glob<string>('../pages-exemple/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export interface PageExemple {
  id: string;
  titre: string;
  description: string;
  html: string;
}

const meta: Record<string, Omit<PageExemple, 'id' | 'html'>> = {
  formulaire: {
    titre: "Formulaire d'inscription",
    description: 'Champs texte, e-mail, mot de passe, liste déroulante, boutons radio et cases à cocher.',
  },
  tableau: {
    titre: 'Tableau des utilisateurs',
    description: 'Tableau de données avec des actions par ligne, des badges de statut et une pagination.',
  },
  panier: {
    titre: 'Panier',
    description: "Articles avec prix, quantités, promotion, article indisponible et récapitulatif.",
  },
  article: {
    titre: 'Article de blog',
    description: 'Titres, paragraphes, texte mixte, commentaire HTML, contenu en anglais et sommaire.',
  },
};

export const pagesExemple: PageExemple[] = Object.entries(meta).map(([id, m]) => {
  const html = sources[`../pages-exemple/${id}.html`];
  if (html === undefined) throw new Error(`Page d'exemple introuvable : ${id}`);
  return { id, ...m, html };
});

export function pageExemple(id: string): PageExemple {
  const page = pagesExemple.find((p) => p.id === id);
  if (!page) throw new Error(`Page d'exemple inconnue : ${id}`);
  return page;
}

/** Document HTML complet construit à partir d'une Page d'exemple, sans exécuter de script. */
export function documentHtml(page: PageExemple): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${page.titre}</title></head><body>\n${page.html}</body></html>`;
}
