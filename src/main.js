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
   O relógio é de TEMPO ESTUDADO (ver Session.pause/resumeClock). Aqui ficam
   só os gatilhos do navegador:
   · pulso de 1 s (heartbeat) — o excesso de um intervalo longo sem pulso
     (sistema dormindo) não conta; a cada 10 s de estudo a sessão é gravada;
   · página oculta / fechada / congelada — pausa e grava na hora. Não se
     depende só de beforeunload, que o celular frequentemente não dispara. */
const activeSession = () => {
  const s = app.session;
  return s && s.phase !== 'done' && typeof s.pause === 'function' ? s : null;
};
let lastQuietSave = 0;
setInterval(() => {
  const s = activeSession();
  if (!s || app.view !== 'practice') return;
  s.heartbeat();
  if (!s.paused && Date.now() - lastQuietSave >= 10_000) { s.saveQuiet(); lastQuietSave = Date.now(); }
}, 1000);
function pauseAndSave() {
  const s = activeSession();
  if (!s) return;
  s.heartbeat(); s.pause(); s.saveQuiet();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') pauseAndSave();
  else if (activeSession() && app.view === 'practice' && !app.dialog) activeSession().resumeClock();
});
window.addEventListener('pagehide', pauseAndSave);
window.addEventListener('beforeunload', pauseAndSave);
document.addEventListener('freeze', pauseAndSave);

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
