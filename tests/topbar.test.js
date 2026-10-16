/* ===================================================================
   Navegação global: conta, Ajustes e tema na barra superior.

   O padrão é o do Bunpou Lab — os três controles ficam sempre visíveis
   à direita, e nenhum deles se esconde atrás de menu. Aqui provamos que
   estão presentes, ligados à infraestrutura certa e que o celular não
   perde nenhum dos três.
   =================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
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

const top = what => root.querySelector(`[data-topbar="${what}"]`);
const bar = () => root.querySelector('.topbar');

function reset() {
  localStorage.clear();
  store.resetAll();
  app.acctOpen = false;
  delete window.KatsuyouSync;
}

function stubSync(over = {}) {
  const calls = { login: 0, logout: 0, syncNow: 0, keepLocal: 0, keepRemote: 0 };
  window.KatsuyouSync = {
    status: 'anonymous',
    user: null,
    lastSyncedAt: null,
    login() { calls.login++; },
    logout() { calls.logout++; this.user = null; this.status = 'anonymous'; },
    syncNow() { calls.syncNow++; },
    keepLocal() { calls.keepLocal++; },
    keepRemote() { calls.keepRemote++; },
    notifyLocalChange() {},
    ...over
  };
  window.KatsuyouSync.calls = calls;
  return window.KatsuyouSync;
}

const GOOGLE_USER = { id: 'u-1', email: 'usuario@gmail.com' };

/* ===================================================================
   Estrutura da barra
   =================================================================== */

test('a topbar traz a identidade e os três controles globais', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  app.go('home');

  const b = bar();
  assert.ok(b, 'a topbar existe');
  assert.ok(b.textContent.includes('活用ラボ'));
  assert.ok(b.textContent.includes('Laboratório de Conjugação — Rikai N5'));
  assert.ok(b.querySelector('.brand .seal').textContent === '活');

  assert.ok(top('login'), 'conta/login');
  assert.ok(top('settings'), 'Ajustes');
  assert.ok(top('theme'), 'tema');
});

test('a ordem é identidade · conta · Ajustes · tema', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  app.go('home');
  const ordem = [...bar().querySelectorAll('button')]
    .map(b => b.className.split(' ')[0] + (b.dataset.topbar ? `:${b.dataset.topbar}` : ''));
  assert.deepEqual(ordem, ['brand', 'acct-btn:login', 'topbtn:settings', 'icon-btn:theme']);
});

test('os controles globais aparecem em todas as telas', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  for (const view of ['home', 'progress', 'errors', 'reference', 'settings']) {
    app.go(view);
    assert.ok(top('login'), `login some em ${view}`);
    assert.ok(top('settings'), `Ajustes some em ${view}`);
    assert.ok(top('theme'), `tema some em ${view}`);
  }
  /* Inclusive durante o exercício. */
  app.startSession({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'te' }], length: 1 });
  assert.ok(top('login') && top('settings') && top('theme'));
});

/* ===================================================================
   Login visível na barra (§2)
   =================================================================== */

test('usuário anônimo vê o login na topbar, sem precisar abrir Ajustes', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  app.go('home');

  const btn = top('login');
  assert.ok(btn);
  assert.equal(btn.querySelector('.lbl.full').textContent, 'Entrar com Google');
  assert.equal(btn.querySelector('.lbl.short').textContent, 'Entrar');
  assert.equal(top('account'), null, 'não há chip de conta sem usuário');
});

test('o botão da topbar chama KatsuyouSync.login()', () => {
  reset();
  const sync = stubSync({ status: 'anonymous', user: null });
  app.go('home');
  top('login').click();
  assert.equal(sync.calls.login, 1);
});

/* ===================================================================
   Conta autenticada (§3, §4)
   =================================================================== */

test('autenticado, o login vira um chip de conta com estado compacto', () => {
  reset();
  stubSync({ status: 'synced', user: GOOGLE_USER, lastSyncedAt: Date.now() - 4000 });
  app.go('home');

  assert.equal(top('login'), null, 'o botão de entrar sai de cena');
  const chip = top('account');
  assert.ok(chip);
  assert.equal(chip.querySelector('.lbl.full').textContent, 'Sincronizado');
  assert.ok(chip.querySelector('.sdot.ok'), 'indicador verde de sincronizado');
  /* O e-mail não fica ocupando a barra. */
  assert.ok(!chip.textContent.includes('usuario@gmail.com'));
});

const ESTADOS = [
  ['synced', 'Sincronizado', 'ok', ''],
  ['loading', 'Sincronizando', 'warn', ''],
  ['dirty', 'Pendente', 'warn', 'warn'],
  ['offline', 'Offline', 'warn', 'warn'],
  ['conflict', 'Conflito', 'bad', 'attn'],
  ['error', 'Erro', 'bad', 'attn'],
  ['auth-required', 'Sessão expirada', 'bad', 'attn']
];

for (const [status, chipText, dot, tone] of ESTADOS) {
  test(`o chip mostra o estado "${status}" de forma compacta`, () => {
    reset();
    stubSync({ status, user: GOOGLE_USER });
    app.go('home');
    const chip = top('account');
    assert.ok(chip, `sem chip no estado ${status}`);
    assert.equal(chip.querySelector('.lbl.full').textContent, chipText);
    assert.ok(chip.querySelector(`.sdot.${dot}`), `indicador errado em ${status}`);
    if (tone) assert.ok(chip.classList.contains(tone), `tom errado em ${status}`);
  });
}

test('o chip abre os detalhes da conta', () => {
  reset();
  stubSync({ status: 'synced', user: GOOGLE_USER, lastSyncedAt: Date.now() - 3000 });
  app.go('home');
  assert.equal(root.querySelector('.acct-pop'), null, 'começa fechado');

  top('account').click();
  const pop = root.querySelector('.acct-pop');
  assert.ok(pop, 'o popover abriu');
  assert.ok(pop.textContent.includes('Progresso sincronizado'));
  assert.ok(pop.textContent.includes('usuario@gmail.com'), 'o e-mail aparece aqui, não na barra');
  assert.ok(pop.textContent.includes('Última sincronização: agora há pouco'));
  assert.ok(pop.textContent.includes('Sincronizar agora'));
  assert.ok(pop.textContent.includes('Sair desta conta'));
});

test('"Sincronizar agora" usa a infraestrutura existente', () => {
  reset();
  const sync = stubSync({ status: 'synced', user: GOOGLE_USER });
  app.go('home');
  top('account').click();
  [...root.querySelectorAll('.acct-pop button')]
    .find(b => b.textContent.trim() === 'Sincronizar agora').click();
  assert.equal(sync.calls.syncNow, 1);
});

test('em conflito o popover encaminha para Ajustes, onde estão as duas opções', () => {
  reset();
  const sync = stubSync({ status: 'conflict', user: GOOGLE_USER });
  app.go('home');
  top('account').click();
  const btn = [...root.querySelectorAll('.acct-pop button')]
    .find(b => b.textContent.trim() === 'Resolver conflito');
  assert.ok(btn);
  btn.click();

  assert.equal(app.view, 'settings');
  assert.ok(text().includes('Há progresso diferente neste dispositivo e na sua conta.'));
  assert.ok([...root.querySelectorAll('button')].some(b => b.textContent.trim() === 'Usar progresso deste dispositivo'));
  assert.ok([...root.querySelectorAll('button')].some(b => b.textContent.trim() === 'Usar progresso da nuvem'));
  /* Nada foi resolvido por conta própria. */
  assert.equal(sync.calls.keepLocal, 0);
  assert.equal(sync.calls.keepRemote, 0);
});

test('sessão expirada oferece entrar novamente', () => {
  reset();
  const sync = stubSync({ status: 'auth-required', user: GOOGLE_USER });
  app.go('home');
  top('account').click();
  [...root.querySelectorAll('.acct-pop button')]
    .find(b => b.textContent.trim() === 'Entrar novamente com Google').click();
  assert.equal(sync.calls.login, 1);
});

test('logout pelo popover funciona e não apaga o progresso', async () => {
  reset();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  const sync = stubSync({ status: 'synced', user: GOOGLE_USER });
  app.go('home');
  top('account').click();

  [...root.querySelectorAll('.acct-pop button')]
    .find(b => b.textContent.trim() === 'Sair desta conta').click();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(sync.calls.logout, 1);
  assert.equal(store.getPair('nomimasu', 'te').right, 1, 'o progresso continua');
  assert.ok(top('login'), 'a barra volta a oferecer entrar');
});

test('clicar fora e Esc fecham o popover', () => {
  reset();
  stubSync({ status: 'synced', user: GOOGLE_USER });
  app.go('home');

  top('account').click();
  assert.ok(root.querySelector('.acct-pop'));
  document.body.click();
  assert.equal(root.querySelector('.acct-pop'), null, 'clique fora fechou');

  top('account').click();
  assert.ok(root.querySelector('.acct-pop'));
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(root.querySelector('.acct-pop'), null, 'Esc fechou');
});

/* ===================================================================
   Ajustes (§5)
   =================================================================== */

test('Ajustes é um controle nomeado, não um ícone ambíguo', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  app.go('home');
  const btn = top('settings');
  assert.equal(btn.querySelector('.lbl.full').textContent, 'Ajustes');
  assert.equal(btn.getAttribute('aria-label'), 'Ajustes');
  assert.ok(btn.querySelector('.lbl.short'), 'tem versão compacta para telas estreitas');
});

test('o botão de Ajustes abre a página certa', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  app.go('home');
  top('settings').click();

  assert.equal(app.view, 'settings');
  assert.ok(root.querySelector('.page-title').textContent === 'Ajustes');
  /* As quatro seções, no formato do Bunpou Lab: rótulo + card. */
  const secoes = [...root.querySelectorAll('.h-sec')].map(e => e.textContent);
  assert.deepEqual(secoes, ['Treino', 'Aparência', 'Conta', 'Dados']);
});

test('Ajustes fica marcado como tela atual', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  app.go('home');
  assert.ok(!top('settings').classList.contains('on'));
  app.go('settings');
  assert.ok(top('settings').classList.contains('on'));
  assert.equal(top('settings').getAttribute('aria-current'), 'page');
});

test('§10 Ajustes continua completo sem login', () => {
  reset();                       // sem KatsuyouSync
  app.go('settings');
  const secoes = [...root.querySelectorAll('.h-sec')].map(e => e.textContent);
  assert.deepEqual(secoes, ['Treino', 'Aparência', 'Conta', 'Dados']);
  assert.ok([...root.querySelectorAll('button')].some(b => b.textContent.trim() === 'Exportar progresso'));
  assert.ok([...root.querySelectorAll('button')].some(b => b.textContent.trim() === 'Importar progresso'));
  assert.ok([...root.querySelectorAll('button')].some(b => b.textContent.trim() === 'Resetar progresso'));
});

/* ===================================================================
   Tema (§7)
   =================================================================== */

test('o tema continua com os três estados e cicla pela topbar', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  app.applyTheme('auto');
  app.go('home');

  assert.equal(top('theme').textContent, '◐');
  top('theme').click();
  assert.equal(app.theme, 'light');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(top('theme').textContent, '☀');

  top('theme').click();
  assert.equal(app.theme, 'dark');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(top('theme').textContent, '☾');

  top('theme').click();
  assert.equal(app.theme, 'auto', 'volta ao automático');
});

test('Aparência oferece os mesmos três temas', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  app.applyTheme('auto');
  app.go('settings');

  const chips = [...root.querySelectorAll('.chip')].filter(c => /Automático|Claro|Escuro/.test(c.textContent));
  assert.equal(chips.length, 3);
  chips.find(c => c.textContent.includes('Escuro')).click();
  assert.equal(app.theme, 'dark');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  /* E a topbar acompanha. */
  assert.equal(top('theme').textContent, '☾');
});

/* ===================================================================
   Mobile (§9)
   =================================================================== */

test('no celular os três controles continuam presentes, em versão compacta', () => {
  reset();
  stubSync({ status: 'dirty', user: GOOGLE_USER });
  app.go('home');

  /* Nenhum controle é removido do DOM: o que muda é o rótulo, por CSS. */
  assert.ok(top('account') && top('settings') && top('theme'));
  assert.ok(top('account').querySelector('.lbl.short'), 'conta tem rótulo curto');
  assert.ok(top('settings').querySelector('.lbl.short'), 'Ajustes tem rótulo curto');

  const css = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles.css'), 'utf8'
  );
  const mobile = css.slice(css.indexOf('@media(max-width:640px)'));
  assert.ok(mobile.includes('.acct-btn .lbl.full{display:none;}'), 'chip encolhe');
  assert.ok(mobile.includes('.topbtn .lbl.short{display:inline'), 'Ajustes vira ícone');
  assert.ok(mobile.includes('.brand-txt span{display:none;}'), 'o subtítulo cede espaço');
  assert.ok(mobile.includes('.acct-pop{position:fixed'), 'o popover cabe na tela estreita');
  /* Nada é escondido atrás de menu: não existe hambúrguer. */
  assert.equal(root.querySelector('[data-topbar="menu"]'), null);
});

/* ===================================================================
   Sem a camada de sincronização (§10, §11)
   =================================================================== */

test('a ausência de KatsuyouSync não quebra o site', () => {
  reset();                       // window.KatsuyouSync ausente
  assert.doesNotThrow(() => app.go('home'));
  assert.ok(bar(), 'a topbar continua de pé');
  assert.equal(top('login'), null, 'sem módulo, não se promete login');
  assert.equal(top('account'), null);
  /* Ajustes e tema continuam funcionando. */
  assert.ok(top('settings'));
  assert.ok(top('theme'));
  top('theme').click();
  assert.ok(['auto', 'light', 'dark'].includes(app.theme));
  top('settings').click();
  assert.equal(app.view, 'settings');
  assert.ok(text().includes('publicado no Netlify'));
});

test('o estudo continua íntegro sem conta', () => {
  reset();
  app.go('home');
  assert.ok(text().includes('Sessão mista'));
  app.startSession({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'te' }], length: 1 });
  root.querySelector('input.answer').value = 'のんで';
  [...root.querySelectorAll('button')].find(b => b.textContent.trim() === 'Responder').click();
  assert.ok(text().includes('✓ Correto'));
  assert.equal(store.getPair('nomimasu', 'te').right, 1);
});
