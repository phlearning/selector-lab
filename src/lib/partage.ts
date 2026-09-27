/** État du Testeur encodé dans le fragment de l'URL, pour le partage et les boutons « Essayer ». */
import LZString from 'lz-string';
import type { Langage } from './resultat';

export interface EtatTesteur {
  langage: Langage;
  selecteur: string;
  /** Identifiant d'une Page d'exemple, ou `null` pour un HTML collé. */
  page: string | null;
  html?: string;
}

/** Au-delà, le HTML collé n'est plus mis dans le lien (limite pratique des URL partagées). */
export const TAILLE_MAX_HTML_LIEN = 8000;

const langages: Langage[] = ['css', 'xpath', 'dom', 'aria'];

export function encoder(etat: EtatTesteur): { fragment: string; htmlOmis: boolean } {
  const params = new URLSearchParams({ l: etat.langage, s: etat.selecteur });
  let htmlOmis = false;
  if (etat.page) {
    params.set('p', etat.page);
  } else if (etat.html) {
    const compresse = LZString.compressToEncodedURIComponent(etat.html);
    if (compresse.length <= TAILLE_MAX_HTML_LIEN) params.set('h', compresse);
    else htmlOmis = true;
  }
  return { fragment: params.toString(), htmlOmis };
}

export function decoder(fragment: string): Partial<EtatTesteur> {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const etat: Partial<EtatTesteur> = {};
  const l = params.get('l');
  if (l && (langages as string[]).includes(l)) etat.langage = l as Langage;
  const s = params.get('s');
  if (s !== null) etat.selecteur = s;
  const p = params.get('p');
  const h = params.get('h');
  if (p) etat.page = p;
  else if (h) {
    const html = LZString.decompressFromEncodedURIComponent(h);
    if (html) {
      etat.page = null;
      etat.html = html;
    }
  }
  return etat;
}

/** Lien vers le Testeur pré-rempli, pour les boutons « Essayer » (`base` : URL de la page du Testeur). */
export function lienTesteur(base: string, etat: EtatTesteur): string {
  return `${base}#${encoder(etat).fragment}`;
}
