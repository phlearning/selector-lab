/**
 * État partagé de l'Assistant dans une page : inactif, en chargement, prêt ou en erreur.
 * Le choix du moteur est mémorisé dans le navigateur (commodité), jamais le modèle lui-même.
 */
import { useEffect, useState } from 'preact/hooks';
import { creerMoteurChrome, creerMoteurWebLLM, type ChoixModele, type Moteur } from './moteurs';

export type EtatAssistant =
  | { statut: 'inactif' }
  | { statut: 'chargement'; fraction: number; texte: string }
  | { statut: 'pret'; moteur: Moteur }
  | { statut: 'erreur'; message: string };

export type Choix = 'chrome' | ChoixModele;

const CLE_CHOIX = 'selector-lab:assistant:choix';

let etat: EtatAssistant = { statut: 'inactif' };
const abonnes = new Set<(e: EtatAssistant) => void>();

function changer(nouveau: EtatAssistant) {
  etat = nouveau;
  abonnes.forEach((f) => f(etat));
}

export function useAssistant(): EtatAssistant {
  const [courant, setCourant] = useState(etat);
  useEffect(() => {
    abonnes.add(setCourant);
    setCourant(etat);
    return () => void abonnes.delete(setCourant);
  }, []);
  return courant;
}

export function dernierChoix(): Choix | null {
  try {
    const choix = localStorage.getItem(CLE_CHOIX);
    return choix === 'chrome' || choix === 'leger' || choix === 'standard' ? choix : null;
  } catch {
    return null;
  }
}

export async function activer(choix: Choix): Promise<void> {
  if (etat.statut === 'chargement' || etat.statut === 'pret') return;
  changer({ statut: 'chargement', fraction: 0, texte: 'Préparation...' });
  try {
    const moteur =
      choix === 'chrome'
        ? await creerMoteurChrome((fraction) => changer({ statut: 'chargement', fraction, texte: 'Téléchargement du modèle par Chrome...' }))
        : await creerMoteurWebLLM(choix, (fraction, texte) => changer({ statut: 'chargement', fraction, texte }));
    try {
      localStorage.setItem(CLE_CHOIX, choix);
    } catch {
      // Préférence non mémorisée : sans conséquence.
    }
    changer({ statut: 'pret', moteur });
  } catch (e) {
    changer({ statut: 'erreur', message: e instanceof Error ? e.message : String(e) });
  }
}

export function reinitialiser(): void {
  changer({ statut: 'inactif' });
}
