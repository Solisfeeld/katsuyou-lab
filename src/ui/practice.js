/* ===================================================================
   活用ラボ — tela de exercício e de feedback (§18–§24, §28, §29, §40).

   O ritmo é o requisito principal: japonês grande, campo focado, Enter
   responde, Enter de novo avança. O feedback de erro é longo de
   propósito; o de acerto é curto de propósito.
   =================================================================== */

import { h, formVars } from './dom.js';
import { FORM_SHORT, FORM_LABEL, GROUP_LABEL } from '../conjugation/rules.js';
import { getState } from '../progress/store.js';

export function renderPractice(app, session) {
  const root = h('div', { class: 'wrap' });

  /* Sem pergunta corrente, a tela é sempre a de resultado. Atingir a
     meta de tempo NÃO leva a sessão a esse estado: só `next()` leva, e
     só depois que a questão aberta foi concluída. */
  if (!session.current || session.phase === 'done') {
    return renderEnd(app, session);
  }

  root.appendChild(sessionBar(app, session));

  const cur = session.current;
  const res = session.lastResult;
  const settings = getState().settings;

  const card = h('div', { class: 'qcard' });

  /* ---- pergunta ---- */
  card.appendChild(h('p', { class: 'q-prompt mincho', text: cur.prompt }));
  card.appendChild(h('p', { class: 'q-meaning', text: cur.meaning }));

  const ask = h('div', { class: 'q-ask' });
  if (cur.isGroupQuestion) {
    ask.appendChild(h('div', { class: 'lbl', text: 'Pergunta' }));
    ask.appendChild(h('div', { class: 'val', style: { '--wash': 'var(--card-2)', '--fc': 'var(--ink)' }, text: 'Qual é o grupo?' }));
  } else {
    ask.appendChild(h('div', { class: 'lbl', text: 'Forma pedida' }));
    ask.appendChild(h('div', { class: 'val', style: formVars(cur.form), text: FORM_LABEL[cur.form] }));
  }
  card.appendChild(ask);

  /* §14 — o grupo pode ser escondido durante o exercício. */
  if (!cur.isGroupQuestion && !settings.hideGroup) {
    card.appendChild(h('p', { class: 'q-group', text: GROUP_LABEL[cur.verb.group] }));
  }

  /* ---- resposta ---- */
  if (session.phase === 'asking') {
    card.appendChild(askingBlock(app, session, cur));
  } else {
    card.appendChild(feedbackBlock(app, session, res));
  }

  root.appendChild(card);

  root.appendChild(h('div', { class: 'row row-end', style: { marginTop: '14px' } },
    h('button', {
      class: 'btn-link',
      onclick: () => app.endSession(session)
    }, 'Encerrar sessão')
  ));

  return root;
}

/* ------------------------------------------------------------------ */
/* `mode` decide o arredondamento: a contagem regressiva arredonda para
   cima (0,2 s restantes ainda mostram 0:01), e a contagem crescente do
   tempo extra arredonda para baixo — como o clockPulse do Bunpou Lab —
   para que o overtime comece em +0:00 e não salte um segundo. */
function clock(ms, mode = 'down') {
  const total = Math.max(0, mode === 'up' ? Math.floor(ms / 1000) : Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function sessionBar(app, session) {
  const byTime = session.config.limitKind === 'time';
  const rail = h('div', { class: 'progress-rail' });
  const fill = h('i');
  const label = h('span', { class: 'session-count' });
  rail.appendChild(fill);

  /* Repinta SÓ o mostrador e a barra. Nunca reconstrói o exercício: o
     que o usuário já digitou tem de continuar no input. */
  const paint = () => {
    if (byTime) {
      const over = session.plannedTimeReached;
      /* Passada a meta, o relógio conta o tempo EXTRA para cima. Nada de
         congelar em 0:00 nem de mostrar número negativo. */
      label.textContent = over
        ? `+${clock(session.overtimeMs, 'up')}`
        : clock(session.remainingMs);
      fill.style.width = over
        ? '100%'
        : `${Math.min(100, ((session.plannedMs - session.remainingMs) / session.plannedMs) * 100)}%`;
      label.classList.toggle('over', over);
      rail.classList.toggle('over', over);
      fill.classList.toggle('over', over);
    } else {
      const total = session.answered + session.remaining + (session.current ? 1 : 0);
      fill.style.width = `${total ? (session.answered / total) * 100 : 0}%`;
      label.textContent = `${session.answered} / ${total}`;
    }
  };
  paint();

  /* O intervalo existe apenas para animar o mostrador — como o
     clockPulse do Bunpou Lab. Ele NUNCA encerra a sessão nem toca na
     questão aberta; tudo é recalculado por tempo absoluto, então voltar
     do background já mostra o overtime certo. */
  if (byTime) {
    const id = setInterval(paint, 1000);
    app.onNextRender(() => clearInterval(id));
  }

  return h('div', { class: 'session-bar' }, rail, label);
}

/* ------------------------------------------------------------------ */
function askingBlock(app, session, cur) {
  const box = h('div');

  if (cur.isGroupQuestion) {
    const chips = h('div', { class: 'chipset', style: { justifyContent: 'center', marginTop: '22px' } },
      [1, 2, 3].map(g => h('button', {
        class: 'btn btn-lg',
        style: { flex: '1 1 30%' },
        onclick: () => { session.submit(String(g)); app.render(); }
      }, `Grupo ${g}`))
    );
    box.appendChild(chips);
  } else {
    const input = h('input', {
      class: 'answer mincho',
      type: 'text',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      lang: 'ja',
      inputmode: 'text',
      enterkeyhint: 'send',
      'aria-label': `Escreva a ${FORM_LABEL[cur.form]} de ${cur.prompt}`,
      placeholder: 'resposta em japonês',
      onkeydown: e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          /* O IME japonês usa Enter para confirmar a conversão; só
             enviamos quando a composição já terminou. */
          if (e.isComposing || e.keyCode === 229) return;
          submit();
        }
      }
    });
    box.appendChild(input);

    const submit = () => {
      const val = input.value;
      if (!val.trim()) { input.focus(); return; }
      session.submit(val);
      app.render();
    };

    box.appendChild(h('div', { class: 'q-actions' },
      h('button', { class: 'btn btn-primary btn-lg btn-block', onclick: submit }, 'Responder')
    ));

    /* Foco automático (§40), sem rolar a página no celular. */
    queueMicrotask(() => { try { input.focus({ preventScroll: true }); } catch { input.focus(); } });
  }

  /* dicas já reveladas */
  session.shownHints.forEach((t, i) => {
    box.appendChild(h('div', { class: 'hint' },
      h('b', { text: `Dica ${i + 1}` }),
      h('span', { text: t })
    ));
  });

  const help = h('div', { class: 'q-help' });
  const hintsLeft = session.availableHints().length - session.hintsShown;
  if (hintsLeft > 0) {
    help.appendChild(h('button', {
      class: 'btn-link',
      onclick: () => { session.revealHint(); app.render(); }
    }, session.hintsShown === 0 ? 'Preciso de uma dica' : 'Mais uma dica'));
  }
  help.appendChild(h('button', {
    class: 'btn-link',
    onclick: () => { session.dontKnow(); app.render(); }
  }, 'Não sei'));
  box.appendChild(help);

  return box;
}

/* ------------------------------------------------------------------ */
function feedbackBlock(app, session, res) {
  const box = h('div');
  const ok = res.correct;
  const fb = h('div', { class: `fb ${ok ? 'ok' : 'bad'}` });

  /* ---- cabeçalho ---- */
  const head = h('div', { class: 'fb-head' });
  head.appendChild(h('span', { text: ok ? '✓ Correto' : '✗ Ainda não' }));
  if (ok && res.hinted) head.appendChild(h('span', { class: 'tag', text: 'com dica' }));
  if (res.dontKnow) head.appendChild(h('span', { class: 'tag', text: 'não sei' }));
  fb.appendChild(head);

  /* ---- resposta ---- */
  if (res.form === 'group') {
    fb.appendChild(h('p', { class: 'fb-answer' },
      h('span', { text: res.verb.masu }),
      h('span', { class: 'arrow', text: '→' }),
      h('span', { text: GROUP_LABEL[res.groupAnswer] })
    ));
  } else {
    fb.appendChild(h('p', { class: 'fb-answer' },
      h('span', { text: res.verb.masu }),
      h('span', { class: 'arrow', text: '→' }),
      h('span', { text: res.explanation.answer })
    ));
  }

  /* ---- acerto: curto, para não quebrar o ritmo (§19) ---- */
  if (ok) {
    const settings = getState().settings;
    if (settings.hideGroup && res.form !== 'group') {
      fb.appendChild(h('p', { class: 'src-line', text: GROUP_LABEL[res.verb.group] }));
    } else if (res.form !== 'group') {
      fb.appendChild(h('p', { class: 'src-line', text: GROUP_LABEL[res.verb.group] }));
    }
  } else {
    /* ---- erro: diagnóstico + caminho completo (§20–§24) ---- */
    fb.appendChild(h('p', { class: 'tag', text: GROUP_LABEL[res.verb.group], style: { marginTop: '10px' } }));

    if (res.diagnosis) {
      fb.appendChild(h('p', { class: 'fb-diag' },
        h('span', { class: 'lead', text: res.diagnosis.message }),
        res.diagnosis.detail ? h('span', { class: 'det', text: res.diagnosis.detail }) : null
      ));
    }

    if (res.explanation) fb.appendChild(explanationBlock(res.explanation));
    else if (res.form === 'group') {
      fb.appendChild(h('div', { class: 'rule-line', text: groupRuleLine(res.verb) }));
      fb.appendChild(h('p', { class: 'src-line', text: 'Básico Rikai · Lição 01' }));
    }
  }

  box.appendChild(fb);

  /* ---- avançar ---- */
  /* Com a meta atingida não há próxima pergunta, mesmo que a fila tenha
     itens: a fila está congelada e o botão precisa dizer a verdade. */
  const last = session.remaining === 0 || session.plannedTimeReached;
  const advance = () => {
    if (last) { app.endSession(session); return; }
    session.next();
    app.render();
  };
  box.appendChild(h('div', { class: 'q-actions' },
    h('button', {
      class: 'btn btn-primary btn-lg btn-block',
      onclick: advance
    }, last ? 'Ver resultado' : 'Próxima')
  ));

  /* §40 — depois do feedback, Enter avança. */
  const onKey = e => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      e.preventDefault();
      document.removeEventListener('keydown', onKey);
      advance();
    }
  };
  document.addEventListener('keydown', onKey);
  app.onNextRender(() => document.removeEventListener('keydown', onKey));

  return box;
}

/* ------------------------------------------------------------------ */
export function explanationBlock(ex) {
  const box = h('div');

  const steps = h('div', { class: 'steps' });
  steps.appendChild(h('div', { class: 'cap', text: 'Como chegar' }));
  for (const s of ex.steps) {
    if (s.note) steps.appendChild(h('div', { class: 'step-note', text: s.note }));
    if (s.value) steps.appendChild(h('div', { class: 'step-val mincho', text: s.value }));
  }
  box.appendChild(steps);

  box.appendChild(h('div', { class: 'rule-line', text: `Regra: ${ex.rule}` }));

  /* Quando a exceção JÁ É a regra do verbo (いきます), repetir a mesma
     frase em duas caixas só ocupa espaço. */
  if (ex.exception && ex.exception.rule !== ex.rule) {
    box.appendChild(h('div', { class: 'exc-line', text: `Atenção: ${ex.exception.rule}` }));
  }

  /* §24 — deixar explícita a relação て → た. */
  if (ex.relation) {
    box.appendChild(h('p', { class: 'rel-line' },
      'Mesma base da forma て: ',
      h('span', { class: 'jp', text: ex.relation.te }),
      ' → ',
      h('span', { class: 'jp', text: ex.relation.ta }),
      ` （${ex.relation.swap}）`
    ));
  }
  /* Formas derivadas deixam explícita a forma de origem: ない → なかった
     (§23) e た → たり (Lição 16). */
  if (ex.derivedFrom) {
    box.appendChild(h('p', { class: 'rel-line' },
      `Vem da ${FORM_LABEL[ex.derivedFrom.form]}: `,
      h('span', { class: 'jp', text: ex.derivedFrom.value }),
      ' → ',
      h('span', { class: 'jp', text: ex.answer }),
      ` （${ex.derivedFrom.swap}）`
    ));
  }

  if (ex.note) box.appendChild(h('p', { class: 'rel-line', text: ex.note }));

  const src = [ex.source, ...(ex.sourceExtra || [])].join(' · também ');
  box.appendChild(h('p', { class: 'src-line', text: src }));

  return box;
}

function groupRuleLine(verb) {
  const stem = verb.masu.slice(0, -2);
  const last = stem.slice(-1);
  if (verb.group === 3) return 'Grupo 3: します e きます (e compostos deles).';
  if (verb.group === 2) {
    if (stem.length === 1) return `Grupo 2, tipo (ii): apenas um hiragana (${stem}) antes de ます.`;
    if ('いちりにびみきぎし'.includes(last)) {
      return `Grupo 2, tipo (iii): som /i/ (${last}) antes de ます, mas Grupo 2 — lista curta do Rikai.`;
    }
    return `Grupo 2, tipo (i): som /e/ (${last}) antes de ます.`;
  }
  return `Grupo 1: o som antes de ます é sempre /i/ (aqui, ${last}).`;
}

/* ===================================================================
   Fim de sessão (§47)
   =================================================================== */
export function renderEnd(app, session) {
  const s = session.finishAndRecord();
  const root = h('div', { class: 'wrap' });

  root.appendChild(h('h1', { class: 'page-title', text: 'Fim da sessão' }));
  root.appendChild(h('p', { class: 'page-sub', text: sessionModeLabel(session.config) }));

  const card = h('div', { class: 'card pad' });
  card.appendChild(h('div', { class: 'score' },
    h('b', { class: 'mincho', text: `${s.correct} / ${s.answered}` }),
    h('span', { text: 'respostas corretas' })
  ));

  if (Object.keys(s.perForm).length) {
    const list = h('div', { style: { marginTop: '16px' } });
    for (const [form, v] of Object.entries(s.perForm)) {
      const label = form === 'group' ? 'Grupos' : FORM_LABEL[form];
      list.appendChild(h('div', { class: 'stat-row', style: form === 'group' ? {} : formVars(form) },
        h('span', { class: 'stat-name', text: label }),
        h('div', { class: 'stat-bar' }, h('i', { style: { width: `${v.seen ? (v.right / v.seen) * 100 : 0}%` } })),
        h('span', { class: 'stat-val', text: `${v.right}/${v.seen}` })
      ));
    }
    card.appendChild(list);
  }
  root.appendChild(card);

  const wrong = session.reviewQueue();
  if (wrong.length) {
    const rev = h('div', { class: 'card pad', style: { marginTop: '14px' } });
    rev.appendChild(h('h2', { style: { fontSize: '15px', marginBottom: '10px' }, text: 'Revisar' }));
    wrong.forEach(w => {
      const verb = app.verbById(w.verbId);
      rev.appendChild(h('p', { style: { margin: '0 0 6px', fontSize: '14.5px' } },
        h('span', { class: 'jp', text: verb.masu }),
        h('span', { class: 'muted', text: ' × ' }),
        h('span', { text: w.form === 'group' ? 'grupo' : FORM_SHORT[w.form] })
      ));
    });
    rev.appendChild(h('button', {
      class: 'btn btn-primary btn-block',
      style: { marginTop: '12px' },
      onclick: () => app.startSession({
        mode: 'review',
        queue: wrong,
        limitKind: 'count',
        length: wrong.length
      })
    }, 'Revisar os erros agora'));
    root.appendChild(rev);
  }

  root.appendChild(h('div', { class: 'row', style: { marginTop: '16px' } },
    h('button', { class: 'btn btn-block btn-lg', onclick: () => app.go('home') }, 'Voltar ao início')
  ));

  return root;
}

function sessionModeLabel(config) {
  if (config.mode === 'group') return 'Treino de grupos';
  if (config.mode === 'weak') return 'Pontos fracos';
  if (config.mode === 'review') return 'Revisão de erros';
  if (config.mode === 'form') return config.forms.map(f => FORM_LABEL[f]).join(' · ');
  return 'Sessão mista';
}
