// Remplit le champ `attendu` des Exemples qui n'en ont pas, à partir de l'évaluation dans Chromium.
// Usage : npm run build && npm run attendus [-- --tout]
// Chaque résultat écrit doit être relu : la CI vérifie ensuite qu'il est identique dans Firefox et WebKit.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { parseDocument, visit } from 'yaml';

const tout = process.argv.includes('--tout');
const port = 4322;
const base = `http://localhost:${port}/selector-lab/`;

const serveur = spawn('npx', ['astro', 'preview', '--port', String(port), '--ignore-lock'], { stdio: 'ignore' });
try {
  for (let essai = 0; ; essai++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (essai > 50) throw new Error('Le serveur de preview ne répond pas');
    await new Promise((r) => setTimeout(r, 200));
  }

  const exemples = await (await fetch(`${base}exemples.json`)).json();
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  await page.goto(`${base}verification/`);
  await page.waitForSelector('body[data-pret="oui"]', { state: 'attached' });
  const obtenus = await page.evaluate(
    (liste) => liste.map((e) => window.selectorLab.verifier(e.page, e.langage, e.selecteur)),
    exemples,
  );
  await navigateur.close();

  const fichiers = new Map();
  const doc = (chemin) => {
    if (!fichiers.has(chemin)) fichiers.set(chemin, parseDocument(readFileSync(chemin, 'utf8')));
    return fichiers.get(chemin);
  };

  let modifies = 0;
  exemples.forEach((ex, i) => {
    const obtenu = obtenus[i];
    if (ex.attendu && !tout) return;
    if (ex.attendu && JSON.stringify(ex.attendu) === JSON.stringify(obtenu)) return;

    const [source, reste] = ex.cle.split('#');
    let yaml;
    let noeud;
    if (source === 'comparaison') {
      const [id, langage] = reste.split('/');
      yaml = doc('src/content/comparaison.yaml');
      const index = yaml.contents.items.findIndex((it) => it.get('id') === id);
      noeud = yaml.getIn([index]);
      // Les deux colonnes partagent un seul attendu : on ne l'écrit qu'une fois, depuis CSS si possible.
      if (langage === 'xpath' && noeud.get('css') && noeud.get('attendu')) return;
    } else {
      const [entreeId, numero] = reste.split('/');
      yaml = doc(`src/content/reference/${source}.yaml`);
      const entrees = yaml.get('entrees');
      const index = entrees.items.findIndex((it) => it.get('id') === entreeId);
      noeud = yaml.getIn(['entrees', index, 'exemples', Number(numero) - 1]);
    }
    const attendu = yaml.createNode(obtenu, { flow: true });
    // Guillemets forcés : sans eux, YAML relirait « 2026-03-14 » comme une date et « 03 » comme un nombre.
    visit(attendu, {
      Scalar(cle, scalaire) {
        if (cle !== 'key' && typeof scalaire.value === 'string') scalaire.type = 'QUOTE_DOUBLE';
      },
    });
    noeud.set('attendu', attendu);
    modifies++;
    console.log(`${ex.cle}\n  ${ex.langage}: ${ex.selecteur}\n  => ${JSON.stringify(obtenu)}`);
  });

  for (const [chemin, yaml] of fichiers) writeFileSync(chemin, yaml.toString({ lineWidth: 0 }));
  console.log(`\n${modifies} résultat(s) écrit(s).`);
} finally {
  serveur.kill();
}
