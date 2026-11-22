# Sistema visual "Sakura"

O mesmo sistema é usado pelo **Bunpou Lab** (gramática) e pelo **Katsuyou Lab** (conjugação). Os dois compartilham tokens e componentes, e cada um mantém uma identidade própria.

## Princípios

- **A leitura vem antes da decoração.** O japonês grande e legível é o centro de cada tela. A sakura é discreta: um ramo na abertura, uma flor pequena no sobretítulo do celular e uma pétala marcando os títulos de seção. Nada anima sozinho. O **logotipo não leva flor**: é só o ideograma no círculo.
- **Cor com função.** Verde = acerto, 朱 (vermelho) = erro, dourado = aviso ou "não sei". O texto do feedback fica em tinta (`--ink`); a cor aparece só no veredito e nos marcadores.
- **Claro e escuro desenhados**, não invertidos: cada token tem um valor próprio no tema escuro.
- **Nenhuma imagem externa.** As ilustrações são SVG autorais embutidos no código, sem pedidos de rede.

## Tokens

Definidos em `:root` e em `html[data-theme="dark"]`, **idênticos nos dois apps**: Bunpou em `index.html`, Katsuyou em `src/styles.css`. Quem muda a paleta muda nos dois arquivos. Este documento existe nos dois repositórios com o mesmo conteúdo.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--paper` | `#F7F3ED` | `#131419` | fundo |
| `--card` / `--card-2` | `#FFFDFA` / `#F7F2EB` | `#1C1D24` / `#23242C` | superfícies |
| `--ink` / `--ink-soft` / `--ink-faint` | `#26221E` / `#544D46` / `#776E65` | `#EEE9E3` / `#BEB6AD` / `#938B82` | texto |
| `--ai` / `--ai-2` | `#2D4A70` / `#3B5F90` | `#8FA9D8` / `#A9BEE4` | 藍: ação primária, foco |
| `--sakura` / `--sakura-deep` | `#D9798D` / `#A9445E` | `#EA97A9` / `#F2B6C3` | acento decorativo, sobretítulo |
| `--sakura-wash` / `--sakura-soft` | `#FBEEF1` / `#F1CBD4` | translúcidos | pétalas, seleção |
| `--midori` | `#2F7656` | `#66BC95` | acerto |
| `--shu` | `#BF4A33` | `#EC7E67` | erro, ação destrutiva |
| `--gold` | `#94732F` | `#D2B475` | aviso, "não sei" |
| `--asagi` | `#2C6E77` | `#6FB8C2` | 浅葱: identidade do Katsuyou |
| `--murasaki` | `#6A4A7C` | `#B795CE` | categoria |
| `--radius-sm/…/xl` | 8 / 12 / 16 / 22 px | | cantos |
| `--shadow-sm/…/lg` | | | elevação |
| `--focus-ring` | | | anel de foco dos botões |
| `--ease` | `cubic-bezier(.2,.7,.2,1)` | | transições curtas (≤ 0,2 s) |

## Tipografia

- **Zen Kaku Gothic New:** interface e texto corrido.
- **Shippori Mincho:** títulos de página, números de destaque e o japonês grande (prompt do Katsuyou, formas no feedback).
- Furigana: `rt` a 50% do tamanho (36% no prompt gigante do Katsuyou), em peso normal.

## Identidade de cada app

| | Bunpou Lab | Katsuyou Lab |
|---|---|---|
| Logotipo (selo e favicon) | 文 branco em círculo `#2D4A70` | 活 branco em círculo `#2C6E77` |
| Cartão principal | "Sessão de gramática" em gradiente 藍 | "Continuar treino" / "Sessão mista" em gradiente 浅葱 |
| Cor própria | fontes (Rikai, NNK, TRY, Provas, Bunpro) | uma cor fixa por forma-alvo (て, 辞書形, た, ない, たり, なかった) |

## Componentes compartilhados

- **Logotipo:** só o ideograma (文 ou 活), branco e centralizado num círculo de 34 px. A cor é **fixa nos dois temas**, a mesma do favicon, para o símbolo não mudar. O favicon é um SVG embutido com o mesmo círculo e o mesmo ideograma.
- **Barra superior:** logotipo e nome à esquerda. À direita ficam, nesta ordem, o relógio (só no Bunpou, durante a sessão), a conta, Ajustes e o tema.
  - Os controles têm a mesma altura nos dois apps (36 px), e a barra tem 56 px.
  - Abaixo de 640 px, Ajustes vira ⚙ (com `aria-label`).
  - O nome do app continua visível no celular; no Bunpou ele cede espaço ao relógio só durante uma sessão.
  - **Não há navegação entre laboratórios na barra.**
- **Abertura (`.hero`):** sobretítulo com furigana, título em Mincho e texto curto. No desktop leva o ramo de sakura (SVG). Abaixo de 760 px o ramo sai e uma flor pequena acompanha o sobretítulo, para não disputar espaço com o título.
- **Títulos de seção (`.h-sec`):** caixa alta espaçada, pétala à esquerda e linha que se apaga à direita.
- **Cartão de sessão:** gradiente da cor do app, ação principal em branco.
- **Cartões de modo:** selo em kanji na cor do modo, título e uma linha de descrição.
- **Acompanhamento (`.track`):** números em Mincho com rótulo curto e uma frase de contexto.
- **Ferramentas (`.tool-card`):** o **único** acesso ao outro laboratório, na tela inicial.
  - Mostra o selo do outro app, o nome, uma descrição curta e o ícone de link externo.
  - Abre em **nova guia** (`target="_blank" rel="noopener"`), então uma sessão em andamento nunca é interrompida.
  - É um `<a>` comum: funciona por mouse, toque e teclado.
  - Nada é compartilhado além do link: login, progresso e `localStorage` continuam separados.
- **Sessão interrompida (`.resume-card`):** cartão com borda sakura no topo de "Praticar", com **Continuar sessão** e **Descartar**.
- **Componentes compartilhados:** um bloco CSS **idêntico** nos dois apps, entre `COMPONENTES COMPARTILHADOS` e o fim do bloco (verificado byte a byte).
  - Botões: `.btn` com 42 px, `.btn-sm` com 34 px, `.btn-lg` com 52 px, primário, destrutivo e fantasma.
  - Linha de opção (`.optrow`) e cabeçalho de opção (`.set-head`).
  - Interruptor com rótulo de estado (`.tgl`): o mesmo para "Ligado/Desligado", "Visível/Oculto" e fontes "Ligada/Desligada".
  - Escolha única de tamanho igual (`.choice-group`): Tema, com Automático, Claro e Escuro e ícones SVG alinhados à esquerda. Lado a lado no desktop, empilhada no celular.
  - Trio de ações de tamanho idêntico (`.btn-trio`): Exportar, Importar e Resetar progresso. Empilhado no celular; Resetar mantém a cor de alerta e a confirmação.
  - Campos numéricos (`.numin`).
  - Diálogo de confirmação (`.overlay`/`.modal`/`.modal-act`), com ações empilhadas abaixo de 420 px. O Katsuyou passou a usar o mesmo diálogo do Bunpou, em vez do `confirm()` do navegador.
- **Cartão de questão (`.qcard`):** linha de sakura no topo. No Bunpou: tags à esquerda dentro do cartão, Takoboto acima do cartão à direita (expande da direita para a esquerda), botões de resposta e "Continuar" dentro do cartão e "Encerrar" fora.
- **Feedback (`.fb`):** borda esquerda de 4 px na cor do veredito, fundo levemente tingido e texto em tinta.

## Acessibilidade

- Foco visível em todos os controles (`:focus-visible` + `--focus-ring`).
- Todas as decorações SVG têm `aria-hidden="true"` e `focusable="false"`.
- `prefers-reduced-motion: reduce` zera transições e animações.
- Alvo de toque ≥ 36 px na topbar e ≥ 44 px nas ações principais.
- O campo de resposta do Katsuyou nunca recebe `<ruby>`: é texto puro, compatível com IME.

## Responsividade

Verificado com capturas reais (Chromium/Brave headless) em 320, 360, 390, 430, 768, 1024, 1280 e 1440 px, nos temas claro e escuro, **sem rolagem horizontal** em nenhuma largura.

| Largura | O que muda |
|---|---|
| ≤ 760 px | o ramo sai; os cartões de modo ficam em coluna |
| ≤ 640 px | Ajustes vira ⚙ na barra; o subtítulo do nome some |
| ≤ 560 px | os números do acompanhamento viram grade de 3 colunas; Tema e Dados empilham; cartões de configuração com 16 px de margem interna |
| ≤ 430 px (Bunpou, durante a sessão) | o nome cede espaço ao relógio; o selo fica |

Barra superior verificada também por medição automática em 320, 390, 768, 1280 e 1440 px nos dois temas: nenhum controle cortado, nenhuma rolagem horizontal, logotipo de 34 × 34 px e nenhum elemento de navegação entre laboratórios. Telas de Ajustes verificadas em 320, 360, 390, 768 e 1280 px: as três opções de tema e os três botões de Dados com largura e altura idênticas em cada largura.
