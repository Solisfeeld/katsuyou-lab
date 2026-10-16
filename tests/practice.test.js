/* ===================================================================
   Testes do agendamento, do progresso e do ciclo de uma sessão.
   §28 · §30 · §31 · §32 · §33 · §47
   =================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';

/* store.js e engine.js falam com localStorage; num teste de Node não há
   um. O stub é o mínimo para exercitar a lógica de progresso. */
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
  clear: () => mem.clear()
};
globalThis.window = globalThis;

const { buildQueue, buildGroupQueue, requeue, allPairs, REQUEUE_MIN, REQUEUE_MAX } =
  await import('../src/practice/scheduler.js');
const store = await import('../src/progress/store.js');
const { Session } = await import('../src/practice/engine.js');
const { VERBS, verbById } = await import('../src/data/verbs.js');
const { FORMS } = await import('../src/conjugation/rules.js');

function reset() { mem.clear(); store.resetAll(); }

/* -------------------------------------------------------------------
   Fila de sessão
   ------------------------------------------------------------------- */
test('allPairs ignora as combinações não sustentadas pelo Rikai', () => {
  const pairs = allPairs();
  assert.ok(!pairs.some(p => p.verbId === 'arimasu' && p.form === 'nai'));
  assert.ok(!pairs.some(p => p.verbId === 'arimasu' && p.form === 'nakatta'));
  assert.ok(pairs.some(p => p.verbId === 'arimasu' && p.form === 'te'));
});

test('a fila tem o tamanho pedido e não repete verbo × forma', () => {
  reset();
  const q = buildQueue({ mode: 'mixed', length: 20 });
  assert.equal(q.length, 20);
  const keys = q.map(x => `${x.verbId}|${x.form}`);
  assert.equal(new Set(keys).size, 20);
});

test('§31 a fila mistura formas e não repete o mesmo verbo em sequência', () => {
  reset();
  const q = buildQueue({ mode: 'mixed', length: 30 });
  for (let i = 1; i < q.length; i++) {
    assert.notEqual(q[i].verbId, q[i - 1].verbId, `verbo repetido em sequência na posição ${i}`);
  }
  const forms = new Set(q.map(x => x.form));
  assert.ok(forms.size >= 4, `esperava variedade de formas, veio ${[...forms].join(',')}`);
});

test('filtrar por forma e por grupo é respeitado', () => {
  reset();
  const q = buildQueue({ mode: 'form', forms: ['nai'], groups: [2], length: 10 });
  assert.ok(q.length > 0);
  for (const item of q) {
    assert.equal(item.form, 'nai');
    assert.equal(verbById(item.verbId).group, 2);
  }
});

test('a fila nunca excede o número de combinações disponíveis', () => {
  reset();
  const q = buildQueue({ mode: 'form', forms: ['te'], groups: [3], length: 50 });
  const disponiveis = VERBS.filter(v => v.group === 3).length;
  assert.equal(q.length, disponiveis);
});

test('treino de grupos gera perguntas de grupo', () => {
  reset();
  const q = buildGroupQueue({ length: 12 });
  assert.equal(q.length, 12);
  assert.ok(q.every(x => x.form === 'group'));
});

/* -------------------------------------------------------------------
   §33 — reapresentação
   ------------------------------------------------------------------- */
test('§33 o item errado volta entre 3 e 7 questões à frente, nunca na hora', () => {
  const queue = Array.from({ length: 15 }, (_, i) => ({ verbId: `v${i}`, form: 'te' }));
  for (let i = 0; i < 200; i++) {
    const out = requeue(queue, { verbId: 'errado', form: 'nai' });
    const at = out.findIndex(x => x.verbId === 'errado');
    assert.ok(at >= REQUEUE_MIN, `reapareceu cedo demais (posição ${at})`);
    assert.ok(at <= REQUEUE_MAX, `reapareceu tarde demais (posição ${at})`);
    assert.notEqual(at, 0, 'nunca pode ser a próxima questão');
  }
});

test('§33 numa fila curta o item vai para o fim, mas não para a frente', () => {
  const queue = [{ verbId: 'a', form: 'te' }];
  const out = requeue(queue, { verbId: 'errado', form: 'nai' });
  assert.equal(out.findIndex(x => x.verbId === 'errado'), 1);
});

/* -------------------------------------------------------------------
   §30 — domínio por verbo × forma
   ------------------------------------------------------------------- */
test('§30 o domínio é guardado por verbo × forma, separadamente', () => {
  reset();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  store.recordAnswer({ verbId: 'nomimasu', form: 'nai', correct: false, hinted: false, dontKnow: false, answer: 'のみない' });

  const te = store.getPair('nomimasu', 'te');
  const nai = store.getPair('nomimasu', 'nai');
  assert.equal(te.right, 1);
  assert.equal(te.wrong, 0);
  assert.equal(nai.right, 0);
  assert.equal(nai.wrong, 1);
  /* O mesmo verbo, formas diferentes, contadores independentes: a
     sequência de acertos de uma não contamina a outra. */
  assert.equal(te.streak, 1);
  assert.equal(nai.streak, 0);
  /* E o verbo como um todo não tem domínio próprio — só os pares têm. */
  assert.equal(store.getPair('nomimasu', 'ta').seen, 0);
});

test('domínio exige três acertos seguidos sem dica', () => {
  reset();
  const ans = () => store.recordAnswer({ verbId: 'tabemasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'たべて' });
  assert.equal(ans().mastery, 'learning');
  assert.equal(ans().mastery, 'almost');
  assert.equal(ans().mastery, 'mastered');
});

test('§29 acerto com dica não chega a dominado', () => {
  reset();
  const ans = () => store.recordAnswer({ verbId: 'tabemasu', form: 'te', correct: true, hinted: true, dontKnow: false, answer: 'たべて' });
  ans(); ans(); ans(); ans();
  assert.equal(store.getPair('tabemasu', 'te').mastery, 'almost');
});

test('errar derruba o domínio e zera a sequência', () => {
  reset();
  for (let i = 0; i < 3; i++) {
    store.recordAnswer({ verbId: 'tabemasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'たべて' });
  }
  assert.equal(store.getPair('tabemasu', 'te').mastery, 'mastered');
  store.recordAnswer({ verbId: 'tabemasu', form: 'te', correct: false, hinted: false, dontKnow: false, answer: 'たべた' });
  const p = store.getPair('tabemasu', 'te');
  assert.equal(p.mastery, 'learning');
  assert.equal(p.streak, 0);
});

test('§28 "Não sei" conta como não dominado e entra nos erros recentes', () => {
  reset();
  store.recordAnswer({ verbId: 'ikimasu', form: 'te', correct: false, dontKnow: true, hinted: false, answer: '' });
  const p = store.getPair('ikimasu', 'te');
  assert.equal(p.dontKnow, 1);
  assert.equal(p.mastery, 'learning');
  const err = store.getState().recentErrors[0];
  assert.equal(err.verbId, 'ikimasu');
  assert.equal(err.dontKnow, true);
  assert.equal(err.correct, 'いって');
});

test('§38 a chave de armazenamento é própria e não colide com o Bunpou Lab', () => {
  reset();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  assert.equal(store.STORAGE_KEY, 'katsuyou_lab_progress_v1');
  assert.ok(mem.has('katsuyou_lab_progress_v1'));
  assert.ok(!mem.has('bunpou-lab-v2'));
  for (const k of mem.keys()) assert.ok(!k.includes('bunpou'), `chave suspeita: ${k}`);
});

test('o progresso sobrevive a um refresh', () => {
  reset();
  store.recordAnswer({ verbId: 'nomimasu', form: 'ta', correct: true, hinted: false, dontKnow: false, answer: 'のんだ' });
  const loaded = store.load();
  assert.equal(loaded.pairs['nomimasu|ta'].right, 1);
});

/* -------------------------------------------------------------------
   Estatísticas
   ------------------------------------------------------------------- */
test('§34 estatísticas por forma e por grupo', () => {
  reset();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: false, hinted: false, dontKnow: false, answer: 'のんだ' });
  store.recordAnswer({ verbId: 'tabemasu', form: 'nai', correct: true, hinted: false, dontKnow: false, answer: 'たべない' });

  assert.equal(store.statsByForm().te.pct, 50);
  assert.equal(store.statsByForm().nai.pct, 100);
  assert.equal(store.statsByGroup()[1].pct, 50);
  assert.equal(store.statsByGroup()[2].pct, 100);
});

test('§35 a matriz marca as combinações não ensinadas como indisponíveis', () => {
  reset();
  const row = store.masteryMatrix().find(r => r.verb.id === 'arimasu');
  assert.equal(row.cells.nai, null);
  assert.equal(row.cells.nakatta, null);
  assert.equal(row.cells.te, 'new');
});

test('pontos fracos priorizam quem erra mais', () => {
  reset();
  for (let i = 0; i < 3; i++) {
    store.recordAnswer({ verbId: 'kaimasu', form: 'nai', correct: false, hinted: false, dontKnow: false, answer: 'かあない' });
  }
  store.recordAnswer({ verbId: 'tabemasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'たべて' });
  const weak = store.weakPairs(5);
  assert.equal(weak[0].verbId, 'kaimasu');
  assert.equal(weak[0].form, 'nai');
});

/* -------------------------------------------------------------------
   Ciclo completo de sessão
   ------------------------------------------------------------------- */
test('uma sessão completa avança, pontua e resume', () => {
  reset();
  const s = new Session({ mode: 'mixed', limitKind: 'count', length: 6 });
  assert.ok(s.current, 'a sessão começa com uma questão');

  let guard = 0;
  while (s.current && guard++ < 40) {
    const verb = verbById(s.current.verbId);
    /* Responde sempre certo. */
    s.submit(verb[s.current.form]);
    assert.equal(s.lastResult.correct, true, `${verb.masu} × ${s.current.form}`);
    if (s.remaining === 0) break;
    s.next();
  }
  const sum = s.finishAndRecord();
  assert.equal(sum.correct, sum.answered);
  assert.ok(sum.answered >= 6);
  assert.equal(store.getState().sessions.length, 1);
  assert.equal(store.getState().resume, null, 'o resume é limpo ao encerrar');
});

test('§47 os erros da sessão viram uma fila de revisão', () => {
  reset();
  const s = new Session({
    mode: 'review',
    queue: [{ verbId: 'kaimasu', form: 'nai' }, { verbId: 'nomimasu', form: 'te' }],
    limitKind: 'count',
    length: 2
  });
  s.submit('かあない');                 // erro
  assert.equal(s.lastResult.correct, false);
  assert.equal(s.lastResult.diagnosis.code, 'nai-wa');
  s.next();
  s.submit('のんで');                   // acerto
  const review = s.reviewQueue();
  assert.equal(review.length, 1);
  assert.deepEqual(review[0], { verbId: 'kaimasu', form: 'nai' });
});

test('§28 errar devolve o item à fila da própria sessão', () => {
  reset();
  const s = new Session({ mode: 'mixed', limitKind: 'count', length: 10 });
  const antes = s.remaining;
  s.submit('resposta obviamente errada');
  assert.equal(s.lastResult.correct, false);
  assert.equal(s.remaining, antes + 1, 'o item errado voltou para a fila');
});

test('§17 uma sessão interrompida pode ser retomada', () => {
  reset();
  const s = new Session({ mode: 'mixed', limitKind: 'count', length: 8 });
  const verb = verbById(s.current.verbId);
  s.submit(verb[s.current.form]);
  s.next();

  const resume = store.getState().resume;
  assert.ok(resume, 'o estado de retomada foi salvo');
  const s2 = Session.fromResume(resume);
  assert.ok(s2.current);
  assert.equal(s2.answered, 1);
});

test('a sessão de grupos avalia o grupo, não a conjugação', () => {
  reset();
  const s = new Session({ mode: 'group', queue: [{ verbId: 'nomimasu', form: 'group' }], length: 1 });
  assert.equal(s.current.isGroupQuestion, true);
  const r = s.submit('1');
  assert.equal(r.correct, true);
  assert.equal(r.groupAnswer, 1);
});

test('errar o grupo explica por que o verbo pertence ao grupo certo', () => {
  reset();
  const s = new Session({ mode: 'group', queue: [{ verbId: 'okimasu', form: 'group' }], length: 1 });
  const r = s.submit('1');
  assert.equal(r.correct, false);
  assert.match(r.diagnosis.detail, /tipo \(iii\)/);
});

/* -------------------------------------------------------------------
   Dicas dentro da sessão
   ------------------------------------------------------------------- */
test('as dicas saem uma de cada vez e marcam a resposta como assistida', () => {
  reset();
  const s = new Session({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'te' }], length: 1 });
  assert.equal(s.shownHints.length, 0);
  assert.equal(s.revealHint(), 'É Grupo 1.');
  assert.equal(s.shownHints.length, 1);
  const h2 = s.revealHint();
  assert.match(h2, /に・び・み/);
  assert.equal(s.revealHint(), null, 'não há terceira dica');
  const r = s.submit('のんで');
  assert.equal(r.correct, true);
  assert.equal(r.hinted, true);
  assert.equal(store.getPair('nomimasu', 'te').hinted, 1);
});

test('todas as formas do banco são alcançáveis pelo agendador', () => {
  reset();
  const cobertas = new Set(allPairs().map(p => p.form));
  for (const f of FORMS) assert.ok(cobertas.has(f), `nenhum par para a forma ${f}`);
});
