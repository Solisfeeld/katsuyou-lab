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
| `--ai` / `--ai-2` | `#2D4A70` / `#3B5F90` | `#8FA9D8` / `#A9BEE4` | 藍: foco, links, etiquetas de forma (não é mais a cor dos botões) |
| `--btn-pri` / `--btn-pri-hover` / `--btn-pri-ink` | `#38312F` / `#221D1C` / `#FFFDFA` | `#ECE5DB` / `#D2C8BB` / `#18171C` | botão primário em 墨 (sumi) |
| `--btn-sec` / `--btn-sec-hover` / `--btn-sec-line` | `--card` / `#EEE6DC` / `--line-strong` | `--card` / `#2C2D37` / `--line-strong` | botão secundário (Exportar, Continuar no diálogo…) |
| `--btn-danger` / `--btn-danger-hover` / `--btn-danger-ink` | `#BF4A33` / `#9E3824` / `#FFFFFF` | `#EC7E67` / `#D2654F` / `#18171C` | ação destrutiva (Resetar, Sair) |
| `--sel-bg` / `--sel-line` / `--sel-ink` | `#F8E8EC` / `#C9748A` / `#8E3A50` | sakura translúcido / `#EA97A9` / `#F4BFCB` | estado **selecionado** (tema, alternativa marcada, conjuntos, Ajustes ativo) |
| `--sakura` / `--sakura-deep` | `#D9798D` / `#A9445E` | `#EA97A9` / `#F2B6C3` | acento decorativo, sobretítulo |
| `--sakura-wash` / `--sakura-soft` | `#FBEEF1` / `#F1CBD4` | translúcidos | pétalas, seleção |
| `--midori` | `#2F7656` | `#66BC95` | acerto |
| `--shu` | `#BF4A33` | `#EC7E67` | erro, ação destrutiva |
| `--gold` | `#94732F` | `#D2B475` | aviso, "não sei" |
| `--asagi` | `#2C6E77` | `#6FB8C2` | 浅葱: identidade do Katsuyou |
| `--murasaki` | `#6A4A7C` | `#B795CE` | categoria |
| `--radius-sm/…/xl` | 8 / 12 / 16 / 22 px | | cantos |
| `--shadow-sm/…/lg` | | | elevação |
| `--focus-ring` | | | anel de foco por teclado (`:focus-visible`), fora dos diálogos |
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
- **Indicador de conta e sincronização:** mesmo desenho nos dois apps: pílula de 36 px com ponto de estado e rótulo (Entrar, Sincronizado, Sincronizando, Pendente, Offline, Conflito, Erro, Sessão expirada). A **largura acompanha o rótulo**, sem largura fixa (medido de 59 a 136 px). Só no Bunpou, abaixo de 640 px e com o relógio da sessão na barra, a conta conectada vira só o ponto.
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
  - Botões: `.btn` com 42 px, `.btn-sm` com 34 px, `.btn-lg` com 52 px. Hierarquia única nos dois apps, toda em tokens:
    - **primário** (`.btn-primary`): fundo 墨 sumi (`--btn-pri`), texto claro. No escuro, fundo claro e texto escuro. Uma ação principal por tela (Responder, Continuar, Iniciar sessão, Revisar todos);
    - **secundário** (`.btn`): fundo do cartão e borda (`--btn-sec*`);
    - **fantasma** (`.btn-ghost`): sem fundo (Não sei, Chutei, Dica);
    - **destrutivo** (`.btn-shu`): 朱 (`--btn-danger*`), só para Resetar, Sair e Descartar;
    - **selecionado**: sakura suave (`--sel-*`), para escolhas que ficam marcadas (tema, alternativa, conjuntos, unidades);
    - **desabilitado**: opacidade reduzida, sem hover.
    - **Hover = o próprio fundo escurece** (no escuro, clareia menos), sem brilho, sombra colorida nem mudança de tamanho.
    - As cores de acerto e erro (verde e 朱 no feedback), os logotipos e os favicons não mudaram.
  - Linha de opção (`.optrow`) e cabeçalho de opção (`.set-head`).
  - Interruptor com rótulo de estado (`.tgl`): o mesmo para "Ligado/Desligado", "Visível/Oculto" e fontes "Ligada/Desligada".
  - Escolha única de tamanho igual (`.choice-group`): Tema, com Automático, Claro e Escuro e ícones SVG alinhados à esquerda. Lado a lado no desktop, empilhada no celular.
  - Trio de ações de tamanho idêntico (`.btn-trio`): Exportar, Importar e Resetar progresso. Empilhado no celular; Resetar mantém a cor de alerta e a confirmação.
  - Campos numéricos (`.numin`).
  - Diálogo de confirmação (`.overlay`/`.modal`/`.modal-act`), com ações empilhadas abaixo de 420 px. O Katsuyou passou a usar o mesmo diálogo do Bunpou, em vez do `confirm()` do navegador.
  - **Janela de escolha da sincronização (os dois apps):** mesma marcação (`.modal.modal-choice`, `.mc-main`, `.mc-foot`), mesmo CSS (no bloco compartilhado), mesmos textos e mesmo comportamento.
    - **Bunpou:** `choiceModal` em `src/auth-sync.js`. Três janelas: conflito entre dispositivo e nuvem, confirmação de substituir a nuvem e importação do perfil sem login.
    - **Katsuyou:** `askChoice`/`openConflict` em `src/ui/app.js`, sobre as funções existentes `keepLocal` e `keepRemote` de `src/auth-sync.js`. Duas janelas: conflito e confirmação de substituir a nuvem. A importação do perfil sem login não existe no Katsuyou.
    - **Conflito, nos dois:**
      - a janela "Há mudanças mais recentes em outro dispositivo" abre sozinha quando o conflito surge, com a revisão real da nuvem no texto (sem número, se a revisão não for conhecida);
      - **Resolver conflito**, no controle da conta e em Ajustes › Conta, a reabre sobre a tela atual, sem navegar, enquanto o conflito estiver pendente;
      - "Manter deste dispositivo" passa pela confirmação "Substituir a versão da nuvem?";
      - "Usar versão da nuvem" adota a nuvem;
      - Cancelar e `Esc` fecham sem resolver nem descartar nada.
    - O fundo é o mesmo `.overlay` dos outros diálogos (escurecido com desfoque de 3 px). Não há animação de entrada, nos dois apps.
    - Com a janela aberta, o relógio da sessão pausa (Bunpou: `.overlay.show`; Katsuyou: `this.dialog`).
    - Título forte em Mincho (23 px, espaçamento entre letras normal) e texto de 14,5 px.
    - As escolhas ficam lado a lado, com a mesma largura: secundária à esquerda e principal (primária ou destrutiva) à direita.
    - **Cancelar** fica sozinho abaixo, à direita.
    - Abaixo de 480 px as escolhas empilham com a principal em cima, e Cancelar vira um botão fantasma de largura total, por último.
    - `Esc` equivale a clicar em Cancelar. Setas e Enter não alternam a seleção aqui; isso é só do diálogo de confirmação abaixo.
  - **Diálogo de confirmação, teclado igual nos dois:** o diálogo abre com a ação (Sair, Descartar…) selecionada; setas e Tab alternam; Enter confirma o **selecionado**; Esc cancela; os atalhos da tela por baixo ficam bloqueados.
  - **Mesmos botões da seção Dados dos Ajustes:** Continuar é **secundário** (como Exportar e Importar progresso) e Sair é **destrutivo** (como Resetar progresso).
  - **Selecionado pelo teclado = hover do mouse.** A classe `.msel` reutiliza exatamente as regras de `:hover` (`.btn:hover,.modal .btn.msel{…}`): o fundo escurece (Sair `#BF4A33 → #9E3824`; Continuar `card → #EEE6DC`; no escuro `#EC7E67 → #D2654F` e `card → #2C2D37`).
  - Sem contorno, anel de foco, brilho, sombra luminosa, borda dupla ou mudança de tamanho (`outline:none; box-shadow:none` medidos nos dois apps). Os dois botões ficam com opacidade 1.
  - Passar o mouse sobre um botão também o torna o selecionado, então mouse e teclado nunca mostram dois botões "acesos".
- **Tela de exercício (mesma composição nos dois; o Bunpou é a referência):**
  - Ordem: barra da sessão (`.sessbar`/`.pbar`), cabeçalho (`.stagehead`), cartão (`.qcard`) e "Encerrar sessão" centralizado abaixo do cartão (`.foot`).
  - No cartão: etiquetas (`.qtop`/`.qtags`), enunciado (`.qprompt`), resposta, ações (`.qactions`: primário + fantasmas) e feedback (`.fb` com `.verdict` e linhas rotuladas `.fline`/`.fl-t`).
  - Esses estilos estão no bloco compartilhado, com os valores do Bunpou.
  - O botão de avançar se chama **Continuar** nos dois apps ("Ver resultado" na última questão).
  - **Bunpou:**
    - alternativas com a **tesoura à esquerda**, antes da letra (`[✂][A][texto]`), como no Qconcursos. É um controle independente: clicar nela não marca a alternativa. A alternativa eliminada fica esmaecida, e o ícone, em 朱. Depois da correção, um espaço do mesmo tamanho ocupa o lugar da tesoura, para nada mudar de posição;
    - **Takoboto:** o ícone fica no canto inferior direito do cartão, na mesma linha de Responder/Não sei (ou Continuar/Chutei), **também no celular**.
      - O clique abre um **balão** compacto que nasce do ícone, só com o campo ("Palavra em japonês") e o GO à direita, centralizados na vertical, com 10 px de margem interna uniforme. Uma seta aponta para o ícone. Não há título, ícone, dica de teclado nem linha decorativa dentro do balão.
      - O balão abre com uma escala curta a partir da seta (0,26 s, com leve "pulo") e fecha ao contrário (0,2 s). Com `prefers-reduced-motion`, só aparece e some.
      - O balão flutua **sobre** as alternativas (ou o feedback) e abre para cima, deixando o enunciado à vista. Se não houver espaço acima do ícone na tela, abre para baixo. Nada na linha das ações se move, e o cartão não muda de altura.
      - `Enter` ou GO abrem `takoboto.jp/?q=…&lang=por` em nova aba. `Esc`, um clique fora ou um novo clique no ícone fecham. O primeiro `Esc` fecha o balão, e só o seguinte abre a saída. Ao avançar de questão, o balão fecha e o campo volta vazio.
      - **Posição avaliada (26/11/2026):** o ícone centralizado no cabeçalho do cartão foi testado e descartado. No celular ele colide com as etiquetas, e o balão cobria justamente o enunciado onde está a palavra a pesquisar. No centro da linha das ações não cabe: no celular, Responder e Não sei já passam do meio do cartão.
      - Abaixo de 360 px os botões da linha ficam um pouco mais estreitos (14 px de margem interna; 12 px abaixo de 340 px), para Responder, Não sei e o ícone, ou "Ver resultado", Chutei e o ícone, caberem numa linha só, inclusive em 320 px;
    - ChatGPT, tags e Chutei.
  - **Katsuyou:** composição **centralizada**: o grupo como etiqueta no topo; o verbo grande em Mincho com furigana (38 px no celular, até 54 px), a tradução logo abaixo, o rótulo **Forma pedida** com a forma numa pílula, e o campo `.tin` centralizado. Responder (primário) com Dica e Não sei (fantasmas) centralizados. O feedback continua em linhas rotuladas ("Sua resposta", "Resposta correta", "Como chegar", "Regra utilizada"…). A identidade visual é a mesma do Bunpou, mas as telas não são cópias: cada uma serve ao seu tipo de exercício.
  - **Erros recentes (Katsuyou):** cabeçalho fixo, só a lista rola (`.err-scroll`), e **Revisar todos** e **Voltar** ficam sempre visíveis no rodapé (`.err-actions`).
- **Feedback (`.fb`):** borda esquerda de 4 px na cor do veredito, fundo levemente tingido e texto em tinta.

## Acessibilidade

- Foco visível em todos os controles (`:focus-visible` + `--focus-ring`). Nos diálogos, o selecionado tem a aparência de hover descrita acima, sem anel.
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
| ≤ 360 px (Bunpou, cartão da questão) | botões da linha de ações com margem interna menor, para o ícone do Takoboto caber na mesma linha |
| ≤ 560 px | os números do acompanhamento viram grade de 3 colunas; Tema e Dados empilham; cartões de configuração com 16 px de margem interna |
| ≤ 430 px (Bunpou, durante a sessão) | o nome cede espaço ao relógio; o selo fica |

Barra superior verificada também por medição automática em 320, 390, 768, 1280 e 1440 px nos dois temas: nenhum controle cortado, nenhuma rolagem horizontal, logotipo de 34 × 34 px e nenhum elemento de navegação entre laboratórios. Telas de Ajustes verificadas em 320, 360, 390, 768 e 1280 px: as três opções de tema e os três botões de Dados com largura e altura idênticas em cada largura.

Rodada de 26/11/2026, medida em 320, 360, 390, 768, 1024, 1280 e 1440 px, claro e escuro, nos dois apps:
- sem rolagem horizontal;
- Takoboto dentro do cartão, na linha das ações, com o ícone e Responder parados ao abrir e a altura do cartão inalterada. Desde a mesma data, o balão fica dentro da tela e a seta aponta para o ícone, antes e depois de responder;
- verbo do Katsuyou, campo e cartão no mesmo eixo central;
- diálogos sem sombra nem contorno, com a mesma largura nos dois estados.
