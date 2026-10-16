/* ===================================================================
   活用ラボ — registro das fontes Rikai auditadas.

   Cada entrada aqui foi confirmada lendo o PDF correspondente em
   ../../../03ふくしゅう_Basico1Rikai/. Nada neste projeto pode citar
   uma lição que não esteja declarada abaixo: o check-content falha se
   um verbo ou uma forma apontar para uma lição inexistente.
   =================================================================== */

export const COURSE = 'Básico Rikai';

const DIR = '03ふくしゅう_Basico1Rikai';

/* Atalho para as lições regulares do Básico 1 (A2) Rikai — as que dão
   origem ao vocabulário verbal, sem ensinar flexão. */
const l = (n, title) => ({
  id: `L${String(n).padStart(2, '0')}`,
  number: n,
  label: `Lição ${String(n).padStart(2, '0')}`,
  title,
  file: `${DIR}/Licao${String(n).padStart(2, '0')}_Basico1Rikai.pdf`,
  teaches: []
});

/* As lições do Básico 1 (A2) Rikai que este projeto usa. As quatro
   apostilas de flexão têm arquivo próprio e são declaradas à mão;
   as demais entram pelo atalho acima porque só fornecem vocabulário.
   `file` é o PDF de origem, relativo à raiz do repositório de estudo. */
export const LESSONS = {
  L01: {
    id: 'L01',
    number: 1,
    label: 'Lição 01',
    title: 'Verbos e suas flexões na língua japonesa 1',
    file: `${DIR}/Licao01_verbos1_formaTE_Basico1Rikai.pdf`,
    teaches: ['groups', 'te']
  },
  L02: {
    id: 'L02',
    number: 2,
    label: 'Lição 02',
    title: 'Verbos e suas flexões na língua japonesa 2',
    file: `${DIR}/Licao02_verbos2_formaRU_Basico1Rikai.pdf`,
    teaches: ['groups', 'dictionary']
  },
  L03: l(3, '日本は 今、春です'),
  L04: l(4, 'いい 天気ですね'),
  L05: l(5, 'この こうえんは 広くて、きれいです'),
  L06: l(6, 'まっすぐ 行って ください'),
  L07: l(7, '10時でも いいですか'),
  L08: l(8, 'もう やけいを 見に 行きましたか'),
  L09: l(9, '日本語は はつおんが かんたんです'),
  L10: l(10, 'いつか 日本に 行きたいです'),
  L11: l(11, '何を 持っていきますか'),
  L12: l(12, 'おいしそうですね'),
  L13: {
    id: 'L13',
    number: 13,
    label: 'Lição 13',
    title: 'Verbos e suas flexões na língua japonesa 3',
    file: `${DIR}/Licao13_verbos3_formaTA_Basico1Rikai.pdf`,
    teaches: ['ta']
  },
  L14: l(14, 'これ、使っても いいですか'),
  L15: {
    id: 'L15',
    number: 15,
    label: 'Lição 15',
    title: 'Verbos e suas flexões na língua japonesa 4',
    file: `${DIR}/Licao15_verbos4_formaNAI_Basico1Rikai.pdf`,
    teaches: ['nai']
  },
  L16: {
    id: 'L16',
    number: 16,
    label: 'Lição 16',
    title: '走ったり、泳いだり しています — forma polida e forma simples',
    file: `${DIR}/Licao16_Basico1Rikai.pdf`,
    teaches: ['tari', 'plain', 'nakatta']
  },
  L17: {
    id: 'L17',
    number: 17,
    label: 'Lição 17',
    title: '誕生日に もらったんです — forma simples + んです',
    file: `${DIR}/Licao17_Basico1Rikai.pdf`,
    teaches: ['plain', 'nakatta']
  },
  L18: {
    id: 'L18',
    number: 18,
    label: 'Lição 18',
    title: 'パーティーが いいと 思います — forma simples + と思います',
    file: `${DIR}/Licao18_Basico1Rikai.pdf`,
    teaches: ['plain', 'nakatta']
  }
};

/* De onde vem a regra de cada forma-alvo. `primary` é a lição citada no
   feedback; `also` são as lições que reforçam a mesma regra. */
export const FORM_SOURCE = {
  te: { primary: 'L01', also: [] },
  dictionary: { primary: 'L02', also: [] },
  ta: { primary: 'L13', also: ['L01'] },
  nai: { primary: 'L15', also: [] },
  /* たり também não tem apostila de flexão. A Lição 16 apresenta a
     expressão "V たり、V たり しています" e diz que o verbo fica "na forma
     TA (ver lição 13) acrescentando-se り" — daí a Lição 13 como apoio. */
  tari: { primary: 'L16', also: ['L13'] },
  /* なかった não tem lição própria de flexão: o Rikai a apresenta dentro
     da tabela da forma simples (ふつうけい) como passado negativo, e a
     constrói a partir da forma ない. Ver §23 do briefing. */
  nakatta: { primary: 'L16', also: ['L17', 'L18'] }
};

export const GROUP_SOURCE = { primary: 'L01', also: ['L02'] };

export function lesson(id) {
  const l = LESSONS[id];
  if (!l) throw new Error(`Lição desconhecida: ${id}`);
  return l;
}

/* Texto curto de citação, do jeito que aparece no rodapé do feedback. */
export function cite(id) {
  return `${COURSE} · ${lesson(id).label}`;
}

export function citeForm(form) {
  const s = FORM_SOURCE[form];
  if (!s) throw new Error(`Forma sem fonte declarada: ${form}`);
  return cite(s.primary);
}
