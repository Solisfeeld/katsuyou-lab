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

/* -------------------------------------------------------------------
   Progressão compatível com estudo SEMANAL.

   Antes: sorteio ponderado sobre os 286 pares, com peso 4× para quem estava
   “aprendendo” multiplicado pelos erros acumulados (que nunca expiravam), e
   nenhuma noção de tempo. Para quem estuda uma vez por semana, a fila se
   enchia dos mesmos pares antigos e os inéditos demoravam a aparecer.

   Agora cada par cai em um de quatro grupos, e a fila é montada por COTA:
     new  — nunca praticado ............................ 35%
     weak — aprendendo (errou e ainda não firmou) ........ 30%
     due  — firme, mas o intervalo de revisão venceu ..... 25%
     keep — firme, já na 2ª metade do intervalo ......... 10%
   A fatia de inéditos é ADAPTATIVA: com muitos pares em aprendizado, ela
   encolhe (35% → 25% → 12%) e a sobra vai para consolidar o que já começou —
   abrir pares novos sem firmar os antigos só acumularia pendências.
   O intervalo é medido em DIAS reais desde a última vez (não em sessões):
   quase firme 2 dias; dominado 7 → 14 → 28 → 56 dias conforme a sequência.
   Uma semana sem abrir o app não “acumula atraso”: o que venceu entra na
   cota de revisão, e o resto da sessão continua avançando. Grupo vazio cede
   a vaga aos outros.
   ------------------------------------------------------------------- */
export const QUEUE_MIX = { new: 0.35, weak: 0.30, due: 0.25, keep: 0.10 };
/* cota efetiva desta sessão, a partir do número de pares em aprendizado */
export function queueMix(learningCount, length) {
  const ns = learningCount <= 1.5 * length ? QUEUE_MIX.new : learningCount <= 3 * length ? 0.25 : 0.12;
  return { new: ns, weak: 1 - ns - QUEUE_MIX.due - QUEUE_MIX.keep + 0.05, due: QUEUE_MIX.due - 0.05, keep: QUEUE_MIX.keep };
}
const DAY = 86_400_000;

export function reviewIntervalDays(p) {
  if (p.mastery === MASTERY.ALMOST) return 2;
  if (p.mastery === MASTERY.MASTERED) return 7 * 2 ** Math.min(Math.max((p.streak || 3) - 3, 0), 3);
  return 0;
}

export function pairCategory(p, now = Date.now()) {
  if (!p || !p.seen) return 'new';
  if (p.mastery !== MASTERY.ALMOST && p.mastery !== MASTERY.MASTERED) return 'weak';
  const ago = now - (p.lastSeenAt || 0);
  return ago >= reviewIntervalDays(p) * DAY ? 'due' : 'keep';
}

function buildMixQueue(pool, length, rand) {
  const now = Date.now();
  const cats = { new: [], weak: [], due: [], keep: [] };
  /* Firmes que ainda estão na PRIMEIRA metade do intervalo não disputam a
     cota de manutenção: com poucos pares nesse estado, a cota de 10% os
     trazia toda semana (um par dominado, com intervalo de 56 dias, aparecia
     em 12 sessões seguidas). Ficam como reserva, usada só se faltar o resto. */
  const spare = [];
  /* uso por verbo: os inéditos começam pelos verbos menos praticados */
  const verbSeen = {};
  for (const x of pool) {
    const p = getPair(x.verbId, x.form);
    verbSeen[x.verbId] = (verbSeen[x.verbId] || 0) + (p.seen || 0);
  }
  for (const x of pool) {
    const p = getPair(x.verbId, x.form);
    const c = pairCategory(p, now);
    let k;
    if (c === 'new') k = -verbSeen[x.verbId] * 0.05 + rand() * 2;
    else if (c === 'weak') {
      /* primeiro quem está a UM acerto de firmar (acertou da última vez) e
         não foi visto hoje; depois os erros. A exposição acumulada pesa
         contra, para que os mesmos pares difíceis não ocupem toda sessão. */
      const ago = now - (p.lastSeenAt || 0);
      k = (p.streak >= 1 ? 1.2 : 0.6) + (ago >= DAY ? 0.6 : 0) - Math.min(p.seen || 0, 12) * 0.06 + rand() * 0.9;
    } else if (c === 'due') {
      const over = (now - (p.lastSeenAt || 0)) / (Math.max(1, reviewIntervalDays(p)) * DAY);
      k = Math.min(over, 4) + rand() * 0.8;
    } else {
      const frac = (now - (p.lastSeenAt || 0)) / (Math.max(1, reviewIntervalDays(p)) * DAY);
      k = frac + rand() * 0.3;
      if (frac < 0.5) { spare.push({ ...x, __k: k }); continue; }
    }
    cats[c].push({ ...x, __k: k });
  }
  for (const c of Object.keys(cats)) cats[c].sort((a, b) => b.__k - a.__k);
  spare.sort((a, b) => b.__k - a.__k);

  const target = Math.min(length, pool.length);
  const queue = [];
  const got = { new: 0, weak: 0, due: 0, keep: 0 };
  const MIX = queueMix(cats.weak.length, target);
  const verbWindow = Math.min(4, Math.max(1, Math.floor(new Set(pool.map(p => p.verbId)).size / 3)));
  const recentVerbs = [];
  let lastForm = null;
  const order = ['new', 'weak', 'due', 'keep'];

  while (queue.length < target) {
    /* grupo mais abaixo da sua cota; grupos vazios saem da disputa */
    const live = order.filter(c => cats[c].length);
    if (!live.length) {
      /* só a reserva sobrou: completa a fila com os mais perto de vencer */
      if (!spare.length) break;
      cats.keep.push(spare.shift());
      continue;
    }
    live.sort((a, b) => (got[a] / (queue.length + 1) - MIX[a]) - (got[b] / (queue.length + 1) - MIX[b]));
    const c = live[0];
    const list = cats[c];
    /* variedade (§31): evita verbo recente e a mesma forma em sequência,
       relaxando só se não houver alternativa no grupo */
    let i = list.findIndex(x => !recentVerbs.slice(-verbWindow).includes(x.verbId) && x.form !== lastForm);
    if (i < 0) i = list.findIndex(x => !recentVerbs.slice(-verbWindow).includes(x.verbId));
    if (i < 0) i = 0;
    const chosen = list.splice(i, 1)[0];
    got[c] += 1;
    queue.push({ verbId: chosen.verbId, form: chosen.form });
    recentVerbs.push(chosen.verbId);
    lastForm = chosen.form;
  }
  return queue;
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

  if (mode !== 'weak') {
    const all = allPairs({ forms, groups });
    if (!all.length) return [];
    return buildMixQueue(all, length, rand);
  }

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
  const next = queue.slice();
  /* Sem nenhum outro item na fila, reapresentar seria IMEDIATO: não
     reenfileira. O erro já está registrado e volta nas próximas sessões. */
  if (!next.length) return next;
  /* Posição sorteada entre REQUEUE_MIN e REQUEUE_MAX itens à frente. Numa
     fila mais curta que isso, vai para o fim — ainda com outra questão no
     meio, nunca a próxima. */
  const gap = REQUEUE_MIN + Math.floor(rand() * (REQUEUE_MAX - REQUEUE_MIN + 1));
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
