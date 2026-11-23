/* ===================================================================
   活用ラボ — ponto de entrada.
   =================================================================== */

import './styles.css';
import { App } from './ui/app.js';
import { getState, STORAGE_KEY } from './progress/store.js';

const root = document.getElementById('app');
const app = new App(root);

/* Exposto para a camada de sincronização, que é opcional e vive fora do
   motor pedagógico (mesmo desenho do Bunpou Lab). */
window.KatsuyouApp = app;

/* Reagir a mudança de tema do sistema quando o modo é "auto". */
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  if (app.theme === 'auto') app.applyTheme('auto');
});

/* ---------------- sessão em andamento: relógio e gravação ----------------
   O relógio conta o tempo da SESSÃO ABERTA (ver Session.pause/resumeClock).
   Aba oculta não é sessão encerrada: trocar de aba, minimizar o navegador
   ou abrir outro aplicativo NÃO pausa. Como elapsedMs é calculado por
   tempo absoluto (agora − startedAt), o navegador reduzir ou suspender os
   timers em segundo plano não afeta a contagem.
   Gatilhos do navegador:
   · a cada 10 s de sessão, grava (sem disparar a sincronização);
   · aba oculta, `freeze` e `beforeunload`: só gravam na hora — o sistema
     pode descartar a aba em segundo plano;
   · `pagehide` (página descarregada: aba/navegador fechados, atualização,
     navegação para outro site): pausa e grava; se a página voltar do
     bfcache (`pageshow`), o relógio segue sem somar o intervalo fora. */
const activeSession = () => {
  const s = app.session;
  return s && s.phase !== 'done' && typeof s.pause === 'function' ? s : null;
};
let lastQuietSave = 0;
setInterval(() => {
  const s = activeSession();
  if (!s || app.view !== 'practice' || s.paused) return;
  if (Date.now() - lastQuietSave >= 10_000) { s.saveQuiet(); lastQuietSave = Date.now(); }
}, 1000);
function saveNow() { activeSession()?.saveQuiet(); }
let unloaded = false;
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
document.addEventListener('freeze', saveNow);
window.addEventListener('beforeunload', saveNow);
window.addEventListener('pagehide', () => {
  const s = activeSession();
  if (!s) return;
  s.pause(); s.saveQuiet(); unloaded = true;
});
window.addEventListener('pageshow', () => {
  if (!unloaded) return;
  unloaded = false;
  const s = activeSession();
  if (s && app.view === 'practice' && !app.dialog) s.resumeClock();
});

/* Outra aba gravou o progresso: esta aba recarrega o estado (para nunca
   gravar por cima do que a outra gravou) e, se a sessão aberta aqui foi
   retomada ou encerrada lá, larga a sessão sem gravar nada. */
window.addEventListener('storage', e => {
  if (e.key === STORAGE_KEY) app.onExternalChange();
});

/* Garante que o estado exista antes do primeiro render. */
getState();
app.render();

/* Carrega autenticação/sincronização se as funções do Netlify existirem.
   Falhar aqui não pode derrubar o treino: o localStorage é a garantia
   primária, exatamente como no Bunpou Lab. */
import('./auth-sync.js')
  .then(() => window.dispatchEvent(new Event('katsuyou-app-ready')))
  .catch(err => {
    /* Silencioso para o usuário, visível para quem for depurar: um erro
       aqui significa apenas que a sincronização não subiu. */
    console.warn('Sincronização indisponível:', err && err.message);
  });
