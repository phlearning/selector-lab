import bcd from '@mdn/browser-compat-data' with { type: 'json' };
import { support } from '../lib/support';

/** Support navigateur de tous les sélecteurs CSS, chargé à la demande par l'Analyse du Testeur. */
export function GET() {
  const donnees: Record<string, ReturnType<typeof support>> = {};
  const parcourir = (noeud: Record<string, unknown>, cle: string) => {
    for (const [nom, enfant] of Object.entries(noeud)) {
      if (nom === '__compat' || typeof enfant !== 'object' || enfant === null) continue;
      const cleEnfant = `${cle}.${nom}`;
      if ('__compat' in enfant) donnees[cleEnfant] = support(cleEnfant);
      parcourir(enfant as Record<string, unknown>, cleEnfant);
    }
  };
  parcourir(bcd.css.selectors as unknown as Record<string, unknown>, 'css.selectors');
  return new Response(JSON.stringify(donnees), { headers: { 'Content-Type': 'application/json' } });
}
