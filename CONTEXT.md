# Selector Lab

Site statique d'apprentissage et de référence des sélecteurs (CSS, XPath, API DOM, ARIA) pour les tests end-to-end, avec un outil de test et un jeu.

## Langage

### Sélecteurs

**Langage de sélection**:
Une syntaxe permettant de désigner des éléments d'un document : CSS Selectors, XPath 1.0, API DOM ou requêtes ARIA.
_Éviter_: techno, type de sélecteur

**Sélecteur**:
Une expression écrite dans un Langage de sélection, qui désigne zéro, un ou plusieurs éléments.
_Éviter_: locator (réservé aux objets des frameworks e2e), query

**Locator**:
Un objet propre à un framework e2e (Playwright, Cypress, Selenium...) qui encapsule un Sélecteur ; hors périmètre de la V1.
_Éviter_: sélecteur (quand on parle du framework)

**Résultat typé**:
La valeur renvoyée par l'évaluation d'un Sélecteur : ensemble de nœuds, nombre, chaîne ou booléen (les trois derniers n'existent qu'en XPath).
_Éviter_: match, output

### Référence

**Référence**:
La partie documentaire du site, organisée par Langage de sélection, destinée à la recherche rapide.
_Éviter_: doc, cheat sheet, wiki

**Entrée de référence**:
Une fonctionnalité documentée d'un Langage de sélection (une fonction comme `count()`, une pseudo-classe comme `:has()`, une méthode comme `closest()`).
_Éviter_: fiche, article

**Exemple**:
Un Sélecteur illustrant une Entrée de référence, évalué sur une Page d'exemple, et accompagné de son Résultat typé attendu.
_Éviter_: snippet, démo

**Support navigateur**:
L'information, issue des données de compatibilité MDN, indiquant à partir de quelle version chaque navigateur prend en charge une Entrée de référence, ou si elle est absente (ex : fonctions XPath 2.0).
_Éviter_: compatibilité, compat

### Testeur

**Testeur**:
L'outil qui évalue un Sélecteur sur un Document cible et affiche son Résultat typé en surlignant les nœuds trouvés.
_Éviter_: playground, sandbox, bac à sable

**Document cible**:
Le HTML sur lequel le Testeur évalue un Sélecteur : une Page d'exemple fournie ou un HTML collé par l'utilisateur.
_Éviter_: DOM, page, fixture

**Analyse**:
La décomposition d'un Sélecteur CSS par le Testeur en fonctionnalités, chacune accompagnée de son Support navigateur.
_Éviter_: lint, parsing

**Requête ARIA**:
Un Sélecteur qui désigne des éléments par leur rôle et leur Nom accessible, écrit avec la syntaxe de Testing Library et éventuellement chaîné (ex : `getByRole('row', { name: /Chloé/ }).getByRole('button', { name: 'Supprimer' })`).
_Éviter_: sélecteur d'accessibilité, role selector

**Nom accessible**:
Le texte par lequel une technologie d'assistance désigne un élément, calculé à partir de `aria-labelledby`, `aria-label`, du libellé natif ou du contenu.
_Éviter_: label, libellé (qui n'en est qu'une source)

**Page d'exemple**:
Un Document cible fourni par le site, représentatif d'une interface réelle (formulaire, tableau, panier) ; ressource unique partagée par le Testeur, les Scénarios e2e et les Exemples.
_Éviter_: template, démo

### Jeu

**Jeu**:
La partie interactive d'apprentissage, où chaque Niveau demande d'écrire un Sélecteur ciblant exactement les éléments attendus.
_Éviter_: diner, quiz, exercices

**Niveau**:
Une étape du Jeu, composée d'une Scène, d'une consigne, d'une Leçon et d'une Solution de référence ; certains Niveaux ne sont résolubles qu'en XPath.
_Éviter_: exercice, challenge

**Chapitre**:
Un groupe de Niveaux partageant un univers : la bibliothèque, puis chaque Scénario e2e.
_Éviter_: monde, section

**Scène**:
Le Document cible d'un Niveau : dans le Chapitre bibliothèque, des étagères, livres, magazines, boîtes et plantes représentés par des balises (`etagere`, `livre`...).
_Éviter_: plateau, table, décor

**Leçon**:
L'explication courte de la notion travaillée par un Niveau, affichée une fois le Niveau réussi (pour ne pas dévoiler la solution) et reliée à l'Entrée de référence correspondante.
_Éviter_: cours, tutoriel

**Progression**:
Les Niveaux réussis par le joueur dans chaque Mode, conservés dans son navigateur uniquement.
_Éviter_: sauvegarde, score

**Solution de référence**:
Un Sélecteur caché du joueur qui prouve qu'un Niveau est résoluble ; il n'est jamais comparé textuellement à la réponse du joueur.
_Éviter_: corrigé, réponse

**Réussite**:
Un Niveau est réussi quand le Résultat typé du Sélecteur du joueur est identique au Résultat typé attendu (même ensemble de nœuds, ou même type et même valeur).
_Éviter_: validation

**Mode**:
Le Langage de sélection choisi par le joueur pour résoudre les Niveaux : CSS ou XPath, plus ARIA dans les Scénarios e2e uniquement.
_Éviter_: langue, option

**Scénario e2e**:
Un chapitre avancé du Jeu : une suite de Niveaux posés sur une Page d'exemple, dont les consignes imitent des besoins de test réels.
_Éviter_: mission, cas d'usage

### Indices

**Indice**:
Une aide écrite à la main, attachée à un Niveau, qui oriente sans révéler la solution ; les Indices d'un Niveau sont progressifs.
_Éviter_: hint, solution
