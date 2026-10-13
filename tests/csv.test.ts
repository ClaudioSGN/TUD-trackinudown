import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { TudDatabase } from '../electron/db/database'
import { FileService } from '../electron/services/files'
import { buildDetailedCsv, detailedCsvFileName } from '../electron/services/csv'

describe('relatório CSV detalhado', () => {
  let root = ''
  let database: TudDatabase
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'tud-csv-test-')); database = new TudDatabase(root) })
  afterEach(() => { database.close(); fs.rmSync(root, { recursive: true, force: true }) })

  it('inclui identificação, contatos, histórico, anexos e chamados relacionados', () => {
    const condominioId = database.createCondominio({
      nome: 'Residencial Aurora', endereco: 'Rua Central, 10', contato: '(34) 3333-0000',
      gestor_nome: 'Marina', gestor_contato: 'marina@exemplo.com', ti_nome: 'Equipe Norte', ti_contato: '(34) 99999-0000',
      observacoes: 'Acesso pela portaria principal.'
    })
    const first = database.createAtendimento({ condominioId, titulo: 'Câmera offline', descricao: 'Câmera do bloco A sem imagem.', prioridade: 'Alta' })
    const second = database.createAtendimento({ condominioId, titulo: 'Retorno técnico' })
    database.addUpdate(first, { text: 'Técnico acionado.', status: 'Em andamento', categoria: 'Visita' })
    database.linkAtendimento(first, second)
    new FileService(root, database).addBuffer(first, new Uint8Array([137, 80, 78, 71]), 'image/png', 'captura-portaria.png')

    const csv = buildDetailedCsv(database)
    expect(csv).toContain('"ID do chamado"')
    expect(csv).toContain('"TUD-0001"')
    expect(csv).toContain('"Marina"')
    expect(csv).toContain('Nota: Técnico acionado.')
    expect(csv).toContain('Status: Aberto → Em andamento')
    expect(csv).toContain('Categoria: Suporte remoto → Visita')
    expect(csv).toContain('captura-portaria.png')
    expect(csv).toContain('TUD-0002')
  })

  it('gera um nome descritivo e datado', () => {
    expect(detailedCsvFileName(new Date(2026, 9, 13, 9, 5))).toBe('TUD-atendimentos-2026-10-13_09-05.csv')
    expect(detailedCsvFileName(new Date(2026, 9, 13, 9, 5), 'Jardins Gênova')).toBe('TUD-atendimentos-jardins-genova-2026-10-13_09-05.csv')
  })
})
