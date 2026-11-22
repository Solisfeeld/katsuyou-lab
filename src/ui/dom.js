/* ===================================================================
   活用ラボ — utilitários de DOM.

   Tudo é construído por nó, com textContent. Nada de innerHTML com
   conteúdo variável: o banco é local, mas a resposta digitada pelo
   usuário volta na tela do feedback, e ela nunca deve virar markup.
   =================================================================== */

import { VERBS } from '../data/verbs.js';
import { FORMS } from '../conjugation/rules.js';
import { rubyParts } from '../conjugation/furigana.js';

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;              // só com literais do código
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(node, ...children) {
  clear(node);
  children.flat(Infinity).forEach(c => c && node.appendChild(c));
  return node;
}

/* Cor da forma-alvo, para chips, barras e a matriz. */
export function formVars(form) {
  return { '--fc': `var(--f-${form})`, '--wash': `var(--f-${form}-wash)` };
}

/* Rodapé de retorno, igual em todas as telas secundárias — mesmo padrão
   do Bunpou Lab (`← Voltar`, botão fantasma no fim da página). A logo
   continua sendo um atalho para a home, nunca a única saída. */
export function backRow(app, label = '← Voltar') {
  return h('div', { class: 'row', style: { marginTop: '22px' } },
    h('button', {
      class: 'btn btn-ghost',
      'data-nav': 'back',
      onclick: () => app.back()
    }, label)
  );
}

/* ===================================================================
   Japonês com kanji e furigana (ver conjugation/furigana.js).

   Tudo é montado por nó (<ruby>/<rt>), nunca por innerHTML: o texto pode
   conter a resposta digitada pelo usuário.
   =================================================================== */

function partsToNodes(parts) {
  return parts.map(p => p.kanji
    ? h('ruby', {}, p.kanji, h('rt', { text: p.reading }))
    : document.createTextNode(p.kana));
}

/** Forma de UM verbo conhecido: 飲[の]んで. Sem grafia autorizada, fica em kana. */
export function jpVerb(verbId, kana, props = {}) {
  const parts = rubyParts(verbId, kana);
  /* data-kana: a forma como está no banco — identidade estável para testes
     e para quem precisar ler o texto sem a leitura sobreposta */
  return h('span', { class: 'jp', 'data-kana': kana, ...props }, parts ? partsToNodes(parts) : kana);
}

/* Índice das formas de todos os verbos: kana → partes e kanji → partes.
   Uma grafia em kana que pertence a dois verbos de kanji diferentes
   (いって: 行って／言って · きます: 来ます／着ます) é AMBÍGUA e fica em kana. */
let INDEX = null;
function index() {
  if (INDEX) return INDEX;
  const byKana = new Map(), byKanji = new Map(), amb = new Set();
  for (const v of VERBS) {
    for (const f of ['masu', ...FORMS]) {
      const kana = v[f]; if (!kana) continue;
      const parts = rubyParts(v.id, kana); if (!parts) continue;
      const spelled = parts.map(p => p.kanji || p.kana).join('');
      const prev = byKana.get(kana);
      if (prev && prev.spelled !== spelled) amb.add(kana);
      else byKana.set(kana, { parts, spelled });
      byKanji.set(spelled, parts);
    }
  }
  amb.forEach(k => byKana.delete(k));
  INDEX = { byKana, byKanji };
  return INDEX;
}

/* Leituras fixas de palavras que aparecem nos textos da interface fora das
   formas verbais (rótulos, exemplos da referência, formas erradas citadas
   nas explicações). Só entra aqui o que tem leitura única no contexto. */
const WORDS = {
  '辞書形': [['辞書形', 'じしょけい']],
  '辞書': [['辞書', 'じしょ']],
  'ます形': [['ます', null], ['形', 'けい']],
  '形': [['形', 'けい']],
  '活用': [['活用', 'かつよう']],
  '行いて': [['行', 'い'], ['いて', null]],
  '行いた': [['行', 'い'], ['いた', null]]
};

/* `漢[かん]` explícito: para frases fixas cuja leitura já foi conferida. */
const MARK = /([一-鿿々]+)\[([^\]]+)\]/g;
const RUN = /[ぁ-ゟ゠-ヿ一-鿿々ー]+/g;

function runNodes(run) {
  const ix = index();
  if (ix.byKanji.has(run)) return partsToNodes(ix.byKanji.get(run));
  if (ix.byKana.has(run)) return partsToNodes(ix.byKana.get(run).parts);
  /* palavra conhecida no início ou no fim do trecho (形 de ます形, 辞書形) */
  for (const [w, segs] of Object.entries(WORDS)) {
    const at = run.indexOf(w);
    if (at < 0) continue;
    const nodes = [];
    if (at > 0) nodes.push(...runNodes(run.slice(0, at)));
    segs.forEach(([t, r]) => nodes.push(r ? h('ruby', {}, t, h('rt', { text: r })) : document.createTextNode(t)));
    const rest = run.slice(at + w.length);
    if (rest) nodes.push(...runNodes(rest));
    return nodes;
  }
  return [document.createTextNode(run)];
}

/**
 * Texto livre (português com japonês no meio, rótulos, frases da referência)
 * → nós com furigana. Converte só formas verbais sem ambiguidade; aceita a
 * marcação explícita 漢[かん]; o resto fica como está.
 */
export function jpText(text) {
  const out = [];
  const s = String(text ?? '');
  /* 1) marcação explícita */
  let last = 0; let m; MARK.lastIndex = 0;
  const chunks = [];
  while ((m = MARK.exec(s))) {
    if (m.index > last) chunks.push({ t: s.slice(last, m.index) });
    chunks.push({ k: m[1], r: m[2] });
    last = m.index + m[0].length;
  }
  if (last < s.length) chunks.push({ t: s.slice(last) });
  /* 2) trechos japoneses do texto restante */
  for (const c of chunks) {
    if (c.k) { out.push(h('ruby', {}, c.k, h('rt', { text: c.r }))); continue; }
    let l = 0; let r; RUN.lastIndex = 0;
    while ((r = RUN.exec(c.t))) {
      if (r.index > l) out.push(document.createTextNode(c.t.slice(l, r.index)));
      out.push(...runNodes(r[0]));
      l = r.index + r[0].length;
    }
    if (l < c.t.length) out.push(document.createTextNode(c.t.slice(l)));
  }
  return out;
}

/** Atalho: elemento com texto japonês já convertido. */
export function hj(tag, props, text) {
  return h(tag, props || {}, jpText(text));
}

/* ===================================================================
   Sakura — ilustrações SVG autorais, as mesmas do Bunpou Lab (ver
   docs/design-system.md). Strings literais do código: só elas passam
   por `html`. Decorativas: aria-hidden, nada anima.
   =================================================================== */
const SAKURA_PETAL = 'M0 0C-6.5-5-8-14.5-3.4-20.2L0-17.4L3.4-20.2C8-14.5 6.5-5 0 0Z';
const petals = (rot = 0, fill = 'var(--petal)', stroke = 'var(--petal-line)', w = 1.2) =>
  [0, 72, 144, 216, 288].map(r =>
    `<path d="${SAKURA_PETAL}" transform="rotate(${r + rot})" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"/>`
  ).join('');

export const sakuraFlower = (cls, fill = 'var(--sakura-wash)', stroke = 'var(--sakura)') =>
  `<svg class="${cls}" viewBox="-24 -24 48 48" aria-hidden="true" focusable="false">${petals(0, fill, stroke, 1.4)}<circle r="3.2" fill="${stroke}"/></svg>`;

export const SAKURA_BRANCH = `<svg class="branch" viewBox="0 0 320 200" aria-hidden="true" focusable="false">
  <path d="M318 6C262 22 214 46 176 84C150 110 128 134 92 150C66 162 38 166 6 170" fill="none" stroke="var(--branch)" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M214 50C224 70 226 88 220 104" fill="none" stroke="var(--branch)" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M140 118C150 132 152 148 146 160" fill="none" stroke="var(--branch)" stroke-width="1.6" stroke-linecap="round"/>
  ${[[214, 52, 1], [176, 86, .82], [220, 106, .7], [110, 140, .9], [146, 162, .62], [262, 28, .6], [60, 160, .55]].map(([x, y, k]) =>
    `<g transform="translate(${x} ${y}) scale(${k})">${petals(18)}<circle r="3" fill="var(--petal-line)"/></g>`).join('')}
  <circle cx="246" cy="40" r="3.4" fill="var(--petal-line)" opacity=".7"/><circle cx="92" cy="152" r="3" fill="var(--petal-line)" opacity=".6"/>
</svg>`;

export const EXT_ICON = '<svg class="ext" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10M9 2h5v5M14 2 7.5 8.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* O outro laboratório. Abre sempre em NOVA guia: nada é compartilhado além
   do link — login, progresso e armazenamento continuam separados. */
export const BUNPOU_URL = 'https://bunpou-lab.netlify.app/';
