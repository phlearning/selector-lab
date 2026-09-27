import { useEffect, useState } from 'preact/hooks';
import type { Fonctionnalite } from '../../lib/analyse';
import type { SupportNavigateur } from '../../lib/support';

type Donnees = Record<string, SupportNavigateur>;

let chargement: Promise<Donnees> | null = null;

/** Les données de support ne sont chargées qu'à la première Analyse. */
function chargerSupport(base: string): Promise<Donnees> {
  chargement ??= fetch(`${base}support-css.json`).then((r) => r.json() as Promise<Donnees>);
  return chargement;
}

const NAVIGATEURS_AFFICHES = ['chrome', 'firefox', 'safari'];

function baseline(s: SupportNavigateur): { texte: string; classe: string } {
  if (s.baseline?.statut === 'high') return { texte: 'Baseline : largement disponible', classe: 'baseline--high' };
  if (s.baseline?.statut === 'low') return { texte: 'Baseline : récemment disponible', classe: 'baseline--low' };
  if (s.baseline) return { texte: 'Pas encore disponible partout', classe: 'baseline--non' };
  return { texte: '', classe: '' };
}

export function Analyse(props: { fonctionnalites: Fonctionnalite[]; base: string; liensReference: Record<string, string> }) {
  const { fonctionnalites, base, liensReference } = props;
  const [donnees, setDonnees] = useState<Donnees | null>(null);

  useEffect(() => {
    chargerSupport(base).then(setDonnees, () => setDonnees({}));
  }, [base]);

  return (
    <section class="analyse" aria-label="Analyse du sélecteur">
      <h2>Analyse</h2>
      <p class="analyse__intro">Les fonctionnalités CSS utilisées par ce sélecteur, et leur Support navigateur.</p>
      <ul class="analyse__liste">
        {fonctionnalites.map((f) => {
          const s = donnees?.[f.cle];
          const lien = liensReference[f.cle];
          const b = s ? baseline(s) : null;
          return (
            <li key={f.cle} class="analyse__item">
              <div class="analyse__nom">
                {lien ? <a href={`${base}${lien}`}>{f.libelle}</a> : <span>{f.libelle}</span>}
                {b?.texte && <span class={`analyse__baseline ${b.classe}`}>{b.texte}</span>}
              </div>
              {donnees && !s && <span class="analyse__inconnu">Inconnue des données MDN : vérifiez l'orthographe.</span>}
              {s && (
                <ul class="analyse__navigateurs">
                  {s.navigateurs
                    .filter((n) => NAVIGATEURS_AFFICHES.includes(n.id))
                    .map((n) => (
                      <li key={n.id} class={n.version ? (n.partiel ? 'nav nav--partiel' : 'nav nav--oui') : 'nav nav--non'}>
                        <span class="nav__nom">{n.nom}</span>
                        <span class="nav__version">{n.version ?? 'Non'}</span>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
