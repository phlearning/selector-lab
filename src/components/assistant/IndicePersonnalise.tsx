import { useState } from 'preact/hooks';
import { devoileLaSolution, formater, messagesIndice, type ContexteIndice } from '../../lib/assistant/actions';
import { useAssistant } from '../../lib/assistant/etat';
import { Activation } from './Activation';

interface Props {
  /** Vrai dès que le joueur a proposé une réponse (sans calcul : utilisé pendant l'affichage). */
  disponible: boolean;
  /**
   * Contexte de la dernière tentative ; `null` si rien n'a été proposé. N'est appelé qu'au clic : il
   * réévalue la Scène et modifie l'état du Jeu, ce qui bouclerait s'il était appelé pendant l'affichage.
   */
  contexte: () => ContexteIndice | null;
  /** Solutions du Niveau, pour ne jamais afficher un indice qui les contient. */
  solutions: (string | null)[];
  /** Appelé si l'indice de l'Assistant est écarté : on dévoile alors un Indice écrit à la main. */
  onRepli: () => void;
}

/** Indice personnalisé : complément optionnel des Indices, à partir de la dernière tentative du joueur. */
export function IndicePersonnalise({ disponible, contexte, solutions, onRepli }: Props) {
  const etat = useAssistant();
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  if (etat.statut !== 'pret') {
    return ouvert ? (
      <div class="assistant assistant--compact">
        <Activation />
      </div>
    ) : (
      <button type="button" class="lien-bouton" onClick={() => setOuvert(true)}>
        Activer l'Assistant pour des Indices personnalisés
      </button>
    );
  }

  const demander = async () => {
    const c = contexte();
    if (!c || enCours) return;
    setEnCours(true);
    setTexte('');
    try {
      const reponse = await etat.moteur.generer(messagesIndice(c), { surTexte: (t) => setTexte(t) });
      if (devoileLaSolution(reponse, solutions)) {
        setTexte("L'Assistant allait dévoiler la solution : voici plutôt un Indice écrit à la main, ci-dessus.");
        onRepli();
      } else {
        setTexte(reponse);
      }
    } catch (e) {
      setTexte(`L'Assistant a échoué : ${(e as Error).message}`);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div class="indice-ia">
      <button type="button" class="bouton bouton--secondaire" onClick={demander} disabled={enCours || !disponible}>
        {enCours ? 'L\'Assistant réfléchit...' : 'Indice personnalisé'}
      </button>
      {texte !== null && (
        // Pendant la génération, le texte reste masqué : il pourrait contenir la solution avant le filtrage final.
        <p class="jeu__indice" aria-live="polite">
          <strong>Assistant</strong> : {enCours ? '...' : <span dangerouslySetInnerHTML={{ __html: formater(texte) }} />}
        </p>
      )}
    </div>
  );
}
