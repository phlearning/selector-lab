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

test('Entrée après une Réussite passe au Niveau suivant', async ({ page }) => {
  await page.goto('jeu/#n=type');
  await repondre(page, 'livre');
  await expect(page.getByText('Bravo !')).toBeVisible();
  await page.getByRole('button', { name: 'Niveau suivant', exact: true }).press('Enter');

  await expect(page.getByText(/^Niveau 2 \/ \d+$/)).toBeVisible();
  await expect(page).toHaveURL(/#n=id$/);
});

test('le même Niveau se joue en Mode XPath', async ({ page }) => {
  await page.goto('jeu/#n=has');
  await page.getByRole('radio', { name: 'XPath 1.0' }).check();
  await repondre(page, '//livre[marque-page]');

  await expect(page.getByText('Bravo !')).toBeVisible();
  await expect(page.getByText(/^1 \/ \d+ Niveaux réussis en XPath 1\.0$/)).toBeVisible();
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

test("le type de résultat attendu est expliqué", async ({ page }) => {
  await page.goto('jeu/#n=compter');
  await repondre(page, "//livre[@genre='sf']");
  await expect(page.getByText('Ta réponse renvoie 3 éléments, mais le résultat attendu est un nombre.')).toBeVisible();
});

test('les Indices se dévoilent un par un', async ({ page }) => {
  await page.goto('jeu/#n=frere-adjacent');
  await page.getByRole('button', { name: 'Afficher un indice (1/3)' }).click();
  await expect(page.getByText('Indice 1')).toBeVisible();
  await expect(page.getByText('Indice 2')).toBeHidden();

  await page.getByRole('button', { name: 'Indice suivant (2/3)' }).click();
  await expect(page.getByText('Indice 2')).toBeVisible();
});

test('les marques du Jeu ne sont jamais sélectionnables', async ({ page }) => {
  await page.goto('jeu/#n=type');
  await expect(scene(page).locator('[data-jeu-cible]')).toHaveCount(3);

  await repondre(page, '[data-jeu-cible]');
  await expect(page.getByText('Ta réponse ne trouve aucun élément, il en faut 3.')).toBeVisible();
});

test('le survol de la Scène met en évidence le code HTML', async ({ page }) => {
  await page.goto('jeu/#n=type');
  // Les cibles s'agitent en continu : on force le survol sans attendre qu'elles soient immobiles.
  await scene(page).locator('livre').first().hover({ force: true });

  await expect(page.locator('.b-noeud--survol')).toContainText('Dune');
  await expect(page.locator('.jeu__survol')).toHaveText('<livre genre="sf">');
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

test("le Mode ARIA se replie sur CSS dans la bibliothèque, qui n'a pas de rôles", async ({ page }) => {
  await page.goto('jeu/#n=type');
  await page.getByRole('radio', { name: 'ARIA' }).check();

  await expect(page.getByText("la bibliothèque n'a ni rôles ni noms accessibles")).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Ton sélecteur CSS' })).toBeVisible();
});

test("un clic dans une Page d'exemple ne quitte pas le Jeu", async ({ page }) => {
  await page.goto('jeu/#n=inscription-cgu');
  await scene(page).getByRole('link', { name: "conditions d'utilisation" }).click({ force: true });

  await expect(scene(page).getByRole('heading', { name: 'Créer un compte' })).toBeVisible();
});
