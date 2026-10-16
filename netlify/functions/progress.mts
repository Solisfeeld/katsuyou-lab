/* ===================================================================
   GET  /.netlify/functions/progress  -> snapshot da conta autenticada
   PUT  /.netlify/functions/progress  -> grava com concorrência otimista

   Tabela PRÓPRIA do 活用ラボ: katsuyou_progress. O Bunpou Lab usa
   user_progress e nunca é tocado por esta função (§39).

   O identificador do usuário vem EXCLUSIVAMENTE de getUser(), resolvido
   pelo runtime a partir da sessão do Identity. Nada no corpo da
   requisição influencia qual linha é lida ou escrita.
   =================================================================== */
import type { Context } from '@netlify/functions';
import { getUser } from '@netlify/identity';
import { getDatabase } from '@netlify/database';

const MAX_BYTES = 1024 * 1024;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

/* revision é BIGINT: alguns drivers devolvem string. */
const num = (v: unknown) => (typeof v === 'bigint' ? Number(v) : Number(v ?? 0));

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, PUT' } });
  }

  let user: { id: string } | null = null;
  try {
    user = await getUser();
  } catch {
    return json(401, { error: 'unauthorized' });
  }
  if (!user?.id) return json(401, { error: 'unauthorized' });
  const userId = user.id;

  let sql: ReturnType<typeof getDatabase>['sql'];
  try {
    ({ sql } = getDatabase());
  } catch (err) {
    console.error('database unavailable', err);
    return json(503, { error: 'database_unavailable' });
  }

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT progress_json, revision, updated_at
        FROM katsuyou_progress
        WHERE user_id = ${userId}
      ` as Array<{ progress_json: unknown; revision: unknown; updated_at: unknown }>;

      if (!rows.length) {
        return json(200, { exists: false, progress: null, revision: 0, updatedAt: null });
      }
      return json(200, {
        exists: true,
        progress: rows[0].progress_json,
        revision: num(rows[0].revision),
        updatedAt: rows[0].updated_at
      });
    }

    /* ---------------- PUT ---------------- */
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return json(413, { error: 'payload_too_large' });

    let payload: { progress?: unknown; baseRevision?: unknown };
    try { payload = JSON.parse(raw); }
    catch { return json(400, { error: 'invalid_json' }); }

    const progress = payload?.progress;
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
      return json(400, { error: 'invalid_progress' });
    }
    const base = Number(payload?.baseRevision);
    if (!Number.isInteger(base) || base < 0) {
      return json(400, { error: 'invalid_base_revision' });
    }
    const snapshot = JSON.stringify(progress);

    if (base === 0) {
      const created = await sql`
        INSERT INTO katsuyou_progress (user_id, progress_json, revision, updated_at)
        VALUES (${userId}, ${snapshot}::jsonb, 1, NOW())
        ON CONFLICT (user_id) DO NOTHING
        RETURNING revision, updated_at
      ` as Array<{ revision: unknown; updated_at: unknown }>;

      if (created.length) {
        return json(200, { revision: num(created[0].revision), updatedAt: created[0].updated_at });
      }
      const cur = await sql`
        SELECT progress_json, revision, updated_at FROM katsuyou_progress WHERE user_id = ${userId}
      ` as Array<{ progress_json: unknown; revision: unknown; updated_at: unknown }>;
      return json(409, {
        error: 'revision_conflict',
        exists: true,
        progress: cur[0]?.progress_json ?? null,
        revision: num(cur[0]?.revision),
        updatedAt: cur[0]?.updated_at ?? null
      });
    }

    /* A própria condição da UPDATE impede sobrescrever versão mais nova. */
    const updated = await sql`
      UPDATE katsuyou_progress
      SET progress_json = ${snapshot}::jsonb,
          revision = revision + 1,
          updated_at = NOW()
      WHERE user_id = ${userId} AND revision = ${base}
      RETURNING revision, updated_at
    ` as Array<{ revision: unknown; updated_at: unknown }>;

    if (updated.length) {
      return json(200, { revision: num(updated[0].revision), updatedAt: updated[0].updated_at });
    }

    const cur = await sql`
      SELECT progress_json, revision, updated_at FROM katsuyou_progress WHERE user_id = ${userId}
    ` as Array<{ progress_json: unknown; revision: unknown; updated_at: unknown }>;

    if (!cur.length) {
      return json(409, { error: 'revision_conflict', exists: false, progress: null, revision: 0, updatedAt: null });
    }
    return json(409, {
      error: 'revision_conflict',
      exists: true,
      progress: cur[0].progress_json,
      revision: num(cur[0].revision),
      updatedAt: cur[0].updated_at
    });
  } catch (err) {
    console.error('katsuyou progress function error', err);
    return json(500, { error: 'internal_error' });
  }
};
