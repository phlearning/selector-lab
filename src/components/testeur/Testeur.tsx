import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { analyserCss, type Fonctionnalite } from '../../lib/analyse';
import { diagnostiquer, type Diagnostic } from '../../lib/diagnostic';
import { decoder, encoder, TAILLE_MAX_HTML_LIEN, type EtatTesteur } from '../../lib/partage';
import { etiquette, evaluer, type Langage, type ResultatType } from '../../lib/resultat';
import { stylerPageExemple } from '../../lib/stylesPagesExemple';
import { PanneauTesteur } from '../assistant/PanneauTesteur';
import { Analyse } from './Analyse';
import { documentCible, marquer, nettoyer, restaurer, selectionner } from './iframe';

export interface PageProp {
  id: string;
  titre: string;
  html: string;
}

interface Props {
  pages: PageProp[];
  /** Base du site (`/selector-lab/`), pour les liens vers la Référence. */
  base: string;
  /** Lien vers l'Entrée de référence de chaque clé de compatibilité, quand elle existe. */
  liensReference: Record<string, string>;
}

const LANGAGES: { id: Langage; nom: string; indication: string }[] = [
  { id: 'css', nom: 'CSS', indication: 'tbody tr:has(.badge--suspendu)' },
  { id: 'xpath', nom: 'XPath 1.0', indication: "//tr[td='Paris']//button" },
  { id: 'aria', nom: 'ARIA', indication: "getByRole('row', { name: /Chloé/ }).getByRole('button', { name: 'Supprimer' })" },
  { id: 'dom', nom: 'API DOM', indication: "document.querySelector('#email').closest('form')" },
];

const HTML_PAR_DEFAUT = `<ul class="liste">
  <li class="element actif">Premier</li>
  <li class="element">Deuxième</li>
</ul>`;

const NOEUDS_AFFICHES_MAX = 200;

interface Evaluation {
  resultat: ResultatType;
  etiquettes: string[];
  diagnostics: Diagnostic[];
  analyse: Fonctionnalite[] | null;
}

export default function Testeur({ pages, base, liensReference }: Props) {
  const initial = useMemo(() => etatInitial(pages), []);
  const [langage, setLangage] = useState<Langage>(initial.langage);
  const [selecteur, setSelecteur] = useState(initial.selecteur);
  const [page, setPage] = useState<string | null>(initial.page);
  const [html, setHtml] = useState(initial.html ?? HTML_PAR_DEFAUT);
  // Le HTML collé n'est appliqué qu'après une pause de frappe, pour ne pas recharger l'iframe à chaque touche.
  const [htmlApplique, setHtmlApplique] = useState(html);
  // Une expression JavaScript venue d'un lien n'est jamais exécutée sans un clic explicite.
  const [domAutorise, setDomAutorise] = useState(!(initial.depuisLien && initial.langage === 'dom'));
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  // Le document effectivement chargé dans l'iframe : le Testeur est prêt quand c'est le Document cible courant.
  const [docCharge, setDocCharge] = useState<string | null>(null);
  const [lienCopie, setLienCopie] = useState(false);
  const [htmlOmis, setHtmlOmis] = useState(false);
  const [selectionne, setSelectionne] = useState<number | null>(null);

  const iframe = useRef<HTMLIFrameElement>(null);
  const noeuds = useRef<Node[]>([]);
  const modifie = useRef(false);

  useEffect(() => {
    const minuteur = setTimeout(() => setHtmlApplique(html), 400);
    return () => clearTimeout(minuteur);
  }, [html]);

  const source = page ? pages.find((p) => p.id === page)?.html ?? '' : htmlApplique;
  const srcdoc = useMemo(() => documentCible(source, page ? pages.find((p) => p.id === page)!.titre : 'Mon HTML'), [source]);

  const pret = docCharge === srcdoc;

  const evaluerMaintenant = useCallback(() => {
    const doc = iframe.current?.contentDocument;
    if (!doc || !pret) return;
    if (modifie.current) {
      restaurer(doc, srcdoc);
      modifie.current = false;
    }
    nettoyer(doc);
    noeuds.current = [];
    setSelectionne(null);
    if (!selecteur.trim() || (langage === 'dom' && !domAutorise)) {
      setEvaluation(null);
      return;
    }
    const resultat = evaluer(doc, langage, selecteur);
    if (langage === 'dom') modifie.current = true;
    const liste = resultat.type === 'noeuds' ? resultat.noeuds : [];
    const etiquettes = liste.slice(0, NOEUDS_AFFICHES_MAX).map(etiquette);
    noeuds.current = liste;
    marquer(doc, liste);
    let analyse: Fonctionnalite[] | null = null;
    if (langage === 'css' && resultat.type !== 'erreur') {
      try {
        analyse = analyserCss(selecteur);
      } catch {
        analyse = null;
      }
    }
    setEvaluation({ resultat, etiquettes, diagnostics: diagnostiquer(langage, selecteur, resultat, doc), analyse });
  }, [pret, selecteur, langage, domAutorise, srcdoc]);

  useEffect(() => {
    const minuteur = setTimeout(evaluerMaintenant, 150);
    return () => clearTimeout(minuteur);
  }, [evaluerMaintenant]);

  // Synchroniser l'URL pour le partage.
  useEffect(() => {
    const minuteur = setTimeout(() => {
      const etat: EtatTesteur = { langage, selecteur, page, html: page ? undefined : html };
      const { fragment, htmlOmis: omis } = encoder(etat);
      setHtmlOmis(omis);
      history.replaceState(null, '', `#${fragment}`);
      setLienCopie(false);
    }, 300);
    return () => clearTimeout(minuteur);
  }, [langage, selecteur, page, html]);

  /** Évaluation sur le document propre (sans marquage), pour la Validation des sélecteurs de l'Assistant. */
  const evaluerSurPage = (l: Langage, s: string): ResultatType => {
    const doc = iframe.current?.contentDocument;
    if (!doc) return { type: 'erreur', message: 'Document cible indisponible' };
    nettoyer(doc);
    try {
      return evaluer(doc, l, s);
    } finally {
      marquer(doc, noeuds.current);
    }
  };

  const choisirNoeud = (index: number) => {
    const doc = iframe.current?.contentDocument;
    if (!doc) return;
    setSelectionne(index);
    selectionner(doc, noeuds.current, index);
  };

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setLienCopie(true);
    } catch {
      setLienCopie(false);
    }
  };

  const indication = LANGAGES.find((l) => l.id === langage)!.indication;

  return (
    <div class="testeur">
      <div class="testeur__saisie">
        <fieldset class="testeur__langages">
          <legend>Langage de sélection</legend>
          {LANGAGES.map((l) => (
            <label key={l.id} class={langage === l.id ? 'choix choix--actif' : 'choix'}>
              <input
                type="radio"
                name="langage"
                value={l.id}
                checked={langage === l.id}
                onChange={() => {
                  setLangage(l.id);
                  setDomAutorise(true);
                }}
              />
              {l.nom}
            </label>
          ))}
        </fieldset>

        <label class="testeur__champ">
          <span>Sélecteur</span>
          <textarea
            class="testeur__selecteur"
            rows={3}
            spellcheck={false}
            autocapitalize="off"
            autocomplete="off"
            placeholder={indication}
            value={selecteur}
            onInput={(e) => {
              setSelecteur((e.target as HTMLTextAreaElement).value);
              setDomAutorise(true);
            }}
          />
        </label>

        {langage === 'dom' && !domAutorise && (
          <div class="avertissement" role="alert">
            <p>
              Ce lien contient une expression JavaScript. Elle sera exécutée dans votre navigateur : vérifiez-la avant
              de l'évaluer.
            </p>
            <button type="button" class="bouton" onClick={() => setDomAutorise(true)}>
              Évaluer l'expression
            </button>
          </div>
        )}

        <label class="testeur__champ">
          <span>Document cible</span>
          <select
            value={page ?? ''}
            onChange={(e) => {
              const valeur = (e.target as HTMLSelectElement).value;
              setPage(valeur || null);
            }}
          >
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                Page d'exemple : {p.titre}
              </option>
            ))}
            <option value="">Mon HTML (coller le code)</option>
          </select>
        </label>

        {page === null && (
          <label class="testeur__champ">
            <span>Mon HTML</span>
            <textarea
              class="testeur__html"
              rows={8}
              spellcheck={false}
              value={html}
              onInput={(e) => setHtml((e.target as HTMLTextAreaElement).value)}
            />
            <small>Les scripts ne sont jamais exécutés. Astuce : dans les DevTools, clic droit sur un élément, puis « Copier l'élément ».</small>
          </label>
        )}

        <div class="testeur__partage">
          <button type="button" class="bouton bouton--secondaire" onClick={copierLien}>
            Copier le lien
          </button>
          <span aria-live="polite">{lienCopie ? 'Lien copié.' : ''}</span>
          {htmlOmis && (
            <small class="testeur__alerte">
              Votre HTML dépasse {Math.round(TAILLE_MAX_HTML_LIEN / 1000)} ko une fois compressé : le lien ne contiendra que le sélecteur.
            </small>
          )}
        </div>

        <section class="testeur__resultat" aria-live="polite" aria-label="Résultat">
          <Resultat
            evaluation={evaluation}
            base={base}
            selectionne={selectionne}
            total={noeuds.current.length}
            onChoisir={choisirNoeud}
          />
        </section>

        {evaluation?.analyse && evaluation.analyse.length > 0 && (
          <Analyse fonctionnalites={evaluation.analyse} base={base} liensReference={liensReference} />
        )}

        <PanneauTesteur
          langage={langage}
          selecteur={selecteur}
          document={() => iframe.current?.contentDocument ?? null}
          evaluerSurPage={evaluerSurPage}
          onUtiliser={(l, s) => {
            setLangage(l);
            setSelecteur(s);
            setDomAutorise(true);
          }}
        />
      </div>

      <div class="testeur__apercu">
        <div class="fenetre">
          <div class="fenetre__barre" aria-hidden="true">
            <span class="fenetre__points" />
            <span class="fenetre__titre">{page ? pages.find((p) => p.id === page)?.titre : 'Mon HTML'}</span>
          </div>
          <iframe
            ref={iframe}
            title="Aperçu du Document cible"
            class="testeur__iframe"
            // allow-same-origin sans allow-scripts : le Testeur peut lire le DOM, mais aucun script du document ne s'exécute.
            sandbox="allow-same-origin"
            srcdoc={srcdoc}
            onLoad={(e) => {
              modifie.current = false;
              const docCible = (e.currentTarget as HTMLIFrameElement).contentDocument;
              // Style des Pages d'exemple, sans toucher au DOM (le HTML collé reste tel quel).
              if (docCible && page) stylerPageExemple(docCible, page);
              // Un clic dans l'aperçu ne doit pas faire naviguer l'iframe hors du Document cible.
              (e.currentTarget as HTMLIFrameElement).contentDocument?.addEventListener('click', (ev) => ev.preventDefault());
              setDocCharge((e.currentTarget as HTMLIFrameElement).getAttribute('srcdoc'));
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Resultat(props: {
  evaluation: Evaluation | null;
  base: string;
  selectionne: number | null;
  total: number;
  onChoisir: (index: number) => void;
}) {
  const { evaluation, base, selectionne, total, onChoisir } = props;
  if (!evaluation) return <p class="testeur__vide">Saisissez un sélecteur pour l'évaluer.</p>;
  const { resultat, etiquettes, diagnostics } = evaluation;
  return (
    <>
      {resultat.type === 'erreur' && (
        <p class="testeur__erreur">
          <strong>Erreur</strong> : {resultat.message}
        </p>
      )}
      {resultat.type === 'noeuds' && (
        <>
          <p class="testeur__compte">
            <strong>{total === 0 ? 'Aucun nœud' : `${total} ${total > 1 ? 'nœuds' : 'nœud'}`}</strong>
            {total > NOEUDS_AFFICHES_MAX && ` (${NOEUDS_AFFICHES_MAX} premiers affichés)`}
          </p>
          {etiquettes.length > 0 && (
            <ol class="testeur__noeuds">
              {etiquettes.map((texte, i) => (
                <li key={i}>
                  <button type="button" class={selectionne === i ? 'noeud noeud--actif' : 'noeud'} onClick={() => onChoisir(i)}>
                    <code>{texte}</code>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      {resultat.type === 'nombre' && (
        <p class="testeur__valeur">
          Nombre : <code>{String(resultat.valeur)}</code>
        </p>
      )}
      {resultat.type === 'chaine' && (
        <p class="testeur__valeur">
          Chaîne : <code>"{resultat.valeur}"</code>
        </p>
      )}
      {resultat.type === 'booleen' && (
        <p class="testeur__valeur">
          Booléen : <code>{String(resultat.valeur)}</code>
        </p>
      )}
      {diagnostics.map((d, i) => (
        <p key={i} class="testeur__aide">
          {d.message}
          {d.lien && (
            <>
              {' '}
              <a href={`${base}${d.lien.chemin}`}>{d.lien.texte}</a>
            </>
          )}
        </p>
      ))}
    </>
  );
}

function etatInitial(pages: PageProp[]): EtatTesteur & { depuisLien: boolean } {
  const defaut: EtatTesteur = { langage: 'css', selecteur: '', page: pages[0]?.id ?? null };
  if (typeof location === 'undefined' || location.hash.length < 2) return { ...defaut, depuisLien: false };
  const lu = decoder(location.hash);
  const pageConnue = lu.page === null || pages.some((p) => p.id === lu.page);
  return {
    langage: lu.langage ?? defaut.langage,
    selecteur: lu.selecteur ?? '',
    page: pageConnue && lu.page !== undefined ? lu.page : defaut.page,
    html: lu.html,
    depuisLien: true,
  };
}

