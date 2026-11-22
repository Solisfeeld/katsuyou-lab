/* ===================================================================
   Atualização de 2026-11: progressão para estudo semanal, repetição de
   erros configurável, resposta digitada visível, ～たり como derivado da
   Forma た e kanji com furigana.
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

/* relógio controlado: a progressão semanal depende de dias reais */
let NOW = Date.UTC(2026, 0, 5, 20);
Date.now = () => NOW;
const DAY = 86_400_000;

const { App } = await import('../src/ui/app.js');
const store = await import('../src/progress/store.js');
const { Session } = await import('../src/practice/engine.js');
const { buildQueue, requeue, pairCategory, queueMix, allPairs } = await import('../src/practice/scheduler.js');
const { verbById, VERBS } = await import('../src/data/verbs.js');
const { FORM_LABEL } = await import('../src/conjugation/rules.js');
const { rubyParts, kanjiSpelling, VERB_KANJI, KNOWN_KANJI } = await import('../src/conjugation/furigana.js');
const { isCorrect } = await import('../src/conjugation/normalize.js');

const root = document.getElementById('app');
const app = new App(root);
const base = el => { const c = el.cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent; };
const btn = label => [...root.querySelectorAll('button')].find(b => base(b).trim() === label);
function reset() { localStorage.clear(); store.resetAll(); NOW = Date.UTC(2026, 0, 5, 20); }
const ans = (verbId, form, correct, extra = {}) =>
  store.recordAnswer({ verbId, form, correct, hinted: false, dontKnow: false, answer: correct ? verbById(verbId)[form] : 'x', ...extra });

/* ------------------------------------------------------------------ */
test('repetir erros: ligado por padrão, inclusive em progresso antigo sem a chave', () => {
  reset();
  assert.equal(store.getState().settings.repeatErrors, true);
  const antigo = store.sanitizeProgress({ version: 2, pairs: {}, settings: { hideGroup: true } });
  assert.equal(antigo.settings.repeatErrors, true);
  assert.equal(antigo.settings.hideGroup, true, 'preferências antigas preservadas');
});

test('repetir erros: desligar é preservado depois de recarregar', () => {
  reset();
  store.updateSettings({ repeatErrors: false });
  const raw = JSON.parse(localStorage.getItem(store.STORAGE_KEY));
  assert.equal(store.sanitizeProgress(raw).settings.repeatErrors, false);
});

test('desligado: o erro não volta na sessão, mas fica registrado para o futuro', () => {
  reset();
  store.updateSettings({ repeatErrors: false });
  const s = new Session({ mode: 'mixed', limitKind: 'count', length: 8 });
  const antes = s.remaining;
  const cur = s.current;
  s.submit('errado');
  assert.equal(s.remaining, antes, 'não reenfileirou');
  const p = store.getPair(cur.verbId, cur.form);
  assert.equal(p.wrong, 1);
  assert.equal(p.mastery, 'learning');
  assert.equal(store.getState().recentErrors.length, 1);
  assert.equal(pairCategory(p), 'weak', 'continua na fila de revisão das próximas sessões');
});

test('ligado: o erro volta UMA vez, intercalado, e o reforço não apaga nem duplica o erro', () => {
  reset();
  const s = new Session({ mode: 'mixed', limitKind: 'count', length: 10 });
  const first = { verbId: s.current.verbId, form: s.current.form };
  s.submit('errado');
  const pos = s.queue.findIndex(x => x.verbId === first.verbId && x.form === first.form);
  assert.ok(pos >= 3, `voltou cedo demais (${pos})`);
  /* avança até o reforço e erra de novo */
  let guard = 0;
  for (;;) {
    s.next();
    if (s.current.requeued || guard++ > 30) break;
    s.submit(s.current.verb[s.current.form]);
  }
  assert.ok(s.current.requeued, 'é a tentativa de reforço');
  assert.equal(s.current.verbId, first.verbId);
  s.submit('errado de novo');
  const p = store.getPair(first.verbId, first.form);
  assert.equal(p.wrong, 1, 'o reforço errado não soma outro erro');
  assert.equal(p.reinforced, 1);
  assert.ok(!s.queue.some(x => x.verbId === first.verbId && x.form === first.form), 'não volta uma terceira vez (sem laço)');
  assert.equal(store.getState().recentErrors.filter(e => e.verbId === first.verbId).length, 1);
});

test('reforço acertado não apaga o erro original nem conta como acerto da primeira tentativa', () => {
  reset();
  const item = { verbId: 'nomimasu', form: 'te' };
  const s = new Session({ mode: 'review', queue: [item, { verbId: 'tabemasu', form: 'te' }, { verbId: 'kaimasu', form: 'te' }], length: 3 });
  s.submit('のみて');
  for (;;) { s.next(); if (s.current.requeued) break; s.submit(s.current.verb[s.current.form]); }
  s.submit('のんで');
  const p = store.getPair('nomimasu', 'te');
  assert.equal(p.wrong, 1); assert.equal(p.right, 0); assert.equal(p.streak, 0);
  assert.equal(p.reinforcedOk, 1);
  const sum = s.summary();
  assert.equal(sum.answered, 3, 'o reforço não infla a contagem');
  assert.equal(sum.reinforcedOk, 1);
});

test('fila curta: nunca reapresenta imediatamente; fila vazia não reenfileira', () => {
  assert.deepEqual(requeue([], { verbId: 'a', form: 'te' }), []);
  for (let i = 0; i < 50; i++) {
    const out = requeue([{ verbId: 'b', form: 'te' }, { verbId: 'c', form: 'te' }], { verbId: 'a', form: 'te' });
    assert.ok(out.findIndex(x => x.verbId === 'a') >= 1);
  }
});

test('a posição da repetição varia (não é previsível)', () => {
  const q = Array.from({ length: 12 }, (_, i) => ({ verbId: `v${i}`, form: 'te' }));
  const pos = new Set();
  for (let i = 0; i < 200; i++) pos.add(requeue(q, { verbId: 'x', form: 'te' }).findIndex(x => x.verbId === 'x'));
  assert.ok(pos.size >= 4, `posições sorteadas: ${[...pos]}`);
});

/* ------------------------------------------------------------------ */
test('domínio espaçado: dois acertos separados por dias firmam o par', () => {
  reset();
  ans('nomimasu', 'te', true);
  NOW += 7 * DAY;
  const p = ans('nomimasu', 'te', true);
  assert.equal(p.mastery, 'mastered');
});

test('dois acertos na mesma noite NÃO bastam (continua exigindo o terceiro)', () => {
  reset();
  ans('nomimasu', 'te', true);
  NOW += 60_000;
  assert.equal(ans('nomimasu', 'te', true).mastery, 'almost');
  NOW += 60_000;
  assert.equal(ans('nomimasu', 'te', true).mastery, 'mastered');
});

test('acerto com dica nunca firma, nem espaçado', () => {
  reset();
  ans('nomimasu', 'te', true, { hinted: true });
  NOW += 7 * DAY;
  assert.notEqual(ans('nomimasu', 'te', true, { hinted: true }).mastery, 'mastered');
});

test('revisão por tempo real: um par firme vence depois do intervalo em dias', () => {
  reset();
  ans('nomimasu', 'te', true); ans('nomimasu', 'te', true); ans('nomimasu', 'te', true);
  const p = store.getPair('nomimasu', 'te');
  assert.equal(pairCategory(p), 'keep');
  NOW += 8 * DAY;
  assert.equal(pairCategory(p, NOW), 'due');
});

test('cota adaptativa: muitos pares em aprendizado reduzem os inéditos, sem zerar', () => {
  assert.equal(queueMix(5, 20).new, 0.35);
  assert.ok(queueMix(200, 20).new > 0 && queueMix(200, 20).new < 0.2);
});

test('com pendências, a fila ainda traz inéditos e não repete par', () => {
  reset();
  /* 60 pares errados uma vez */
  allPairs().slice(0, 60).forEach(x => ans(x.verbId, x.form, false));
  const q = buildQueue({ mode: 'mixed', length: 20 });
  const keys = q.map(x => `${x.verbId}|${x.form}`);
  assert.equal(new Set(keys).size, keys.length);
  const novos = q.filter(x => !store.getPair(x.verbId, x.form).seen).length;
  assert.ok(novos >= 2, `inéditos na fila: ${novos}`);
  assert.ok(q.length - novos >= 10, 'a maior parte consolida o que já começou');
});

/* ------------------------------------------------------------------ */
test('feedback mostra exatamente o que foi digitado (erro), com a resposta correta', () => {
  reset();
  app.startSession({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'te' }], length: 1 });
  root.querySelector('input.answer').value = 'のみて ';
  btn('Responder').click();
  const typed = root.querySelector('[data-typed]');
  assert.equal(typed.textContent, 'のみて ', 'sem normalizar, com o espaço');
  const t = base(root);
  assert.ok(t.includes('Sua resposta'));
  assert.ok(t.includes('Resposta correta'));
  assert.ok(t.includes('飲んで'));
});

test('acerto também mostra a resposta; a grafia em kanji que a tela ensina não é "variante"', () => {
  reset();
  app.startSession({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'te' }, { verbId: 'tabemasu', form: 'te' }], length: 2 });
  root.querySelector('input.answer').value = '飲んで';
  btn('Responder').click();
  const t = base(root);
  assert.ok(t.includes('✓ Correto'));
  assert.ok(t.includes('Sua resposta'));
  assert.ok(!t.includes('Grafia diferente'), '飲んで é exatamente a grafia exibida');
  assert.equal(base(root.querySelector('[data-typed]')), '飲んで');
});

test('grafia aceita diferente do kana e da exibida aparece como variante', () => {
  reset();
  const v = verbById('kaerimasu');
  v.accept = { te: ['帰って'] };            // aceito declarado à mão (caso hipotético)
  try {
    app.startSession({ mode: 'review', queue: [{ verbId: 'kaerimasu', form: 'te' }, { verbId: 'tabemasu', form: 'te' }], length: 2 });
    root.querySelector('input.answer').value = '帰って';
    btn('Responder').click();
    const t = base(root);
    assert.ok(t.includes('✓ Correto'));
    assert.ok(t.includes('Grafia diferente, mas aceita.'));
    assert.ok(t.includes('Forma esperada'));
    assert.equal(base(root.querySelector('[data-typed]')), '帰って');
  } finally { delete v.accept; }
});

test('"Não sei" é distinguido de resposta em branco e de erro', () => {
  reset();
  app.startSession({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'te' }], length: 1 });
  btn('Não sei').click();
  assert.ok(base(root).includes('“Não sei”'));
  assert.equal(root.querySelector('[data-typed]'), null);
});

test('Erros recentes mostram o que foi digitado', () => {
  reset();
  ans('kaimasu', 'nai', false, { answer: 'かあない' });
  app.go('errors');
  const t = base(root);
  assert.ok(t.includes('Sua resposta'));
  assert.ok(t.includes('かあない'));
  assert.ok(t.includes('買わない'));
});

test('Ajustes: a opção de repetição aparece, ligada, e alterna', () => {
  reset();
  app.go('settings');
  const b = root.querySelector('[data-setting="repeat-errors"]');
  assert.ok(base(root).includes('Repetir atividades erradas na mesma sessão'));
  assert.equal(b.getAttribute('aria-pressed'), 'true');
  b.click();
  assert.equal(store.getState().settings.repeatErrors, false);
  assert.equal(root.querySelector('[data-setting="repeat-errors"]').getAttribute('aria-pressed'), 'false');
});

/* ------------------------------------------------------------------ */
test('～たり é apresentado como Forma た + り, sem perder a chave de progresso', () => {
  assert.equal(FORM_LABEL.tari, '～たり (Forma た + り)');
  reset();
  ans('nomimasu', 'tari', true);
  assert.equal(store.getPair('nomimasu', 'tari').right, 1, 'a chave tari continua a mesma');
});

/* ------------------------------------------------------------------ */
test('furigana: leitura contextual de 来る', () => {
  const r = kana => rubyParts('kimasu_kuru', kana).map(p => p.kanji ? `${p.kanji}[${p.reading}]` : p.kana).join('');
  assert.equal(r('くる'), '来[く]る');
  assert.equal(r('きた'), '来[き]た');
  assert.equal(r('こない'), '来[こ]ない');
  assert.equal(kanjiSpelling('mottekimasu', 'もってこなかった'), '持って来なかった');
});

test('furigana: só kanji autorizados; verbo fora do conjunto fica em kana', () => {
  for (const segs of Object.values(VERB_KANJI)) for (const sg of segs) if (sg.k) [...sg.k].forEach(c => assert.ok(KNOWN_KANJI.has(c), c));
  assert.equal(rubyParts('kaerimasu', 'かえって'), null);
  assert.equal(rubyParts('hatarakimasu', 'はたらいて'), null);
});

test('furigana não interfere na avaliação: kana e kanji aceitos, erro continua erro', () => {
  const v = verbById('ikimasu');
  assert.ok(isCorrect(v, 'te', 'いって'));
  assert.ok(isCorrect(v, 'te', '行って'));
  assert.ok(!isCorrect(v, 'te', 'いいて'));
  assert.ok(!isCorrect(v, 'te', '言って'), 'grafia de OUTRO verbo não é aceita');
});

test('o campo de resposta é texto puro, sem ruby', () => {
  reset();
  app.startSession({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'te' }], length: 1 });
  const input = root.querySelector('input.answer');
  assert.equal(input.tagName, 'INPUT');
  assert.equal(input.querySelector('ruby'), null);
  assert.ok(root.querySelector('.q-prompt ruby'), 'o enunciado tem furigana');
  assert.equal(root.querySelector('.q-prompt [data-kana]').dataset.kana, 'のみます');
});

test('todos os 48 verbos e suas formas renderizam sem lançar erro', () => {
  for (const v of VERBS) {
    for (const f of ['masu', 'te', 'dictionary', 'ta', 'nai', 'tari', 'nakatta']) {
      if (!v[f]) continue;
      const parts = rubyParts(v.id, v[f]);
      if (parts) assert.equal(parts.map(p => p.reading || p.kana).join(''), v[f], `${v.id} ${f}`);
    }
  }
});

test('par dominado na 1ª metade do intervalo não ocupa a cota de manutenção toda semana', () => {
  reset();
  /* um par dominado com sequência longa (intervalo de 56 dias), visto há 7 dias */
  for (let i = 0; i < 8; i++) { ans('dekimasu', 'nai', true); NOW += DAY; }
  NOW += 7 * DAY;
  assert.equal(pairCategory(store.getPair('dekimasu', 'nai'), NOW), 'keep');
  let vezes = 0;
  for (let t = 0; t < 30; t++) {
    const q = buildQueue({ mode: 'mixed', length: 20 });
    if (q.some(i => i.verbId === 'dekimasu' && i.form === 'nai')) vezes++;
  }
  assert.equal(vezes, 0, 'com inéditos e pendentes disponíveis, ele fica na reserva');
});
