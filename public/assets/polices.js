/* Polices de la maison (fichiers dans public/fonts, licence SIL OFL) :
   titres et nom de la maison en Bodoni Moda (didone de joaillerie), texte en Hanken Grotesk. */
export const POLICES = {
  maison: {
    titres: '"Bodoni Moda","Didot","Bodoni 72",Georgia,serif',
    texte: '"Hanken Grotesk","Helvetica Neue",Arial,sans-serif',
    fichiers: [
      ['Bodoni Moda', 400, 'bodoni-moda-latin-400-normal.woff2', 'normal'],
      ['Bodoni Moda', 400, 'bodoni-moda-latin-400-italic.woff2', 'italic'],
      ['Bodoni Moda', 500, 'bodoni-moda-latin-500-normal.woff2', 'normal'],
      ['Hanken Grotesk', 400, 'hanken-grotesk-latin-400-normal.woff2', 'normal'],
      ['Hanken Grotesk', 500, 'hanken-grotesk-latin-500-normal.woff2', 'normal'],
      ['Hanken Grotesk', 600, 'hanken-grotesk-latin-600-normal.woff2', 'normal'],
    ],
  },
};

export function cssPolices(url) {
  const P = POLICES.maison;
  return P.fichiers.map(([fam, w, f, st]) => `@font-face{font-family:"${fam}";font-weight:${w};font-style:${st};font-display:swap;src:url(${url(f)}) format("woff2")}`).join('\n')
    + `\n:root{--titres:${P.titres};--texte:${P.texte}}`;
}
