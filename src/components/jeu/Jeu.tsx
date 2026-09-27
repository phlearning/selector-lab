import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { envelopper } from '../../lib/document';
import { diagnostiquer } from '../../lib/diagnostic';
import { avecReussite, charger, enregistrer, estReussi, progressionVide, type Mode, type Progression } from '../../lib/progression';
import { evaluer, memeResultat, type ResultatType } from '../../lib/resultat';
import { arbre, Balisage, type NoeudBalisage } from './Balisage';
import { elementsDeScene, figer, marquer, retirerMarques, styler } from './scene';

export interface NiveauProp {
  id: string;
  chapitre: string;
  titre: string;
  notion: string;
  consigne: string;
  /** Document complet de la Scène : bibliothèque dessinée ou Page d'exemple. */
  html: string;
  solutions: Record<Mode, string | null>;
  recommande?: Mode;
  /** Indices et Leçon déjà convertis en HTML au build. */
  indices: string[];
  lecon: string;
  reference: string;
}

export interface ChapitreProp {
  id: string;
  titre: string;
}

interface Props {
  niveaux: NiveauProp[];
  chapitres: ChapitreProp[];
  base: string;
}

type Retour =
  | { type: 'aucun' }
  | { type: 'echec'; messages: string[] }
  | { type: 'reussite' };

const NOMS_MODE: Record<Mode, string> = { css: 'CSS', xpath: 'XPath 1.0', aria: 'ARIA' };
const MODES: Mode[] = ['css', 'xpath', 'aria'];

/** Le Mode dans lequel se joue un Niveau : celui choisi s'il a une solution, sinon le premier disponible. */
function modeEffectif(niveau: NiveauProp, choisi: Mode): Mode {
  return niveau.solutions[choisi] ? choisi : MODES.find((m) => niveau.solutions[m])!;
}

function raisonDuRepli(niveau: NiveauProp, choisi: Mode, mode: Mode): string {
  if (choisi === 'aria' && niveau.chapitre === 'bibliotheque') {
    return `Les Requêtes ARIA visent de vraies interfaces : la bibliothèque n'a ni rôles ni noms accessibles. Ce Niveau se joue en ${NOMS_MODE[mode]}.`;
  }
  if (choisi === 'css' && mode === 'xpath') {
    return 'CSS ne sait pas lire le texte ni renvoyer une valeur : ce Niveau se joue en XPath.';
  }
  if (choisi === 'aria') {
    return `Aucune Requête ARIA ne désigne exactement ces éléments (la Leçon explique pourquoi) : ce Niveau se joue en ${NOMS_MODE[mode]}.`;
  }
  return `Ce Niveau n'a pas de solution en ${NOMS_MODE[choisi]} : il se joue en ${NOMS_MODE[mode]}.`;
}

/** Titre de la Scène vide utilisée pour détecter les réponses qui ne lisent pas la page. */
const TITRE_SCENE = 'Niveau';

function decrire(r: ResultatType): string {
  switch (r.type) {
    case 'noeuds':
      return r.noeuds.length === 0 ? 'aucun élément' : `${r.noeuds.length} élément${r.noeuds.length > 1 ? 's' : ''}`;
    case 'nombre':
      return `le nombre ${r.valeur}`;
    case 'chaine':
      return `la chaîne « ${r.valeur} »`;
    case 'booleen':
      return `le booléen ${r.valeur}`;
    case 'erreur':
      return 'une erreur';
  }
}

const TYPE_ATTENDU: Record<ResultatType['type'], string> = {
  noeuds: 'des éléments de la Scène',
  nombre: 'un nombre',
  chaine: 'une chaîne',
  booleen: 'un booléen',
  erreur: '',
};

/** Explique au joueur en quoi sa réponse diffère de la Solution de référence, sans la révéler. */
function expliquerEchec(joueur: ResultatType, solution: ResultatType): string[] {
  if (joueur.type === 'erreur') return [];
  if (joueur.type !== solution.type) {
    return [`Ta réponse renvoie ${decrire(joueur)}, mais le résultat attendu est ${TYPE_ATTENDU[solution.type]}.`];
  }
  if (joueur.type === 'noeuds' && solution.type === 'noeuds') {
    const enTrop = joueur.noeuds.filter((n) => !solution.noeuds.includes(n)).length;
    const manquants = solution.noeuds.filter((n) => !joueur.noeuds.includes(n)).length;
    const details = [enTrop > 0 && `${enTrop} en trop`, manquants > 0 && `${manquants} manquant${manquants > 1 ? 's' : ''}`]
      .filter(Boolean)
      .join(', ');
    if (joueur.noeuds.length === 0) return [`Ta réponse ne trouve aucun élément, il en faut ${solution.noeuds.length}.`];
    return [`Ta réponse trouve ${decrire(joueur)}, il en faut ${solution.noeuds.length}${details ? ` (${details})` : ''}.`];
  }
  return [`Ta réponse renvoie ${decrire(joueur)} : ce n'est pas le bon résultat.`];
}

/**
 * Une expression dont le résultat ne dépend pas de la Scène (`3`, `'Dune'`) ne compte pas : on la réévalue
 * sur une Scène vide, où la Solution de référence change de résultat mais pas elle.
 */
function ignoreLaScene(mode: Mode, reponse: string, solution: string, surScene: ResultatType, solutionSurScene: ResultatType): boolean {
  if (surScene.type === 'noeuds') return false;
  const vide = new DOMParser().parseFromString(envelopper('', TITRE_SCENE), 'text/html');
  return memeResultat(evaluer(vide, mode, reponse), surScene) && !memeResultat(evaluer(vide, mode, solution), solutionSurScene);
}

export default function Jeu({ niveaux, chapitres, base }: Props) {
  const [progression, setProgression] = useState<Progression>(progressionVide);
  const [index, setIndex] = useState(0);
  const [reponse, setReponse] = useState('');
  const [retour, setRetour] = useState<Retour>({ type: 'aucun' });
  const [indicesVus, setIndicesVus] = useState(0);
  const [docCharge, setDocCharge] = useState<string | null>(null);
  const [balisage, setBalisage] = useState<NoeudBalisage[]>([]);
  const [survol, setSurvol] = useState<number | null>(null);
  const [trouves, setTrouves] = useState<Set<number>>(new Set());
  const [pretProgression, setPretProgression] = useState(false);

  const iframe = useRef<HTMLIFrameElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const suivant = useRef<HTMLButtonElement>(null);
  // Le survol change souvent : une référence évite de réévaluer le Sélecteur à chaque mouvement de souris.
  const survolRef = useRef<number | null>(null);
  survolRef.current = survol;

  const niveau = niveaux[index];
  const modesDuNiveau = MODES.filter((m) => niveau.solutions[m]);
  const mode = modeEffectif(niveau, progression.mode);
  const solution = niveau.solutions[mode]!;
  const srcdoc = niveau.html;
  const pret = docCharge === srcdoc;

  // Chargement de la Progression et du Niveau demandé (lien `#n=...`, sinon le dernier joué).
  useEffect(() => {
    const p = charger();
    setProgression(p);
    const indexDemande = (id: string | null) => niveaux.findIndex((n) => n.id === id);
    const i = indexDemande(new URLSearchParams(location.hash.slice(1)).get('n') ?? p.courant);
    setIndex(i >= 0 ? i : 0);
    setPretProgression(true);
    const auChangementDeLien = () => {
      const demande = indexDemande(new URLSearchParams(location.hash.slice(1)).get('n'));
      if (demande >= 0) setIndex(demande);
    };
    addEventListener('hashchange', auChangementDeLien);
    return () => removeEventListener('hashchange', auChangementDeLien);
  }, []);

  useEffect(() => {
    if (pretProgression) enregistrer(progression);
  }, [progression, pretProgression]);

  // Changement de Niveau ou de Mode : on repart de la dernière réponse réussie, s'il y en a une.
  useEffect(() => {
    if (!pretProgression) return;
    setReponse(progression.reponses[`${niveau.id}:${mode}`] ?? '');
    setRetour({ type: 'aucun' });
    setIndicesVus(0);
    setProgression((p) => (p.courant === niveau.id ? p : { ...p, courant: niveau.id }));
    history.replaceState(null, '', `#n=${niveau.id}`);
  }, [niveau.id, mode, pretProgression]);

  /** Évalue sur la Scène propre (sans marques), puis replace les marques. */
  const actualiser = useCallback(
    (options: { reussi?: boolean } = {}) => {
      const doc = iframe.current?.contentDocument;
      if (!doc || !pret) return null;
      retirerMarques(doc);
      const cibles = evaluer(doc, mode, solution);
      const joueur = reponse.trim() ? evaluer(doc, mode, reponse) : null;
      const elements = elementsDeScene(doc);
      const noeudsJoueur = joueur?.type === 'noeuds' ? joueur.noeuds : [];
      if (cibles.type === 'noeuds') marquer(cibles.noeuds, options.reussi ? 'data-jeu-reussi' : 'data-jeu-cible');
      if (!options.reussi) marquer(noeudsJoueur, 'data-jeu-trouve');
      if (survolRef.current !== null) elements[survolRef.current]?.setAttribute('data-jeu-survol', '');
      setTrouves(new Set(noeudsJoueur.map((n) => elements.indexOf(n as Element)).filter((i) => i >= 0)));
      return { cibles, joueur };
    },
    [pret, mode, solution, reponse],
  );

  // Aperçu en direct pendant la frappe.
  useEffect(() => {
    if (retour.type === 'reussite') return;
    const minuteur = setTimeout(() => actualiser(), 120);
    return () => clearTimeout(minuteur);
  }, [actualiser, retour.type]);

  const valider = (e: Event) => {
    e.preventDefault();
    if (retour.type === 'reussite') return allerA(index + 1);
    const r = actualiser();
    if (!r || !r.joueur) return;
    const { cibles, joueur } = r;
    if (memeResultat(joueur, cibles) && !ignoreLaScene(mode, reponse, solution, joueur, cibles)) {
      actualiser({ reussi: true });
      setProgression((p) => avecReussite(p, niveau.id, mode, reponse.trim()));
      setRetour({ type: 'reussite' });
      requestAnimationFrame(() => suivant.current?.focus());
      return;
    }
    const messages = memeResultat(joueur, cibles)
      ? ["Ta réponse ne lit pas la Scène : elle donnerait le même résultat sur une étagère vide. Écris une expression qui cherche le résultat dans la page."]
      : [...expliquerEchec(joueur, cibles), ...diagnostiquer(mode, reponse, joueur, iframe.current?.contentDocument ?? undefined).map((d) => d.message)];
    if (joueur.type === 'erreur') messages.unshift(`Erreur : ${joueur.message}`);
    setRetour({ type: 'echec', messages });
    champ.current?.classList.remove('secoue');
    void champ.current?.offsetWidth;
    champ.current?.classList.add('secoue');
  };

  const allerA = (i: number) => {
    if (i < 0 || i >= niveaux.length) return;
    setIndex(i);
    setSurvol(null);
    requestAnimationFrame(() => champ.current?.focus());
  };

  const changerMode = (m: Mode) => setProgression((p) => ({ ...p, mode: m }));

  const reinitialiser = () => {
    if (!confirm('Effacer toute ta Progression ?')) return;
    setProgression({ ...progressionVide(), mode: progression.mode });
    allerA(0);
  };

  // Survol depuis la Scène (écouteurs posés par la page sur le document de l'iframe).
  const auChargement = (e: Event) => {
    const frame = e.currentTarget as HTMLIFrameElement;
    const doc = frame.contentDocument;
    if (!doc) return;
    styler(doc, niveau.chapitre !== 'bibliotheque');
    figer(doc);
    setBalisage(arbre(doc));
    doc.addEventListener('mouseover', (ev) => {
      const i = elementsDeScene(doc).indexOf(ev.target as Element);
      setSurvol(i >= 0 ? i : null);
    });
    doc.addEventListener('mouseleave', () => setSurvol(null));
    setDocCharge(frame.getAttribute('srcdoc'));
  };

  // Le survol ne demande pas de réévaluation : on déplace seulement sa marque.
  useEffect(() => {
    const doc = iframe.current?.contentDocument;
    if (!doc || !pret) return;
    doc.querySelectorAll('[data-jeu-survol]').forEach((el) => el.removeAttribute('data-jeu-survol'));
    if (survol !== null) elementsDeScene(doc)[survol]?.setAttribute('data-jeu-survol', '');
  }, [survol, pret]);

  const elementSurvole = survol !== null ? balisageAPlat(balisage)[survol] : null;
  const reussisDansMode = niveaux.filter((n) => estReussi(progression, n.id, modeEffectif(n, progression.mode))).length;
  const dernier = index === niveaux.length - 1;
  const finDeChapitre = dernier || niveaux[index + 1].chapitre !== niveau.chapitre;
  const titreChapitre = (id: string) => chapitres.find((c) => c.id === id)?.titre ?? id;

  return (
    <div class="jeu">
      <div class="jeu__principal">
        <header class="jeu__entete">
          <button type="button" class="jeu__fleche" onClick={() => allerA(index - 1)} disabled={index === 0} aria-label="Voir le Niveau précédent">
            ←
          </button>
          <p class="jeu__numero">
            Niveau {index + 1} / {niveaux.length}
          </p>
          <button
            type="button"
            class="jeu__fleche"
            onClick={() => allerA(index + 1)}
            disabled={dernier}
            aria-label="Voir le Niveau suivant"
          >
            →
          </button>
          <span class="jeu__notion">{niveau.notion}</span>
          {modesDuNiveau.length === 1 && <span class="pastille pastille--xpath">{NOMS_MODE[modesDuNiveau[0]]} uniquement</span>}
          {niveau.recommande && modesDuNiveau.length > 1 && (
            <span class="pastille pastille--recommande">{NOMS_MODE[niveau.recommande]} recommandé en e2e</span>
          )}
          {estReussi(progression, niveau.id, mode) && <span class="pastille pastille--reussi">Réussi</span>}
        </header>

        <h2 class="jeu__consigne">{niveau.consigne}</h2>
        {mode !== progression.mode && <p class="jeu__note">{raisonDuRepli(niveau, progression.mode, mode)}</p>}

        <div class="jeu__scene">
          <p class="jeu__survol" aria-hidden="true">
            {elementSurvole ? `<${elementSurvole.balise}${elementSurvole.attributs.map(([k, v]) => ` ${k}="${v}"`).join('')}>` : ' '}
          </p>
          <iframe ref={iframe} title={`Scène du Niveau ${index + 1}`} class="jeu__iframe" srcdoc={srcdoc} onLoad={auChargement} />
        </div>

        <form class="jeu__saisie" onSubmit={valider}>
          <label class="jeu__label" for="jeu-reponse">
            {{ css: 'Ton sélecteur CSS', xpath: 'Ton expression XPath', aria: 'Ta requête ARIA' }[mode]}
          </label>
          <div class="jeu__ligne">
            <input
              id="jeu-reponse"
              ref={champ}
              class="jeu__champ"
              type="text"
              spellcheck={false}
              autocomplete="off"
              autocapitalize="off"
              value={reponse}
              readOnly={retour.type === 'reussite'}
              placeholder={
                { css: 'Tape un sélecteur CSS', xpath: 'Tape une expression XPath', aria: "getByRole('button', { name: '...' })" }[mode]
              }
              onInput={(e) => {
                setReponse((e.target as HTMLInputElement).value);
                if (retour.type === 'echec') setRetour({ type: 'aucun' });
              }}
            />
            {retour.type === 'reussite' ? (
              <button ref={suivant} type="submit" class="bouton" disabled={dernier}>
                {dernier ? 'Terminé' : 'Niveau suivant'}
              </button>
            ) : (
              <button type="submit" class="bouton">
                Valider
              </button>
            )}
          </div>
        </form>

        <div class="jeu__retour" aria-live="polite">
          {retour.type === 'echec' && retour.messages.map((m) => <p class="jeu__echec">{m}</p>)}
          {retour.type === 'reussite' && (
            <div class="jeu__reussite">
              <p>
                <strong>Bravo !</strong>{' '}
                {dernier
                  ? `Tu as terminé tous les Chapitres. Essaie un autre Mode, ou teste tes sélecteurs sur tes propres pages dans le Testeur.`
                  : finDeChapitre
                    ? `Chapitre « ${titreChapitre(niveau.chapitre)} » terminé. Au suivant : « ${titreChapitre(niveaux[index + 1].chapitre)} ».`
                    : 'Niveau réussi.'}
              </p>
              <div class="jeu__lecon" dangerouslySetInnerHTML={{ __html: niveau.lecon }} />
              <p>
                <a href={`${base}${niveau.reference}`}>En savoir plus dans la Référence</a>
              </p>
            </div>
          )}
        </div>

        {retour.type !== 'reussite' && (
          <div class="jeu__indices">
            {niveau.indices.slice(0, indicesVus).map((html, i) => (
              <p class="jeu__indice">
                <strong>Indice {i + 1}</strong> : <span dangerouslySetInnerHTML={{ __html: html }} />
              </p>
            ))}
            {indicesVus < niveau.indices.length && (
              <button type="button" class="bouton bouton--secondaire" onClick={() => setIndicesVus((n) => n + 1)}>
                {indicesVus === 0 ? 'Afficher un indice' : 'Indice suivant'} ({indicesVus + 1}/{niveau.indices.length})
              </button>
            )}
          </div>
        )}

        <section class="jeu__code" aria-label="Code HTML de la Scène">
          <h3>Code HTML de la Scène</h3>
          <Balisage noeuds={balisage} survol={survol} trouves={trouves} onSurvol={setSurvol} />
        </section>
      </div>

      <aside class="jeu__cote">
        <fieldset class="jeu__modes">
          <legend>Mode</legend>
          {MODES.map((m) => (
            <label class={progression.mode === m ? 'choix choix--actif' : 'choix'}>
              <input type="radio" name="mode" value={m} checked={progression.mode === m} onChange={() => changerMode(m)} />
              {NOMS_MODE[m]}
            </label>
          ))}
        </fieldset>

        <nav aria-label="Niveaux">
          <p class="jeu__bilan">
            {reussisDansMode} / {niveaux.length} Niveaux réussis en {NOMS_MODE[progression.mode]}
          </p>
          {chapitres.map((chapitre) => (
            <div class="jeu__chapitre">
              <h2 class="jeu__titre-chapitre">{chapitre.titre}</h2>
              <ol class="jeu__niveaux">
                {niveaux.map((n, i) => {
                  if (n.chapitre !== chapitre.id) return null;
                  const reussi = estReussi(progression, n.id, modeEffectif(n, progression.mode));
                  return (
                    <li>
                      <button
                        type="button"
                        class={['jeu__niveau', i === index && 'jeu__niveau--courant', reussi && 'jeu__niveau--reussi'].filter(Boolean).join(' ')}
                        aria-current={i === index ? 'step' : undefined}
                        onClick={() => allerA(i)}
                      >
                        <span class="jeu__niveau-num">{i + 1}</span>
                        <span>{n.titre}</span>
                        {reussi && <span class="jeu__coche" aria-label="réussi">✓</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </nav>

        <button type="button" class="jeu__reinitialiser" onClick={reinitialiser}>
          Réinitialiser la Progression
        </button>
      </aside>
    </div>
  );
}

function balisageAPlat(noeuds: NoeudBalisage[]): NoeudBalisage[] {
  const plat: NoeudBalisage[] = [];
  const parcourir = (n: NoeudBalisage) => {
    plat[n.index] = n;
    n.enfants.forEach(parcourir);
  };
  noeuds.forEach(parcourir);
  return plat;
}
