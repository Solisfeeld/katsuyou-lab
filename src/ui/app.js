/* ===================================================================
   活用ラボ — casca do aplicativo: topbar, roteador e ciclo de render.
   =================================================================== */

import { h, mount, backRow } from './dom.js';
import { renderHome, renderSetup } from './home.js';
import { renderPractice, renderEnd } from './practice.js';
import { renderProgress, renderErrors } from './progress.js';
import { renderReference } from './reference.js';
import { Session, TAB_ID } from '../practice/engine.js';
import { verbById } from '../data/verbs.js';
import { getState, updateSettings, resetAll, overallCounts, clearResume, reloadFromStorage } from '../progress/store.js';
import {
  downloadBackup, readFileText, parseBackup, applyBackup, describeBackup
} from '../progress/backup.js';

const THEME_KEY = 'katsuyou_lab_theme_v1';

/* Telas de sessão: têm saída própria (Encerrar sessão / Ver resultado) e
   ficam fora da pilha de navegação. */
const SESSION_VIEWS = new Set(['practice', 'sessionEnd']);

const sameScreen = (a, b) =>
  !!a && !!b && a.view === b.view &&
  JSON.stringify(a.params || {}) === JSON.stringify(b.params || {});

/* Três estados de tema, preservados como já eram. */
export const THEME_ORDER = ['auto', 'light', 'dark'];
export const THEME_LABEL = { auto: 'automático', light: 'claro', dark: 'escuro' };
export const THEME_ICON = { auto: '◐', light: '☀', dark: '☾' };

export class App {
  constructor(root) {
    this.root = root;
    this.view = 'home';
    this.params = {};
    this.session = null;
    this._cleanups = [];
    /* Estado das telas de backup: aviso curto e importação aguardando
       confirmação. Vivem no App porque são efêmeros — nunca no store. */
    this.backupNotice = null;
    this.pendingImport = null;
    /* Popover de conta na topbar. */
    this.acctOpen = false;
    /* Pilha explícita de telas anteriores. Não se usa history.back():
       as views trocam internamente e não geram entradas no histórico do
       navegador. */
    this.nav = [];
    this.settingsReturn = null;
    /* Diálogo de confirmação (mesmo componente do Bunpou Lab) e aviso curto
       exibido uma vez na tela inicial. */
    this.dialog = null;
    this.flash = null;
    this.applyTheme(this.readTheme());

    /* Clicar fora ou apertar Esc fecha o popover — mesmo comportamento
       do Bunpou Lab. O botão da conta faz stopPropagation. */
    try {
      document.addEventListener('click', () => {
        if (this.acctOpen) { this.acctOpen = false; this.render(); }
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.dialog) { e.preventDefault(); this.closeDialog(); return; }
        if (e.key === 'Escape' && this.acctOpen) { this.acctOpen = false; this.render(); }
      });
    } catch { /* ambiente sem document: nada a fazer */ }
  }

  verbById(id) { return verbById(id); }

  /* A camada de sincronização é opcional: pode não ter carregado (dev
     local) ou ter falhado. Toda a UI passa por aqui e trata o null. */
  sync() {
    try { return window.KatsuyouSync || null; } catch { return null; }
  }

  /* Handlers de teclado registrados por uma view precisam sair de cena
     quando ela é substituída. */
  onNextRender(fn) { this._cleanups.push(fn); }

  /**
   * Troca de tela. `opts.push:false` navega sem empilhar — é o que o
   * botão Voltar usa para não crescer a pilha ao recuar.
   *
   * Mesma disciplina do Bunpou Lab: as telas de sessão têm saída própria
   * e NÃO entram na pilha, para que Voltar jamais reabra uma sessão que
   * já foi encerrada; e a home é a raiz, que zera a pilha.
   */
  go(view, params = {}, opts = {}) {
    const from = { view: this.view, params: this.params };

    /* Ajustes é uma tela temporária sobre a origem: aberta durante uma
       sessão, o Voltar precisa devolver exatamente aquela sessão. */
    if (view === 'settings' && SESSION_VIEWS.has(from.view) && this.session) {
      this.settingsReturn = { view: from.view };
    } else if (view !== 'settings') {
      this.settingsReturn = null;
    }

    if (opts.push !== false && !SESSION_VIEWS.has(from.view) && from.view !== view) {
      if (!sameScreen(this.nav[this.nav.length - 1], from)) this.nav.push(from);
      if (this.nav.length > 12) this.nav.shift();
    }

    if (view !== 'settings') {
      /* Sair dos Ajustes descarta avisos e qualquer importação que não
         tenha sido confirmada. */
      this.backupNotice = null;
      this.pendingImport = null;
    }
    this.acctOpen = false;
    this.view = view;
    this.params = params;
    if (view === 'home') {
      this.nav = [];             // a home é a raiz
      this.session = null;
    }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    this.render();
  }

  /** Volta à tela anterior, restaurando o contexto dela. */
  back() {
    /* Ajustes aberto sobre a sessão: devolve a sessão, sem reconstruí-la. */
    const r = this.settingsReturn;
    if (r && this.session) {
      this.settingsReturn = null;
      this.backupNotice = null;
      this.pendingImport = null;
      this.acctOpen = false;
      this.view = r.view;
      window.scrollTo({ top: 0 });
      this.render();
      return;
    }

    /* Descarta entradas equivalentes à tela atual: sem isso, reabrir uma
       tela que já estava na pilha faria o primeiro Voltar parecer inerte. */
    const cur = { view: this.view, params: this.params };
    while (this.nav.length && sameScreen(this.nav[this.nav.length - 1], cur)) this.nav.pop();

    const prev = this.nav.pop();
    /* Sem pilha — ou apontando para uma sessão que não existe mais —
       o destino seguro é a home. */
    if (!prev || (SESSION_VIEWS.has(prev.view) && !this.session)) { this.go('home'); return; }
    this.go(prev.view, prev.params, { push: false });
  }

  /* ---------------- backup do progresso ---------------- */
  exportProgress() {
    try {
      downloadBackup(document);
      this.backupNotice = { kind: 'ok', text: 'Backup exportado.' };
    } catch {
      this.backupNotice = { kind: 'error', text: 'Não foi possível exportar o backup.' };
    }
    this.pendingImport = null;
    this.render();
  }

  /* Lê e VALIDA o arquivo. Nada é substituído aqui: só depois da
     confirmação explícita do usuário (§9). */
  async stageImport(file) {
    this.backupNotice = null;
    this.pendingImport = null;
    let text;
    try { text = await readFileText(file); }
    catch {
      this.backupNotice = { kind: 'error', text: 'Não foi possível importar este arquivo: arquivo inválido.' };
      this.render();
      return;
    }

    const parsed = parseBackup(text);
    if (!parsed.ok) {
      this.backupNotice = { kind: 'error', text: `Não foi possível importar este arquivo: ${parsed.reason}.` };
      this.render();
      return;
    }

    this.pendingImport = {
      progress: parsed.progress,
      fileName: file?.name || null,
      summary: describeBackup(parsed.progress).text
    };
    this.render();
  }

  /* Substitui de fato. O envio para a conta acontece pelo caminho normal:
     replaceState → save → KatsuyouSync.notifyLocalChange (§11). */
  confirmImport() {
    if (!this.pendingImport) return;
    const result = applyBackup(this.pendingImport.progress);
    this.pendingImport = null;
    this.backupNotice = result.ok
      ? { kind: 'ok', text: 'Progresso importado com sucesso.' }
      : { kind: 'error', text: `Não foi possível importar este arquivo: ${result.reason}.` };
    this.render();
  }

  startSession(config) {
    this.session = new Session(config);
    if (!this.session.current) {
      /* Nada a praticar com esses filtros — volta e avisa. */
      this.session = null;
      this.go('home');
      return;
    }
    this.view = 'practice';
    window.scrollTo({ top: 0 });
    this.render();
  }

  /* “Continuar sessão”: reconstrói a sessão salva exatamente onde parou —
     mesma questão, mesma fase (pergunta ou feedback), mesmo rascunho, mesma
     fila — e o relógio continua do tempo estudado. Nada é reaplicado ao
     progresso. Esta aba passa a ser a dona da sessão. */
  resumeSession() {
    const resume = getState().resume;
    const s = Session.fromResume(resume);
    if (!s || !s.current) { this.go('home'); return; }
    this.session = s;
    s.saveQuiet();                       // assume a sessão nesta aba
    this.view = 'practice';
    window.scrollTo?.({ top: 0 });
    this.render();
  }

  /* Descartar a sessão salva: pede confirmação. As respostas já dadas
     continuam no progresso — só a sessão em andamento some. */
  discardResume() {
    this.askConfirm({
      title: 'Descartar a sessão salva?',
      body: 'As respostas que você já deu continuam registradas no seu progresso. Só a sessão em andamento é descartada.',
      ok: 'Descartar',
      danger: true,
      onOk: () => { clearResume(); this.render(); }
    });
  }

  /* Outra aba gravou o progresso (evento `storage`): esta aba recarrega o
     estado — para nunca gravar por cima do que a outra gravou — e, se a
     sessão aberta aqui foi retomada ou encerrada lá, larga a sessão. */
  onExternalChange() {
    const st = reloadFromStorage();
    const s = this.session;
    if (s && s.phase !== 'done' && (this.view === 'practice' || this.settingsReturn)) {
      const r = st.resume;
      if (!r || r.id !== s.id || r.owner !== TAB_ID) this.detachSession();
      return;                                   // a sessão é desta aba
    }
    if (this.view !== 'practice') this.render();
  }

  /* Outra aba assumiu (ou encerrou) a sessão aberta aqui: larga sem gravar. */
  detachSession() {
    this.session = null;
    this.view = 'home';
    this.nav = [];
    this.flash = 'Esta sessão continuou em outra aba.';
    this.flashUntil = Date.now() + 10_000;
    this.render();
  }

  /* ---------------- diálogo de confirmação ---------------- */
  askConfirm({ title, body, ok = 'Confirmar', cancel = 'Cancelar', danger = false, onOk }) {
    this.dialog = { title, body, ok, cancel, danger, onOk };
    this.render();
  }
  closeDialog(run) {
    const d = this.dialog;
    this.dialog = null;
    this.render();
    if (run && d && d.onOk) d.onOk();
  }
  dialogNode() {
    const d = this.dialog;
    if (!d) return null;
    const okBtn = h('button', {
      class: `btn ${d.danger ? 'btn-shu' : 'btn-primary'}`, 'data-dialog': 'ok',
      onclick: () => this.closeDialog(true)
    }, d.ok);
    const node = h('div', {
      class: 'overlay show', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t',
      onclick: e => { if (e.target === node) this.closeDialog(); }
    },
      h('div', { class: 'modal' },
        h('h3', { id: 'dlg-t', text: d.title }),
        h('p', { text: d.body }),
        h('div', { class: 'modal-act' },
          h('button', { class: 'btn btn-ghost', 'data-dialog': 'cancel', onclick: () => this.closeDialog() }, d.cancel),
          okBtn
        )
      )
    );
    queueMicrotask?.(() => { try { okBtn.focus(); } catch {} });
    return node;
  }

  endSession(session) {
    this.view = 'sessionEnd';
    this.session = session;
    window.scrollTo({ top: 0 });
    this.render();
  }

  /* ---------------- tema ---------------- */
  readTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; }
  }
  applyTheme(mode) {
    this.theme = mode;
    const dark = mode === 'dark' ||
      (mode === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem(THEME_KEY, mode); } catch {}
  }
  cycleTheme() {
    const i = THEME_ORDER.indexOf(this.theme);
    this.applyTheme(THEME_ORDER[(i + 1) % THEME_ORDER.length]);
    this.render();
  }

  /* ---------------- render ---------------- */
  render() {
    this._cleanups.forEach(fn => { try { fn(); } catch {} });
    this._cleanups = [];

    let body;
    switch (this.view) {
      case 'setup': body = renderSetup(this, this.params); break;
      case 'practice': body = renderPractice(this, this.session); break;
      case 'sessionEnd': body = renderEnd(this, this.session); break;
      case 'progress': body = renderProgress(this); break;
      case 'errors': body = renderErrors(this); break;
      case 'reference': body = renderReference(this); break;
      case 'settings': body = renderSettings(this); break;
      default: body = renderHome(this);
    }

    /* Relógio de tempo estudado: corre só com a tela de exercício à vista
       (sem diálogo por cima e com a página visível). Fora dela — Ajustes,
       início, outra aba, app minimizado — a sessão fica pausada. */
    const sess = this.session;
    if (sess && sess.phase !== 'done' && typeof sess.pause === 'function') {
      const visivel = typeof document === 'undefined' || document.visibilityState !== 'hidden';
      if (this.view === 'practice' && visivel && !this.dialog) sess.resumeClock(); else sess.pause();
    }

    mount(this.root, this.topbar(), body, this.dialogNode());
    if (this.view === 'home' && !(Date.now() < (this.flashUntil || 0))) this.flash = null;
  }

  /* ---------------- topbar ----------------
     Mesmo conceito do Bunpou Lab: identidade à esquerda e, à direita, os
     três controles globais — conta, Ajustes e tema. Nenhum deles se
     esconde atrás de menu; no celular eles encolhem (§9). */
  topbar() {
    const inSession = this.view === 'practice';
    const onSettings = this.view === 'settings';

    return h('div', { class: 'topbar' },
      h('div', { class: 'topbar-in' },
        h('button', {
          class: 'brand',
          'aria-label': 'Início',
          onclick: () => {
            if (inSession && this.session && this.session.answered > 0) {
              this.endSession(this.session);
            } else this.go('home');
          }
        },
          h('span', { class: 'seal mincho', 'aria-hidden': 'true', text: '活' }),
          h('span', { class: 'brand-txt' },
            h('b', { text: '活用ラボ' }),
            h('span', { text: 'Katsuyou Lab · Conjugação' })
          )
        ),
        h('span', { class: 'spacer' }),

        this.accountControl(),

        h('button', {
          class: `topbtn${onSettings ? ' on' : ''}`,
          'data-topbar': 'settings',
          'aria-label': 'Ajustes',
          'aria-current': onSettings ? 'page' : null,
          title: 'Ajustes',
          onclick: () => this.go('settings')
        },
          h('span', { class: 'lbl full', text: 'Ajustes' }),
          h('span', { class: 'lbl short', text: '⚙' })
        ),

        h('button', {
          class: 'icon-btn',
          'data-topbar': 'theme',
          'aria-label': `Tema: ${THEME_LABEL[this.theme]}`,
          title: `Tema: ${THEME_LABEL[this.theme]}`,
          onclick: () => this.cycleTheme()
        }, THEME_ICON[this.theme])
      )
    );
  }

  /* Controle de conta. Só aparece quando a camada de sincronização está
     presente; sem ela o site continua inteiro (§10). Toda a lógica vem
     de KatsuyouSync — aqui é só apresentação. */
  accountControl() {
    const sync = this.sync();
    if (!sync) return null;

    const status = sync.status;
    const user = sync.user;

    /* Enquanto a sessão está sendo restaurada, "sem usuário" ainda não
       quer dizer "deslogado" — não oferecemos login cedo demais. Um
       módulo sem authReady (stub antigo) conta como pronto. */
    if (!user && sync.authReady === false) {
      return h('div', { class: 'acct-wrap' },
        h('button', {
          class: 'acct-btn',
          'data-topbar': 'checking',
          disabled: true,
          title: 'Verificando sua sessão'
        },
          h('span', { class: 'sdot warn' }),
          h('span', { class: 'lbl full', text: 'Verificando…' }),
          h('span', { class: 'lbl short', text: '…' })
        )
      );
    }

    if (!user || status === 'anonymous') {
      return h('div', { class: 'acct-wrap' },
        h('button', {
          class: 'acct-btn',
          'data-topbar': 'login',
          title: 'Entrar com Google para sincronizar seu progresso',
          onclick: e => { e.stopPropagation(); try { sync.login(); } catch {} }
        },
          h('span', { class: 'lbl full', text: 'Entrar com Google' }),
          h('span', { class: 'lbl short', text: 'Entrar' })
        )
      );
    }

    const u = syncChip(status);
    return h('div', { class: 'acct-wrap' },
      h('button', {
        class: `acct-btn${u.tone ? ' ' + u.tone : ''}`,
        'data-topbar': 'account',
        'aria-expanded': String(!!this.acctOpen),
        title: u.full,
        onclick: e => { e.stopPropagation(); this.acctOpen = !this.acctOpen; this.render(); }
      },
        h('span', { class: `sdot ${u.dot}` }),
        h('span', { class: 'lbl full', text: u.chip }),
        h('span', { class: 'lbl short', text: u.chip })
      ),
      this.acctOpen ? this.accountPopover(sync, u) : null
    );
  }

  accountPopover(sync, u) {
    const pop = h('div', { class: 'acct-pop', onclick: e => e.stopPropagation() });
    pop.appendChild(h('div', { class: 'st' },
      h('span', { class: `sdot ${u.dot}` }),
      h('span', { text: u.full })
    ));
    pop.appendChild(h('div', { class: 'who', text: accountLabel(sync.user) }));
    const last = relativeTime(sync.lastSyncedAt);
    pop.appendChild(h('div', {
      class: 'meta',
      text: last ? `Última sincronização: ${last}` : 'Ainda não sincronizado'
    }));

    if (sync.status === 'auth-required') {
      pop.appendChild(h('button', {
        class: 'btn btn-primary',
        onclick: () => { this.acctOpen = false; try { sync.login(); } catch {} this.render(); }
      }, 'Entrar novamente com Google'));
    } else if (sync.status === 'conflict') {
      /* As duas opções e suas consequências ficam em Ajustes, escritas
         por extenso — o popover só leva até lá (§4). */
      pop.appendChild(h('button', {
        class: 'btn',
        style: { borderColor: 'var(--shu)', color: 'var(--shu)' },
        onclick: () => this.go('settings')
      }, 'Resolver conflito'));
    } else {
      pop.appendChild(h('button', {
        class: 'btn',
        onclick: () => { try { sync.syncNow?.(); } catch {} this.render(); }
      }, 'Sincronizar agora'));
    }

    pop.appendChild(h('div', { class: 'sep' }));
    pop.appendChild(h('button', {
      class: 'btn btn-ghost',
      onclick: async () => { this.acctOpen = false; try { await sync.logout(); } catch {} this.render(); }
    }, 'Sair desta conta'));

    return pop;
  }
}

/* ===================================================================
   Ajustes
   =================================================================== */
/* Rótulo pequeno em versalete acima de cada card, como no Bunpou Lab. */
const sectionLabel = text => h('div', { class: 'h-sec', text });

/* Linha de opção: título + explicação à esquerda, ação à direita.
   `description` aceita texto ou uma lista de nós (o indicador de estado
   da conta, por exemplo). O segundo argumento de h() são as props, então
   a descrição precisa entrar sempre como filho, nunca como props. */
function optRow(title, description, action, opts = {}) {
  const row = h('div', { class: 'optrow', style: opts.first ? { paddingTop: 0 } : {} });
  let desc = null;
  if (Array.isArray(description)) desc = h('span', {}, ...description);
  else if (description) desc = h('span', { text: description });

  row.appendChild(h('div', { class: 'lbl' }, h('b', { text: title }), desc));
  if (action) row.appendChild(action);
  return row;
}

/* A ordem segue a do Bunpou Lab: primeiro o que é próprio do estudo,
   depois preferências, e só então conta e dados. */
function renderSettings(app) {
  const root = h('div', { class: 'wrap' });
  root.appendChild(h('h1', { class: 'page-title', text: 'Ajustes' }));

  root.appendChild(sectionLabel('Treino'));
  root.appendChild(trainingSection(app));

  root.appendChild(sectionLabel('Aparência'));
  root.appendChild(appearanceSection(app));

  root.appendChild(sectionLabel('Conta'));
  root.appendChild(accountSection(app));

  root.appendChild(sectionLabel('Dados'));
  root.appendChild(dataSection(app));

  root.appendChild(backRow(app));

  return root;
}

/* ---------------- TREINO ---------------- */
function trainingSection(app) {
  const s = getState();
  const card = h('div', { class: 'card pad' });

  card.appendChild(optRow(
    'Esconder o grupo durante o exercício',
    'Sem o grupo à vista, você precisa deduzi-lo antes de conjugar.',
    toggle({
      setting: 'hide-group', on: !!s.settings.hideGroup,
      labels: ['Visível', 'Oculto'],
      onclick: () => { updateSettings({ hideGroup: !s.settings.hideGroup }); app.render(); }
    }),
    { first: true }
  ));

  /* Padrão LIGADO. Desligar não apaga a necessidade de revisar: o erro
     continua registrado e o par volta nas próximas sessões. */
  const rep = s.settings.repeatErrors !== false;
  card.appendChild(optRow(
    'Repetir atividades erradas na mesma sessão',
    'Apresenta novamente atividades respondidas incorretamente, em momentos diferentes da sessão. Desligada, o erro continua registrado e volta nas próximas sessões.',
    toggle({
      setting: 'repeat-errors', on: rep,
      labels: ['Desligado', 'Ligado'],
      onclick: () => { updateSettings({ repeatErrors: !rep }); app.render(); }
    })
  ));

  card.appendChild(h('p', {
    class: 'muted small', style: { margin: '13px 0 0' },
    text: 'O tamanho da sessão — por questões ou por tempo — é escolhido ao iniciar cada treino.'
  }));
  return card;
}

/* ===================================================================
   Conta e sincronização — interface para a infraestrutura que já existe
   em src/auth-sync.js (Netlify Identity + Function `progress`).
   Nenhuma autenticação nova é criada aqui.
   =================================================================== */

/* Texto de cada estado que o auth-sync publica. */
const SYNC_TEXT = {
  loading: 'Sincronizando…',
  synced: '✓ Progresso sincronizado',
  dirty: 'Alterações aguardando sincronização…',
  offline: 'Sem conexão. Seu progresso continua salvo neste dispositivo e será sincronizado quando possível.',
  error: 'Não foi possível sincronizar agora.',
  conflict: 'Há progresso diferente neste dispositivo e na sua conta.',
  'auth-required': 'Sua sessão expirou. Entre novamente para sincronizar.',
  anonymous: ''
};

const SYNC_COLOR = {
  synced: 'var(--midori)',
  dirty: 'var(--gold)',
  loading: 'var(--ink-faint)',
  offline: 'var(--ink-soft)',
  error: 'var(--shu)',
  conflict: 'var(--shu)',
  'auth-required': 'var(--shu)'
};

/* Versão compacta dos mesmos estados, para o chip da topbar. A frase
   longa continua em Ajustes (§4). */
const SYNC_CHIP = {
  synced: { chip: 'Sincronizado', full: 'Progresso sincronizado', dot: 'ok', tone: '' },
  loading: { chip: 'Sincronizando', full: 'Sincronizando…', dot: 'warn', tone: '' },
  dirty: { chip: 'Pendente', full: 'Alterações aguardando sincronização', dot: 'warn', tone: 'warn' },
  offline: { chip: 'Offline', full: 'Sem conexão · salvo neste dispositivo', dot: 'warn', tone: 'warn' },
  conflict: { chip: 'Conflito', full: 'Conflito de sincronização', dot: 'bad', tone: 'attn' },
  error: { chip: 'Erro', full: 'Não foi possível sincronizar agora', dot: 'bad', tone: 'attn' },
  'auth-required': { chip: 'Sessão expirada', full: 'Sessão expirada · entre novamente', dot: 'bad', tone: 'attn' }
};

const syncChip = s => SYNC_CHIP[s] || { chip: 'Conta', full: 'Conta conectada', dot: 'warn', tone: '' };

function relativeTime(ts) {
  if (!ts) return null;
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 90) return 'agora há pouco';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/* O objeto do Identity varia conforme o provedor; só lemos o que for
   comprovadamente uma string. */
function accountLabel(user) {
  const email = typeof user?.email === 'string' ? user.email : null;
  const name = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null;
  if (email) return `Google · ${email}`;
  if (name) return `Google · ${name}`;
  return 'Conta conectada';
}

/* Card único de CONTA, no formato do Bunpou Lab: linhas .optrow com
   título + explicação à esquerda e a ação à direita. O login e toda a
   sincronização vêm de src/auth-sync.js — aqui só há apresentação. */
function accountSection(app) {
  const card = h('div', { class: 'card pad' });
  const sync = app.sync();

  /* Sem o módulo carregado (dev local, ou Netlify indisponível) o site
     segue inteiro: só não há o que oferecer aqui. */
  if (!sync) {
    card.appendChild(optRow(
      'Sincronização indisponível neste ambiente',
      'O progresso é salvo neste navegador. A sincronização entre dispositivos fica disponível no site publicado no Netlify.',
      null, { first: true }
    ));
    return card;
  }

  const status = sync.status;
  const user = sync.user;

  /* ---- restauração da sessão em andamento ---- */
  if (!user && sync.authReady === false) {
    card.appendChild(optRow(
      'Verificando sua sessão…',
      'Se você já entrou antes, a sessão é retomada automaticamente.',
      null, { first: true }
    ));
    return card;
  }

  /* ---- deslogado ---- */
  if (!user) {
    card.appendChild(optRow(
      'Entrar com Google para sincronizar seus dados',
      'Continue seus estudos em outros dispositivos. O login é opcional — o Katsuyou Lab funciona por inteiro sem conta, salvando neste navegador.',
      h('button', {
        class: 'btn btn-primary',
        onclick: () => { try { sync.login(); } catch {} }
      }, 'Entrar'),
      { first: true }
    ));
    if (status === 'auth-required' || status === 'error') {
      card.appendChild(h('p', {
        class: 'muted small', style: { margin: '13px 0 0', color: 'var(--shu)' },
        text: SYNC_TEXT[status]
      }));
    }
    return card;
  }

  /* ---- autenticado ---- */
  const u = syncChip(status);
  card.appendChild(optRow(
    accountLabel(user),
    [h('span', { class: `sdot ${u.dot}`, style: { marginRight: '6px' } }), u.full],
    null, { first: true }
  ));
  card.appendChild(optRow(
    'Último envio',
    relativeTime(sync.lastSyncedAt) || 'ainda não sincronizado'
  ));
  card.appendChild(optRow(
    'Entre dispositivos',
    'O progresso desta conta acompanha você em qualquer navegador em que entrar.'
  ));

  /* Conflito é excepcional: as duas escolhas aparecem aqui, com as
     consequências escritas. Nada é resolvido em silêncio. */
  if (status === 'conflict') {
    const box = h('div', { class: 'notice', style: { marginTop: '14px' } });
    box.appendChild(h('p', { style: { margin: '0 0 4px', fontWeight: '700' }, text: 'Há progresso diferente neste dispositivo e na sua conta.' }));
    box.appendChild(h('p', { class: 'small', style: { margin: '0 0 12px' }, text: 'Escolha qual versão manter. Nada é substituído sem a sua escolha.' }));
    box.appendChild(h('button', {
      class: 'btn btn-block',
      style: { marginBottom: '6px' },
      onclick: () => { try { sync.keepLocal(); } catch {} app.render(); }
    }, 'Usar progresso deste dispositivo'));
    box.appendChild(h('p', { class: 'src-line', style: { margin: '0 0 12px' }, text: 'O progresso deste dispositivo será enviado para a sua conta.' }));
    box.appendChild(h('button', {
      class: 'btn btn-block',
      onclick: () => { try { sync.keepRemote(); } catch {} app.render(); }
    }, 'Usar progresso da nuvem'));
    box.appendChild(h('p', { class: 'src-line', style: { margin: '0' }, text: 'O progresso salvo na conta substituirá o deste dispositivo.' }));
    card.appendChild(box);
  }

  /* "Sincronizar agora" NÃO se repete aqui: a ação manual mora só no
     controle de conta da topbar, para não haver duas interfaces fazendo
     exatamente a mesma coisa. */
  const acoes = h('div', { class: 'row', style: { marginTop: '14px' } });
  if (status === 'auth-required') {
    acoes.appendChild(h('button', {
      class: 'btn btn-primary',
      onclick: () => { try { sync.login(); } catch {} }
    }, 'Entrar novamente'));
  }
  acoes.appendChild(h('button', {
    class: 'btn btn-ghost',
    onclick: async () => { try { await sync.logout(); } catch {} app.render(); }
  }, 'Sair desta conta'));
  card.appendChild(acoes);

  card.appendChild(h('p', {
    class: 'muted small', style: { margin: '13px 0 0' },
    text: 'Sair não apaga o progresso salvo neste dispositivo.'
  }));

  return card;
}

/* ---------------- APARÊNCIA ---------------- */
/* Interruptor com rótulo de estado — o mesmo componente do Bunpou Lab.
   `labels`: [desligado, ligado]. */
function toggle({ setting, on, labels, onclick }) {
  return h('button', {
    class: 'tgl', type: 'button', 'data-setting': setting, 'aria-pressed': String(!!on), onclick
  },
    h('span', { class: 'tgl-track', 'aria-hidden': 'true' }),
    h('span', { class: 'tgl-txt', text: on ? labels[1] : labels[0] })
  );
}

/* Ícones de tema em SVG (traço na cor do texto), iguais nos dois apps. */
export const THEME_SVG = {
  auto: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 3a7 7 0 0 1 0 14Z" fill="currentColor"/></svg>',
  light: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  dark: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M15.6 12.6A6.6 6.6 0 0 1 7.4 4.4a6.6 6.6 0 1 0 8.2 8.2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
};

/* Tema: título e explicação na largura toda; abaixo, três opções de
   tamanho idêntico (lado a lado no desktop, empilhadas no celular). */
function appearanceSection(app) {
  const card = h('div', { class: 'card pad' });
  card.appendChild(h('div', { class: 'set-head' },
    h('b', { text: 'Tema' }),
    h('span', { text: 'Automático acompanha o sistema. O atalho na barra superior faz o mesmo.' })
  ));
  const set = h('div', { class: 'choice-group', role: 'group', 'aria-label': 'Tema' });
  THEME_ORDER.forEach(mode => {
    set.appendChild(h('button', {
      class: 'choice', type: 'button', 'data-theme-choice': mode,
      'aria-pressed': String(app.theme === mode),
      onclick: () => { app.applyTheme(mode); app.render(); }
    },
      h('span', { html: THEME_SVG[mode], style: { display: 'contents' } }),
      mode === 'auto' ? 'Automático' : mode === 'light' ? 'Claro' : 'Escuro'));
  });
  card.appendChild(set);
  return card;
}

/* ===================================================================
   DADOS — exportar, importar e resetar num card só, no formato do
   Bunpou Lab. Nenhuma lógica muda: as três ações continuam sendo as
   mesmas de sempre.
   =================================================================== */
function dataSection(app) {
  const s = getState();
  const counts = overallCounts();
  const card = h('div', { class: 'card pad' });

  /* Métricas reais do store: sessões gravadas e combinações verbo ×
     forma que já têm histórico. */
  card.appendChild(h('p', { class: 'muted small', style: { margin: '0 0 14px' } },
    'Sessões registradas: ', h('b', { text: String(s.sessions.length) }),
    ' · Itens com histórico: ', h('b', { text: String(counts.practiced) }),
    ` de ${counts.trainable}`
  ));

  /* ---- confirmação pendente: nada é substituído em silêncio ---- */
  if (app.pendingImport) {
    const box = h('div', { class: 'notice', style: { marginTop: 0 } });
    box.appendChild(h('p', { style: { margin: '0 0 4px', fontWeight: '700' }, text: 'Este backup substituirá o progresso atual deste dispositivo.' }));
    if (app.pendingImport.fileName) {
      box.appendChild(h('p', { class: 'small', style: { margin: '0 0 2px' }, text: app.pendingImport.fileName }));
    }
    if (app.pendingImport.summary) {
      box.appendChild(h('p', { class: 'small muted', style: { margin: '0 0 12px' }, text: app.pendingImport.summary }));
    }
    box.appendChild(h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', onclick: () => app.confirmImport() }, 'Importar e substituir'),
      h('button', { class: 'btn btn-ghost', onclick: () => { app.pendingImport = null; app.render(); } }, 'Cancelar')
    ));
    card.appendChild(box);
    return card;
  }

  /* O input fica invisível e é acionado pelo botão. */
  const file = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    style: { display: 'none' },
    'aria-hidden': 'true',
    tabindex: '-1',
    onchange: e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) app.stageImport(f);
    }
  });

  card.appendChild(h('div', { class: 'btn-trio' },
    h('button', { class: 'btn', onclick: () => app.exportProgress() }, 'Exportar progresso'),
    h('button', { class: 'btn', onclick: () => file.click() }, 'Importar progresso'),
    h('button', {
      class: 'btn btn-shu',
      onclick: () => app.askConfirm({
        title: 'Resetar todo o progresso?',
        body: 'Apaga todo o progresso do 活用ラボ neste navegador: domínio, erros recentes, sessões e a sessão salva. Não dá para desfazer — exporte um backup antes, se quiser guardar.',
        ok: 'Resetar progresso',
        danger: true,
        onOk: () => { resetAll(); app.go('home'); }
      })
    }, 'Resetar progresso')
  ));
  card.appendChild(file);

  if (app.backupNotice) {
    const bad = app.backupNotice.kind === 'error';
    card.appendChild(h('p', {
      class: 'small',
      style: { margin: '13px 0 0', color: bad ? 'var(--shu)' : 'var(--midori)', fontWeight: '600' },
      text: app.backupNotice.text
    }));
  }

  card.appendChild(h('p', {
    class: 'muted small', style: { margin: '13px 0 0' },
    text: 'O arquivo de backup contém apenas o seu progresso de estudo — nenhum dado de login.'
  }));

  return card;
}
