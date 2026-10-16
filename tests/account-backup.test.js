/* ===================================================================
   Conta e sincronização (interface para o Netlify Identity já existente)
   e backup manual do progresso — exportar e importar.

   O módulo real de sincronização fala com a rede e com o Netlify; aqui
   ele é substituído por um duplo que expõe exatamente a mesma API
   pública (status, user, lastSyncedAt, login, logout, keepLocal,
   keepRemote, notifyLocalChange), que é o contrato que a UI consome.
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
globalThis.Blob = dom.window.Blob;
globalThis.FileReader = dom.window.FileReader;

/* jsdom não implementa object URLs; o download é exercitado só até aqui. */
let revoked = [];
dom.window.URL.createObjectURL = () => 'blob:katsuyou-test';
dom.window.URL.revokeObjectURL = u => revoked.push(u);
globalThis.URL = dom.window.URL;

const { App } = await import('../src/ui/app.js');
const store = await import('../src/progress/store.js');
const backup = await import('../src/progress/backup.js');
const { VERBS } = await import('../src/data/verbs.js');
const { FORMS } = await import('../src/conjugation/rules.js');

const root = document.getElementById('app');
const app = new App(root);
const text = () => root.textContent;

function reset() {
  localStorage.clear();
  store.resetAll();
  app.backupNotice = null;
  app.pendingImport = null;
  delete window.KatsuyouSync;
}

const btn = label => [...root.querySelectorAll('button')]
  .find(b => b.textContent.trim() === label);
const click = label => {
  const b = btn(label);
  assert.ok(b, `botão "${label}" não encontrado`);
  b.click();
  return b;
};

/* Duplo do KatsuyouSync com a mesma superfície pública do módulo real. */
function stubSync(over = {}) {
  const calls = { login: 0, logout: 0, keepLocal: 0, keepRemote: 0 };
  window.KatsuyouSync = {
    status: 'anonymous',
    user: null,
    lastSyncedAt: null,
    login() { calls.login++; },
    logout() { calls.logout++; this.user = null; this.status = 'anonymous'; },
    keepLocal() { calls.keepLocal++; },
    keepRemote() { calls.keepRemote++; },
    notifyLocalChange() { calls.notify = (calls.notify || 0) + 1; },
    ...over
  };
  window.KatsuyouSync.calls = calls;
  return window.KatsuyouSync;
}

const GOOGLE_USER = { id: 'u-1', email: 'usuario@gmail.com' };

/* ===================================================================
   1. Login com Google
   =================================================================== */

test('usuário anônimo vê o convite e o botão Entrar com Google', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  app.go('settings');

  assert.ok(text().includes('CONTA') || text().includes('Conta'));
  assert.ok(text().includes('Entrar com Google para sincronizar seus dados'));
  assert.ok(text().includes('o Katsuyou Lab funciona por inteiro sem conta'));
  assert.ok(btn('Entrar'), 'botão de entrada presente');
  assert.equal(btn('Sair desta conta'), undefined, 'não há logout sem conta');
});

test('clicar em Entrar com Google chama KatsuyouSync.login()', () => {
  reset();
  const sync = stubSync({ status: 'anonymous', user: null });
  app.go('settings');
  click('Entrar');
  assert.equal(sync.calls.login, 1);
});

test('sem o módulo de sincronização carregado, a seção não quebra', () => {
  reset();                       // sem stubSync: window.KatsuyouSync ausente
  app.go('settings');
  assert.ok(text().includes('Conta'));
  assert.ok(text().includes('publicado no Netlify'));
  assert.equal(btn('Entrar'), undefined);
  /* E o backup continua disponível mesmo assim (§12). */
  assert.ok(btn('Exportar progresso'));
  assert.ok(btn('Importar progresso'));
});

/* ===================================================================
   2. Usuário autenticado
   =================================================================== */

test('usuário autenticado vê a conta, o estado e o botão Sair', () => {
  reset();
  stubSync({ status: 'synced', user: GOOGLE_USER, lastSyncedAt: Date.now() - 5000 });
  app.go('settings');

  assert.ok(text().includes('Google · usuario@gmail.com'));
  assert.ok(text().includes('Progresso sincronizado'));
  assert.ok(text().includes('Último envio'));
  assert.ok(text().includes('agora há pouco'));
  assert.ok(btn('Sair desta conta'));
  assert.equal(btn('Entrar'), undefined);
});

test('conta sem e-mail não inventa identificação', () => {
  reset();
  stubSync({ status: 'synced', user: { id: 'u-2' } });
  app.go('settings');
  assert.ok(text().includes('Conta conectada'));
  assert.ok(!text().includes('undefined'));
});

test('sair chama logout e NÃO apaga o progresso local', async () => {
  reset();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  const antes = store.getPair('nomimasu', 'te').right;
  assert.equal(antes, 1);

  const sync = stubSync({ status: 'synced', user: GOOGLE_USER });
  app.go('settings');
  /* A tela logada avisa que sair não custa progresso. */
  assert.ok(text().includes('Sair não apaga o progresso salvo neste dispositivo.'));

  click('Sair desta conta');
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(sync.calls.logout, 1);
  assert.equal(store.getPair('nomimasu', 'te').right, 1, 'o progresso continua');
  assert.ok(localStorage.getItem(store.STORAGE_KEY), 'o progresso continua no localStorage');
  /* E a tela volta ao estado anônimo, sem perder nada. */
  assert.ok(btn('Entrar'), 'voltou para o estado anônimo');
  app.go('progress');
  assert.ok(text().includes('Por forma'), 'o progresso continua visível depois do logout');
});

/* ===================================================================
   3. Estados da sincronização
   =================================================================== */

/* O card de CONTA usa a frase compacta de cada estado, a mesma do chip
   da topbar — como no Bunpou Lab. */
const ESTADOS = [
  ['loading', 'Sincronizando…'],
  ['synced', 'Progresso sincronizado'],
  ['dirty', 'Alterações aguardando sincronização'],
  ['offline', 'Sem conexão · salvo neste dispositivo'],
  ['error', 'Não foi possível sincronizar agora'],
  ['auth-required', 'Sessão expirada · entre novamente']
];

for (const [status, esperado] of ESTADOS) {
  test(`estado "${status}" é exibido de forma compreensível`, () => {
    reset();
    stubSync({ status, user: GOOGLE_USER });
    app.go('settings');
    assert.ok(text().includes(esperado), `estado ${status} não apareceu`);
  });
}

test('falha de rede não bloqueia o estudo', () => {
  reset();
  stubSync({ status: 'offline', user: GOOGLE_USER });
  app.go('home');
  /* A home continua oferecendo treino normalmente. */
  assert.ok(text().includes('Sessão mista'));
  assert.ok(text().includes('Treinar uma forma'));
});

/* ===================================================================
   4. Conflito local × nuvem
   =================================================================== */

test('conflito mostra a explicação e as duas escolhas', () => {
  reset();
  stubSync({ status: 'conflict', user: GOOGLE_USER });
  app.go('settings');
  const t = text();
  assert.ok(t.includes('Há progresso diferente neste dispositivo e na sua conta.'));
  assert.ok(btn('Usar progresso deste dispositivo'));
  assert.ok(btn('Usar progresso da nuvem'));
  assert.ok(t.includes('será enviado para a sua conta'));
  assert.ok(t.includes('substituirá o deste dispositivo'));
});

test('"Usar progresso deste dispositivo" chama keepLocal()', () => {
  reset();
  const sync = stubSync({ status: 'conflict', user: GOOGLE_USER });
  app.go('settings');
  click('Usar progresso deste dispositivo');
  assert.equal(sync.calls.keepLocal, 1);
  assert.equal(sync.calls.keepRemote, 0);
});

test('"Usar progresso da nuvem" chama keepRemote()', () => {
  reset();
  const sync = stubSync({ status: 'conflict', user: GOOGLE_USER });
  app.go('settings');
  click('Usar progresso da nuvem');
  assert.equal(sync.calls.keepRemote, 1);
  assert.equal(sync.calls.keepLocal, 0);
});

test('conflito não é resolvido sozinho', () => {
  reset();
  const sync = stubSync({ status: 'conflict', user: GOOGLE_USER });
  app.go('settings');
  app.render();
  app.render();
  assert.equal(sync.calls.keepLocal, 0);
  assert.equal(sync.calls.keepRemote, 0);
});

/* ===================================================================
   6/7. Exportar
   =================================================================== */

test('o backup é JSON válido, identificado e versionado', () => {
  reset();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });

  const json = backup.backupJson();
  const parsed = JSON.parse(json);

  assert.equal(parsed.app, 'katsuyou-lab');
  assert.equal(parsed.formatVersion, 1);
  assert.ok(typeof parsed.exportedAt === 'string' && parsed.exportedAt.includes('T'));
  assert.equal(typeof parsed.progress, 'object');
  assert.equal(parsed.progress.pairs['nomimasu|te'].right, 1);
  assert.equal(parsed.progress.version, 2);
});

test('o backup carrega todo o progresso relevante', () => {
  reset();
  store.recordAnswer({ verbId: 'kaimasu', form: 'nai', correct: false, hinted: false, dontKnow: false, answer: 'かあない' });
  store.recordAnswer({ verbId: 'nomimasu', form: 'group', correct: true, hinted: false, dontKnow: false, answer: '1' });
  store.recordSession({ answered: 1, correct: 0, perForm: {}, wrongItems: [] });
  store.updateSettings({ hideGroup: true });

  const p = backup.buildBackup().progress;
  assert.ok(p.pairs['kaimasu|nai'], 'pares verbo × forma');
  assert.ok(p.groupPractice.nomimasu, 'treino de grupos');
  assert.equal(p.sessions.length, 1, 'sessões');
  assert.equal(p.recentErrors.length, 1, 'erros recentes');
  assert.equal(p.settings.hideGroup, true, 'configurações');
  assert.equal(p.version, 2, 'schema/version');
  assert.ok(Number.isFinite(p.createdAt), 'datas relevantes');
  assert.equal(p.pairs['kaimasu|nai'].mastery, 'learning', 'progresso de domínio');
});

test('o backup NÃO contém tokens, credenciais nem dados do Identity', () => {
  reset();
  /* Metadados de sincronização existem no localStorage, em outra chave. */
  localStorage.setItem('katsuyou_lab_sync_v1:u-1', JSON.stringify({ revision: 4, lastSyncedAt: 1, dirty: false }));
  localStorage.setItem('gotrue.user', JSON.stringify({ token: { access_token: 'SEGREDO' } }));
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });

  const json = backup.backupJson();
  for (const proibido of ['SEGREDO', 'access_token', 'gotrue', 'token', 'jwt', 'cookie', 'revision', 'katsuyou_lab_sync']) {
    assert.ok(!json.includes(proibido), `o backup vazou "${proibido}"`);
  }
  /* E o envelope só traz os campos declarados de progresso. */
  const keys = Object.keys(JSON.parse(json).progress);
  for (const k of keys) {
    assert.ok(store.PROGRESS_FIELDS.includes(k), `campo inesperado no backup: ${k}`);
  }
});

test('o nome do arquivo segue o padrão com a data', () => {
  assert.equal(
    backup.backupFilename(new Date(2026, 7, 21)),
    'katsuyou-lab-progresso-2026-08-21.json'
  );
});

test('exportar pela interface entrega o arquivo e avisa', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  app.go('settings');
  click('Exportar progresso');
  assert.ok(text().includes('Backup exportado.'));
});

/* ===================================================================
   8/9/10. Importar
   =================================================================== */

function fileWith(content, name = 'backup.json') {
  return new dom.window.File([content], name, { type: 'application/json' });
}

/* Estado de referência: um progresso pequeno e reconhecível. */
function backupComProgresso() {
  reset();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  store.recordAnswer({ verbId: 'tabemasu', form: 'nai', correct: true, hinted: false, dontKnow: false, answer: 'たべない' });
  const json = backup.backupJson();
  reset();
  return json;
}

test('importa um backup válido pelo caminho completo', () => {
  const json = backupComProgresso();
  assert.equal(store.getPair('nomimasu', 'te').right, 0, 'partimos do zero');

  const r = backup.importBackupText(json);
  assert.equal(r.ok, true);
  assert.equal(store.getPair('nomimasu', 'te').right, 2);
  assert.equal(store.getPair('tabemasu', 'nai').right, 1);
});

test('rejeita arquivo que não é JSON', () => {
  reset();
  for (const lixo of ['não sou json', '<html></html>', '', '   ']) {
    const r = backup.parseBackup(lixo);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'arquivo inválido');
  }
});

test('rejeita JSON malformado', () => {
  const r = backup.parseBackup('{ "app": "katsuyou-lab", ');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'arquivo inválido');
});

test('rejeita backup de outro aplicativo', () => {
  const r = backup.parseBackup(JSON.stringify({ app: 'bunpou-lab', formatVersion: 1, progress: {} }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'backup de outro aplicativo');
});

test('rejeita formato/versão não suportada', () => {
  for (const v of [0, 2, 99, '1', null, undefined]) {
    const r = backup.parseBackup(JSON.stringify({ app: 'katsuyou-lab', formatVersion: v, progress: {} }));
    assert.equal(r.ok, false, `formatVersion ${v} deveria ser rejeitada`);
    assert.equal(r.reason, 'versão não suportada');
  }
});

test('rejeita ausência de progress ou tipo incompatível', () => {
  const casos = [undefined, null, 'texto', 42, [], true];
  for (const p of casos) {
    const r = backup.parseBackup(JSON.stringify({ app: 'katsuyou-lab', formatVersion: 1, progress: p }));
    assert.equal(r.ok, false, `progress ${JSON.stringify(p)} deveria ser rejeitado`);
    assert.equal(r.reason, 'arquivo inválido');
  }
});

test('rejeita envelope que não é objeto', () => {
  for (const raw of ['[]', '"texto"', '42', 'null']) {
    const r = backup.parseBackup(raw);
    assert.equal(r.ok, false);
  }
});

test('rejeita estruturas absurdamente grandes', () => {
  const pairs = {};
  for (let i = 0; i < 6000; i++) pairs[`v${i}|te`] = { seen: 1, right: 1 };
  const r = backup.parseBackup(JSON.stringify({ app: 'katsuyou-lab', formatVersion: 1, progress: { pairs } }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'arquivo grande demais');

  const enorme = 'x'.repeat(backup.MAX_BACKUP_BYTES + 1);
  assert.equal(backup.parseBackup(enorme).reason, 'arquivo grande demais');
});

test('validação que falha NÃO altera o estado', () => {
  reset();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  const antes = JSON.stringify(store.getState().pairs);

  for (const ruim of ['lixo', '{}', JSON.stringify({ app: 'outro', formatVersion: 1, progress: {} })]) {
    const r = backup.importBackupText(ruim);
    assert.equal(r.ok, false);
  }
  assert.equal(JSON.stringify(store.getState().pairs), antes, 'o estado foi mexido');
  assert.equal(store.getPair('nomimasu', 'te').right, 1);
});

test('a importação usa o saneamento/migração do store', () => {
  reset();
  /* Backup no schema v1: pseudo-pares de grupo e chaves inválidas. */
  const v1 = {
    app: 'katsuyou-lab',
    formatVersion: 1,
    progress: {
      version: 1,
      pairs: {
        'nomimasu|te': { seen: 3, right: 3, wrong: 0, hinted: 0, dontKnow: 0, streak: 3, mastery: 'mastered' },
        'nomimasu|group': { seen: 4, right: 4, wrong: 0, hinted: 0, dontKnow: 0, streak: 4, mastery: 'mastered' },
        'nomimasu|potencial': { seen: 9, right: 9, mastery: 'mastered' },
        'arimasu|nai': { seen: 5, right: 5, mastery: 'mastered' },
        'verboQueNaoExiste|te': { seen: 5, right: 5, mastery: 'mastered' }
      }
    }
  };
  const r = backup.importBackupText(JSON.stringify(v1));
  assert.equal(r.ok, true);

  assert.equal(store.getPair('nomimasu', 'te').right, 3, 'conjugação legítima preservada');
  assert.equal(store.getGroupEntry('nomimasu').right, 4, 'pseudo-par migrado para treino de grupos');
  assert.equal(Object.keys(store.getState().pairs).length, 1, 'lixo descartado');
  assert.equal(store.getState().version, 2, 'schema migrado');
});

test('a importação preserva o universo de combinações de conjugação', () => {
  reset();
  /* Backup que domina tudo e ainda traz pseudo-pares de grupo. */
  const pairs = {};
  for (const v of VERBS) {
    for (const f of FORMS) {
      if ((v.notTaught || []).includes(f)) continue;
      pairs[`${v.id}|${f}`] = { seen: 3, right: 3, wrong: 0, hinted: 0, dontKnow: 0, streak: 3, mastery: 'mastered' };
    }
    pairs[`${v.id}|group`] = { seen: 3, right: 3, wrong: 0, hinted: 0, dontKnow: 0, streak: 3, mastery: 'mastered' };
  }
  const r = backup.importBackupText(JSON.stringify({ app: 'katsuyou-lab', formatVersion: 1, progress: { version: 1, pairs } }));
  assert.equal(r.ok, true);

  const c = store.overallCounts();
  assert.equal(c.trainable, store.TRAINABLE_COMBOS);
  assert.equal(c.mastered, store.TRAINABLE_COMBOS, 'nunca acima do universo');
  assert.equal(c.practiced, store.TRAINABLE_COMBOS);
});

test('campos inválidos no backup não quebram o app', () => {
  reset();
  const r = backup.importBackupText(JSON.stringify({
    app: 'katsuyou-lab',
    formatVersion: 1,
    progress: {
      pairs: { 'nomimasu|te': 'não sou objeto', 'tabemasu|nai': null, 'kaimasu|nai': { seen: 2, right: 1 } },
      groupPractice: 'texto',
      recentErrors: 'texto',
      sessions: { não: 'array' },
      settings: [1, 2, 3],
      resume: 'texto',
      lastPracticedAt: 'ontem',
      campoDesconhecido: { perigoso: true }
    }
  }));
  assert.equal(r.ok, true);

  const s = store.getState();
  assert.equal(Object.keys(s.pairs).length, 1);
  assert.deepEqual(s.groupPractice, {});
  assert.deepEqual(s.recentErrors, []);
  assert.deepEqual(s.sessions, []);
  assert.equal(s.resume, null);
  assert.equal(s.lastPracticedAt, null);
  assert.equal(s.settings.sessionLength, 20, 'as configurações voltaram ao padrão íntegro');
  assert.equal(s.campoDesconhecido, undefined, 'campo estranho não entrou no estado');
  /* E o app continua renderizando. */
  assert.doesNotThrow(() => app.go('progress'));
});

test('uma importação válida dispara o fluxo normal de persistência e sincronização', () => {
  const json = backupComProgresso();
  const sync = stubSync({ status: 'synced', user: GOOGLE_USER });

  const r = backup.importBackupText(json);
  assert.equal(r.ok, true);

  /* replaceState → save → localStorage + notifyLocalChange. Nenhum
     caminho paralelo de upload foi criado. */
  assert.ok(localStorage.getItem(store.STORAGE_KEY), 'gravou no localStorage');
  assert.ok(sync.calls.notify >= 1, 'avisou a camada de sincronização');
  assert.equal(JSON.parse(localStorage.getItem(store.STORAGE_KEY)).pairs['nomimasu|te'].right, 2);
});

/* ===================================================================
   Fluxo de importação pela interface
   =================================================================== */

test('§9 a importação pede confirmação antes de substituir', async () => {
  const json = backupComProgresso();
  store.recordAnswer({ verbId: 'ikimasu', form: 'ta', correct: true, hinted: false, dontKnow: false, answer: 'いった' });
  stubSync({ status: 'anonymous', user: null });
  app.go('settings');

  await app.stageImport(fileWith(json, 'meu-backup.json'));

  const t = text();
  assert.ok(t.includes('Este backup substituirá o progresso atual deste dispositivo.'));
  assert.ok(t.includes('meu-backup.json'));
  assert.ok(btn('Importar e substituir'));
  assert.ok(btn('Cancelar'));
  /* Nada foi substituído ainda. */
  assert.equal(store.getPair('ikimasu', 'ta').right, 1, 'o progresso atual continua');
  assert.equal(store.getPair('nomimasu', 'te').right, 0);
});

test('cancelar a importação deixa tudo como estava', async () => {
  const json = backupComProgresso();
  store.recordAnswer({ verbId: 'ikimasu', form: 'ta', correct: true, hinted: false, dontKnow: false, answer: 'いった' });
  app.go('settings');
  await app.stageImport(fileWith(json));
  click('Cancelar');

  assert.equal(app.pendingImport, null);
  assert.equal(store.getPair('ikimasu', 'ta').right, 1);
  assert.equal(store.getPair('nomimasu', 'te').right, 0);
  assert.ok(btn('Importar progresso'), 'os botões normais voltaram');
});

test('confirmar substitui e avisa o sucesso', async () => {
  const json = backupComProgresso();
  store.recordAnswer({ verbId: 'ikimasu', form: 'ta', correct: true, hinted: false, dontKnow: false, answer: 'いった' });
  app.go('settings');
  await app.stageImport(fileWith(json));
  click('Importar e substituir');

  assert.ok(text().includes('Progresso importado com sucesso.'));
  assert.equal(store.getPair('nomimasu', 'te').right, 2);
  assert.equal(store.getPair('ikimasu', 'ta').right, 0, 'o progresso anterior foi substituído');
});

test('arquivo inválido dá erro com a razão, sem tocar no estado', async () => {
  reset();
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  app.go('settings');

  await app.stageImport(fileWith('isso não é json'));
  assert.ok(text().includes('Não foi possível importar este arquivo'));
  assert.ok(text().includes('arquivo inválido'));
  assert.equal(app.pendingImport, null);
  assert.equal(store.getPair('nomimasu', 'te').right, 1);
});

test('backup de outro app dá a razão específica', async () => {
  reset();
  app.go('settings');
  await app.stageImport(fileWith(JSON.stringify({ app: 'bunpou-lab', formatVersion: 1, progress: {} })));
  assert.ok(text().includes('backup de outro aplicativo'));
});

test('versão não suportada dá a razão específica', async () => {
  reset();
  app.go('settings');
  await app.stageImport(fileWith(JSON.stringify({ app: 'katsuyou-lab', formatVersion: 99, progress: {} })));
  assert.ok(text().includes('versão não suportada'));
});

test('sair das Configurações descarta aviso e importação pendente', async () => {
  const json = backupComProgresso();
  app.go('settings');
  await app.stageImport(fileWith(json));
  assert.ok(app.pendingImport);
  app.go('home');
  assert.equal(app.pendingImport, null);
  assert.equal(app.backupNotice, null);
});

/* ===================================================================
   §13 — sincronização e backup são seções distintas
   =================================================================== */

test('as duas funções aparecem como seções separadas', () => {
  reset();
  stubSync({ status: 'anonymous', user: null });
  app.go('settings');
  const t = text();
  assert.ok(t.includes('Conta'));
  assert.ok(t.includes('Dados'));
  assert.ok(t.indexOf('Conta') < t.indexOf('Dados'));
  assert.ok(t.includes('nenhum dado de login'));
});

test('§12 exportar e importar funcionam sem nenhuma conta', async () => {
  reset();                       // sem KatsuyouSync
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  const json = backup.backupJson();

  app.go('settings');
  click('Exportar progresso');
  assert.ok(text().includes('Backup exportado.'));

  store.resetAll();
  await app.stageImport(fileWith(json));
  click('Importar e substituir');
  assert.equal(store.getPair('nomimasu', 'te').right, 1);
});
