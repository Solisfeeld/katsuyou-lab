/* ===================================================================
   Teste de fumaça da interface: renderiza cada tela num DOM real
   (jsdom) e percorre o fluxo principal do §18 ao §21 e do §47.

   Não substitui abrir o site no celular, mas garante que nenhuma tela
   quebra e que o feedback de erro chega mesmo até o usuário — que é o
   requisito central do projeto.
   =================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'https://katsuyou.test/',
  pretendToBeVisual: true
});

/* jsdom não implementa rolagem; o app chama scrollTo ao trocar de tela. */
dom.window.scrollTo = () => {};

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.confirm = () => true;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;

const { App } = await import('../src/ui/app.js');
const store = await import('../src/progress/store.js');
const { verbById } = await import('../src/data/verbs.js');

const root = document.getElementById('app');
const app = new App(root);
const text = () => root.textContent;

function reset() {
  localStorage.clear();
  store.resetAll();
}

/* -------------------------------------------------------------------
   Telas
   ------------------------------------------------------------------- */
test('a tela inicial mostra todas as opções do §17', () => {
  reset();
  app.go('home');
  const t = text();
  for (const label of [
    'Sessão mista', 'Treinar uma forma', 'Treinar grupos',
    'Pontos fracos', 'Erros recentes', 'Progresso', 'Referência'
  ]) {
    assert.ok(t.includes(label), `faltou "${label}" na home`);
  }
  assert.ok(t.includes('活用ラボ'));
  assert.ok(t.includes('Laboratório de Conjugação'));
});

test('a referência traz as regras das seis formas e as exceções', () => {
  app.go('reference');
  /* Abre todas as seções para inspecionar o conteúdo. */
  root.querySelectorAll('.ref-head').forEach(b => b.click());
  const t = text();
  for (const frag of [
    'い・ち・り → って', 'に・び・み → んで', 'き → いて', 'ぎ → いで', 'し → して',
    'linha /u/', 'って → った', 'んで → んだ',
    'い vira わ', 'ない → なかった', 'のんだ → のんだり', 'V たり、V たり しています',
    'いきます → いって', 'Básico Rikai'
  ]) {
    assert.ok(t.includes(frag), `a referência não menciona "${frag}"`);
  }
});

test('progresso e erros recentes funcionam com o histórico vazio', () => {
  reset();
  app.go('progress');
  assert.ok(text().includes('Nenhuma resposta registrada'));
  app.go('errors');
  assert.ok(text().includes('Nada registrado ainda'));
});

test('a configuração de sessão oferece questões e tempo', () => {
  app.go('setup', { mode: 'mixed' });
  const t = text();
  assert.ok(t.includes('10 questões') && t.includes('20 questões') && t.includes('30 questões'));
  root.querySelectorAll('.chip').forEach(c => {
    if (c.textContent === 'Por tempo') c.click();
  });
  const t2 = text();
  assert.ok(t2.includes('5 minutos') && t2.includes('10 minutos') && t2.includes('15 minutos'));
});

/* -------------------------------------------------------------------
   Fluxo do exercício
   ------------------------------------------------------------------- */
function startWith(queue) {
  reset();
  app.startSession({ mode: 'review', queue, limitKind: 'count', length: queue.length });
}
const input = () => root.querySelector('input.answer');
/* Casa tanto um botão simples quanto um cartão do menu, que traz título
   em <b> e descrição em <span> dentro do mesmo <button>. */
const clickText = label => {
  const btns = [...root.querySelectorAll('button')];
  const btn = btns.find(b => b.textContent.trim() === label)
    || btns.find(b => b.querySelector('b')?.textContent.trim() === label);
  assert.ok(btn, `botão "${label}" não encontrado`);
  btn.click();
  return btn;
};

test('§18 o exercício mostra o japonês em destaque e a forma pedida', () => {
  startWith([{ verbId: 'nomimasu', form: 'te' }]);
  assert.equal(root.querySelector('.q-prompt').textContent, 'のみます');
  assert.equal(root.querySelector('.q-meaning').textContent, 'beber');
  assert.ok(text().includes('Forma て'));
  assert.ok(input(), 'há um campo de resposta');
  assert.ok(text().includes('Preciso de uma dica'));
  assert.ok(text().includes('Não sei'));
});

test('§19 acerto dá feedback curto', () => {
  startWith([{ verbId: 'nomimasu', form: 'te' }]);
  input().value = 'のんで';
  clickText('Responder');
  const t = text();
  assert.ok(t.includes('✓ Correto'));
  assert.ok(t.includes('のんで'));
  assert.ok(t.includes('Grupo 1'));
  /* O acerto NÃO abre a transformação passo a passo. */
  assert.equal(root.querySelector('.steps'), null, 'o acerto não deve mostrar o passo a passo');
});

test('§20 erro traz diagnóstico, transformação, regra e fonte', () => {
  startWith([{ verbId: 'nomimasu', form: 'te' }]);
  input().value = 'のんだ';
  clickText('Responder');
  const t = text();
  assert.ok(t.includes('✗ Ainda não'));
  assert.ok(t.includes('のんで'), 'mostra a resposta certa');
  assert.ok(t.includes('Grupo 1'));
  /* §21 — diagnóstico específico, não genérico. */
  assert.ok(t.includes('Forma た deste verbo'), `diagnóstico ausente em: ${t}`);
  /* §20 — o caminho completo. */
  assert.ok(root.querySelector('.steps'), 'falta a transformação passo a passo');
  assert.ok(t.includes('retirar ます'));
  assert.ok(t.includes('に・び・み → んで'));
  assert.ok(t.includes('Básico Rikai · Lição 01'));
});

test('§22 erro da forma ない explica い → わ', () => {
  startWith([{ verbId: 'kaimasu', form: 'nai' }]);
  input().value = 'かあない';
  clickText('Responder');
  const t = text();
  assert.ok(t.includes('かわない'));
  assert.ok(t.includes('い é o caso especial') || t.includes('い é um caso especial'));
  assert.ok(t.includes('い → わ, não あ'));
  assert.ok(t.includes('Básico Rikai · Lição 15'));
});

test('§23 a forma なかった mostra a passagem pela forma ない', () => {
  startWith([{ verbId: 'nomimasu', form: 'nakatta' }]);
  input().value = 'errado';
  clickText('Responder');
  const t = text();
  assert.ok(t.includes('のまない'), 'passa pela forma ない');
  assert.ok(t.includes('retirar い de ない'));
  assert.ok(t.includes('のまなかった'));
  assert.ok(t.includes('ない → なかった'));
});

test('§24 a forma た aponta a relação com a forma て', () => {
  startWith([{ verbId: 'oyogimasu', form: 'ta' }]);
  input().value = 'およいた';
  clickText('Responder');
  const t = text();
  assert.ok(t.includes('およいだ'));
  assert.ok(t.includes('Mesma base da forma て'));
  assert.ok(t.includes('いで → いだ'));
});

test('a exceção de いきます é explicada como exceção', () => {
  startWith([{ verbId: 'ikimasu', form: 'te' }]);
  input().value = 'いいて';
  clickText('Responder');
  const t = text();
  assert.ok(t.includes('いって'));
  assert.ok(t.includes('exceção'), 'o feedback precisa nomear a exceção');
});

test('§29 as dicas saem em duas etapas e não entregam a resposta', () => {
  startWith([{ verbId: 'nomimasu', form: 'te' }]);
  clickText('Preciso de uma dica');
  let t = text();
  assert.ok(t.includes('É Grupo 1.'));
  assert.ok(!t.includes('のんで'), 'a primeira dica não pode entregar a resposta');
  clickText('Mais uma dica');
  t = text();
  assert.ok(t.includes('に・び・み → んで'));
});

test('§28 "Não sei" mostra tudo e registra como não dominado', () => {
  startWith([{ verbId: 'ikimasu', form: 'nai' }]);
  clickText('Não sei');
  const t = text();
  assert.ok(t.includes('いかない'));
  assert.ok(root.querySelector('.steps'), '"Não sei" mostra o passo a passo');
  assert.ok(t.includes('Básico Rikai'));
  assert.equal(store.getPair('ikimasu', 'nai').dontKnow, 1);
});

test('§40 Enter responde e, no feedback, Enter avança', () => {
  startWith([{ verbId: 'nomimasu', form: 'te' }, { verbId: 'tabemasu', form: 'nai' }]);
  const box = input();
  box.value = 'のんで';
  box.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.ok(text().includes('✓ Correto'), 'Enter deveria enviar a resposta');

  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(root.querySelector('.q-prompt').textContent, 'たべます', 'Enter deveria avançar');
});

test('o IME não dispara envio durante a composição', () => {
  startWith([{ verbId: 'nomimasu', form: 'te' }]);
  const box = input();
  box.value = 'のん';
  const ev = new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
  Object.defineProperty(ev, 'isComposing', { value: true });
  box.dispatchEvent(ev);
  assert.ok(!text().includes('✓ Correto') && !text().includes('✗ Ainda não'),
    'Enter durante a composição do IME não pode enviar');
});

test('o treino de grupos pergunta o grupo e explica o erro', () => {
  reset();
  app.startSession({ mode: 'group', queue: [{ verbId: 'okimasu', form: 'group' }], length: 1 });
  assert.ok(text().includes('Qual é o grupo?'));
  clickText('Grupo 1');
  const t = text();
  assert.ok(t.includes('✗ Ainda não'));
  assert.ok(t.includes('Grupo 2'));
  assert.ok(t.includes('tipo (iii)'));
});

/* -------------------------------------------------------------------
   Fim de sessão e telas de acompanhamento
   ------------------------------------------------------------------- */
test('§47 a tela final resume e oferece revisar os erros', () => {
  startWith([{ verbId: 'nomimasu', form: 'te' }, { verbId: 'kaimasu', form: 'nai' }]);
  input().value = 'のんで';
  clickText('Responder');
  clickText('Próxima');
  input().value = 'かあない';
  clickText('Responder');

  /* O item errado voltou à fila; encerramos a sessão manualmente. */
  app.endSession(app.session);
  const t = text();
  assert.ok(t.includes('Fim da sessão'));
  assert.ok(t.includes('1 / 2'));
  assert.ok(t.includes('Revisar'));
  assert.ok(t.includes('かいます'));
  clickText('Revisar os erros agora');
  assert.equal(root.querySelector('.q-prompt').textContent, 'かいます');
});

test('§36 os erros recentes mostram o que foi digitado e o motivo', () => {
  app.go('errors');
  const t = text();
  assert.ok(t.includes('Hoje'));
  assert.ok(t.includes('かいます'));
  assert.ok(t.includes('かあない'), 'mostra o que o usuário digitou');
  assert.ok(t.includes('かわない'), 'mostra a resposta correta');
  assert.ok(t.includes('Motivo:'));
});

test('§34/§35 o progresso mostra estatísticas e a matriz de domínio', () => {
  app.go('progress');
  const t = text();
  assert.ok(t.includes('Por forma'));
  assert.ok(t.includes('Por grupo'));
  assert.ok(t.includes('Matriz de domínio'));
  assert.ok(t.includes('dominado') && t.includes('quase firme') && t.includes('não praticado'));
  const table = root.querySelector('table.matrix');
  assert.ok(table, 'a matriz é uma tabela');
  assert.ok(table.querySelectorAll('tbody tr').length >= 40, 'a matriz lista os verbos');
  /* あります não é praticável em ない/なかった: as células ficam marcadas. */
  assert.ok(root.querySelector('.cell.off'), 'combinação não ensinada aparece desabilitada');
});

test('§17 a sessão interrompida reaparece como "Continuar treino"', () => {
  startWith([{ verbId: 'nomimasu', form: 'te' }, { verbId: 'tabemasu', form: 'nai' }]);
  input().value = 'のんで';
  clickText('Responder');
  clickText('Próxima');
  app.go('home');
  assert.ok(text().includes('Continuar treino'));
  clickText('Continuar treino');
  assert.ok(root.querySelector('.q-prompt'), 'a sessão foi retomada');
});

test('§14 é possível esconder o grupo durante o exercício', () => {
  reset();
  store.updateSettings({ hideGroup: true });
  app.startSession({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'te' }], length: 1 });
  assert.equal(root.querySelector('.q-group'), null, 'o grupo deve estar escondido');
  store.updateSettings({ hideGroup: false });
  app.startSession({ mode: 'review', queue: [{ verbId: 'nomimasu', form: 'te' }], length: 1 });
  assert.ok(root.querySelector('.q-group'), 'o grupo deve reaparecer');
});

test('o tema alterna entre auto, claro e escuro', () => {
  app.go('home');
  const cycle = () => document.documentElement.getAttribute('data-theme');
  app.applyTheme('light');
  assert.equal(cycle(), 'light');
  app.applyTheme('dark');
  assert.equal(cycle(), 'dark');
});

test('a resposta digitada nunca é interpretada como HTML', () => {
  startWith([{ verbId: 'nomimasu', form: 'te' }]);
  input().value = '<img src=x onerror=alert(1)>';
  clickText('Responder');
  assert.equal(root.querySelector('img'), null, 'a resposta virou markup');
  assert.ok(text().includes('<img src=x onerror=alert(1)>'), 'a resposta aparece como texto');
});

test('apagar o progresso do 活用ラボ não toca em chaves do Bunpou Lab', () => {
  reset();
  localStorage.setItem('bunpou-lab-v2', '{"intocado":true}');
  store.recordAnswer({ verbId: 'nomimasu', form: 'te', correct: true, hinted: false, dontKnow: false, answer: 'のんで' });
  store.resetAll();
  assert.equal(localStorage.getItem('bunpou-lab-v2'), '{"intocado":true}');
});
