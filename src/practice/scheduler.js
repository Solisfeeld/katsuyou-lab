/* ===================================================================
   活用ラボ — seleção e reapresentação de itens.

   §31: misturar verbos, grupos e formas, evitando sequências previsíveis.
   §32: não repetir o mesmo verbo sem necessidade.
   §33: item errado volta depois de 3–7 outras questões, nunca na hora.
   =================================================================== */

import { VERBS, verbById } from '../data/verbs.js';
import { FORMS } from '../conjugation/rules.js';
import { getPair, MASTERY, weakPairs } from '../progress/store.js';

export const REQUEUE_MIN = 3;
export const REQUEUE_MAX = 7;

/* Todos os pares verbo × forma treináveis. */
export function allPairs({ forms = FORMS, groups = [1, 2, 3] } = {}) {
  const out = [];
  for (const v of VERBS) {
    if (!groups.includes(v.group)) continue;
    for (const f of forms) {
      if ((v.notTaught || []).includes(f)) continue;
      out.push({ verbId: v.id, form: f, verb: v });
    }
  }
  return out;
}

function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Peso de sorteio: o que está fraco ou nunca foi visto sai mais vezes,
   o que está dominado continua aparecendo, só que raramente. */
function weightOf(p) {
  const base = { new: 3, learning: 4, almost: 2, mastered: 0.6 }[p.mastery] ?? 2;
  const errorBoost = 1 + Math.min(p.wrong + p.dontKnow, 4) * 0.25;
  return base * errorBoost;
}

function pickWeighted(pool, rand) {
  const total = pool.reduce((s, x) => s + x.__w, 0);
  let r = rand() * total;
  for (const x of pool) { r -= x.__w; if (r <= 0) return x; }
  return pool[pool.length - 1];
}

/**
 * Monta a fila de uma sessão.
 *   mode: 'mixed' | 'form' | 'group' | 'weak' | 'verb'
 * Evita repetir o mesmo verbo em janela curta e nunca repete o mesmo
 * par verbo × forma dentro da fila inicial.
 */
export function buildQueue({
  mode = 'mixed', forms = FORMS, groups = [1, 2, 3], length = 20, rand = Math.random
} = {}) {
  let pool;

  if (mode === 'weak') {
    const weak = weakPairs(60).map(r => ({ verbId: r.verbId, form: r.form, verb: r.verb }));
    /* Se ainda não há erro suficiente registrado, completa com o resto. */
    pool = weak.length >= 5 ? weak : [...weak, ...allPairs({ forms, groups })];
  } else {
    pool = allPairs({ forms, groups });
  }

  /* Deduplica preservando a ordem de prioridade de 'weak'. */
  const seen = new Set();
  pool = pool.filter(x => {
    const k = `${x.verbId}|${x.form}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (!pool.length) return [];

  const weighted = pool.map(x => ({ ...x, __w: weightOf(getPair(x.verbId, x.form)) }));
  const target = Math.min(length, pool.length);
  const queue = [];
  const used = new Set();
  /* Janela de verbos recentes: com poucos verbos disponíveis a janela
     encolhe sozinha, senão a fila não fecharia. */
  const verbWindow = Math.min(4, Math.max(1, Math.floor(new Set(pool.map(p => p.verbId)).size / 3)));
  const recentVerbs = [];
  const recentForms = [];

  let guard = 0;
  while (queue.length < target && guard < target * 60) {
    guard++;
    const avail = weighted.filter(x => !used.has(`${x.verbId}|${x.form}`));
    if (!avail.length) break;

    /* Preferência: não repetir verbo recente nem a mesma forma duas vezes
       seguidas (§31 — evitar sequências previsíveis). */
    let candidates = avail.filter(
      x => !recentVerbs.slice(-verbWindow).includes(x.verbId) &&
           recentForms.slice(-1)[0] !== x.form
    );
    if (!candidates.length) candidates = avail.filter(x => !recentVerbs.slice(-verbWindow).includes(x.verbId));
    if (!candidates.length) candidates = avail;

    const chosen = pickWeighted(candidates, rand);
    used.add(`${chosen.verbId}|${chosen.form}`);
    queue.push({ verbId: chosen.verbId, form: chosen.form });
    recentVerbs.push(chosen.verbId);
    recentForms.push(chosen.form);
  }

  return queue;
}

/**
 * Reinsere um item errado mais adiante na fila (§28, §33).
 * `queue` é o restante da fila (itens ainda não respondidos).
 * Devolve uma NOVA fila.
 */
export function requeue(queue, item, rand = Math.random) {
  const gap = REQUEUE_MIN + Math.floor(rand() * (REQUEUE_MAX - REQUEUE_MIN + 1));
  const next = queue.slice();
  /* Se a fila é mais curta que o intervalo, o item vai para o fim: ainda
     assim não reaparece imediatamente, que é a regra que importa. */
  const at = Math.min(gap, next.length);
  next.splice(at, 0, { ...item, requeued: true });
  return next;
}

/* Sorteia um par para o modo "treinar grupos" (§14): a pergunta é o
   grupo, então não há forma-alvo. */
export function buildGroupQueue({ groups = [1, 2, 3], length = 20, rand = Math.random } = {}) {
  const pool = VERBS.filter(v => groups.includes(v.group));
  if (!pool.length) return [];
  const order = shuffle(pool, rand);
  const out = [];
  let i = 0;
  while (out.length < Math.min(length, pool.length * 3)) {
    if (i >= order.length) { i = 0; }
    out.push({ verbId: order[i].id, form: 'group' });
    i++;
    if (out.length >= length) break;
  }
  return out.slice(0, length);
}

export { shuffle };
