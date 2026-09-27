import { marked } from 'marked';

/** Markdown du contenu de la Référence (rédigé par nous, donc de confiance). */
export function md(source: string): string {
  return marked.parse(source, { async: false });
}

export function mdInline(source: string): string {
  return marked.parseInline(source, { async: false });
}
