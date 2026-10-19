import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { TudDatabase } from '../electron/db/database'
import { FileService } from '../electron/services/files'
import { buildWebSnapshot } from '../electron/services/web-sync'

describe('visualização online', () => {
  let root = ''
  let database: TudDatabase

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'tud-web-sync-'))
    database = new TudDatabase(root)
  })

  afterEach(() => {
    database.close()
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('gera um retrato somente para leitura com chamados, contatos e linha do tempo', async () => {
    const condominiumId = database.createCondominio({
      nome: 'Jardins Roma',
      endereco: 'Avenida Central, 100',
      gestor_nome: 'Marina',
      gestor_contato: 'marina@example.com',
      ti_nome: 'Equipe Alfa',
      ti_contato: '(34) 3333-0000'
    })
    const ticketId = database.createAtendimento({ condominioId: condominiumId, titulo: 'Portão sem comunicação', descricao: 'Controladora não responde.' })
    database.addUpdate(ticketId, { text: 'Técnico acionado.', status: 'Em andamento', categoria: 'Visita' })

    const { snapshot, prepared } = await buildWebSnapshot(database, root, '9.9.9')

    expect(snapshot).toMatchObject({ schemaVersion: 1, appVersion: '9.9.9', summary: { total: 1, inProgress: 1, completed: 0 } })
    expect(snapshot.condominiums[0]).toMatchObject({ name: 'Jardins Roma', managerName: 'Marina', itName: 'Equipe Alfa' })
    expect(snapshot.tickets[0]).toMatchObject({ id: ticketId, title: 'Portão sem comunicação', status: 'Em andamento', category: 'Visita', attachments: [] })
    expect(snapshot.tickets[0].updates.map(update => update.type)).toEqual(expect.arrayContaining(['criacao', 'nota', 'status', 'categoria']))
    expect(prepared).toEqual([])
  })

  it('gera cópias web dos anexos sem alterar os arquivos originais', async () => {
    const condominiumId = database.createCondominio({ nome: 'Solar Azul' })
    const ticketId = database.createAtendimento({ condominioId: condominiumId, titulo: 'Teste de imagem' })
    const updateId = database.addUpdate(ticketId, { text: 'Imagem recebida.' })
    const original = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#3658f5' } }).png().toBuffer()
    const files = new FileService(root, database)
    const saved = files.addBuffer(ticketId, original, 'image/png', 'captura.png', updateId)

    const { snapshot, prepared } = await buildWebSnapshot(database, root, '9.9.9')

    expect(prepared).toHaveLength(1)
    expect(prepared[0].attachment).toMatchObject({ id: saved.id, updateId, name: 'captura.png' })
    expect(prepared[0].attachment.mediaKey).toMatch(/^[a-f0-9]{64}$/)
    expect((await sharp(prepared[0].bytes).metadata()).format).toBe('webp')
    expect(fs.readFileSync(path.join(root, saved.caminho))).toEqual(original)
    expect(snapshot.tickets[0].attachments[0].mediaKey).toBe(prepared[0].attachment.mediaKey)
  })
})

