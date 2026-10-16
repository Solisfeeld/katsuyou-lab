/* ===================================================================
   活用ラボ — motor de conjugação.

   Esta é a camada 2 do §43 do briefing: o motor conhece as REGRAS do
   Rikai e calcula a forma a partir do ます形, registrando cada passo do
   caminho. O banco de verbos (camada 1) guarda as formas auditadas; o
   check-content confronta as duas e falha em qualquer divergência.

   Nada aqui consulta o banco de verbos — o motor recebe apenas
   { masu, group } e devolve o cálculo. Isso mantém as duas camadas
   genuinamente independentes, que é o ponto do §43.
   =================================================================== */

import {
  MASU, TO_U_ROW, TO_A_ROW, TE_PATTERN_BY_KANA, tePatternRule, TE_TO_TA
} from './kana.js';

/* Ordem da Lição no Rikai: て (L01), 辞書形 (L02), た (L13), ない (L15) e,
   dentro da Lição 16, primeiro a expressão com たり (seção 1) e depois o
   quadro da forma simples com なかった (seção 2). */
export const FORMS = ['te', 'dictionary', 'ta', 'nai', 'tari', 'nakatta'];

export const FORM_LABEL = {
  te: 'Forma て',
  dictionary: 'Forma de dicionário（辞書形）',
  ta: 'Forma た',
  nai: 'Forma ない',
  tari: 'Forma たり',
  nakatta: 'Forma なかった'
};

/* Rótulo curto, para matriz de domínio e chips onde não cabe o nome longo. */
export const FORM_SHORT = {
  te: 'て', dictionary: '辞書', ta: 'た', nai: 'ない', tari: 'たり', nakatta: 'なかった'
};

export const GROUP_LABEL = { 1: 'Grupo 1', 2: 'Grupo 2', 3: 'Grupo 3' };

/* -------------------------------------------------------------------
   Grupo 3 — os irregulares. O Rikai diz (Lição 01) que o Grupo 3 é
   formado por きます e します "mas há também os verbos formados pela
   combinação destes com outros verbos ou substantivos". Por isso o
   motor trabalha com o SUFIXO: べんきょう+します, もって+きます.
   ------------------------------------------------------------------- */
const G3_SUFFIXES = [
  {
    masu: 'します',
    forms: { dictionary: 'する', te: 'して', ta: 'した', nai: 'しない', nakatta: 'しなかった' }
  },
  {
    masu: 'きます',
    forms: { dictionary: 'くる', te: 'きて', ta: 'きた', nai: 'こない', nakatta: 'こなかった' }
  }
];

function g3Suffix(masu) {
  return G3_SUFFIXES.find(s => masu.endsWith(s.masu)) || null;
}

/* -------------------------------------------------------------------
   Exceções explícitas (§43: "Para irregularidades, permita override").
   Chave = ます形. Só entram aqui formas que o Rikai marca como exceção.

   A grafia em kanji entra como chave própria: o motor também é usado para
   gerar as variantes aceitas em kanji (ver normalize.js), e sem esta
   entrada 行きます produziria "行いて".
   ------------------------------------------------------------------- */
export const EXCEPTIONS = {
  /* ★ Lição 01: "いきます → いって. Antes do ます é き, mas não fica いいて."
     ★ Lição 13: mesma exceção para a forma た. */
  いきます: {
    te: {
      value: 'いって',
      note: 'いきます é exceção: antes de ます vem き, mas a forma て não é いいて.',
      rule: 'Exceção: いきます → いって'
    },
    ta: {
      value: 'いった',
      note: 'いきます é exceção: antes de ます vem き, mas a forma た não é いいた.',
      rule: 'Exceção: いきます → いった'
    }
  },
  行きます: {
    te: {
      value: '行って',
      note: '行きます é exceção: antes de ます vem き, mas a forma て não é 行いて.',
      rule: 'Exceção: 行きます → 行って'
    },
    ta: {
      value: '行った',
      note: '行きます é exceção: antes de ます vem き, mas a forma た não é 行いた.',
      rule: 'Exceção: 行きます → 行った'
    }
  }
};

export class ConjugationError extends Error {}

/* -------------------------------------------------------------------
   Núcleo: conjugate({ masu, group }, form)
   Devolve { value, group, form, steps, rule, exception, patternId, stem }
   `steps` é a transformação passo a passo que o feedback de erro exibe.

   `opts.ignoreExceptions` aplica a regra geral do grupo mesmo onde o
   Rikai marca exceção. Serve ao diagnóstico de erro: é exatamente assim
   que o aluno chega em いいて, e reconhecer isso permite dizer "você
   aplicou a regra き → いて e esqueceu a exceção".
   ------------------------------------------------------------------- */
export function conjugate(verb, form, opts = {}) {
  if (!FORMS.includes(form)) throw new ConjugationError(`Forma desconhecida: ${form}`);
  const masu = verb.masu;
  const group = Number(verb.group);
  if (!masu || !masu.endsWith(MASU)) {
    throw new ConjugationError(`ます形 inválido: ${masu}`);
  }
  if (![1, 2, 3].includes(group)) throw new ConjugationError(`Grupo inválido: ${verb.group}`);

  /* なかった é sempre derivada da forma ない — o Rikai a apresenta como o
     passado negativo da forma simples, não como uma tabela à parte (§23). */
  if (form === 'nakatta') return fromNai(verb, group, opts);

  /* たり é sempre derivada da forma た — Lição 16: "O verbo deverá estar
     na forma TA (ver lição 13) acrescentando-se り". */
  if (form === 'tari') return fromTa(verb, group, opts);

  if (group === 3) return group3(masu, form);
  if (group === 2) return group2(masu, form);
  return group1(masu, form, opts);
}

/* ---------------- Grupo 1 ---------------- */
function group1(masu, form, opts = {}) {
  const stem = masu.slice(0, -MASU.length);          // のみます → のみ
  const last = stem.slice(-1);                        // → み
  const base = stem.slice(0, -1);                     // → の

  if (!TO_U_ROW[last]) {
    throw new ConjugationError(
      `${masu}: "${last}" não pertence à linha /i/, então o verbo não pode ser Grupo 1.`
    );
  }

  const ex = opts.ignoreExceptions ? null : EXCEPTIONS[masu]?.[form];
  const steps = [
    { value: masu },
    { note: `retirar ${MASU}`, value: stem },
    { note: `final ${last}` }
  ];

  if (form === 'dictionary') {
    const value = base + TO_U_ROW[last];
    steps.push({ note: `linha /i/ → linha /u/：${last} → ${TO_U_ROW[last]}`, value });
    return {
      value, group: 1, form, stem, patternId: null, exception: null, steps,
      rule: `Grupo 1: o som /i/ antes de ます vira /u/ (${last} → ${TO_U_ROW[last]}).`
    };
  }

  if (form === 'nai') {
    const a = TO_A_ROW[last];
    /* ★ Lição 15: "Caso o hiragana anterior a ます seja い, substitui-se
       por わ e não por あ." É o erro mais previsível da forma ない. */
    if (last === 'い') {
      steps.push({ note: 'linha /i/ → linha /a/' });
      steps.push({ note: 'い é um caso especial: vira わ, não あ', value: base + a });
    } else {
      steps.push({ note: `linha /i/ → linha /a/：${last} → ${a}`, value: base + a });
    }
    const value = base + a + 'ない';
    steps.push({ note: '+ ない', value });
    return {
      value, group: 1, form, stem, patternId: null,
      exception: last === 'い' ? { rule: 'い → わ, não あ', note: 'Caso especial da forma ない no Grupo 1.' } : null,
      steps,
      rule: last === 'い'
        ? 'Grupo 1: o som /i/ vira /a/ + ない — mas い vira わ.'
        : `Grupo 1: o som /i/ vira /a/ + ない (${last} → ${a}).`
    };
  }

  /* te | ta */
  if (ex) {
    steps.push({ note: ex.note, value: ex.value });
    return {
      value: ex.value, group: 1, form, stem, patternId: null,
      exception: { rule: ex.rule, note: ex.note }, steps, rule: ex.rule
    };
  }

  const p = TE_PATTERN_BY_KANA[last];
  if (!p) throw new ConjugationError(`${masu}: sem padrão de forma ${form} para "${last}".`);
  const ending = form === 'ta' ? p.ta : p.te;
  const value = base + ending;
  steps.push({ note: tePatternRule(last, form), value });

  const out = {
    value, group: 1, form, stem, patternId: p.id, exception: null, steps,
    rule: `Grupo 1: ${p.label} → ${ending}`
  };
  /* §24: a forma た reaproveita o padrão da forma て. Deixar isso explícito
     é requisito, não enfeite. */
  if (form === 'ta') out.relation = { te: base + p.te, ta: value, swap: `${p.te} → ${p.ta}` };
  return out;
}

/* ---------------- Grupo 2 ---------------- */
function group2(masu, form) {
  const stem = masu.slice(0, -MASU.length);
  const suffix = { dictionary: 'る', te: 'て', ta: 'た', nai: 'ない' }[form];
  const value = stem + suffix;
  return {
    value, group: 2, form, stem, patternId: null, exception: null,
    steps: [
      { value: masu },
      { note: `trocar ${MASU} por ${suffix}`, value }
    ],
    rule: `Grupo 2: ${MASU} → ${suffix}`
  };
}

/* ---------------- Grupo 3 ---------------- */
function group3(masu, form) {
  const s = g3Suffix(masu);
  if (!s) {
    throw new ConjugationError(
      `${masu}: Grupo 3 só cobre verbos terminados em します ou きます.`
    );
  }
  const prefix = masu.slice(0, -s.masu.length);       // べんきょう / もって / ''
  const value = prefix + s.forms[form];
  const steps = [{ value: masu }];
  if (prefix) steps.push({ note: `a parte irregular é "${s.masu}"`, value: `${prefix}｜${s.masu}` });
  steps.push({ note: `${s.masu} → ${s.forms[form]} (memorizar)`, value });
  return {
    value, group: 3, form, stem: prefix, patternId: s.masu, exception: null, steps,
    rule: `Grupo 3: ${s.masu} → ${s.forms[form]}`
  };
}

/* ---------------- なかった, derivada de ない ---------------- */
function fromNai(verb, group, opts = {}) {
  const nai = conjugate(verb, 'nai', opts);
  if (!nai.value.endsWith('ない')) {
    throw new ConjugationError(`${verb.masu}: forma ない inesperada "${nai.value}".`);
  }
  const trunk = nai.value.slice(0, -1);               // のまない → のまな
  const value = trunk + 'かった';
  return {
    value, group, form: 'nakatta', stem: nai.stem, patternId: nai.patternId,
    exception: nai.exception,
    /* Os passos partem do ます形, passam pela forma ない e mostram a troca
       final — a relação pedagógica que o §23 exige. */
    steps: [
      { value: verb.masu },
      { note: `forma ない (${nai.rule})`, value: nai.value },
      { note: 'retirar い de ない', value: trunk },
      { note: '+ かった', value }
    ],
    rule: 'ない → なかった: troque o い final de ない por かった.',
    derivedFrom: { form: 'nai', value: nai.value, rule: nai.rule, swap: 'ない → なかった' }
  };
}

/* ---------------- たり, derivada de た ----------------
   Nenhuma tabela própria: tudo o que a forma た já sabe — os padrões do
   Grupo 1, o Grupo 2, o Grupo 3, os compostos e a exceção de いきます —
   chega aqui sem repetição. `opts` é repassado para que o diagnóstico
   consiga reconstruir いいたり (a regra geral aplicada por engano). */
function fromTa(verb, group, opts = {}) {
  const ta = conjugate(verb, 'ta', opts);
  if (!/[ただ]$/.test(ta.value)) {
    throw new ConjugationError(`${verb.masu}: forma た inesperada "${ta.value}".`);
  }
  const value = ta.value + 'り';
  return {
    value, group, form: 'tari', stem: ta.stem, patternId: ta.patternId,
    /* A irregularidade é a mesma da forma た e é herdada como está. */
    exception: ta.exception,
    steps: [
      { value: verb.masu },
      { note: `Forma た (${ta.rule})`, value: ta.value },
      { note: '+ り', value }
    ],
    rule: 'Forma たり: forme a Forma た e acrescente り.',
    derivedFrom: { form: 'ta', value: ta.value, rule: ta.rule, swap: 'た → たり' }
  };
}

/* -------------------------------------------------------------------
   Detecção do grupo a partir do ます形 — usada pelo check-content para
   apontar grupos declarados incoerentes, e pelo diagnóstico de erro.

   Devolve { group, certain, reason }. O Grupo 2 tipo (iii) do Rikai
   (おきます, できます) é indistinguível do Grupo 1 apenas pela forma,
   e o próprio Rikai diz isso — por isso `certain:false` nesses casos.
   ------------------------------------------------------------------- */
export function detectGroup(masu) {
  if (!masu.endsWith(MASU)) return { group: null, certain: false, reason: 'Não termina em ます.' };
  if (g3Suffix(masu)) {
    return { group: 3, certain: false, reason: 'Termina em します/きます — pode ser Grupo 3.' };
  }
  const stem = masu.slice(0, -MASU.length);
  const last = stem.slice(-1);
  if (stem.length === 1) {
    return { group: 2, certain: true, reason: 'Há apenas um hiragana antes de ます (Grupo 2, tipo ii).' };
  }
  if (TO_U_ROW[last]) {
    return {
      group: 1, certain: false,
      reason: `O som antes de ます é /i/ (${last}) — quase sempre Grupo 1, mas alguns poucos verbos deste tipo são Grupo 2.`
    };
  }
  return { group: 2, certain: true, reason: `O som antes de ます é /e/ (${last}) — Grupo 2, tipo (i).` };
}

/* Todas as formas de um verbo, calculadas pelo motor. */
export function conjugateAll(verb) {
  const out = {};
  for (const f of FORMS) {
    try { out[f] = conjugate(verb, f); }
    catch (err) { out[f] = { error: err.message }; }
  }
  return out;
}
