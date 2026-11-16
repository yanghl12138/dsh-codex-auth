import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'

it('rejects unknown source targets before reading inputs or installing', () => {
  const result = spawnSync(process.execPath, ['scripts/check-dsh-source.mjs', '/missing', '/missing'], {
    encoding: 'utf8', env: { ...process.env, DSH_VERIFY_VERSION: '0.2.1-rc.5' },
  })
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain('Unsupported DSH verification version')
})

it.each(['0.2.2-rc.1', '0.2.2-rc.2'])('rejects an incorrect Desktop patch for %s before installation', version => {
  const directory = mkdtempSync(join(tmpdir(), 'codex-source-patch-'))
  try {
    const patch = join(directory, 'pi-ai.patch')
    writeFileSync(patch, 'incorrect synthetic patch')
    const result = spawnSync(process.execPath, ['scripts/check-dsh-source.mjs', directory, patch], {
      encoding: 'utf8', env: { ...process.env, DSH_VERIFY_VERSION: version },
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Expected the pi-ai 1.3.0 runtime patch')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
