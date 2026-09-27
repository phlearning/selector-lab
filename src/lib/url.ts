/** Préfixe un chemin interne avec la base du site (GitHub Pages sert le site sous /selector-lab/). */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const clean = path.replace(/^\//, '');
  return `${base}/${clean}`;
}
