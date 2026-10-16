/* ===================================================================
   Login com Google — camada real de autenticação.

   O teste que existia só provava que o botão chamava KatsuyouSync.login().
   Isso não pegou o bug, porque o defeito estava no ARGUMENTO passado a
   oauthLogin(): `{ provider: 'google' }` em vez de `'google'`.

   Aqui exercitamos a biblioteca instalada de verdade (@netlify/identity
   1.2.0), sem jsdom: `isBrowser()` só exige `window.location`, e
   `discoverApiUrl()` só usa `window.location.origin`. Um window mínimo
   com um setter em `location.href` captura exatamente a URL para onde o
   navegador seria mandado.
   =================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ORIGIN = 'https://katsuyou-lab.netlify.app';

let captured = null;
globalThis.window = {
  location: {
    origin: ORIGIN,
    get href() { return `${ORIGIN}/`; },
    set href(v) { captured = v; }
  }
};

const { oauthLogin } = await import('@netlify/identity');
const { OAUTH_PROVIDER } = await import('../src/auth-sync.js');

/* Dispara o redirect e devolve a URL que a biblioteca montou. O throw
   final ("Redirecting to OAuth provider") é o comportamento normal. */
function urlFor(provider) {
  captured = null;
  let thrown = null;
  try { oauthLogin(provider); } catch (err) { thrown = err; }
  return { url: captured, thrown };
}

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const authSource = readFileSync(resolve(SRC, 'auth-sync.js'), 'utf8');

/* ===================================================================
   O provider
   =================================================================== */

test('o provider é a string "google", não um objeto', () => {
  assert.equal(typeof OAUTH_PROVIDER, 'string', 'precisa ser string');
  assert.equal(OAUTH_PROVIDER, 'google');
  /* A prova direta contra a regressão: um objeto vira "[object Object]". */
  assert.notEqual(String(OAUTH_PROVIDER), '[object Object]');
});

/* ===================================================================
   A URL que a biblioteca realmente monta
   =================================================================== */

test('oauthLogin com o nosso provider gera a URL correta do Identity', () => {
  const { url } = urlFor(OAUTH_PROVIDER);
  assert.ok(url, 'a biblioteca precisa iniciar o redirecionamento');
  assert.equal(url, `${ORIGIN}/.netlify/identity/authorize?provider=google`);
  assert.ok(url.includes('provider=google'));
  assert.ok(!url.includes('[object Object]'), 'nunca pode conter [object Object]');
  assert.ok(!/provider=%5Bobject/i.test(url));
});

test('a forma antiga produzia [object Object] — é o bug reproduzido', () => {
  /* Documenta a causa: se alguém voltar a passar um objeto, a URL
     quebra exatamente como o Netlify reportou (400, Unsupported
     provider: Provider [object object] could not be found). */
  const { url } = urlFor({ provider: 'google' });
  assert.ok(url.includes('[object Object]'), 'era assim que o bug aparecia');
  assert.ok(!url.includes('provider=google'));
});

test('a URL aponta para o endpoint Identity do próprio site', () => {
  const { url } = urlFor(OAUTH_PROVIDER);
  const parsed = new URL(url);
  assert.equal(parsed.origin, ORIGIN, 'o retorno é no próprio domínio do site');
  assert.equal(parsed.pathname, '/.netlify/identity/authorize');
  assert.equal(parsed.searchParams.get('provider'), 'google');
});

test('oauthLogin lança "Redirecting" mesmo quando dá certo', () => {
  /* É o contrato da versão 1.2.0 (retorno declarado `never`). Nosso
     catch precisa saber disso — ver o teste seguinte. */
  const { thrown, url } = urlFor(OAUTH_PROVIDER);
  assert.ok(url, 'o redirecionamento foi iniciado');
  assert.ok(thrown, 'e ainda assim a função lançou');
  assert.match(String(thrown.message), /redirect/i);
});

/* ===================================================================
   Proteção de regressão no código-fonte
   ===================================================================
   Estes testes falham com a implementação antiga
   `oauthLogin({ provider: 'google' })`. */

test('nenhum lugar do src passa um objeto para oauthLogin', () => {
  assert.doesNotMatch(
    authSource, /oauthLogin\s*\(\s*\{/,
    'oauthLogin recebe o provider direto, nunca dentro de um objeto'
  );
});

test('a chamada de oauthLogin usa a constante do provider', () => {
  const chamadas = [...authSource.matchAll(/oauthLogin\s*\(([^)]*)\)/g)]
    .map(m => m[1].trim())
    /* Ignora a menção na documentação da assinatura, no comentário. */
    .filter(arg => arg !== 'provider');
  assert.equal(chamadas.length, 1, `esperava uma chamada, achei ${chamadas.length}`);
  assert.ok(
    chamadas[0] === 'OAUTH_PROVIDER' || chamadas[0] === "'google'",
    `argumento inesperado: ${chamadas[0]}`
  );
});

test('o catch do login não trata o redirect como falha', () => {
  /* A implementação antiga era `catch { setStatus('error'); }`, sem
     distinguir nada — e acendia "erro" num login que funcionou. */
  const login = authSource.slice(authSource.indexOf('  login()'));
  const corpo = login.slice(0, login.indexOf('\n  },'));
  assert.match(corpo, /isRedirectSignal/, 'o catch precisa reconhecer o redirect');
  assert.doesNotMatch(
    corpo, /catch\s*(\(\s*\w*\s*\))?\s*\{\s*setStatus\('error'\)/,
    'não pode marcar erro para qualquer exceção'
  );
});

/* ===================================================================
   O fluxo de callback continua o mesmo
   =================================================================== */

test('o retorno do OAuth continua sendo tratado na própria página', () => {
  /* Sem página de callback separada: handleAuthCallback roda no boot. */
  assert.match(authSource, /handleAuthCallback/);
  assert.match(authSource, /getUser/);
  assert.match(authSource, /onAuthChange/);
  assert.doesNotMatch(authSource, /callback\.html/);
});
