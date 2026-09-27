import { expect, test, type Page } from '@playwright/test';

// Aucun modèle réel en CI : un moteur simulé est injecté avant le chargement de la page. Il renvoie
// la réponse préparée par le test, comme le ferait un modèle (texte libre ou JSON structuré).
async function simulerMoteur(page: Page, reponse: string) {
  await page.addInitScript((texte) => {
    (window as unknown as { __selectorLabMoteurTest: unknown }).__selectorLabMoteurTest = {
      id: 'test',
      nom: 'Moteur simulé',
      async generer(_messages: unknown, options: { surTexte?: (t: string) => void } = {}) {
        options.surTexte?.(texte);
        return texte;
      },
    };
  }, reponse);
}

async function activer(page: Page) {
  const assistant = page.getByRole('region', { name: 'Assistant' });
  await assistant.getByRole('button', { name: /Activer avec l'IA intégrée de Chrome/ }).click();
  await expect(assistant).toContainText('Moteur simulé');
  return assistant;
}

const lienTesteur = (params: Record<string, string>) => `testeur/#${new URLSearchParams(params).toString()}`;

test("rien n'est téléchargé ni envoyé hors du site tant que l'Assistant n'est pas activé", async ({ page, baseURL }) => {
  const origine = new URL(baseURL!).origin;
  const externes: string[] = [];
  page.on('request', (r) => {
    const adresse = r.url();
    if (!adresse.startsWith(origine) && !adresse.startsWith('data:') && !adresse.startsWith('about:')) externes.push(adresse);
  });
  await page.goto(lienTesteur({ l: 'css', p: 'tableau', s: 'tbody tr' }));
  await expect(page.getByRole('region', { name: 'Résultat' })).toContainText('5 nœuds');
  await page.goto('jeu/#n=type');
  await expect(page.getByText(/^Niveau 1 \/ \d+$/)).toBeVisible();

  expect(externes).toEqual([]);
});

test("l'explication de l'Assistant est affichée sans jamais interpréter de HTML", async ({ page }) => {
  await simulerMoteur(page, 'Ce sélecteur trouve les `tr` du corps. <img src=x onerror="parent.piratage=1">');
  await page.goto(lienTesteur({ l: 'css', p: 'tableau', s: 'tbody tr' }));
  const assistant = await activer(page);

  await assistant.getByRole('button', { name: 'Expliquer' }).click();
  await expect(assistant.locator('.assistant__sortie code')).toHaveText('tr');
  await expect(assistant.locator('.assistant__sortie img')).toHaveCount(0);
  await expect(assistant).toContainText('<img src=x');
});

test('un sélecteur généré et validé peut être utilisé dans le Testeur', async ({ page }) => {
  await simulerMoteur(page, JSON.stringify({ possible: true, selecteur: 'tr:has(.badge--suspendu)', explication: 'La ligne au badge Suspendu.' }));
  await page.goto(lienTesteur({ l: 'css', p: 'tableau', s: '' }));
  const assistant = await activer(page);

  await assistant.getByRole('textbox', { name: /Générer un sélecteur CSS/ }).fill('la ligne suspendue');
  await assistant.getByRole('button', { name: 'Générer' }).click();
  await expect(assistant).toContainText('Vérifié par votre navigateur : 1 élément trouvé.');

  await assistant.getByRole('button', { name: 'Utiliser ce sélecteur' }).click();
  await expect(page.getByRole('textbox', { name: 'Sélecteur', exact: true })).toHaveValue('tr:has(.badge--suspendu)');
  await expect(page.getByRole('region', { name: 'Résultat' })).toContainText('tr "Chloé Durand');
});

test('un Indice personnalisé qui dévoile la solution est remplacé par un Indice écrit à la main', async ({ page }) => {
  await simulerMoteur(page, 'Écris simplement `//livre` et le tour est joué.');
  await page.goto('jeu/#n=type');
  await page.getByRole('radio', { name: 'XPath 1.0' }).check();
  const champ = page.getByRole('textbox', { name: 'Ton expression XPath' });
  await champ.fill('//etagere/*');
  await champ.press('Enter');

  await page.getByRole('button', { name: "Activer l'Assistant pour des Indices personnalisés" }).click();
  await page.getByRole('button', { name: /Activer avec l'IA intégrée de Chrome/ }).click();
  await page.getByRole('button', { name: 'Indice personnalisé' }).click();

  await expect(page.getByText("L'Assistant allait dévoiler la solution")).toBeVisible();
  await expect(page.getByText('Indice 1')).toBeVisible();
  await expect(page.getByText('tour est joué')).toHaveCount(0);
});
