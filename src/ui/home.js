/* ===================================================================
   活用ラボ — tela inicial (§17) e seletores de sessão.
   =================================================================== */

import { h, formVars, backRow } from './dom.js';
import { FORMS, FORM_LABEL, FORM_SHORT, GROUP_LABEL } from '../conjugation/rules.js';
import { getState, overallCounts, updateSettings } from '../progress/store.js';
import { VERB_COUNT } from '../data/verbs.js';

export function renderHome(app) {
  const s = getState();
  const counts = overallCounts();
  const root = h('div', { class: 'wrap' });

  root.appendChild(h('h1', { class: 'page-title', text: 'Treinar conjugação' }));
  root.appendChild(h('p', { class: 'page-sub', text: subtitle(s, counts) }));

  const menu = h('div', { class: 'menu' });

  if (s.resume?.queue?.length) {
    menu.appendChild(card({
      title: 'Continuar treino',
      desc: `Retomar de onde parou — ${s.resume.queue.length} ${s.resume.queue.length === 1 ? 'questão restante' : 'questões restantes'}.`,
      accent: 'var(--ai)',
      primary: true,
      onclick: () => app.resumeSession()
    }));
  }

  menu.appendChild(card({
    title: 'Sessão mista',
    desc: 'Todas as formas, todos os grupos, em ordem imprevisível.',
    accent: 'var(--ai)',
    primary: !s.resume?.queue?.length,
    onclick: () => app.go('setup', { mode: 'mixed' })
  }));

  menu.appendChild(card({
    title: 'Treinar uma forma',
    desc: `${FORMS.map(f => FORM_SHORT[f]).join(' · ')}, uma de cada vez.`,
    accent: 'var(--murasaki)',
    onclick: () => app.go('setup', { mode: 'form' })
  }));

  menu.appendChild(card({
    title: 'Treinar grupos',
    desc: 'Só a identificação de Grupo 1, 2 e 3.',
    accent: 'var(--midori)',
    onclick: () => app.go('setup', { mode: 'group' })
  }));

  menu.appendChild(card({
    title: 'Pontos fracos',
    desc: counts.seen ? 'Prioriza as combinações em que você mais erra.' : 'Disponível assim que houver respostas registradas.',
    accent: 'var(--shu)',
    onclick: () => app.go('setup', { mode: 'weak' })
  }));

  menu.appendChild(card({
    title: 'Erros recentes',
    desc: 'O que você errou, o que digitou e por quê.',
    accent: 'var(--shu)',
    onclick: () => app.go('errors')
  }));

  menu.appendChild(card({
    title: 'Progresso',
    desc: 'Domínio por forma, por grupo e a matriz verbo × forma.',
    accent: 'var(--gold)',
    onclick: () => app.go('progress')
  }));

  menu.appendChild(card({
    title: 'Referência',
    desc: 'As regras do Rikai, em uma página.',
    accent: 'var(--ink-faint)',
    onclick: () => app.go('reference')
  }));

  root.appendChild(menu);

  /* A home é para começar a estudar; configurar como estudar é em
     Ajustes. O único resquício aqui é um aviso informativo, e só quando
     a opção está fora do padrão — sem controle, sem cartão próprio. */
  const rodape = [`${VERB_COUNT} verbos`, `${counts.trainable} combinações verbo × forma`];
  if (s.settings.hideGroup) rodape.push('grupo oculto no exercício');
  rodape.push('fonte: Básico Rikai');

  root.appendChild(h('p', {
    class: 'src-line',
    style: { textAlign: 'center', marginTop: '22px' },
    text: rodape.join(' · ')
  }));

  return root;
}

function subtitle(s, counts) {
  if (!counts.seen) return 'ます形 → forma-alvo. Comece por uma sessão mista.';
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

function card({ title, desc, accent, onclick, primary }) {
  return h('button', {
    class: `menu-card${primary ? ' primary' : ''}`,
    style: { '--accent': accent },
    onclick
  },
    h('span', { class: 'rail' }),
    h('b', { text: title }),
    h('span', { text: desc })
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
      }, FORM_LABEL[f]);
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
      }
    }, 'Começar'),
  ));

  root.appendChild(backRow(app));

  return root;
}
