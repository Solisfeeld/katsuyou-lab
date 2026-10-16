/* ===================================================================
   Organização da página de Ajustes, no formato do Bunpou Lab:

     TREINO      [ card ]
     APARÊNCIA   [ card ]
     CONTA       [ card ]
     DADOS       [ card ]

   Um rótulo pequeno em versalete acima de UM card grande — sem as
   caixinhas fragmentadas de antes (Conta e sincronização / Backup do
   progresso / Apagar progresso separados).
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
const backup = await import('../src/progress/backup.js');

const root = document.getElementById('app');
const app = new App(root);
const text = () => root.textContent;

const btnByText = label => [...root.querySelectorAll('button')]
  .find(b => b.textContent.trim() === label);

/* O card que vem logo depois do rótulo de uma seção. */
function cardOf(secao) {
  const label = [...root.querySelectorAll('.h-sec')].find(e => e.textContent === secao);
  assert.ok(label, `seção "${secao}" não encontrada`);
  const card = label.nextElementSibling;
  assert.ok(card && card.classList.contains('card'), `"${secao}" não é seguida de um card`);
  return card;
}
const inCard = (secao, label) => [...cardOf(secao).querySelectorAll('button')]
  .find(b => b.textContent.trim() === label);

function reset() {
  localStorage.clear();
  store.resetAll();
  app.backupNotice = null;
  app.pendingImport = null;
  delete window.KatsuyouSync;
  globalThis.confirm = () => true;
}

function stubSync(over = {}) {
  const calls = { login: 0, logout: 0, syncNow: 0, keepLocal: 0, keepRemote: 0 };
  window.KatsuyouSync = {
    status: 'anonymous', user: null, lastSyncedAt: null,
    login() { calls.login++; }, logout() { calls.logout++; },
    syncNow() { calls.syncNow++; },
    keepLocal() { calls.keepLocal++; }, keepRemote() { calls.keepRemote++; },
    notifyLocalChange() {},
    ...over
  };
  window.KatsuyouSync.calls = calls;
  return window.KatsuyouSync;
}

const USER = { id: 'u-1', email: 'usuario@gmail.com' };

/* ===================================================================
   §12.1, §12.2 — estrutura em seções
   =================================================================== */

test('Ajustes tem as quatro seções, cada uma com um card', () => {
  reset();
  stubSync();
  app.go('settings');

  const secoes = [...root.querySelectorAll('.h-sec')].map(e => e.textContent);
  assert.deepEqual(secoes, ['Treino', 'Aparência', 'Conta', 'Dados']);
  for (const s of secoes) assert.ok(cardOf(s), `${s} sem card`);
});

test('as seções fragmentadas antigas não existem mais', () => {
  reset();
  stubSync();
  app.go('settings');
  const t = text();
  for (const antigo of ['Conta e sincronização', 'Backup do progresso', 'Apagar progresso']) {
    assert.ok(!t.includes(antigo), `a seção antiga "${antigo}" voltou`);
  }
});

test('cada seção é UM card, não vários', () => {
  reset();
  stubSync({ status: 'synced', user: USER });
  app.go('settings');
  /* Quatro rótulos, quatro cards de primeiro nível. */
  assert.equal(root.querySelectorAll('.h-sec').length, 4);
  assert.equal([...root.querySelector('.wrap').children].filter(e => e.classList.contains('card')).length, 4);
});

/* ===================================================================
   §12.3, §12.4 — CONTA
   =================================================================== */

test('§12.3 deslogado: o card CONTA traz o convite e o botão Entrar', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  app.go('settings');

  const card = cardOf('Conta');
  assert.ok(card.textContent.includes('Entrar com Google para sincronizar seus dados'));
  assert.ok(card.textContent.includes('Continue seus estudos em outros dispositivos'));
  assert.ok(card.textContent.includes('o Katsuyou Lab funciona por inteiro sem conta'));
  assert.ok(!card.textContent.includes('Bunpou'), 'o texto é do Katsuyou, não do Bunpou');

  const entrar = inCard('Conta', 'Entrar');
  assert.ok(entrar, 'o botão Entrar está no card de CONTA');
  assert.ok(entrar.classList.contains('btn-primary'));
  /* Layout do Bunpou: título+explicação à esquerda, ação à direita. */
  const row = card.querySelector('.optrow');
  assert.ok(row && row.querySelector('.lbl b'), 'usa .optrow com .lbl');
  assert.equal(row.lastElementChild, entrar, 'a ação fica à direita da linha');
});

test('o botão Entrar usa o login que já existe', () => {
  reset();
  const sync = stubSync({ status: 'anonymous', user: null });
  app.go('settings');
  inCard('Conta', 'Entrar').click();
  assert.equal(sync.calls.login, 1);
});

test('§12.4 logado: o card CONTA mostra conta, estado e último envio', () => {
  reset();
  stubSync({ status: 'synced', user: USER, lastSyncedAt: Date.now() - 4000 });
  app.go('settings');

  const card = cardOf('Conta');
  assert.ok(card.textContent.includes('Google · usuario@gmail.com'));
  assert.ok(card.textContent.includes('Progresso sincronizado'));
  assert.ok(card.querySelector('.sdot.ok'), 'indicador de estado');
  assert.ok(card.textContent.includes('Último envio'));
  assert.ok(card.textContent.includes('agora há pouco'));
  assert.ok(card.textContent.includes('Entre dispositivos'));
  assert.ok(inCard('Conta', 'Sair desta conta'), 'logout dentro do card');
});

test('§12.5 "Sincronizar agora" não voltou para Ajustes', () => {
  reset();
  stubSync({ status: 'synced', user: USER });
  app.go('settings');
  assert.equal(btnByText('Sincronizar agora'), undefined,
    'a ação manual fica somente no popover da topbar');
  assert.equal(inCard('Conta', 'Sincronizar agora'), undefined);
});

test('o conflito continua resolvível dentro do card CONTA', () => {
  reset();
  const sync = stubSync({ status: 'conflict', user: USER });
  app.go('settings');
  const card = cardOf('Conta');
  assert.ok(card.textContent.includes('Há progresso diferente neste dispositivo e na sua conta.'));
  assert.ok(inCard('Conta', 'Usar progresso deste dispositivo'));
  assert.ok(inCard('Conta', 'Usar progresso da nuvem'));
  inCard('Conta', 'Usar progresso da nuvem').click();
  assert.equal(sync.calls.keepRemote, 1);
});

/* ===================================================================
   §12.6, §12.7 — DADOS
   =================================================================== */

test('§12.6/§12.7 os três botões de DADOS estão no MESMO card', () => {
  reset();
  stubSync();
  app.go('settings');

  const card = cardOf('Dados');
  const exportar = inCard('Dados', 'Exportar progresso');
  const importar = inCard('Dados', 'Importar progresso');
  const resetar = inCard('Dados', 'Resetar progresso');
  assert.ok(exportar && importar && resetar, 'os três botões existem em DADOS');

  /* E na mesma linha, como no Bunpou. */
  const row = card.querySelector('.row');
  assert.ok(row, 'os botões ficam numa .row');
  assert.equal(row.contains(exportar) && row.contains(importar) && row.contains(resetar), true);
  assert.equal(resetar.classList.contains('btn-shu'), true, 'reset tem destaque destrutivo');
});

test('DADOS mostra as métricas reais do progresso', () => {
  reset();
  stubSync();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  store.recordAnswer({ verbId: 'tabemasu', form: 'nai', correct: true, hinted: false, dontKnow: false, answer: 'たべない' });
  store.recordSession({ answered: 2, correct: 2, perForm: {}, wrongItems: [] });
  app.go('settings');

  const card = cardOf('Dados');
  assert.ok(card.textContent.includes('Sessões registradas: 1'), card.textContent.slice(0, 120));
  assert.ok(card.textContent.includes('Itens com histórico: 2'));
  assert.ok(card.textContent.includes(`de ${store.TRAINABLE_COMBOS}`), 'o universo de conjugação continua explícito');
});

test('§12.9 o texto auxiliar deixa claro que o backup não leva login', () => {
  reset();
  stubSync();
  app.go('settings');
  assert.ok(cardOf('Dados').textContent.includes(
    'O arquivo de backup contém apenas o seu progresso de estudo — nenhum dado de login.'
  ));
});

test('exportar continua funcionando a partir do card DADOS', () => {
  reset();
  stubSync();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  app.go('settings');
  inCard('Dados', 'Exportar progresso').click();
  assert.ok(text().includes('Backup exportado.'));
  /* E o arquivo continua sem credenciais. */
  const json = backup.backupJson();
  for (const proibido of ['access_token', 'gotrue', 'jwt', 'cookie']) {
    assert.ok(!json.includes(proibido), `o backup vazou "${proibido}"`);
  }
});

test('§12.8 resetar exige confirmação e só apaga quando confirmado', () => {
  reset();
  stubSync();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  app.go('settings');

  /* Recusando a confirmação, nada acontece. */
  let perguntou = 0;
  globalThis.confirm = () => { perguntou++; return false; };
  inCard('Dados', 'Resetar progresso').click();
  assert.equal(perguntou, 1, 'precisa perguntar antes de apagar');
  assert.equal(store.getPair('nomimasu', 'te').right, 1, 'nada foi apagado');
  assert.equal(app.view, 'settings');

  /* Confirmando, apaga e volta para a home. */
  globalThis.confirm = () => { perguntou++; return true; };
  app.go('settings');
  inCard('Dados', 'Resetar progresso').click();
  assert.equal(perguntou, 2);
  assert.equal(store.getPair('nomimasu', 'te').right, 0, 'o progresso foi apagado');
  assert.equal(app.view, 'home');
});

test('a importação continua pedindo confirmação, dentro do card DADOS', async () => {
  reset();
  stubSync();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  const json = backup.backupJson();
  store.resetAll();
  app.go('settings');

  await app.stageImport(new dom.window.File([json], 'b.json', { type: 'application/json' }));
  const card = cardOf('Dados');
  assert.ok(card.textContent.includes('Este backup substituirá o progresso atual deste dispositivo.'));
  assert.ok(inCard('Dados', 'Importar e substituir'));
  assert.ok(inCard('Dados', 'Cancelar'));
  inCard('Dados', 'Importar e substituir').click();
  assert.equal(store.getPair('nomimasu', 'te').right, 1);
});

/* ===================================================================
   §12.10, §12.11 — mobile e navegação
   =================================================================== */

test('§12.10 no mobile os controles continuam todos presentes', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  app.go('settings');

  /* Nada é removido do DOM: a .row quebra sozinha em telas estreitas,
     exatamente como no Bunpou (que também não tem override de .optrow). */
  assert.ok(inCard('Dados', 'Exportar progresso'));
  assert.ok(inCard('Dados', 'Importar progresso'));
  assert.ok(inCard('Dados', 'Resetar progresso'));
  assert.ok(inCard('Conta', 'Entrar'));
  assert.ok(root.querySelector('[data-setting="hide-group"]'));
  assert.ok(root.querySelector('[data-topbar="settings"]'));
  assert.ok(root.querySelector('[data-topbar="theme"]'));

  /* É o CSS que resolve a tela estreita: a .row quebra e a .optrow
     continua em linha — as mesmas regras do Bunpou Lab. */
  const css = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles.css'), 'utf8'
  );
  assert.match(css, /\.row\{[^}]*flex-wrap:wrap/);
  assert.match(css, /\.optrow\{display:flex;align-items:center/);
  assert.match(css, /\.h-sec\{/);
});

test('§12.11 ← Voltar continua funcionando nos Ajustes', () => {
  reset();
  stubSync();
  app.go('progress');
  app.go('settings');
  const voltar = root.querySelector('[data-nav="back"]');
  assert.ok(voltar, 'o Voltar continua na tela');
  assert.equal(voltar.textContent.trim(), '← Voltar');
  voltar.click();
  assert.equal(app.view, 'progress', 'volta para o contexto anterior');
});

test('o Treino continua com o ajuste de esconder o grupo', () => {
  reset();
  stubSync();
  app.go('settings');
  const card = cardOf('Treino');
  assert.ok(card.textContent.includes('Esconder o grupo durante o exercício'));
  const toggle = card.querySelector('[data-setting="hide-group"]');
  assert.ok(toggle, 'o controle vive no card de Treino');
  assert.equal(toggle.textContent.trim(), 'Visível');
  toggle.click();
  assert.equal(store.getState().settings.hideGroup, true);
});

test('a Aparência continua com os três temas', () => {
  reset();
  stubSync();
  app.applyTheme('auto');
  app.go('settings');
  const card = cardOf('Aparência');
  const chips = [...card.querySelectorAll('.chip')];
  assert.equal(chips.length, 3);
  assert.ok(card.textContent.includes('Automático'));
  chips.find(c => c.textContent.includes('Escuro')).click();
  assert.equal(app.theme, 'dark');
});
