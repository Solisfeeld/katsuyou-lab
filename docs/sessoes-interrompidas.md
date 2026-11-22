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
| **Encerrar sessão** ou conclusão normal | O resultado vai para o histórico uma única vez, e o treino deixa de ser "interrompido". |

O cartão mostra o modo, as questões respondidas (e o total, nas sessões por quantidade), o tempo estudado e quando foi salvo.

## Cronômetro: tempo estudado

`startedAt` passou a ser um início **virtual**: `elapsedMs = agora − startedAt`. Pausar desloca `startedAt` para frente pelo tempo parado, então o intervalo pausado nunca entra na conta.

Pausa quando:
- a página fica oculta;
- a tela de exercício não está à vista (Ajustes, início, um diálogo);
- o app é fechado.

Ao retomar, `startedAt = agora − tempo salvo`. Exemplo: 23:15 estudados, dois dias fechado, volta em **23:15**.

**Proteção contra suspensões.** Um pulso por segundo (`heartbeat`) desconta qualquer intervalo acima de 15 s sem pulso, como o computador dormindo com a página aberta.

**Mudança em relação à versão anterior.** Antes, a sessão retomada recomeçava o relógio do zero, e trocar de aba não pausava.

## Gravação

**Resposta e sessão salva numa única gravação.** O resumo (já em fase de feedback) é posto no estado e gravado pelo mesmo `save()` que registra a resposta. Não existe instante em que a resposta conste do progresso e a sessão ainda a mostre como pendente. Por isso, retomar nunca reaplica uma resposta. O mesmo vale para o fim: o registro da sessão e a remoção do treino salvo vão juntos.

**Momentos de gravação:**
- **Com o progresso (e a sincronização, como sempre):** ao iniciar, ao responder e ao avançar.
- **Só localmente (`saveQuiet`), sem disparar a sincronização:** ao abrir uma dica, ao digitar (pausa de 0,4 s), a cada 10 s de estudo e em `visibilitychange`, `pagehide`, `freeze` e `beforeunload`.

**O rascunho digitado** fica numa chave própria e só local (`katsuyou_lab_draft_v1`). Ele não entra no progresso, no backup nem na sincronização.

## Duas abas e outros dispositivos

**Duas abas:**
- Quem retoma passa a ser o dono do treino (`owner`).
- A outra aba, avisada pelo evento `storage`, recarrega o progresso, larga o treino sem gravar e mostra "Esta sessão continuou em outra aba."

**Outros dispositivos:**
- O treino salvo vive no mesmo estado do progresso (`resume`) desde a versão anterior, então acompanha a sincronização e pode ser retomado em outro dispositivo.
- Um conflito entre dispositivos cai no fluxo de conflito que já existia (escolher local ou nuvem).
- Login e sincronização reais não foram exercitados nos testes.

**Compatibilidade.** Treinos salvos no formato antigo (v1, só a fila) continuam retomáveis.

## Testes

- `tests/session-resume.test.js` (jsdom, 14 testes):
  - "fechar a aba" relendo o disco e criando um App novo;
  - texto digitado, feedback, fila de reforço e ordem;
  - cronômetro e pausas;
  - dica aberta;
  - descarte e nova sessão com confirmação;
  - conclusão e encerramento;
  - duas abas e formato v1.
- `e2e/retomada.py` (navegador real com perfil persistente, 18 verificações):
  - fechar e reabrir o navegador;
  - 3 dias fechado;
  - página oculta;
  - atualizar durante o feedback;
  - duas abas;
  - conclusão e descarte.
