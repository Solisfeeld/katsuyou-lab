# Progressão semanal

Como o Katsuyou Lab escolhe os pares **verbo × forma** de cada sessão, e por que o domínio agora avança para quem estuda uma vez por semana.

Código: `src/practice/scheduler.js` (`buildMixQueue`, `queueMix`, `pairCategory`) e `src/progress/store.js` (`recompute`).

## O problema

Com estudo semanal (uma sessão de 20 questões por semana), o número de combinações "dominadas" praticamente não subia. As causas:

1. **Dominar exigia três acertos seguidos sem dica.** Quem treina uma vez por semana raramente via o mesmo par três vezes seguidas. Um par levava meses para firmar.
2. **O sorteio era por peso.** Pares fracos e inéditos saíam mais, mas sem cota. Cada sessão abria muitos pares novos (11 a 20 por sessão) sem consolidar os que já tinham começado, e as pendências só cresciam.

## O que mudou

### Domínio por recuperação espaçada

Um par fica **dominado** com uma destas condições:

- três acertos seguidos sem dica (como antes); **ou**
- dois acertos seguidos sem dica, com **pelo menos dois dias** entre eles (`SPACED_MS`).

Lembrar a forma dias depois é evidência mais forte de automatismo do que três acertos na mesma noite. Os acertos continuam obrigatórios: nada é declarado dominado sem resposta certa. Acerto com dica nunca leva a "dominado". Erro ou "Não sei" zera a sequência.

### Fila por cota

Cada par cai em um de quatro grupos:

| Grupo | Critério | Cota-base |
|---|---|---|
| `new` | nunca praticado | 35% |
| `weak` | aprendendo (errou e ainda não firmou) | 30% |
| `due` | firme, mas o intervalo de revisão venceu | 25% |
| `keep` | firme e dentro do intervalo | 10% |

**Cota de inéditos adaptativa (`queueMix`):** com muitos pares em aprendizado, a fatia de inéditos encolhe (35% → 25% → 12%), e a sobra vai para consolidar o que já começou.

**Intervalo em dias reais**, desde a última vez que o par apareceu:
- quase firme: 2 dias;
- dominado: 7 → 14 → 28 → 56 dias, conforme a sequência.

Uma semana sem abrir o app não "acumula atraso": o que venceu entra na cota de revisão.

**Dentro de cada grupo:**
- inéditos começam pelos verbos menos praticados;
- entre os fracos, vêm primeiro os que estão a um acerto de firmar e não foram vistos hoje, e a exposição acumulada pesa contra;
- vencidos vêm por atraso relativo.

**Variedade:** evita repetir um verbo numa janela curta e a mesma forma duas vezes seguidas. Só relaxa quando não há alternativa no grupo.

Os modos **Treinar uma forma**, **Treinar grupos** e **Pontos fracos** mantêm o comportamento próprio. A cota vale para a sessão mista e as demais filas normais.

## Simulações (12 semanas, antes × depois)

Simulador com o motor real (`Session`, `recordAnswer`, `buildQueue`), relógio virtual e sementes fixas (`scripts/simular-semanas.mjs`). O "antes" é o commit `ec2d64a`, rodado a partir de um `git worktree`. Rodada de 22/11/2026.

| Cenário | Pares praticados | **Dominados** | Pendentes | Máx. apresentações de um par | Repetições imediatas |
|---|---|---|---|---|---|
| Semanal, acerta 88% (12 sessões) | 168 → 100 | **11 → 76** | 116 → 24 | 6 → 7 | 0 → 0 |
| Semanal, acerta 72% | 148 → 88 | **6 → 44** | 93 → 44 | 10 → 7 | 1 → 0 |
| Semanal, ない/なかった difíceis | 165 → 97 | **7 → 62** | 111 → 35 | 10 → 8 | 1 → 0 |
| Semanal, 30 questões (10 sessões) | 184 → 126 | **16 → 79** | 103 → 47 | 10 → 6 | 1 → 0 |
| Diário, acerta 72% (28 sessões) | 246 → 160 | **61 → 73** | 82 → 63 | 10 → 10 | 2 → 0 |
| Semanal, repetição desligada (8 sessões) | 120 → 68 | **2 → 38** | 93 → 30 | 7 → 6 | 1 → 0 |

*Pendentes* são pares já iniciados e ainda não firmes.

Dominados acumulados por semana, no cenário semanal de 72%:

| Semana | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Antes | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 2 | 3 | 6 | 6 |
| Depois | 0 | 8 | 12 | 14 | 18 | 20 | 24 | 28 | 33 | 36 | 40 | 44 |

**Repetição de erros na mesma sessão.**
- **Antes:** o par errado voltava 1 a 33 questões depois, às vezes como a questão seguinte.
- **Agora:** volta 2 a 11 questões depois, em posição sorteada, nunca imediatamente (0 repetições imediatas em todos os cenários).
- **Desligada:** 0 reapresentações, e o domínio ainda sobe de 2 para 38 em 8 semanas.

**Manutenção sem monopólio (correção de 22/11/2026).** A simulação mostrou um par dominado (できます × ない, intervalo de 56 dias) presente em **todas** as 12 sessões. A causa: a cota de 10% de manutenção era preenchida pelos poucos pares firmes disponíveis.
- **Agora:** só disputam essa cota os pares firmes que já passaram da metade do intervalo. Os demais ficam como reserva, usada só se faltar o resto.
- **Efeito:** o máximo de apresentações de um mesmo par caiu de 12 para 7 nesse cenário.
- Há um teste de regressão em `tests/weekly-progress.test.js`.

**O custo, dito com clareza:**

- **Menos pares praticados** (por exemplo, 168 → 100 em 12 semanas). Depois da primeira sessão, cada sessão de 20 questões abre 5 a 10 pares inéditos; antes abria de 2 a 20, conforme o sorteio. É a troca deliberada: antes o app abria muitos pares e não firmava quase nenhum; agora abre menos e firma mais.
- **Ganho por cenário:** com estudo semanal, o número de dominados é de 4,9 a 19 vezes maior. Com estudo diário, que já funcionava, o ganho é modesto (61 → 73, 1,2 vez).
- **Cobertura:** em 12 semanas de 20 questões, cerca de 100 das 286 combinações são praticadas. As restantes continuam entrando pela cota de inéditos (de 12% a 35% de cada sessão), sem passar à frente da consolidação do que já começou.

## O que não mudou

- O banco de verbos, as regras e as explicações.
- O histórico existente: nenhuma migração reescreve pares. Os campos novos (`lastRightAt`, `prevRightAt`, `reinforced`, `reinforcedOk`) começam vazios, e o domínio já registrado é mantido.
