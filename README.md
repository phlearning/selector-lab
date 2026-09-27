# Selector Lab

Site statique pour apprendre, chercher et tester les sélecteurs utilisés en tests end-to-end : CSS, XPath 1.0, API DOM et requêtes ARIA, avec leur support dans chaque navigateur.

- **Référence** : CSS, XPath 1.0, API DOM et Requêtes ARIA : chaque fonctionnalité, ses exemples, ses pièges et son support navigateur.
- **Testeur** : évaluer un sélecteur sur une page d'exemple ou sur son propre HTML.
- **Jeu** : progresser niveau par niveau dans une bibliothèque (CSS ou XPath), puis dans trois Scénarios e2e sur de vraies interfaces (CSS, XPath ou ARIA).
- **Assistant** : un petit modèle de langage exécuté dans le navigateur, chargé à la demande (voir [ADR 0001](docs/adr/0001-assistant-local-a-la-demande.md)). Il utilise l'IA intégrée de Chrome (Gemini Nano) si elle est disponible, sinon WebLLM sur WebGPU (Qwen2.5-Coder 0.5B, 290 Mo, ou 1.5B, 880 Mo). Dans le Testeur, il explique un sélecteur, juge sa robustesse, le convertit, en génère un depuis une description ou répond à une question ; dans le Jeu, il donne des Indices personnalisés. Chaque sélecteur qu'il propose est vérifié par le navigateur avant d'être affiché.

Le vocabulaire du projet est défini dans [CONTEXT.md](CONTEXT.md).

## Développement

Node 22.12 ou plus récent est requis (voir `.nvmrc`).

```bash
nvm use
npm install
npm run dev
```

## Tests

Les tests Playwright tournent sur Chromium, Firefox et WebKit, contre le site construit :

```bash
npx playwright install chromium firefox webkit
npm run build
npm test
```

## Contenu de la Référence

Chaque page de la Référence est un fichier YAML dans `src/content/reference/<langage>/`, et la page
« CSS vs XPath » est `src/content/comparaison.yaml`. Les Pages d'exemple sont dans `src/pages-exemple/`.

Chaque Exemple déclare son Résultat typé attendu (`attendu`). Pour ajouter un Exemple :

1. écrire le `selecteur` et la `page`, sans `attendu` ;
2. lancer `npm run build && npm run attendus` : le script évalue l'Exemple dans Chromium et écrit le résultat ;
3. **relire** le résultat écrit, puis `npm test` vérifie qu'il est identique dans Firefox et WebKit.

Les Niveaux du Jeu sont dans `src/content/niveaux.yaml` (l'ordre du fichier est l'ordre de jeu). Leurs
Solutions de référence passent par le même circuit : `npm run attendus` calcule leur résultat, et la CI vérifie
que les solutions CSS et XPath d'un même Niveau renvoient exactement les mêmes nœuds dans les trois moteurs.

`npm run verifier-contenu` signale les erreurs de syntaxe YAML et les pièges connus (un `#` sans guillemets
est lu comme un commentaire). Le Support navigateur vient de `@mdn/browser-compat-data` et `web-features`,
mis à jour avec les dépendances.

## Styles

`src/styles/` contient un fichier par partie du site (`global.css` pour la base et les composants partagés,
puis `accueil.css`, `reference.css`, `testeur.css`, `jeu.css`, `assistant.css`, `pages-exemple.css`).

Les Pages d'exemple ont leurs propres styles dans `src/pages-exemple/styles/` (`commun.css` plus un fichier par
page). Ils sont appliqués par `adoptedStyleSheets`, sans jamais modifier le DOM, et ne doivent ni masquer
d'élément ni générer de texte : `npm run verifier-contenu` le contrôle.

## Assistant en test

Aucun modèle ne tourne en CI. Les tests injectent un moteur simulé (`window.__selectorLabMoteurTest`) pour
vérifier l'interface, la Validation des sélecteurs proposés et le filtrage des Indices qui dévoileraient la
solution.

## Déploiement

Chaque push sur `main` lance le build, les tests dans les trois moteurs, puis le déploiement sur GitHub Pages si tout passe.

## Licences

- Code : [MIT](LICENSE)
- Contenu (Référence, Niveaux, Indices) : [CC BY-SA 4.0](LICENSE-CONTENT.md)
