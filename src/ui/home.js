/* ===================================================================
   活用ラボ — tela inicial (§17) e seletores de sessão.
   =================================================================== */

import { h, formVars, backRow, jpText, sakuraFlower, SAKURA_BRANCH, EXT_ICON, BUNPOU_URL } from './dom.js';
import { FORMS, FORM_LABEL, FORM_SHORT, GROUP_LABEL } from '../conjugation/rules.js';
import { getState, overallCounts, updateSettings, getPair } from '../progress/store.js';
import { allPairs, pairCategory } from '../practice/scheduler.js';
import { VERB_COUNT } from '../data/verbs.js';

export function renderHome(app) {
  const s = getState();
  const counts = overallCounts();
  const root = h('div', { class: 'wrap home' });

  /* ---- abertura ---- */
  root.appendChild(h('section', { class: 'hero', 'aria-labelledby': 'h-home' },
    h('div', { class: 'hero-txt' },
      h('p', { class: 'eyebrow', html: `${sakuraFlower('eyebrow-flower')}<ruby>活用<rt>かつよう</rt></ruby>ラボ · Katsuyou Lab` }),
      h('h1', { class: 'page-title mincho', id: 'h-home', text: 'Treinar conjugação' }),
      h('p', { class: 'lead', text: subtitle(s, counts) })
    ),
    h('div', { class: 'hero-art', 'aria-hidden': 'true', html: SAKURA_BRANCH })
  ));

  /* ---- praticar: um destaque (continuar ou sessão mista) + modos ---- */
  root.appendChild(h('h2', { class: 'h-sec', text: 'Praticar' }));
  if (app.flash) root.appendChild(h('p', { class: 'notice', role: 'status', text: app.flash }));
  const card0 = resumeCard(app, s.resume);
  if (card0) root.appendChild(card0);
  const lead = { title: 'Sessão mista', k: '混',
    desc: 'Todas as formas e grupos, em ordem imprevisível: o que é novo, o que você errou e o que pede revisão.',
    onclick: () => app.go('setup', { mode: 'mixed' }) };
  root.appendChild(h('button', { class: 'session-card', onclick: lead.onclick },
    h('span', { class: 'session-k mincho', 'aria-hidden': 'true', text: lead.k }),
    h('span', { class: 'session-txt' },
      h('b', { text: lead.title }),
      h('span', { text: lead.desc })
    ),
    h('span', { class: 'session-go', 'aria-hidden': 'true', text: '→' })
  ));

  const modes = h('div', { class: 'menu' });
  modes.appendChild(card({
    title: 'Treinar uma forma', k: '形', accent: 'var(--murasaki)',
    desc: `${FORMS.map(f => FORM_SHORT[f]).join(' · ')}, uma de cada vez.`,
    onclick: () => app.go('setup', { mode: 'form' })
  }));
  modes.appendChild(card({
    title: 'Treinar grupos', k: '類', accent: 'var(--midori)',
    desc: 'Só a identificação de Grupo 1, 2 e 3.',
    onclick: () => app.go('setup', { mode: 'group' })
  }));
  modes.appendChild(card({
    title: 'Pontos fracos', k: '弱', accent: 'var(--shu)',
    desc: counts.seen ? 'Prioriza as combinações em que você mais erra.' : 'Disponível assim que houver respostas registradas.',
    onclick: () => app.go('setup', { mode: 'weak' })
  }));
  root.appendChild(modes);

  /* ---- acompanhamento ---- */
  root.appendChild(h('h2', { class: 'h-sec', text: 'Acompanhamento' }));
  const pend = pendingCounts();
  root.appendChild(h('div', { class: 'track' },
    h('div', { class: 'trk-stats' },
      stat(counts.mastered, `de ${counts.trainable} dominadas`),
      stat(counts.practiced, 'já praticadas'),
      stat(pend.due + pend.weak, 'pedindo revisão')
    ),
    h('p', { class: 'trk-d', text: 'Combinações verbo × forma. “Dominada” = três acertos seguidos sem dica, ou dois acertos sem dica com pelo menos dois dias entre eles.' })
  ));
  const more = h('div', { class: 'menu menu-sm' });
  more.appendChild(card({
    title: 'Erros recentes', k: '誤', accent: 'var(--shu)',
    desc: 'O que você errou, o que digitou e por quê.',
    onclick: () => app.go('errors')
  }));
  more.appendChild(card({
    title: 'Progresso', k: '進', accent: 'var(--gold)',
    desc: 'Domínio por forma, por grupo e a matriz verbo × forma.',
    onclick: () => app.go('progress')
  }));
  more.appendChild(card({
    title: 'Referência', k: '則', accent: 'var(--asagi)',
    desc: 'As regras do Rikai, em uma página.',
    onclick: () => app.go('reference')
  }));
  root.appendChild(more);

  /* ---- ferramentas: o outro laboratório, em nova guia ---- */
  root.appendChild(h('h2', { class: 'h-sec', text: 'Ferramentas' }));
  root.appendChild(h('a', {
    class: 'tool-card', href: BUNPOU_URL, target: '_blank', rel: 'noopener'
  },
    h('span', { class: 'tool-seal seal-bunpou', 'aria-hidden': 'true', text: '文' }),
    h('span', { class: 'tool-txt' },
      h('b', { text: 'Bunpou Lab — Gramática japonesa' }),
      h('span', { text: 'Sessões de gramática do N5 com revisão espaçada. Abre em nova guia; seu progresso aqui continua intacto.' })
    ),
    h('span', { class: 'tool-ext', 'aria-hidden': 'true', html: EXT_ICON })
  ));

  /* A home é para começar a estudar; configurar como estudar é em
     Ajustes. O único resquício aqui é um aviso informativo, e só quando
     a opção está fora do padrão — sem controle, sem cartão próprio. */
  const rodape = [`${VERB_COUNT} verbos`, `${counts.trainable} combinações verbo × forma`];
  if (s.settings.hideGroup) rodape.push('grupo oculto no exercício');
  rodape.push('fonte: Básico Rikai');

  root.appendChild(h('p', {
    class: 'src-line home-foot',
    text: rodape.join(' · ')
  }));

  return root;
}

/* ---- sessão interrompida ----
   Cartão discreto no topo de "Praticar". Nunca retoma sozinho: só com o
   clique em "Continuar sessão". */
const MODE_LABEL = {
  mixed: 'Sessão mista', form: 'Treinar uma forma', group: 'Treinar grupos',
  weak: 'Pontos fracos', review: 'Revisar erros'
};
export function resumeInfo(r) {
  if (!r || typeof r !== 'object') return null;
  const v2 = r.v === 2;
  if (!(v2 ? (r.current || (r.rest && r.rest.length)) : (r.queue && r.queue.length))) return null;
  const cfg = r.config || {};
  let label = MODE_LABEL[cfg.mode] || 'Sessão';
  if (cfg.mode === 'form' && cfg.forms && cfg.forms.length === 1) label += ` · ${FORM_LABEL[cfg.forms[0]] || ''}`;
  const answered = r.answered || 0;
  const pend = v2 ? (r.rest || []).length + (r.phase === 'asking' && r.current ? 1 : 0) : r.queue.length;
  const byTime = cfg.limitKind === 'time';
  const ms = v2 ? (r.elapsedMs || 0) : null;
  const t = ms == null ? null : `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  return { label, answered, total: answered + pend, byTime, minutes: cfg.minutes, time: t,
           feedback: v2 && r.phase === 'feedback', savedAt: r.savedAt || null };
}
function resumeCard(app, r) {
  const m = resumeInfo(r);
  if (!m) return null;
  const meta = [];
  meta.push(m.byTime ? `${m.answered} ${m.answered === 1 ? 'questão respondida' : 'questões respondidas'}`
                     : `${m.answered} de ${m.total} questões · ${Math.max(0, m.total - m.answered)} restantes`);
  if (m.time) meta.push(`${m.time} de sessão${m.byTime && m.minutes ? ` · meta ${m.minutes} min` : ''}`);
  if (m.savedAt) {
    const d = Math.floor((Date.now() - m.savedAt) / 86400000);
    meta.push(`salva ${d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`}`);
  }
  return h('section', { class: 'resume-card', 'aria-labelledby': 'resume-t' },
    h('div', { class: 'resume-main' },
      h('span', { class: 'resume-k mincho', 'aria-hidden': 'true', text: '続' }),
      h('div', { class: 'resume-txt' },
        h('h3', { id: 'resume-t', text: 'Continuar sessão anterior' }),
        h('p', {}, h('b', {}, jpText(m.label)), m.feedback ? ' · no feedback da última resposta' : ''),
        h('p', { class: 'resume-meta' }, meta.map(x => h('span', { text: x })))
      )
    ),
    h('div', { class: 'resume-act' },
      h('button', { class: 'btn btn-primary', 'data-resume': 'continue', onclick: () => app.resumeSession() }, 'Continuar sessão'),
      h('button', { class: 'btn btn-ghost', 'data-resume': 'discard', onclick: () => app.discardResume() }, 'Descartar')
    )
  );
}

/* Pares pendentes, pela mesma classificação que o agendador usa. */
function pendingCounts() {
  const now = Date.now();
  const out = { due: 0, weak: 0 };
  for (const x of allPairs()) {
    const c = pairCategory(getPair(x.verbId, x.form), now);
    if (c === 'due') out.due += 1;
    else if (c === 'weak') out.weak += 1;
  }
  return out;
}

function stat(n, label) {
  return h('div', { class: 'trk-stat' }, h('b', { text: String(n) }), h('span', { text: label }));
}

function subtitle(s, counts) {
  if (!counts.seen) return 'Da forma ます à forma-alvo, com explicação a cada resposta. Comece por uma sessão mista.';
  const dom = counts.trainable ? Math.round((counts.mastered / counts.trainable) * 100) : 0;
  const when = s.lastPracticedAt ? relativeDay(s.lastPracticedAt) : '';
  return `${counts.mastered} de ${counts.trainable} combinações dominadas (${dom}%)${when ? ' · ' + when : ''}.`;
}

function relativeDay(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return 'praticado hoje';
  if (d === 1) return 'praticado ontem';
  return `praticado há ${d} dias`;
}

function card({ title, desc, accent, onclick, k }) {
  return h('button', {
    class: 'menu-card',
    style: { '--accent': accent },
    onclick
  },
    k ? h('span', { class: 'menu-k mincho', 'aria-hidden': 'true', text: k }) : null,
    h('span', { class: 'menu-txt' },
      h('b', { text: title }),
      h('span', { text: desc })
    )
  );
}

/* ===================================================================
   Configuração da sessão: forma/grupo + tamanho (§32)
   =================================================================== */
export function renderSetup(app, params) {
  const s = getState();
  const root = h('div', { class: 'wrap' });
  const mode = params.mode;

  const titles = {
    mixed: 'Sessão mista',
    form: 'Treinar uma forma',
    group: 'Treinar grupos',
    weak: 'Pontos fracos'
  };
  root.appendChild(h('h1', { class: 'page-title', text: titles[mode] || 'Sessão' }));
  root.appendChild(h('p', { class: 'page-sub', text: 'ます形 → forma-alvo. Enter responde; Enter de novo avança.' }));

  const state = {
    forms: mode === 'form' ? ['te'] : FORMS.slice(),
    groups: [1, 2, 3],
    limitKind: s.settings.sessionMode || 'count',
    length: s.settings.sessionLength || 20,
    minutes: s.settings.sessionMinutes || 10
  };

  /* ---- escolha da forma ---- */
  if (mode === 'form') {
    const box = h('div', { class: 'card pad', style: { marginBottom: '12px' } });
    box.appendChild(h('h2', { style: { fontSize: '14.5px', marginBottom: '10px' }, text: 'Qual forma?' }));
    const set = h('div', { class: 'chipset' });
    FORMS.forEach(f => {
      const b = h('button', {
        class: 'chip',
        style: formVars(f),
        'aria-pressed': String(state.forms[0] === f),
        onclick: () => {
          state.forms = [f];
          [...set.children].forEach(c => c.setAttribute('aria-pressed', String(c === b)));
        }
      }, jpText(FORM_LABEL[f]));
      set.appendChild(b);
    });
    box.appendChild(set);
    root.appendChild(box);
  }

  /* ---- escolha do grupo ---- */
  if (mode === 'group' || mode === 'mixed' || mode === 'form') {
    const box = h('div', { class: 'card pad', style: { marginBottom: '12px' } });
    box.appendChild(h('h2', { style: { fontSize: '14.5px', marginBottom: '4px' }, text: 'Quais grupos?' }));
    box.appendChild(h('p', { class: 'small muted', style: { margin: '0 0 10px' }, text: 'Deixe os três marcados para o treino normal.' }));
    const set = h('div', { class: 'chipset' });
    [1, 2, 3].forEach(g => {
      const b = h('button', {
        class: 'chip',
        'aria-pressed': 'true',
        onclick: () => {
          const on = b.getAttribute('aria-pressed') === 'true';
          if (on && state.groups.length === 1) return;    // nunca zerar
          b.setAttribute('aria-pressed', String(!on));
          state.groups = on ? state.groups.filter(x => x !== g) : [...state.groups, g].sort();
        }
      }, GROUP_LABEL[g]);
      set.appendChild(b);
    });
    box.appendChild(set);
    root.appendChild(box);
  }

  /* ---- tamanho da sessão ---- */
  const sz = h('div', { class: 'card pad', style: { marginBottom: '12px' } });
  sz.appendChild(h('h2', { style: { fontSize: '14.5px', marginBottom: '10px' }, text: 'Tamanho da sessão' }));

  const kindSet = h('div', { class: 'chipset', style: { marginBottom: '12px' } });
  const countBtn = h('button', { class: 'chip', 'aria-pressed': String(state.limitKind === 'count') }, 'Por questões');
  const timeBtn = h('button', { class: 'chip', 'aria-pressed': String(state.limitKind === 'time') }, 'Por tempo');
  const countSet = h('div', { class: 'chipset' });
  const timeSet = h('div', { class: 'chipset' });

  [10, 20, 30].forEach(n => {
    countSet.appendChild(h('button', {
      class: 'chip',
      'aria-pressed': String(state.length === n),
      onclick: () => {
        state.length = n;
        [...countSet.children].forEach(c => c.setAttribute('aria-pressed', String(c.textContent === `${n} questões`)));
      }
    }, `${n} questões`));
  });
  [5, 10, 15].forEach(n => {
    timeSet.appendChild(h('button', {
      class: 'chip',
      'aria-pressed': String(state.minutes === n),
      onclick: () => {
        state.minutes = n;
        [...timeSet.children].forEach(c => c.setAttribute('aria-pressed', String(c.textContent === `${n} minutos`)));
      }
    }, `${n} minutos`));
  });

  const syncKind = () => {
    countBtn.setAttribute('aria-pressed', String(state.limitKind === 'count'));
    timeBtn.setAttribute('aria-pressed', String(state.limitKind === 'time'));
    countSet.style.display = state.limitKind === 'count' ? '' : 'none';
    timeSet.style.display = state.limitKind === 'time' ? '' : 'none';
  };
  countBtn.addEventListener('click', () => { state.limitKind = 'count'; syncKind(); });
  timeBtn.addEventListener('click', () => { state.limitKind = 'time'; syncKind(); });
  syncKind();

  kindSet.appendChild(countBtn);
  kindSet.appendChild(timeBtn);
  sz.appendChild(kindSet);
  sz.appendChild(countSet);
  sz.appendChild(timeSet);
  root.appendChild(sz);

  root.appendChild(h('div', { class: 'q-actions' },
    h('button', {
      class: 'btn btn-primary btn-lg btn-block',
      onclick: () => {
        const go = () => {
        updateSettings({
          sessionMode: state.limitKind,
          sessionLength: state.length,
          sessionMinutes: state.minutes
        });
        app.startSession({
          mode,
          forms: state.forms,
          groups: state.groups,
          limitKind: state.limitKind,
          /* No modo por tempo a fila precisa ser folgada para não acabar
             antes do relógio. */
          length: state.limitKind === 'time' ? Math.max(60, state.minutes * 8) : state.length,
          minutes: state.minutes
        });
        };
        /* Começar outra sessão com uma interrompida salva: pergunta antes. */
        if (resumeInfo(getState().resume)) {
          app.askConfirm({
            title: 'Há uma sessão interrompida',
            body: 'Começar outra sessão descarta a sessão salva. As respostas que você já deu continuam registradas.',
            ok: 'Descartar e começar',
            danger: true,
            onOk: go
          });
        } else go();
      }
    }, 'Começar'),
  ));

  root.appendChild(backRow(app));

  return root;
}
