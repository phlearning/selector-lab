---
status: deprecated
---

# Assistant local, chargé à la demande, avec Validation obligatoire

> **Abandonné.** L'Assistant a été implémenté puis retiré : l'IA intégrée de Chrome ne fonctionnait pas sur les
> machines de test malgré un Chrome à jour, et WebGPU reste désactivé par défaut sous Linux. Le site garde sa
> valeur sans lui (Référence, Testeur, Jeu). Le code se retrouve dans l'historique git (commits du jalon 6), si
> l'idée revient quand ces moteurs seront plus répandus.

Selector Lab est hébergé sur GitHub Pages, sans backend : l'Assistant ne peut donc ni appeler une API distante (clé exposée, coût), ni reposer sur un serveur d'inférence. Nous exécutons le modèle dans le navigateur, en essayant d'abord l'IA intégrée de Chrome (Prompt API, Gemini Nano : aucun téléchargement côté site) puis, à défaut, WebLLM sur WebGPU avec un petit modèle orienté code (famille Qwen2.5-Coder 0,5B à 1,5B, poids servis par le CDN de Hugging Face). Le chargement n'a lieu qu'après un clic explicite affichant la taille du téléchargement, et le reste du site fonctionne entièrement sans l'Assistant.

## Conséquences

- Un petit modèle se trompe souvent de syntaxe : tout Sélecteur produit par l'Assistant passe par la Validation (évaluation réelle par `querySelectorAll`, `document.evaluate` ou Testing Library) avant d'être affiché, avec un avertissement en cas d'échec.
- L'Assistant n'expose que des Actions cadrées (et un champ libre dans le Testeur seulement) plutôt qu'un chat ouvert, car un petit modèle est fiable sur un prompt contraint, pas sur une conversation générale.
- Les Indices des Niveaux sont écrits à la main ; l'Indice personnalisé n'est qu'un complément. Aucune fonctionnalité ne doit dépendre de la disponibilité de l'Assistant.
- Deux tailles de modèle WebLLM sont proposées, avec leur poids affiché avant le clic : Qwen2.5-Coder 0.5B (290 Mo, pour les machines modestes) et 1.5B (880 Mo, meilleures réponses). Le modèle tourne dans un Web Worker, et la bibliothèque WebLLM (environ 6 Mo) n'est elle-même chargée qu'après l'activation.

## Options écartées

- **API distante (Claude, OpenAI...)** : impossible sans backend pour protéger la clé.
- **transformers.js seul (repli WASM)** : fonctionne partout mais trop lent pour de la génération de texte avec un modèle utile.
- **Chrome Built-in AI seul** : zéro téléchargement, mais limité à Chrome desktop sur du matériel récent.
