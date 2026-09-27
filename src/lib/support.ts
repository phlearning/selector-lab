/**
 * Support navigateur d'une Entrée de référence, calculé au build à partir des données
 * de compatibilité MDN (@mdn/browser-compat-data) et du statut Baseline (web-features).
 */
import bcd from '@mdn/browser-compat-data' with { type: 'json' };
import { features } from 'web-features';

export const navigateurs = [
  { id: 'chrome', nom: 'Chrome' },
  { id: 'edge', nom: 'Edge' },
  { id: 'firefox', nom: 'Firefox' },
  { id: 'safari', nom: 'Safari' },
  { id: 'chrome_android', nom: 'Chrome Android' },
  { id: 'safari_ios', nom: 'Safari iOS' },
] as const;

export interface SupportParNavigateur {
  id: string;
  nom: string;
  /** Version d'introduction, `null` si non supporté. */
  version: string | null;
  partiel: boolean;
}

export interface Baseline {
  statut: 'high' | 'low' | false;
  depuis?: string;
  largementDepuis?: string;
}

export interface SupportNavigateur {
  cle: string;
  description?: string;
  mdnUrl?: string;
  specUrl?: string;
  navigateurs: SupportParNavigateur[];
  baseline: Baseline | null;
}

interface Declaration {
  version_added: string | boolean | null;
  version_removed?: string | boolean | null;
  flags?: unknown[];
  prefix?: string;
  alternative_name?: string;
  partial_implementation?: boolean;
}

function compatDe(cle: string): Record<string, unknown> & { __compat?: any } {
  let noeud: any = bcd;
  for (const morceau of cle.split('.')) {
    noeud = noeud?.[morceau];
    if (!noeud) throw new Error(`Clé BCD inconnue : ${cle}`);
  }
  if (!noeud.__compat) throw new Error(`Clé BCD sans données de compatibilité : ${cle}`);
  return noeud;
}

function versionDe(declarations: Declaration | Declaration[] | undefined): { version: string | null; partiel: boolean } {
  const liste = declarations ? (Array.isArray(declarations) ? declarations : [declarations]) : [];
  // On ne retient que le support standard : ni drapeau, ni préfixe, ni nom alternatif, ni retrait.
  const utile = liste.find((d) => !d.flags && !d.prefix && !d.alternative_name && !d.version_removed);
  if (!utile || utile.version_added === false || utile.version_added === null) return { version: null, partiel: false };
  const version = utile.version_added === true ? 'oui' : String(utile.version_added).replace('≤', '≤ ');
  return { version, partiel: !!utile.partial_implementation };
}

function baselineDe(cle: string): Baseline | null {
  for (const feature of Object.values(features)) {
    if (feature.kind !== 'feature' || !feature.compat_features?.includes(cle)) continue;
    const statut = feature.status.by_compat_key?.[cle] ?? feature.status;
    return {
      statut: statut.baseline === 'high' || statut.baseline === 'low' ? statut.baseline : false,
      depuis: statut.baseline_low_date,
      largementDepuis: statut.baseline_high_date,
    };
  }
  return null;
}

export function support(cle: string): SupportNavigateur {
  const compat = compatDe(cle).__compat;
  return {
    cle,
    description: compat.description,
    mdnUrl: compat.mdn_url,
    specUrl: Array.isArray(compat.spec_url) ? compat.spec_url[0] : compat.spec_url,
    navigateurs: navigateurs.map((n) => ({ ...n, ...versionDe(compat.support[n.id]) })),
    baseline: baselineDe(cle),
  };
}

export const versionBcd: string = bcd.__meta.version;
