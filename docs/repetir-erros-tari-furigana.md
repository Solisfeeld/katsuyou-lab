# Repetir erros, ～たり e kanji com furigana

## Repetir atividades erradas na mesma sessão

**Onde:** Ajustes → Treino → **Repetir atividades erradas na mesma sessão**. Vem **ligado** por padrão (`settings.repeatErrors`).

**Ligado:**
- Um par errado (ou "Não sei") volta **uma vez** mais adiante na mesma sessão, numa posição sorteada entre 3 e 7 questões à frente.
- Nunca volta como a questão seguinte. Se a fila acabou, não volta.
- A reapresentação não gera outra reapresentação, então não há laço.
- Quando a meta de tempo da sessão já passou, não há reapresentação.

**Desligado:**
- Nada volta na mesma sessão.
- O erro continua registrado normalmente: aparece em Erros recentes, enfraquece o par e o par volta nas próximas sessões pela cota de "fracos".

**Como a tentativa de reforço é contada:**
- Não apaga o erro original: não soma acerto nem sobe a sequência de domínio.
- Não pune de novo: não soma outro erro nem cria outra linha em Erros recentes.
- Fica registrada à parte (`reinforced`, `reinforcedOk`).
- A tela final mostra a nota da **primeira tentativa** e, separadamente, por exemplo: "Reforço: 3 de 4 itens errados acertados ao voltar nesta sessão".

## ～たり como derivado da Forma た

～たり deixou de ser apresentado como uma conjugação independente:

- **Rótulo:** "～たり (Forma た + り)".
- **Regra:** a Forma た com り no fim (かった → かったり; のんだ → のんだり).
- **Referência:** seção "～たり — derivado da Forma た", com exemplos por grupo (かいます → かった → かったり) e a construção estudada no N5, ～たり～たりする.

A chave interna continua `tari`. Exercícios, histórico, matriz de progresso e backups antigos continuam válidos, e nenhum par foi renomeado.

## Kanji com furigana

**O que mudou**
- As formas verbais aparecem com kanji e leitura por cima (飲[の]んで), sempre que o kanji do verbo está no **mesmo conjunto autorizado do Bunpou Lab**.
- A lista está em `src/conjugation/furigana.js` (`KNOWN_KANJI`, cópia literal do `JK_KNOWN` do Bunpou). O módulo se recusa a carregar se alguma grafia declarada usar kanji fora dela.

**Verbos com grafia em kanji**
- 26 verbos estão em `VERB_KANJI`.
- Verbos cujo kanji está fora do conjunto (かえります, はたらきます…) continuam em kana.

**Leitura contextual**
- A leitura vem do próprio texto conjugado, nunca de uma leitura fixa: 来ます → き, 来る → く, 来ない → こ.
- Uma grafia em kana que pertence a dois verbos de kanji diferentes fica em kana (いって = 行って ou 言って; きます = 来ます ou 着ます).

**Campo de resposta**
- Nunca recebe furigana: é texto puro, compatível com IME.
- **Hiragana continua aceito** como sempre.
- A grafia em kanji que a tela mostra também é aceita (quem digita 飲んで com o IME não é marcado como errado).

**Avaliação**
- Nada desta camada toca na correção: o banco continua em kana, e `npm run check-content` confere banco × motor como antes.

## A resposta digitada aparece exatamente como foi escrita

O feedback mostra, em todas as situações:

| Situação | Linhas mostradas |
|---|---|
| Erro | **Sua resposta** (o texto exato digitado, riscado) e **Resposta correta** |
| Acerto | **Sua resposta** e o verbo com a forma esperada |
| Acerto com grafia diferente da exibida e do kana (ex.: aceito declarado no banco) | **Forma esperada** e a nota "Grafia diferente, mas aceita." |
| Em branco | "(em branco)" |
| "Não sei" | "“Não sei”" |

O texto digitado é inserido por `textContent`, nunca como markup.
