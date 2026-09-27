import { expect, test, type Page } from '@playwright/test';

const apercu = (page: Page) => page.frameLocator('iframe[title="Aperçu du Document cible"]');
const resultat = (page: Page) => page.getByRole('region', { name: 'Résultat' });
const champSelecteur = (page: Page) => page.getByRole('textbox', { name: 'Sélecteur', exact: true });

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

test("le marquage n'est jamais visible par le sélecteur suivant", async ({ page }) => {
  await page.goto(lien({ l: 'css', p: 'article', s: 'h2' }));
  await expect(resultat(page)).toContainText('5 nœuds');

  await champSelecteur(page).fill('[data-selector-lab], style');
  await expect(resultat(page)).toContainText('Aucun nœud');
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

test('évalue une Requête ARIA chaînée venue d\'un lien, sans confirmation', async ({ page }) => {
  await page.goto(
    lien({ l: 'aria', p: 'tableau', s: "getByRole('row', { name: /Chloé Durand/ }).getByRole('button', { name: 'Supprimer' })" }),
  );

  await expect(page.getByRole('radio', { name: 'ARIA' })).toBeChecked();
  await expect(resultat(page)).toContainText('button "Supprimer" dans tr[data-id="u3"]');
  await expect(apercu(page).locator('[data-selector-lab]')).toHaveCount(1);
});
