# 活用ラボ

**Laboratório de Conjugação — Rikai N5**

Treino de produção ativa de conjugação verbal japonesa. Você recebe o ます形 e
escreve a forma pedida; quando erra, o site mostra **como chegar** à forma
correta, com a regra e a lição do Rikai que a sustenta.

O objetivo é automatismo: responder sem reconstruir a regra conscientemente.

```
のみます
beber

FORMA PEDIDA
Forma て

[ のんで ]
```

## Escopo

Seis formas-alvo, todas sustentadas pelo **Básico Rikai**:

| Forma | Lição |
|---|---|
| Forma て | 01 |
| Forma de dicionário（辞書形） | 02 |
| Forma た | 13 |
| Forma ない | 15 |
| Forma たり | 16 (`V たり、V たり しています`) |
| Forma なかった | 16 (reforçada em 17 e 18) |

Mais o treino de identificação de Grupo 1 / 2 / 3.

Nada além disso: potencial, passiva, causativa, volitiva, imperativo e
condicionais estão fora, e estruturas como `Vています` ou `Vないでください` não são tratadas
como formas-alvo. A justificativa completa está em [AUDITORIA.md](AUDITORIA.md).

## Rodar localmente

Requer Node 20 ou superior.

```bash
npm install
npm run dev        # http://localhost:5174
```

Outros comandos:

```bash
npm test             # motor, agendamento, progresso e interface (jsdom)
npm run check-content # banco × motor × fontes Rikai; falha em divergência
npm run audit-feedback # imprime o feedback de erro para inspeção humana
npm run build        # gera dist/
npm run preview      # serve dist/
```

`npm run audit-feedback <verbo>` inspeciona um verbo só, por id
(ex.: `npm run audit-feedback kaimasu`).

## Publicar no Netlify

O site é **independente** do Bunpou Lab: outro site no Netlify, outra instância
de Identity, outra tabela no banco. Publicar um nunca toca no progresso do outro.

1. **Criar o site** apontando para este diretório (`katsuyou-lab/`) como base.
   `netlify.toml` já define `command = npm run build`, `publish = dist` e
   `functions = netlify/functions`.

   ```bash
   npx netlify-cli init      # dentro de katsuyou-lab/
   ```

2. **Publicar**:

   ```bash
   npx netlify-cli deploy --prod
   ```

## Sincronização com Google no Netlify

Opcional. Serve para manter o mesmo progresso em vários dispositivos. Sem ela o
site funciona por inteiro — veja *Backup* logo abaixo.

Para o deploy real, na ordem:

1. **Habilitar o Netlify Identity** — painel do site → *Site configuration →
   Identity → Enable*. Em *Registration*, deixe **Invite only** se o site for só
   seu.
2. **Habilitar o Google em External providers** — *Identity → Authentication
   providers → Google*. É o provedor que o botão **Entrar com Google** aciona.
3. **Manter a Function `progress`** — `netlify/functions/progress.mts`, servida
   em `/.netlify/functions/progress`. Ela resolve o usuário exclusivamente por
   `getUser()` do Identity; nada do corpo da requisição escolhe qual linha é
   lida ou escrita.
4. **Provisionar o banco** (Netlify DB / Neon):

   ```bash
   npx netlify-cli db init
   ```

5. **Aplicar a migração `katsuyou_progress`** — o arquivo em
   `netlify/database/migrations/` cria a tabela, que é exclusiva deste app.

> **O login com Google só funciona no ambiente publicado e configurado do
> Netlify.** Em `npm run dev` não existem `/.netlify/identity` nem
> `/.netlify/functions`, então a seção *Conta e sincronização* apenas informa
> isso e nenhum botão de login aparece. Todo o resto do site — treino,
> progresso, backup — funciona normalmente em desenvolvimento.

Na interface (*Configurações → Conta e sincronização*):

| Estado | O que aparece |
|---|---|
| sem conta | “Sincronize seu progresso” + **Entrar com Google** |
| `loading` | Sincronizando… |
| `synced` | ✓ Progresso sincronizado + última sincronização |
| `dirty` | Alterações aguardando sincronização… |
| `offline` | Sem conexão; o progresso continua salvo no dispositivo |
| `error` | Não foi possível sincronizar agora |
| `auth-required` | Sessão expirada; entrar novamente |
| `conflict` | Escolha entre **Usar progresso deste dispositivo** e **Usar progresso da nuvem** |

Conflito nunca é resolvido em silêncio: quando as duas pontas mudaram, o app
para e pergunta. **Sair** encerra a sessão do Identity e não apaga nada do
progresso local.

Sem Identity ou sem banco, o site continua inteiro: o progresso fica no
`localStorage` e a sincronização apenas não liga. O treino nunca depende da rede.

## Backup do progresso

Arquivo manual, em *Configurações → Backup do progresso*. É **complementar** à
sincronização, não substituto: a sincronização mantém o progresso entre
dispositivos através da conta; o backup é um arquivo que você guarda.

**Exportar progresso** baixa `katsuyou-lab-progresso-AAAA-MM-DD.json`, com o
envelope:

```json
{
  "app": "katsuyou-lab",
  "formatVersion": 1,
  "exportedAt": "2026-08-21T00:00:00.000Z",
  "progress": { "version": 2, "pairs": {}, "groupPractice": {}, "…": "…" }
}
```

O `progress` é recortado pela lista fechada `PROGRESS_FIELDS` do store: pares
verbo × forma, treino de grupos, sessões, erros recentes, configurações e datas.
**O backup não contém credenciais** — nada de token, cookie, sessão do Identity
ou metadado de login. Esses dados vivem em outra chave do `localStorage`, que o
módulo de backup nunca lê.

**Importar progresso** abre um seletor de arquivo e valida antes de tocar em
qualquer estado: JSON válido (via `JSON.parse`, nunca `eval`), envelope do
Katsuyou Lab, `formatVersion` suportada, `progress` como objeto e tamanho
dentro do limite. Só então aparece a confirmação **“Este backup substituirá o
progresso atual deste dispositivo”**, com *Cancelar* e *Importar e substituir*.
O progresso importado passa pelo mesmo saneamento do store — inclusive a
migração de schema v1 → v2 — de modo que um arquivo antigo ou adulterado não
consegue quebrar o app nem inflar o universo de combinações treináveis.

Se houver conta conectada, a importação usa o caminho normal
(`replaceState` → `save` → sincronização) e o envio acontece sozinho; se der
conflito de revisão, cai no mesmo fluxo local × nuvem descrito acima.

**Exportar e importar funcionam sem conta nenhuma.**

## Estrutura

```
katsuyou-lab/
├── index.html
├── package.json · vite.config.js · netlify.toml
├── AUDITORIA.md              auditoria das fontes Rikai
├── scripts/
│   ├── check-content.js      guardião da integridade do conteúdo
│   └── audit-feedback.js     relatório pedagógico do §53
├── netlify/
│   ├── functions/progress.mts
│   └── database/migrations/  tabela katsuyou_progress
├── tests/
│   ├── conjugation.test.js   motor, banco, explicações, diagnóstico
│   ├── practice.test.js      agendamento, progresso, ciclo de sessão
│   ├── session-limits.test.js  sessões por tempo e separação do treino de grupos
│   ├── account-backup.test.js  conta/sincronização e backup do progresso
│   └── ui.test.js            telas e fluxo principal, em jsdom
└── src/
    ├── main.js · styles.css · auth-sync.js
    ├── data/
    │   ├── verbs.js          48 verbos auditados contra o Rikai
    │   └── sources.js        registro das lições citadas
    ├── conjugation/
    │   ├── kana.js           tabelas de linha /i/, /u/, /a/
    │   ├── rules.js          motor: calcula e registra cada passo
    │   ├── explain.js        explicação e dicas progressivas
    │   ├── diagnose.js       identifica o tipo do erro
    │   └── normalize.js      respostas aceitas
    ├── practice/
    │   ├── engine.js         estado de uma sessão
    │   └── scheduler.js      seleção e reapresentação de itens
    ├── progress/
    │   ├── store.js          domínio por verbo × forma
    │   └── backup.js         exportar/importar arquivo de progresso
    └── ui/                   dom · home · practice · progress · reference · app
```

## Duas camadas de conteúdo

O banco (`src/data/verbs.js`) guarda as formas auditadas. O motor
(`src/conjugation/rules.js`) conhece as regras do Rikai e calcula as formas do
zero, registrando a transformação passo a passo. `npm run check-content`
confronta as duas camadas: qualquer divergência derruba o comando.

É essa separação que permite explicar um erro em vez de só corrigi-lo — a
explicação é o caminho que o motor percorreu, não um texto guardado à mão.

## Progresso

A unidade de domínio é **verbo × forma**, não o verbo. `のみます × て` e
`のみます × ない` são medidos separadamente.

Armazenamento local em `katsuyou_lab_progress_v1` — chave própria, sem qualquer
relação com as do Bunpou Lab.
