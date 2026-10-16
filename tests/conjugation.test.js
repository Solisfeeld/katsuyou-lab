/* ===================================================================
   Testes obrigatórios do §46 do briefing, mais os casos de borda que a
   auditoria das fontes Rikai revelou.
   =================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';

import { conjugate, conjugateAll, detectGroup, FORMS } from '../src/conjugation/rules.js';
import { VERBS, VERBS_BY_ID, verbById } from '../src/data/verbs.js';
import { normalize, isCorrect, acceptedAnswers, kanjiVariant } from '../src/conjugation/normalize.js';
import { explain, hints, stepsToText } from '../src/conjugation/explain.js';
import { diagnose } from '../src/conjugation/diagnose.js';

/* Conjuga pelo id do banco e devolve o valor calculado pelo motor. */
const c = (id, form) => conjugate(verbById(id), form).value;

/* -------------------------------------------------------------------
   §46 — tabela obrigatória
   ------------------------------------------------------------------- */
const REQUIRED = {
  ikimasu: { dictionary: 'いく', te: 'いって', ta: 'いった', nai: 'いかない', nakatta: 'いかなかった' },
  kaimasu: { dictionary: 'かう', te: 'かって', ta: 'かった', nai: 'かわない', nakatta: 'かわなかった' },
  nomimasu: { dictionary: 'のむ', te: 'のんで', ta: 'のんだ', nai: 'のまない', nakatta: 'のまなかった' },
  oyogimasu: { te: 'およいで', ta: 'およいだ' },
  hanashimasu: { te: 'はなして', ta: 'はなした' },
  tabemasu: { dictionary: 'たべる', te: 'たべて', ta: 'たべた', nai: 'たべない', nakatta: 'たべなかった' },
  shimasu: { dictionary: 'する', te: 'して', ta: 'した', nai: 'しない', nakatta: 'しなかった' },
  kimasu_kuru: { dictionary: 'くる', te: 'きて', ta: 'きた', nai: 'こない', nakatta: 'こなかった' }
};

for (const [id, forms] of Object.entries(REQUIRED)) {
  test(`§46 motor: ${id}`, () => {
    for (const [form, expected] of Object.entries(forms)) {
      assert.equal(c(id, form), expected, `${id} × ${form}`);
    }
  });

  test(`§46 banco: ${id}`, () => {
    const v = verbById(id);
    assert.ok(v, `verbo ${id} existe no banco`);
    for (const [form, expected] of Object.entries(forms)) {
      assert.equal(v[form], expected, `banco ${id} × ${form}`);
    }
  });
}

/* -------------------------------------------------------------------
   Motor × banco: as duas camadas do §43 têm de concordar em tudo.
   ------------------------------------------------------------------- */
test('motor e banco concordam em todas as combinações treináveis', () => {
  for (const v of VERBS) {
    const off = new Set(v.notTaught || []);
    for (const form of FORMS) {
      if (off.has(form)) {
        assert.equal(v[form], null, `${v.id} × ${form} deveria estar vazio (não sustentado)`);
        continue;
      }
      assert.equal(conjugate(v, form).value, v[form], `${v.id} × ${form}`);
    }
  }
});

/* -------------------------------------------------------------------
   Exceções e casos especiais do §13
   ------------------------------------------------------------------- */
test('いきます é exceção só em て e た', () => {
  assert.equal(c('ikimasu', 'te'), 'いって');
  assert.equal(c('ikimasu', 'ta'), 'いった');
  /* As demais formas seguem a regra normal do Grupo 1. */
  assert.equal(c('ikimasu', 'dictionary'), 'いく');
  assert.equal(c('ikimasu', 'nai'), 'いかない');
});

test('いきます sem a exceção produziria いいて — usado no diagnóstico', () => {
  const regular = conjugate(verbById('ikimasu'), 'te', { ignoreExceptions: true });
  assert.equal(regular.value, 'いいて');
});

test('あります tem て/辞書/た, mas ない e なかった ficam fora (não sustentado pelo Rikai)', () => {
  const v = verbById('arimasu');
  assert.equal(v.te, 'あって');
  assert.equal(v.dictionary, 'ある');
  assert.equal(v.ta, 'あった');
  assert.equal(v.nai, null);
  assert.equal(v.nakatta, null);
  assert.deepEqual(v.notTaught, ['nai', 'nakatta']);
});

test('かいます: い → わ na forma ない, não あ', () => {
  assert.equal(c('kaimasu', 'nai'), 'かわない');
  assert.notEqual(c('kaimasu', 'nai'), 'かあない');
  assert.equal(c('kaimasu', 'nakatta'), 'かわなかった');
});

test('きます é dois verbos distintos: 着ます (G2) e きます (G3)', () => {
  const kiru = verbById('kimasu_kiru');
  const kuru = verbById('kimasu_kuru');
  assert.equal(kiru.masu, kuru.masu);
  assert.equal(kiru.dictionary, 'きる');
  assert.equal(kuru.dictionary, 'くる');
  assert.equal(kiru.nai, 'きない');
  assert.equal(kuru.nai, 'こない');
  /* Nas formas て e た os dois coincidem — é o que torna o par instrutivo. */
  assert.equal(kiru.te, kuru.te);
  assert.equal(kiru.ta, kuru.ta);
});

test('compostos do Grupo 3 flexionam só a parte irregular', () => {
  assert.equal(c('benkyoushimasu', 'dictionary'), 'べんきょうする');
  assert.equal(c('benkyoushimasu', 'nai'), 'べんきょうしない');
  assert.equal(c('mottekimasu', 'dictionary'), 'もってくる');
  assert.equal(c('mottekimasu', 'nai'), 'もってこない');
  assert.equal(c('mottekimasu', 'nakatta'), 'もってこなかった');
});

/* -------------------------------------------------------------------
   §23 — なかった deriva de ない
   ------------------------------------------------------------------- */
test('なかった é derivada da forma ない e mostra essa relação', () => {
  const r = conjugate(verbById('nomimasu'), 'nakatta');
  assert.equal(r.value, 'のまなかった');
  assert.equal(r.derivedFrom.form, 'nai');
  assert.equal(r.derivedFrom.value, 'のまない');
  const txt = stepsToText(r.steps);
  assert.match(txt, /のまない/);
  assert.match(txt, /retirar い de ない/);
  assert.match(txt, /のまなかった/);
});

test('toda forma なかった do banco termina em なかった', () => {
  for (const v of VERBS) {
    if (!v.nakatta) continue;
    assert.ok(v.nakatta.endsWith('なかった'), `${v.id}: ${v.nakatta}`);
    assert.equal(v.nakatta, v.nai.slice(0, -1) + 'かった', `${v.id} deriva de ${v.nai}`);
  }
});

/* -------------------------------------------------------------------
   §24 — a forma た reaproveita o padrão da forma て
   ------------------------------------------------------------------- */
test('a forma た expõe a relação com a forma て', () => {
  const pares = [
    ['kaimasu', 'って', 'った'],
    ['nomimasu', 'んで', 'んだ'],
    ['kakimasu', 'いて', 'いた'],
    ['oyogimasu', 'いで', 'いだ'],
    ['hanashimasu', 'して', 'した']
  ];
  for (const [id, teEnd, taEnd] of pares) {
    const r = conjugate(verbById(id), 'ta');
    assert.ok(r.relation, `${id} deveria expor relation`);
    assert.equal(r.relation.swap, `${teEnd} → ${taEnd}`);
    assert.ok(r.relation.te.endsWith(teEnd));
    assert.ok(r.relation.ta.endsWith(taEnd));
  }
});

/* -------------------------------------------------------------------
   Detecção de grupo
   ------------------------------------------------------------------- */
test('detectGroup acerta os casos claros e admite dúvida onde o Rikai admite', () => {
  assert.equal(detectGroup('たべます').group, 2);
  assert.equal(detectGroup('たべます').certain, true);
  assert.equal(detectGroup('ねます').group, 2);
  assert.equal(detectGroup('のみます').group, 1);
  /* おきます é Grupo 2 tipo (iii): a forma não decide sozinha. */
  assert.equal(detectGroup('おきます').certain, false);
});

/* -------------------------------------------------------------------
   §41 — respostas aceitas
   ------------------------------------------------------------------- */
test('normalização apara espaços, espaço ideográfico e pontuação final', () => {
  const v = verbById('nomimasu');
  assert.ok(isCorrect(v, 'te', ' のんで '));
  assert.ok(isCorrect(v, 'te', 'のんで　'));
  assert.ok(isCorrect(v, 'te', 'のんで。'));
  assert.ok(isCorrect(v, 'te', 'の んで'));
});

test('aceita a grafia em kanji quando o Rikai apresenta o verbo em kanji', () => {
  assert.ok(isCorrect(verbById('nomimasu'), 'te', '飲んで'));
  assert.ok(isCorrect(verbById('tabemasu'), 'nai', '食べない'));
  assert.ok(isCorrect(verbById('ikimasu'), 'te', '行って'));
  assert.ok(isCorrect(verbById('ikimasu'), 'ta', '行った'));
  assert.equal(kanjiVariant(verbById('ikimasu'), 'te'), '行って');
});

test('verbo sem kanji no Rikai não gera variante inventada', () => {
  const v = verbById('kimasu_kuru');
  assert.equal(v.kanji, null);
  assert.equal(kanjiVariant(v, 'te'), null);
  assert.deepEqual(acceptedAnswers(v, 'te'), ['きて']);
});

test('não aceita erro por aproximação', () => {
  const v = verbById('kaimasu');
  assert.equal(isCorrect(v, 'nai', 'かあない'), false);
  assert.equal(isCorrect(v, 'te', 'かて'), false);
  assert.equal(isCorrect(v, 'te', 'カッテ'), false);
});

/* -------------------------------------------------------------------
   §21 — diagnóstico do erro
   ------------------------------------------------------------------- */
test('diagnóstico: resposta correta não gera diagnóstico', () => {
  assert.equal(diagnose(verbById('nomimasu'), 'te', 'のんで'), null);
});

test('diagnóstico: respondeu com outra forma do mesmo verbo', () => {
  const d = diagnose(verbById('nomimasu'), 'te', 'のんだ');
  assert.equal(d.code, 'ta-for-te');
  assert.match(d.message, /Forma た/);
  assert.match(d.message, /Forma て/);
});

test('diagnóstico: manteve ます', () => {
  const d = diagnose(verbById('nomimasu'), 'te', 'のみます');
  assert.equal(d.code, 'kept-masu');
});

test('diagnóstico: aplicou a regra de outro grupo', () => {
  /* のみます com regra de Grupo 2 daria のみて. */
  const d = diagnose(verbById('nomimasu'), 'te', 'のみて');
  assert.equal(d.code, 'wrong-group-rule');
  assert.match(d.message, /Grupo 2/);
  assert.match(d.message, /Grupo 1/);
});

test('diagnóstico: confundiu Grupo 2 com Grupo 1', () => {
  /* おきます é Grupo 2; pela regra do Grupo 1 daria おかない. */
  const d = diagnose(verbById('okimasu'), 'nai', 'おかない');
  assert.equal(d.code, 'wrong-group-rule');
  assert.match(d.detail, /tipo \(iii\)/);
});

test('diagnóstico: esqueceu a exceção de いきます', () => {
  const d = diagnose(verbById('ikimasu'), 'te', 'いいて');
  assert.equal(d.code, 'missed-exception');
  assert.match(d.detail, /いって/);
});

test('diagnóstico: esqueceu い → わ na forma ない', () => {
  const d = diagnose(verbById('kaimasu'), 'nai', 'かあない');
  assert.equal(d.code, 'nai-wa');
  assert.match(d.detail, /かわない/);
});

test('diagnóstico: erro de sonorização', () => {
  const d = diagnose(verbById('nomimasu'), 'te', 'のんて');
  assert.equal(d.code, 'voicing');
});

test('diagnóstico: parou na forma ない quando foi pedida なかった', () => {
  const d = diagnose(verbById('nomimasu'), 'nakatta', 'のまない');
  assert.equal(d.code, 'nai-for-nakatta');
  assert.match(d.detail, /のまなかった/);
});

test('diagnóstico: respondeu a forma de outro verbo', () => {
  const d = diagnose(verbById('nomimasu'), 'te', 'たべて');
  assert.equal(d.code, 'other-verb');
  assert.match(d.message, /たべます/);
});

test('diagnóstico nunca devolve mensagem genérica', () => {
  const v = verbById('nomimasu');
  for (const bad of ['のむで', 'ぜんぜん', 'のんでで', 'x']) {
    const d = diagnose(v, 'te', bad);
    assert.ok(d && d.message && d.message.length > 0);
    assert.doesNotMatch(d.message, /revise as regras/i);
  }
});

/* -------------------------------------------------------------------
   §44 — explicação específica para toda combinação treinável
   ------------------------------------------------------------------- */
test('toda combinação treinável gera explicação completa', () => {
  for (const v of VERBS) {
    const off = new Set(v.notTaught || []);
    for (const form of FORMS) {
      if (off.has(form)) continue;
      const e = explain(v, form);
      assert.ok(e.answer, `${v.id} × ${form}: sem resposta`);
      assert.ok(e.rule && e.rule.length > 3, `${v.id} × ${form}: sem regra`);
      assert.ok(e.steps.length >= 2, `${v.id} × ${form}: transformação curta demais`);
      assert.ok(e.source.includes('Rikai'), `${v.id} × ${form}: sem fonte Rikai`);
      assert.ok(e.groupLabel, `${v.id} × ${form}: sem grupo`);
      /* A transformação tem de terminar na resposta. */
      const txt = stepsToText(e.steps);
      assert.ok(txt.trim().endsWith(e.answer), `${v.id} × ${form}: passos não terminam na resposta`);
    }
  }
});

test('a transformação de のみます × て é a do briefing', () => {
  const e = explain(verbById('nomimasu'), 'te');
  assert.equal(stepsToText(e.steps), [
    'のみます',
    '↓ retirar ます',
    'のみ',
    '↓ final み',
    '↓ に・び・み → んで',
    'のんで'
  ].join('\n'));
  assert.equal(e.rule, 'Grupo 1: に・び・み → んで');
  assert.equal(e.source, 'Básico Rikai · Lição 01');
});

test('a transformação de かいます × ない mostra o caso especial い → わ', () => {
  const e = explain(verbById('kaimasu'), 'nai');
  const txt = stepsToText(e.steps);
  assert.match(txt, /linha \/i\/ → linha \/a\//);
  assert.match(txt, /い é um caso especial: vira わ, não あ/);
  assert.ok(txt.endsWith('かわない'));
  assert.equal(e.source, 'Básico Rikai · Lição 15');
});

/* -------------------------------------------------------------------
   §29 — dicas progressivas não entregam a resposta
   ------------------------------------------------------------------- */
test('nenhuma dica contém a resposta', () => {
  for (const v of VERBS) {
    const off = new Set(v.notTaught || []);
    for (const form of FORMS) {
      if (off.has(form)) continue;
      const [h1, h2] = hints(v, form);
      assert.ok(h1 && h2, `${v.id} × ${form}: dicas faltando`);
      for (const h of [h1, h2]) {
        assert.ok(!h.includes(v[form]), `${v.id} × ${form}: a dica "${h}" entrega a resposta`);
      }
    }
  }
});

test('a primeira dica é o grupo e a segunda é a regra', () => {
  const [h1, h2] = hints(verbById('nomimasu'), 'te');
  assert.equal(h1, 'É Grupo 1.');
  assert.match(h2, /に・び・み → んで/);
});

/* -------------------------------------------------------------------
   Integridade do banco
   ------------------------------------------------------------------- */
test('ids são únicos', () => {
  assert.equal(Object.keys(VERBS_BY_ID).length, VERBS.length);
});

test('todo verbo tem significado, grupo e lições', () => {
  for (const v of VERBS) {
    assert.ok(v.meaning && v.meaning.trim(), `${v.id} sem significado`);
    assert.ok([1, 2, 3].includes(v.group), `${v.id} com grupo inválido`);
    assert.ok(v.lessons && v.lessons.length, `${v.id} sem lição de origem`);
  }
});
