#!/usr/bin/env node
/* ===================================================================
   活用ラボ — check-content (§45).

   Confronta o banco de verbos (camada 1) com o motor de conjugação
   (camada 2) e com o registro de fontes. Sai com código 1 em qualquer
   divergência: este comando é o que impede o conteúdo de apodrecer.
   =================================================================== */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { VERBS } from '../src/data/verbs.js';
import { LESSONS, FORM_SOURCE, GROUP_SOURCE, citeForm } from '../src/data/sources.js';
import { conjugate, detectGroup, FORMS, FORM_LABEL } from '../src/conjugation/rules.js';
import { explain, hints, stepsToText } from '../src/conjugation/explain.js';
import { diagnose } from '../src/conjugation/diagnose.js';
import { normalize, acceptedAnswers, kanjiVariant } from '../src/conjugation/normalize.js';

const problems = [];
const warnings = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

/* ------------------------------------------------------------------
   1. Fontes declaradas
   ------------------------------------------------------------------ */
for (const [form, src] of Object.entries(FORM_SOURCE)) {
  if (!FORMS.includes(form)) fail('FORM_SOURCE', `forma desconhecida "${form}"`);
  for (const id of [src.primary, ...(src.also || [])]) {
    if (!LESSONS[id]) fail('FORM_SOURCE', `forma ${form} cita a lição inexistente "${id}"`);
  }
}
for (const id of [GROUP_SOURCE.primary, ...(GROUP_SOURCE.also || [])]) {
  if (!LESSONS[id]) fail('GROUP_SOURCE', `cita a lição inexistente "${id}"`);
}
for (const form of FORMS) {
  if (!FORM_SOURCE[form]) fail('FORM_SOURCE', `forma "${form}" sem fonte declarada`);
}

/* Cada lição declarada tem de apontar para um PDF que existe de verdade
   na raiz do repositório de estudo. É o que impede o conteúdo de citar
   uma fonte que ninguém pode conferir. Fora desse diretório (num clone
   só do site) a checagem é pulada com aviso, não com falha. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rikaiDirPresent = existsSync(resolve(REPO_ROOT, '03ふくしゅう_Basico1Rikai'));
for (const [id, lsn] of Object.entries(LESSONS)) {
  if (!lsn.file) { fail('LESSONS', `${id} sem arquivo de origem`); continue; }
  if (!rikaiDirPresent) continue;
  if (!existsSync(resolve(REPO_ROOT, lsn.file))) {
    fail('LESSONS', `${id} aponta para um PDF inexistente: ${lsn.file}`);
  }
}
if (!rikaiDirPresent) {
  warn('LESSONS', 'materiais Rikai não encontrados na raiz — existência dos PDFs não verificada');
}

/* ------------------------------------------------------------------
   2. Banco de verbos
   ------------------------------------------------------------------ */
const seenIds = new Set();
const seenPairs = new Map();   // masu|meaning -> id, para achar duplicata real

for (const v of VERBS) {
  const at = `${v.id} (${v.masu})`;

  /* --- id --- */
  if (!v.id) { fail('banco', `verbo sem id: ${v.masu}`); continue; }
  if (seenIds.has(v.id)) fail('banco', `id duplicado: ${v.id}`);
  seenIds.add(v.id);

  /* --- campos obrigatórios --- */
  if (!v.masu || !v.masu.endsWith('ます')) fail(at, 'ます形 ausente ou não termina em ます');
  if (!v.meaning || !v.meaning.trim()) fail(at, 'verbo sem significado');
  if (![1, 2, 3].includes(v.group)) fail(at, `grupo inválido: ${v.group}`);
  if (!Array.isArray(v.lessons) || !v.lessons.length) fail(at, 'sem lição de origem');

  /* --- fonte existe --- */
  for (const l of v.lessons || []) {
    if (!LESSONS[l]) fail(at, `referência de lição inexistente: "${l}"`);
  }

  /* --- duplicata injustificada --- */
  /* Dois verbos podem compartilhar o ます形 (きます = vir / vestir); o que
     não pode é o mesmo ます形 COM o mesmo grupo e o mesmo significado. */
  const key = `${v.masu}|${v.group}`;
  if (seenPairs.has(key)) {
    fail(at, `duplicata injustificada: ${v.masu} já existe no Grupo ${v.group} como "${seenPairs.get(key)}"`);
  } else {
    seenPairs.set(key, v.id);
  }

  /* --- grupo coerente com a forma --- */
  const det = detectGroup(v.masu);
  if (det.group && det.certain && det.group !== v.group) {
    fail(at, `grupo declarado ${v.group}, mas a forma indica ${det.group} — ${det.reason}`);
  }

  /* --- formas: motor × banco --- */
  const off = new Set(v.notTaught || []);
  for (const form of FORMS) {
    if (off.has(form)) {
      if (v[form] !== null && v[form] !== undefined) {
        fail(at, `${form} está marcada como não sustentada, mas o banco traz "${v[form]}"`);
      }
      if (!v.notTaughtReason) fail(at, 'usa notTaught sem notTaughtReason documentado');
      continue;
    }

    const stored = v[form];
    if (stored === null || stored === undefined || stored === '') {
      fail(at, `forma faltando: ${form}`);
      continue;
    }
    if (normalize(stored) !== stored) {
      fail(at, `${form} = "${stored}" contém espaço ou caractere que a normalização remove`);
    }

    let calc;
    try {
      calc = conjugate(v, form);
    } catch (err) {
      fail(at, `motor não consegue conjugar ${form}: ${err.message}`);
      continue;
    }
    if (calc.value !== stored) {
      fail(at, `conjugação divergente em ${form}: banco "${stored}" × motor "${calc.value}"`);
    }

    /* --- resposta aceita não vazia --- */
    const accepted = acceptedAnswers(v, form);
    if (!accepted.length) fail(at, `${form} sem nenhuma resposta aceita`);
    if (accepted.some(a => !a)) fail(at, `${form} tem resposta aceita vazia`);

    /* --- variante em kanji coerente --- */
    if (v.kanji) {
      const kv = kanjiVariant(v, form);
      if (!kv) {
        fail(at, `tem kanji "${v.kanji}" mas não gera variante em kanji para ${form}`);
      } else if (/[ぁ-ん]/.test(v.kanji[0]) === false && kv.includes(stored)) {
        /* Nada a fazer: coincidência aceitável. */
      }
    }

    /* --- explicação completa (§44) --- */
    let ex;
    try {
      ex = explain(v, form);
    } catch (err) {
      fail(at, `sem explicação para ${form}: ${err.message}`);
      continue;
    }
    if (!ex.rule || ex.rule.trim().length < 4) fail(at, `${form}: regra vazia na explicação`);
    if (!ex.steps || ex.steps.length < 2) fail(at, `${form}: transformação sem passos`);
    if (!ex.source || !ex.source.includes('Rikai')) fail(at, `${form}: fonte ausente na explicação`);
    if (ex.source !== citeForm(form)) fail(at, `${form}: fonte "${ex.source}" difere da declarada`);
    const txt = stepsToText(ex.steps);
    if (!txt.trim().endsWith(stored)) {
      fail(at, `${form}: a transformação não termina na resposta ("${txt.split('\n').pop()}")`);
    }
    if (/revise as regras/i.test(ex.rule)) fail(at, `${form}: feedback genérico`);

    /* --- irregularidade tratada --- */
    if (v.irregular && (v.irregularForms || []).includes(form) && !calc.exception) {
      fail(at, `${form} declarada irregular, mas o motor não registrou exceção`);
    }
    if (!v.irregular && calc.exception && calc.exception.rule?.startsWith('Exceção')) {
      fail(at, `${form}: motor aplicou exceção, mas o verbo não está marcado como irregular`);
    }

    /* --- dicas não entregam a resposta (§29) --- */
    const hs = hints(v, form);
    if (hs.length < 2) fail(at, `${form}: menos de duas dicas progressivas`);
    hs.forEach((hint, i) => {
      if (!hint || !hint.trim()) fail(at, `${form}: dica ${i + 1} vazia`);
      if (hint.includes(stored)) fail(at, `${form}: dica ${i + 1} entrega a resposta ("${hint}")`);
      const kv = v.kanji ? kanjiVariant(v, form) : null;
      if (kv && hint.includes(kv)) fail(at, `${form}: dica ${i + 1} entrega a resposta em kanji`);
    });

    /* --- diagnóstico existe para respostas erradas plausíveis --- */
    const wrongs = plausibleWrongAnswers(v, form, stored);
    for (const w of wrongs) {
      const d = diagnose(v, form, w);
      if (!d) { fail(at, `${form}: "${w}" foi aceita como correta, mas não deveria`); continue; }
      if (!d.message || !d.message.trim()) fail(at, `${form}: erro "${w}" sem mensagem de diagnóstico`);
      if (/^revise/i.test(d.message)) fail(at, `${form}: diagnóstico genérico para "${w}"`);
    }
  }

  /* --- たり: derivada da た, nunca tabela própria (Lição 16) --- */
  if (!off.has('tari')) {
    if (off.has('ta')) {
      fail(at, 'たり é treinável mas た não é — たり deriva de た');
    } else if (v.tari !== v.ta + 'り') {
      fail(at, `たり precisa ser た + り: ${v.ta} + り ≠ ${v.tari}`);
    }
    try {
      const taCalc = conjugate(v, 'ta');
      const tariCalc = conjugate(v, 'tari');
      if (tariCalc.derivedFrom?.form !== 'ta') fail(at, 'o motor não derivou たり da forma た');
      if (Boolean(taCalc.exception) !== Boolean(tariCalc.exception)) {
        fail(at, 'たり não herdou a irregularidade da forma た');
      }
    } catch (err) {
      fail(at, `motor falhou em たり: ${err.message}`);
    }
  } else if (!off.has('ta')) {
    fail(at, 'たり marcada como não sustentada sem que た também seja — notTaught não se copia sem justificativa');
  }

  /* --- irregular declarado precisa dizer onde --- */
  if (v.irregular && v.group === 1 && !(v.irregularForms || []).length) {
    fail(at, 'marcado como irregular no Grupo 1 sem indicar quais formas');
  }

  /* --- kanji só quando atestado (aviso, não falha: a checagem dura é
         a auditoria manual das fontes, registrada em AUDITORIA.md) --- */
  if (v.kanji && !v.kanji.endsWith('ます')) {
    fail(at, `campo kanji deve ser a forma ます em kanji, veio "${v.kanji}"`);
  }
}

/* ------------------------------------------------------------------
   3. Cobertura mínima
   ------------------------------------------------------------------ */
const byGroup = { 1: 0, 2: 0, 3: 0 };
VERBS.forEach(v => { byGroup[v.group] = (byGroup[v.group] || 0) + 1; });
for (const g of [1, 2, 3]) {
  if (byGroup[g] < 3) fail('cobertura', `apenas ${byGroup[g]} verbo(s) no Grupo ${g}`);
}
const combos = VERBS.reduce(
  (n, v) => n + FORMS.filter(f => !(v.notTaught || []).includes(f)).length, 0
);

/* Verbos exigidos pelos testes do §46 precisam existir. */
for (const id of ['ikimasu', 'kaimasu', 'nomimasu', 'oyogimasu', 'hanashimasu', 'tabemasu', 'shimasu', 'kimasu_kuru']) {
  if (!VERBS.some(v => v.id === id)) fail('cobertura', `verbo obrigatório do §46 ausente: ${id}`);
}

/* ------------------------------------------------------------------
   Respostas erradas plausíveis, para provar que o diagnóstico responde.
   ------------------------------------------------------------------ */
function plausibleWrongAnswers(v, form, correct) {
  const out = new Set();
  /* outra forma do mesmo verbo */
  for (const f of FORMS) {
    if (f === form || !v[f]) continue;
    if (v[f] !== correct) out.add(v[f]);
  }
  /* manteve ます */
  if (v.masu !== correct) out.add(v.masu);
  /* regra de outro grupo */
  for (const g of [1, 2, 3]) {
    if (g === v.group) continue;
    try {
      const alt = conjugate({ masu: v.masu, group: g }, form).value;
      if (alt !== correct) out.add(alt);
    } catch { /* impossível para este verbo */ }
  }
  /* regra geral onde há exceção */
  if (v.irregular && (v.irregularForms || []).includes(form)) {
    try {
      const reg = conjugate(v, form, { ignoreExceptions: true }).value;
      if (reg !== correct) out.add(reg);
    } catch {}
  }
  /* い → あ na forma ない */
  if ((form === 'nai' || form === 'nakatta') && v.group === 1) {
    const stem = v.masu.slice(0, -2);
    if (stem.slice(-1) === 'い') {
      out.add(stem.slice(0, -1) + 'あ' + (form === 'nai' ? 'ない' : 'なかった'));
    }
  }
  /* たり: parou na た, pulou a た, raiz + たり, partiu da て, exceção */
  if (form === 'tari') {
    const stem = v.masu.slice(0, -2);
    out.add(v.ta);
    out.add(stem + 'り');
    out.add(stem + 'たり');
    if (v.te) out.add(v.te + 'り');
    try { out.add(conjugate(v, 'ta', { ignoreExceptions: true }).value + 'り'); } catch {}
  }
  /* algo simplesmente errado */
  out.add('あああ');
  out.delete(correct);
  return [...out];
}

/* ------------------------------------------------------------------
   Relatório
   ------------------------------------------------------------------ */
const forms = FORMS.map(f => FORM_LABEL[f]).join(' · ');
console.log('活用ラボ — verificação de conteúdo\n');
console.log(`  verbos:            ${VERBS.length}`);
console.log(`  por grupo:         G1 ${byGroup[1]} · G2 ${byGroup[2]} · G3 ${byGroup[3]}`);
console.log(`  formas treinadas:  ${forms}`);
console.log(`  combinações:       ${combos} (verbo × forma)`);
console.log(`  lições citadas:    ${Object.keys(LESSONS).join(', ')}`);
console.log('');

if (warnings.length) {
  console.log(`AVISOS (${warnings.length}):`);
  warnings.forEach(w => console.log(`  ~ ${w}`));
  console.log('');
}

if (problems.length) {
  console.error(`FALHOU — ${problems.length} problema(s):\n`);
  problems.forEach(p => console.error(`  ✗ ${p}`));
  console.error('');
  process.exit(1);
}

console.log('OK — banco, motor, explicações, dicas e fontes estão coerentes.');
