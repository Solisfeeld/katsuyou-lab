/* ===================================================================
   活用ラボ — tabelas de kana usadas pelas regras do Rikai.

   O Rikai descreve as flexões do Grupo 1 em termos de "linhas" da tabela
   de hiragana: a linha /i/ (い・ち・り・に・び・み・き・ぎ・し) é a que
   aparece antes de ます, e cada forma move esse som para outra linha.
   =================================================================== */

/* Os nove kana da linha /i/ que podem preceder ます num verbo do Grupo 1.
   A ordem segue a das tabelas do Rikai (Lição 01), não a ordem gojūon. */
export const I_ROW = ['い', 'ち', 'り', 'に', 'び', 'み', 'き', 'ぎ', 'し'];

/* Linha /i/ → linha /u/ — 辞書形 (Lição 02). */
export const TO_U_ROW = {
  い: 'う', ち: 'つ', り: 'る',
  に: 'ぬ', び: 'ぶ', み: 'む',
  き: 'く', ぎ: 'ぐ', し: 'す'
};

/* Linha /i/ → linha /a/ — forma ない (Lição 15).
   ★ い é o caso especial: vira わ, e não あ. */
export const TO_A_ROW = {
  い: 'わ', ち: 'た', り: 'ら',
  に: 'な', び: 'ば', み: 'ま',
  き: 'か', ぎ: 'が', し: 'さ'
};

/* Os quatro padrões da forma て do Grupo 1 (Lição 01). O mesmo
   agrupamento vale para a forma た (Lição 13), só muda a sílaba final. */
export const TE_PATTERNS = [
  { id: 'p1', kana: ['い', 'ち', 'り'], te: 'って', ta: 'った', label: 'い・ち・り' },
  { id: 'p2', kana: ['に', 'び', 'み'], te: 'んで', ta: 'んだ', label: 'に・び・み' },
  { id: 'p3', kana: ['き'], te: 'いて', ta: 'いた', label: 'き' },
  { id: 'p4', kana: ['ぎ'], te: 'いで', ta: 'いだ', label: 'ぎ' },
  { id: 'p5', kana: ['し'], te: 'して', ta: 'した', label: 'し' }
];

/* Índice kana → padrão, para consulta direta. */
export const TE_PATTERN_BY_KANA = TE_PATTERNS.reduce((acc, p) => {
  p.kana.forEach(k => { acc[k] = p; });
  return acc;
}, {});

/* Rótulo da regra do jeito que o Rikai enuncia, usado no feedback. */
export function tePatternRule(kana, form) {
  const p = TE_PATTERN_BY_KANA[kana];
  if (!p) return null;
  /* き／ぎ são enunciados juntos no Rikai ("き／ぎ → いて／いで"), mas no
     feedback de um verbo concreto só interessa o caminho percorrido. */
  return `${p.label} → ${form === 'ta' ? p.ta : p.te}`;
}

/* Relação て ↔ た que o Rikai pede para o aluno perceber (Lição 13:
   "utilizaremos o mesmo processo"). */
export const TE_TO_TA = { って: 'った', んで: 'んだ', いて: 'いた', いで: 'いだ', して: 'した' };

export const MASU = 'ます';
