import { useEffect, useState } from 'preact/hooks';
import { activer, dernierChoix, useAssistant, type Choix } from '../../lib/assistant/etat';
import { detecter, MODELES, type Disponibilite } from '../../lib/assistant/moteurs';

/** Activation de l'Assistant : rien n'est chargé avant un clic, et la taille du téléchargement est annoncée. */
export function Activation() {
  const etat = useAssistant();
  const [dispo, setDispo] = useState<Disponibilite | null>(null);
  const precedent = dernierChoix();

  useEffect(() => {
    detecter().then(setDispo);
  }, []);

  if (etat.statut === 'pret') return <p class="assistant__statut">Assistant prêt : {etat.moteur.nom}.</p>;

  if (etat.statut === 'chargement') {
    return (
      <div class="assistant__chargement">
        <progress value={etat.fraction} max={1} aria-label="Chargement de l'Assistant" />
        <p>{etat.texte}</p>
      </div>
    );
  }

  const bouton = (choix: Choix, libelle: string, detail: string) => (
    <button type="button" class={choix === precedent ? 'bouton' : 'bouton bouton--secondaire'} onClick={() => activer(choix)}>
      {libelle}
      <small>{detail}</small>
    </button>
  );

  const chrome = dispo && dispo.chrome !== 'absent' && dispo.chrome !== 'unavailable';

  return (
    <div class="assistant__activation">
      <p>
        L'Assistant tourne <strong>entièrement dans votre navigateur</strong> : rien n'est envoyé à un serveur, et rien
        n'est chargé tant que vous ne l'activez pas.
      </p>
      {etat.statut === 'erreur' && <p class="assistant__erreur">Échec du chargement : {etat.message}</p>}
      {!dispo && <p class="assistant__statut">Recherche des moteurs disponibles...</p>}
      {dispo && (
        <div class="assistant__choix">
          {chrome &&
            bouton(
              'chrome',
              "Activer avec l'IA intégrée de Chrome",
              dispo.chrome === 'available'
                ? 'Aucun téléchargement depuis ce site'
                : 'Chrome téléchargera d\'abord son modèle Gemini Nano (plusieurs Go, géré par Chrome)',
            )}
          {dispo.webgpu && (
            <>
              {bouton('leger', 'Modèle léger', `${MODELES.leger.nom}, ${MODELES.leger.taille} à télécharger une fois`)}
              {bouton('standard', 'Modèle standard', `${MODELES.standard.nom}, ${MODELES.standard.taille}, meilleures réponses`)}
            </>
          )}
          {!chrome && !dispo.webgpu && (
            <p class="assistant__statut">
              Votre navigateur ne propose ni l'IA intégrée de Chrome, ni WebGPU : l'Assistant n'est pas disponible ici. Le
              reste du site fonctionne normalement.
            </p>
          )}
        </div>
      )}
      {precedent && dispo && <p class="assistant__note">Si vous l'avez déjà utilisé sur cet appareil, le modèle est en cache : l'activation est rapide.</p>}
    </div>
  );
}
