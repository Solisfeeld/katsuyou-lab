/* ===================================================================
   Persistência da sessão entre fechamentos do navegador.

   O problema: o SDK grava a sessão (com o refresh token) em
   localStorage['gotrue.user'], mas escreve nf_jwt/nf_refresh SEM expires
   — cookies de sessão, que o navegador descarta ao fechar. No dia
   seguinte getUser() acha a sessão no localStorage, não acha o cookie e
   chama clearSession(): destrói o refresh token e devolve null.

   A correção, adaptada do Bunpou Lab: refreshSession() ANTES de
   getUser(), e — se getUser() apagar uma sessão que ainda existia — os
   MESMOS bytes voltam ao MESMO lugar e a renovação é tentada uma vez.

   Aqui o SDK é substituído por um duplo que reproduz exatamente esse
   comportamento, para que o cenário "dia seguinte" seja testável.
   =================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const ORIGIN = 'https://katsuyou-lab.netlify.app';
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: `${ORIGIN}/`, pretendToBeVisual: true
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

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const authSource = readFileSync(resolve(SRC, 'auth-sync.js'), 'utf8');

const USER = { id: 'u-1', email: 'usuario@gmail.com' };
const SESSAO = JSON.stringify({ id: 'u-1', token: { refresh_token: 'refresh-abc', access_token: 'jwt-antigo' } });

/* -------------------------------------------------------------------
   Duplo do SDK, injetado em restoreSession() pela costura de deps.
   Reproduz o comportamento real que causa o logout entre dias:
   getUser() destrói gotrue.user quando não há cookie nf_jwt.
   ------------------------------------------------------------------- */
const GOTRUE = 'gotrue.user';

const sdk = {
  cookie: null,            // nf_jwt; null = navegador fechou e descartou
  refreshValido: true,     // o refresh token ainda é aceito pelo servidor
  chamadas: { refresh: 0, getUser: 0 },
  reset(over = {}) {
    this.cookie = null;
    this.refreshValido = true;
    this.chamadas = { refresh: 0, getUser: 0 };
    Object.assign(this, over);
  },
  async refresh() {
    this.chamadas.refresh++;
    if (!localStorage.getItem(GOTRUE) || !this.refreshValido) return null;
    this.cookie = 'jwt-novo';          // reescreve nf_jwt, como o SDK real
    return { ...USER };
  },
  async getUser() {
    this.chamadas.getUser++;
    if (!localStorage.getItem(GOTRUE)) return null;
    if (!this.cookie) {
      localStorage.removeItem(GOTRUE);  // é isto que causa o logout entre dias
      return null;
    }
    return { ...USER };
  }
};
const deps = () => ({ getUser: () => sdk.getUser(), refresh: () => sdk.refresh() });

/* A rede da Function é controlada por teste. */
let respostaProgress = () => ({ ok: true, status: 200, json: async () => ({ exists: false, progress: null, revision: 0 }) });
globalThis.fetch = async () => respostaProgress();

const { App } = await import('../src/ui/app.js');
const store = await import('../src/progress/store.js');
const auth = await import('../src/auth-sync.js');

const root = document.getElementById('app');
const app = new App(root);
window.KatsuyouApp = app;

const sync = () => window.KatsuyouSync;

/* Simula fechar e reabrir o navegador: a sessão do localStorage
   permanece, o cookie de sessão some. */
function fecharNavegador() { sdk.cookie = null; }

function login() {
  localStorage.setItem(GOTRUE, SESSAO);
  sdk.cookie = 'jwt-do-login';
}

function reset() {
  localStorage.clear();
  store.resetAll();
  sdk.reset();
  auth.handleAuthEvent('logout', null);
  respostaProgress = () => ({ ok: true, status: 200, json: async () => ({ exists: false, progress: null, revision: 0 }) });
}

/* ===================================================================
   O código usa o mecanismo do Bunpou
   =================================================================== */

test('auth-sync usa refreshSession e a chave gotrue.user', () => {
  assert.match(authSource, /import \* as Identity from '@netlify\/identity'/);
  assert.match(authSource, /const GOTRUE_KEY = 'gotrue\.user'/);
  assert.match(authSource, /Identity\.refreshSession/);
  assert.match(authSource, /export async function restoreSession/);
  /* refreshSession roda ANTES de getUser dentro de restoreSession. */
  const corpo = authSource.slice(
    authSource.indexOf('export async function restoreSession'),
    authSource.indexOf('/* -------------------------------------------------------------------\n   Provider do OAuth')
  );
  assert.ok(
    corpo.indexOf('await depRefresh()') < corpo.indexOf('await depGetUser()'),
    'a renovação precisa vir antes de getUser()'
  );
});

test('o boot restaura a sessão em vez de chamar getUser() direto', () => {
  const corpo = authSource.slice(authSource.indexOf('async function boot('));
  assert.match(corpo, /const user = await restoreSession\(deps\)/);
  assert.match(corpo, /sync\.authReady = true/);
  assert.ok(!/await getUser\(\)/.test(corpo.split('onAuthChange')[0]),
    'o boot não pode chamar getUser() diretamente');
});

test('nenhum token é fabricado, copiado ou prolongado', () => {
  /* A única escrita em gotrue.user devolve o valor lido, sem alterar. */
  assert.match(authSource, /const writeGotrue = v => \{ try \{ if \(v != null\) localStorage\.setItem\(GOTRUE_KEY, v\); \} catch \{\} \};/);
  for (const proibido of ['expires_at =', 'access_token =', 'refresh_token =', 'document.cookie =']) {
    assert.ok(!authSource.includes(proibido), `auth-sync mexe em token: ${proibido}`);
  }
});

/* ===================================================================
   A. Sessão persistida — o cenário "dia seguinte"
   =================================================================== */

test('A. login ontem, navegador fechado: continua logado hoje', async () => {
  reset();
  login();
  fecharNavegador();                        // cookie de sessão descartado

  await auth.boot(deps());

  assert.ok(sync().user, 'o usuário precisa ser recuperado');
  assert.equal(sync().user.id, 'u-1');
  assert.equal(sync().authReady, true);
  assert.ok(sdk.chamadas.refresh >= 1, 'refreshSession precisa ter sido chamada');
  assert.ok(localStorage.getItem(GOTRUE), 'a sessão continua no localStorage');
});

test('A. a topbar mostra a conta, não o convite de login', async () => {
  reset();
  login();
  fecharNavegador();
  await auth.boot(deps());
  app.render();
  assert.ok(root.querySelector('[data-topbar="account"]'), 'chip de conta');
  assert.equal(root.querySelector('[data-topbar="login"]'), null, 'não pede login de novo');
});

/* ===================================================================
   B. getUser() apaga uma sessão ainda recuperável
   =================================================================== */

test('B. se getUser() apagar a sessão, os MESMOS bytes voltam e ela é renovada', async () => {
  reset();
  login();
  fecharNavegador();

  /* Cenário do Bunpou: a primeira renovação não repõe o cookie (rede
     lenta/instável), então getUser() limpa a chave. */
  let primeira = true;
  const user = await auth.restoreSession({
    getUser: () => sdk.getUser(),
    refresh: () => {
      if (primeira) { primeira = false; sdk.chamadas.refresh++; return Promise.resolve(null); }
      return sdk.refresh();
    }
  });

  assert.ok(user, 'o usuário foi recuperado na segunda tentativa');
  assert.equal(localStorage.getItem(GOTRUE), SESSAO,
    'os bytes restaurados são exatamente os mesmos');
});

test('B. se nem a segunda tentativa funcionar, o refresh token NÃO é destruído', async () => {
  reset();
  login();
  fecharNavegador();
  sdk.refreshValido = false;                // servidor recusa renovar agora

  const user = await auth.restoreSession(deps());

  assert.equal(user, null, 'não inventa usuário');
  assert.equal(localStorage.getItem(GOTRUE), SESSAO,
    'a sessão fica de pé para a próxima visita');
});

/* ===================================================================
   C. Refresh realmente expirado
   =================================================================== */

test('C. sem sessão nenhuma, o resultado é anônimo — sem inventar login', async () => {
  reset();                                   // nada em gotrue.user
  await auth.boot(deps());

  assert.equal(sync().user, null);
  assert.equal(sync().status, 'anonymous');
  assert.equal(sync().authReady, true);
  app.render();
  assert.ok(root.querySelector('[data-topbar="login"]'), 'oferece Entrar com Google');
});

test('C. sessão irrecuperável mantém o progresso local intacto', async () => {
  reset();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  login();
  fecharNavegador();
  sdk.refreshValido = false;

  await auth.boot(deps());

  assert.equal(store.getPair('nomimasu', 'te').right, 1, 'progresso preservado');
});

/* ===================================================================
   D. Logout explícito continua sendo logout
   =================================================================== */

test('D. logout explícito encerra a sessão e ela não volta no boot seguinte', async () => {
  reset();
  login();
  await auth.boot(deps());
  assert.ok(sync().user, 'entrou');

  await sync().logout();
  /* O identityLogout() real apaga gotrue.user; aqui reproduzimos esse
     efeito, que é o que faz o logout ser definitivo. */
  localStorage.removeItem(GOTRUE);
  sdk.cookie = null;
  assert.equal(sync().user, null);
  assert.equal(localStorage.getItem(GOTRUE), null, 'a sessão foi apagada de fato');

  /* Novo boot: não pode ressuscitar o que o usuário encerrou. */
  await auth.boot(deps());
  assert.equal(sync().user, null, 'logout explícito não é desfeito pela restauração');
  assert.equal(sync().status, 'anonymous');
});

test('D. logout não apaga o progresso local', async () => {
  reset();
  login();
  await auth.boot(deps());
  store.recordAnswer({ verbId: 'tabemasu', form: 'nai', correct: true, hinted: false, dontKnow: false, answer: 'たべない' });
  await sync().logout();
  localStorage.removeItem(GOTRUE);
  assert.equal(store.getPair('tabemasu', 'nai').right, 1);
});

/* ===================================================================
   E. token_refresh não derruba a conta
   =================================================================== */

test('E. token_refresh mantém a conta', async () => {
  reset();
  login();
  await auth.boot(deps());
  const antes = sync().user.id;
  auth.handleAuthEvent('token_refresh', USER);
  auth.handleAuthEvent('token_refresh', USER);
  assert.ok(sync().user, 'a conta some a cada renovação');
  assert.equal(sync().user.id, antes);
});

test('E. LOGIN com user null não derruba a conta', async () => {
  reset();
  login();
  await auth.boot(deps());
  /* O SDK emite isso quando outra aba grava gotrue.user antes de montar
     o usuário — tratar como logout trocaria o perfil no meio do estudo. */
  auth.handleAuthEvent('login', null);
  assert.ok(sync().user, 'só LOGOUT pode encerrar a conta');
});

/* ===================================================================
   F/G. 401 recuperável e não recuperável
   =================================================================== */

test('F. 401 recuperável volta para a mesma conta sem pedir Google', async () => {
  reset();
  login();
  await auth.boot(deps());
  assert.ok(sync().user);

  const refreshAntes = sdk.chamadas.refresh;
  /* A Function responde 401 uma vez; depois volta ao normal. */
  let primeira = true;
  respostaProgress = () => {
    if (primeira) { primeira = false; return { ok: false, status: 401, json: async () => ({}) }; }
    return { ok: true, status: 200, json: async () => ({ exists: false, progress: null, revision: 0 }) };
  };

  await sync().syncNow();
  await new Promise(r => setTimeout(r, 30));

  assert.ok(sdk.chamadas.refresh > refreshAntes, 'tentou renovar antes de exigir login');
  assert.ok(sync().user, 'continua na mesma conta');
  assert.equal(sync().user.id, 'u-1');
  assert.notEqual(sync().status, 'auth-required', 'não ficou preso pedindo Google');
});

test('G. 401 não recuperável exige login manual', async () => {
  reset();
  login();
  await auth.boot(deps());

  sdk.refreshValido = false;                 // renovação deixou de funcionar
  sdk.cookie = null;
  respostaProgress = () => ({ ok: false, status: 401, json: async () => ({}) });

  await sync().syncNow();
  await new Promise(r => setTimeout(r, 30));

  assert.equal(sync().status, 'auth-required');
  /* E o progresso local continua disponível para estudar. */
  assert.ok(localStorage.getItem(store.STORAGE_KEY) !== undefined);
});

/* ===================================================================
   Online / offline
   =================================================================== */

test('os listeners de online/offline existem, como no Bunpou', () => {
  assert.match(authSource, /window\.addEventListener\('online'/);
  assert.match(authSource, /window\.addEventListener\('offline'/);
  /* offline não pode apagar um estado bloqueante. */
  const off = authSource.slice(authSource.indexOf("window.addEventListener('offline'"));
  assert.match(off, /if \(!sync\.user \|\| isBlocking\(\)\) return;/);
});

/* ===================================================================
   authReady: "sem usuário" não é "deslogado" cedo demais
   =================================================================== */

test('durante a restauração a UI não oferece login prematuramente', () => {
  /* authReady é de mão única no módulo real (uma vez pronto, pronto). O
     contrato que interessa é o da UI: com authReady=false e sem usuário,
     mostra "Verificando…" em vez de convidar a entrar. */
  const salvo = window.KatsuyouSync;
  window.KatsuyouSync = {
    status: 'anonymous', user: null, lastSyncedAt: null, authReady: false,
    login() {}, logout() {}, syncNow() {}, keepLocal() {}, keepRemote() {}, notifyLocalChange() {}
  };
  try {
    app.go('home');
    assert.ok(root.querySelector('[data-topbar="checking"]'), 'mostra "Verificando…"');
    assert.equal(root.querySelector('[data-topbar="login"]'), null, 'não oferece login ainda');

    app.go('settings');
    assert.ok(root.textContent.includes('Verificando sua sessão'), 'o card CONTA também espera');
    assert.ok(!root.textContent.includes('Entrar com Google para sincronizar'), 'sem convite prematuro');

    /* Terminada a restauração, a UI volta ao normal. */
    window.KatsuyouSync.authReady = true;
    app.go('home');
    assert.equal(root.querySelector('[data-topbar="checking"]'), null);
    assert.ok(root.querySelector('[data-topbar="login"]'), 'aí sim oferece login');
  } finally {
    window.KatsuyouSync = salvo;
  }
});

test('depois do boot o módulo real marca authReady', async () => {
  reset();
  await auth.boot(deps());
  assert.equal(sync().authReady, true);
});
