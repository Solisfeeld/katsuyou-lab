/* ===================================================================
   活用ラボ — ponto de entrada.
   =================================================================== */

import './styles.css';
import { App } from './ui/app.js';
import { getState } from './progress/store.js';

const root = document.getElementById('app');
const app = new App(root);

/* Exposto para a camada de sincronização, que é opcional e vive fora do
   motor pedagógico (mesmo desenho do Bunpou Lab). */
window.KatsuyouApp = app;

/* Reagir a mudança de tema do sistema quando o modo é "auto". */
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  if (app.theme === 'auto') app.applyTheme('auto');
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
