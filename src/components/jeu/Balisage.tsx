/** Le code HTML de la Scène, synchronisé au survol avec le rendu visuel. */

export interface NoeudBalisage {
  index: number;
  balise: string;
  attributs: [string, string][];
  texte: string;
  enfants: NoeudBalisage[];
}

/** Arbre des éléments de la Scène ; `index` est la position dans `body.querySelectorAll('*')`. */
export function arbre(doc: Document): NoeudBalisage[] {
  let compteur = 0;
  const lire = (el: Element): NoeudBalisage => {
    const index = compteur++;
    const texte = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.nodeValue ?? '')
      .join('')
      .trim();
    return {
      index,
      balise: el.localName,
      attributs: Array.from(el.attributes)
        .filter((a) => !a.name.startsWith('data-jeu-'))
        .map((a) => [a.name, a.value]),
      texte,
      enfants: Array.from(el.children).map(lire),
    };
  };
  return doc.body ? Array.from(doc.body.children).map(lire) : [];
}

function Ouvrante({ n }: { n: NoeudBalisage }) {
  return (
    <>
      <span class="b-ponct">&lt;</span>
      <span class="b-balise">{n.balise}</span>
      {n.attributs.map(([nom, valeur]) => (
        <>
          {' '}
          <span class="b-attr">{nom}</span>
          <span class="b-ponct">="</span>
          <span class="b-valeur">{valeur}</span>
          <span class="b-ponct">"</span>
        </>
      ))}
      <span class="b-ponct">&gt;</span>
    </>
  );
}

function Fermante({ n }: { n: NoeudBalisage }) {
  return (
    <>
      <span class="b-ponct">&lt;/</span>
      <span class="b-balise">{n.balise}</span>
      <span class="b-ponct">&gt;</span>
    </>
  );
}

interface Props {
  noeuds: NoeudBalisage[];
  survol: number | null;
  trouves: Set<number>;
  onSurvol: (index: number | null) => void;
}

export function Balisage({ noeuds, survol, trouves, onSurvol }: Props) {
  const rendre = (n: NoeudBalisage) => {
    const classes = ['b-noeud', survol === n.index && 'b-noeud--survol', trouves.has(n.index) && 'b-noeud--trouve']
      .filter(Boolean)
      .join(' ');
    const evenements = {
      onMouseOver: (e: MouseEvent) => {
        e.stopPropagation();
        onSurvol(n.index);
      },
    };
    if (n.enfants.length === 0) {
      return (
        <div class={classes} {...evenements}>
          <Ouvrante n={n} />
          <span class="b-texte">{n.texte}</span>
          <Fermante n={n} />
        </div>
      );
    }
    return (
      <div class={classes} {...evenements}>
        <Ouvrante n={n} />
        {n.texte && <span class="b-texte">{n.texte}</span>}
        <div class="b-enfants">{n.enfants.map(rendre)}</div>
        <Fermante n={n} />
      </div>
    );
  };
  return (
    <pre class="balisage" onMouseLeave={() => onSurvol(null)}>
      <code>{noeuds.map(rendre)}</code>
    </pre>
  );
}
