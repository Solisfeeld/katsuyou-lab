# Sessões interrompidas: salvar, pausar e retomar

Fechar a aba, fechar o navegador, atualizar a página ou sair do site no meio de um treino não perde nada. O treino fica salvo exatamente onde parou e pode ser retomado pela tela inicial.

Código:
- `Session.resumeData`, `saveResume`, `saveQuiet` e `fromResume` em `src/practice/engine.js`;
- `resumeSession`, `discardResume` e `onExternalChange` em `src/ui/app.js`;
- o cartão em `src/ui/home.js`;
- os gatilhos do navegador em `src/main.js`.

## O que acontece

| Situação | Resultado |
|---|---|
| Fechou a aba, o navegador ou atualizou a página | A tela inicial mostra o cartão **Continuar sessão anterior**. Nada é retomado sozinho. |
| **Continuar sessão** | Volta à mesma questão: o texto que estava digitado, as dicas já abertas e, se a correção estava na tela, o mesmo feedback, sem responder de novo. A fila segue na mesma ordem, inclusive os itens errados que voltariam na sessão. |
| **Descartar** | Pede confirmação. Some só o treino em andamento: as respostas já dadas continuam no progresso. |
| Começar outro treino com um salvo | **Começar** pede confirmação antes de descartar o salvo. |
| **Encerrar sessão** ou `Esc` | Abrem a confirmação **Sair da sessão?**. **Continuar** volta ao exercício exatamente como estava (texto digitado, feedback, cronômetro, fila); **Sair** encerra. |
| **Sair** ou conclusão normal | O resultado vai para o histórico uma única vez, e o treino deixa de ser "interrompido". |

O cartão mostra o modo, as questões respondidas (e o total, nas sessões por quantidade), o tempo de sessão e quando foi salvo.

## Cronômetro: tempo da sessão aberta

**Aba oculta não é sessão encerrada.** Trocar de aba, minimizar o navegador ou usar outro aplicativo **não** pausa.

**Como a contagem funciona:**
- `elapsedMs = agora − startedAt`, por tempo absoluto. Timers reduzidos ou suspensos em segundo plano não afetam a contagem.
- `startedAt` é um início virtual: uma pausa o desloca para frente pelo tempo parado, então esse intervalo nunca é somado.

**O relógio pausa só:**
- fora da tela de exercício (Ajustes, início) ou com um diálogo por cima, como no Bunpou Lab;
- quando a página é **descarregada** (`pagehide`: aba ou navegador fechados, página atualizada, navegação para outro site). Se a página voltar do bfcache, o intervalo fora não conta.

Ao retomar, `startedAt = agora − tempo salvo`. Exemplo: 23:15 de sessão, dois dias fechado, volta em **23:15**.

**Histórico de mudanças:** na versão de 21/11/2026, a aba oculta pausava e havia um teto de 15 s por intervalo sem pulso. Isso estava errado e foi corrigido em 23/11/2026.

## Gravação

**Resposta e sessão salva numa única gravação.** O resumo (já em fase de feedback) é posto no estado e gravado pelo mesmo `save()` que registra a resposta. Não existe instante em que a resposta conste do progresso e a sessão ainda a mostre como pendente. Por isso, retomar nunca reaplica uma resposta. O mesmo vale para o fim: o registro da sessão e a remoção do treino salvo vão juntos.

**Momentos de gravação:**
- **Com o progresso (e a sincronização, como sempre):** ao iniciar, ao responder e ao avançar.
- **Só localmente (`saveQuiet`), sem disparar a sincronização:** ao abrir uma dica, ao digitar (pausa de 0,4 s), a cada 10 s de sessão, em `visibilitychange` (oculta), `freeze` e `beforeunload` (só gravam) e em `pagehide` (grava e pausa).

**O rascunho digitado** fica numa chave própria e só local (`katsuyou_lab_draft_v1`). Ele não entra no progresso, no backup nem na sincronização.

## Duas abas e outros dispositivos

**Duas abas:**
- Quem retoma passa a ser o dono do treino (`owner`).
- A outra aba, avisada pelo evento `storage`, recarrega o progresso, larga o treino sem gravar e mostra "Esta sessão continuou em outra aba."

**Outros dispositivos:**
- O treino salvo vive no mesmo estado do progresso (`resume`) desde a versão anterior, então acompanha a sincronização e pode ser retomado em outro dispositivo.
- Um conflito entre dispositivos cai no fluxo de conflito que já existia: a janela de resolução, igual à do Bunpou Lab, com as opções manter local ou usar a nuvem. Com a janela aberta, o relógio da sessão pausa, como com qualquer diálogo.
- Login e sincronização reais não foram exercitados nos testes.

**Compatibilidade.** Treinos salvos no formato antigo (v1, só a fila) continuam retomáveis.

## Testes

- `e2e/cronometro.py` (navegador real, tempos medidos com espera real): 2 min com outra aba na frente, 1 min de navegador minimizado (timers congelados), 30 s com outro aplicativo, 90 s com a aba fechada, retomada, recarga e estabilidade da barra de rolagem.

- `tests/session-resume.test.js` (jsdom, 15 testes):
  - "fechar a aba" relendo o disco e criando um App novo;
  - texto digitado, feedback, fila de reforço e ordem;
  - cronômetro e pausas;
  - dica aberta;
  - descarte e nova sessão com confirmação;
  - conclusão e encerramento (agora pela confirmação **Sair da sessão?**);
  - `Esc` abre a confirmação, `Esc` de novo cancela sem perder nada, e Sair encerra;
  - duas abas e formato v1.
- `e2e/retomada.py` (navegador real com perfil persistente, 17 verificações):
  - fechar e reabrir o navegador;
  - 3 dias fechado;
  - página oculta sem pausa;
  - atualizar durante o feedback;
  - duas abas;
  - conclusão e descarte.
