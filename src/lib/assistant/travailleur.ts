/// <reference lib="webworker" />
// Le modèle WebLLM tourne dans un Web Worker, pour ne jamais bloquer la page pendant la génération.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const gestionnaire = new WebWorkerMLCEngineHandler();
self.onmessage = (message: MessageEvent) => gestionnaire.onmessage(message);
