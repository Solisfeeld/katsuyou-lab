/* ===================================================================
   Navegação: toda tela secundária tem uma saída explícita.

   A logo continua sendo um atalho para a home, mas nunca a única forma
   de voltar. O padrão é o do Bunpou Lab: pilha explícita de telas, com
   as telas de sessão fora dela (elas têm saída própria), e a home como
   raiz que zera a pilha.

   Inventário das telas do 活用ラボ:

     home        raiz, sem Voltar
     setup       configuração de sessão (mixed | form | group | weak)
     practice    exercício — saída própria: "Encerrar sessão"
     sessionEnd  resultado — saída própria: "Voltar ao início"
     progress    progresso, pontos fracos e matriz de domínio
     errors      erros recentes
     reference   referência das regras
     settings    Ajustes

   "Pontos fracos" e "matriz de domínio" não são telas próprias: a
   primeira é um modo de sessão (setup), a segunda é um cartão dentro de
   progress. Ambas são cobertas pelas telas que as contêm.
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
dom.window.URL.revokeObjectURL = () => {};
globalThis.URL = dom.window.URL;

const { App } = await import('../src/ui/app.js');
const store = await import('../src/progress/store.js');

const root = document.getElementById('app');
const app = new App(root);
const text = () => root.textContent;

const backBtn = () => root.querySelector('[data-nav="back"]');
const top = what => root.querySelector(`[data-topbar="${what}"]`);
const btnByText = label => [...root.querySelectorAll('button')]
  .find(b => b.textContent.trim() === label);

function reset() {
  localStorage.clear();
  store.resetAll();
  delete window.KatsuyouSync;
  app.nav = [];
  app.settingsReturn = null;
  app.session = null;
  app.go('home');
}

/* Telas abertas a partir da home. */
const SECUNDARIAS = [
  ['setup · sessão mista', () => app.go('setup', { mode: 'mixed' })],
  ['setup · treinar uma forma', () => app.go('setup', { mode: 'form' })],
  ['setup · treinar grupos', () => app.go('setup', { mode: 'group' })],
  ['setup · pontos fracos', () => app.go('setup', { mode: 'weak' })],
  ['progresso', () => app.go('progress')],
  ['erros recentes', () => app.go('errors')],
  ['referência', () => app.go('reference')],
  ['ajustes', () => app.go('settings')]
];

/* ===================================================================
   Toda tela secundária tem Voltar
   =================================================================== */

for (const [nome, abrir] of SECUNDARIAS) {
  test(`${nome} oferece "← Voltar" e retorna à home`, () => {
    reset();
    abrir();
    const b = backBtn();
    assert.ok(b, `${nome} não tem botão de voltar`);
    assert.equal(b.textContent.trim(), '← Voltar');
    b.click();
    assert.equal(app.view, 'home', `${nome} não voltou para a home`);
  });
}

test('a home não tem — nem precisa de — botão Voltar', () => {
  reset();
  assert.equal(backBtn(), null);
});

test('progresso e erros recentes têm Voltar mesmo sem histórico', () => {
  reset();
  /* Sem nenhuma resposta registrada as duas telas usam a saída curta. */
  app.go('progress');
  assert.ok(text().includes('Nenhuma resposta registrada'));
  assert.ok(backBtn(), 'progresso vazio ficou sem Voltar');

  app.go('home');
  app.go('errors');
  assert.ok(text().includes('Nada registrado ainda'));
  assert.ok(backBtn(), 'erros vazios ficaram sem Voltar');
});

test('as telas de sessão têm saída própria', () => {
  reset();
  app.startSession({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'te' }], length: 1 });
  assert.ok(btnByText('Encerrar sessão'), 'o exercício tem saída própria');

  app.endSession(app.session);
  assert.ok(btnByText('Voltar ao início'), 'o resultado tem saída própria');
  btnByText('Voltar ao início').click();
  assert.equal(app.view, 'home');
});

/* ===================================================================
   Voltar respeita o contexto de origem
   =================================================================== */

test('Voltar devolve à tela anterior, não sempre à home', () => {
  reset();
  app.go('progress');
  app.go('settings');
  assert.equal(app.view, 'settings');
  backBtn().click();
  assert.equal(app.view, 'progress', 'deveria voltar ao progresso');
  backBtn().click();
  assert.equal(app.view, 'home');
});

test('Voltar preserva o contexto (o modo) da tela de configuração', () => {
  reset();
  app.go('setup', { mode: 'form' });
  app.go('settings');
  backBtn().click();
  assert.equal(app.view, 'setup');
  assert.equal(app.params.mode, 'form', 'o modo da sessão se perdeu');
  assert.ok(text().includes('Treinar uma forma'));
});

test('a pilha não cresce sem limite nem repete a mesma tela', () => {
  reset();
  for (let i = 0; i < 30; i++) { app.go('progress'); app.go('reference'); }
  assert.ok(app.nav.length <= 12, `pilha com ${app.nav.length} entradas`);
  /* Voltar continua funcionando e termina na home. */
  for (let i = 0; i < 20 && app.view !== 'home'; i++) backBtn()?.click();
  assert.equal(app.view, 'home');
});

test('a home zera a pilha: Voltar nunca reabre uma sessão encerrada', () => {
  reset();
  app.startSession({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'te' }], length: 1 });
  app.endSession(app.session);
  btnByText('Voltar ao início').click();
  assert.equal(app.view, 'home');
  assert.deepEqual(app.nav, []);

  app.go('reference');
  backBtn().click();
  assert.equal(app.view, 'home');
  assert.ok(!app.nav.some(e => e.view === 'practice' || e.view === 'sessionEnd'));
});

/* ===================================================================
   §18 — Ajustes durante uma sessão
   =================================================================== */

test('Ajustes aberto durante a sessão volta para a MESMA sessão', () => {
  reset();
  app.startSession({
    mode: 'review',
    queue: [{ verbId: 'nomimasu', form: 'te' }, { verbId: 'tabemasu', form: 'nai' }],
    length: 2
  });
  const sessao = app.session;
  /* Responde uma para a sessão ter estado. */
  root.querySelector('input.answer').value = 'のんで';
  btnByText('Responder').click();
  btnByText('Próxima').click();
  assert.equal(root.querySelector('.q-prompt').textContent, 'たべます');

  top('settings').click();
  assert.equal(app.view, 'settings');
  assert.ok(app.session, 'a sessão não pode ser descartada ao abrir Ajustes');

  backBtn().click();
  assert.equal(app.view, 'practice');
  assert.equal(app.session, sessao, 'voltou para outra sessão');
  assert.equal(app.session.answered, 1, 'o progresso da sessão se perdeu');
  assert.equal(root.querySelector('.q-prompt').textContent, 'たべます', 'a questão mudou');
});

test('Ajustes aberto sobre o resultado volta para o resultado', () => {
  reset();
  app.startSession({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'te' }], length: 1 });
  root.querySelector('input.answer').value = 'のんで';
  btnByText('Responder').click();
  app.endSession(app.session);
  assert.ok(text().includes('Fim da sessão'));

  top('settings').click();
  backBtn().click();
  assert.equal(app.view, 'sessionEnd');
  assert.ok(text().includes('Fim da sessão'));
  /* E a sessão não foi gravada duas vezes. */
  assert.equal(store.getState().sessions.length, 1);
});

test('a logo continua levando para a home, mas não é a única saída', () => {
  reset();
  app.go('reference');
  assert.ok(backBtn(), 'existe Voltar explícito');
  root.querySelector('.brand').click();
  assert.equal(app.view, 'home', 'a logo continua funcionando');
});

/* ===================================================================
   §19 — nada duplicado
   =================================================================== */

function stubSync(over = {}) {
  const calls = { syncNow: 0, login: 0, logout: 0 };
  window.KatsuyouSync = {
    status: 'synced', user: { id: 'u-1', email: 'a@b.com' }, lastSyncedAt: Date.now(),
    login() { calls.login++; }, logout() { calls.logout++; },
    syncNow() { calls.syncNow++; },
    keepLocal() {}, keepRemote() {}, notifyLocalChange() {},
    ...over
  };
  window.KatsuyouSync.calls = calls;
  return window.KatsuyouSync;
}

test('"Sincronizar agora" existe só no controle de conta da topbar', () => {
  reset();
  stubSync();
  app.go('settings');

  /* Não está no corpo dos Ajustes. */
  assert.equal(btnByText('Sincronizar agora'), undefined,
    'Ajustes não pode repetir a ação da topbar');
  assert.ok(text().includes('Conta'), 'a seção continua existindo');
  assert.ok(text().includes('a@b.com'), 'mostrando a conta');
  assert.ok(text().includes('Progresso sincronizado'), 'e o estado');
  assert.ok(btnByText('Sair desta conta'), 'e o logout');

  /* Está no popover da conta, e é o único lugar. */
  top('account').click();
  const noPopover = [...root.querySelectorAll('.acct-pop button')]
    .filter(b => b.textContent.trim() === 'Sincronizar agora');
  assert.equal(noPopover.length, 1);
  const total = [...root.querySelectorAll('button')]
    .filter(b => b.textContent.trim() === 'Sincronizar agora');
  assert.equal(total.length, 1, 'há mais de um "Sincronizar agora" na tela');
});

test('o conflito continua resolvível pelos Ajustes', () => {
  reset();
  const sync = stubSync({ status: 'conflict' });
  app.go('settings');
  assert.ok(text().includes('Há progresso diferente neste dispositivo e na sua conta.'));
  btnByText('Usar progresso deste dispositivo').click();
  assert.equal(sync.calls.syncNow, 0, 'conflito não usa o caminho de sincronizar agora');
});

test('o ajuste de mostrar o grupo existe só em Ajustes', () => {
  reset();
  /* Não está na home. */
  assert.equal(root.querySelector('[data-setting="hide-group"]'), null,
    'a home não pode ter o controle');
  assert.ok(!text().includes('Esconder o grupo'), 'o cartão de configuração saiu da home');
  assert.equal(root.querySelector('[aria-pressed]'), null, 'a home não tem controle de estado');

  /* Está em Ajustes, na seção Treino. */
  app.go('settings');
  const toggle = root.querySelector('[data-setting="hide-group"]');
  assert.ok(toggle, 'o ajuste precisa continuar existindo em Ajustes');
  assert.ok(text().includes('Esconder o grupo durante o exercício'), 'com o rótulo explicativo');
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(toggle.textContent.trim(), 'Visível');
  toggle.click();
  assert.equal(store.getState().settings.hideGroup, true);
  assert.equal(root.querySelector('[data-setting="hide-group"]').textContent.trim(), 'Oculto');
});

test('a home só informa o estado do grupo, sem controle', () => {
  reset();
  store.updateSettings({ hideGroup: true });
  app.go('home');
  assert.ok(text().includes('grupo oculto no exercício'), 'o aviso informativo');
  assert.equal(root.querySelector('[data-setting="hide-group"]'), null,
    'informar não é oferecer o controle');

  /* No padrão, nem o aviso aparece: a home fica só para estudar. */
  store.updateSettings({ hideGroup: false });
  app.go('home');
  assert.ok(!text().includes('grupo oculto no exercício'));
});

test('a home prioriza começar a estudar', () => {
  reset();
  for (const opcao of [
    'Sessão mista', 'Treinar uma forma', 'Treinar grupos',
    'Pontos fracos', 'Erros recentes', 'Progresso', 'Referência'
  ]) {
    assert.ok(text().includes(opcao), `faltou "${opcao}" na home`);
  }
  /* Nenhum cartão de configuração. */
  assert.ok(!text().includes('Aparência'));
  assert.ok(!text().includes('Backup do progresso'));
  assert.ok(!text().includes('Apagar progresso'));
});

/* ===================================================================
   §15 — mobile
   =================================================================== */

test('no celular nada essencial desaparece', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });

  for (const [nome, abrir] of SECUNDARIAS) {
    abrir();
    assert.ok(backBtn(), `${nome}: Voltar sumiu`);
    assert.ok(root.querySelector('.brand'), `${nome}: logo sumiu`);
    assert.ok(top('settings'), `${nome}: Ajustes sumiu`);
    assert.ok(top('theme'), `${nome}: tema sumiu`);
    assert.ok(top('login'), `${nome}: login sumiu`);
    app.go('home');
  }
});

test('o popover de conta não cobre o botão Voltar', () => {
  reset();
  stubSync();
  app.go('progress');
  top('account').click();
  const pop = root.querySelector('.acct-pop');
  assert.ok(pop, 'o popover abriu');
  /* O popover vive dentro da topbar; o Voltar fica no corpo da página. */
  assert.ok(root.querySelector('.topbar').contains(pop));
  assert.ok(!pop.contains(backBtn()));
  assert.ok(backBtn(), 'o Voltar continua na tela');
  /* E continua clicável. */
  backBtn().click();
  assert.equal(app.view, 'home');
});
