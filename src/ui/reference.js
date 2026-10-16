/* ===================================================================
   活用ラボ — referência rápida (§48).

   Uma página compacta, não uma enciclopédia. Toda regra abaixo foi
   transcrita das lições do Básico Rikai listadas em data/sources.js.
   A explicação de uso da Forma たり também se apoia numa fonte
   complementar, citada no rodapé da seção (campo complement) e
   detalhada em AUDITORIA.md.
   =================================================================== */

import { h, backRow } from './dom.js';
import { cite } from '../data/sources.js';

const SECTIONS = [
  {
    id: 'grupos',
    title: 'Os três grupos',
    color: 'var(--ink-soft)',
    source: ['L01', 'L02'],
    build: () => [
      p('O grupo é decidido pelo som que vem imediatamente antes de ます.'),
      table([
        ['Grupo 1', 'O som antes de ます é sempre /i/.', 'かいます・いきます・のみます'],
        ['Grupo 2 (i)', 'O som antes de ます é /e/.', 'たべます・おしえます・あげます・でかけます'],
        ['Grupo 2 (ii)', 'Há apenas um hiragana antes de ます.', 'みます・います・ねます・きます (vestir)'],
        ['Grupo 2 (iii)', 'O som antes de ます é /i/ — poucos verbos; a maioria desse tipo é Grupo 1.', 'おきます・できます'],
        ['Grupo 3', 'Basicamente きます e します, mais os compostos deles.', 'きます・します・もってきます・べんきょうします']
      ]),
      note('Atenção ao par きます: como Grupo 2 é 着ます (vestir) e como Grupo 3 é きます (vir). A forma ます é a mesma; 辞書形 e ない形 separam os dois.')
    ]
  },
  {
    id: 'te',
    title: 'Forma て',
    color: 'var(--f-te)',
    source: ['L01'],
    build: () => [
      p('Flexão terminada em て ou で.'),
      sub('Grupo 1'),
      table([
        ['い・ち・り → って', '', 'かいます → かって ／ まちます → まって ／ あります → あって'],
        ['に・び・み → んで', '', 'しにます → しんで ／ あそびます → あそんで ／ よみます → よんで'],
        ['き → いて', '', 'かきます → かいて'],
        ['ぎ → いで', '', 'およぎます → およいで'],
        ['し → して', '', 'はなします → はなして']
      ]),
      exception('いきます → いって. Antes de ます é き, mas não fica いいて.'),
      sub('Grupo 2'),
      p2('Trocar ます por て: たべます → たべて ／ おきます → おきて ／ います → いて'),
      sub('Grupo 3'),
      p2('きます → きて ／ もってきます → もってきて ／ します → して ／ べんきょうします → べんきょうして')
    ]
  },
  {
    id: 'dictionary',
    title: 'Forma de dicionário（辞書形）',
    color: 'var(--f-dictionary)',
    source: ['L02'],
    build: () => [
      p('É a forma como o verbo aparece no dicionário. Alguns materiais a chamam informalmente de “forma る”, mas muitos verbos não terminam em る — por isso aqui ela é chamada de forma de dicionário.'),
      sub('Grupo 1'),
      p2('O som /i/ antes de ます passa para a linha /u/.'),
      table([
        ['い → う', '', 'かいます → かう'],
        ['ち → つ', '', 'まちます → まつ'],
        ['り → る', '', 'あります → ある'],
        ['に → ぬ', '', 'しにます → しぬ'],
        ['び → ぶ', '', 'あそびます → あそぶ'],
        ['み → む', '', 'よみます → よむ'],
        ['き → く', '', 'かきます → かく'],
        ['ぎ → ぐ', '', 'およぎます → およぐ'],
        ['し → す', '', 'はなします → はなす']
      ]),
      sub('Grupo 2'),
      p2('Trocar ます por る: たべます → たべる ／ おきます → おきる ／ います → いる'),
      sub('Grupo 3'),
      p2('きます → くる ／ もってきます → もってくる ／ します → する ／ べんきょうします → べんきょうする')
    ]
  },
  {
    id: 'ta',
    title: 'Forma た',
    color: 'var(--f-ta)',
    source: ['L13', 'L01'],
    build: () => [
      p('Flexão terminada em た ou だ. O Rikai diz explicitamente: é o mesmo processo da forma て. Se você já sabe a forma て, basta trocar a sílaba final.'),
      table([
        ['って → った', '', 'かいます → かって → かった'],
        ['んで → んだ', '', 'のみます → のんで → のんだ'],
        ['いて → いた', '', 'かきます → かいて → かいた'],
        ['いで → いだ', '', 'およぎます → およいで → およいだ'],
        ['して → した', '', 'はなします → はなして → はなした']
      ]),
      exception('いきます → いった. Antes de ます é き, mas não fica いいた.'),
      sub('Grupo 2'),
      p2('Exclui-se ます e acrescenta-se た: たべます → たべた'),
      sub('Grupo 3'),
      p2('します → した ／ きます → きた')
    ]
  },
  {
    id: 'nai',
    title: 'Forma ない',
    color: 'var(--f-nai)',
    source: ['L15'],
    build: () => [
      p('Exprime a negação.'),
      sub('Grupo 1'),
      p2('O som /i/ antes de ます passa para a linha /a/, e acrescenta-se ない.'),
      table([
        ['ち → た', '', 'まちます → またない'],
        ['り → ら', '', 'はしります → はしらない'],
        ['に → な', '', 'しにます → しなない'],
        ['び → ば', '', 'あそびます → あそばない'],
        ['み → ま', '', 'よみます → よまない'],
        ['き → か', '', 'かきます → かかない'],
        ['ぎ → が', '', 'およぎます → およがない'],
        ['し → さ', '', 'はなします → はなさない']
      ]),
      exception('★ Caso o hiragana antes de ます seja い, ele vira わ, e não あ: かいます → かわない.'),
      sub('Grupo 2'),
      p2('Trocar ます por ない: たべます → たべない ／ おきます → おきない ／ います → いない'),
      sub('Grupo 3'),
      p2('きます → こない ／ します → しない')
    ]
  },
  {
    id: 'tari',
    title: 'Forma たり',
    color: 'var(--f-tari)',
    source: ['L16', 'L13'],
    /* A formação e o exemplo da Lição 16 vêm do Rikai; o uso geral, o
       padrão com する, a flexão no する final e a frase da folga vêm de
       uma fonte complementar (ver AUDITORIA.md). */
    complement: 'Fonte complementar para a explicação',
    build: () => [
      p('Serve para citar algumas ações como exemplos, deixando implícito que podem existir outras. Em vez de contar tudo o que você faz na folga, você cita algumas coisas: “faço coisas como X e Y”.'),
      p2('休みの 日は、本を 読んだり、ゲームを したり します。'),
      p('Nos dias de folga, faço coisas como ler livros e jogar videogame.'),
      sub('Como formar'),
      p2('Forma た + り'),
      p('Faça a Forma た e acrescente り. É igual nos três grupos; para revisar a Forma た, veja a seção dela acima.'),
      table([
        ['Grupo 1', '', 'のみます → のんだ → のんだり'],
        ['Grupo 2', '', 'たべます → たべた → たべたり'],
        ['Grupo 3', '', 'します → した → したり'],
        ['Grupo 3', '', 'きます → きた → きたり']
      ]),
      exception('いきます → いった → いったり. A exceção é a mesma da Forma た.'),
      sub('Padrão da frase'),
      table([
        ['Regra geral', '', 'V たり、V たり する'],
        ['Forma polida', '', 'V たり、V たり します']
      ]),
      sub('O verbo final pode mudar'),
      p('As partes com たり ficam iguais. Quem muda é o する do final.'),
      table([
        ['Não passado', '', '読んだり、したり します'],
        ['Passado', '', '読んだり、したり しました']
      ]),
      p('Nos dois casos, 読んだり e したり não mudam; a flexão aparece no する final.'),
      sub('Exemplo do Básico Rikai — Lição 16'),
      p2('けんこうの ために ヨガを したり、走ったり しています。'),
      p('Faço ioga, pratico corridas (entre outras atividades) para manter a saúde.'),
      p('No exemplo do Rikai, o する do final aparece como しています: “V たり、V たり しています”. Essa é a forma usada nesta frase. たり não precisa terminar sempre em しています: o する do final muda conforme o sentido da frase.'),
      note('No Katsuyou Lab, o treino pede apenas a peça Vたり: のみます → のんだり. Você não precisa montar a frase inteira.')
    ]
  },
  {
    id: 'nakatta',
    title: 'Forma なかった',
    color: 'var(--f-nakatta)',
    source: ['L16', 'L17', 'L18'],
    build: () => [
      p('É o passado negativo da forma simples (ふつうけい). O Rikai não a ensina como uma tabela separada: ela aparece dentro do quadro da forma simples, construída a partir da forma ない.'),
      sub('A regra é uma só, para os três grupos'),
      p2('Chegue à forma ない, retire o い final e acrescente かった.'),
      table([
        ['ない → なかった', '', 'のみます → のまない → のまなかった'],
        ['', '', 'たべます → たべない → たべなかった'],
        ['', '', 'いきます → いかない → いかなかった'],
        ['', '', 'きます → こない → こなかった'],
        ['', '', 'します → しない → しなかった']
      ]),
      note('Quadro da forma simples (Lição 16): não passado afirmativo Vる · não passado negativo Vない · passado afirmativo Vた · passado negativo Vなかった.')
    ]
  },
  {
    id: 'excecoes',
    title: 'Exceções e casos que confundem',
    color: 'var(--shu)',
    source: ['L01', 'L13', 'L15'],
    build: () => [
      table([
        ['いきます', 'Exceção marcada com ★ no Rikai.', 'て → いって ／ た → いった (não いいて ／ いいた). As outras formas seguem a regra: いく・いかない・いかなかった. A Forma たり herda a exceção: いったり.'],
        ['かいます', 'い vira わ na forma ない.', 'かわない ／ かわなかった — nunca かあない.'],
        ['きます', 'Duas palavras com a mesma forma ます.', 'Vir (Grupo 3): くる・こない. Vestir (Grupo 2): きる・きない. Nas formas て e た as duas coincidem: きて・きた.'],
        ['おきます × ききます', 'Ambas têm き antes de ます.', 'おきます é Grupo 2 (おきる・おきない); ききます é Grupo 1 (きく・きかない).'],
        ['はなします', 'Termina em し como o Grupo 3.', 'Mas é Grupo 1: はなす・はなさない. Compare com します → する・しない.'],
        ['あります', 'O Rikai só a apresenta nas formas て e de dicionário.', 'あって ／ ある ／ あった ／ あったり. A negativa aparece no material apenas como ありません, por isso as formas ない e なかった deste verbo ficam fora do treino.']
      ])
    ]
  }
];

export function renderReference(app) {
  const root = h('div', { class: 'wrap' });
  root.appendChild(h('h1', { class: 'page-title', text: 'Referência' }));
  root.appendChild(h('p', { class: 'page-sub', text: 'As regras conforme o Básico Rikai. Toque para abrir.' }));

  SECTIONS.forEach((sec, i) => {
    const body = h('div', { class: 'ref-body', style: { display: i === 0 ? '' : 'none', '--fc': sec.color } });
    sec.build().forEach(n => body.appendChild(n));
    body.appendChild(h('p', {
      class: 'src-line',
      text: sec.source.map(cite).concat(sec.complement || []).join(' · ')
    }));

    const caret = h('span', { class: 'caret', text: i === 0 ? '▲' : '▼' });
    const head = h('button', {
      class: 'ref-head',
      style: { '--fc': sec.color },
      'aria-expanded': String(i === 0),
      onclick: () => {
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : '';
        caret.textContent = open ? '▼' : '▲';
        head.setAttribute('aria-expanded', String(!open));
      }
    },
      h('span', { class: 'dot' }),
      h('span', { text: sec.title }),
      caret
    );

    root.appendChild(h('div', { class: 'ref-sec' }, head, body));
  });

  root.appendChild(backRow(app));
  return root;
}

/* ---- pequenos construtores ---- */
function p(text) { return h('p', { text }); }
function p2(text) { return h('p', { class: 'jp', style: { fontSize: '15px' }, text }); }
function sub(text) {
  return h('p', {
    style: { fontSize: '11.5px', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', fontWeight: '700', margin: '14px 0 4px' },
    text
  });
}
function table(rows) {
  const t = h('table', { class: 'ref-table' });
  rows.forEach(([a, b, c]) => {
    t.appendChild(h('tr',
      { },
      h('td', { text: a }),
      h('td', {}, b ? h('span', { class: 'small muted', text: b }) : null,
        b && c ? h('br') : null,
        c ? h('span', { class: 'jp', style: { fontSize: '14.5px' }, text: c }) : null)
    ));
  });
  return t;
}
function exception(text) { return h('div', { class: 'exc-line', text: `★ ${text}` }); }
function note(text) { return h('div', { class: 'notice', text }); }
