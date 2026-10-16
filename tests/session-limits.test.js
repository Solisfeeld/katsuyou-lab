/* ===================================================================
   Duas correções cirúrgicas, com os testes que as provam:

   A. Sessões por TEMPO com encerramento suave. O tempo é uma META de
      duração, não um corte seco: atingida a meta, a fila congela, mas a
      questão já aberta é concluída normalmente — resposta conta, dica
      funciona, feedback fica na tela. Só depois disso vai ao resultado.

   B. Separação entre conjugação (verbo × forma, universo fechado) e
      identificação de grupo (habilidade auxiliar, fora desse universo).

   O relógio é controlado empurrando `startedAt` para o passado — é
   determinístico e não depende de timers falsos.
   =================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'https://katsuyou.test/',
  pretendToBeVisual: true
});
dom.window.scrollTo = () => {};
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;

const { App } = await import('../src/ui/app.js');
const { Session } = await import('../src/practice/engine.js');
const store = await import('../src/progress/store.js');
const { VERBS, verbById } = await import('../src/data/verbs.js');
const { FORMS } = await import('../src/conjugation/rules.js');

const root = document.getElementById('app');
const app = new App(root);
const text = () => root.textContent;

function reset() {
  localStorage.clear();
  store.resetAll();
}

/* Empurra o início da sessão para trás, de modo que a META já foi
   atingida. `extraSeg` controla quanto tempo EXTRA já se passou. */
function cruzarMeta(session, extraSeg = 5) {
  session.startedAt = Date.now() - (session.config.minutes * 60_000 + extraSeg * 1000);
}

const Q = [
  { verbId: 'nomimasu', form: 'te' },
  { verbId: 'tabemasu', form: 'nai' },
  { verbId: 'kakimasu', form: 'ta' }
];

function timedSession(queue = Q, minutes = 5) {
  reset();
  return new Session({ mode: 'review', queue, limitKind: 'time', minutes, length: queue.length });
}

const answerOf = item => verbById(item.verbId)[item.form];

/* ===================================================================
   A. Sessões por tempo — encerramento suave
   =================================================================== */

test('A. a meta vence durante a pergunta: a sessão NÃO termina', () => {
  const s = timedSession();
  assert.equal(s.phase, 'asking');

  cruzarMeta(s);

  assert.equal(s.plannedTimeReached, true, 'a meta foi atingida');
  assert.equal(s.softEnding, true, 'a fila está congelada');
  assert.equal(s.isFinished(), false, 'mas a sessão continua');
  assert.equal(s.phase, 'asking', 'a questão continua aberta');
  assert.ok(s.current, 'a pergunta não foi arrancada da tela');
});

test('C. resposta enviada depois da meta é aceita e contabilizada', () => {
  const s = timedSession();
  cruzarMeta(s);

  const r = s.submit(answerOf(Q[0]));

  assert.ok(r, 'a resposta precisa produzir resultado');
  assert.equal(r.correct, true);
  assert.equal(s.answered, 1, 'a questão começou dentro do prazo: conta');
  assert.equal(s.correct, 1);
  assert.equal(store.getPair('nomimasu', 'te').right, 1, 'foi para o progresso');
  assert.equal(s.phase, 'feedback', 'e o feedback aparece normalmente');
});

test('D. "Não sei" depois da meta é aceito e contabilizado', () => {
  const s = timedSession();
  cruzarMeta(s);

  const r = s.dontKnow();

  assert.ok(r, 'precisa produzir feedback');
  assert.equal(r.dontKnow, true);
  assert.equal(s.answered, 1);
  assert.equal(store.getPair('nomimasu', 'te').dontKnow, 1);
  assert.equal(s.phase, 'feedback');
});

test('E. dicas continuam funcionando depois da meta', () => {
  const s = timedSession();
  cruzarMeta(s);

  assert.equal(s.revealHint(), 'É Grupo 1.');
  assert.match(s.revealHint(), /に・び・み/);
  assert.equal(s.shownHints.length, 2);
  assert.equal(s.phase, 'asking', 'pedir dica não encerra nada');

  const r = s.submit(answerOf(Q[0]));
  assert.equal(r.correct, true);
  assert.equal(r.hinted, true, 'a dica é registrada normalmente');
});

test('F/H. feedback aberto quando a meta vence permanece na tela', () => {
  const s = timedSession();
  const r = s.submit(answerOf(Q[0]));          // respondido dentro do prazo
  assert.equal(r.correct, true);
  assert.equal(s.phase, 'feedback');

  cruzarMeta(s);

  assert.equal(s.phase, 'feedback', 'o feedback não é arrancado');
  assert.ok(s.lastResult, 'continua disponível para leitura');
  assert.equal(s.isFinished(), false);
});

test('G/M. depois do feedback, next() não abre outra questão: encerra', () => {
  const s = timedSession();
  s.submit(answerOf(Q[0]));
  cruzarMeta(s);
  assert.ok(s.remaining > 0, 'ainda há itens na fila');

  assert.equal(s.next(), null, 'nenhuma questão nova');
  assert.equal(s.current, null);
  assert.equal(s.phase, 'done');
  assert.equal(s.isFinished(), true);
  assert.ok(s.remaining > 0, 'a fila continua congelada, não descartada');
});

test('M. nenhuma questão nova começa depois da meta, mesmo com fila cheia', () => {
  const s = timedSession();
  cruzarMeta(s);
  const perguntaAberta = s.current.verbId;

  s.submit(answerOf({ verbId: s.current.verbId, form: s.current.form }));
  s.next();

  assert.equal(s.current, null);
  assert.equal(s.answered, 1, 'só a questão que já estava aberta foi respondida');
  assert.equal(perguntaAberta, 'nomimasu');
});

test('I/J. o overtime avança de verdade e entra no durationMs', () => {
  const s = timedSession(Q, 5);
  assert.equal(s.overtimeMs, 0, 'antes da meta não há tempo extra');

  cruzarMeta(s, 94);                            // 1:34 além da meta
  assert.ok(s.plannedTimeReached);
  assert.ok(s.overtimeMs >= 94_000 && s.overtimeMs < 96_000, `overtime = ${s.overtimeMs}`);
  assert.equal(s.remainingMs, 0, 'o restante nunca fica negativo');

  s.submit(answerOf(Q[0]));
  s.next();
  const sum = s.finishAndRecord();

  /* 5 min de meta + ~1:34 de tempo extra. */
  assert.ok(sum.durationMs >= 5 * 60_000 + 94_000, `durationMs = ${sum.durationMs}`);
  assert.ok(sum.durationMs < 5 * 60_000 + 100_000, 'sem inventar tempo');
});

test('K. erro depois da meta é registrado e NÃO é reapresentado na sessão', () => {
  const s = timedSession();
  cruzarMeta(s);
  const filaAntes = s.remaining;

  const r = s.submit('resposta errada');
  assert.equal(r.correct, false);
  assert.equal(s.answered, 1, 'o erro é contabilizado');
  assert.equal(store.getPair('nomimasu', 'te').wrong, 1, 'entra no progresso');
  assert.equal(store.getState().recentErrors.length, 1, 'entra em erros recentes');
  assert.equal(s.remaining, filaAntes, 'nada foi reenfileirado depois da meta');

  s.next();
  assert.equal(s.phase, 'done', 'e a sessão vai ao resultado');
});

test('K. antes da meta o erro CONTINUA sendo reapresentado', () => {
  const s = timedSession();
  const filaAntes = s.remaining;
  s.submit('resposta errada');
  assert.equal(s.remaining, filaAntes + 1, 'a reapresentação normal foi preservada');
});

test('"Não sei" depois da meta também não reenfileira', () => {
  const s = timedSession();
  cruzarMeta(s);
  const filaAntes = s.remaining;
  s.dontKnow();
  assert.equal(s.remaining, filaAntes);
  s.next();
  assert.equal(s.phase, 'done');
});

test('a meta vence exatamente entre questões: não abre a próxima', () => {
  const s = timedSession();
  s.submit(answerOf(Q[0]));                     // dentro do prazo
  assert.equal(s.phase, 'feedback');
  cruzarMeta(s);                                // vence antes de avançar
  s.next();
  assert.equal(s.current, null);
  assert.equal(s.phase, 'done');
});

test('a fila esgotada encerra normalmente, sem depender do relógio', () => {
  const s = timedSession([Q[0]]);
  s.submit(answerOf(Q[0]));
  assert.equal(s.remaining, 0);
  s.next();
  assert.equal(s.phase, 'done');
});

test('L. sessão por quantidade continua intacta', () => {
  reset();
  const s = new Session({ mode: 'review', queue: Q, limitKind: 'count', length: 3 });
  /* Um startedAt antigo não muda nada quando o limite é por questões. */
  s.startedAt = Date.now() - 60 * 60_000;
  assert.equal(s.plannedMs, null);
  assert.equal(s.plannedTimeReached, false);
  assert.equal(s.softEnding, false);
  assert.equal(s.overtimeMs, 0);
  assert.equal(s.remainingMs, null);

  let guard = 0;
  while (s.current && guard++ < 20) {
    const r = s.submit(answerOf({ verbId: s.current.verbId, form: s.current.form }));
    assert.equal(r.correct, true);
    if (s.remaining === 0) break;
    s.next();
  }
  const sum = s.finishAndRecord();
  assert.equal(sum.answered, 3);
  assert.equal(sum.correct, 3);
});

test('L. por quantidade o erro continua sendo reapresentado', () => {
  reset();
  const s = new Session({ mode: 'review', queue: Q, limitKind: 'count', length: 3 });
  const antes = s.remaining;
  s.submit('errado');
  assert.equal(s.remaining, antes + 1);
});

test('N. a sessão é gravada exatamente uma vez', () => {
  const s = timedSession();
  s.submit(answerOf(Q[0]));
  cruzarMeta(s);
  s.next();

  s.finishAndRecord();
  s.finishAndRecord();
  s.finishAndRecord();

  assert.equal(store.getState().sessions.length, 1);
  assert.equal(store.getState().sessions[0].answered, 1);
});

test('sessão sem nenhuma resposta não é gravada no histórico', () => {
  const s = timedSession();
  cruzarMeta(s);
  s.next();
  s.finishAndRecord();
  assert.equal(store.getState().sessions.length, 0);
});

test('sessão vazia nasce encerrada, sem pergunta corrente', () => {
  reset();
  const s = new Session({ mode: 'review', queue: [], limitKind: 'count', length: 0 });
  assert.equal(s.current, null);
  assert.equal(s.phase, 'done');
  assert.equal(s.isFinished(), true);
});

test('§16 sessão por tempo retomada não nasce com a meta vencida', () => {
  const s = timedSession();
  s.submit(answerOf(Q[0]));
  s.next();
  const resume = store.getState().resume;
  assert.ok(resume, 'o estado de retomada foi salvo');

  const s2 = Session.fromResume(resume);
  assert.ok(s2.current, 'a sessão retomada tem pergunta corrente');
  assert.equal(s2.plannedTimeReached, false);
  assert.equal(s2.phase, 'asking');
});

/* ---------------- renderPractice ---------------- */

test('A/B. a tela não é arrancada e o texto digitado permanece', () => {
  reset();
  app.startSession({ mode: 'review', queue: Q, limitKind: 'time', minutes: 5 });
  const input = root.querySelector('input.answer');
  assert.ok(input, 'o campo existe');

  /* O usuário está no meio da resposta... */
  input.value = 'のん';

  /* ...e a meta vence. O tique do relógio repinta só o mostrador. */
  cruzarMeta(app.session);
  const bar = root.querySelector('.session-bar');
  assert.ok(bar, 'a barra existe');

  /* O relógio é repintado sem reconstruir o exercício. */
  app.session.startedAt -= 1000;                // mais um segundo de overtime
  const label = root.querySelector('.session-count');
  assert.ok(label);

  assert.equal(root.querySelector('input.answer'), input, 'o input é o MESMO nó');
  assert.equal(input.value, 'のん', 'o texto digitado não pode se perder');
  assert.ok(root.querySelector('.q-prompt'), 'a questão continua na tela');
  assert.equal(app.session.phase, 'asking');
  assert.ok(!text().includes('Fim da sessão'));
});

test('o mostrador entra em overtime e continua avançando', () => {
  reset();
  app.startSession({ mode: 'review', queue: Q, limitKind: 'time', minutes: 5 });
  const label = () => root.querySelector('.session-count');
  const rail = () => root.querySelector('.progress-rail');

  assert.match(label().textContent, /^\d+:\d{2}$/, 'antes da meta, contagem regressiva');
  assert.ok(!label().classList.contains('over'));

  /* Cruza a meta: o próximo render mostra o tempo extra em vermelho. */
  cruzarMeta(app.session, 27);
  app.render();
  assert.equal(label().textContent, '+0:27', 'mostra quanto passou além da meta');
  assert.ok(label().classList.contains('over'), 'estado visual de overtime');
  assert.ok(rail().classList.contains('over'));
  assert.equal(rail().querySelector('i').style.width, '100%');

  /* E continua andando. */
  cruzarMeta(app.session, 88);
  app.render();
  assert.equal(label().textContent, '+1:28');
  assert.ok(!label().textContent.includes('-'), 'nunca valores negativos');
});

test('a sessão por quantidade não mostra relógio de overtime', () => {
  reset();
  app.startSession({ mode: 'review', queue: Q, limitKind: 'count', length: 3 });
  const label = root.querySelector('.session-count');
  assert.equal(label.textContent, '0 / 3');
  assert.ok(!label.classList.contains('over'));
});

test('depois de responder em overtime, o botão leva ao resultado', () => {
  reset();
  app.startSession({ mode: 'review', queue: Q, limitKind: 'time', minutes: 5 });
  cruzarMeta(app.session);
  app.render();

  root.querySelector('input.answer').value = answerOf(Q[0]);
  [...root.querySelectorAll('button')].find(b => b.textContent.trim() === 'Responder').click();

  assert.ok(text().includes('✓ Correto'), 'o feedback aparece');
  const btn = [...root.querySelectorAll('button')].find(b => b.textContent.trim() === 'Ver resultado');
  assert.ok(btn, 'o botão diz a verdade: não há próxima');
  btn.click();
  assert.ok(text().includes('Fim da sessão'));
  assert.ok(text().includes('1 / 1'), 'a resposta dada em overtime conta');
});

test('H. feedback que cruza a meta mantém a tela e oferece Ver resultado', () => {
  reset();
  app.startSession({ mode: 'review', queue: Q, limitKind: 'time', minutes: 5 });
  root.querySelector('input.answer').value = answerOf(Q[0]);
  [...root.querySelectorAll('button')].find(b => b.textContent.trim() === 'Responder').click();
  assert.ok(text().includes('✓ Correto'));

  cruzarMeta(app.session);
  app.render();

  assert.ok(text().includes('✓ Correto'), 'o feedback permanece');
  assert.ok(!text().includes('Fim da sessão'), 'não pulou para o resultado');
  assert.ok([...root.querySelectorAll('button')].some(b => b.textContent.trim() === 'Ver resultado'));
});

test('renderPractice nunca acessa current nulo', () => {
  reset();
  app.startSession({ mode: 'review', queue: Q, limitKind: 'time', minutes: 5 });
  const s = app.session;
  s.submit(answerOf(Q[0]));
  cruzarMeta(s);
  s.next();
  assert.equal(s.current, null);

  assert.doesNotThrow(() => app.render());
  assert.ok(text().includes('Fim da sessão'));
  assert.equal(root.querySelector('.q-prompt'), null);
});

test('renderizar o resultado várias vezes não duplica a sessão gravada', () => {
  reset();
  app.startSession({ mode: 'review', queue: Q, limitKind: 'count', length: 3 });
  root.querySelector('input.answer').value = answerOf(Q[0]);
  [...root.querySelectorAll('button')].find(b => b.textContent.trim() === 'Responder').click();
  app.endSession(app.session);

  app.render();
  app.render();
  assert.equal(store.getState().sessions.length, 1);
});

/* ===================================================================
   B. Treino de grupos fora das combinações de conjugação
   =================================================================== */

/* Responde corretamente o quiz de grupo `times` vezes para cada verbo. */
function masterAllGroupQuizzes(times = 3) {
  for (const v of VERBS) {
    for (let i = 0; i < times; i++) {
      store.recordAnswer({
        verbId: v.id, form: 'group', correct: true, hinted: false, dontKnow: false, answer: String(v.group)
      });
    }
  }
}

/* Responde corretamente todas as combinações verbo × forma treináveis. */
function masterAllConjugations(times = 3) {
  for (const v of VERBS) {
    for (const f of FORMS) {
      if ((v.notTaught || []).includes(f)) continue;
      for (let i = 0; i < times; i++) {
        store.recordAnswer({
          verbId: v.id, form: f, correct: true, hinted: false, dontKnow: false, answer: v[f]
        });
      }
    }
  }
}

test('o universo de conjugação vem do banco e não depende do treino de grupos', () => {
  reset();
  /* Calculado do banco, nunca fixado à mão: verbos × formas treináveis. */
  const esperado = VERBS.reduce((n, v) => n + FORMS.filter(f => !(v.notTaught || []).includes(f)).length, 0);
  assert.equal(store.TRAINABLE_COMBOS, esperado);
  assert.equal(store.overallCounts().trainable, esperado);
});

test('dominar os 48 grupos não move nenhum número de conjugação', () => {
  reset();
  masterAllGroupQuizzes();

  const c = store.overallCounts();
  assert.equal(c.mastered, 0, 'nenhuma conjugação foi dominada');
  assert.equal(c.practiced, 0, 'nenhuma conjugação foi praticada');
  assert.equal(c.seen, 0, 'as respostas de grupo não entram no total de conjugação');
  assert.equal(c.trainable, store.TRAINABLE_COMBOS);

  /* O progresso do quiz existe, só que na sua própria área. */
  assert.equal(Object.keys(store.getState().groupPractice).length, VERBS.length);
  assert.equal(store.getGroupEntry('nomimasu').right, 3);
  assert.equal(store.groupQuizStats().pct, 100);
  assert.equal(store.groupQuizStats().verbs, VERBS.length);

  /* E não contaminou o mapa de pares. */
  assert.equal(Object.keys(store.getState().pairs).length, 0);
});

test('weakPairs nunca devolve form === "group"', () => {
  reset();
  /* Erra todos os quizzes de grupo e uma conjugação. */
  for (const v of VERBS) {
    store.recordAnswer({ verbId: v.id, form: 'group', correct: false, hinted: false, dontKnow: false, answer: '9' });
  }
  store.recordAnswer({ verbId: 'kaimasu', form: 'nai', correct: false, hinted: false, dontKnow: false, answer: 'かあない' });

  const weak = store.weakPairs(50);
  assert.ok(weak.length > 0);
  for (const w of weak) {
    assert.notEqual(w.form, 'group');
    assert.ok(FORMS.includes(w.form), `forma inesperada em Pontos fracos: ${w.form}`);
  }
  assert.equal(weak[0].verbId, 'kaimasu');
  assert.equal(weak[0].form, 'nai');
});

test('a matriz de domínio contém somente as formas de conjugação', () => {
  reset();
  masterAllGroupQuizzes();
  const matrix = store.masteryMatrix();
  assert.equal(matrix.length, VERBS.length);
  for (const row of matrix) {
    assert.deepEqual(Object.keys(row.cells), FORMS, `${row.verb.id} tem coluna estranha`);
  }
});

test('"Por grupo" ignora as respostas do quiz de identificação de grupo', () => {
  reset();
  /* Só respostas de quiz de grupo: as porcentagens de conjugação ficam vazias. */
  for (const v of VERBS) {
    store.recordAnswer({ verbId: v.id, form: 'group', correct: true, hinted: false, dontKnow: false, answer: String(v.group) });
  }
  for (const g of [1, 2, 3]) {
    assert.equal(store.statsByGroup()[g].seen, 0, `Grupo ${g} não deveria ter respostas de conjugação`);
    assert.equal(store.statsByGroup()[g].pct, null);
  }

  /* Uma conjugação errada de um verbo do Grupo 1 puxa só o Grupo 1. */
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: false, hinted: false, dontKnow: false, answer: 'のんだ' });
  assert.equal(store.statsByGroup()[1].seen, 1);
  assert.equal(store.statsByGroup()[1].pct, 0);
  assert.equal(store.statsByGroup()[2].seen, 0);

  /* E "Por forma" também ignora o quiz. */
  assert.equal(store.statsByForm().te.seen, 1);
});

test('dominadas todas as conjugações E os 48 grupos, o site mostra N de N', () => {
  reset();
  masterAllConjugations();
  masterAllGroupQuizzes();

  const c = store.overallCounts();
  assert.equal(c.trainable, store.TRAINABLE_COMBOS);
  assert.equal(c.mastered, store.TRAINABLE_COMBOS, 'nunca acima do universo de conjugação');
  assert.equal(c.practiced, store.TRAINABLE_COMBOS);
  assert.ok(c.mastered <= c.trainable);

  /* E é isso que a home escreve. */
  app.go('home');
  assert.ok(text().includes(`${store.TRAINABLE_COMBOS} de ${store.TRAINABLE_COMBOS}`), `home dizia: ${text().slice(0, 200)}`);
});

test('erros de grupo continuam em Erros recentes, marcados como tais', () => {
  reset();
  store.recordAnswer({ verbId: 'okimasu', form: 'group', correct: false, hinted: false, dontKnow: false, answer: '1' , reason: 'おきます é Grupo 2' });
  const e = store.getState().recentErrors[0];
  assert.equal(e.form, 'group');
  assert.equal(e.kind, 'group');
  assert.equal(e.correct, 'Grupo 2', 'mostra o grupo por extenso, não o número cru');

  app.go('errors');
  assert.ok(text().includes('Treino de grupos'), 'o erro é rotulado como treino de grupos');
  assert.ok(text().includes('おきます'));
});

/* ===================================================================
   C. Compatibilidade com o progresso salvo pela versão anterior
   =================================================================== */

test('estado v1 com pseudo-pares "verbo|group" é migrado sem perder conjugação', () => {
  reset();
  const v1 = {
    version: 1,
    pairs: {
      'nomimasu|te': { seen: 4, right: 4, wrong: 0, hinted: 0, dontKnow: 0, streak: 4, mastery: 'mastered', lastSeenAt: 111 },
      'kaimasu|nai': { seen: 2, right: 1, wrong: 1, hinted: 0, dontKnow: 0, streak: 0, mastery: 'learning', lastSeenAt: 222 },
      /* pseudo-pares do treino de grupos, gravados pela versão anterior */
      'nomimasu|group': { seen: 5, right: 5, wrong: 0, hinted: 1, dontKnow: 0, streak: 5, mastery: 'mastered', lastSeenAt: 333 },
      'tabemasu|group': { seen: 2, right: 1, wrong: 1, hinted: 0, dontKnow: 0, streak: 0, mastery: 'learning', lastSeenAt: 444 },
      /* lixo que não corresponde a nada */
      'nomimasu|potencial': { seen: 9, right: 9, wrong: 0, hinted: 0, dontKnow: 0, streak: 9, mastery: 'mastered' },
      'verboInexistente|te': { seen: 3, right: 3, wrong: 0, hinted: 0, dontKnow: 0, streak: 3, mastery: 'mastered' },
      /* forma que o Rikai não sustenta para este verbo */
      'arimasu|nai': { seen: 7, right: 7, wrong: 0, hinted: 0, dontKnow: 0, streak: 7, mastery: 'mastered' }
    }
  };
  localStorage.setItem(store.STORAGE_KEY, JSON.stringify(v1));

  const loaded = store.load();

  /* Conjugação legítima preservada, integralmente. */
  assert.equal(loaded.pairs['nomimasu|te'].right, 4);
  assert.equal(loaded.pairs['nomimasu|te'].mastery, 'mastered');
  assert.equal(loaded.pairs['kaimasu|nai'].wrong, 1);

  /* Pseudo-pares e lixo fora de `pairs`. */
  assert.equal(Object.keys(loaded.pairs).length, 2);
  for (const key of Object.keys(loaded.pairs)) {
    assert.ok(!key.endsWith('|group'), `sobrou pseudo-par: ${key}`);
  }
  assert.equal(loaded.pairs['nomimasu|potencial'], undefined);
  assert.equal(loaded.pairs['verboInexistente|te'], undefined);
  assert.equal(loaded.pairs['arimasu|nai'], undefined);

  /* Treino de grupos migrado, não descartado. */
  assert.equal(loaded.groupPractice.nomimasu.right, 5);
  assert.equal(loaded.groupPractice.nomimasu.seen, 5);
  assert.equal(loaded.groupPractice.tabemasu.wrong, 1);

  /* Schema versionado. */
  assert.equal(loaded.version, 2);
});

test('depois da migração os números de conjugação continuam dentro do universo', () => {
  reset();
  const pairs = {};
  /* Domina tudo, e ainda por cima grava um pseudo-par por verbo. */
  for (const v of VERBS) {
    for (const f of FORMS) {
      if ((v.notTaught || []).includes(f)) continue;
      pairs[`${v.id}|${f}`] = { seen: 3, right: 3, wrong: 0, hinted: 0, dontKnow: 0, streak: 3, mastery: 'mastered' };
    }
    pairs[`${v.id}|group`] = { seen: 3, right: 3, wrong: 0, hinted: 0, dontKnow: 0, streak: 3, mastery: 'mastered' };
  }
  localStorage.setItem(store.STORAGE_KEY, JSON.stringify({ version: 1, pairs }));

  store.replaceState(store.load());
  const c = store.overallCounts();
  assert.equal(c.trainable, store.TRAINABLE_COMBOS);
  assert.equal(c.mastered, store.TRAINABLE_COMBOS, 'os 48 pseudo-pares não podem inflar o total');
  assert.equal(c.practiced, store.TRAINABLE_COMBOS);
  assert.equal(Object.keys(store.getState().groupPractice).length, VERBS.length);
});

test('replaceState (sincronização) também sanea um snapshot antigo', () => {
  reset();
  store.replaceState({
    version: 1,
    pairs: {
      'nomimasu|te': { seen: 1, right: 1, wrong: 0, hinted: 0, dontKnow: 0, streak: 1, mastery: 'learning' },
      'nomimasu|group': { seen: 2, right: 2, wrong: 0, hinted: 0, dontKnow: 0, streak: 2, mastery: 'almost' }
    }
  });
  assert.equal(Object.keys(store.getState().pairs).length, 1);
  assert.equal(store.getGroupEntry('nomimasu').right, 2);
  assert.equal(store.getState().version, 2);
});

test('uma sessão de treino de grupos não cria pares de conjugação', () => {
  reset();
  const s = new Session({ mode: 'group', queue: [{ verbId: 'nomimasu', form: 'group' }], length: 1 });
  s.submit('1');
  assert.equal(s.lastResult.correct, true);
  assert.equal(Object.keys(store.getState().pairs).length, 0);
  assert.equal(store.getGroupEntry('nomimasu').right, 1);
  assert.equal(store.overallCounts().practiced, 0);
});
