/* ===================================================================
   Sessão interrompida: salvar, pausar e retomar (nov/2026).

   "Fechar a aba" é simulado do jeito mais fiel possível em jsdom: o
   módulo de progresso RELÊ o disco (reloadFromStorage, como numa carga
   nova) e um App NOVO é criado sobre ele — nada sobrevive em memória além
   do que foi gravado no localStorage. O teste em navegador real
   (e2e/retomada.py) cobre fechar/reabrir de verdade.
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

let NOW = Date.UTC(2026, 0, 5, 20);
Date.now = () => NOW;
const MIN = 60_000, DAY = 86_400_000;

const { App } = await import('../src/ui/app.js');
const store = await import('../src/progress/store.js');
const { Session } = await import('../src/practice/engine.js');

let root = document.getElementById('app');
let app = new App(root);
const base = el => { const c = el.cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent; };
const btn = label => [...root.querySelectorAll('button')].find(b => base(b).trim() === label);
const text = () => base(root);
const input = () => root.querySelector('input.answer');
function reset() {
  app._cleanups.forEach(fn => { try { fn(); } catch {} });
  localStorage.clear(); store.resetAll(); NOW = Date.UTC(2026, 0, 5, 20); app = new App(root);
}
test.after(() => { app._cleanups.forEach(fn => { try { fn(); } catch {} }); });
/* fecha a aba e abre de novo: só o que está no disco sobrevive */
function reopen() {
  app._cleanups.forEach(fn => { try { fn(); } catch {} });   // a aba antiga some
  store.reloadFromStorage();
  root.innerHTML = '';
  app = new App(root);
  app.render();
}
const Q = [
  { verbId: 'nomimasu', form: 'te' }, { verbId: 'tabemasu', form: 'nai' },
  { verbId: 'kakimasu', form: 'ta' }, { verbId: 'mimasu', form: 'te' },
  { verbId: 'ikimasu', form: 'ta' }, { verbId: 'kaimasu', form: 'nai' }
];
function start(queue = Q, extra = {}) {
  app.startSession({ mode: 'review', queue, limitKind: 'count', length: queue.length, ...extra });
}
function answer(txt) { input().value = txt; btn('Responder').click(); }
const pairs = () => JSON.stringify(store.getState().pairs);

/* ------------------------------------------------------------------ */
test('sessão é salva ao iniciar; a home mostra o cartão e NÃO retoma sozinha', () => {
  reset();
  start();
  const r = store.getState().resume;
  assert.equal(r.v, 2);
  assert.equal(r.current.verbId, 'nomimasu');
  assert.equal(r.phase, 'asking');
  reopen();
  assert.equal(app.view, 'home', 'nada é retomado sem escolha');
  assert.equal(app.session, null);
  assert.ok(text().includes('Continuar sessão anterior'));
  assert.ok(text().includes('0 de 6 questões'));
  assert.ok(root.querySelector('[data-resume="continue"]'));
  assert.ok(root.querySelector('[data-resume="discard"]'));
});

test('retomar antes de responder: mesma questão, texto digitado preservado', async () => {
  reset();
  start();
  answer('のんで'); btn('Continuar').click();
  input().value = 'たべな';
  input().dispatchEvent(new window.Event('input'));
  await new Promise(r => setTimeout(r, 450));        // gravação do rascunho
  const antes = pairs();
  reopen();
  root.querySelector('[data-resume="continue"]').click();
  assert.equal(app.view, 'practice');
  assert.equal(root.querySelector('.q-prompt [data-kana]').dataset.kana, 'たべます');
  assert.equal(input().value, 'たべな', 'o texto digitado volta');
  assert.equal(pairs(), antes, 'retomar não reaplica nada ao progresso');
  /* o rascunho fica numa chave só local: fora do progresso e do backup */
  assert.ok(!localStorage.getItem(store.STORAGE_KEY).includes('たべな'));
});

test('retomar durante o feedback: o mesmo feedback, sem responder de novo', () => {
  reset();
  start();
  answer('のんた');                                   // erro
  const antes = pairs();
  const sess = store.getState().resume;
  assert.equal(sess.phase, 'feedback');
  reopen();
  root.querySelector('[data-resume="continue"]').click();
  assert.equal(app.session.phase, 'feedback');
  assert.ok(text().includes('Sua resposta'), 'o feedback está na tela');
  assert.ok(text().includes('のんた'), 'com a resposta digitada');
  assert.equal(pairs(), antes, 'sem dupla contagem');
  assert.equal(store.getPair('nomimasu', 'te').wrong, 1);
  /* avançar segue a fila, e só a próxima resposta muda o progresso */
  btn('Continuar').click();
  answer('たべない');
  assert.equal(store.getPair('nomimasu', 'te').wrong, 1, 'o erro não foi contado duas vezes');
  assert.equal(store.getPair('tabemasu', 'nai').right, 1);
});

test('retomar depois de responder (a resposta e a sessão são gravadas juntas)', () => {
  reset();
  start();
  answer('のんで');
  /* o disco tem as duas coisas numa única gravação */
  const disco = JSON.parse(localStorage.getItem(store.STORAGE_KEY));
  assert.equal(disco.pairs['nomimasu|te'].right, 1);
  assert.equal(disco.resume.phase, 'feedback');
  assert.equal(disco.resume.answered, 1);
});

test('ordem da fila e fila de reforço preservadas', () => {
  reset();
  start();
  answer('x');                                         // erro → volta 3–7 à frente
  const r1 = store.getState().resume;
  const fila = r1.rest.map(i => `${i.verbId}|${i.form}${i.requeued ? '*' : ''}`);
  assert.ok(fila.some(k => k.endsWith('*')), 'o reforço está na fila');
  reopen();
  root.querySelector('[data-resume="continue"]').click();
  assert.deepEqual(app.session.queue.map(i => `${i.verbId}|${i.form}${i.requeued ? '*' : ''}`), fila);
  /* a ordem é seguida: a próxima é a primeira da fila salva */
  btn('Continuar').click();
  assert.equal(`${app.session.current.verbId}|${app.session.current.form}`, fila[0].replace('*', ''));
});

test('cronômetro: continua do tempo salvo e não conta o tempo com o app fechado', () => {
  reset();
  start(Q, { limitKind: 'time', minutes: 30, length: 60 });
  NOW += (23 * 60 + 15) * 1000;                       // 23:15 de sessão aberta
  app.session.saveQuiet();
  assert.equal(Math.round(store.getState().resume.elapsedMs / 1000), 23 * 60 + 15);
  reopen();
  NOW += 2 * DAY;                                     // fechado por dois dias
  assert.ok(text().includes('23:15 de sessão'));
  root.querySelector('[data-resume="continue"]').click();
  assert.equal(Math.round(app.session.elapsedMs / 1000), 23 * 60 + 15, 'parte de 23:15');
  NOW += 10_000;
  assert.equal(Math.round(app.session.elapsedMs / 1000), 23 * 60 + 25, 'e volta a contar');
});

test('aba oculta NÃO pausa; Ajustes e página descarregada pausam', () => {
  reset();
  start();
  const s = app.session;
  const t0 = s.elapsedMs;
  /* aba oculta / navegador minimizado: a sessão continua aberta e o tempo corre */
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new window.Event('visibilitychange'));
  app.render();
  NOW += 10 * MIN;                                   // timers suspensos: nenhum pulso
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.dispatchEvent(new window.Event('visibilitychange'));
  app.render();
  assert.equal(s.elapsedMs, t0 + 10 * MIN, 'os 10 minutos em segundo plano contam, inteiros');
  /* Ajustes por cima da sessão: pausa (interrupção voluntária, como no Bunpou) */
  app.go('settings');
  NOW += 3 * MIN;
  assert.equal(s.elapsedMs, t0 + 10 * MIN, 'fora da tela de exercício: pausa');
  app.view = 'practice'; app.render();
  NOW += 1000;
  assert.equal(s.elapsedMs, t0 + 10 * MIN + 1000, 'de volta ao exercício: conta de novo');
  /* página descarregada (pagehide): pausa e não soma o intervalo fora */
  s.pause();
  NOW += 7 * MIN;
  assert.equal(s.elapsedMs, t0 + 10 * MIN + 1000, 'descarregada: não conta');
  s.resumeClock();
  NOW += 2000;
  assert.equal(s.elapsedMs, t0 + 10 * MIN + 3000, 'sem contagem duplicada');
});

test('dica aberta sobrevive ao fechamento (o acerto continua valendo como “com dica”)', () => {
  reset();
  start();
  btn('Preciso de uma dica').click();
  reopen();
  root.querySelector('[data-resume="continue"]').click();
  assert.equal(app.session.hintsShown, 1);
  answer('のんで');
  assert.equal(store.getPair('nomimasu', 'te').hinted, 1);
});

test('descartar pede confirmação e não apaga respostas já registradas', () => {
  reset();
  start();
  answer('のんで'); btn('Continuar').click();
  const antes = pairs();
  reopen();
  root.querySelector('[data-resume="discard"]').click();
  assert.ok(root.querySelector('.overlay.show'), 'confirmação');
  root.querySelector('[data-dialog="cancel"]').click();
  assert.ok(store.getState().resume, 'cancelar mantém a sessão salva');
  root.querySelector('[data-resume="discard"]').click();
  root.querySelector('[data-dialog="ok"]').click();
  assert.equal(store.getState().resume, null);
  assert.ok(!text().includes('Continuar sessão anterior'));
  assert.equal(pairs(), antes, 'as respostas continuam registradas');
});

test('começar outra sessão com uma salva pede confirmação', () => {
  reset();
  start();
  answer('のんで');
  reopen();
  app.go('setup', { mode: 'mixed' });
  btn('Começar').click();
  assert.ok(root.querySelector('.overlay.show'), 'pergunta antes de descartar');
  root.querySelector('[data-dialog="cancel"]').click();
  assert.equal(app.view, 'setup');
  assert.ok(store.getState().resume, 'a sessão salva continua lá');
  btn('Começar').click();
  root.querySelector('[data-dialog="ok"]').click();
  assert.equal(app.view, 'practice');
  assert.notEqual(store.getState().resume.id, undefined);
});

test('concluir normalmente uma sessão retomada: registrada uma vez, sessão salva removida', () => {
  reset();
  start(Q.slice(0, 3));
  answer('のんで'); btn('Continuar').click();
  reopen();
  root.querySelector('[data-resume="continue"]').click();
  answer('たべない'); btn('Continuar').click();
  answer('かいた'); btn('Ver resultado')?.click() ?? btn('Continuar')?.click();
  assert.equal(app.view, 'sessionEnd');
  assert.equal(store.getState().resume, null, 'não volta como interrompida');
  assert.equal(store.getState().sessions.length, 1, 'registrada uma única vez');
  app.render(); app.render();
  assert.equal(store.getState().sessions.length, 1);
});

test('encerrar explicitamente remove a sessão salva e preserva o resultado', () => {
  reset();
  start();
  answer('のんで'); btn('Continuar').click();
  btn('Encerrar sessão').click();
  /* pede confirmação, como no Bunpou Lab; Continuar volta à mesma questão */
  assert.ok(root.querySelector('.overlay.show'), 'confirmação de saída');
  root.querySelector('[data-dialog="cancel"]').click();
  assert.equal(app.view, 'practice');
  assert.ok(store.getState().resume, 'cancelar não encerra');
  btn('Encerrar sessão').click();
  root.querySelector('[data-dialog="ok"]').click();
  assert.equal(store.getState().resume, null);
  assert.equal(store.getState().sessions.length, 1);
  assert.equal(store.getPair('nomimasu', 'te').right, 1);
});

test('duas abas: quem retoma assume; a outra larga a sessão sem gravar', () => {
  reset();
  start();
  answer('のんで'); btn('Continuar').click();
  const abaA = app;
  /* a aba B retoma a mesma sessão (outro TAB_ID: simulado mudando o dono) */
  const r = store.getState().resume;
  localStorage.setItem(store.STORAGE_KEY, JSON.stringify({ ...store.getState(), resume: { ...r, owner: 'outra-aba' } }));
  abaA.onExternalChange();
  assert.equal(abaA.session, null, 'a aba A largou a sessão');
  assert.equal(abaA.view, 'home');
  assert.ok(base(root).includes('Esta sessão continuou em outra aba.'));
  /* e enxerga o progresso gravado pela outra aba */
  assert.equal(store.getPair('nomimasu', 'te').right, 1);
});

test('formato antigo (v1) de sessão salva continua retomável', () => {
  reset();
  const s = store.getState();
  s.resume = { config: { mode: 'mixed', limitKind: 'count', length: 3 }, queue: Q.slice(0, 3), answered: 2, correct: 1 };
  store.save();
  reopen();
  assert.ok(text().includes('Continuar sessão anterior'));
  root.querySelector('[data-resume="continue"]').click();
  assert.equal(app.view, 'practice');
  assert.equal(app.session.answered, 2);
});

test('Esc abre a confirmação de saída; Esc de novo cancela; Sair encerra', () => {
  reset();
  start();
  input().value = 'のん'; input().dispatchEvent(new window.Event('input'));
  const esc = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const key = k => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true }));
  esc();
  const ov = root.querySelector('.overlay.show');
  assert.ok(ov, 'Esc abre o diálogo');
  assert.ok(ov.textContent.includes('Sair da sessão?'));
  assert.ok(root.querySelector('[data-dialog="ok"]').classList.contains('msel'), 'Sair começa selecionado');
  key('ArrowLeft');
  assert.ok(root.querySelector('[data-dialog="cancel"]').classList.contains('msel'), 'setas alternam');
  key('Enter');
  assert.equal(root.querySelector('.overlay.show'), null, 'Enter em Continuar fecha');
  assert.equal(app.view, 'practice');
  assert.equal(input().value, 'のん', 'o texto digitado continua');
  esc(); esc();
  assert.equal(root.querySelector('.overlay.show'), null, 'Esc cancela o diálogo');
  assert.equal(app.view, 'practice');
  esc(); key('Enter');
  assert.equal(app.view, 'sessionEnd', 'Enter em Sair encerra a sessão');
  assert.equal(store.getState().resume, null);
});
