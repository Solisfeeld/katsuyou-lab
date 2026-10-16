-- Snapshot de progresso do 活用ラボ, uma linha por usuário do Netlify Identity.
--
-- Tabela deliberadamente SEPARADA de user_progress (Bunpou Lab): os dois
-- aplicativos compartilham o padrão arquitetural, nunca os registros (§39).
--
-- O progresso não é normalizado de propósito: o objeto de estado do app já
-- é a unidade coerente (contadores, domínio por verbo × forma, erros
-- recentes e configurações), e dividi-lo em tabelas permitiria que essas
-- partes ficassem incoerentes entre si.
CREATE TABLE IF NOT EXISTS katsuyou_progress (
  user_id       TEXT PRIMARY KEY,
  progress_json JSONB       NOT NULL,
  revision      BIGINT      NOT NULL DEFAULT 1,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consulta por data de atualização (diagnóstico/operacional).
CREATE INDEX IF NOT EXISTS katsuyou_progress_updated_at_idx
  ON katsuyou_progress (updated_at DESC);
