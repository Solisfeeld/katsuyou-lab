# Auditoria das fontes Rikai

Registro do que foi lido nos materiais, o que virou conteúdo do site e o que
ficou deliberadamente de fora. Este documento é a justificativa do banco de
verbos e das regras — se algo aqui mudar, `npm run check-content` deve mudar junto.

Materiais lidos: `03ふくしゅう_Basico1Rikai/` (18 lições + 4 apostilas de flexão) e
`03vamos-relembrar-introdutoriorikai-.../` (18 lições). Extração via `pdftotext -layout`.

---

## 1. As seis formas e suas lições

| Forma | Lição | Arquivo |
|---|---|---|
| Forma て | Lição 01 | `Licao01_verbos1_formaTE_Basico1Rikai.pdf` |
| Forma de dicionário（辞書形） | Lição 02 | `Licao02_verbos2_formaRU_Basico1Rikai.pdf` |
| Forma た | Lição 13 | `Licao13_verbos3_formaTA_Basico1Rikai.pdf` |
| Forma ない | Lição 15 | `Licao15_verbos4_formaNAI_Basico1Rikai.pdf` |
| Forma たり | Lição 16 (seção 1) | `Licao16_Basico1Rikai.pdf` |
| Forma なかった | Lição 16 (reforçada em 17 e 18) | `Licao16/17/18_Basico1Rikai.pdf` |

**Sobre たり** (acrescentada em 2026-09-13, a pedido do usuário). É a única
ocorrência do padrão em todo o corpus Rikai — os demais "たり" encontrados são
あたり (L05) e ひとり／ふたり (Introdutório L04). A Lição 16 abre com
`だい１６か 走ったり、泳いだり しています` e explica:

> Quando deseja enumerar alguns exemplos dentre várias práticas ou hábitos que
> você faz pensando na saúde, utiliza se a expressão "V たり、V たり しています".
> O verbo deverá estar na forma TA (ver lição 13) acrescentando-se "り".

Três pontos da fonte guiaram a modelagem:

- **Não há nome próprio.** O Rikai fala da "expressão V たり、V たり しています";
  "Forma たり" é só o rótulo do app para a peça verbal.
- **O material usa しています**, e só depois do segundo verbo — nem します nem
  する. A resposta treinada é, portanto, a peça `Vたり` sozinha; `のんだりします`
  não é aceita.
- **A relação com a Forma た é explícita** ("forma TA + り"), então o motor
  deriva たり de た sem tabela própria e herda tudo dela, inclusive a exceção
  de いきます (いった → いったり).

Exemplos do material: `ヨガを したり、走ったり しています`,
`ジムで トレーニングを したり、およいだり しています`,
`歩いたり、ジョギングを したり しています`. Os quatro verbos que aparecem com たり
(します, はしります, およぎます, あるきます) têm `tari` em `attested`.

A forma ficou entre ない e なかった porque a Lição 16 apresenta primeiro a
expressão com たり (seção 1) e só depois o quadro da forma simples com なかった.

**Explicação na Referência** (revista em 2026-09-13). A seção たり da página de
Referência começa pelo uso, e não pela fonte: para que serve → uma frase de
exemplo → como formar (Forma た + り) → padrão da frase → o
verbo final pode mudar → exemplo do Básico Rikai → o que o treino cobra. O texto combina duas origens, e o rodapé da seção cita as duas:

| Trecho da seção | Origem |
|---|---|
| Para que serve: citar algumas ações como exemplos, sem esgotar a lista | Rikai L16 ("enumerar alguns exemplos dentre várias práticas ou hábitos"); o enquadramento geral, fora do contexto de saúde, vem da fonte complementar |
| `休みの 日は、本を 読んだり、ゲームを したり します。` | fonte complementar, adaptada — não está no Rikai |
| Forma た + り, tabela por grupo e ★ いきます → いった → いったり | Rikai L16 e L13 |
| Padrão geral `V たり、V たり する` e polido `V たり、V たり します` | fonte complementar |
| A flexão da frase fica no する do final (します／しました) | fonte complementar |
| `けんこうの ために ヨガを したり、走ったり しています。` e a tradução | Rikai L16, apresentado como "Exemplo do Básico Rikai — Lição 16" |
| O treino pede apenas a peça `Vたり` | decisão do app (ver acima) |

A fonte complementar é o texto "Exemplificando ações com たり～たりする", indicado
pelo usuário. O texto não está no repositório: o que se aproveitou foram os pontos
que o usuário descreveu ao pedir a revisão. Ela orienta só a didática dessa
explicação — não muda currículo, formas, motor, dicas, diagnósticos nem o fato de
o Rikai ser a fonte das regras.

**Sobre なかった.** Não existe apostila de flexão para ela. O Rikai a apresenta
dentro do quadro da forma simples (ふつうけい), como passado negativo:

- **Lição 16** traz o quadro completo com `Ｖなかった` e o exemplo `たべなかった`;
- **Lição 17** repete o quadro (`V なかった`) no contexto de `～んです`;
- **Lição 18** repete o quadro e dá a transformação explícita
  `のみませんでした → のまなかった`.

Por isso o motor **deriva** なかった da forma ない em vez de guardar uma tabela
independente, e a explicação sempre passa pela forma ない (§23 do briefing).

**Sobre o nome da 辞書形.** A apostila da Lição 02 se intitula
`る形 ／辞書形 (Forma RU/ forma do dicionário)`. O site usa
"Forma de dicionário（辞書形）" como nome principal e menciona "forma る" apenas
como apelido, porque かう, かく e はなす não terminam em る.

---

## 2. Regras transcritas

**Grupos (Lição 01, revisados na 02)**

- Grupo 1: o som antes de ます é sempre /i/.
- Grupo 2: (i) som /e/ antes de ます; (ii) apenas um hiragana antes de ます;
  (iii) som /i/ antes de ます — poucos verbos, "a maioria deles pertence ao grupo 1".
- Grupo 3: basicamente きます e します, mais os compostos formados com eles.

**Forma て (Lição 01)** — quatro padrões do Grupo 1:
`い・ち・り → って` · `に・び・み → んで` · `き → いて` · `ぎ → いで` · `し → して`.
Grupo 2: ます → て. Grupo 3: きます → きて, します → して.
★ Exceção: `いきます → いって` ("Antes do ます é き, mas não fica いいて").

**辞書形 (Lição 02)** — Grupo 1: linha い → linha う. Grupo 2: ます → る.
Grupo 3: きます → くる, します → する.

**Forma た (Lição 13)** — o próprio material diz que "utilizaremos o mesmo
processo" da forma て: `った / んだ / いた / いだ / した`.
★ Exceção: `いきます → いった`.

**Forma たり (Lição 16)** — Forma た + り, igual nos três grupos:
`のみます → のんだ → のんだり`, `たべます → たべた → たべたり`,
`します → した → したり`, `きます → きた → きたり`.
★ Herda a exceção da た: `いきます → いった → いったり`.

**Forma ない (Lição 15)** — Grupo 1: linha い → linha あ, mais ない.
★ "Caso o hiragana anterior a ます seja い, substitui-se por わ e não por あ."
Grupo 2: ます → ない. Grupo 3: きます → こない, します → しない.

---

## 3. Verbos: 48 no total

Combinações verbo × forma treináveis, calculadas do banco pelo `check-content`:
**238** com as cinco formas originais e **286** depois da Forma たり — todos os 48
verbos ganharam たり, inclusive あります (あった → あったり), já que a Forma た dele
é ensinada e `notTaught` não se copia de ない/なかった para たり.

Todos foram encontrados nos materiais Rikai. Cada entrada em `src/data/verbs.js`
declara as lições em que aparece (`lessons`) e quais formas o Rikai **mostra
literalmente** (`attested`); as demais são calculadas pela regra e conferidas
pelo `check-content` contra o motor.

- **Grupo 1: 31** — かいます, まちます, あります, しにます, あそびます, よみます, のみます,
  やすみます, かきます, ききます, はたらきます, あるきます, およぎます, はなします, まわします,
  すいます, つくります, とります, はしります, かえります, はいります, のります, おどります,
  つかいます, もらいます, なります, おもいます, いいます, すみます, よろこびます, いきます.
- **Grupo 2: 13** — たべます, あげます, でかけます, ねます, みます, おきます, できます,
  おしえます, います, きます (着ます, vestir), あつめます, くれます, おくれます.
- **Grupo 3: 4** — します, きます (vir), べんきょうします, もってきます.

**Kanji.** O campo `kanji` só existe quando a grafia aparece no corpus Rikai
**como aquele verbo** (19 verbos). Casos verificados e recusados:

| Verbo | Por que ficou sem kanji |
|---|---|
| かきます | 書 só aparece em 辞書形, nunca como o verbo |
| しにます | 死 só aparece como substantivo, em `死 (し＝morte)` (Lição 17) |
| まわします | 回 só aparece como contador (`1回`, `なん回`) |
| べんきょうします | 勉強 aparece como substantivo; o verbo é sempre escrito em kana |
| きます (vir) | 来 **não ocorre em nenhum arquivo** do corpus |
| もってきます | 持って aparece, mas 持ってきます não |

Isso atende ao §11: kanji não é inventado para embelezar o banco.

---

## 4. Divergências corrigidas em relação ao `bunpou-lab`

O banco `VERBS` do Bunpou Lab (32 verbos) foi usado só como ponto de partida.
Diferenças após a auditoria:

| Item | Bunpou Lab | 活用ラボ, após auditar o Rikai |
|---|---|---|
| `あります` na forma ない | `nai: 'ない'` | removido — o Rikai não sustenta (ver §5) |
| Forma なかった | ausente | presente nos 47 verbos que a sustentam |
| Forma たり | ausente | presente nos 48 verbos, derivada da た |
| Fonte / lição | ausente | toda entrada cita as lições do Rikai |
| Kanji | ausente | 19 verbos, só onde o Rikai mostra |
| Grupo de `はいります` | 1 | 1 (confirmado: り antes de ます) |
| `おきます` × `ききます` | ambos presentes, sem nota | marcados como o par-armadilha do tipo (iii) |
| `きます` | uma entrada (vir) | duas entradas: 着ます (G2) e きます (G3) |
| Nome da 辞書形 | "forma る (dicionário)" | "Forma de dicionário（辞書形）" |
| Verbos acrescentados | — | やすみます, まわします, すいます, のります, おどります, つかいます, もらいます, なります, おもいます, いいます, すみます, よろこびます, くれます, おくれます |

---

## 5. Deixado deliberadamente fora do escopo

**`あります` nas formas ない e なかった.** O Rikai lista あります nas tabelas da
forma て (Lição 01: `あります → あって`) e da forma de dicionário
(Lição 02: `あります → ある`), mas **não** na tabela da forma ない (Lição 15). Em
todo o corpus, a negativa de あります aparece apenas como ありません (forma polida:
`へやに テレビは ありません`, `じかんが ありませんから`). Como ある tem negativa
supletiva (ない/なかった) que o material não ensina, o verbo é treinado em
て/辞書/た e fica marcado como não treinável em ない/なかった — visível na matriz
de domínio e explicado na página de Referência. Registrado em
`notTaught` + `notTaughtReason`.

**Outras conjugações que aparecem no Rikai mas não são formas-alvo (§8, §51).**
Encontradas no material e conscientemente fora do treino inicial, por serem
*estruturas gramaticais* construídas sobre as formas-alvo, não flexões novas:

| Estrutura | Onde aparece | Base que usa |
|---|---|---|
| `Vています` | Lições 01, 02, 04, 10, 14, 16, 17 | forma て |
| `Vてください` | Lições 06, 09 | forma て |
| `Vてみます` | Lição 10 | forma て |
| `Vても いいです` | Lição 14 | forma て |
| `Vてきます` / `Vていきます` | Lições 01, 02, 11 | forma て |
| `Vたことが あります` | Lição 13 | forma た |
| `Vたいです` | Lições 08, 10, 15 | raiz de ます |
| `Vないで ください` | Lição 15 | forma ない |
| `Vる 前に` | Lições 08, 15 | forma de dicionário |
| `Vると いいです` | Lição 15 | forma de dicionário |
| `Vる もの` / `Vない 人` (qualificação) | Lições 16, 17 | forma de dicionário e ない |
| `Vんです` | Lição 17 (é o ponto da lição) | forma simples |
| `Vと 思います` / `Vと 言っていました` | Lição 18 | forma simples |
| `Vすぎます` | Lições 13, 15 | raiz de ます |

(`Vてあります` não ocorre no Básico 1 Rikai e por isso nem consta da lista.)

Até 2026-09-13 esta tabela listava também "`Vたり、Vたり します`", com します — o
que não correspondia à fonte, que usa しています. A peça `Vたり` passou a ser
forma-alvo (ver §1); a expressão completa, que junta dois verbos, continua fora
do treino.

Nenhuma delas foi transformada em forma-alvo. Também **não** foram incluídas
potencial, passiva, causativa, volitiva, imperativo nem condicionais — o
Básico 1 Rikai não as ensina, e o briefing as exclui.

**Outras fontes no diretório.** `Try N5`, `Katsudo`, `nihongonokotsu` e
`A1/A2 RIKAI.pdf` (livros-texto completos) não foram usados para definir
currículo, grupos ou formas. As lições de flexão citam páginas do livro-texto
(pág. 166-167, 170-171, 172-173), mas a regra transcrita aqui é sempre a da
apostila do Rikai.

**Fonte complementar de たり.** É o único material de fora do Rikai usado no
conteúdo do site, e só no texto da seção たり da Referência (ver §1).

---

## 6. Como reverificar

```bash
npm run check-content   # banco × motor × fontes; falha em qualquer divergência
npm test                # inclui os casos obrigatórios do §46
npm run audit-feedback  # imprime o feedback de erro para inspeção humana
```
