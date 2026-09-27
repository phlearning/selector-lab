import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const langage = z.enum(['css', 'xpath', 'dom']);
const page = z.enum(['formulaire', 'tableau', 'panier', 'article']);

/** Résultat typé attendu d'un Exemple (voir CONTEXT.md). */
const attendu = z.union([
  z.object({ noeuds: z.array(z.string()) }).strict(),
  z.object({ nombre: z.number() }).strict(),
  z.object({ chaine: z.string() }).strict(),
  z.object({ booleen: z.boolean() }).strict(),
  z.object({ erreur: z.literal(true) }).strict(),
]);

const exemple = z.object({
  selecteur: z.string(),
  langage: langage.optional(),
  page,
  note: z.string().optional(),
  attendu: attendu.optional(),
});

const entree = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  titre: z.string(),
  syntaxe: z.string().optional(),
  resume: z.string(),
  bcd: z.union([z.string(), z.array(z.string())]).optional(),
  statut: z.enum(['standard', 'absent', 'devtools']).default('standard'),
  spec: z.url().optional(),
  exemples: z.array(exemple).default([]),
  pieges: z.array(z.string()).default([]),
});

const reference = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/reference' }),
  schema: z.object({
    titre: z.string(),
    langage,
    ordre: z.number(),
    intro: z.string(),
    entrees: z.array(entree),
  }),
});

const comparaison = defineCollection({
  loader: file('./src/content/comparaison.yaml'),
  schema: z.object({
    tache: z.string(),
    page,
    css: z.string().nullable(),
    xpath: z.string().nullable(),
    note: z.string().optional(),
    attendu: attendu.optional(),
  }),
});

export const collections = { reference, comparaison };
