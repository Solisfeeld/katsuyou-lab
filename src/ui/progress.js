/* ===================================================================
   活用ラボ — progresso, pontos fracos e matriz de domínio (§34, §35, §37)
   =================================================================== */

import { h, formVars, backRow } from './dom.js';
import { FORMS, FORM_LABEL, FORM_SHORT, GROUP_LABEL } from '../conjugation/rules.js';
import {
  statsByForm, statsByGroup, groupQuizStats, weakPairs, masteryMatrix, overallCounts,
  MASTERY_MARK, MASTERY_LABEL, getState, GROUP_QUIZ
} from '../progress/store.js';

export function renderProgress(app) {
  const root = h('div', { class: 'wrap' });
  const counts = overallCounts();

  root.appendChild(h('h1', { class: 'page-title', text: 'Progresso' }));
  root.appendChild(h('p', {
    class: 'page-sub',
    text: counts.seen
      ? `${counts.seen} respostas · ${counts.practiced} de ${counts.trainable} combinações já praticadas.`
      : 'Nenhuma resposta registrada ainda.'
  }));

  if (!counts.seen) {
    root.appendChild(h('div', { class: 'card pad' },
      h('p', { class: 'empty', text: 'Faça uma sessão para começar a medir.' }),
      h('button', { class: 'btn btn-primary btn-block', onclick: () => app.go('setup', { mode: 'mixed' }) }, 'Sessão mista')
    ));
    root.appendChild(backRow(app));
    return root;
  }

  /* ---- por forma ---- */
  const byForm = statsByForm();
  const fCard = h('div', { class: 'card pad', style: { marginBottom: '12px' } });
  fCard.appendChild(h('h2', { style: { fontSize: '15px', marginBottom: '8px' }, text: 'Por forma' }));
  FORMS.forEach(f => {
    const st = byForm[f];
    fCard.appendChild(statRow(FORM_LABEL[f], st.pct, st.seen, formVars(f)));
  });
  root.appendChild(fCard);

  /* ---- por grupo ---- */
  const byGroup = statsByGroup();
  const gCard = h('div', { class: 'card pad', style: { marginBottom: '12px' } });
  gCard.appendChild(h('h2', { style: { fontSize: '15px', marginBottom: '4px' }, text: 'Por grupo' }));
  gCard.appendChild(h('p', {
    class: 'small muted', style: { margin: '0 0 8px' },
    text: 'Desempenho das conjugações feitas com verbos de cada grupo.'
  }));
  [1, 2, 3].forEach(g => {
    const st = byGroup[g];
    gCard.appendChild(statRow(GROUP_LABEL[g], st.pct, st.seen, {}));
  });

  /* Identificar o grupo é outra habilidade — medida à parte e de forma
     discreta, para não se confundir com a linha acima. */
  const quiz = groupQuizStats();
  if (quiz.seen) {
    gCard.appendChild(h('p', {
      class: 'src-line', style: { marginTop: '12px' },
      text: `Treino de grupos (identificação): ${quiz.pct}% em ${quiz.seen} ${quiz.seen === 1 ? 'resposta' : 'respostas'} · ${quiz.verbs} de ${quiz.total} verbos vistos.`
    }));
  }
  root.appendChild(gCard);

  /* ---- revisar ---- */
  const weak = weakPairs(8);
  if (weak.length) {
    const wCard = h('div', { class: 'card pad', style: { marginBottom: '12px' } });
    wCard.appendChild(h('h2', { style: { fontSize: '15px', marginBottom: '4px' }, text: 'Revisar' }));
    wCard.appendChild(h('p', { class: 'small muted', style: { margin: '0 0 10px' }, text: 'As combinações em que você mais tropeça.' }));
    weak.forEach(w => {
      wCard.appendChild(h('p', { style: { margin: '0 0 6px', fontSize: '14.5px' } },
        h('span', { class: 'jp', text: w.verb.masu }),
        h('span', { class: 'muted', text: ' × ' }),
        h('span', { style: { color: `var(--f-${w.form})`, fontWeight: '700' }, text: FORM_SHORT[w.form] }),
        h('span', { class: 'muted small', text: `  ${w.pair.right}/${w.pair.seen}` })
      ));
    });
    wCard.appendChild(h('button', {
      class: 'btn btn-primary btn-block',
      style: { marginTop: '12px' },
      onclick: () => app.startSession({
        mode: 'weak', limitKind: 'count', length: Math.min(20, weak.length * 2)
      })
    }, 'Treinar pontos fracos'));
    root.appendChild(wCard);
  }

  /* ---- matriz ---- */
  root.appendChild(matrixCard());
  root.appendChild(backRow(app));

  return root;
}

function statRow(name, pct, seen, vars) {
  return h('div', { class: 'stat-row', style: vars },
    h('span', { class: 'stat-name', text: name }),
    h('div', { class: 'stat-bar' }, h('i', { style: { width: `${pct ?? 0}%` } })),
    h('span', { class: 'stat-val', text: seen ? `${pct}%` : '—' })
  );
}

function matrixCard() {
  const card = h('div', { class: 'card pad' });
  card.appendChild(h('h2', { style: { fontSize: '15px', marginBottom: '4px' }, text: 'Matriz de domínio' }));
  card.appendChild(h('p', { class: 'small muted', style: { margin: '0 0 6px' } },
    h('span', { class: 'cell mastered', text: '✓' }), ' dominado  ',
    h('span', { class: 'cell almost', text: '△' }), ' quase firme  ',
    h('span', { class: 'cell learning', text: '✗' }), ' aprendendo  ',
    h('span', { class: 'cell new', text: '·' }), ' não praticado'
  ));

  const scroll = h('div', { class: 'matrix-scroll' });
  const table = h('table', { class: 'matrix' });

  const thead = h('thead');
  const hr = h('tr');
  hr.appendChild(h('th', { text: 'Verbo' }));
  FORMS.forEach(f => hr.appendChild(h('th', { style: { color: `var(--f-${f})` }, text: FORM_SHORT[f] })));
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = h('tbody');
  masteryMatrix().forEach(row => {
    const tr = h('tr');
    tr.appendChild(h('th', { scope: 'row' },
      h('span', { class: 'jp', text: row.verb.masu }),
      h('span', { class: 'muted small', text: `  ${row.verb.meaning}` })
    ));
    FORMS.forEach(f => {
      const m = row.cells[f];
      const td = h('td');
      if (m === null) {
        td.appendChild(h('span', {
          class: 'cell off',
          title: 'Forma não ensinada pelo Rikai para este verbo',
          'aria-label': 'não ensinada',
          text: '–'
        }));
      } else {
        td.appendChild(h('span', {
          class: `cell ${m}`,
          title: `${FORM_LABEL[f]}: ${MASTERY_LABEL[m]}`,
          'aria-label': MASTERY_LABEL[m],
          text: MASTERY_MARK[m]
        }));
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  card.appendChild(scroll);
  return card;
}

/* ===================================================================
   Erros recentes (§36)
   =================================================================== */
export function renderErrors(app) {
  const s = getState();
  const root = h('div', { class: 'wrap' });
  root.appendChild(h('h1', { class: 'page-title', text: 'Erros recentes' }));

  const errors = s.recentErrors || [];
  if (!errors.length) {
    root.appendChild(h('p', { class: 'page-sub', text: 'Nada registrado ainda.' }));
    root.appendChild(h('div', { class: 'card pad' },
      h('p', { class: 'empty', text: 'Os erros aparecem aqui com o que você digitou e o motivo.' })
    ));
    root.appendChild(backRow(app));
    return root;
  }

  root.appendChild(h('p', { class: 'page-sub', text: `${errors.length} ${errors.length === 1 ? 'registro' : 'registros'}, do mais recente ao mais antigo.` }));

  let lastDay = null;
  errors.forEach(e => {
    const day = dayLabel(e.at);
    if (day !== lastDay) {
      lastDay = day;
      root.appendChild(h('h2', {
        style: { fontSize: '12px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', margin: '18px 0 9px' },
        text: day
      }));
    }
    const item = h('div', { class: 'err-item' });
    item.appendChild(h('div', { class: 'err-head' },
      h('span', { class: 'jp', text: e.masu }),
      h('span', { class: 'muted', text: '→' }),
      /* Um erro de identificação de grupo não é o erro de uma forma
         verbal, e a lista precisa dizer isso sem ambiguidade. */
      e.form === GROUP_QUIZ
        ? h('span', { class: 'tag', text: 'Treino de grupos' })
        : h('span', { style: { color: `var(--f-${e.form})` }, text: FORM_LABEL[e.form] }),
      h('span', { class: 'muted small', style: { fontWeight: '400' }, text: e.meaning })
    ));

    const dl = h('dl', { class: 'err-grid' });
    dl.appendChild(h('dt', { text: e.dontKnow ? 'Você' : 'Você' }));
    dl.appendChild(h('dd', { class: e.dontKnow ? 'muted' : 'wrong', text: e.dontKnow ? '(não sei)' : (e.given || '—') }));
    dl.appendChild(h('dt', { text: 'Correto' }));
    dl.appendChild(h('dd', { class: 'right', text: e.correct || '—' }));
    item.appendChild(dl);

    if (e.reason) item.appendChild(h('p', { class: 'err-reason', text: `Motivo: ${e.reason}` }));

    item.appendChild(h('button', {
      class: 'btn-link',
      onclick: () => app.startSession({
        mode: 'review',
        queue: [{ verbId: e.verbId, form: e.form }],
        limitKind: 'count',
        length: 1
      })
    }, e.form === GROUP_QUIZ ? 'Treinar este verbo' : 'Treinar esta combinação'));

    root.appendChild(item);
  });

  const ids = [];
  const seen = new Set();
  errors.forEach(e => {
    const k = `${e.verbId}|${e.form}`;
    if (!seen.has(k)) { seen.add(k); ids.push({ verbId: e.verbId, form: e.form }); }
  });
  root.appendChild(h('button', {
    class: 'btn btn-primary btn-block btn-lg',
    style: { marginTop: '16px' },
    onclick: () => app.startSession({ mode: 'review', queue: ids.slice(0, 20), limitKind: 'count', length: Math.min(20, ids.length) })
  }, 'Revisar todos'));
  root.appendChild(backRow(app));

  return root;
}

function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  if (same) return 'Hoje';
  const y = new Date(today.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}
