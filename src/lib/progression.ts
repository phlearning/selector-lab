/**
 * Progression du joueur : Niveaux réussis dans chaque Mode et dernières réponses.
 * Conservée dans le navigateur uniquement ; toute lecture ou écriture peut échouer (navigation privée).
 */
import type { Langage } from './resultat';

export type Mode = Extract<Langage, 'css' | 'xpath'>;

export interface Progression {
  mode: Mode;
  courant: string | null;
  reussis: Record<string, Mode[]>;
  reponses: Record<string, string>;
}

const CLE = 'selector-lab:jeu:v1';

export function progressionVide(): Progression {
  return { mode: 'css', courant: null, reussis: {}, reponses: {} };
}

export function charger(): Progression {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return progressionVide();
    const lu = JSON.parse(brut) as Partial<Progression>;
    return {
      mode: lu.mode === 'xpath' ? 'xpath' : 'css',
      courant: typeof lu.courant === 'string' ? lu.courant : null,
      reussis: lu.reussis && typeof lu.reussis === 'object' ? lu.reussis : {},
      reponses: lu.reponses && typeof lu.reponses === 'object' ? lu.reponses : {},
    };
  } catch {
    return progressionVide();
  }
}

export function enregistrer(progression: Progression): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(progression));
  } catch {
    // Stockage indisponible : la Progression reste valable pour la session en cours.
  }
}

export function estReussi(progression: Progression, niveau: string, mode: Mode): boolean {
  return progression.reussis[niveau]?.includes(mode) ?? false;
}

export function avecReussite(progression: Progression, niveau: string, mode: Mode, reponse: string): Progression {
  const modes = progression.reussis[niveau] ?? [];
  return {
    ...progression,
    reussis: { ...progression.reussis, [niveau]: modes.includes(mode) ? modes : [...modes, mode] },
    reponses: { ...progression.reponses, [`${niveau}:${mode}`]: reponse },
  };
}
