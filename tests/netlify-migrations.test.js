/* ===================================================================
   Migrations do Netlify Database já aplicadas em produção.

   O Netlify guarda o histórico de migrations no banco. Se um arquivo
   que já consta desse histórico some do repositório, o build falha com:

     Database migration failed: migration "<nome>" (version <ts>)
     has been removed after being applied

   Uma migration já aplicada é, portanto, imutável: não se renomeia, não
   se reescreve e não se apaga. Este teste existe para que uma futura
   reconstrução ou reempacotamento do projeto não a remova em silêncio.

   Não é um teste do SQL — é um teste de presença.
   =================================================================== */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = resolve(ROOT, 'netlify/database/migrations');

/* Migrations já aplicadas ao banco do Netlify. Só se acrescenta a esta
   lista — nunca se remove nem se edita uma entrada existente. */
const APPLIED = [
  {
    file: '20260820120000_katsuyou_progress.sql',
    mustContain: 'CREATE TABLE IF NOT EXISTS katsuyou_progress'
  }
];

for (const { file, mustContain } of APPLIED) {
  test(`a migration aplicada "${file}" continua no repositório`, () => {
    const path = resolve(MIGRATIONS_DIR, file);
    assert.ok(
      existsSync(path),
      `netlify/database/migrations/${file} sumiu. Ela já foi aplicada no ` +
      'Netlify Database: restaure o arquivo com o conteúdo original em vez ' +
      'de criar uma migration nova com outro timestamp.'
    );
    const sql = readFileSync(path, 'utf8');
    assert.ok(
      sql.includes(mustContain),
      `${file} existe mas não contém "${mustContain}".`
    );
  });
}

test('nenhuma migration aplicada foi renomeada', () => {
  assert.ok(existsSync(MIGRATIONS_DIR), 'o diretório de migrations sumiu');
  const presentes = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));
  for (const { file } of APPLIED) {
    assert.ok(
      presentes.includes(file),
      `"${file}" não está entre os arquivos presentes (${presentes.join(', ') || 'nenhum'}).`
    );
  }
});
