/* ===================================================================
   活用ラボ — explicação específica de verbo × forma (§44).

   Nada aqui pode devolver "revise as regras de conjugação". Toda
   combinação treinável produz: grupo, regra, transformação passo a
   passo, resposta, exceção quando houver e a fonte no Rikai.
   =================================================================== */

import { conjugate, FORM_LABEL, GROUP_LABEL, FORMS } from './rules.js';
import { citeForm, cite, FORM_SOURCE } from '../data/sources.js';
import { kanjiVariant } from './normalize.js';

/* Explicação completa de uma combinação. É o objeto que a tela de
   feedback e a tela de referência consomem. */
export function explain(verb, form) {
  if (!FORMS.includes(form)) throw new Error(`Forma desconhecida: ${form}`);
  if ((verb.notTaught || []).includes(form)) {
    throw new Error(`${verb.masu} × ${form} não é sustentado pelo Rikai.`);
  }

  const calc = conjugate(verb, form);
  const stored = verb[form];

  return {
    verb,
    form,
    formLabel: FORM_LABEL[form],
    group: verb.group,
    groupLabel: GROUP_LABEL[verb.group],
    answer: stored,
    kanjiAnswer: kanjiVariant(verb, form),
    /* Passos vindos do motor: a transformação concreta deste verbo. */
    steps: calc.steps,
    rule: calc.rule,
    exception: calc.exception,
    /* §24 — a forma た reaproveita o padrão da forma て. */
    relation: calc.relation || null,
    /* Formas derivadas: なかった nasce de ない (§23) e たり de た (L16). */
    derivedFrom: calc.derivedFrom || null,
    note: verb.note || null,
    source: citeForm(form),
    sourceExtra: (FORM_SOURCE[form].also || []).map(cite)
  };
}

/* Renderização em texto puro da transformação, no formato do briefing:

     のみます
     ↓ retirar ます
     のみ
     ↓ final み
     ↓ に・び・み → んで
     のんで

   Usada nos testes, no check-content e como fallback acessível. */
export function stepsToText(steps) {
  const out = [];
  for (const s of steps) {
    if (s.note) out.push(`↓ ${s.note}`);
    if (s.value) out.push(s.value);
  }
  return out.join('\n');
}

/* -------------------------------------------------------------------
   Dicas progressivas (§29). Nunca revelam a resposta: o check-content
   falha se alguma dica contiver a forma-alvo.

   Dica 1 — o grupo.
   Dica 2 — a micro-regra que resolve a questão.
   ------------------------------------------------------------------- */
export function hints(verb, form) {
  /* たり parte da Forma た (Lição 16: "o verbo deverá estar na forma TA
     acrescentando-se り"). A primeira dica aponta esse caminho; a segunda
     mostra a Forma た deste verbo — que o aluno já treina — e deixa para
     ele só o último passo. Nenhuma das duas contém a resposta. */
  if (form === 'tari') {
    const ta = conjugate(verb, 'ta').value;
    return [
      'Primeiro pense na Forma た.',
      `${verb.masu} → ${ta}. Agora acrescente り.`
    ];
  }

  const calc = conjugate(verb, form);
  const stem = verb.masu.slice(0, -2);
  const last = stem.slice(-1);

  const first = `É ${GROUP_LABEL[verb.group]}.`;
  let second;

  if (verb.group === 3) {
    second = 'Grupo 3 é memorização: só as partes します e きます flexionam.';
  } else if (verb.group === 2) {
    second = {
      te: 'Grupo 2: troque ます por て.',
      dictionary: 'Grupo 2: troque ます por る.',
      ta: 'Grupo 2: troque ます por た.',
      nai: 'Grupo 2: troque ます por ない.',
      nakatta: 'Grupo 2: chegue à forma ない e troque o い final por かった.'
    }[form];
  } else {
    second = {
      te: `Olhe o kana antes de ます (${last}). ${ruleHintTe(calc, 'te')}`,
      dictionary: 'Grupo 1: o som /i/ antes de ます passa para a linha /u/.',
      ta: `Olhe o kana antes de ます (${last}). ${ruleHintTe(calc, 'ta')}`,
      nai: last === 'い'
        ? 'Grupo 1: o som /i/ passa para a linha /a/ ＋ ない — e い tem um comportamento próprio.'
        : 'Grupo 1: o som /i/ antes de ます passa para a linha /a/, depois ＋ ない.',
      nakatta: 'Passe primeiro para a forma ない; depois troque o い final por かった.'
    }[form];
  }

  /* A exceção só é anunciada como "há uma exceção aqui" — dizer qual é
     entregaria a resposta. Substitui a regra normal em vez de somar-se
     a ela: apontar o padrão e depois dizer que ele não vale confunde. */
  if (verb.irregular && (verb.irregularForms || []).includes(form)) {
    second = `Olhe o kana antes de ます (${last}). Este verbo é a exceção marcada com ★ no Rikai — o padrão normal desse kana não vale aqui.`;
  }

  return [first, second];
}

/* Enuncia o padrão sem escrever a forma final do verbo. */
function ruleHintTe(calc, form) {
  if (calc.exception) return 'Cuidado: a regra normal do padrão não vale aqui.';
  const map = {
    p1: form === 'ta' ? 'い・ち・り → った.' : 'い・ち・り → って.',
    p2: form === 'ta' ? 'に・び・み → んだ.' : 'に・び・み → んで.',
    p3: form === 'ta' ? 'き → いた.' : 'き → いて.',
    p4: form === 'ta' ? 'ぎ → いだ.' : 'ぎ → いで.',
    p5: form === 'ta' ? 'し → した.' : 'し → して.'
  };
  return map[calc.patternId] || '';
}
