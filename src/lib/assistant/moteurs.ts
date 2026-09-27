/**
 * Moteurs de l'Assistant (voir ADR 0001) : l'IA intégrée de Chrome (Prompt API, Gemini Nano) si elle est
 * disponible, sinon WebLLM sur WebGPU avec un petit modèle Qwen2.5-Coder, téléchargé à la demande.
 * Rien n'est chargé tant que le visiteur n'a pas cliqué sur « Activer ».
 */

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OptionsGeneration {
  /** Schéma JSON imposé à la réponse (sortie structurée). */
  schema?: Record<string, unknown>;
  signal?: AbortSignal;
  /** Appelé à chaque morceau reçu, avec le texte cumulé. */
  surTexte?: (texte: string) => void;
}

export interface Moteur {
  id: 'chrome' | 'webllm' | 'test';
  nom: string;
  generer(messages: Message[], options?: OptionsGeneration): Promise<string>;
}

export type ChoixModele = 'leger' | 'standard';

export const MODELES: Record<ChoixModele, { id: string; nom: string; taille: string }> = {
  leger: { id: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC', nom: 'Qwen2.5-Coder 0.5B', taille: '290 Mo' },
  standard: { id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', nom: 'Qwen2.5-Coder 1.5B', taille: '880 Mo' },
};

export type DisponibiliteChrome = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'absent';

export interface Disponibilite {
  chrome: DisponibiliteChrome;
  webgpu: boolean;
}

/** Point d'injection des tests : un moteur simulé, pour vérifier l'interface sans modèle réel. */
function moteurDeTest(): Moteur | undefined {
  return (globalThis as { __selectorLabMoteurTest?: Moteur }).__selectorLabMoteurTest;
}

const OPTIONS_LANGUES = {
  expectedInputs: [{ type: 'text' as const, languages: ['fr', 'en'] }],
  expectedOutputs: [{ type: 'text' as const, languages: ['fr'] }],
};

export async function detecter(): Promise<Disponibilite> {
  if (moteurDeTest()) return { chrome: 'available', webgpu: false };
  let chrome: DisponibiliteChrome = 'absent';
  try {
    if ('LanguageModel' in globalThis) chrome = await LanguageModel.availability(OPTIONS_LANGUES);
  } catch {
    chrome = 'unavailable';
  }
  let webgpu = false;
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    webgpu = !!gpu && !!(await gpu.requestAdapter());
  } catch {
    webgpu = false;
  }
  return { chrome, webgpu };
}

async function lireFlux(flux: ReadableStream<string>, surTexte?: (t: string) => void): Promise<string> {
  let texte = '';
  const lecteur = flux.getReader();
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) return texte;
    texte += value;
    surTexte?.(texte);
  }
}

export async function creerMoteurChrome(surProgression: (fraction: number) => void): Promise<Moteur> {
  const test = moteurDeTest();
  if (test) return test;
  // Une première session déclenche le téléchargement du modèle par Chrome, si nécessaire.
  const amorce = await LanguageModel.create({
    ...OPTIONS_LANGUES,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => surProgression((e as ProgressEvent).loaded));
    },
  });
  amorce.destroy();
  return {
    id: 'chrome',
    nom: 'IA intégrée de Chrome (Gemini Nano)',
    async generer(messages, options = {}) {
      const systeme = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      const suite = messages.filter((m) => m.role !== 'system');
      const derniere = suite.pop()!;
      const session = await LanguageModel.create({
        ...OPTIONS_LANGUES,
        initialPrompts: [{ role: 'system', content: systeme }, ...suite.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))],
      });
      try {
        const flux = session.promptStreaming(derniere.content, { responseConstraint: options.schema, signal: options.signal });
        return await lireFlux(flux, options.surTexte);
      } finally {
        session.destroy();
      }
    },
  };
}

export async function creerMoteurWebLLM(choix: ChoixModele, surProgression: (fraction: number, texte: string) => void): Promise<Moteur> {
  const test = moteurDeTest();
  if (test) return test;
  // Import dynamique : la bibliothèque (plusieurs Mo) n'est chargée qu'après le clic d'activation.
  const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
  const modele = MODELES[choix];
  const travailleur = new Worker(new URL('./travailleur.ts', import.meta.url), { type: 'module' });
  const moteur = await CreateWebWorkerMLCEngine(travailleur, modele.id, {
    initProgressCallback: (p) => surProgression(p.progress, p.text),
  });
  return {
    id: 'webllm',
    nom: `${modele.nom} (WebLLM, dans votre navigateur)`,
    async generer(messages, options = {}) {
      const arreter = () => moteur.interruptGenerate();
      options.signal?.addEventListener('abort', arreter, { once: true });
      try {
        const flux = await moteur.chat.completions.create({
          messages,
          stream: true,
          temperature: 0.2,
          max_tokens: 450,
          response_format: options.schema ? { type: 'json_object', schema: JSON.stringify(options.schema) } : undefined,
        });
        let texte = '';
        for await (const morceau of flux) {
          texte += morceau.choices[0]?.delta?.content ?? '';
          options.surTexte?.(texte);
        }
        return texte;
      } finally {
        options.signal?.removeEventListener('abort', arreter);
      }
    },
  };
}
