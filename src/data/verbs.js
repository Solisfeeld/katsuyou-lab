/* ===================================================================
   活用ラボ — banco de verbos.

   REGRA DE OURO: só entra aqui verbo encontrado nos materiais Rikai.
   Nada de lista genérica de N5. Cada entrada declara:

     lessons  — lições do Básico Rikai em que o verbo aparece
     attested — formas que o Rikai MOSTRA explicitamente (tabela ou texto).
                As demais são calculadas pela regra do Rikai e conferidas
                pelo check-content contra o motor.
     kanji    — só quando a grafia aparece de fato no Rikai. §11: "Se o
                Rikai apresentar apenas kana, não invente kanji."
     notTaught— formas que o Rikai NÃO sustenta para este verbo; ficam
                fora da prática e da matriz de domínio.

   Fontes das tabelas:
     Lição 01 → grupos + forma て      Lição 02 → forma de dicionário
     Lição 13 → forma た               Lição 15 → forma ない
     Lição 16 → "V たり、V たり しています", de onde vem たり (forma た + り)
     Lições 16/17/18 → forma simples, de onde vem なかった
   =================================================================== */

export const VERBS = [
  /* ============================ GRUPO 1 ============================ */
  {
    id: 'kaimasu', masu: 'かいます', kanji: '買います', meaning: 'comprar', group: 1,
    dictionary: 'かう', te: 'かって', ta: 'かった', tari: 'かったり', nai: 'かわない', nakatta: 'かわなかった',
    lessons: ['L01', 'L02', 'L15'], attested: ['te', 'dictionary', 'nai'],
    irregular: false,
    note: 'い antes de ます: na forma ない vira わ, não あ.'
  },
  {
    id: 'machimasu', masu: 'まちます', kanji: null, meaning: 'esperar', group: 1,
    dictionary: 'まつ', te: 'まって', ta: 'まった', tari: 'まったり', nai: 'またない', nakatta: 'またなかった',
    lessons: ['L01', 'L02', 'L15'], attested: ['te', 'dictionary', 'nai'],
    irregular: false
  },
  {
    id: 'arimasu', masu: 'あります', kanji: null, meaning: 'ter, haver', group: 1,
    dictionary: 'ある', te: 'あって', ta: 'あった', tari: 'あったり', nai: null, nakatta: null,
    lessons: ['L01', 'L02'], attested: ['te', 'dictionary'],
    irregular: false,
    /* O Rikai lista あります nas tabelas de forma て (L01) e de dicionário
       (L02), mas NÃO na tabela da forma ない (L15) — e em todo o corpus a
       negativa de あります aparece só como ありません (forma polida).
       Como ある tem negativa suplectiva (ない/なかった), que o Rikai não
       ensina, este verbo não é treinado nessas duas formas. */
    notTaught: ['nai', 'nakatta'],
    notTaughtReason:
      'O Rikai apresenta あります nas tabelas das formas て e de dicionário, ' +
      'mas não na tabela da forma ない — no material a negativa aparece apenas ' +
      'como ありません. Por isso as formas ない e なかった deste verbo ficam fora do treino.'
  },
  {
    id: 'shinimasu', masu: 'しにます', kanji: null, meaning: 'morrer', group: 1,
    dictionary: 'しぬ', te: 'しんで', ta: 'しんだ', tari: 'しんだり', nai: 'しなない', nakatta: 'しななかった',
    lessons: ['L01', 'L02', 'L15'], attested: ['te', 'dictionary', 'nai'],
    irregular: false
  },
  {
    id: 'asobimasu', masu: 'あそびます', kanji: null, meaning: 'brincar', group: 1,
    dictionary: 'あそぶ', te: 'あそんで', ta: 'あそんだ', tari: 'あそんだり', nai: 'あそばない', nakatta: 'あそばなかった',
    lessons: ['L01', 'L02', 'L15', 'L17'], attested: ['te', 'dictionary', 'nai'],
    irregular: false
  },
  {
    id: 'yomimasu', masu: 'よみます', kanji: '読みます', meaning: 'ler', group: 1,
    dictionary: 'よむ', te: 'よんで', ta: 'よんだ', tari: 'よんだり', nai: 'よまない', nakatta: 'よまなかった',
    lessons: ['L01', 'L02', 'L09', 'L15'], attested: ['te', 'dictionary', 'nai'],
    irregular: false
  },
  {
    id: 'nomimasu', masu: 'のみます', kanji: '飲みます', meaning: 'beber', group: 1,
    dictionary: 'のむ', te: 'のんで', ta: 'のんだ', tari: 'のんだり', nai: 'のまない', nakatta: 'のまなかった',
    lessons: ['L01', 'L02', 'L10', 'L15', 'L17', 'L18'],
    /* のまなかった aparece literalmente na Lição 18:
       "のみませんでした → のまなかったと 思います". */
    attested: ['nai', 'nakatta'],
    irregular: false
  },
  {
    id: 'yasumimasu', masu: 'やすみます', kanji: '休みます', meaning: 'descansar, faltar', group: 1,
    dictionary: 'やすむ', te: 'やすんで', ta: 'やすんだ', tari: 'やすんだり', nai: 'やすまない', nakatta: 'やすまなかった',
    lessons: ['L15', 'L18'], attested: ['dictionary'],
    irregular: false
  },
  {
    id: 'kakimasu', masu: 'かきます', kanji: null, meaning: 'escrever', group: 1,
    dictionary: 'かく', te: 'かいて', ta: 'かいた', tari: 'かいたり', nai: 'かかない', nakatta: 'かかなかった',
    lessons: ['L01', 'L02', 'L15'], attested: ['te', 'dictionary', 'nai'],
    irregular: false
  },
  {
    id: 'kikimasu', masu: 'ききます', kanji: '聞きます', meaning: 'ouvir, escutar', group: 1,
    dictionary: 'きく', te: 'きいて', ta: 'きいた', tari: 'きいたり', nai: 'きかない', nakatta: 'きかなかった',
    lessons: ['L02', 'L05', 'L06', 'L12'], attested: ['dictionary'],
    irregular: false,
    note: 'き antes de ます, mas Grupo 1 — compare com おきます, que é Grupo 2.'
  },
  {
    id: 'hatarakimasu', masu: 'はたらきます', kanji: null, meaning: 'trabalhar', group: 1,
    dictionary: 'はたらく', te: 'はたらいて', ta: 'はたらいた', tari: 'はたらいたり', nai: 'はたらかない', nakatta: 'はたらかなかった',
    lessons: ['L02', 'L14'], attested: ['te'],
    irregular: false
  },
  {
    id: 'arukimasu', masu: 'あるきます', kanji: '歩きます', meaning: 'andar, caminhar', group: 1,
    dictionary: 'あるく', te: 'あるいて', ta: 'あるいた', tari: 'あるいたり', nai: 'あるかない', nakatta: 'あるかなかった',
    lessons: ['L06', 'L16'], attested: ['te', 'ta', 'tari'],
    irregular: false
  },
  {
    id: 'oyogimasu', masu: 'およぎます', kanji: '泳ぎます', meaning: 'nadar', group: 1,
    dictionary: 'およぐ', te: 'およいで', ta: 'およいだ', tari: 'およいだり', nai: 'およがない', nakatta: 'およがなかった',
    lessons: ['L01', 'L02', 'L15', 'L16'], attested: ['te', 'dictionary', 'ta', 'nai', 'tari'],
    irregular: false,
    note: 'Único padrão que produz いで／いだ (sonoro).'
  },
  {
    id: 'hanashimasu', masu: 'はなします', kanji: '話します', meaning: 'falar, conversar', group: 1,
    dictionary: 'はなす', te: 'はなして', ta: 'はなした', tari: 'はなしたり', nai: 'はなさない', nakatta: 'はなさなかった',
    lessons: ['L01', 'L02', 'L15'], attested: ['te', 'dictionary', 'nai'],
    irregular: false,
    note: 'し → して／した: parece o Grupo 3, mas a base はなさ- revela o Grupo 1.'
  },
  {
    id: 'mawashimasu', masu: 'まわします', kanji: null, meaning: 'girar', group: 1,
    dictionary: 'まわす', te: 'まわして', ta: 'まわした', tari: 'まわしたり', nai: 'まわさない', nakatta: 'まわさなかった',
    lessons: ['L15'], attested: ['nai'],
    irregular: false
  },
  {
    id: 'suimasu', masu: 'すいます', kanji: null, meaning: 'fumar, aspirar', group: 1,
    dictionary: 'すう', te: 'すって', ta: 'すった', tari: 'すったり', nai: 'すわない', nakatta: 'すわなかった',
    lessons: ['L15', 'L16'], attested: ['dictionary', 'nai'],
    irregular: false
  },
  {
    id: 'tsukurimasu', masu: 'つくります', kanji: '作ります', meaning: 'fazer, preparar', group: 1,
    dictionary: 'つくる', te: 'つくって', ta: 'つくった', tari: 'つくったり', nai: 'つくらない', nakatta: 'つくらなかった',
    lessons: ['L02', 'L04', 'L11', 'L17'], attested: ['te'],
    irregular: false
  },
  {
    id: 'torimasu', masu: 'とります', kanji: null, meaning: 'tirar, pegar', group: 1,
    dictionary: 'とる', te: 'とって', ta: 'とった', tari: 'とったり', nai: 'とらない', nakatta: 'とらなかった',
    lessons: ['L02'], attested: [],
    irregular: false
  },
  {
    id: 'hashirimasu', masu: 'はしります', kanji: '走ります', meaning: 'correr', group: 1,
    dictionary: 'はしる', te: 'はしって', ta: 'はしった', tari: 'はしったり', nai: 'はしらない', nakatta: 'はしらなかった',
    lessons: ['L15', 'L16'], attested: ['ta', 'nai', 'tari'],
    irregular: false
  },
  {
    id: 'kaerimasu', masu: 'かえります', kanji: null, meaning: 'voltar', group: 1,
    dictionary: 'かえる', te: 'かえって', ta: 'かえった', tari: 'かえったり', nai: 'かえらない', nakatta: 'かえらなかった',
    lessons: ['L08'], attested: [],
    irregular: false
  },
  {
    id: 'hairimasu', masu: 'はいります', kanji: '入ります', meaning: 'entrar', group: 1,
    dictionary: 'はいる', te: 'はいって', ta: 'はいった', tari: 'はいったり', nai: 'はいらない', nakatta: 'はいらなかった',
    lessons: ['L15'], attested: ['te', 'dictionary'],
    irregular: false
  },
  {
    id: 'norimasu', masu: 'のります', kanji: null, meaning: 'tomar, andar de (veículo)', group: 1,
    dictionary: 'のる', te: 'のって', ta: 'のった', tari: 'のったり', nai: 'のらない', nakatta: 'のらなかった',
    lessons: ['L06'], attested: [],
    irregular: false
  },
  {
    id: 'odorimasu', masu: 'おどります', kanji: null, meaning: 'dançar', group: 1,
    dictionary: 'おどる', te: 'おどって', ta: 'おどった', tari: 'おどったり', nai: 'おどらない', nakatta: 'おどらなかった',
    lessons: ['L02'], attested: [],
    irregular: false
  },
  {
    id: 'tsukaimasu', masu: 'つかいます', kanji: '使います', meaning: 'usar', group: 1,
    dictionary: 'つかう', te: 'つかって', ta: 'つかった', tari: 'つかったり', nai: 'つかわない', nakatta: 'つかわなかった',
    lessons: ['L04', 'L17'], attested: ['te', 'dictionary'],
    irregular: false,
    note: 'い antes de ます: forma ない com わ.'
  },
  {
    id: 'moraimasu', masu: 'もらいます', kanji: null, meaning: 'receber, ganhar', group: 1,
    dictionary: 'もらう', te: 'もらって', ta: 'もらった', tari: 'もらったり', nai: 'もらわない', nakatta: 'もらわなかった',
    lessons: ['L17'], attested: ['ta'],
    irregular: false
  },
  {
    id: 'narimasu', masu: 'なります', kanji: null, meaning: 'tornar-se, ficar', group: 1,
    dictionary: 'なる', te: 'なって', ta: 'なった', tari: 'なったり', nai: 'ならない', nakatta: 'ならなかった',
    lessons: ['L03', 'L04', 'L10', 'L14', 'L15'], attested: ['dictionary'],
    irregular: false
  },
  {
    id: 'omoimasu', masu: 'おもいます', kanji: '思います', meaning: 'achar, pensar', group: 1,
    dictionary: 'おもう', te: 'おもって', ta: 'おもった', tari: 'おもったり', nai: 'おもわない', nakatta: 'おもわなかった',
    lessons: ['L18'], attested: [],
    irregular: false
  },
  {
    id: 'iimasu', masu: 'いいます', kanji: '言います', meaning: 'dizer', group: 1,
    dictionary: 'いう', te: 'いって', ta: 'いった', tari: 'いったり', nai: 'いわない', nakatta: 'いわなかった',
    lessons: ['L01', 'L13', 'L18'], attested: ['te'],
    irregular: false,
    note: 'いって é também a forma て de いきます — os dois verbos coincidem aqui.'
  },
  {
    id: 'sumimasu', masu: 'すみます', kanji: null, meaning: 'morar', group: 1,
    dictionary: 'すむ', te: 'すんで', ta: 'すんだ', tari: 'すんだり', nai: 'すまない', nakatta: 'すまなかった',
    lessons: ['L01'], attested: ['te'],
    irregular: false
  },
  {
    id: 'yorokobimasu', masu: 'よろこびます', kanji: null, meaning: 'alegrar-se, ficar contente', group: 1,
    dictionary: 'よろこぶ', te: 'よろこんで', ta: 'よろこんだ', tari: 'よろこんだり', nai: 'よろこばない', nakatta: 'よろこばなかった',
    lessons: ['L18'], attested: ['dictionary'],
    irregular: false
  },
  {
    id: 'ikimasu', masu: 'いきます', kanji: '行きます', meaning: 'ir', group: 1,
    dictionary: 'いく', te: 'いって', ta: 'いった', tari: 'いったり', nai: 'いかない', nakatta: 'いかなかった',
    lessons: ['L01', 'L02', 'L13', 'L18'], attested: ['te', 'dictionary', 'ta'],
    /* ★ A exceção que o Rikai marca com estrela nas Lições 01 e 13. */
    irregular: true,
    irregularForms: ['te', 'ta'],
    note: 'Exceção do Grupo 1: antes de ます vem き, mas a forma て é いって (não いいて) e a た é いった (não いいた).'
  },

  /* ============================ GRUPO 2 ============================ */
  {
    id: 'tabemasu', masu: 'たべます', kanji: '食べます', meaning: 'comer', group: 2,
    dictionary: 'たべる', te: 'たべて', ta: 'たべた', tari: 'たべたり', nai: 'たべない', nakatta: 'たべなかった',
    lessons: ['L01', 'L02', 'L11', 'L15', 'L16'],
    /* たべなかった está na tabela da forma simples da Lição 16. */
    attested: ['te', 'dictionary', 'ta', 'nai', 'nakatta'],
    irregular: false
  },
  {
    id: 'agemasu', masu: 'あげます', kanji: null, meaning: 'dar', group: 2,
    dictionary: 'あげる', te: 'あげて', ta: 'あげた', tari: 'あげたり', nai: 'あげない', nakatta: 'あげなかった',
    lessons: ['L01', 'L17'], attested: ['dictionary'],
    irregular: false
  },
  {
    id: 'dekakemasu', masu: 'でかけます', kanji: null, meaning: 'sair', group: 2,
    dictionary: 'でかける', te: 'でかけて', ta: 'でかけた', tari: 'でかけたり', nai: 'でかけない', nakatta: 'でかけなかった',
    lessons: ['L01'], attested: [],
    irregular: false
  },
  {
    id: 'nemasu', masu: 'ねます', kanji: null, meaning: 'dormir', group: 2,
    dictionary: 'ねる', te: 'ねて', ta: 'ねた', tari: 'ねたり', nai: 'ねない', nakatta: 'ねなかった',
    lessons: ['L01', 'L02', 'L15'], attested: ['dictionary', 'nai'],
    irregular: false,
    note: 'Só um hiragana antes de ます — Grupo 2, tipo (ii).'
  },
  {
    id: 'mimasu', masu: 'みます', kanji: '見ます', meaning: 'ver, assistir', group: 2,
    dictionary: 'みる', te: 'みて', ta: 'みた', tari: 'みたり', nai: 'みない', nakatta: 'みなかった',
    lessons: ['L01', 'L02', 'L08', 'L09', 'L10', 'L15'], attested: ['dictionary'],
    irregular: false,
    note: 'Só um hiragana antes de ます — Grupo 2, tipo (ii).'
  },
  {
    id: 'okimasu', masu: 'おきます', kanji: null, meaning: 'acordar, levantar-se', group: 2,
    dictionary: 'おきる', te: 'おきて', ta: 'おきた', tari: 'おきたり', nai: 'おきない', nakatta: 'おきなかった',
    lessons: ['L01', 'L02', 'L15'], attested: ['te', 'dictionary', 'nai'],
    irregular: false,
    note: 'Grupo 2 tipo (iii): tem /i/ antes de ます como o Grupo 1, mas é Grupo 2. Compare com ききます.'
  },
  {
    id: 'dekimasu', masu: 'できます', kanji: null, meaning: 'conseguir, poder', group: 2,
    dictionary: 'できる', te: 'できて', ta: 'できた', tari: 'できたり', nai: 'できない', nakatta: 'できなかった',
    lessons: ['L01'], attested: [],
    irregular: false,
    note: 'Grupo 2 tipo (iii): /i/ antes de ます, mas Grupo 2.'
  },
  {
    id: 'oshiemasu', masu: 'おしえます', kanji: null, meaning: 'ensinar', group: 2,
    dictionary: 'おしえる', te: 'おしえて', ta: 'おしえた', tari: 'おしえたり', nai: 'おしえない', nakatta: 'おしえなかった',
    lessons: ['L01', 'L09'], attested: ['te'],
    irregular: false
  },
  {
    id: 'imasu', masu: 'います', kanji: null, meaning: 'estar, haver (seres vivos)', group: 2,
    dictionary: 'いる', te: 'いて', ta: 'いた', tari: 'いたり', nai: 'いない', nakatta: 'いなかった',
    lessons: ['L01', 'L02', 'L15'], attested: ['te', 'dictionary', 'nai'],
    irregular: false,
    note: 'Só um hiragana antes de ます — Grupo 2, tipo (ii).'
  },
  {
    id: 'kimasu_kiru', masu: 'きます', kanji: '着ます', meaning: 'vestir, usar (roupa)', group: 2,
    dictionary: 'きる', te: 'きて', ta: 'きた', tari: 'きたり', nai: 'きない', nakatta: 'きなかった',
    lessons: ['L01', 'L17'], attested: ['dictionary'],
    irregular: false,
    note: 'Mesma forma ます de きます (vir), que é Grupo 3. Aqui: きる／きない. Lá: くる／こない.'
  },
  {
    id: 'atsumemasu', masu: 'あつめます', kanji: null, meaning: 'colecionar, juntar', group: 2,
    dictionary: 'あつめる', te: 'あつめて', ta: 'あつめた', tari: 'あつめたり', nai: 'あつめない', nakatta: 'あつめなかった',
    lessons: ['L02'], attested: ['te'],
    irregular: false
  },
  {
    id: 'kuremasu', masu: 'くれます', kanji: null, meaning: 'dar (a mim)', group: 2,
    dictionary: 'くれる', te: 'くれて', ta: 'くれた', tari: 'くれたり', nai: 'くれない', nakatta: 'くれなかった',
    lessons: ['L07', 'L17'], attested: ['te'],
    irregular: false
  },
  {
    id: 'okuremasu', masu: 'おくれます', kanji: null, meaning: 'atrasar-se', group: 2,
    dictionary: 'おくれる', te: 'おくれて', ta: 'おくれた', tari: 'おくれたり', nai: 'おくれない', nakatta: 'おくれなかった',
    lessons: ['L07'], attested: ['te'],
    irregular: false
  },

  /* ============================ GRUPO 3 ============================ */
  {
    id: 'shimasu', masu: 'します', kanji: null, meaning: 'fazer', group: 3,
    dictionary: 'する', te: 'して', ta: 'した', tari: 'したり', nai: 'しない', nakatta: 'しなかった',
    lessons: ['L01', 'L02', 'L13', 'L15', 'L16'],
    attested: ['te', 'dictionary', 'ta', 'nai', 'tari'],
    irregular: true
  },
  {
    id: 'kimasu_kuru', masu: 'きます', kanji: null, meaning: 'vir', group: 3,
    dictionary: 'くる', te: 'きて', ta: 'きた', tari: 'きたり', nai: 'こない', nakatta: 'こなかった',
    lessons: ['L01', 'L02', 'L13', 'L15'],
    attested: ['te', 'dictionary', 'ta', 'nai'],
    irregular: true,
    /* O Rikai escreve este verbo sempre em kana nas lições de flexão; a
       grafia 来ます não aparece no corpus, então não há campo kanji (§11). */
    note: 'Mesma forma ます de きます (vestir), que é Grupo 2. Aqui: くる／こない. Lá: きる／きない.'
  },
  {
    id: 'benkyoushimasu', masu: 'べんきょうします', kanji: null, meaning: 'estudar', group: 3,
    dictionary: 'べんきょうする', te: 'べんきょうして', ta: 'べんきょうした', tari: 'べんきょうしたり',
    nai: 'べんきょうしない', nakatta: 'べんきょうしなかった',
    lessons: ['L01', 'L02'], attested: ['te', 'dictionary'],
    irregular: true,
    note: 'Substantivo + します: só a parte します flexiona.'
  },
  {
    id: 'mottekimasu', masu: 'もってきます', kanji: null, meaning: 'trazer', group: 3,
    dictionary: 'もってくる', te: 'もってきて', ta: 'もってきた', tari: 'もってきたり',
    nai: 'もってこない', nakatta: 'もってこなかった',
    lessons: ['L01', 'L02', 'L11'], attested: ['te', 'dictionary'],
    irregular: true,
    /* A Lição 01 glosa もってきます como "trazer" na tabela de grupos e como
       "levar" na tabela da forma て. Registrado como no material. */
    note: 'Verbo composto com きます: só a parte きます flexiona. O Rikai glosa como “trazer” (e, na tabela da forma て, como “levar”).'
  }
];

/* Índice por id — o id é a chave de progresso, então precisa ser único. */
export const VERBS_BY_ID = VERBS.reduce((acc, v) => { acc[v.id] = v; return acc; }, {});

export function verbById(id) { return VERBS_BY_ID[id] || null; }

/* Formas realmente treináveis deste verbo (exclui as não sustentadas). */
export function trainableForms(verb, allForms) {
  const off = new Set(verb.notTaught || []);
  return allForms.filter(f => !off.has(f));
}

export const VERB_COUNT = VERBS.length;
