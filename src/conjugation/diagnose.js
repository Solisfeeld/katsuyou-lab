/* ===================================================================
   活用ラボ — diagnóstico do erro (§21).

   Nunca devolver feedback genérico. Dada a resposta errada, tentamos
   identificar QUE raciocínio a produziu, e devolvemos uma frase que
   nomeia esse raciocínio. Se nada casar, ainda assim dizemos algo
   específico sobre a distância entre o que foi digitado e a resposta.
   =================================================================== */

import { conjugate, FORM_LABEL, GROUP_LABEL, FORMS } from './rules.js';
import { normalize, acceptedAnswers } from './normalize.js';
import { VERBS } from '../data/verbs.js';

/* Tenta conjugar; devolve null em vez de lançar. Muitas hipóteses do
   diagnóstico são impossíveis para um dado verbo (aplicar a regra do
   Grupo 1 a たべます, por exemplo) e isso não é um erro do programa. */
function tryConj(masu, group, form, opts) {
  try { return conjugate({ masu, group }, form, opts).value; }
  catch { return null; }
}

/* Distância de edição, limitada — só precisamos saber se é 1. */
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

/* Pares surdo/sonoro que a forma て/た do Grupo 1 põe em jogo. */
const VOICED = { て: 'で', た: 'だ', で: 'て', だ: 'た' };

/**
 * diagnose(verb, form, rawAnswer) → { code, message, detail } | null
 * `null` quando a resposta está correta.
 */
export function diagnose(verb, form, rawAnswer) {
  const given = normalize(rawAnswer);
  const correct = verb[form];
  if (!given) return { code: 'empty', message: 'Você não digitou nada.' };
  if (acceptedAnswers(verb, form).includes(given)) return null;

  const norm = s => (s ? normalize(s) : null);

  /* --- 1. Manteve ます ------------------------------------------- */
  if (given === norm(verb.masu) || given === norm(verb.kanji)) {
    return {
      code: 'kept-masu',
      message: `Você repetiu a forma ます. A pergunta pede a ${FORM_LABEL[form]}.`
    };
  }

  /* --- 1b. Forma たり: o erro quase sempre está no caminho até a た -- */
  if (form === 'tari') {
    const d = diagnoseTari(verb, given, norm);
    if (d) return d;
  }

  /* --- 2. É outra forma DESTE verbo ------------------------------ */
  for (const f of FORMS) {
    if (f === form || !verb[f]) continue;
    if (given === norm(verb[f]) || given === norm(kanjiOf(verb, f))) {
      /* Casos frequentes ganham redação própria. */
      if (form === 'ta' && f === 'te') {
        return {
          code: 'te-for-ta',
          message: `${verb[f]} é a Forma て deste verbo. Aqui foi pedida a Forma た.`,
          detail: `A forma た reaproveita o mesmo padrão da forma て, trocando a sílaba final: ${verb.te} → ${verb.ta}.`
        };
      }
      if (form === 'te' && f === 'ta') {
        return {
          code: 'ta-for-te',
          message: `${verb[f]} é a Forma た deste verbo. Aqui foi pedida a Forma て.`,
          detail: `Mesmo padrão, sílaba final diferente: ${verb.ta} → ${verb.te}.`
        };
      }
      if (form === 'nakatta' && f === 'nai') {
        return {
          code: 'nai-for-nakatta',
          message: `${verb[f]} é a Forma ない deste verbo — você parou no meio do caminho.`,
          detail: `Falta o último passo: retire o い de ない e acrescente かった (${verb.nai} → ${verb.nakatta}).`
        };
      }
      return {
        code: 'other-form-same-verb',
        message: `${verb[f]} é a ${FORM_LABEL[f]} deste verbo. Aqui foi pedida a ${FORM_LABEL[form]}.`
      };
    }
  }

  /* --- 3. Aplicou a regra de outro grupo -------------------------- */
  for (const g of [1, 2, 3]) {
    if (g === verb.group) continue;
    const alt = tryConj(verb.masu, g, form);
    if (alt && given === norm(alt)) {
      return {
        code: 'wrong-group-rule',
        message: `Você aplicou a regra do ${GROUP_LABEL[g]}, mas ${verb.masu} é ${GROUP_LABEL[verb.group]}.`,
        detail: groupHint(verb)
      };
    }
  }

  /* --- 4. Esqueceu a exceção marcada com ★ ------------------------ */
  if (verb.irregular && (verb.irregularForms || []).includes(form)) {
    const regular = tryConj(verb.masu, verb.group, form, { ignoreExceptions: true });
    if (regular && given === norm(regular)) {
      return {
        code: 'missed-exception',
        message: `Você aplicou a regra geral do ${GROUP_LABEL[verb.group]} e chegou em ${regular}.`,
        detail: `${verb.masu} é a exceção marcada com ★ no Rikai: a forma correta é ${correct}.`
      };
    }
  }

  /* --- 5. Forma ない: い → あ em vez de わ ------------------------ */
  if ((form === 'nai' || form === 'nakatta') && verb.group === 1) {
    const stem = verb.masu.slice(0, -2);
    if (stem.slice(-1) === 'い') {
      const wrong = normalize(stem.slice(0, -1) + 'あ' + (form === 'nai' ? 'ない' : 'なかった'));
      if (given === wrong) {
        return {
          code: 'nai-wa',
          message: 'Você passou い para あ, mas い é o caso especial da forma ない: vira わ.',
          detail: `い → わ, não あ. Por isso ${verb.masu} → ${verb.nai}.`
        };
      }
    }
  }

  /* --- 6. Erro de sonorização (て/で, た/だ) ---------------------- */
  const c = normalize(correct);
  if (given.length === c.length) {
    const last = c.slice(-1);
    if (VOICED[last] && given.slice(0, -1) === c.slice(0, -1) && given.slice(-1) === VOICED[last]) {
      return {
        code: 'voicing',
        message: `A base está certa, mas a sílaba final é ${last}, não ${given.slice(-1)}.`,
        detail: `${patternLabel(verb, form)} Repare no ponto (dakuten).`
      };
    }
  }

  /* --- 7. É a forma de outro verbo do banco ---------------------- */
  for (const other of VERBS) {
    if (other.id === verb.id) continue;
    for (const f of FORMS) {
      if (!other[f]) continue;
      if (given === norm(other[f])) {
        return {
          code: 'other-verb',
          message: `${other[f]} é a ${FORM_LABEL[f]} de ${other.masu} (${other.meaning}), outro verbo.`,
          detail: `Aqui o verbo é ${verb.masu} (${verb.meaning}).`
        };
      }
    }
  }

  /* --- 8. Errou por um kana ------------------------------------- */
  if (editDistance(given, c) === 1) {
    return {
      code: 'typo',
      message: 'Faltou muito pouco: há um kana diferente da resposta correta.',
      detail: `Compare com atenção: ${correct}.`
    };
  }

  /* --- 9. Nada casou, mas ainda dizemos algo concreto ------------ */
  return {
    code: 'unmatched',
    message: `${rawAnswer.trim()} não é nenhuma das formas de ${verb.masu} (${verb.meaning}).`,
    detail: `Refaça o caminho pela regra do ${GROUP_LABEL[verb.group]} abaixo.`
  };
}

function kanjiOf(verb, form) {
  if (!verb.kanji) return null;
  return tryConj(verb.kanji, verb.group, form);
}

/* Por que este verbo é do grupo que é — o que o aluno precisa reter
   quando erra o grupo. */
function groupHint(verb) {
  const stem = verb.masu.slice(0, -2);
  const last = stem.slice(-1);
  if (verb.group === 3) return 'Grupo 3: só します e きます (e compostos deles). São memorizados.';
  if (verb.group === 2) {
    if (stem.length === 1) return `Grupo 2: há apenas um hiragana (${stem}) antes de ます.`;
    if ('いちりにびみきぎし'.includes(last)) {
      return `Grupo 2 tipo (iii): tem /i/ (${last}) antes de ます como o Grupo 1, mas é Grupo 2 — está na lista curta do Rikai.`;
    }
    return `Grupo 2: o som antes de ます é /e/ (${last}).`;
  }
  return `Grupo 1: o som antes de ます é /i/ (${last}).`;
}

/* Frase pronta que lembra a regra aplicável, seja o padrão do grupo ou
   a exceção do próprio verbo. */
function patternLabel(verb, form) {
  try {
    return `${conjugate(verb, form).rule}.`.replace(/\.\.$/, '.');
  } catch { return 'Observe o padrão desta forma.'; }
}

/* -------------------------------------------------------------------
   Forma たり = Forma た + り (Lição 16). Quase todo erro de たり é um erro
   no caminho até a Forma た, então cada mensagem mostra esse caminho.
   ------------------------------------------------------------------- */
function diagnoseTari(verb, given, norm) {
  const { ta, tari } = verb;
  const stem = verb.masu.slice(0, -2);

  /* Parou na Forma た. */
  if (given === norm(ta) || given === norm(kanjiOf(verb, 'ta'))) {
    return {
      code: 'ta-for-tari',
      message: `${ta} é a Forma た. Para formar たり, acrescente り: ${tari}.`
    };
  }

  /* Pulou a Forma た: raiz + り. */
  if (given === norm(stem + 'り')) {
    return {
      code: 'tari-without-ta',
      message: `Faltou a Forma た. Primeiro forme ${ta}; depois acrescente り: ${tari}.`
    };
  }

  /* Juntou たり direto na raiz (のみたり). */
  if (given === norm(stem + 'たり')) {
    return {
      code: 'tari-on-stem',
      message: `Você juntou たり direto à raiz ${stem}. A Forma たり parte da Forma た.`,
      detail: `${verb.masu} → ${ta} → + り → ${tari}.`
    };
  }

  /* Esqueceu a exceção que a たり herda da た (いいたり). */
  const regularTa = tryConj(verb.masu, verb.group, 'ta', { ignoreExceptions: true });
  if (regularTa && regularTa !== ta && given === norm(regularTa + 'り')) {
    return {
      code: 'missed-exception',
      message: `Você chegou em ${regularTa}り aplicando a regra geral do ${GROUP_LABEL[verb.group]}.`,
      detail: `A Forma た de ${verb.masu} é ${ta} — a mesma exceção ★ da Forma た —, então: ${ta} + り → ${tari}.`
    };
  }

  /* Partiu da Forma て (のんでり). */
  if (verb.te && given === norm(verb.te + 'り')) {
    return {
      code: 'te-for-tari',
      message: `Você partiu da Forma て (${verb.te}). A Forma たり parte da Forma た.`,
      detail: `${ta} + り → ${tari}.`
    };
  }

  /* Sonorização na sílaba た／だ (のんたり). */
  const c = normalize(tari);
  const swap = { た: 'だ', だ: 'た' };
  const k = c[c.length - 2];
  if (swap[k] && given.length === c.length && given.endsWith('り') &&
      given.slice(0, -2) === c.slice(0, -2) && given[given.length - 2] === swap[k]) {
    return {
      code: 'voicing',
      message: `A base está certa, mas é ${k}り, não ${swap[k]}り.`,
      detail: `A Forma た deste verbo é ${ta}; repare no ponto (dakuten).`
    };
  }
  return null;
}
