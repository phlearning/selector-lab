import { useRef, useState } from 'preact/hooks';
import {
  extraitHtml,
  formater,
  lireReponseSelecteur,
  messagesConvertir,
  messagesExpliquer,
  messagesGenerer,
  messagesQuestion,
  messagesRobustesse,
  SCHEMA_SELECTEUR,
  valider,
  type ReponseSelecteur,
  type Validation,
} from '../../lib/assistant/actions';
import { useAssistant } from '../../lib/assistant/etat';
import type { Message } from '../../lib/assistant/moteurs';
import type { Langage, ResultatType } from '../../lib/resultat';
import { Activation } from './Activation';

interface Props {
  langage: Langage;
  selecteur: string;
  document: () => Document | null;
  evaluerSurPage: (langage: Langage, selecteur: string) => ResultatType;
  onUtiliser: (langage: Langage, selecteur: string) => void;
}

type Sortie =
  | { type: 'texte'; titre: string; texte: string }
  | { type: 'selecteur'; titre: string; langage: Langage; brut: string; reponse: ReponseSelecteur | null; validation: Validation | null };

const NOMS: Record<Langage, string> = { css: 'CSS', xpath: 'XPath', aria: 'ARIA', dom: 'API DOM' };

function ciblesDeConversion(langage: Langage): Langage[] {
  if (langage === 'css') return ['xpath'];
  if (langage === 'xpath') return ['css'];
  if (langage === 'aria') return ['css', 'xpath'];
  return [];
}

/** Actions de l'Assistant dans le Testeur, plus un champ libre (et seulement ici). */
export function PanneauTesteur({ langage, selecteur, document, evaluerSurPage, onUtiliser }: Props) {
  const etat = useAssistant();
  const [sortie, setSortie] = useState<Sortie | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [description, setDescription] = useState('');
  const [question, setQuestion] = useState('');
  const arret = useRef<AbortController | null>(null);

  if (etat.statut !== 'pret') {
    return (
      <section class="assistant" aria-label="Assistant">
        <h2>Assistant</h2>
        <Activation />
      </section>
    );
  }

  const html = () => {
    const doc = document();
    return doc ? extraitHtml(doc) : '';
  };
  const cibleGeneration: Langage = langage === 'dom' ? 'css' : langage;
  const sansSelecteur = !selecteur.trim();

  async function lancer(messages: Message[], preparer: (texte: string, fini: boolean) => Sortie, schema?: Record<string, unknown>) {
    if (etat.statut !== 'pret') return;
    arret.current?.abort();
    const controleur = new AbortController();
    arret.current = controleur;
    setEnCours(true);
    try {
      const texte = await etat.moteur.generer(messages, {
        schema,
        signal: controleur.signal,
        surTexte: (t) => setSortie(preparer(t, false)),
      });
      setSortie(preparer(texte, true));
    } catch (e) {
      if (!controleur.signal.aborted) setSortie({ type: 'texte', titre: 'Erreur', texte: `L'Assistant a échoué : ${(e as Error).message}` });
    } finally {
      setEnCours(false);
    }
  }

  const texte = (titre: string, messages: Message[]) => lancer(messages, (t) => ({ type: 'texte', titre, texte: t }));

  const produireSelecteur = (titre: string, vers: Langage, messages: Message[], original?: { langage: Langage; selecteur: string }) =>
    lancer(
      messages,
      (brut, fini) => {
        const reponse = fini ? lireReponseSelecteur(brut) : null;
        const validation = reponse?.possible && reponse.selecteur ? valider(evaluerSurPage, vers, reponse.selecteur, original) : null;
        return { type: 'selecteur', titre, langage: vers, brut, reponse, validation };
      },
      SCHEMA_SELECTEUR,
    );

  return (
    <section class="assistant" aria-label="Assistant">
      <h2>Assistant</h2>
      <p class="assistant__note">
        {etat.moteur.nom}. Un petit modèle se trompe souvent : chaque sélecteur proposé est vérifié par votre navigateur
        avant d'être affiché.
      </p>
      <div class="assistant__actions">
        <button type="button" class="bouton bouton--secondaire" disabled={sansSelecteur || enCours} onClick={() => texte('Explication', messagesExpliquer(langage, selecteur, html()))}>
          Expliquer
        </button>
        <button type="button" class="bouton bouton--secondaire" disabled={sansSelecteur || enCours} onClick={() => texte('Robustesse', messagesRobustesse(langage, selecteur, html()))}>
          Évaluer la robustesse
        </button>
        {ciblesDeConversion(langage).map((vers) => (
          <button
            type="button"
            class="bouton bouton--secondaire"
            disabled={sansSelecteur || enCours}
            onClick={() => produireSelecteur(`Conversion en ${NOMS[vers]}`, vers, messagesConvertir(langage, vers, selecteur, html()), { langage, selecteur })}
          >
            Convertir en {NOMS[vers]}
          </button>
        ))}
      </div>

      <form
        class="assistant__formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          if (description.trim()) produireSelecteur(`Sélecteur ${NOMS[cibleGeneration]} généré`, cibleGeneration, messagesGenerer(cibleGeneration, description, html()));
        }}
      >
        <label for="assistant-description">Générer un sélecteur {NOMS[cibleGeneration]} depuis une description</label>
        <div class="assistant__ligne">
          <input
            id="assistant-description"
            type="text"
            value={description}
            placeholder="le bouton Supprimer de la ligne de Chloé Durand"
            onInput={(e) => setDescription((e.target as HTMLInputElement).value)}
          />
          <button type="submit" class="bouton" disabled={enCours || !description.trim()}>
            Générer
          </button>
        </div>
      </form>

      <form
        class="assistant__formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) texte('Réponse', messagesQuestion(question, langage, selecteur, html()));
        }}
      >
        <label for="assistant-question">Poser une question sur ce sélecteur ou cette page</label>
        <div class="assistant__ligne">
          <input id="assistant-question" type="text" value={question} onInput={(e) => setQuestion((e.target as HTMLInputElement).value)} />
          <button type="submit" class="bouton" disabled={enCours || !question.trim()}>
            Demander
          </button>
        </div>
      </form>

      {enCours && (
        <button type="button" class="bouton bouton--secondaire" onClick={() => arret.current?.abort()}>
          Arrêter
        </button>
      )}

      <div class="assistant__sortie" aria-live="polite">
        {sortie?.type === 'texte' && (
          <>
            <h3>{sortie.titre}</h3>
            <p dangerouslySetInnerHTML={{ __html: formater(sortie.texte) }} />
          </>
        )}
        {sortie?.type === 'selecteur' && <SortieSelecteur sortie={sortie} enCours={enCours} onUtiliser={onUtiliser} />}
      </div>
    </section>
  );
}

function SortieSelecteur({ sortie, enCours, onUtiliser }: { sortie: Extract<Sortie, { type: 'selecteur' }>; enCours: boolean; onUtiliser: Props['onUtiliser'] }) {
  const { reponse, validation } = sortie;
  if (enCours && !reponse) {
    return (
      <>
        <h3>{sortie.titre}</h3>
        <p class="assistant__note">Génération en cours...</p>
      </>
    );
  }
  if (!reponse) {
    return (
      <>
        <h3>{sortie.titre}</h3>
        <p class="assistant__erreur">L'Assistant n'a pas produit de sélecteur lisible.</p>
      </>
    );
  }
  if (!reponse.possible) {
    return (
      <>
        <h3>{sortie.titre}</h3>
        <p>Impossible selon l'Assistant : <span dangerouslySetInnerHTML={{ __html: formater(reponse.explication) }} /></p>
      </>
    );
  }
  const utilisable = validation?.statut === 'valide';
  return (
    <>
      <h3>{sortie.titre}</h3>
      <p>
        <code class="assistant__selecteur">{reponse.selecteur}</code>
      </p>
      {validation?.statut === 'valide' && (
        <p class="assistant__valide">
          Vérifié par votre navigateur : {validation.nombre} {validation.nombre > 1 ? 'éléments trouvés' : 'élément trouvé'}.
        </p>
      )}
      {validation?.statut === 'different' && (
        <p class="assistant__erreur">
          Attention : ce sélecteur trouve {validation.obtenu} élément(s), l'original en trouve {validation.attendu}. La conversion n'est pas équivalente.
        </p>
      )}
      {validation?.statut === 'vide' && <p class="assistant__erreur">Attention : ce sélecteur ne trouve aucun élément dans la page.</p>}
      {validation?.statut === 'invalide' && <p class="assistant__erreur">Attention : sélecteur refusé par le navigateur ({validation.message}).</p>}
      {reponse.explication && <p dangerouslySetInnerHTML={{ __html: formater(reponse.explication) }} />}
      <button type="button" class={utilisable ? 'bouton' : 'bouton bouton--secondaire'} onClick={() => onUtiliser(sortie.langage, reponse.selecteur)}>
        {utilisable ? 'Utiliser ce sélecteur' : 'Essayer quand même'}
      </button>
    </>
  );
}
