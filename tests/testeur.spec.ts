import { expect, test, type Page } from '@playwright/test';

const apercu = (page: Page) => page.frameLocator('iframe[title="Aperçu du Document cible"]');
const resultat = (page: Page) => page.getByRole('region', { name: 'Résultat' });
const champSelecteur = (page: Page) => page.getByRole('textbox', { name: 'Sélecteur' });

function lien(params: Record<string, string>): string {
  return `testeur/#${new URLSearchParams(params).toString()}`;
}

test('évalue un sélecteur CSS venu du lien, surligne les nœuds et analyse le support', async ({ page }) => {
  await page.goto(lien({ l: 'css', p: 'tableau', s: 'tr:has(.badge--suspendu) button' }));

  await expect(page.getByRole('radio', { name: 'CSS' })).toBeChecked();
  await expect(champSelecteur(page)).toHaveValue('tr:has(.badge--suspendu) button');
  await expect(resultat(page)).toContainText('2 nœuds');
  await expect(resultat(page)).toContainText('button "Supprimer" dans tr[data-id="u3"]');
  await expect(apercu(page).locator('[data-selector-lab]')).toHaveCount(2);

  const analyse = page.getByRole('region', { name: 'Analyse du sélecteur' });
  await expect(analyse.getByRole('link', { name: ':has()' })).toHaveAttribute('href', /reference\/css\/logiques\/#has$/);
  await expect(analyse).toContainText('Firefox');
});

test('affiche un Résultat typé XPath et met à jour le lien de partage', async ({ page }) => {
  await page.goto(lien({ l: 'css', p: 'tableau', s: '' }));
  await page.getByRole('radio', { name: 'XPath 1.0' }).check();
  await champSelecteur(page).fill('count(//tbody/tr)');

  await expect(resultat(page)).toContainText('Nombre : 5');
  await expect(page).toHaveURL(/l=xpath/);
  await expect(page).toHaveURL(/s=count/);
});

test('explique pourquoi une fonction XPath 2.0 échoue', async ({ page }) => {
  await page.goto(lien({ l: 'xpath', p: 'formulaire', s: "//input[lower-case(@name) = 'motdepasse']" }));

  await expect(resultat(page)).toContainText('Erreur');
  await expect(resultat(page).getByRole('link', { name: 'Voir les équivalents en XPath 1.0' })).toBeVisible();
});

test("signale une expression XPath relative qui ne trouve rien", async ({ page }) => {
  await page.goto(lien({ l: 'xpath', p: 'formulaire', s: 'button' }));

  await expect(resultat(page)).toContainText('Aucun nœud');
  await expect(resultat(page)).toContainText('Commencez par //');
});

test('clique sur un nœud du résultat pour le mettre en évidence', async ({ page }) => {
  await page.goto(lien({ l: 'css', p: 'panier', s: '.article h2' }));
  await resultat(page).getByRole('button', { name: 'h2 "Azul"' }).click();

  await expect(apercu(page).locator('[data-selector-lab="actif"]')).toHaveText('Azul');
});

test("le marquage n'est jamais visible par le sélecteur suivant", async ({ page }) => {
  await page.goto(lien({ l: 'css', p: 'article', s: 'h2' }));
  await expect(resultat(page)).toContainText('5 nœuds');

  await champSelecteur(page).fill('[data-selector-lab], style');
  await expect(resultat(page)).toContainText('Aucun nœud');
});

test('le bouton Essayer de la Référence ouvre le Testeur pré-rempli', async ({ page }) => {
  await page.goto('reference/xpath/axes/');
  await page.getByRole('link', { name: "Essayer //span[.='Suspendu']/ancestor::tr dans le Testeur" }).click();

  await expect(page).toHaveURL(/testeur\//);
  await expect(page.getByRole('radio', { name: 'XPath 1.0' })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Document cible' })).toHaveValue('tableau');
  await expect(resultat(page)).toContainText('tr "Chloé Durand');
});

test("évalue un HTML collé sans jamais exécuter ses scripts", async ({ page }) => {
  await page.goto(lien({ l: 'css', p: 'formulaire', s: '.cible' }));
  await page.getByRole('combobox', { name: 'Document cible' }).selectOption({ label: 'Mon HTML (coller le code)' });
  await page
    .getByRole('textbox', { name: 'Mon HTML' })
    .fill('<p class="cible">Bonjour</p><img src="x" onerror="parent.piratage = true"><script>parent.piratage = true</script>');

  await expect(resultat(page)).toContainText('p "Bonjour"');
  expect(await page.evaluate(() => (window as unknown as { piratage?: boolean }).piratage)).toBeUndefined();
  // Le HTML collé voyage dans le lien, compressé.
  await expect(page).toHaveURL(/h=/);
});

test("n'exécute une expression JavaScript venue d'un lien qu'après confirmation", async ({ page }) => {
  await page.goto(lien({ l: 'dom', p: 'formulaire', s: "document.querySelector('#email').closest('fieldset')" }));

  const alerte = page.getByRole('alert');
  await expect(alerte).toContainText('Ce lien contient une expression JavaScript');
  await expect(resultat(page)).toContainText("Saisissez un sélecteur");

  await alerte.getByRole('button', { name: "Évaluer l'expression" }).click();
  await expect(resultat(page)).toContainText('fieldset "Identité');
});

test('restaure le document après une expression qui le modifie', async ({ page }) => {
  await page.goto(lien({ l: 'dom', p: 'panier', s: '' }));
  await champSelecteur(page).fill("document.querySelector('.article').remove()");
  await expect(resultat(page)).toContainText('Aucun nœud');

  await page.getByRole('radio', { name: 'CSS' }).check();
  await champSelecteur(page).fill('li.article');
  await expect(resultat(page)).toContainText('3 nœuds');
});
