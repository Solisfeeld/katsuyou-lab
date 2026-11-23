/* ===================================================================
   活用ラボ — motor de sessão.

   Guarda o estado de UMA sessão de prática: fila, item corrente, dicas
   já pedidas, contadores. A interface só chama métodos daqui; nenhuma
   regra de conjugação vive na UI.
   =================================================================== */

import { verbById } from '../data/verbs.js';
import { FORMS, FORM_LABEL, GROUP_LABEL } from '../conjugation/rules.js';
import { explain, hints } from '../conjugation/explain.js';
import { diagnose } from '../conjugation/diagnose.js';
import { isCorrect, normalize } from '../conjugation/normalize.js';
import { kanjiSpelling } from '../conjugation/furigana.js';
import { buildQueue, buildGroupQueue, requeue } from './scheduler.js';
import { recordAnswer, recordSession, setResume, clearResume, getState, writeDraft, readDraft } from '../progress/store.js';

export class Session {
  constructor(config) {
    this.config = {
      mode: 'mixed',           // mixed | form | group | weak | review
      forms: FORMS,
      groups: [1, 2, 3],
      limitKind: 'count',      // count | time
      length: 20,
      minutes: 10,
      ...config
    };

    this.queue = this.config.queue
      ? this.config.queue.slice()
      : (this.config.mode === 'group'
        ? buildGroupQueue({ groups: this.config.groups, length: this.config.length })
        : buildQueue({
            mode: this.config.mode === 'review' ? 'weak' : this.config.mode,
            forms: this.config.forms,
            groups: this.config.groups,
            length: this.config.length
          }));

    /* Relógio de TEMPO ESTUDADO. `startedAt` é um início virtual:
       elapsedMs = agora − startedAt. Pausar (página oculta, fora da tela de
       exercício, app fechado) desloca startedAt para frente pelo tempo
       parado, então o intervalo pausado nunca entra na conta. */
    this.startedAt = Date.now();
    this.pausedAt = null;
    this.id = this.config.id || newSessionId();
    this.answered = 0;
    this.correct = 0;
    /* tentativas de reforço (item errado reapresentado nesta sessão) */
    this.reinforced = 0;
    this.reinforcedOk = 0;
    this.wrongItems = [];
    this.perForm = {};
    this.current = null;
    this.phase = 'idle';       // idle | asking | feedback | done
    this.hintsShown = 0;
    this.lastResult = null;
    /* Rascunho da resposta em digitação. É estado TRANSITÓRIO da
       atividade — o equivalente do V.ans do Bunpou Lab —, no mesmo lugar
       e com o mesmo ciclo de vida de `hintsShown`. Existe para que a
       resposta parcial sobreviva a um re-render (status de sincronização,
       dica, tema, overtime) sem morar no DOM.

       NÃO é progresso pedagógico: `saveResume()` enumera os campos que
       persiste e este não está entre eles, então ele nunca entra no
       localStorage, no backup nem no snapshot enviado ao Netlify. */
    this.answerDraft = '';
    /* Uma sessão só pode ser gravada no histórico uma vez, por mais
       vezes que a tela de resultado seja renderizada. */
    this.recorded = false;
    /* Retomada: fromResume() reconstrói o estado sem abrir uma questão nova
       (abrir gravaria um resumo incompleto por cima do salvo). */
    if (!this.config.__restore) this.next();
  }

  /* ---------------- relógio da sessão ----------------
     Conta o tempo da SESSÃO ABERTA: aba oculta, navegador minimizado ou
     outro aplicativo à frente não pausam. Pausa só fora da tela de
     exercício (Ajustes, início) e quando a página é descarregada (aba ou
     navegador fechados, página atualizada). A pausa desloca startedAt
     para frente pelo tempo parado, então esse intervalo nunca é somado. */
  pause(now = Date.now()) {
    if (this.pausedAt == null) this.pausedAt = now;
  }
  resumeClock(now = Date.now()) {
    if (this.pausedAt != null) { this.startedAt += now - this.pausedAt; this.pausedAt = null; }
  }
  get paused() { return this.pausedAt != null; }

  /* ---------------- limites da sessão (§32) ----------------
     O tempo é uma META de duração, não um corte seco. Atingir a meta e
     encerrar a sessão são coisas DIFERENTES: a meta só congela a fila
     (nenhuma questão nova começa), enquanto a questão já aberta segue
     até o fim. Mesma filosofia do Bunpou Lab, onde o relógio nunca
     encerra a atividade — ele só entra em estado `over`.

     Tudo é calculado por tempo absoluto (Date.now()), nunca por contagem
     de ticks: se o navegador suspender os timers, a volta já mostra o
     overtime correto. */
  get elapsedMs() { return Math.max(0, (this.pausedAt ?? Date.now()) - this.startedAt); }

  /** Duração planejada, em ms. null nas sessões por quantidade. */
  get plannedMs() {
    return this.config.limitKind === 'time' ? this.config.minutes * 60_000 : null;
  }

  /** A meta de tempo foi atingida. NÃO significa "sessão encerrada". */
  get plannedTimeReached() {
    const alvo = this.plannedMs;
    return alvo !== null && this.elapsedMs >= alvo;
  }

  /** Encerramento suave: a fila está congelada, nada novo começa. */
  get softEnding() { return this.plannedTimeReached; }

  /** Quanto já se passou ALÉM da meta. 0 antes dela. */
  get overtimeMs() {
    const alvo = this.plannedMs;
    if (alvo === null) return 0;
    return Math.max(0, this.elapsedMs - alvo);
  }

  get remainingMs() {
    const alvo = this.plannedMs;
    if (alvo === null) return null;
    return Math.max(0, alvo - this.elapsedMs);
  }
  get remaining() { return this.queue.length; }

  /* Só o estado terminal encerra. Atingir a meta, sozinho, não encerra
     nada: existe uma questão legítima em andamento. */
  isFinished() {
    if (this.phase === 'done') return true;
    return this.queue.length === 0 && !this.current;
  }

  /* Estado terminal, sempre coerente: sem pergunta corrente e sem
     feedback pendente. Nenhuma tela pode tentar ler `current` depois. */
  #end() {
    this.current = null;
    this.lastResult = null;
    this.hintsShown = 0;
    this.answerDraft = '';
    this.phase = 'done';
  }

  /* ---------------- avançar ---------------- */
  next() {
    if (this.phase === 'done') return null;
    /* Fronteira pedagógica segura: com a meta atingida não se ABRE outra
       questão. A que estava na tela já foi concluída neste ponto. */
    if (this.plannedTimeReached || !this.queue.length) { this.#end(); return null; }
    const item = this.queue.shift();
    this.current = openItem(item);
    this.phase = 'asking';
    this.hintsShown = 0;
    this.lastResult = null;
    /* O rascunho não vaza de uma questão para outra. */
    this.answerDraft = '';
    writeDraft(null);
    this.saveResume();
    return this.current;
  }

  /* ---------------- dicas progressivas (§29) ---------------- */
  availableHints() {
    if (!this.current) return [];
    if (this.current.isGroupQuestion) {
      const v = this.current.verb;
      const stem = v.masu.slice(0, -2);
      return [
        'Olhe o som que vem imediatamente antes de ます.',
        stem.length === 1
          ? 'Há apenas um hiragana antes de ます — isso aponta para um grupo específico.'
          : `O som antes de ます é ${stem.slice(-1)}. Confira em qual das três descrições do Rikai ele se encaixa.`
      ];
    }
    return hints(this.current.verb, this.current.form);
  }

  revealHint() {
    const all = this.availableHints();
    if (this.hintsShown >= all.length) return null;
    this.hintsShown += 1;
    /* a dica muda o peso do acerto: precisa sobreviver a um fechamento */
    this.saveQuiet();
    return all[this.hintsShown - 1];
  }

  get shownHints() { return this.availableHints().slice(0, this.hintsShown); }

  /* ---------------- responder ---------------- */
  submit(rawAnswer) {
    /* A questão começou dentro do prazo, então a resposta conta — mesmo
       que a meta tenha sido atingida enquanto o usuário digitava. */
    if (!this.current || this.phase !== 'asking') return this.lastResult;
    const cur = this.current;

    if (cur.isGroupQuestion) return this.#submitGroup(rawAnswer);

    const correct = isCorrect(cur.verb, cur.form, rawAnswer);
    const diagnosis = correct ? null : diagnose(cur.verb, cur.form, rawAnswer);
    return this.#finish({ correct, rawAnswer, diagnosis, dontKnow: false });
  }

  #submitGroup(value) {
    const cur = this.current;
    const given = Number(String(value).replace(/\D/g, ''));
    const correct = given === cur.verb.group;
    const diagnosis = correct ? null : {
      code: 'wrong-group',
      message: `${cur.verb.masu} é ${GROUP_LABEL[cur.verb.group]}, não ${GROUP_LABEL[given] || 'esse grupo'}.`,
      detail: groupReason(cur.verb)
    };
    return this.#finish({ correct, rawAnswer: String(value), diagnosis, dontKnow: false });
  }

  /* §28 — "Não sei": mostra tudo, conta como não dominado e devolve o
     item para a fila alguns itens à frente. */
  dontKnow() {
    if (!this.current || this.phase !== 'asking') return this.lastResult;
    return this.#finish({ correct: false, rawAnswer: '', diagnosis: null, dontKnow: true });
  }

  #finish({ correct, rawAnswer, diagnosis, dontKnow }) {
    const cur = this.current;
    const hinted = this.hintsShown > 0;
    /* A tentativa de REFORÇO (item errado que voltou nesta sessão) é
       contada à parte: não apaga o erro original nem soma outro. */
    const corrective = !!cur.requeued;

    if (corrective) {
      this.reinforced += 1;
      if (correct) this.reinforcedOk += 1;
    } else {
      this.answered += 1;
      if (correct) this.correct += 1;
      const fkey = cur.form;
      this.perForm[fkey] = this.perForm[fkey] || { seen: 0, right: 0 };
      this.perForm[fkey].seen += 1;
      if (correct) this.perForm[fkey].right += 1;
    }

    if (!correct) {
      if (!corrective) this.wrongItems.push({ verbId: cur.verbId, form: cur.form });
      /* Volta para a fila entre 3 e 7 questões à frente (§33), em posição
         sorteada — se a opção “Repetir atividades erradas” estiver ligada
         (padrão). Nunca depois da meta (a fila está congelada) e no máximo
         UMA vez por item: errar de novo o reforço não cria um laço; o erro
         fica registrado e volta nas próximas sessões. */
      const repeatOn = getState().settings.repeatErrors !== false;
      if (repeatOn && !corrective && !this.plannedTimeReached) {
        this.queue = requeue(this.queue, { verbId: cur.verbId, form: cur.form });
      }
    }

    /* `given` é o texto EXATAMENTE como foi digitado (sem normalização);
       `variant` marca um acerto escrito de forma diferente tanto do kana
       canônico quanto da grafia que a própria tela mostra (飲んで) — aceito,
       mas acompanhado da forma esperada. Digitar a grafia exibida não é
       "grafia diferente". */
    const canonical = cur.isGroupQuestion ? null : cur.verb[cur.form];
    const shown = canonical ? kanjiSpelling(cur.verbId, canonical) : null;
    this.lastResult = {
      correct,
      dontKnow,
      hinted,
      corrective,
      given: rawAnswer,
      blank: !dontKnow && !String(rawAnswer || '').trim(),
      variant: !!(correct && canonical && normalize(rawAnswer) !== canonical && normalize(rawAnswer) !== normalize(shown || '')),
      diagnosis,
      explanation: cur.isGroupQuestion ? null : explain(cur.verb, cur.form),
      verb: cur.verb,
      form: cur.form,
      groupAnswer: cur.isGroupQuestion ? cur.verb.group : null
    };
    this.phase = 'feedback';
    writeDraft(null);
    /* Resposta e sessão salva vão para o disco no MESMO save(): o resumo
       (já em fase de feedback) é posto no estado sem gravar, e recordAnswer
       grava os dois juntos. Não existe instante em que a resposta conste do
       progresso e a sessão salva ainda a mostre como pendente — retomar
       nunca reaplica uma resposta. */
    setResume(this.resumeData(), { write: false });
    recordAnswer({
      verbId: cur.verbId,
      form: cur.form,
      correct,
      hinted,
      dontKnow,
      corrective,
      answer: rawAnswer,
      reason: diagnosis?.message || null
    });
    return this.lastResult;
  }

  /* ---------------- fim ---------------- */
  summary() {
    return {
      mode: this.config.mode,
      answered: this.answered,
      correct: this.correct,
      reinforced: this.reinforced,
      reinforcedOk: this.reinforcedOk,
      perForm: this.perForm,
      wrongItems: this.wrongItems,
      durationMs: this.elapsedMs
    };
  }

  /* Idempotente: a tela de resultado pode ser renderizada muitas vezes
     (trocar o tema, por exemplo) sem gravar a sessão de novo. */
  finishAndRecord() {
    const s = this.summary();
    if (this.recorded) return s;
    this.recorded = true;
    this.#end();
    /* mesmo princípio: o registro da sessão e a remoção da sessão salva
       numa única gravação — uma sessão concluída nunca volta como
       “Continuar sessão anterior” e nunca é registrada duas vezes */
    setResume(null, { write: false });
    if (s.answered > 0) recordSession(s);
    else clearResume();
    return s;
  }

  /* Fila só com o que foi errado — alimenta o "revisar erros" do §47. */
  reviewQueue() {
    const seen = new Set();
    return this.wrongItems.filter(w => {
      const k = `${w.verbId}|${w.form}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  /* ---------------- sessão salva (“Continuar sessão anterior”) ----------------
     Tudo o que é preciso para reconstruir a sessão EXATAMENTE onde parou:
     a questão atual e a fase (pergunta ou feedback), o feedback exibido, as
     dicas abertas, o rascunho digitado, a fila e sua ordem (com os itens de
     reforço), os contadores e o tempo estudado. Vive em `resume`, dentro do
     mesmo estado do progresso — por isso resposta e sessão salva são
     gravadas juntas. */
  resumeData() {
    if (this.phase === 'done') return null;
    const cur = this.current;
    const lr = this.lastResult;
    return {
      v: 2,
      id: this.id,
      owner: TAB_ID,
      savedAt: Date.now(),
      config: { ...this.config, queue: undefined, __restore: undefined, id: undefined },
      current: cur ? { verbId: cur.verbId, form: cur.form, ...(cur.requeued ? { requeued: true } : {}) } : null,
      phase: this.phase,
      hintsShown: this.hintsShown,
      lastResult: lr ? { ...lr, verb: undefined, explanation: undefined } : null,
      /* compatível com versões anteriores, que só liam `queue` */
      queue: (cur && this.phase === 'asking'
        ? [{ verbId: cur.verbId, form: cur.form, ...(cur.requeued ? { requeued: true } : {}) }, ...this.queue]
        : this.queue.slice()),
      rest: this.queue.slice(),
      answered: this.answered,
      correct: this.correct,
      reinforced: this.reinforced,
      reinforcedOk: this.reinforcedOk,
      perForm: this.perForm,
      wrongItems: this.wrongItems,
      elapsedMs: Math.round(this.elapsedMs)
    };
  }

  /* Grava a sessão com o progresso (sincroniza como sempre). */
  saveResume() {
    if (this.phase === 'done') return;
    setResume(this.resumeData());
  }

  /* Gravação local e silenciosa — rascunho, relógio, ciclo de vida. Não
     dispara a sincronização: são dados transitórios, e a próxima resposta
     leva tudo para a nuvem normalmente. */
  saveQuiet() {
    if (this.phase === 'done') return;
    setResume(this.resumeData(), { quiet: true });
    const cur = this.current;
    writeDraft(cur && this.phase === 'asking' && this.answerDraft
      ? { id: this.id, verbId: cur.verbId, form: cur.form, text: String(this.answerDraft) }
      : null);
  }

  static fromResume(resume) {
    if (!resume) return null;
    /* formato antigo (v1): só a fila, com a questão atual na frente */
    if (resume.v !== 2) {
      if (!resume.queue?.length) return null;
      const s = new Session({ ...resume.config, queue: resume.queue });
      copyCounters(s, resume);
      s.startedAt = Date.now();        // v1 não guardava o tempo da sessão
      return s;
    }
    const valid = x => x && verbById(x.verbId) && (x.form === 'group' || FORMS.includes(x.form));
    const rest = (resume.rest || []).filter(valid);
    if (!valid(resume.current)) {
      /* sem questão atual legível: segue pela fila, se houver */
      if (!rest.length) return null;
      const s = new Session({ ...resume.config, id: resume.id, queue: rest });
      copyCounters(s, resume);
      s.startedAt = Date.now() - (resume.elapsedMs || 0);
      return s;
    }
    const s = new Session({ ...resume.config, id: resume.id, queue: rest, __restore: true });
    delete s.config.__restore;
    copyCounters(s, resume);
    s.current = openItem(resume.current);
    s.phase = resume.phase === 'feedback' && resume.lastResult ? 'feedback' : 'asking';
    s.hintsShown = resume.hintsShown || 0;
    const d = readDraft();
    s.answerDraft = (s.phase === 'asking' && d && d.id === resume.id &&
      d.verbId === s.current.verbId && d.form === s.current.form) ? String(d.text || '') : '';
    if (s.phase === 'feedback') {
      const v = s.current.verb;
      s.lastResult = {
        ...resume.lastResult,
        verb: v,
        explanation: s.current.isGroupQuestion ? null : explain(v, s.current.form)
      };
    }
    /* o relógio continua do tempo estudado salvo — o intervalo com o app
       fechado não conta */
    s.startedAt = Date.now() - (resume.elapsedMs || 0);
    return s;
  }
}

/* Identifica esta aba: quem retoma uma sessão passa a ser o dono dela, e
   outra aba que estivesse com a mesma sessão aberta a larga. */
export const TAB_ID = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
function newSessionId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function openItem(item) {
  const verb = verbById(item.verbId);
  return {
    ...item,
    verb,
    isGroupQuestion: item.form === 'group',
    prompt: verb.masu,
    meaning: verb.meaning,
    formLabel: item.form === 'group' ? 'Qual é o grupo?' : FORM_LABEL[item.form]
  };
}

function copyCounters(s, r) {
  s.answered = r.answered || 0;
  s.correct = r.correct || 0;
  s.reinforced = r.reinforced || 0;
  s.reinforcedOk = r.reinforcedOk || 0;
  s.perForm = r.perForm || {};
  s.wrongItems = r.wrongItems || [];
}

function groupReason(verb) {
  const stem = verb.masu.slice(0, -2);
  const last = stem.slice(-1);
  if (verb.group === 3) return 'Grupo 3 são します e きます (e os compostos deles). São memorizados.';
  if (verb.group === 2) {
    if (stem.length === 1) return `Grupo 2, tipo (ii): há apenas um hiragana (${stem}) antes de ます.`;
    if ('いちりにびみきぎし'.includes(last)) {
      return `Grupo 2, tipo (iii): tem /i/ (${last}) antes de ます, como o Grupo 1 — mas está na lista curta de exceções do Rikai.`;
    }
    return `Grupo 2, tipo (i): o som antes de ます é /e/ (${last}).`;
  }
  return `Grupo 1: o som antes de ます é /i/ (${last}).`;
}
