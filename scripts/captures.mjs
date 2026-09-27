// Captures d'écran du README (docs/captures/). Usage : npm run build && npm run captures
// La capture de l'Assistant utilise une réponse d'illustration : aucun modèle ne tourne ici.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const port = 4323;
const base = `http://localhost:${port}/selector-lab/`;
const dossier = 'docs/captures';
mkdirSync(dossier, { recursive: true });

const serveur = spawn('npx', ['astro', 'preview', '--port', String(port), '--ignore-lock'], { stdio: 'ignore' });
try {
  for (let essai = 0; ; essai++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (essai > 50) throw new Error('Le serveur de preview ne répond pas');
    await new Promise((r) => setTimeout(r, 200));
  }

  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: 'light' });
  const capturer = async (chemin, nom, preparer) => {
    await page.goto(base + chemin);
    await page.waitForLoadState('networkidle');
    if (preparer) await preparer();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dossier}/${nom}.png` });
    console.log(`${dossier}/${nom}.png`);
  };

  await capturer('', 'accueil');
  await capturer('reference/css/logiques/', 'reference');
  await capturer('pages-exemple/panier/', 'page-exemple-panier');
  await capturer('testeur/#l=css&p=tableau&s=tr%3Ahas(.badge--suspendu)%20button', 'testeur', () =>
    page.getByText('2 nœuds').waitFor(),
  );
  await capturer('jeu/#n=frere-adjacent', 'jeu-bibliotheque', async () => {
    await page.getByRole('textbox', { name: 'Ton sélecteur CSS' }).fill('plante ~ livre');
    await page.locator('.jeu__consigne').scrollIntoViewIfNeeded();
  });
  await capturer('jeu/#n=admin-supprimer-chloe', 'jeu-scenario', async () => {
    await page.getByRole('radio', { name: 'ARIA' }).check();
    await page.locator('.jeu__consigne').scrollIntoViewIfNeeded();
  });

  // Assistant : moteur simulé, réponse d'illustration.
  await page.addInitScript(() => {
    window.__selectorLabMoteurTest = {
      id: 'test',
      nom: 'Qwen2.5-Coder 1.5B (WebLLM, dans votre navigateur)',
      async generer(_messages, options = {}) {
        const reponse = JSON.stringify({
          possible: true,
          selecteur: "getByRole('row', { name: /Chloé Durand/ }).getByRole('button', { name: 'Supprimer' })",
          explication: 'La ligne de Chloé Durand, puis son bouton **Supprimer** : le test ne dépend pas de la structure du tableau.',
        });
        options.surTexte?.(reponse);
        return reponse;
      },
    };
  });
  await page.goto(base + 'testeur/#l=aria&p=tableau&s=');
  await page.getByRole('button', { name: /Activer avec/ }).click();
  await page.getByRole('textbox', { name: /Générer un sélecteur/ }).fill('le bouton Supprimer de Chloé Durand');
  await page.getByRole('button', { name: 'Générer' }).click();
  await page.locator('.assistant__valide').waitFor();
  await page.locator('.assistant').screenshot({ path: `${dossier}/assistant.png` });
  console.log(`${dossier}/assistant.png`);

  await navigateur.close();
} finally {
  serveur.kill();
}
