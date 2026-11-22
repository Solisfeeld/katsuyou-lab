/* ===================================================================
   活用ラボ — kanji e furigana na APRESENTAÇÃO.

   O banco continua em kana (é o que o motor conjuga e o que o
   check-content confere). Esta camada só decide como uma forma é
   DESENHADA: com o kanji do verbo e a leitura por cima.

   · Kanji permitidos: exatamente o conjunto autorizado do Bunpou Lab
     (JK_KNOWN — kanji estudados + os confirmados no material Rikai). Um
     verbo cujo kanji não está nesse conjunto continua em kana.
   · A leitura vem do PRÓPRIO texto conjugado, nunca de uma leitura fixa:
     来る → く, 来た → き, 来ない → こ.
   · Nada aqui toca em avaliação, progresso ou gabarito. O campo de
     resposta continua sendo texto puro; ver normalize.js para a aceitação
     da grafia em kanji.
   =================================================================== */

/* Cópia literal de JK_KNOWN (bunpou-lab/index.html). Manter em sincronia. */
export const KNOWN_KANJI = new Set((
  '一二三四五六七八九十百千万億日週月年時間分午前後今先来毎人男女子母父友本気生車語耳手足目口店駅道国学校名円半全何' +
  '火水木金土海川山花天空晴雨雪雲風電外内上下右左中北西東南見聞書言話読行買出入食飲休会多少古新大小長短遠近白黒高安' +
  '魚肉卵時分半言話読見聞書東西南北口買金百円千万行来会休本京' +
  '私父母子男女人何国外語英中好本読書春夏秋冬今花海山川今日天気晴雨雪雲風空町店人気多少高安広道通右左一二赤青黒白' +
  '時間場所駅日出待止食事仕前後朝昼夜乗学校小中高大先生年勉強文化音楽旅行留友週回物飲茶酒作持願料理味色野菜少入会社本支張空港発到着午' +
  '自分電話気車送使借体頭目口耳手足上下毎末元起歩走泳祝誕結婚絵写真計着来去家思'
).split(''));

/* Grafia de cada verbo: sequência de segmentos.
     { k: kanji, r: [leituras possíveis] }  — a leitura é escolhida pelo texto
     { t: 'kana' }                          — trecho literal
   Tudo o que vem depois do último segmento é okurigana em kana.
   Verbos ausentes daqui (かえります, はたらきます…) usam kanji fora do
   conjunto autorizado e ficam em kana. */
const S = (k, ...r) => ({ k, r });
export const VERB_KANJI = {
  kaimasu: [S('買', 'か')], machimasu: [S('待', 'ま')], yomimasu: [S('読', 'よ')],
  nomimasu: [S('飲', 'の')], yasumimasu: [S('休', 'やす')], kakimasu: [S('書', 'か')],
  kikimasu: [S('聞', 'き')], arukimasu: [S('歩', 'ある')], oyogimasu: [S('泳', 'およ')],
  hanashimasu: [S('話', 'はな')], tsukurimasu: [S('作', 'つく')], hashirimasu: [S('走', 'はし')],
  hairimasu: [S('入', 'はい')], norimasu: [S('乗', 'の')], tsukaimasu: [S('使', 'つか')],
  omoimasu: [S('思', 'おも')], iimasu: [S('言', 'い')], ikimasu: [S('行', 'い')],
  tabemasu: [S('食', 'た')], dekakemasu: [S('出', 'で')], mimasu: [S('見', 'み')],
  okimasu: [S('起', 'お')], kimasu_kiru: [S('着', 'き')],
  /* 来る: a leitura muda com a forma — き(ます／て／た), く(る), こ(ない) */
  kimasu_kuru: [S('来', 'き', 'く', 'こ')],
  benkyoushimasu: [S('勉強', 'べんきょう')],
  mottekimasu: [S('持', 'も'), { t: 'って' }, S('来', 'き', 'く', 'こ')]
};

/* Toda grafia declarada precisa caber no conjunto autorizado. */
for (const [id, segs] of Object.entries(VERB_KANJI)) {
  for (const sg of segs) {
    if (sg.k && [...sg.k].some(c => !KNOWN_KANJI.has(c))) {
      throw new Error(`Kanji fora do conjunto autorizado em ${id}: ${sg.k}`);
    }
  }
}

/**
 * Divide uma forma em kana (ex.: 'のんだり') em partes de apresentação:
 *   [{ kanji:'飲', reading:'の' }, { kana:'んだり' }]
 * Devolve null quando o verbo não tem grafia autorizada ou quando o texto
 * não começa como a grafia prevê (um passo intermediário da explicação,
 * por exemplo) — nesse caso o texto fica em kana, sem risco de leitura errada.
 */
export function rubyParts(verbId, kana) {
  const segs = VERB_KANJI[verbId];
  if (!segs || typeof kana !== 'string' || !kana) return null;
  const out = [];
  let i = 0;
  for (const sg of segs) {
    if (sg.t) {
      if (!kana.startsWith(sg.t, i)) return null;
      out.push({ kana: sg.t });
      i += sg.t.length;
      continue;
    }
    const r = sg.r.find(x => kana.startsWith(x, i));
    if (!r) return null;
    out.push({ kanji: sg.k, reading: r });
    i += r.length;
  }
  if (i < kana.length) out.push({ kana: kana.slice(i) });
  return out;
}

/** Grafia em kanji, sem leitura (ex.: '飲んだり'). null se não houver. */
export function kanjiSpelling(verbId, kana) {
  const parts = rubyParts(verbId, kana);
  if (!parts) return null;
  return parts.map(p => p.kanji || p.kana).join('');
}
