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
| Logotipo (selo e favicon) | 文 em círculo **vermelho/coral** `#C33C2A` (escuro: `#D24A36`) | 活 em círculo **azul** `#20395B` (escuro: `#2F5488`) |
| Cartão principal | "Sessão de gramática" em gradiente 藍 | "Continuar treino" / "Sessão mista" em gradiente 浅葱 |
| Cor própria | fontes (Rikai, NNK, TRY, Provas, Bunpro) | uma cor fixa por forma-alvo (て, 辞書形, た, ない, たり, なかった) |

## Componentes compartilhados

- **Logotipo:** o desenho original de cada app, sem flor e sem moldura.
  - Círculo sólido de 34 px com um anel fino **interno** (o mesmo do favicon) e o ideograma 文 ou 活 em gótico 800, cor `#FBF7EE`, centralizado (desvio medido: 0 px).
  - Nenhuma sombra ou anel externo. A versão de 21/11 tinha um anel externo cortado pelo `overflow:hidden` da marca, o que dava a impressão de uma moldura quadrada.
  - As cores de identidade são as originais e não seguem a paleta sakura: Bunpou vermelho/coral, Katsuyou azul. No tema escuro, usa-se um tom um pouco mais claro da mesma cor.
  - As classes `.seal-bunpou` e `.seal-katsuyou` são usadas no logotipo e no selo do cartão "Ferramentas" do outro app.
- **Favicons:** arquivos reais em `public/`, copiados pelo Vite para a raiz do site.
  - `favicon.svg`: o círculo, o anel interno e o ideograma.
  - `favicon-32.png`: fallback para navegadores sem favicon SVG.
  - `apple-touch-icon.png`: 180 px.
  - As referências levam `?v=3` para não ficarem presas no cache.
  - A versão de 21/11 usava um `data:` URI com `#` sem codificar, o que tornava o SVG inválido; por isso o favicon sumiu.
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
  - **Teclado, igual nos dois:** o diálogo abre com a ação (Sair, Descartar…) selecionada; setas e Tab alternam; Enter confirma o **selecionado**; Esc cancela; os atalhos da tela por baixo ficam bloqueados.
  - **Botão selecionado ACENDE, sem anel nem contorno:** fundo mais intenso (Sair: `#BF4A33 → #DE5638`; no escuro, `#FF8E70`), texto reforçado e um brilho difuso do próprio botão (só sombras com desfoque e espalhamento negativo). Continuar/Cancelar selecionado ganha fundo tingido de 藍, texto em negrito e o mesmo brilho, sem borda colorida. O outro botão fica com opacidade 0,72, para não haver dúvida de qual recebe o Enter. Nenhum `outline` é desenhado.
- **Tela de exercício (mesma composição nos dois; o Bunpou é a referência):**
  - Ordem: barra da sessão (`.sessbar`/`.pbar`), cabeçalho (`.stagehead`), cartão (`.qcard`) e "Encerrar sessão" centralizado abaixo do cartão (`.foot`).
  - No cartão: etiquetas (`.qtop`/`.qtags`), enunciado (`.qprompt`), resposta, ações (`.qactions`: primário + fantasmas) e feedback (`.fb` com `.verdict` e linhas rotuladas `.fline`/`.fl-t`).
  - Esses estilos estão no bloco compartilhado, com os valores do Bunpou.
  - **Bunpou:** alternativas, tesoura, Takoboto acima do cartão à direita, ChatGPT, tags, Chutei e Continuar.
  - **Katsuyou:** a forma pedida e o grupo como etiquetas; "Escreva a Forma て de:"; o verbo em destaque proporcional (34 px; 30 px no celular), não mais gigante e centralizado; o campo `.tin` do Bunpou; Responder (primário) com Dica e Não sei (fantasmas); feedback em linhas rotuladas ("Sua resposta", "Resposta correta", "Como chegar", "Regra utilizada"…).
- **Feedback (`.fb`):** borda esquerda de 4 px na cor do veredito, fundo levemente tingido e texto em tinta.

## Acessibilidade

- Foco visível em todos os controles (`:focus-visible` + `--focus-ring`). Nos diálogos, o foco é indicado pelo estado "aceso" descrito acima, não por um anel.
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
