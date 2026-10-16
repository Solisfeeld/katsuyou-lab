/* ===================================================================
   活用ラボ — normalização e conjunto de respostas aceitas (§41).

   Aceita-se: variação Unicode, espaços acidentais (inclusive o espaço
   ideográfico　U+3000) e a grafia em kanji quando o Rikai apresenta o
   verbo em kanji. NÃO se aceita erro por aproximação.
   =================================================================== */

import { conjugate } from './rules.js';

/* Normaliza o que o usuário digitou antes de comparar.
   - NFKC resolve kana de largura meia (ﾉﾐﾏｽ) e formas compatíveis;
   - todo espaço some, porque em japonês ele nunca é significativo aqui;
   - o katakana NÃO é convertido em hiragana: escrever のんで em katakana
     é um erro de escrita, não uma variação aceitável. */
export function normalize(input) {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFKC')
    .replace(/[\s　​-‍﻿]/g, '')
    /* Pontuação japonesa que às vezes escapa do teclado no fim da resposta. */
    .replace(/[。、．，.,]+$/g, '');
}

/* A grafia em kanji de uma forma conjugada. O motor opera sobre a cauda
   em kana do ます形, e essa cauda é idêntica na grafia com kanji
   (飲みます tem o mesmo み que のみます) — então basta reconjugar usando
   o kanji como entrada. Verbos sem `kanji` declarado não geram variante. */
export function kanjiVariant(verb, form) {
  if (!verb.kanji) return null;
  try {
    const r = conjugate({ masu: verb.kanji, group: verb.group }, form);
    return r.value;
  } catch {
    return null;
  }
}

/* Todas as respostas aceitas para verbo × forma, já normalizadas. */
export function acceptedAnswers(verb, form) {
  const canonical = verb[form];
  if (!canonical) return [];
  const set = new Set([normalize(canonical)]);

  const kanji = kanjiVariant(verb, form);
  if (kanji) set.add(normalize(kanji));

  /* Aceitos declarados à mão no banco, se algum dia forem necessários. */
  (verb.accept?.[form] || []).forEach(a => set.add(normalize(a)));

  return [...set];
}

export function isCorrect(verb, form, input) {
  const given = normalize(input);
  if (!given) return false;
  return acceptedAnswers(verb, form).includes(given);
}
