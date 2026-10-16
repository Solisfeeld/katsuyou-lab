/* ===================================================================
   活用ラボ — progresso.

   §30: a unidade de domínio é verbo × forma, nunca o verbo sozinho.
   §38: chave própria, jamais a do Bunpou Lab.
   =================================================================== */

import { VERBS, verbById } from '../data/verbs.js';
import { FORMS } from '../conjugation/rules.js';

/* Chave exclusiva deste app. O Bunpou Lab usa 'bunpou-lab-v2' e
   'bunpou-lab-sync-v1:' — nenhuma delas pode ser tocada aqui. */
export const STORAGE_KEY = 'katsuyou_lab_progress_v1';

/* Estados de domínio (§35). */
export const MASTERY = {
  NEW: 'new',            // não praticado
  LEARNING: 'learning',  // aprendendo
  ALMOST: 'almost',      // quase firme
  MASTERED: 'mastered'   // dominado
};

export const MASTERY_LABEL = {
  new: 'não praticado',
  learning: 'aprendendo',
  almost: 'quase firme',
  mastered: 'dominado'
};

export const MASTERY_MARK = { new: '·', learning: '✗', almost: '△', mastered: '✓' };

const MAX_RECENT_ERRORS = 60;
const MAX_SESSIONS = 100;

/* A identificação de grupo é uma habilidade AUXILIAR, não uma sexta
   forma. Ela nunca entra em `pairs`, nunca entra na matriz e nunca conta
   para as combinações treináveis de conjugação. Este é o rótulo que a distingue
   nas telas e nos erros recentes. */
export const GROUP_QUIZ = 'group';

export function pairKey(verbId, form) { return `${verbId}|${form}`; }
export function parsePair(key) {
  const [verbId, form] = key.split('|');
  return { verbId, form, verb: verbById(verbId) };
}

/* Um par só conta como conjugação se o verbo existe, a forma é uma das
   cinco e o Rikai sustenta essa forma para esse verbo. É o filtro que
   garante que nada além das combinações treináveis entre nas estatísticas. */
export function isConjugationPair(key) {
  const { form, verb } = parsePair(key);
  return !!verb && FORMS.includes(form) && !(verb.notTaught || []).includes(form);
}

function conjugationEntries(s) {
  return Object.entries(s.pairs).filter(([key]) => isConjugationPair(key));
}

function emptyState() {
  return {
    version: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastPracticedAt: null,
    /* pares[verbo|forma] = { seen, right, wrong, hinted, dontKnow,
                              streak, mastery, lastSeenAt }
       SOMENTE conjugação — as formas de FORMS. */
    pairs: {},
    /* Desempenho do modo "Treinar grupos", por verbo. Área separada de
       propósito: identificar o grupo é outra habilidade. */
    groupPractice: {},
    recentErrors: [],
    sessions: [],
    /* Retomar treino (§17 "Continuar treino"). */
    resume: null,
    settings: {
      hideGroup: false,       // §14 — esconder o grupo durante o exercício
      sessionLength: 20,      // 10 | 20 | 30
      sessionMode: 'count',   // 'count' | 'time'
      sessionMinutes: 10,     // 5 | 10 | 15
      theme: 'auto'
    }
  };
}

function emptyPair() {
  return {
    seen: 0, right: 0, wrong: 0, hinted: 0, dontKnow: 0,
    streak: 0, mastery: MASTERY.NEW, lastSeenAt: null
  };
}

function emptyGroupEntry() {
  return { seen: 0, right: 0, wrong: 0, hinted: 0, dontKnow: 0, streak: 0, lastSeenAt: null };
}

/* Soma dois registros de treino de grupo. Usado só na migração, quando
   um pseudo-par antigo "verbo|group" encontra um registro já existente. */
function mergeGroupEntry(a, b) {
  const x = a || emptyGroupEntry();
  const y = b || emptyGroupEntry();
  return {
    seen: x.seen + y.seen,
    right: x.right + y.right,
    wrong: x.wrong + y.wrong,
    hinted: x.hinted + y.hinted,
    dontKnow: x.dontKnow + y.dontKnow,
    streak: Math.max(x.streak, y.streak),
    lastSeenAt: Math.max(x.lastSeenAt || 0, y.lastSeenAt || 0) || null
  };
}

/* -------------------------------------------------------------------
   Leitura/escrita resistentes: um localStorage indisponível (aba
   privada, storage cheio) não pode derrubar o app.
   ------------------------------------------------------------------- */
function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

/* -------------------------------------------------------------------
   Saneamento do que veio do disco (schema v1 → v2).

   A v1 gravava as respostas do modo "Treinar grupos" dentro de `pairs`,
   com a chave "verbo|group". Esses pseudo-pares inflavam `practiced` e
   `mastered` acima do universo real de conjugação, e podiam aparecer em
   Pontos fracos. Aqui eles são MIGRADOS para `groupPractice` — nenhum
   progresso de conjugação é descartado no caminho.
   ------------------------------------------------------------------- */
function sanitize(saved) {
  const pairs = {};
  const groupPractice = {};

  for (const [verbId, entry] of Object.entries(saved.groupPractice || {})) {
    if (verbById(verbId) && entry && typeof entry === 'object') {
      groupPractice[verbId] = { ...emptyGroupEntry(), ...entry };
    }
  }

  for (const [key, p] of Object.entries(saved.pairs || {})) {
    if (!p || typeof p !== 'object') continue;
    const { verbId, form, verb } = parsePair(key);
    if (!verb) continue;                       // verbo que não existe mais

    if (isConjugationPair(key)) { pairs[key] = { ...emptyPair(), ...p }; continue; }

    if (form === GROUP_QUIZ) {
      /* v1: pseudo-par de treino de grupo. Migra em vez de descartar. */
      groupPractice[verbId] = mergeGroupEntry(groupPractice[verbId], {
        seen: p.seen || 0,
        right: p.right || 0,
        wrong: p.wrong || 0,
        hinted: p.hinted || 0,
        dontKnow: p.dontKnow || 0,
        streak: p.streak || 0,
        lastSeenAt: p.lastSeenAt || null
      });
    }
    /* Qualquer outra chave (forma inexistente, forma não sustentada para
       aquele verbo) é simplesmente deixada de fora. */
  }

  return { pairs, groupPractice };
}

/* Campos que compõem o progresso. Trabalhar com lista fechada, e não com
   spread do objeto recebido, é o que garante que nada estranho entre no
   estado — venha do disco, da sincronização ou de um arquivo importado. */
export const PROGRESS_FIELDS = [
  'version', 'createdAt', 'updatedAt', 'lastPracticedAt',
  'pairs', 'groupPractice', 'recentErrors', 'sessions', 'resume', 'settings'
];

const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);

/**
 * Normaliza qualquer objeto "progresso" para um estado íntegro do app.
 * É o único ponto de entrada de dados externos: disco, snapshot da
 * sincronização e arquivo de backup importado passam todos por aqui.
 */
export function sanitizeProgress(raw) {
  const base = emptyState();
  const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const { pairs, groupPractice } = sanitize(src);
  return {
    version: base.version,
    createdAt: num(src.createdAt, base.createdAt),
    updatedAt: num(src.updatedAt, base.updatedAt),
    lastPracticedAt: num(src.lastPracticedAt, null),
    pairs,
    groupPractice,
    recentErrors: Array.isArray(src.recentErrors) ? src.recentErrors.slice(0, MAX_RECENT_ERRORS) : [],
    sessions: Array.isArray(src.sessions) ? src.sessions.slice(0, MAX_SESSIONS) : [],
    resume: (src.resume && typeof src.resume === 'object' && !Array.isArray(src.resume)) ? src.resume : null,
    settings: {
      ...base.settings,
      ...(src.settings && typeof src.settings === 'object' && !Array.isArray(src.settings) ? src.settings : {})
    }
  };
}

export function load() {
  const saved = readRaw();
  if (!saved || typeof saved !== 'object') return emptyState();
  return sanitizeProgress(saved);
}

let state = null;
const listeners = new Set();

export function getState() {
  if (!state) state = load();
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function save() {
  const s = getState();
  s.updatedAt = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* sem storage o app segue funcionando na sessão corrente */ }
  /* Avisa a camada de sincronização, se ela existir. */
  try { window.KatsuyouSync?.notifyLocalChange?.(); } catch {}
  listeners.forEach(fn => { try { fn(s); } catch {} });
}

/* Instala um progresso vindo de fora (sincronização ou backup importado).
   Passa pelo mesmo saneamento do disco — ele pode ter sido gravado por
   uma versão anterior do app, ou por ninguém. */
export function replaceState(next) {
  state = sanitizeProgress(next);
  save();
}

/* Cópia profunda do estado atual, para servir de ponto de retorno numa
   operação que possa falhar no meio (ver progress/backup.js). */
export function snapshotState() {
  return JSON.parse(JSON.stringify(getState()));
}

export function resetAll() {
  state = emptyState();
  save();
}

/* -------------------------------------------------------------------
   Domínio de um par verbo × forma.

   A escada é deliberadamente lenta na subida e rápida na descida: o
   objetivo do app é automatismo, e "acertei uma vez" não é automatismo.
   §33: acertar na reapresentação conta como recuperação, não como
   domínio instantâneo — por isso o acerto com dica ou logo após um erro
   não pula direto para "dominado".
   ------------------------------------------------------------------- */
function recompute(p, { correct, hinted, dontKnow }) {
  if (dontKnow || !correct) {
    p.streak = 0;
    p.mastery = MASTERY.LEARNING;
    return;
  }
  p.streak += 1;
  if (hinted) {
    /* Acerto com dica vale menos (§29): sustenta o par e pode levá-lo a
       "quase firme", mas nunca a "dominado" — dominar é responder sem
       reconstruir a regra, e a dica reconstruiu a regra. */
    if (p.mastery !== MASTERY.MASTERED) {
      p.mastery = p.streak >= 2 ? MASTERY.ALMOST : MASTERY.LEARNING;
    }
    return;
  }
  if (p.streak >= 3) p.mastery = MASTERY.MASTERED;
  else if (p.streak === 2) p.mastery = MASTERY.ALMOST;
  else p.mastery = MASTERY.LEARNING;
}

export function getPair(verbId, form) {
  const s = getState();
  return s.pairs[pairKey(verbId, form)] || emptyPair();
}

export function getGroupEntry(verbId) {
  const s = getState();
  return s.groupPractice[verbId] || emptyGroupEntry();
}

/* Registra o erro na lista de Erros recentes, marcando com clareza se
   veio do treino de grupos ou de uma conjugação (§36). */
function pushRecentError(s, result) {
  const verb = verbById(result.verbId);
  const isGroup = result.form === GROUP_QUIZ;
  s.recentErrors.unshift({
    at: Date.now(),
    verbId: result.verbId,
    form: result.form,
    kind: isGroup ? 'group' : 'conjugation',
    masu: verb?.masu || result.verbId,
    meaning: verb?.meaning || '',
    given: result.dontKnow ? null : (result.answer || ''),
    correct: isGroup
      ? (verb ? `Grupo ${verb.group}` : '')
      : (verb ? verb[result.form] : ''),
    dontKnow: !!result.dontKnow,
    reason: result.reason || null
  });
  s.recentErrors = s.recentErrors.slice(0, MAX_RECENT_ERRORS);
}

/**
 * Registra uma resposta. `result`:
 *   { correct, hinted, dontKnow, answer, verbId, form }
 *
 * `form === 'group'` é desviado para a área de treino de grupos: essa
 * habilidade não é uma sexta forma e não pode entrar em `pairs`.
 */
export function recordAnswer(result) {
  if (result.form === GROUP_QUIZ) return recordGroupAnswer(result);

  const s = getState();
  const key = pairKey(result.verbId, result.form);
  const p = s.pairs[key] || emptyPair();

  p.seen += 1;
  p.lastSeenAt = Date.now();
  if (result.dontKnow) p.dontKnow += 1;
  else if (result.correct) p.right += 1;
  else p.wrong += 1;
  if (result.hinted) p.hinted += 1;

  recompute(p, result);
  s.pairs[key] = p;
  s.lastPracticedAt = Date.now();

  if (!result.correct) pushRecentError(s, result);
  save();
  return p;
}

/* Treino de grupos: contadores próprios, sem escada de domínio. Não há
   estado new/learning/almost/mastered aqui porque essa escada pertence
   à conjugação — misturar as duas foi exatamente o problema. */
export function recordGroupAnswer(result) {
  const s = getState();
  const g = s.groupPractice[result.verbId] || emptyGroupEntry();

  g.seen += 1;
  g.lastSeenAt = Date.now();
  if (result.dontKnow) { g.dontKnow += 1; g.streak = 0; }
  else if (result.correct) { g.right += 1; g.streak += 1; }
  else { g.wrong += 1; g.streak = 0; }
  if (result.hinted) g.hinted += 1;

  s.groupPractice[result.verbId] = g;
  s.lastPracticedAt = Date.now();

  if (!result.correct) pushRecentError(s, result);
  save();
  return g;
}

export function recordSession(summary) {
  const s = getState();
  s.sessions.unshift({ at: Date.now(), ...summary });
  s.sessions = s.sessions.slice(0, MAX_SESSIONS);
  save();
}

export function setResume(resume) {
  const s = getState();
  s.resume = resume;
  save();
}

export function clearResume() { setResume(null); }

export function updateSettings(patch) {
  const s = getState();
  s.settings = { ...s.settings, ...patch };
  save();
}

/* -------------------------------------------------------------------
   Estatísticas (§34, §35, §37)
   ------------------------------------------------------------------- */
function pct(right, seen) { return seen ? Math.round((right / seen) * 100) : null; }

export function statsByForm() {
  const s = getState();
  const acc = {};
  for (const f of FORMS) acc[f] = { seen: 0, right: 0 };
  for (const [key, p] of conjugationEntries(s)) {
    const { form } = parsePair(key);
    acc[form].seen += p.seen;
    acc[form].right += p.right;
  }
  for (const f of FORMS) acc[f].pct = pct(acc[f].right, acc[f].seen);
  return acc;
}

/* Desempenho das CONJUGAÇÕES feitas com verbos de cada grupo. Uma
   pergunta "のみます é qual grupo?" não entra aqui: ela mede outra
   habilidade, e fica em groupQuizStats(). */
export function statsByGroup() {
  const s = getState();
  const acc = { 1: { seen: 0, right: 0 }, 2: { seen: 0, right: 0 }, 3: { seen: 0, right: 0 } };
  for (const [key, p] of conjugationEntries(s)) {
    const { verb } = parsePair(key);
    if (!acc[verb.group]) continue;
    acc[verb.group].seen += p.seen;
    acc[verb.group].right += p.right;
  }
  for (const g of [1, 2, 3]) acc[g].pct = pct(acc[g].right, acc[g].seen);
  return acc;
}

/* Desempenho do modo "Treinar grupos", medido à parte. */
export function groupQuizStats() {
  const s = getState();
  let seen = 0, right = 0;
  let verbs = 0;
  for (const [verbId, g] of Object.entries(s.groupPractice)) {
    if (!verbById(verbId) || !g.seen) continue;
    seen += g.seen;
    right += g.right;
    verbs += 1;
  }
  return { seen, right, verbs, total: VERBS.length, pct: pct(right, seen) };
}

export function statsByVerb() {
  const s = getState();
  const acc = {};
  for (const v of VERBS) acc[v.id] = { seen: 0, right: 0, verb: v };
  for (const [key, p] of conjugationEntries(s)) {
    const { verbId } = parsePair(key);
    acc[verbId].seen += p.seen;
    acc[verbId].right += p.right;
  }
  for (const id of Object.keys(acc)) acc[id].pct = pct(acc[id].right, acc[id].seen);
  return acc;
}

/* Pares que mais merecem revisão: erro recente e domínio baixo primeiro.
   Só conjugação — identificar grupo nunca aparece em Pontos fracos. */
export function weakPairs(limit = 12) {
  const s = getState();
  const rows = [];
  for (const [key, p] of conjugationEntries(s)) {
    const { verbId, form, verb } = parsePair(key);
    if (!p.seen) continue;
    const accuracy = p.right / p.seen;
    /* Peso: erra muito, domínio baixo, e não foi visto há tempo. */
    const masteryWeight = { new: 3, learning: 3, almost: 1.5, mastered: 0.2 }[p.mastery] || 1;
    const score = (1 - accuracy) * masteryWeight * (1 + Math.min(p.wrong + p.dontKnow, 5) * 0.2);
    if (score <= 0) continue;
    rows.push({ key, verbId, form, verb, pair: p, score, accuracy });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, limit);
}

/* Matriz de domínio (§35). */
export function masteryMatrix() {
  const s = getState();
  return VERBS.map(v => {
    const cells = {};
    for (const f of FORMS) {
      if ((v.notTaught || []).includes(f)) { cells[f] = null; continue; }
      cells[f] = s.pairs[pairKey(v.id, f)]?.mastery || MASTERY.NEW;
    }
    return { verb: v, cells };
  });
}

/* Universo fechado de conjugação: as combinações verbo × forma que o
   Rikai sustenta. Nada fora daqui pode ser contado como praticado ou
   dominado — é o que garante "N de N" (N = TRAINABLE_COMBOS), nunca um total inflado. */
export const TRAINABLE_COMBOS = VERBS.reduce(
  (n, v) => n + FORMS.filter(f => !(v.notTaught || []).includes(f)).length, 0
);

export function overallCounts() {
  const s = getState();
  let seen = 0, right = 0, wrong = 0, dontKnow = 0, hinted = 0;
  let practiced = 0, mastered = 0;

  for (const [, p] of conjugationEntries(s)) {
    seen += p.seen; right += p.right; wrong += p.wrong;
    dontKnow += p.dontKnow; hinted += p.hinted;
    if (p.seen > 0) practiced += 1;
    if (p.mastery === MASTERY.MASTERED) mastered += 1;
  }

  return {
    seen, right, wrong, dontKnow, hinted,
    trainable: TRAINABLE_COMBOS,
    practiced,
    mastered
  };
}
