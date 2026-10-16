/* ===================================================================
   活用ラボ — backup manual do progresso (exportar / importar).

   Complementar à sincronização, não substituto: a sincronização mantém
   o progresso entre dispositivos através da conta; o backup é um arquivo
   que o usuário controla e que funciona sem conta nenhuma.

   O arquivo carrega SÓ progresso. Nada de token, cookie, sessão do
   Identity ou credencial — a lista PROGRESS_FIELDS do store é fechada, e
   os metadados de autenticação vivem em outra chave do localStorage, que
   este módulo nunca lê.
   =================================================================== */

import {
  getState, replaceState, snapshotState, sanitizeProgress, PROGRESS_FIELDS
} from './store.js';

export const APP_ID = 'katsuyou-lab';
export const EXPORT_FORMAT_VERSION = 1;
/* Formatos que sabemos ler. Cresce quando o envelope mudar. */
export const SUPPORTED_FORMATS = [1];

/* Limites contra arquivos absurdos. Não são regras de negócio: são o que
   impede um JSON gigante de travar a aba antes mesmo do saneamento. */
export const MAX_BACKUP_BYTES = 4 * 1024 * 1024;
const MAX_PAIRS = 5000;
const MAX_LIST = 5000;

/* Razões curtas, do jeito que aparecem na interface (§16). */
export const REASONS = {
  notJson: 'arquivo inválido',
  notObject: 'arquivo inválido',
  otherApp: 'backup de outro aplicativo',
  badFormat: 'versão não suportada',
  noProgress: 'arquivo inválido',
  tooLarge: 'arquivo grande demais'
};

/* -------------------------------------------------------------------
   Exportar
   ------------------------------------------------------------------- */

/* Recorta o estado pelos campos declarados de progresso. É aqui que a
   exclusão de dados de autenticação acontece por construção. */
export function progressPayload(state = getState()) {
  const out = {};
  for (const field of PROGRESS_FIELDS) {
    if (state[field] !== undefined) out[field] = state[field];
  }
  return JSON.parse(JSON.stringify(out));
}

export function buildBackup(state = getState(), now = new Date()) {
  return {
    app: APP_ID,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    progress: progressPayload(state)
  };
}

export function backupJson(state = getState(), now = new Date()) {
  return JSON.stringify(buildBackup(state, now), null, 2);
}

export function backupFilename(now = new Date()) {
  const p = n => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  return `${APP_ID}-progresso-${date}.json`;
}

/* -------------------------------------------------------------------
   Validar
   ------------------------------------------------------------------- */

/**
 * parseBackup(text) → { ok: true, progress, backup } | { ok: false, reason }
 *
 * Valida o envelope ANTES de tocar em qualquer estado. Só JSON.parse —
 * nunca eval, nunca Function.
 */
export function parseBackup(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: REASONS.notJson };
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, reason: REASONS.tooLarge };

  let backup;
  try { backup = JSON.parse(text); }
  catch { return { ok: false, reason: REASONS.notJson }; }

  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    return { ok: false, reason: REASONS.notObject };
  }
  if (backup.app !== APP_ID) return { ok: false, reason: REASONS.otherApp };
  if (!SUPPORTED_FORMATS.includes(backup.formatVersion)) {
    return { ok: false, reason: REASONS.badFormat };
  }

  const progress = backup.progress;
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
    return { ok: false, reason: REASONS.noProgress };
  }
  if (progress.pairs && typeof progress.pairs === 'object' &&
      Object.keys(progress.pairs).length > MAX_PAIRS) {
    return { ok: false, reason: REASONS.tooLarge };
  }
  for (const list of ['recentErrors', 'sessions']) {
    if (Array.isArray(progress[list]) && progress[list].length > MAX_LIST) {
      return { ok: false, reason: REASONS.tooLarge };
    }
  }

  return { ok: true, backup, progress };
}

/* Resumo do que o arquivo traz, para a tela de confirmação. */
export function describeBackup(progress) {
  const clean = sanitizeProgress(progress);
  const pairs = Object.keys(clean.pairs).length;
  const groups = Object.keys(clean.groupPractice).length;
  return {
    pairs,
    groups,
    sessions: clean.sessions.length,
    exportedAt: null,
    text: `${pairs} ${pairs === 1 ? 'combinação praticada' : 'combinações praticadas'}` +
          (groups ? ` · ${groups} ${groups === 1 ? 'verbo' : 'verbos'} no treino de grupos` : '')
  };
}

/* -------------------------------------------------------------------
   Importar
   ------------------------------------------------------------------- */

/**
 * Substitui o progresso local. Do ponto de vista do usuário é atômico:
 * o estado anterior fica guardado e volta se algo falhar no caminho.
 *
 * Não fala com a rede. `replaceState` grava no localStorage e avisa a
 * camada de sincronização, que cuida do envio pelo fluxo normal (§11).
 */
export function applyBackup(progress) {
  const before = snapshotState();
  try {
    replaceState(progress);
    return { ok: true };
  } catch (err) {
    /* Falhou depois de mexer no estado: devolve o que havia antes. */
    try { replaceState(before); } catch { /* nada mais a fazer */ }
    return { ok: false, reason: 'arquivo inválido', error: err };
  }
}

/** Caminho completo: texto do arquivo → estado substituído. */
export function importBackupText(text) {
  const parsed = parseBackup(text);
  if (!parsed.ok) return parsed;
  const applied = applyBackup(parsed.progress);
  if (!applied.ok) return applied;
  return { ok: true, backup: parsed.backup };
}

/* -------------------------------------------------------------------
   Ponte com o navegador (não usada nos testes de unidade)
   ------------------------------------------------------------------- */

/** Entrega o arquivo ao usuário. Devolve o nome usado. */
export function downloadBackup(doc = document, now = new Date()) {
  const json = backupJson(getState(), now);
  const name = backupFilename(now);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 1000);
  return name;
}

/** Lê um File/Blob como texto, com fallback para navegadores antigos. */
export function readFileText(file) {
  if (file && typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read error'));
    reader.readAsText(file);
  });
}
