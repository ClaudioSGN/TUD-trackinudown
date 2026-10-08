import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import type { AppSettings, Atendimento, AtendimentoAtualizacao, AtendimentoFilters, AtendimentoInput, AtendimentoUpdateInput, Condominio, DashboardData, Lembrete, LembreteInput, Periodo, Status } from '../../src/types/domain'
import migration from './migrations/001_init.sql?raw'

const defaultCategories = ['Suporte remoto', 'Elétrica', 'Infraestrutura', 'Visita']
const defaults: AppSettings = {
  theme: 'light',
  animation: 'full', backgroundEffects: true, splash: true, particles: true,
  density: 'comfortable', categories: defaultCategories,
  startWithWindows: false, tray: false, closeBehavior: 'quit', globalShortcut: true,
  autoBackup: false, backupFolder: '', onboardingSeen: false, lastRoute: 'dashboard'
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR')
const now = () => new Date().toISOString()

export class TudDatabase {
  readonly db: Database.Database

  constructor(readonly root: string) {
    fs.mkdirSync(root, { recursive: true })
    this.db = new Database(path.join(root, 'tud.db'))
    const currentVersion = Number(this.db.pragma('user_version', { simple: true }))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.exec(migration)
    const condominiumColumns = new Set((this.db.pragma('table_info(condominios)') as Array<{ name: string }>).map(column => column.name))
    for (const column of ['gestor_nome', 'gestor_contato', 'ti_nome', 'ti_contato']) {
      if (!condominiumColumns.has(column)) this.db.exec(`ALTER TABLE condominios ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`)
    }
    if (currentVersion < 2) {
      const migrateCategories = this.db.transaction(() => {
        this.db.prepare('DELETE FROM categorias').run()
        const insert = this.db.prepare('INSERT INTO categorias(nome,ordem) VALUES(?,?)')
        defaultCategories.forEach((name, order) => insert.run(name, order))
        this.db.pragma('user_version = 2')
      })
      migrateCategories()
    }
    if (currentVersion < 3) this.db.pragma('user_version = 3')
    if (currentVersion < 4) {
      const migrateUpdates = this.db.transaction(() => {
        this.db.prepare(`INSERT INTO atendimento_atualizacoes(atendimento_id,tipo,texto,criado_em)
          SELECT a.id,'criacao','Atendimento criado',a.criado_em FROM atendimentos a
          WHERE NOT EXISTS (SELECT 1 FROM atendimento_atualizacoes u WHERE u.atendimento_id=a.id AND u.tipo='criacao')`).run()
        this.db.pragma('user_version = 4')
      })
      migrateUpdates()
    }
    if (currentVersion < 5) {
      const preserveCreationState = this.db.transaction(() => {
        this.db.prepare(`UPDATE atendimento_atualizacoes AS creation SET
          valor_anterior=COALESCE((SELECT change.valor_anterior FROM atendimento_atualizacoes change WHERE change.atendimento_id=creation.atendimento_id AND change.tipo='status' ORDER BY change.criado_em,change.id LIMIT 1),(SELECT status FROM atendimentos WHERE id=creation.atendimento_id)),
          valor_novo=COALESCE((SELECT change.valor_anterior FROM atendimento_atualizacoes change WHERE change.atendimento_id=creation.atendimento_id AND change.tipo='categoria' ORDER BY change.criado_em,change.id LIMIT 1),(SELECT categoria FROM atendimentos WHERE id=creation.atendimento_id))
          WHERE creation.tipo='criacao'`).run()
        this.db.pragma('user_version = 5')
      })
      preserveCreationState()
    }
    if (currentVersion < 6) this.db.pragma('user_version = 6')
    if (currentVersion < 7) this.db.pragma('user_version = 7')
    if (currentVersion < 8) {
      const hasLegacyContacts = Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='contatos'").get())
      if (hasLegacyContacts) {
        const migrateContacts = this.db.transaction(() => {
          this.db.exec(`UPDATE condominios SET
            gestor_nome=COALESCE(NULLIF(gestor_nome,''),(SELECT group_concat(nome,' / ') FROM contatos WHERE condominio_id=condominios.id AND tipo='Gestor'),''),
            gestor_contato=COALESCE(NULLIF(gestor_contato,''),(SELECT group_concat(trim(telefone || CASE WHEN telefone!='' AND email!='' THEN ' · ' ELSE '' END || email),' / ') FROM contatos WHERE condominio_id=condominios.id AND tipo='Gestor'),''),
            ti_nome=COALESCE(NULLIF(ti_nome,''),(SELECT group_concat(nome || CASE WHEN empresa!='' THEN ' · ' || empresa ELSE '' END,' / ') FROM contatos WHERE condominio_id=condominios.id AND tipo='Equipe de T.I.'),''),
            ti_contato=COALESCE(NULLIF(ti_contato,''),(SELECT group_concat(trim(telefone || CASE WHEN telefone!='' AND email!='' THEN ' · ' ELSE '' END || email),' / ') FROM contatos WHERE condominio_id=condominios.id AND tipo='Equipe de T.I.'),'')`)
          this.db.pragma('user_version = 8')
        })
        migrateContacts()
      } else this.db.pragma('user_version = 8')
    }
  }

  close() { if (this.db.open) this.db.close() }

  listCondominios(includeArchived = false): Condominio[] {
    return this.db.prepare(`SELECT c.*,
      SUM(CASE WHEN a.excluido_em IS NULL AND a.status != 'Concluído' THEN 1 ELSE 0 END) abertos,
      SUM(CASE WHEN a.excluido_em IS NULL THEN 1 ELSE 0 END) total
      FROM condominios c LEFT JOIN atendimentos a ON a.condominio_id=c.id
      ${includeArchived ? '' : 'WHERE c.arquivado=0'} GROUP BY c.id ORDER BY c.nome COLLATE NOCASE`).all() as Condominio[]
  }

  createCondominio(input: Partial<Condominio>) {
    const nome = String(input.nome || '').trim()
    if (!nome) throw new Error('Informe o nome do condomínio.')
    try {
      return Number(this.db.prepare(`INSERT INTO condominios(nome,nome_norm,endereco,contato,gestor_nome,gestor_contato,ti_nome,ti_contato,observacoes,criado_em) VALUES(?,?,?,?,?,?,?,?,?,?)`)
        .run(nome, normalize(nome), input.endereco || '', input.contato || '', input.gestor_nome || '', input.gestor_contato || '', input.ti_nome || '', input.ti_contato || '', input.observacoes || '', now()).lastInsertRowid)
    } catch { throw new Error('Já existe um condomínio com esse nome.') }
  }

  updateCondominio(id: number, input: Partial<Condominio>) {
    const nome = String(input.nome || '').trim()
    if (!nome) throw new Error('Informe o nome do condomínio.')
    try { this.db.prepare(`UPDATE condominios SET nome=?,nome_norm=?,endereco=?,contato=?,gestor_nome=?,gestor_contato=?,ti_nome=?,ti_contato=?,observacoes=? WHERE id=?`).run(nome, normalize(nome), input.endereco || '', input.contato || '', input.gestor_nome || '', input.gestor_contato || '', input.ti_nome || '', input.ti_contato || '', input.observacoes || '', id) }
    catch { throw new Error('Já existe um condomínio com esse nome.') }
  }

  archiveCondominio(id: number, archived: boolean) { this.db.prepare('UPDATE condominios SET arquivado=? WHERE id=?').run(archived ? 1 : 0, id) }

  listAtendimentos(filters: AtendimentoFilters = {}): Atendimento[] {
    const clauses = ['a.excluido_em IS NULL']
    const params: unknown[] = []
    if (filters.condominioId) { clauses.push('a.condominio_id=?'); params.push(filters.condominioId) }
    if (filters.status) { clauses.push('a.status=?'); params.push(filters.status) }
    if (filters.prioridade) { clauses.push('a.prioridade=?'); params.push(filters.prioridade) }
    if (filters.categoria) { clauses.push('a.categoria=?'); params.push(filters.categoria) }
    const start = periodStart(filters.periodo)
    if (start) { clauses.push('a.data_atendimento>=?'); params.push(start) }
    if (filters.search?.trim()) {
      const rawSearch = filters.search.trim()
      const idSearch = rawSearch.match(/^(?:tud[-\s]?|#)?0*(\d+)$/i)
      if (idSearch) { clauses.push('a.id=?'); params.push(Number(idSearch[1])) }
      else {
        const query = normalize(rawSearch).split(/\s+/).filter(Boolean).map(x => `"${x.replace(/"/g, '')}"*`).join(' AND ')
        clauses.push('a.id IN (SELECT rowid FROM atendimentos_fts WHERE atendimentos_fts MATCH ?)'); params.push(query)
      }
    }
    const order = filters.sort === 'recentes' ? 'a.data_atendimento DESC,a.id DESC' : filters.sort === 'antigos' ? 'a.data_atendimento ASC,a.id ASC' : filters.sort === 'prioridade' ? `CASE a.prioridade WHEN 'Alta' THEN 0 WHEN 'Normal' THEN 1 ELSE 2 END,a.id ASC` : filters.sort === 'status' ? `CASE a.status WHEN 'Aberto' THEN 0 WHEN 'Em andamento' THEN 1 ELSE 2 END,a.id ASC` : 'a.id ASC'
    const limit = filters.limit ? ` LIMIT ${Math.max(1, Math.min(1000, filters.limit))}` : ''
    return this.db.prepare(`SELECT a.*,c.nome condominio_nome,(SELECT COUNT(*) FROM anexos x WHERE x.atendimento_id=a.id) anexo_count FROM atendimentos a JOIN condominios c ON c.id=a.condominio_id WHERE ${clauses.join(' AND ')} ORDER BY ${order}${limit}`).all(...params) as Atendimento[]
  }

  getAtendimento(id: number): Atendimento | null {
    const item = this.db.prepare(`SELECT a.*,c.nome condominio_nome,(SELECT COUNT(*) FROM anexos x WHERE x.atendimento_id=a.id) anexo_count FROM atendimentos a JOIN condominios c ON c.id=a.condominio_id WHERE a.id=?`).get(id) as Atendimento | undefined
    if (!item) return null
    item.anexos = this.db.prepare('SELECT * FROM anexos WHERE atendimento_id=? ORDER BY id').all(id) as never
    return item
  }

  createAtendimento(input: AtendimentoInput) {
    const titulo = input.titulo.trim(); if (!titulo) throw new Error('Informe o título do atendimento.')
    const stamp = now()
    const create = this.db.transaction(() => {
      const id = Number(this.db.prepare(`INSERT INTO atendimentos(condominio_id,titulo,descricao,categoria,status,prioridade,data_atendimento,concluido_em,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?)`)
        .run(input.condominioId, titulo, input.descricao || '', input.categoria || 'Suporte remoto', input.status || 'Aberto', input.prioridade || 'Normal', input.dataAtendimento || stamp, input.status === 'Concluído' ? stamp : null, stamp, stamp).lastInsertRowid)
      this.db.prepare(`INSERT INTO atendimento_atualizacoes(atendimento_id,tipo,texto,valor_anterior,valor_novo,criado_em) VALUES(?,'criacao','Atendimento criado',?,?,?)`).run(id, input.status || 'Aberto', input.categoria || 'Suporte remoto', stamp)
      return id
    })
    return create()
  }

  updateAtendimento(id: number, input: AtendimentoInput) {
    const titulo = input.titulo.trim(); if (!titulo) throw new Error('Informe o título do atendimento.')
    const current = this.getAtendimento(id); if (!current) throw new Error('Atendimento não encontrado.')
    const status = input.status || current.status
    const categoria = input.categoria || 'Suporte remoto'
    const stamp = now()
    const update = this.db.transaction(() => {
      this.db.prepare(`UPDATE atendimentos SET condominio_id=?,titulo=?,descricao=?,categoria=?,status=?,prioridade=?,data_atendimento=?,concluido_em=?,atualizado_em=? WHERE id=?`)
        .run(input.condominioId, titulo, input.descricao || '', categoria, status, input.prioridade || 'Normal', input.dataAtendimento || current.data_atendimento, status === 'Concluído' ? current.concluido_em || stamp : null, stamp, id)
      if (current.status !== status) this.recordUpdate(id, 'status', '', current.status, status, stamp)
      if (current.categoria !== categoria) this.recordUpdate(id, 'categoria', '', current.categoria, categoria, stamp)
    })
    update()
  }

  setStatus(id: number, status: Status) {
    const current = this.getAtendimento(id); if (!current) throw new Error('Atendimento não encontrado.')
    if (current.status === status) return
    const stamp = now()
    const update = this.db.transaction(() => {
      this.db.prepare('UPDATE atendimentos SET status=?,concluido_em=?,atualizado_em=? WHERE id=?').run(status, status === 'Concluído' ? stamp : null, stamp, id)
      this.recordUpdate(id, 'status', '', current.status, status, stamp)
    })
    update()
  }
  listUpdates(id: number): AtendimentoAtualizacao[] {
    return this.db.prepare('SELECT * FROM atendimento_atualizacoes WHERE atendimento_id=? ORDER BY criado_em DESC,id DESC').all(id) as AtendimentoAtualizacao[]
  }
  addUpdate(id: number, input: AtendimentoUpdateInput) {
    const current = this.getAtendimento(id)
    const row = this.db.prepare('SELECT excluido_em FROM atendimentos WHERE id=?').get(id) as { excluido_em: string | null } | undefined
    if (!current || !row || row.excluido_em) throw new Error('Atendimento não encontrado.')
    const text = input.text?.trim() || ''
    const status = input.status || current.status
    const categoria = input.categoria?.trim() || current.categoria
    const statusChanged = status !== current.status
    const categoryChanged = categoria !== current.categoria
    if (!text && !statusChanged && !categoryChanged) throw new Error('Escreva uma atualização ou altere o status ou a categoria.')
    const stamp = now()
    const add = this.db.transaction(() => {
      let updateId = 0
      if (text) updateId = Number(this.db.prepare(`INSERT INTO atendimento_atualizacoes(atendimento_id,tipo,texto,criado_em) VALUES(?,'nota',?,?)`).run(id, text, stamp).lastInsertRowid)
      if (statusChanged) { const result = this.recordUpdate(id, 'status', '', current.status, status, stamp); if (!updateId) updateId = result }
      if (categoryChanged) { const result = this.recordUpdate(id, 'categoria', '', current.categoria, categoria, stamp); if (!updateId) updateId = result }
      this.db.prepare('UPDATE atendimentos SET status=?,categoria=?,concluido_em=?,atualizado_em=? WHERE id=?').run(status, categoria, status === 'Concluído' ? current.concluido_em || stamp : null, stamp, id)
      return updateId
    })
    return add()
  }
  removeUpdates(id: number, updateIds: number[]) {
    const ids = [...new Set(updateIds)].filter(Number.isInteger)
    if (!ids.length) return
    const placeholders = ids.map(() => '?').join(',')
    this.db.prepare(`DELETE FROM atendimento_atualizacoes WHERE atendimento_id=? AND tipo!='criacao' AND id IN (${placeholders})`).run(id, ...ids)
  }
  private recordUpdate(id: number, type: 'status' | 'categoria', text: string, previous: string, next: string, stamp = now()) {
    return Number(this.db.prepare('INSERT INTO atendimento_atualizacoes(atendimento_id,tipo,texto,valor_anterior,valor_novo,criado_em) VALUES(?,?,?,?,?,?)').run(id, type, text, previous, next, stamp).lastInsertRowid)
  }
  relatedAtendimentos(id: number): Atendimento[] {
    return this.db.prepare(`SELECT a.*,c.nome condominio_nome,(SELECT COUNT(*) FROM anexos x WHERE x.atendimento_id=a.id) anexo_count
      FROM atendimento_relacoes r
      JOIN atendimentos a ON a.id=CASE WHEN r.atendimento_a=? THEN r.atendimento_b ELSE r.atendimento_a END
      JOIN condominios c ON c.id=a.condominio_id
      WHERE (r.atendimento_a=? OR r.atendimento_b=?) AND a.excluido_em IS NULL
      ORDER BY a.data_atendimento DESC`).all(id, id, id) as Atendimento[]
  }
  linkAtendimento(id: number, relatedId: number) {
    if (id === relatedId) throw new Error('Escolha outro atendimento para vincular.')
    const [a, b] = id < relatedId ? [id, relatedId] : [relatedId, id]
    const count = (this.db.prepare('SELECT COUNT(*) total FROM atendimentos WHERE id IN (?,?) AND excluido_em IS NULL').get(a, b) as { total: number }).total
    if (count !== 2) throw new Error('Um dos atendimentos não foi encontrado.')
    this.db.prepare('INSERT OR IGNORE INTO atendimento_relacoes(atendimento_a,atendimento_b,criado_em) VALUES(?,?,?)').run(a, b, now())
  }
  unlinkAtendimento(id: number, relatedId: number) {
    const [a, b] = id < relatedId ? [id, relatedId] : [relatedId, id]
    this.db.prepare('DELETE FROM atendimento_relacoes WHERE atendimento_a=? AND atendimento_b=?').run(a, b)
  }
  removeAtendimento(id: number) { this.db.prepare('UPDATE atendimentos SET excluido_em=? WHERE id=?').run(now(), id) }
  undoRemove(id: number) { this.db.prepare('UPDATE atendimentos SET excluido_em=NULL WHERE id=?').run(id) }

  listReminders(includeCompleted = false): Lembrete[] {
    return this.db.prepare(`SELECT r.*,a.titulo atendimento_titulo,c.nome condominio_nome
      FROM lembretes r LEFT JOIN atendimentos a ON a.id=r.atendimento_id LEFT JOIN condominios c ON c.id=a.condominio_id
      ${includeCompleted ? '' : 'WHERE r.concluido=0'}
      ORDER BY r.concluido ASC,r.lembrete_em ASC,r.id ASC`).all() as Lembrete[]
  }
  createReminder(input: LembreteInput) {
    const title = input.titulo.trim(); if (!title) throw new Error('Informe o título do lembrete.')
    if (input.atendimentoId) {
      const attendance = this.db.prepare('SELECT 1 FROM atendimentos WHERE id=? AND excluido_em IS NULL').get(input.atendimentoId)
      if (!attendance) throw new Error('O atendimento informado não foi encontrado.')
    }
    return Number(this.db.prepare('INSERT INTO lembretes(titulo,observacoes,lembrete_em,atendimento_id,criado_em) VALUES(?,?,?,?,?)')
      .run(title, input.observacoes?.trim() || '', input.lembreteEm, input.atendimentoId || null, now()).lastInsertRowid)
  }
  setReminderDone(id: number, done: boolean) {
    this.db.prepare('UPDATE lembretes SET concluido=?,concluido_em=? WHERE id=?').run(done ? 1 : 0, done ? now() : null, id)
  }
  removeReminder(id: number) { this.db.prepare('DELETE FROM lembretes WHERE id=?').run(id) }
  dueReminders(): Lembrete[] {
    return this.db.prepare(`SELECT r.*,a.titulo atendimento_titulo,c.nome condominio_nome
      FROM lembretes r LEFT JOIN atendimentos a ON a.id=r.atendimento_id LEFT JOIN condominios c ON c.id=a.condominio_id
      WHERE r.concluido=0 AND r.notificado_em IS NULL AND r.lembrete_em<=? ORDER BY r.lembrete_em`).all(now()) as Lembrete[]
  }
  markReminderNotified(id: number) { this.db.prepare('UPDATE lembretes SET notificado_em=? WHERE id=?').run(now(), id) }

  settings(): AppSettings {
    const rows = this.db.prepare('SELECT chave,valor FROM settings').all() as Array<{ chave: string; valor: string }>
    const stored = Object.fromEntries(rows.map(x => { try { return [x.chave, JSON.parse(x.valor)] } catch { return [x.chave, x.valor] } }))
    const categories = (this.db.prepare('SELECT nome FROM categorias ORDER BY ordem').all() as Array<{ nome: string }>).map(x => x.nome)
    return { ...defaults, ...stored, categories }
  }

  setSettings(patch: Partial<AppSettings>) {
    const write = this.db.prepare('INSERT INTO settings(chave,valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor')
    const tx = this.db.transaction(() => {
      for (const [key, value] of Object.entries(patch)) if (key !== 'categories') write.run(key, JSON.stringify(value))
      if (patch.categories) {
        this.db.prepare('DELETE FROM categorias').run()
        const insert = this.db.prepare('INSERT INTO categorias(nome,ordem) VALUES(?,?)')
        patch.categories.forEach((name, index) => insert.run(name.trim(), index))
      }
    }); tx(); return this.settings()
  }

  dashboard(period: Periodo): DashboardData {
    const start = periodStart(period); const where = start ? 'a.excluido_em IS NULL AND a.data_atendimento>=?' : 'a.excluido_em IS NULL'; const args = start ? [start] : []
    const k = this.db.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN status!='Concluído' THEN 1 ELSE 0 END) abertos,SUM(CASE WHEN status='Concluído' THEN 1 ELSE 0 END) concluidos,COUNT(DISTINCT condominio_id) condominios FROM atendimentos a WHERE ${where}`).get(...args) as any
    const total = Number(k.total || 0), concluidos = Number(k.concluidos || 0)
    const ranking = this.db.prepare(`SELECT c.id,c.nome,COUNT(*) total FROM atendimentos a JOIN condominios c ON c.id=a.condominio_id WHERE ${where} GROUP BY c.id ORDER BY total DESC,c.nome LIMIT 10`).all(...args) as any
    const breakdown = (column: string) => this.db.prepare(`SELECT ${column} label,COUNT(*) total FROM atendimentos a WHERE ${where} GROUP BY ${column} ORDER BY total DESC LIMIT 6`).all(...args) as any
    const monthly = this.db.prepare(`SELECT strftime('%Y-%m',data_atendimento) mes,COUNT(*) total FROM atendimentos WHERE excluido_em IS NULL AND data_atendimento>=date('now','start of month','-11 months') GROUP BY mes ORDER BY mes`).all() as any
    return {
      kpis: { total, abertos: Number(k.abertos || 0), concluidos, condominios: Number(k.condominios || 0), taxa: total ? Math.round(concluidos / total * 100) : 0 },
      previous: { total: 0, abertos: 0, concluidos: 0, condominios: 0 }, ranking, monthly,
      categories: breakdown('categoria'), statuses: breakdown('status'),
      recent: this.listAtendimentos({ ...({ periodo: period } as any), sort: 'recentes', limit: 8 }),
      oldest: this.listAtendimentos({ status: 'Aberto', sort: 'antigos', limit: 8 })
    }
  }
}

function periodStart(period?: Periodo) {
  if (!period || period === 'tudo') return null
  const date = new Date()
  if (period === 'ano') date.setMonth(0, 1)
  else date.setDate(date.getDate() - Number(period.replace('d', '')))
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}
