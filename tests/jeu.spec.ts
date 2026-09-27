import { expect, test, type Page } from '@playwright/test';

const scene = (page: Page) => page.frameLocator('iframe[title^="Scène du Niveau"]');

async function repondre(page: Page, reponse: string) {
  const champ = page.getByRole('textbox', { name: /^(Ton sélecteur CSS|Ton expression XPath|Ta requête ARIA)$/ });
  await champ.fill(reponse);
  await champ.press('Enter');
}

// Chaque test a son propre contexte de navigateur : il part donc d'une Progression vierge.

test('réussir un Niveau en CSS, puis retrouver sa Progression après rechargement', async ({ page }) => {
  await page.goto('jeu/#n=type');
  await expect(page.getByRole('heading', { name: "Sélectionne tous les livres de l'étagère." })).toBeVisible();
  await expect(scene(page).locator('[data-jeu-cible]')).toHaveCount(3);

  await repondre(page, 'etagere > *');
  await expect(page.getByText('Ta réponse trouve 4 éléments, il en faut 3 (1 en trop).')).toBeVisible();

  await repondre(page, 'livre');
  await expect(page.getByText('Bravo !')).toBeVisible();
  await expect(page.getByRole('link', { name: 'En savoir plus dans la Référence' })).toHaveAttribute('href', /reference\/css\/bases\/#type$/);

  await page.reload();
  await expect(page.getByText(/^1 \/ \d+ Niveaux réussis en CSS$/)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Niveaux' }).getByRole('button', { name: /Tous les livres/ })).toContainText('✓');
});

test('un Niveau XPath uniquement se joue en XPath même en Mode CSS', async ({ page }) => {
  await page.goto('jeu/#n=ancetre');
  await expect(page.getByText('XPath 1.0 uniquement')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Ton expression XPath' })).toBeVisible();

  await repondre(page, "//livre[.='Dune']/..");
  await expect(page.getByText('Ta réponse trouve 1 élément, il en faut 1 (1 en trop, 1 manquant).')).toBeVisible();

  await repondre(page, "//livre[.='Dune']/ancestor::etagere");
  await expect(page.getByText('Bravo !')).toBeVisible();
});

test("une expression qui ne lit pas la Scène n'est pas acceptée", async ({ page }) => {
  await page.goto('jeu/#n=compter');
  await repondre(page, '3');
  await expect(page.getByText('Ta réponse ne lit pas la Scène')).toBeVisible();

  await repondre(page, "count(//livre[@genre='sf'])");
  await expect(page.getByText('Bravo !')).toBeVisible();
});

test('les marques du Jeu ne sont jamais sélectionnables', async ({ page }) => {
  await page.goto('jeu/#n=type');
  await expect(scene(page).locator('[data-jeu-cible]')).toHaveCount(3);

  await repondre(page, '[data-jeu-cible]');
  await expect(page.getByText('Ta réponse ne trouve aucun élément, il en faut 3.')).toBeVisible();
});

test('un Scénario e2e se joue avec une Requête ARIA chaînée', async ({ page }) => {
  await page.goto('jeu/#n=admin-supprimer-chloe');
  await page.getByRole('radio', { name: 'ARIA' }).check();
  await expect(page.getByText('ARIA recommandé en e2e')).toBeVisible();
  await expect(scene(page).locator('[data-jeu-cible]')).toHaveCount(1);

  await repondre(page, "getByRole('button', { name: 'Supprimer' })");
  await expect(page.getByText('Ta réponse trouve 4 éléments, il en faut 1 (3 en trop).')).toBeVisible();

  await repondre(page, "getByRole('row', { name: /Chloé Durand/ }).getByRole('button', { name: 'Supprimer' })");
  await expect(page.getByText('Bravo !')).toBeVisible();
});
