# Selector Lab

Site statique pour apprendre, chercher et tester les sélecteurs utilisés en tests end-to-end : CSS, XPath 1.0, API DOM et requêtes ARIA, avec leur support dans chaque navigateur.

- **Référence** : chaque fonctionnalité, ses exemples, ses pièges et son support navigateur.
- **Testeur** : évaluer un sélecteur sur une page d'exemple ou sur son propre HTML.
- **Jeu** : progresser niveau par niveau, en CSS ou en XPath, puis sur des scénarios e2e.
- **Assistant** : un petit modèle de langage exécuté dans le navigateur, chargé à la demande (voir [ADR 0001](docs/adr/0001-assistant-local-a-la-demande.md)).

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

## Déploiement

Chaque push sur `main` lance le build, les tests dans les trois moteurs, puis le déploiement sur GitHub Pages si tout passe.

## Licences

- Code : [MIT](LICENSE)
- Contenu (Référence, Niveaux, Indices) : [CC BY-SA 4.0](LICENSE-CONTENT.md)
