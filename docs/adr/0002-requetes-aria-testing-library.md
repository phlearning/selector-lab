---
status: accepted
---

# Requêtes ARIA avec la sémantique de Testing Library, analysées et non exécutées

Les navigateurs n'offrent pas de `getByRole` natif : il faut une bibliothèque pour calculer les rôles et les Noms accessibles. Nous utilisons @testing-library/dom (et sa sémantique) plutôt que le moteur de Playwright, qui n'est pas distribué pour tourner dans une page web. Les requêtes sont écrites avec la syntaxe JavaScript de Testing Library, mais **analysées** par un petit analyseur (`src/lib/aria.ts`) au lieu d'être exécutées : un lien partagé vers le Testeur ne peut donc pas faire exécuter de code, contrairement au langage API DOM qui exige une confirmation.

## Conséquences

- La correspondance de `name` suit Testing Library (chaîne exacte), et non Playwright (sous-chaîne sans casse). L'écart est documenté dans la Référence et rappelé par le Testeur quand une requête ne trouve rien.
- Le chaînage (`getByRole(...).getByRole(...)`) reprend la sémantique des locators de Playwright, que Testing Library n'offre qu'avec `within()`.
- Les requêtes ont besoin d'un document affiché (fenêtre, styles calculés) : la vérification en CI évalue les Exemples ARIA dans une iframe, et non dans un document `DOMParser`.
