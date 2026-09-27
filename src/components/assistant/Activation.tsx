import { useEffect, useState } from 'preact/hooks';
import { activer, dernierChoix, useAssistant, type Choix } from '../../lib/assistant/etat';
import { detecter, MODELES, type Disponibilite } from '../../lib/assistant/moteurs';

const ETAT_CHROME: Record<Disponibilite['chrome'], string> = {
  available: 'prête',
  downloadable: 'disponible, modèle à télécharger par Chrome',
  downloading: 'modèle en cours de téléchargement par Chrome',
  unavailable: 'refusée par Chrome sur cette machine (matériel ou espace disque insuffisant, ou langue non prise en charge)',
  absent: "absente de ce navigateur (API Prompt introuvable : Chrome 138 ou plus récent sur ordinateur est nécessaire)",
};

const ETAT_WEBGPU: Record<Disponibilite['webgpu'], string> = {
  disponible: 'disponible',
  'sans-adaptateur': "l'API existe, mais aucune carte graphique utilisable n'a été trouvée",
  absent: 'absent de ce navigateur, ou désactivé',
};

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
  const webgpu = dispo?.webgpu === 'disponible';

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
                : "Chrome téléchargera d'abord son modèle Gemini Nano (plusieurs Go, géré par Chrome)",
            )}
          {webgpu && (
            <>
              {bouton('leger', 'Modèle léger', `${MODELES.leger.nom}, ${MODELES.leger.taille} à télécharger une fois`)}
              {bouton('standard', 'Modèle standard', `${MODELES.standard.nom}, ${MODELES.standard.taille}, meilleures réponses`)}
            </>
          )}
          {!chrome && !webgpu && (
            <p class="assistant__statut">
              Votre navigateur ne propose ni l'IA intégrée de Chrome, ni WebGPU : l'Assistant n'est pas disponible ici. Le
              reste du site fonctionne normalement.
            </p>
          )}
        </div>
      )}
      {precedent && dispo && <p class="assistant__note">Si vous l'avez déjà utilisé sur cet appareil, le modèle est en cache : l'activation est rapide.</p>}
      {dispo && (
        <details class="assistant__aide">
          <summary>Diagnostic et comment activer l'Assistant</summary>
          <ul class="assistant__diagnostic">
            <li>
              <strong>IA intégrée de Chrome</strong> : {ETAT_CHROME[dispo.chrome]}.
            </li>
            <li>
              <strong>WebGPU</strong> (pour WebLLM) : {ETAT_WEBGPU[dispo.webgpu]}.
            </li>
          </ul>
          <h3>IA intégrée de Chrome (Gemini Nano)</h3>
          <ol>
            <li>Utilisez Chrome 138 ou plus récent sur ordinateur : Windows 10/11, macOS 13+, Linux ou Chromebook Plus.</li>
            <li>
              Il faut au moins 22 Go libres sur le disque du profil Chrome, et une carte graphique avec plus de 4 Go de
              mémoire (ou 16 Go de RAM et 4 cœurs), ainsi qu'une connexion non limitée pour le premier téléchargement.
            </li>
            <li>
              Ouvrez <code>chrome://on-device-internals</code> : l'état du modèle et les éventuelles erreurs y sont
              affichés. Dans la console, <code>await LanguageModel.availability()</code> donne le même diagnostic que
              ci-dessus.
            </li>
            <li>
              Si le modèle est « à télécharger », cliquez sur « Activer » : Chrome le télécharge (plusieurs Go), ce qui peut
              prendre du temps. Redémarrez Chrome si l'état reste bloqué.
            </li>
          </ol>
          <h3>WebGPU (modèles WebLLM)</h3>
          <ol>
            <li>
              Vérifiez votre navigateur sur <a href="https://webgpureport.org">webgpureport.org</a>.
            </li>
            <li>
              Chrome et Edge l'activent par défaut sur Windows, macOS et ChromeOS. <strong>Sous Linux</strong>, il est encore
              souvent désactivé : ouvrez <code>chrome://flags</code>, activez <code>#enable-unsafe-webgpu</code> et{' '}
              <code>#enable-vulkan</code>, puis redémarrez. Des pilotes graphiques Vulkan à jour sont nécessaires.
            </li>
            <li>
              Firefox l'active par défaut sur Windows, et le déploie progressivement ailleurs ; sinon, le réglage{' '}
              <code>dom.webgpu.enabled</code> de <code>about:config</code> l'active selon les versions. Safari 26 et plus
              l'active par défaut.
            </li>
          </ol>
        </details>
      )}
    </div>
  );
}
