/* ===================================================================
   O texto que está sendo digitado não pode morar só no DOM.

   Bug real: com uma questão de digitação aberta, qualquer re-render
   reconstruía o <input> vazio e a resposta parcial se perdia. O gatilho
   mais frequente era a própria sincronização da conta — setStatus() em
   auth-sync.js chama window.KatsuyouApp.render(), então o status virar
   "Sincronizado" apagava o que o usuário estava escrevendo.

   A correção segue o padrão do Bunpou Lab (`V.ans` + `oninput` +
   `value="${esc(V.ans)}"`): a resposta parcial vive em
   `session.answerDraft`, estado TRANSITÓRIO da atividade, e o render
   reconstrói o campo a partir dele.
   =================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'https://katsuyou-lab.netlify.app/',
  pretendToBeVisual: true
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
globalThis.URL = dom.window.URL;

const { App } = await import('../src/ui/app.js');
const store = await import('../src/progress/store.js');
const backup = await import('../src/progress/backup.js');
const { verbById } = await import('../src/data/verbs.js');

const root = document.getElementById('app');
const app = new App(root);
window.KatsuyouApp = app;

const text = () => root.textContent;
const input = () => root.querySelector('input.answer');
const btn = label => [...root.querySelectorAll('button')]
  .find(b => b.textContent.trim() === label);
const chip = () => root.querySelector('[data-topbar="account"]');

const Q = [
  { verbId: 'nomimasu', form: 'te' },      // のんで
  { verbId: 'tabemasu', form: 'nai' }      // たべない
];
const answerOf = item => verbById(item.verbId)[item.form];

/* Digita de verdade: escreve no campo e emite `input`, como o navegador. */
function digitar(texto) {
  const el = input();
  el.value = texto;
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  return el;
}

function stubSync(over = {}) {
  window.KatsuyouSync = {
    status: 'synced',
    user: { id: 'u-1', email: 'usuario@gmail.com' },
    lastSyncedAt: Date.now(),
    authReady: true,
    login() {}, logout() {}, syncNow() {},
    keepLocal() {}, keepRemote() {}, notifyLocalChange() {},
    ...over
  };
  return window.KatsuyouSync;
}

function abrirQuestao(queue = Q, config = {}) {
  localStorage.clear();
  store.resetAll();
  stubSync();
  app.startSession({ mode: 'review', queue, limitKind: 'count', length: queue.length, ...config });
}

/* Reproduz o caminho real: auth-sync muda o status e chama render(). */
function mudarStatus(status) {
  window.KatsuyouSync.status = status;
  app.render();
}

/* ===================================================================
   A. O bug: sincronização durante a digitação
   =================================================================== */

test('A. のん sobrevive a dirty → loading → synced', () => {
  abrirQuestao();
  digitar('のん');
  assert.equal(input().value, 'のん');

  mudarStatus('dirty');
  assert.equal(chip().textContent.includes('Pendente'), true, 'a topbar redesenhou de verdade');
  assert.equal(input().value, 'のん', 'o texto se perdeu no render de "Pendente"');

  mudarStatus('loading');
  assert.equal(chip().textContent.includes('Sincronizando'), true);
  assert.equal(input().value, 'のん', 'o texto se perdeu no render de "Sincronizando"');

  mudarStatus('synced');
  assert.equal(chip().textContent.includes('Sincronizado'), true);
  assert.equal(input().value, 'のん', 'o texto se perdeu no render de "Sincronizado"');

  /* E a questão continua a mesma, pronta para terminar. */
  assert.equal(root.querySelector('.q-prompt').textContent, 'のみます');
  assert.equal(app.session.phase, 'asking');
});

test('A. o campo é um nó NOVO a cada render, e ainda assim mantém o texto', () => {
  abrirQuestao();
  const antes = digitar('のん');
  mudarStatus('loading');
  const depois = input();
  assert.notEqual(depois, antes, 'o render realmente reconstrói o campo');
  assert.equal(depois.value, 'のん', 'o valor vem do rascunho, não do DOM antigo');
});

test('B. のんだ sobrevive a vários renders consecutivos', () => {
  abrirQuestao();
  digitar('のんだ');
  for (let i = 0; i < 8; i++) app.render();
  assert.equal(input().value, 'のんだ');
});

test('C. estado de autenticação atualizando a UI não apaga o rascunho', () => {
  abrirQuestao();
  digitar('のん');
  /* token_refresh mantém a conta e redesenha; offline e volta também. */
  mudarStatus('offline');
  assert.equal(input().value, 'のん');
  mudarStatus('synced');
  assert.equal(input().value, 'のん');
  /* Troca de dados do usuário (user_updated) e novo render. */
  window.KatsuyouSync.user = { id: 'u-1', email: 'novo@gmail.com' };
  app.render();
  assert.equal(input().value, 'のん');
});

test('F. troca de tema não apaga o rascunho', () => {
  abrirQuestao();
  digitar('のん');
  app.applyTheme('dark');
  app.render();
  assert.equal(input().value, 'のん');
  app.applyTheme('auto');
  app.render();
  assert.equal(input().value, 'のん');
});

/* ===================================================================
   D. Dicas
   =================================================================== */

test('D. pedir dica não apaga o que já foi digitado', () => {
  abrirQuestao();
  digitar('のん');

  btn('Preciso de uma dica').click();
  assert.ok(text().includes('É Grupo 1.'), 'a dica apareceu');
  assert.equal(input().value, 'のん', 'e o texto continua');

  btn('Mais uma dica').click();
  assert.ok(text().includes('に・び・み'));
  assert.equal(input().value, 'のん');

  /* E o envio depois da dica funciona normalmente. */
  digitar('のんで');
  btn('Responder').click();
  assert.ok(text().includes('✓ Correto'));
  assert.equal(app.session.lastResult.hinted, true);
});

/* ===================================================================
   E. Overtime (soft ending preservado)
   =================================================================== */

test('E. o rascunho sobrevive ao relógio cruzar a meta', () => {
  abrirQuestao(Q, { limitKind: 'time', minutes: 5 });
  digitar('のん');

  /* Cruza a meta e repinta, como faz o tique do relógio. */
  app.session.startedAt = Date.now() - (5 * 60_000 + 1000);
  app.render();

  assert.equal(app.session.plannedTimeReached, true, 'a meta foi atingida');
  assert.equal(app.session.phase, 'asking', 'nenhum hard stop');
  assert.ok(input(), 'a questão continua na tela');
  assert.equal(input().value, 'のん', 'e o rascunho continua');
  assert.ok(root.querySelector('.session-count').classList.contains('over'), 'relógio em overtime');

  /* A resposta em overtime continua valendo. */
  digitar('のんで');
  btn('Responder').click();
  assert.ok(text().includes('✓ Correto'));
  assert.equal(app.session.answered, 1);
});

/* ===================================================================
   G/H. Ciclo de vida: o rascunho não vaza entre questões
   =================================================================== */

test('G. a próxima questão começa com o campo vazio', () => {
  abrirQuestao();
  digitar('のんで');
  btn('Responder').click();
  btn('Próxima').click();

  assert.equal(root.querySelector('.q-prompt').textContent, 'たべます');
  assert.equal(app.session.answerDraft, '', 'o rascunho foi limpo');
  assert.equal(input().value, '', 'o campo da nova questão está vazio');
});

test('H. "Não sei" não envia o texto parcial nem o carrega para a próxima', () => {
  abrirQuestao();
  digitar('のん');

  btn('Não sei').click();
  const r = app.session.lastResult;
  assert.equal(r.dontKnow, true, 'registrado como "Não sei"');
  assert.equal(r.given, '', 'o texto parcial não virou resposta submetida');
  assert.notEqual(r.given, 'のん');
  assert.ok(text().includes('のんで'), 'o feedback mostra a resposta certa');

  btn('Próxima').click();
  assert.equal(input().value, '', 'o rascunho não vazou para a questão seguinte');
});

test('o rascunho é limpo quando a sessão termina', () => {
  /* Acerto numa fila de um item: nada é reenfileirado, então next()
     encerra de verdade. (Errar reapresentaria o item, por projeto.) */
  abrirQuestao([Q[0]]);
  digitar('のん');
  assert.equal(app.session.answerDraft, 'のん');

  app.session.submit(answerOf(Q[0]));
  app.session.next();

  assert.equal(app.session.phase, 'done');
  assert.equal(app.session.answerDraft, '', 'o estado terminal limpa o rascunho');
});

/* ===================================================================
   I/J. Envio e IME
   =================================================================== */

test('I. a avaliação usa exatamente o que está no campo no envio', () => {
  abrirQuestao();
  digitar('のんだ');                       // forma た, não a pedida
  btn('Responder').click();

  const r = app.session.lastResult;
  assert.equal(r.correct, false);
  assert.equal(r.given, 'のんだ', 'avaliou o texto enviado');
  assert.equal(r.diagnosis.code, 'ta-for-te', 'e o diagnóstico é o específico');
});

test('J. o IME não é atrapalhado: Enter em composição não envia', () => {
  abrirQuestao();
  const el = digitar('のん');

  const ev = new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
  Object.defineProperty(ev, 'isComposing', { value: true });
  el.dispatchEvent(ev);

  assert.equal(app.session.phase, 'asking', 'não enviou durante a composição');
  assert.equal(input().value, 'のん', 'e nada se perdeu');
});

test('J. valor escrito sem evento `input` (composição) ainda é lido no envio', () => {
  abrirQuestao();
  /* Alguns navegadores não emitem `input` durante a composição do IME:
     o DOM é a fonte autoritativa no instante do envio. */
  input().value = 'のんで';
  btn('Responder').click();
  assert.ok(text().includes('✓ Correto'));
  assert.equal(app.session.lastResult.given, 'のんで');
});

test('Enter envia quando a composição já terminou', () => {
  abrirQuestao();
  const el = digitar('のんで');
  el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.ok(text().includes('✓ Correto'));
});

/* ===================================================================
   O rascunho é transitório: nada dele vaza para fora da sessão
   =================================================================== */

test('o rascunho NÃO entra no localStorage, no progresso nem no backup', () => {
  abrirQuestao();
  digitar('のん');
  app.render();                            // qualquer render, para garantir

  const bruto = localStorage.getItem(store.STORAGE_KEY) || '';
  assert.ok(!bruto.includes('のん'), 'vazou para o localStorage');
  assert.ok(!bruto.includes('answerDraft'), 'o campo vazou para o estado persistido');

  const salvo = JSON.stringify(store.getState());
  assert.ok(!salvo.includes('のん'), 'vazou para o estado do progresso');
  assert.ok(!salvo.includes('answerDraft'));

  const arquivo = backup.backupJson();
  assert.ok(!arquivo.includes('のん'), 'vazou para o arquivo de backup');
  assert.ok(!arquivo.includes('answerDraft'));

  /* E o estado de retomada também não carrega rascunho. */
  const resume = store.getState().resume;
  assert.ok(resume, 'o resume existe');
  assert.ok(!JSON.stringify(resume).includes('のん'), 'vazou para o resume');
});

test('digitar não dispara save() nem sincronização', () => {
  abrirQuestao();
  let avisos = 0;
  window.KatsuyouSync.notifyLocalChange = () => { avisos++; };

  digitar('の');
  digitar('のん');
  digitar('のんで');

  assert.equal(avisos, 0, 'cada tecla não pode gerar um ciclo de sincronização');
});

/* ===================================================================
   Foco
   =================================================================== */

test('o campo continua focado depois de um render de sincronização', async () => {
  abrirQuestao();
  digitar('のん');
  mudarStatus('synced');

  /* O foco é reaplicado num microtask, como no render normal. */
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(document.activeElement, input(), 'dá para continuar digitando sem clicar');
  assert.equal(input().selectionStart, 2, 'cursor no fim do texto');
  assert.equal(input().selectionEnd, 2);
});
