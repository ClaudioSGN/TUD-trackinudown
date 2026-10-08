import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { TudDatabase } from '../electron/db/database'

describe('TudDatabase', () => {
  let root = ''
  let database: TudDatabase
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'tud-test-')); database = new TudDatabase(root) })
  afterEach(() => { database.close(); fs.rmSync(root, { recursive: true, force: true }) })

  it('impede condomínios equivalentes por acento, caixa e espaços', () => {
    database.createCondominio({ nome: 'Residencial São José' })
    expect(() => database.createCondominio({ nome: '  residencial sao jose  ' })).toThrow(/Já existe/)
  })

  it('inicia com somente as quatro categorias definidas', () => {
    expect(database.settings().categories).toEqual(['Suporte remoto', 'Elétrica', 'Infraestrutura', 'Visita'])
  })

  it('salva a preferência de tema escuro', () => {
    expect(database.settings().theme).toBe('light')
    database.setSettings({ theme: 'dark' })
    expect(database.settings().theme).toBe('dark')
  })

  it('lista todos os status do condomínio do mais recente para o mais antigo', () => {
    const id = database.createCondominio({ nome: 'Aurora' })
    database.createAtendimento({ condominioId: id, titulo: 'Primeiro', status: 'Concluído', dataAtendimento: '2026-01-01T10:00:00.000Z' })
    database.createAtendimento({ condominioId: id, titulo: 'Segundo', status: 'Aberto', dataAtendimento: '2026-02-01T10:00:00.000Z' })
    expect(database.listAtendimentos({ condominioId: id }).map(x => x.titulo)).toEqual(['Segundo', 'Primeiro'])
  })

  it('faz busca sem diferenciar acentos', () => {
    const id = database.createCondominio({ nome: 'Gaivota' })
    database.createAtendimento({ condominioId: id, titulo: 'Reunião com o síndico' })
    expect(database.listAtendimentos({ search: 'sindico' })).toHaveLength(1)
  })

  it('localiza atendimento pelo identificador visível', () => {
    const condominioId = database.createCondominio({ nome: 'Village Karaiba' })
    const id = database.createAtendimento({ condominioId, titulo: 'Retorno' })
    expect(database.listAtendimentos({ search: `TUD-${String(id).padStart(4, '0')}` })[0].id).toBe(id)
    expect(database.listAtendimentos({ search: `#${id}` })[0].id).toBe(id)
  })

  it('exclui de forma reversível', () => {
    const condominioId = database.createCondominio({ nome: 'Bela Vista' })
    const id = database.createAtendimento({ condominioId, titulo: 'Portão' })
    database.removeAtendimento(id); expect(database.listAtendimentos()).toHaveLength(0)
    database.undoRemove(id); expect(database.listAtendimentos()).toHaveLength(1)
  })

  it('vincula e desvincula atendimentos relacionados', () => {
    const condominioId = database.createCondominio({ nome: 'Jardins Roma' })
    const first = database.createAtendimento({ condominioId, titulo: 'Chamado original' })
    const second = database.createAtendimento({ condominioId, titulo: 'Retorno técnico' })
    database.linkAtendimento(first, second)
    expect(database.relatedAtendimentos(first).map(x => x.id)).toEqual([second])
    database.unlinkAtendimento(first, second)
    expect(database.relatedAtendimentos(first)).toHaveLength(0)
  })

  it('mantém notas e alterações automáticas no histórico do atendimento', () => {
    const condominioId = database.createCondominio({ nome: 'Jardins Europa' })
    const id = database.createAtendimento({ condominioId, titulo: 'Interfone sem áudio' })
    database.addUpdate(id, { text: 'Teste realizado na portaria.' })
    database.setStatus(id, 'Em andamento')
    database.updateAtendimento(id, { condominioId, titulo: 'Interfone sem áudio', categoria: 'Visita', status: 'Concluído' })
    const updates = database.listUpdates(id)
    expect(updates.map(update => update.tipo)).toEqual(expect.arrayContaining(['criacao', 'nota', 'status', 'categoria']))
    expect(updates.find(update => update.tipo === 'nota')?.texto).toBe('Teste realizado na portaria.')
    expect(updates.some(update => update.tipo === 'categoria' && update.valor_anterior === 'Suporte remoto' && update.valor_novo === 'Visita')).toBe(true)
    expect(updates.some(update => update.tipo === 'status' && update.valor_novo === 'Concluído')).toBe(true)
  })

  it('agrupa texto, status e categoria na mesma atualização', () => {
    const condominioId = database.createCondominio({ nome: 'Morada Nova' })
    const id = database.createAtendimento({ condominioId, titulo: 'Portão travado' })
    database.addUpdate(id, { text: 'Técnico enviado ao local.', status: 'Em andamento', categoria: 'Visita' })
    const updates = database.listUpdates(id).filter(update => update.tipo !== 'criacao')
    expect(new Set(updates.map(update => update.criado_em)).size).toBe(1)
    expect(updates.map(update => update.tipo)).toEqual(expect.arrayContaining(['nota', 'status', 'categoria']))
    expect(database.getAtendimento(id)).toMatchObject({ status: 'Em andamento', categoria: 'Visita' })
  })

  it('exclui uma atualização completa sem apagar a criação ou alterar o estado atual', () => {
    const condominioId = database.createCondominio({ nome: 'Parque Central' })
    const id = database.createAtendimento({ condominioId, titulo: 'Câmera offline' })
    database.addUpdate(id, { text: 'Equipamento reiniciado.', status: 'Em andamento', categoria: 'Visita' })
    const removable = database.listUpdates(id).filter(update => update.tipo !== 'criacao').map(update => update.id)
    database.removeUpdates(id, removable)
    expect(database.listUpdates(id)).toMatchObject([{ tipo: 'criacao' }])
    expect(database.getAtendimento(id)).toMatchObject({ status: 'Em andamento', categoria: 'Visita' })
  })

  it('cria, vincula e conclui lembretes', () => {
    const condominioId = database.createCondominio({ nome: 'Solar das Flores' })
    const atendimentoId = database.createAtendimento({ condominioId, titulo: 'Retorno da portaria' })
    const id = database.createReminder({ titulo: 'Ligar para o síndico', lembreteEm: '2026-10-08T12:00:00.000Z', atendimentoId })
    expect(database.listReminders()).toMatchObject([{ id, atendimento_id: atendimentoId, atendimento_titulo: 'Retorno da portaria', condominio_nome: 'Solar das Flores' }])
    database.setReminderDone(id, true)
    expect(database.listReminders()).toHaveLength(0)
    expect(database.listReminders(true)[0].concluido).toBe(1)
  })

  it('identifica lembretes vencidos ainda não notificados', () => {
    const id = database.createReminder({ titulo: 'Prazo vencido', lembreteEm: '2020-01-01T10:00:00.000Z' })
    expect(database.dueReminders().map(reminder => reminder.id)).toContain(id)
    database.markReminderNotified(id)
    expect(database.dueReminders()).toHaveLength(0)
  })

  it('cadastra, pesquisa, edita e exclui gestores e equipes de T.I.', () => {
    const condominioId = database.createCondominio({ nome: 'Residencial Vitória' })
    const gestorId = database.createContact({ tipo: 'Gestor', nome: 'Márcia Souza', telefone: '(34) 99999-0000', condominioId })
    const tiId = database.createContact({ tipo: 'Equipe de T.I.', nome: 'Núcleo Técnico', empresa: 'Suporte Ágil', email: 'ti@exemplo.com' })
    expect(database.listContacts('marcia')).toMatchObject([{ id: gestorId, condominio_nome: 'Residencial Vitória' }])
    expect(database.listContacts('', 'Equipe de T.I.')).toMatchObject([{ id: tiId, nome: 'Núcleo Técnico' }])
    database.updateContact(tiId, { tipo: 'Equipe de T.I.', nome: 'Núcleo Técnico 24h', empresa: 'Suporte Ágil' })
    expect(database.listContacts('24h')[0].nome).toBe('Núcleo Técnico 24h')
    database.removeContact(gestorId)
    expect(database.listContacts('marcia')).toHaveLength(0)
  })
})
