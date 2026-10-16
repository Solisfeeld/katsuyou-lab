/* ===================================================================
   活用ラボ — autenticação (Netlify Identity) e sincronização.

   Mesmo desenho arquitetural do Bunpou Lab, com DADOS PRÓPRIOS (§39):
   endpoint próprio, tabela própria (katsuyou_progress), chaves de
   localStorage próprias. Os dois aplicativos nunca se cruzam.

   O motor pedagógico não conhece este módulo: store.js apenas chama
   window.KatsuyouSync.notifyLocalChange() depois de gravar localmente.
   Se este arquivo falhar ou a rede cair, o treino continua inteiro.
   =================================================================== */

import {
  getUser, oauthLogin, handleAuthCallback, logout as identityLogout, onAuthChange, AUTH_EVENTS
} from '@netlify/identity';
/* Namespace ao lado dos imports nomeados: refreshSession é API pública, mas um
   import nomeado que sumisse numa versão futura quebraria o BUILD inteiro.
   Aqui a ausência apenas desliga a restauração automática. */
import * as Identity from '@netlify/identity';

import { getState, replaceState, STORAGE_KEY } from './progress/store.js';

const ENDPOINT = '/.netlify/functions/progress';
/* Chave técnica exclusiva — o Bunpou Lab usa 'bunpou-lab-sync-v1:'. */
const META_KEY = 'katsuyou_lab_sync_v1:';
/* Chave em que o próprio GoTrue guarda a sessão do navegador (inclui o
   refresh token). Nunca escrevemos conteúdo novo aqui: só devolvemos, sem
   alterar um byte, o que o SDK apagou por engano. */
const GOTRUE_KEY = 'gotrue.user';
const DEBOUNCE = 2000;
const MAX_BYTES = 1024 * 1024;

const sync = {
  user: null,
  status: 'anonymous',   // anonymous|loading|synced|dirty|offline|conflict|error|auth-required
  /* Enquanto false, "sem usuário" ainda não significa "deslogado": é só a
     restauração da sessão em andamento. A UI não pode concluir nada antes. */
  authReady: false,
  revision: 0,
  lastSyncedAt: null,
  inFlight: false
};
let debounceTimer = null;
let pendingPush = false;
let recovering = false;        // uma tentativa de renovação por vez

const isValidUser = u => !!u && typeof u === 'object' && typeof u.id === 'string' && u.id.length > 0;
const isBlocking = () => sync.status === 'auth-required' || sync.status === 'conflict';

/* ---------------- restauração da sessão ----------------
   O SDK grava a sessão do navegador em localStorage['gotrue.user'] (que
   contém o refresh token) e escreve nf_jwt/nf_refresh SEM expires — ou seja,
   como cookies de sessão, que o navegador descarta ao fechar. No retorno,
   getUser() encontra a sessão no localStorage, não encontra o cookie e chama
   currentUser.clearSession(): destrói o refresh token e devolve null. Daí o
   logout "entre dias".

   refreshSession() é o caminho suportado de volta: lê a sessão do
   localStorage (não depende do cookie), troca o refresh token por um access
   token novo e REESCREVE nf_jwt. Por isso ela roda ANTES de getUser(). */
const refreshFn = () =>
  (Identity && typeof Identity.refreshSession === 'function') ? Identity.refreshSession : null;

async function refreshIdentitySession() {
  const fn = refreshFn();
  if (!fn) return null;
  try { return await fn(); }
  catch (e) { console.warn('[katsuyou] renovação de sessão falhou:', e && e.message); return null; }
}

/* Acesso à sessão. Os padrões são a API real; boot() pode injetar
   substitutos para que o cenário "dia seguinte" seja exercitável sem
   emular o GoTrue inteiro. Em produção `sessionDeps` fica vazio. */
let sessionDeps = {};
const depRefresh = () => (sessionDeps.refresh || refreshIdentitySession)();
const depGetUser = () => (sessionDeps.getUser || getUser)();

const readGotrue = () => { try { return localStorage.getItem(GOTRUE_KEY); } catch { return null; } };
const writeGotrue = v => { try { if (v != null) localStorage.setItem(GOTRUE_KEY, v); } catch {} };

/* Devolve o usuário autenticado sem jamais deixar uma sessão recuperável ser
   descartada. Se getUser() apagar a chave do GoTrue, os MESMOS bytes voltam
   ao MESMO lugar — nenhum token é criado, copiado para outro storage ou
   prolongado — e a renovação é tentada uma vez. Fora esse caso o fluxo é o
   normal do SDK. */
export async function restoreSession(deps) {
  if (deps) sessionDeps = deps;

  const before = readGotrue();
  await depRefresh();
  let user = null;
  try { user = await depGetUser(); } catch (e) { console.warn('Identity indisponível:', e && e.message); }
  if (user || !before) return user;

  if (readGotrue() !== before) {
    writeGotrue(before);
    if (await depRefresh()) {
      try { user = await depGetUser(); } catch {}
    }
    /* Sem sucesso agora (offline, ou token ainda longe de expirar e sem
       cookie), o refresh token continua no lugar para a próxima visita —
       melhor um login a mais hoje do que uma sessão destruída para sempre. */
    if (!user) writeGotrue(before);
  }
  return user;
}

/* -------------------------------------------------------------------
   Provider do OAuth.

   Em @netlify/identity 1.2.0 a assinatura é `oauthLogin(provider)` — o
   provider vai DIRETO, como string. A biblioteca monta a URL fazendo
   `${apiURL}/authorize?provider=${provider}`, então passar um objeto
   ({ provider: 'google' }) o interpola como "[object Object]" e o
   Netlify responde 400 "Unsupported provider".
   ------------------------------------------------------------------- */
export const OAUTH_PROVIDER = 'google';

/* oauthLogin é declarado `never`: quando dá certo, ele atribui
   window.location.href e EM SEGUIDA lança "Redirecting to OAuth
   provider". Esse throw é o caminho feliz, não uma falha — tratá-lo
   como erro mostraria "Não foi possível sincronizar" em cima de um
   login que está funcionando. Só um erro anterior ao redirecionamento
   (fora do navegador, Identity ausente) é falha de verdade. */
const isRedirectSignal = err => /redirect/i.test(String(err?.message || ''));

/* ---------------- metadados por conta ---------------- */
const metaKey = id => META_KEY + id;
function readMeta(id) {
  try {
    const m = JSON.parse(localStorage.getItem(metaKey(id)) || '{}');
    return {
      revision: Number.isFinite(m.revision) ? m.revision : 0,
      lastSyncedAt: Number.isFinite(m.lastSyncedAt) ? m.lastSyncedAt : 0,
      dirty: !!m.dirty
    };
  } catch { return { revision: 0, lastSyncedAt: 0, dirty: false }; }
}
function patchMeta(id, patch) {
  const m = { ...readMeta(id), ...patch };
  try { localStorage.setItem(metaKey(id), JSON.stringify(m)); } catch {}
  sync.revision = m.revision;
  sync.lastSyncedAt = m.lastSyncedAt || null;
  return m;
}

function renderApp() { try { window.KatsuyouApp?.render(); } catch {} }

function setStatus(next) {
  if (sync.status === next) return;
  sync.status = next;
  queueMicrotask(renderApp);
}

/* ---------------- rede ---------------- */
async function pull() {
  const res = await fetch(ENDPOINT, { method: 'GET', headers: { accept: 'application/json' } });
  if (res.status === 401) { enterAuthRequired(); return null; }
  if (!res.ok) throw new Error(`GET ${res.status}`);
  return res.json();
}

async function push(progress, baseRevision) {
  const body = JSON.stringify({ progress, baseRevision });
  if (body.length > MAX_BYTES) { setStatus('error'); return null; }
  const res = await fetch(ENDPOINT, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body
  });
  if (res.status === 401) { enterAuthRequired(); return null; }
  if (res.status === 409) return { conflict: true, ...(await res.json()) };
  if (!res.ok) throw new Error(`PUT ${res.status}`);
  return res.json();
}

/* 401 = a sessão do Identity expirou. Isso NÃO é logout: o contexto da conta
   é preservado e os envios param até haver nova autenticação — do contrário
   entraríamos no ciclo 401 -> dirty -> PUT -> 401. Estudar localmente
   continua funcionando.

   Antes de exigir um login manual, tenta o caminho suportado: renovar a
   sessão e refazer a reconciliação. Só pede Google de novo se isso falhar.
   `recovering` impede que o 401 da própria retentativa reabra o ciclo. */
async function enterAuthRequired() {
  const id = sync.user && sync.user.id;
  if (id) patchMeta(id, { dirty: true });   // o que estava pendente continua pendente
  clearTimeout(debounceTimer); debounceTimer = null;
  pendingPush = false;
  setStatus('auth-required');

  if (!id || recovering) return;
  recovering = true;
  try {
    if (!await depRefresh()) return;
    let user = null;
    try { user = await depGetUser(); } catch {}
    if (isValidUser(user) && user.id === id) { sync.user = user; await initialSync(user); }
  } finally { recovering = false; }
}

/* ---------------- fluxo ---------------- */
async function initialSync(user) {
  setStatus('loading');
  try {
    const remote = await pull();
    if (!remote) return;
    const meta = readMeta(user.id);
    const local = getState();

    if (!remote.exists) {
      /* Primeira vez nesta conta: sobe o que já existe localmente. */
      await pushNow(user, local, 0);
      return;
    }

    const remoteNewer = Number(remote.revision) > meta.revision;
    if (remoteNewer && !meta.dirty) {
      replaceState(remote.progress);
      patchMeta(user.id, { revision: Number(remote.revision), lastSyncedAt: Date.now(), dirty: false });
      setStatus('synced');
      return;
    }
    if (remoteNewer && meta.dirty) {
      /* Duas pontas mudaram: o usuário decide, nada é sobrescrito sozinho. */
      setStatus('conflict');
      sync.conflict = remote;
      return;
    }
    await pushNow(user, local, Number(remote.revision));
  } catch {
    setStatus('offline');
  }
}

async function pushNow(user, progress, baseRevision) {
  if (sync.inFlight) { pendingPush = true; return; }
  sync.inFlight = true;
  try {
    const out = await push(progress, baseRevision);
    if (!out) return;
    if (out.conflict) { sync.conflict = out; setStatus('conflict'); return; }
    patchMeta(user.id, { revision: Number(out.revision), lastSyncedAt: Date.now(), dirty: false });
    setStatus('synced');
  } catch {
    patchMeta(user.id, { dirty: true });
    setStatus('offline');
  } finally {
    sync.inFlight = false;
    if (pendingPush) { pendingPush = false; schedulePush(); }
  }
}

function schedulePush() {
  if (!isValidUser(sync.user) || isBlocking()) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const meta = readMeta(sync.user.id);
    pushNow(sync.user, getState(), meta.revision);
  }, DEBOUNCE);
}

/* ---------------- API pública ---------------- */
const api = {
  get status() { return sync.status; },
  get user() { return sync.user; },
  get lastSyncedAt() { return sync.lastSyncedAt; },
  /* false enquanto a sessão ainda está sendo restaurada: a UI não deve
     concluir "deslogado" antes disso. */
  get authReady() { return sync.authReady; },

  notifyLocalChange() {
    if (!isValidUser(sync.user)) return;
    if (isBlocking()) return;
    patchMeta(sync.user.id, { dirty: true });
    setStatus('dirty');
    schedulePush();
  },

  /* Envio imediato, sem esperar o debounce. Não é uma regra nova de
     sincronização: é o mesmo pushNow do fluxo normal, exposto para o
     botão "Sincronizar agora" da interface. */
  syncNow() {
    if (!isValidUser(sync.user) || isBlocking()) return;
    clearTimeout(debounceTimer);
    const meta = readMeta(sync.user.id);
    pushNow(sync.user, getState(), meta.revision);
  },

  login() {
    try {
      oauthLogin(OAUTH_PROVIDER);
    } catch (err) {
      if (!isRedirectSignal(err)) setStatus('error');
    }
  },

  async logout() {
    try { await identityLogout(); } catch {}
    sync.user = null;
    setStatus('anonymous');
  },

  /* Resolução explícita de conflito — nunca automática. */
  keepRemote() {
    if (!sync.conflict || !isValidUser(sync.user)) return;
    replaceState(sync.conflict.progress);
    patchMeta(sync.user.id, { revision: Number(sync.conflict.revision), lastSyncedAt: Date.now(), dirty: false });
    sync.conflict = null;
    setStatus('synced');
  },
  keepLocal() {
    if (!sync.conflict || !isValidUser(sync.user)) return;
    const base = Number(sync.conflict.revision);
    sync.conflict = null;
    setStatus('dirty');
    pushNow(sync.user, getState(), base);
  }
};

window.KatsuyouSync = api;

/* -------------------------------------------------------------------
   Eventos de autenticação.

   ★ A assinatura de onAuthChange é (event, user) — o PRIMEIRO argumento
   é uma string ('login', 'logout', 'token_refresh', 'user_updated',
   'recovery'), não o usuário. Ler o primeiro argumento como usuário faz
   todo evento parecer "sem usuário": o 'login' emitido por
   handleAuthCallback ao voltar do Google, e cada 'token_refresh'
   periódico, zeravam a conta logo depois de entrar.

   Exportada para poder ser exercitada nos testes sem simular o Identity.
   ------------------------------------------------------------------- */
export function handleAuthEvent(event, user) {
  if (isValidUser(user)) {
    if (recovering) { sync.user = user; return; }   // a recuperação em curso conclui sozinha
    /* Reautenticar a MESMA conta é justamente a saída de auth-required:
       tratar como no-op deixaria a sincronização suspensa para sempre. */
    if (!sync.user || sync.user.id !== user.id || sync.status === 'auth-required') {
      sync.user = user;
      initialSync(user);
    } else {
      sync.user = user;          // token_refresh/user_updated: só atualiza
    }
    return;
  }
  /* Só LOGOUT encerra a conta. O SDK também emite LOGIN com user null
     (outra aba gravou gotrue.user antes de o cliente montar o usuário);
     tratar isso como logout derrubaria a sessão no meio do estudo. */
  if (event === AUTH_EVENTS.LOGOUT) {
    if (sync.user) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
      pendingPush = false;
      sync.conflict = null;
      sync.user = null;
      sync.revision = 0;
      sync.lastSyncedAt = null;
      setStatus('anonymous');
    }
    return;
  }
  console.warn('[katsuyou] evento de autenticação sem usuário, ignorado:', event);
}

/* ---------------- inicialização ---------------- */
async function boot(deps) {
  renderApp();                              // pinta "Verificando…" enquanto authReady é false
  try { await handleAuthCallback(); }
  catch (e) { console.warn('Callback de login:', e && e.message); }

  /* restoreSession() no lugar de getUser() direto: é o que impede o SDK de
     destruir uma sessão que ainda poderia ser renovada. */
  const user = await restoreSession(deps);

  /* A restauração terminou: só a partir daqui "sem usuário" quer dizer
     deslogado, e a UI pode dizer isso. */
  sync.authReady = true;

  if (isValidUser(user)) { sync.user = user; await initialSync(user); }
  else sync.status = 'anonymous';

  try { onAuthChange(handleAuthEvent); }
  catch (e) { console.warn('onAuthChange indisponível:', e && e.message); }

  window.addEventListener('online', () => {
    const id = sync.user && sync.user.id;
    if (!id || !readMeta(id).dirty) return;
    if (isBlocking()) return;
    schedulePush();
  });
  /* Perder a conexão não pode apagar um estado bloqueante: se 'offline'
     substituísse 'auth-required' ou 'conflict', a proteção contra novos PUTs
     sumiria assim que a rede voltasse. */
  window.addEventListener('offline', () => {
    if (!sync.user || isBlocking()) return;
    setStatus('offline');
  });

  /* A topbar já foi montada antes deste módulo terminar de carregar, e
     setStatus só redesenha quando o estado MUDA. Sem este render, o
     controle de conta só apareceria na próxima navegação. */
  renderApp();
}

/* O app pode ainda não existir quando este módulo é avaliado. */
if (typeof window !== 'undefined') {
  if (window.KatsuyouApp) boot();
  else window.addEventListener?.('katsuyou-app-ready', boot, { once: true });
}

export { api as KatsuyouSync, STORAGE_KEY, boot };
