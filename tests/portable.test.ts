import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { TudDatabase } from '../electron/db/database'
import { FileService } from '../electron/services/files'
import { createPortableArchive, inspectPortableArchive, portableFileName, restorePortableArchive } from '../electron/services/portable'

describe('arquivo portátil do TUD', () => {
  const roots: string[] = []
  const databases: TudDatabase[] = []
  afterEach(() => {
    databases.forEach(database => database.close())
    roots.forEach(root => fs.rmSync(root, { recursive: true, force: true }))
    roots.length = 0; databases.length = 0
  })

  it('leva banco de dados e anexos para outra instalação em um único arquivo', async () => {
    const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tud-portable-source-'))
    const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tud-portable-target-'))
    roots.push(sourceRoot, targetRoot)
    const source = new TudDatabase(sourceRoot)
    const target = new TudDatabase(targetRoot)
    databases.push(source, target)

    const condoId = source.createCondominio({ nome: 'Jardins Central', gestor_nome: 'Ana' })
    const ticketId = source.createAtendimento({ condominioId: condoId, titulo: 'Portão sem comunicação' })
    source.addUpdate(ticketId, { text: 'Módulo reiniciado.', status: 'Em andamento' })
    new FileService(sourceRoot, source).addBuffer(ticketId, new Uint8Array([137, 80, 78, 71]), 'image/png', 'portao.png')
    target.createCondominio({ nome: 'Dados que serão substituídos' })

    const archive = path.join(sourceRoot, portableFileName(new Date(2026, 9, 13, 10, 30, 0)))
    await createPortableArchive(source, sourceRoot, archive, '3.2.5')
    const inspected = inspectPortableArchive(archive)
    expect(inspected.manifest).toMatchObject({ format: 'tud-portable-backup', formatVersion: 1, tickets: 1, attachments: 1 })

    await restorePortableArchive(target, targetRoot, archive, '3.2.5')
    const restored = new TudDatabase(targetRoot)
    databases.push(restored)
    expect(restored.listCondominios().map(item => item.nome)).toEqual(['Jardins Central'])
    const ticket = restored.listAtendimentos()[0]
    expect(ticket).toMatchObject({ titulo: 'Portão sem comunicação', status: 'Em andamento', anexo_count: 1 })
    const attachment = restored.getAtendimento(ticket.id)?.anexos?.[0]
    expect(attachment?.nome_original).toBe('portao.png')
    expect(fs.existsSync(path.join(targetRoot, attachment!.caminho))).toBe(true)
    expect(fs.readdirSync(path.join(targetRoot, 'backups')).some(name => name.endsWith('.tud'))).toBe(true)
  })
})
