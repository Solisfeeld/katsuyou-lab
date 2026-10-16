/* ===================================================================
   Forma たり — Básico Rikai, Lição 16.

   Auditoria da fonte (Licao16_Basico1Rikai.pdf):
     "…utiliza-se a expressão 'V たり、V たり しています'. O verbo deverá
      estar na forma TA (ver lição 13) acrescentando-se 'り'."

   O Rikai não dá nome próprio à peça, usa しています (nem します nem する)
   e ensina a função de enumerar alguns exemplos de atividades ou hábitos.
   O treino é só a peça verbal Vたり, derivada da Forma た.
   =================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'https://katsuyou-lab.netlify.app/', pretendToBeVisual: true
});
dom.window.scrollTo = () => {};
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.Blob = dom.window.Blob;
globalThis.FileReader = dom.window.FileReader;
dom.window.URL.createObjectURL = () => 'blob:t';
dom.window.URL.revokeObjectURL = () => {};
globalThis.URL = dom.window.URL;

const { App } = await import('../src/ui/app.js');
const { Session } = await import('../src/practice/engine.js');
const store = await import('../src/progress/store.js');
const backup = await import('../src/progress/backup.js');
const { conjugate, FORMS, FORM_LABEL } = await import('../src/conjugation/rules.js');
const { VERBS, verbById } = await import('../src/data/verbs.js');
const { explain, hints, stepsToText } = await import('../src/conjugation/explain.js');
const { diagnose } = await import('../src/conjugation/diagnose.js');
const { isCorrect } = await import('../src/conjugation/normalize.js');
const { FORM_SOURCE } = await import('../src/data/sources.js');

const root = document.getElementById('app');
const app = new App(root);
const text = () => root.textContent;
const c = (id, form) => conjugate(verbById(id), form).value;
const btn = label => [...root.querySelectorAll('button')].find(b => b.textContent.trim() === label);

function reset() {
  localStorage.clear();
  store.resetAll();
  delete window.KatsuyouSync;
}
function cruzarMeta(s, extraSeg = 5) {
  s.startedAt = Date.now() - (s.config.minutes * 60_000 + extraSeg * 1000);
}
const answer = (id, f) => ({ verbId: id, form: f, correct: true, hinted: false, dontKnow: false, answer: verbById(id)[f] });

/* ===================================================================
   Modelo
   =================================================================== */

test('a Forma たり fica entre ない e なかった, na ordem da Lição 16', () => {
  assert.deepEqual(FORMS, ['te', 'dictionary', 'ta', 'nai', 'tari', 'nakatta']);
  assert.equal(FORM_LABEL.tari, 'Forma たり');
  assert.deepEqual(FORM_SOURCE.tari, { primary: 'L16', also: ['L13'] });
});

const TABELA = {
  nomimasu: ['のんだ', 'のんだり'],
  kaimasu: ['かった', 'かったり'],
  kakimasu: ['かいた', 'かいたり'],
  oyogimasu: ['およいだ', 'およいだり'],
  hanashimasu: ['はなした', 'はなしたり'],
  tabemasu: ['たべた', 'たべたり'],
  ikimasu: ['いった', 'いったり'],
  shimasu: ['した', 'したり'],
  kimasu_kuru: ['きた', 'きたり'],
  benkyoushimasu: ['べんきょうした', 'べんきょうしたり'],
  mottekimasu: ['もってきた', 'もってきたり']
};

for (const [id, [ta, tari]] of Object.entries(TABELA)) {
  test(`${verbById(id).masu}: た → ${ta} ／ たり → ${tari} (motor e banco)`, () => {
    assert.equal(c(id, 'ta'), ta);
    assert.equal(c(id, 'tari'), tari);
    assert.equal(verbById(id).ta, ta);
    assert.equal(verbById(id).tari, tari);
  });
}

test('todo verbo do banco tem たり = た + り, e o motor deriva da た', () => {
  for (const v of VERBS) {
    assert.equal(v.tari, v.ta + 'り', v.id);
    const calc = conjugate(v, 'tari');
    assert.equal(calc.value, v.tari, v.id);
    assert.equal(calc.derivedFrom.form, 'ta', v.id);
    assert.equal(calc.derivedFrom.value, v.ta, v.id);
  }
});

test('os 48 verbos treinam たり — inclusive あります, sem copiar notTaught', () => {
  assert.equal(VERBS.length, 48);
  for (const v of VERBS) assert.ok(!(v.notTaught || []).includes('tari'), v.id);
  const aru = verbById('arimasu');
  assert.equal(aru.tari, 'あったり');
  assert.deepEqual(aru.notTaught, ['nai', 'nakatta'], 'a decisão sobre ない/なかった continua');
});

test('a exceção de いきます é herdada da Forma た', () => {
  const calc = conjugate(verbById('ikimasu'), 'tari');
  assert.ok(calc.exception, 'a たり carrega a exceção');
  assert.match(calc.exception.rule, /いった/);
  assert.equal(conjugate(verbById('ikimasu'), 'tari', { ignoreExceptions: true }).value, 'いいたり');
  assert.equal(conjugate({ masu: '行きます', group: 1 }, 'tari').value, '行ったり');
});

test('o universo treinável é recalculado do banco e ganha um par por verbo', () => {
  const soma = formas => VERBS.reduce((n, v) => n + formas.filter(f => !(v.notTaught || []).includes(f)).length, 0);
  const depois = soma(FORMS);
  const antes = soma(FORMS.filter(f => f !== 'tari'));
  assert.equal(store.TRAINABLE_COMBOS, depois);
  assert.equal(depois - antes, VERBS.length, 'todos os 48 verbos ganharam たり');
});

/* ===================================================================
   Resposta, explicação e dicas
   =================================================================== */

test('a resposta é a peça Vたり — não "…たりします"', () => {
  const v = verbById('nomimasu');
  assert.ok(isCorrect(v, 'tari', 'のんだり'));
  assert.ok(isCorrect(v, 'tari', '飲んだり'), 'kanji do Rikai aceito');
  assert.ok(isCorrect(verbById('ikimasu'), 'tari', '行ったり'));
  assert.equal(isCorrect(v, 'tari', 'のんだりします'), false);
  assert.equal(isCorrect(v, 'tari', 'のんだりしています'), false);
});

test('a explicação passa pela Forma た e cita a Lição 16', () => {
  const e = explain(verbById('nomimasu'), 'tari');
  assert.equal(stepsToText(e.steps), [
    'のみます',
    '↓ Forma た (Grupo 1: に・び・み → んだ)',
    'のんだ',
    '↓ + り',
    'のんだり'
  ].join('\n'));
  assert.match(e.rule, /Forma た/);
  assert.equal(e.derivedFrom.swap, 'た → たり');
  assert.equal(e.source, 'Básico Rikai · Lição 16');
  assert.ok(e.sourceExtra.includes('Básico Rikai · Lição 13'));
});

test('a explicação de いきます mostra a exceção herdada', () => {
  const e = explain(verbById('ikimasu'), 'tari');
  assert.match(stepsToText(e.steps), /Exceção: いきます → いった/);
  assert.ok(stepsToText(e.steps).endsWith('いったり'));
});

test('dicas: primeiro a Forma た, depois a た deste verbo + り', () => {
  assert.deepEqual(hints(verbById('nomimasu'), 'tari'), [
    'Primeiro pense na Forma た.',
    'のみます → のんだ. Agora acrescente り.'
  ]);
  for (const v of VERBS) {
    for (const h of hints(v, 'tari')) assert.ok(!h.includes(v.tari), `${v.id}: "${h}" entrega a resposta`);
  }
});

/* ===================================================================
   Diagnóstico
   =================================================================== */

test('Forma た sem り é diagnosticada', () => {
  const d = diagnose(verbById('nomimasu'), 'tari', 'のんだ');
  assert.equal(d.code, 'ta-for-tari');
  assert.equal(d.message, 'のんだ é a Forma た. Para formar たり, acrescente り: のんだり.');
});

test('raiz + り (sem passar pela た) é diagnosticada', () => {
  const d = diagnose(verbById('tabemasu'), 'tari', 'たべり');
  assert.equal(d.code, 'tari-without-ta');
  assert.match(d.message, /Primeiro forme たべた; depois acrescente り: たべたり\./);
});

test('raiz + たり é diagnosticada mostrando o caminho pela た', () => {
  const d = diagnose(verbById('nomimasu'), 'tari', 'のみたり');
  assert.equal(d.code, 'tari-on-stem');
  assert.match(d.detail, /のんだ/);
});

test('いいたり: a exceção da た esquecida', () => {
  const d = diagnose(verbById('ikimasu'), 'tari', 'いいたり');
  assert.equal(d.code, 'missed-exception');
  assert.match(d.detail, /いった/);
  assert.match(d.detail, /いったり/);
});

test('outras formas e outros tropeços também são diagnosticados', () => {
  const v = verbById('nomimasu');
  assert.equal(diagnose(v, 'tari', 'のんで').code, 'other-form-same-verb');
  assert.equal(diagnose(v, 'tari', 'のんでり').code, 'te-for-tari');
  assert.equal(diagnose(v, 'tari', 'のんたり').code, 'voicing');
  const inv = diagnose(v, 'ta', 'のんだり');
  assert.equal(inv.code, 'other-form-same-verb');
  assert.match(inv.message, /Forma たり/);
});

/* ===================================================================
   Sessão: Não sei, erro, reapresentação, soft ending
   =================================================================== */

test('"Não sei" em たり mostra o caminho e conta', () => {
  reset();
  const s = new Session({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'tari' }], length: 1 });
  const r = s.dontKnow();
  assert.equal(r.dontKnow, true);
  assert.equal(r.explanation.derivedFrom.form, 'ta');
  assert.equal(store.getPair('nomimasu', 'tari').dontKnow, 1);
});

test('erro em たり antes da meta é registrado e reapresentado', () => {
  reset();
  const Q = [{ verbId: 'nomimasu', form: 'tari' }, { verbId: 'tabemasu', form: 'te' }, { verbId: 'kakimasu', form: 'ta' }];
  const s = new Session({ mode: 'review', queue: Q, limitKind: 'count', length: 3 });
  const antes = s.remaining;
  const r = s.submit('のみたり');
  assert.equal(r.correct, false);
  assert.equal(s.remaining, antes + 1, 'volta para a fila');
  assert.equal(store.getPair('nomimasu', 'tari').wrong, 1);
  const e = store.getState().recentErrors[0];
  assert.equal(e.form, 'tari');
  assert.equal(e.correct, 'のんだり');
});

test('soft ending: questão de たり aberta na meta termina e conta', () => {
  reset();
  const Q = [{ verbId: 'nomimasu', form: 'tari' }, { verbId: 'tabemasu', form: 'tari' }];
  const s = new Session({ mode: 'review', queue: Q, limitKind: 'time', minutes: 5, length: 2 });
  cruzarMeta(s);
  assert.equal(s.phase, 'asking', 'a questão continua aberta');
  const r = s.submit('のんだり');
  assert.equal(r.correct, true);
  assert.equal(s.answered, 1);
  s.next();
  assert.equal(s.phase, 'done', 'nenhuma questão nova depois da meta');
});

test('soft ending: erro em たり depois da meta não é reapresentado', () => {
  reset();
  const Q = [{ verbId: 'nomimasu', form: 'tari' }, { verbId: 'tabemasu', form: 'tari' }];
  const s = new Session({ mode: 'review', queue: Q, limitKind: 'time', minutes: 5, length: 2 });
  cruzarMeta(s);
  const antes = s.remaining;
  s.submit('のんだ');
  assert.equal(s.remaining, antes);
  assert.equal(store.getPair('nomimasu', 'tari').wrong, 1);
});

/* ===================================================================
   Progresso, matriz, pontos fracos
   =================================================================== */

test('progresso, matriz e pontos fracos incluem たり', () => {
  reset();
  store.recordAnswer(answer('tabemasu', 'tari'));
  for (let i = 0; i < 3; i++) {
    store.recordAnswer({ verbId: 'kaimasu', form: 'tari', correct: false, hinted: false, dontKnow: false, answer: 'かいたり' });
  }
  assert.equal(store.statsByForm().tari.seen, 4);
  const linha = store.masteryMatrix().find(r => r.verb.id === 'arimasu');
  assert.equal(linha.cells.tari, 'new', 'あります × たり é treinável');
  assert.equal(linha.cells.nai, null);
  assert.ok(store.weakPairs(10).some(w => w.verbId === 'kaimasu' && w.form === 'tari'));
});

test('a interface mostra たり no seletor, na home, na matriz e na referência', () => {
  reset();
  app.go('home');
  assert.ok(text().includes('たり'), 'home');
  app.go('setup', { mode: 'form' });
  assert.ok([...root.querySelectorAll('.chip')].some(ch => ch.textContent === 'Forma たり'), 'seletor');
  store.recordAnswer(answer('nomimasu', 'tari'));
  app.go('progress');
  assert.ok([...root.querySelectorAll('table.matrix thead th')].some(th => th.textContent === 'たり'), 'matriz');
  assert.ok(text().includes('Forma たり'), 'estatística por forma');
  app.go('reference');
  root.querySelectorAll('.ref-head').forEach(b => b.click());
  for (const frag of ['Forma たり', 'V たり、V たり しています', 'のんだ → のんだり', 'いった → いったり']) {
    assert.ok(text().includes(frag), `referência sem "${frag}"`);
  }
});

test('referência de たり: uso, formação, padrão, verbo final, exemplo do Básico Rikai e treino', () => {
  reset();
  app.go('reference');
  const sec = [...root.querySelectorAll('.ref-sec')]
    .find(s => s.querySelector('.ref-head').textContent.includes('Forma たり'));
  const corpo = sec.querySelector('.ref-body').textContent;
  const posicoes = [
    'citar algumas ações como exemplos',
    '休みの 日は、本を 読んだり、ゲームを したり します。',
    'Como formar', 'Forma た + り', 'のんだ → のんだり', 'いった → いったり',
    'V たり、V たり する', 'V たり、V たり します',
    'O verbo final pode mudar', 'As partes com たり ficam iguais', 'Quem muda é o する do final',
    'Não passado', 'Passado', 'Nos dois casos, 読んだり e したり não mudam',
    'Exemplo do Básico Rikai — Lição 16', 'V たり、V たり しています',
    'たり não precisa terminar sempre em しています',
    'o treino pede apenas a peça Vたり'
  ].map(frag => {
    const i = corpo.indexOf(frag);
    assert.ok(i >= 0, `a seção たり não menciona "${frag}"`);
    return i;
  });
  assert.deepEqual(posicoes, [...posicoes].sort((a, b) => a - b), 'a ordem da explicação mudou');
  for (const vago of ['O Rikai não dá um nome', 'É um uso do mesmo padrão', 'não a única forma possível']) {
    assert.ok(!corpo.includes(vago), `voltou o trecho vago "${vago}"`);
  }

  /* Não passado × passado: só o する final muda (os espaços do estilo Rikai são ignorados). */
  const linhas = new Map([...sec.querySelectorAll('.ref-table tr')]
    .map(tr => [tr.children[0].textContent, tr.children[1].textContent.replace(/\s/g, '')]));
  assert.equal(linhas.get('Não passado'), '読んだり、したりします');
  assert.equal(linhas.get('Passado'), '読んだり、したりしました');

  /* "Lição 16" nunca aparece sem dizer que é do Básico Rikai. */
  const antesDaLicao = sec.textContent.split('Lição 16').slice(0, -1);
  assert.ok(antesDaLicao.length >= 2, 'título e rodapé citam a Lição 16');
  for (const trecho of antesDaLicao) assert.match(trecho, /Básico Rikai [—·] $/);

  /* Rikai e fonte complementar citados só onde valem. */
  const rodape = sec.querySelector('.src-line');
  assert.ok(rodape.textContent.includes('Básico Rikai · Lição 16'));
  const comComplemento = [...root.querySelectorAll('.src-line')]
    .filter(l => l.textContent.includes('Fonte complementar'));
  assert.equal(comComplemento.length, 1, 'só a seção たり cita a fonte complementar');
  assert.equal(comComplemento[0], rodape);
});

test('feedback de erro na tela explica pela Forma た', () => {
  reset();
  app.startSession({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'tari' }], length: 1 });
  assert.ok(text().includes('Forma たり'));
  root.querySelector('input.answer').value = 'のみたり';
  btn('Responder').click();
  const t = text();
  assert.ok(t.includes('✗ Ainda não'));
  assert.ok(t.includes('のんだり'));
  assert.ok(t.includes('Vem da Forma た'));
  assert.ok(t.includes('た → たり'));
  assert.ok(t.includes('Básico Rikai · Lição 16'));
});

/* ===================================================================
   Compatibilidade: estado, backup e snapshot antigos
   =================================================================== */

/* Progresso gravado antes de たり existir. */
function progressoAntigo() {
  return {
    version: 2,
    pairs: {
      'nomimasu|te': { seen: 4, right: 4, wrong: 0, hinted: 0, dontKnow: 0, streak: 4, mastery: 'mastered' },
      'kaimasu|nai': { seen: 3, right: 1, wrong: 2, hinted: 0, dontKnow: 0, streak: 0, mastery: 'learning' }
    },
    groupPractice: { nomimasu: { seen: 2, right: 2, wrong: 0, hinted: 0, dontKnow: 0, streak: 2 } },
    sessions: [{ at: 1, answered: 7, correct: 5, perForm: { te: { seen: 4, right: 4 } }, wrongItems: [] }],
    recentErrors: [{ at: 1, verbId: 'kaimasu', form: 'nai', masu: 'かいます', given: 'かあない', correct: 'かわない' }],
    settings: { hideGroup: true }
  };
}

function conferePreservado() {
  const s = store.getState();
  assert.equal(store.getPair('nomimasu', 'te').right, 4, 'par antigo intacto');
  assert.equal(store.getPair('kaimasu', 'nai').wrong, 2, 'par antigo intacto');
  assert.equal(s.sessions.length, 1, 'sessões antigas intactas');
  assert.equal(s.recentErrors.length, 1, 'erros antigos intactos');
  assert.equal(s.groupPractice.nomimasu.right, 2);
  assert.equal(s.settings.hideGroup, true);
  assert.equal(store.getPair('nomimasu', 'tari').seen, 0, 'たり começa sem histórico');
  assert.equal(store.masteryMatrix().find(r => r.verb.id === 'nomimasu').cells.tari, 'new');
  const counts = store.overallCounts();
  assert.equal(counts.practiced, 2);
  assert.equal(counts.trainable, store.TRAINABLE_COMBOS, 'o total cresceu sem perder nada');
}

test('estado local antigo, sem たり, carrega sem perder nada', () => {
  reset();
  localStorage.setItem(store.STORAGE_KEY, JSON.stringify(progressoAntigo()));
  store.replaceState(store.load());
  conferePreservado();
});

test('backup antigo, anterior à たり, continua importável', () => {
  reset();
  const r = backup.importBackupText(JSON.stringify({
    app: 'katsuyou-lab', formatVersion: 1, exportedAt: '2026-08-21T00:00:00.000Z', progress: progressoAntigo()
  }));
  assert.equal(r.ok, true);
  conferePreservado();
});

test('snapshot antigo vindo da sincronização é aceito e a たり passa a ser gravada', () => {
  reset();
  store.replaceState(progressoAntigo());          // o mesmo caminho do auth-sync
  conferePreservado();
  store.recordAnswer(answer('nomimasu', 'tari'));
  assert.equal(store.sanitizeProgress(store.getState()).pairs['nomimasu|tari'].right, 1,
    'o par novo sobrevive ao saneamento, ao backup e à sincronização');
  assert.ok(backup.buildBackup().progress.pairs['nomimasu|tari']);
});
