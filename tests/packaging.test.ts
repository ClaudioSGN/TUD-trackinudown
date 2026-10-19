import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('empacotamento do aplicativo', () => {
  it('inclui o processador nativo de imagens como dependência de produção', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'))

    expect(packageJson.dependencies.sharp).toBeTruthy()
    expect(packageJson.devDependencies.sharp).toBeUndefined()
  })

  it('não carrega o processador de imagens durante a inicialização do TUD', () => {
    const source = fs.readFileSync(path.resolve('electron/services/web-sync.ts'), 'utf8')

    expect(source).not.toMatch(/^import\s+.+\s+from\s+['"]sharp['"]/m)
    expect(source).toContain("import('sharp')")
  })
})
