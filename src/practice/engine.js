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
import { isCorrect } from '../conjugation/normalize.js';
import { buildQueue, buildGroupQueue, requeue } from './scheduler.js';
import { recordAnswer, recordSession, setResume, clearResume } from '../progress/store.js';

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

    this.startedAt = Date.now();
    this.answered = 0;
    this.correct = 0;
    this.wrongItems = [];
    this.perForm = {};
    this.current = null;
    this.phase = 'idle';       // idle | asking | feedback | done
    this.hintsShown = 0;
    this.lastResult = null;
    /* Uma sessão só pode ser gravada no histórico uma vez, por mais
       vezes que a tela de resultado seja renderizada. */
    this.recorded = false;
    this.next();
  }

  /* ---------------- limites da sessão (§32) ----------------
     O tempo é uma META de duração, não um corte seco. Atingir a meta e
     encerrar a sessão são coisas DIFERENTES: a meta só congela a fila
     (nenhuma questão nova começa), enquanto a questão já aberta segue
     até o fim. Mesma filosofia do Bunpou Lab, onde o relógio nunca
     encerra a atividade — ele só entra em estado `over`.

     Tudo é calculado por tempo absoluto (Date.now()), nunca por contagem
     de ticks: se o navegador suspender os timers, a volta já mostra o
     overtime correto. */
  get elapsedMs() { return Date.now() - this.startedAt; }

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
    this.phase = 'done';
  }

  /* ---------------- avançar ---------------- */
  next() {
    if (this.phase === 'done') return null;
    /* Fronteira pedagógica segura: com a meta atingida não se ABRE outra
       questão. A que estava na tela já foi concluída neste ponto. */
    if (this.plannedTimeReached || !this.queue.length) { this.#end(); return null; }
    const item = this.queue.shift();
    const verb = verbById(item.verbId);
    this.current = {
      ...item,
      verb,
      isGroupQuestion: item.form === 'group',
      prompt: verb.masu,
      meaning: verb.meaning,
      formLabel: item.form === 'group' ? 'Qual é o grupo?' : FORM_LABEL[item.form]
    };
    this.phase = 'asking';
    this.hintsShown = 0;
    this.lastResult = null;
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

    this.answered += 1;
    if (correct) this.correct += 1;

    const fkey = cur.form;
    this.perForm[fkey] = this.perForm[fkey] || { seen: 0, right: 0 };
    this.perForm[fkey].seen += 1;
    if (correct) this.perForm[fkey].right += 1;

    recordAnswer({
      verbId: cur.verbId,
      form: cur.form,
      correct,
      hinted,
      dontKnow,
      answer: rawAnswer,
      reason: diagnosis?.message || null
    });

    if (!correct) {
      this.wrongItems.push({ verbId: cur.verbId, form: cur.form });
      /* Volta para a fila entre 3 e 7 questões à frente (§33) — mas não
         depois da meta: a fila está congelada e reapresentar aqui só
         esticaria a sessão artificialmente. O erro continua registrado
         no progresso e volta nas próximas sessões. */
      if (!this.plannedTimeReached) {
        this.queue = requeue(this.queue, { verbId: cur.verbId, form: cur.form });
      }
    }

    this.lastResult = {
      correct,
      dontKnow,
      hinted,
      given: rawAnswer,
      diagnosis,
      explanation: cur.isGroupQuestion ? null : explain(cur.verb, cur.form),
      verb: cur.verb,
      form: cur.form,
      groupAnswer: cur.isGroupQuestion ? cur.verb.group : null
    };
    this.phase = 'feedback';
    this.saveResume();
    return this.lastResult;
  }

  /* ---------------- fim ---------------- */
  summary() {
    return {
      mode: this.config.mode,
      answered: this.answered,
      correct: this.correct,
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
    if (s.answered > 0) recordSession(s);
    clearResume();
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

  /* §17 "Continuar treino" — o suficiente para reconstruir a sessão
     depois de um refresh. */
  saveResume() {
    if (this.phase === 'done') return;
    setResume({
      config: { ...this.config, queue: undefined },
      queue: (this.current && this.phase === 'asking'
        ? [{ verbId: this.current.verbId, form: this.current.form }, ...this.queue]
        : this.queue.slice()),
      answered: this.answered,
      correct: this.correct,
      perForm: this.perForm,
      wrongItems: this.wrongItems,
      startedAt: this.startedAt
    });
  }

  static fromResume(resume) {
    if (!resume?.queue?.length) return null;
    const s = new Session({ ...resume.config, queue: resume.queue });
    s.answered = resume.answered || 0;
    s.correct = resume.correct || 0;
    s.perForm = resume.perForm || {};
    s.wrongItems = resume.wrongItems || [];
    /* O relógio recomeça: uma sessão por tempo retomada amanhã não pode
       nascer expirada. */
    s.startedAt = Date.now();
    return s;
  }
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
