/* ===================================================================
   Fluxo de login de ponta a ponta, contra o módulo REAL de autenticação
   (src/auth-sync.js + @netlify/identity 1.2.0).

   Os testes anteriores só provavam que o botão chamava KatsuyouSync.login().
   Isso não pegava o defeito que impedia o login de se concluir: o
   listener de onAuthChange lia o EVENTO como se fosse o usuário.
   A assinatura é (event, user) — ler o primeiro argumento como usuário
   faz o 'login' emitido no retorno do Google, e cada 'token_refresh',
   parecerem "sem usuário", e a conta é zerada logo depois de entrar.
   =================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const ORIGIN = 'https://katsuyou-lab.netlify.app';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: `${ORIGIN}/`,
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

/* A rede não participa destes testes: qualquer chamada falha na hora, o
   que leva a sincronização ao estado 'offline' sem esperar timeout. */
globalThis.fetch = () => Promise.reject(new Error('sem rede no teste'));

const { App } = await import('../src/ui/app.js');
const store = await import('../src/progress/store.js');
const authSync = await import('../src/auth-sync.js');
const { OAUTH_PROVIDER, handleAuthEvent, boot } = authSync;

const root = document.getElementById('app');
const app = new App(root);
window.KatsuyouApp = app;

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const authSource = readFileSync(resolve(SRC, 'auth-sync.js'), 'utf8');
const mainSource = readFileSync(resolve(SRC, 'main.js'), 'utf8');

const sync = () => window.KatsuyouSync;
const topLogin = () => root.querySelector('[data-topbar="login"]');
const topAccount = () => root.querySelector('[data-topbar="account"]');

const USER = { id: 'u-1', email: 'usuario@gmail.com' };

function reset() {
  localStorage.clear();
  store.resetAll();
  handleAuthEvent('logout', null);
  app.acctOpen = false;
  app.go('home');
}

/* Clica de verdade no botão da topbar e captura para onde o navegador
   seria mandado. A troca de `globalThis.window` existe só porque o jsdom
   não deixa redefinir `location`; o clique, o handler e o oauthLogin
   executados são os reais. */
function clickLoginCapturingUrl(selector = '[data-topbar="login"]') {
  const btn = root.querySelector(selector);
  assert.ok(btn, `botão ${selector} não encontrado`);

  const realWindow = globalThis.window;
  let captured = null;
  globalThis.window = {
    location: {
      origin: ORIGIN,
      get href() { return `${ORIGIN}/`; },
      set href(v) { captured = v; }
    },
    KatsuyouApp: realWindow.KatsuyouApp,
    KatsuyouSync: realWindow.KatsuyouSync,
    scrollTo() {},
    addEventListener() {},
    removeEventListener() {}
  };
  try { btn.click(); } finally { globalThis.window = realWindow; }
  return captured;
}

/* ===================================================================
   Inicialização
   =================================================================== */

test('o módulo publica KatsuyouSync e espera o app antes de iniciar', async () => {
  assert.ok(sync(), 'window.KatsuyouSync existe');
  assert.equal(typeof sync().login, 'function');
  assert.equal(typeof sync().logout, 'function');
  assert.equal(typeof sync().syncNow, 'function');
  /* boot só roda quando o app existe — como no Bunpou Lab. */
  assert.match(authSource, /window\.KatsuyouApp\s*\)\s*boot\(\)/);
  assert.match(authSource, /katsuyou-app-ready/);
  assert.match(mainSource, /katsuyou-app-ready/);
});

test('o boot completa sem usuário e força um render da topbar', async () => {
  reset();
  await boot();
  assert.equal(sync().status, 'anonymous');
  assert.ok(topLogin(), 'o controle de login aparece já no primeiro carregamento');
});

/* ===================================================================
   §17.1–5, 11 — do clique até a URL do OAuth
   =================================================================== */

test('usuário anônimo vê "Entrar com Google" com handler ativo', () => {
  reset();
  const btn = topLogin();
  assert.ok(btn, 'o botão existe');
  assert.equal(btn.querySelector('.lbl.full').textContent, 'Entrar com Google');
  assert.equal(btn.disabled, false);
  /* Nada cobrindo o botão: o popover de conta só existe autenticado. */
  assert.equal(root.querySelector('.acct-pop'), null);
});

test('o clique real chega ao OAuth e navega para a URL correta', () => {
  reset();
  const url = clickLoginCapturingUrl();
  assert.ok(url, 'o clique precisa iniciar a navegação');
  assert.equal(url, `${ORIGIN}/.netlify/identity/authorize?provider=google`);
});

test('o provider continua exatamente "google" e a URL é válida', () => {
  reset();
  const url = new URL(clickLoginCapturingUrl());
  assert.equal(OAUTH_PROVIDER, 'google');
  assert.equal(url.origin, ORIGIN);
  assert.equal(url.pathname, '/.netlify/identity/authorize');
  assert.equal(url.searchParams.get('provider'), 'google');
  assert.ok(!url.href.includes('[object Object]'));
});

test('§17.6 o redirect normal não vira erro visível', () => {
  reset();
  clickLoginCapturingUrl();
  assert.notEqual(sync().status, 'error', 'redirecionar não é falhar');
  assert.ok(!root.textContent.includes('Não foi possível sincronizar'));
});

test('§17.9 o login funciona depois de a topbar ser redesenhada', () => {
  reset();
  app.render();
  app.render();
  app.render();
  const url = clickLoginCapturingUrl();
  assert.ok(url?.includes('provider=google'), 'handler perdido após re-render');
});

test('§17.10 o login funciona depois de navegar e voltar', () => {
  reset();
  app.go('progress');
  app.go('reference');
  app.back();
  app.back();
  assert.equal(app.view, 'home');
  const url = clickLoginCapturingUrl();
  assert.ok(url?.includes('provider=google'), 'handler perdido após navegar');
});

test('§17.11 o botão dos Ajustes também chega ao OAuth', () => {
  reset();
  app.go('settings');
  const btn = [...root.querySelectorAll('button')]
    .find(b => b.textContent.trim() === 'Entrar');
  assert.ok(btn, 'o botão dos Ajustes existe');
  /* Mesmo caminho, mesma URL. */
  const realWindow = globalThis.window;
  let captured = null;
  globalThis.window = {
    location: { origin: ORIGIN, get href() { return `${ORIGIN}/`; }, set href(v) { captured = v; } },
    KatsuyouApp: realWindow.KatsuyouApp, KatsuyouSync: realWindow.KatsuyouSync,
    scrollTo() {}, addEventListener() {}, removeEventListener() {}
  };
  try { btn.click(); } finally { globalThis.window = realWindow; }
  assert.equal(captured, `${ORIGIN}/.netlify/identity/authorize?provider=google`);
});

/* ===================================================================
   §17.7 e §17.12 — o retorno do Google restaura o usuário
   ===================================================================
   Estes são os testes que a implementação publicada NÃO passa. */

test('o evento de login do callback restaura o usuário', () => {
  reset();
  assert.equal(sync().user, null);

  /* É exatamente o que handleAuthCallback emite ao voltar do Google:
     emitAuthEvent(AUTH_EVENTS.LOGIN, user) → listener(event, user). */
  handleAuthEvent('login', USER);

  assert.ok(sync().user, 'o usuário tem de ser reconhecido');
  assert.equal(sync().user.id, 'u-1');
  assert.notEqual(sync().status, 'anonymous', 'não pode voltar a anônimo');
});

test('a conta aparece na topbar depois do retorno do Google', () => {
  reset();
  handleAuthEvent('login', USER);
  app.render();
  assert.equal(topLogin(), null, 'o botão de entrar sai de cena');
  assert.ok(topAccount(), 'o chip de conta entra em cena');
});

test('token_refresh NÃO derruba a conta', () => {
  reset();
  handleAuthEvent('login', USER);
  handleAuthEvent('token_refresh', USER);
  handleAuthEvent('token_refresh', USER);
  assert.ok(sync().user, 'a conta some a cada renovação de token');
  assert.equal(sync().user.id, 'u-1');
});

test('user_updated mantém a conta e atualiza os dados', () => {
  reset();
  handleAuthEvent('login', USER);
  handleAuthEvent('user_updated', { ...USER, email: 'novo@gmail.com' });
  assert.equal(sync().user.email, 'novo@gmail.com');
});

test('um evento desconhecido não zera a conta', () => {
  reset();
  handleAuthEvent('login', USER);
  handleAuthEvent('evento_que_nao_existe', undefined);
  assert.ok(sync().user, 'evento estranho não pode derrubar a sessão');
});

test('logout limpa a conta, e só ele faz isso', () => {
  reset();
  handleAuthEvent('login', USER);
  assert.ok(sync().user);
  handleAuthEvent('logout', null);
  assert.equal(sync().user, null);
  assert.equal(sync().status, 'anonymous');
});

test('logout não apaga o progresso local', () => {
  reset();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  handleAuthEvent('login', USER);
  handleAuthEvent('logout', null);
  assert.equal(store.getPair('nomimasu', 'te').right, 1);
});

/* ===================================================================
   Guardas de regressão no código-fonte
   ===================================================================
   Falham com a implementação publicada, que registrava
   `onAuthChange(async u => ...)` — um único parâmetro. */

test('§17.12 o listener de autenticação recebe (event, user)', () => {
  const m = authSource.match(/export function handleAuthEvent\s*\(([^)]*)\)/);
  assert.ok(m, 'o handler precisa existir e ser exportado para poder ser testado');
  const params = m[1].split(',').map(s => s.trim()).filter(Boolean);
  assert.equal(params.length, 2, `esperava (event, user), veio (${params.join(', ')})`);
  assert.equal(params[0], 'event');
  assert.equal(params[1], 'user');
});

test('§17.12 onAuthChange não recebe um handler de um argumento só', () => {
  assert.match(authSource, /onAuthChange\(handleAuthEvent\)/);
  /* A forma antiga: onAuthChange(async u => ...) / onAuthChange(u => ...) */
  assert.doesNotMatch(
    authSource, /onAuthChange\(\s*(async\s+)?\(?\s*\w+\s*\)?\s*=>/,
    'um handler de um parâmetro leria o evento como se fosse o usuário'
  );
});

test('o logout por evento é distinguido de "qualquer coisa sem usuário"', () => {
  assert.match(authSource, /AUTH_EVENTS\.LOGOUT/);
  assert.match(authSource, /import\s*\{[^}]*AUTH_EVENTS[^}]*\}\s*from\s*'@netlify\/identity'/s);
});

/* ===================================================================
   §17.8 — sem Identity o site continua inteiro
   =================================================================== */

test('a ausência da camada de sincronização não quebra o site', () => {
  reset();
  const saved = window.KatsuyouSync;
  delete window.KatsuyouSync;
  try {
    assert.doesNotThrow(() => app.go('home'));
    assert.equal(topLogin(), null, 'sem módulo não se promete login');
    assert.ok(root.querySelector('[data-topbar="settings"]'), 'Ajustes continua');
    assert.ok(root.querySelector('[data-topbar="theme"]'), 'tema continua');

    assert.doesNotThrow(() => app.go('settings'));
    assert.ok(root.textContent.includes('publicado no Netlify'));
    assert.ok([...root.querySelectorAll('button')].some(b => b.textContent.trim() === 'Exportar progresso'));

    /* E dá para estudar normalmente. */
    app.startSession({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'te' }], length: 1 });
    root.querySelector('input.answer').value = 'のんで';
    [...root.querySelectorAll('button')].find(b => b.textContent.trim() === 'Responder').click();
    assert.ok(root.textContent.includes('✓ Correto'));
  } finally {
    window.KatsuyouSync = saved;
  }
});
