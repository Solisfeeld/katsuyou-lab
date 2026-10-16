#!/usr/bin/env node
/* ===================================================================
   活用ラボ — auditoria pedagógica (§53).

   Simula, para cada forma e cada grupo, os oito cenários do briefing:
   resposta correta, resposta de outra forma, erro de grupo, erro
   fonético, irregularidade, "Não sei", primeira dica e segunda dica.

   Imprime o feedback exatamente como ele chega ao usuário, para que a
   pergunta central possa ser respondida lendo a saída:

       "Se eu errar, vou entender como chegar à resposta correta?"

   Não é um teste automatizado — é o relatório que se lê antes de dar o
   projeto por pronto. Uso: node scripts/audit-feedback.js [verbo]
   =================================================================== */

import { VERBS, verbById } from '../src/data/verbs.js';
import { FORMS, FORM_LABEL, GROUP_LABEL, conjugate } from '../src/conjugation/rules.js';
import { explain, hints, stepsToText } from '../src/conjugation/explain.js';
import { diagnose } from '../src/conjugation/diagnose.js';

const only = process.argv[2];

/* Um representante por (grupo × situação interessante). */
const SAMPLE = only
  ? [only]
  : [
    'nomimasu',    // G1 に・び・み
    'kaimasu',     // G1 い → わ na forma ない
    'kakimasu',    // G1 き → いて
    'oyogimasu',   // G1 ぎ → いで
    'hanashimasu', // G1 し → して
    'machimasu',   // G1 ち → って
    'ikimasu',     // G1 exceção ★
    'arimasu',     // G1 com formas não sustentadas
    'tabemasu',    // G2 tipo (i)
    'mimasu',      // G2 tipo (ii)
    'okimasu',     // G2 tipo (iii)
    'shimasu',     // G3
    'kimasu_kuru', // G3 きます (vir)
    'kimasu_kiru', // G2 きます (vestir)
    'benkyoushimasu' // G3 composto
  ];

const line = ch => ch.repeat(72);
let problems = 0;

/* Constrói respostas erradas plausíveis, uma por tipo de erro. */
function wrongCandidates(v, form, correct) {
  const out = [];
  const add = (label, value) => {
    if (value && value !== correct && !out.some(o => o.value === value)) out.push({ label, value });
  };

  for (const f of FORMS) {
    if (f !== form && v[f]) add(`outra forma do verbo (${FORM_LABEL[f]})`, v[f]);
  }
  add('manteve ます', v.masu);
  for (const g of [1, 2, 3]) {
    if (g === v.group) continue;
    try { add(`regra do ${GROUP_LABEL[g]}`, conjugate({ masu: v.masu, group: g }, form).value); }
    catch { /* impossível para este verbo */ }
  }
  if (v.irregular && (v.irregularForms || []).includes(form)) {
    try { add('ignorou a exceção ★', conjugate(v, form, { ignoreExceptions: true }).value); } catch {}
  }
  if ((form === 'nai' || form === 'nakatta') && v.group === 1) {
    const stem = v.masu.slice(0, -2);
    if (stem.slice(-1) === 'い') {
      add('い → あ em vez de わ', stem.slice(0, -1) + 'あ' + (form === 'nai' ? 'ない' : 'なかった'));
    }
  }
  /* たり: parou na た, pulou a た, raiz + たり, partiu da て, exceção */
  if (form === 'tari') {
    const stem = v.masu.slice(0, -2);
    add('parou na Forma た', v.ta);
    add('raiz + り, sem a Forma た', stem + 'り');
    add('raiz + たり', stem + 'たり');
    if (v.te) add('partiu da Forma て', v.te + 'り');
    try { add('ignorou a exceção ★ herdada da た', conjugate(v, 'ta', { ignoreExceptions: true }).value + 'り'); } catch {}
  }
  /* erro fonético: troca a sonorização da última sílaba */
  const V = { て: 'で', で: 'て', た: 'だ', だ: 'た' };
  const last = correct.slice(-1);
  if (V[last]) add('erro de sonorização', correct.slice(0, -1) + V[last]);
  /* erro ortográfico: um kana a menos */
  add('erro ortográfico (um kana a menos)', correct.slice(0, -2) + correct.slice(-1));
  add('resposta sem relação', 'あああ');
  return out;
}

for (const id of SAMPLE) {
  const v = verbById(id);
  if (!v) { console.error(`verbo desconhecido: ${id}`); process.exit(1); }

  console.log('\n' + line('═'));
  console.log(`  ${v.masu}${v.kanji ? ` / ${v.kanji}` : ''}  —  ${v.meaning}  —  ${GROUP_LABEL[v.group]}`);
  console.log(`  Rikai: ${v.lessons.join(', ')}${v.irregular ? '   ★ irregular' : ''}`);
  console.log(line('═'));

  for (const form of FORMS) {
    if ((v.notTaught || []).includes(form)) {
      console.log(`\n  ── ${FORM_LABEL[form]}: fora do treino`);
      console.log(`     ${v.notTaughtReason}`);
      continue;
    }

    const ex = explain(v, form);
    const [h1, h2] = hints(v, form);

    console.log('\n' + line('─'));
    console.log(`  ${v.masu} → ${FORM_LABEL[form]}`);
    console.log(line('─'));
    console.log(`  ✓ Correto:  ${ex.answer}${ex.kanjiAnswer ? `   (também aceito: ${ex.kanjiAnswer})` : ''}`);
    console.log(`  Dica 1:     ${h1}`);
    console.log(`  Dica 2:     ${h2}`);
    if (h1.includes(ex.answer) || h2.includes(ex.answer)) {
      console.log('  ‼ PROBLEMA: uma dica entrega a resposta.');
      problems++;
    }

    console.log('\n  "Não sei" / erro — o que o usuário vê:\n');
    console.log(indent(stepsToText(ex.steps), 6));
    console.log(`\n      Regra: ${ex.rule}`);
    /* Mesma supressão da UI: quando a exceção já é a regra do verbo,
       repeti-la não acrescenta nada. */
    if (ex.exception && ex.exception.rule !== ex.rule) {
      console.log(`      Atenção: ${ex.exception.rule}`);
    }
    if (ex.relation) console.log(`      Forma て: ${ex.relation.te} → ${ex.relation.ta} （${ex.relation.swap}）`);
    if (ex.derivedFrom) console.log(`      Vem de: ${ex.derivedFrom.value} → ${ex.answer} （${ex.derivedFrom.swap}）`);
    console.log(`      ${ex.source}`);

    console.log('\n  Diagnóstico por tipo de erro:');
    for (const w of wrongCandidates(v, form, ex.answer)) {
      const d = diagnose(v, form, w.value);
      if (!d) {
        console.log(`    ‼ "${w.value}" (${w.label}) foi ACEITA como correta.`);
        problems++;
        continue;
      }
      const generic = d.code === 'unmatched' && w.label !== 'resposta sem relação';
      console.log(`    ${generic ? '~' : '·'} ${w.value.padEnd(12)} [${w.label}]`);
      console.log(`      → ${d.message}`);
      if (d.detail) console.log(`        ${d.detail}`);
    }
  }
}

console.log('\n' + line('═'));
if (problems) {
  console.log(`  ${problems} problema(s) encontrado(s) na auditoria pedagógica.`);
  process.exit(1);
}
console.log('  Auditoria pedagógica: nenhum problema encontrado.');
console.log(`  ${SAMPLE.length} verbos inspecionados de ${VERBS.length} no banco.`);
console.log(line('═'));

function indent(text, n) {
  return text.split('\n').map(l => ' '.repeat(n) + l).join('\n');
}
