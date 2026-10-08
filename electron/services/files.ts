import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { clipboard, ClipboardItem, shell } from 'electron'
import type { Anexo } from '../../src/types/domain'
import type { TudDatabase } from '../db/database'

const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'])

export class FileService {
  readonly attachments: string
  readonly thumbnails: string

  constructor(private root: string, private database: TudDatabase) {
    this.attachments = path.join(root, 'anexos')
    this.thumbnails = path.join(root, 'miniaturas')
    fs.mkdirSync(this.attachments, { recursive: true }); fs.mkdirSync(this.thumbnails, { recursive: true })
  }

  addPaths(atendimentoId: number, paths: string[]) {
    const added: Anexo[] = []
    try { for (const file of paths) added.push(this.addPath(atendimentoId, file)); return added }
    catch (error) { added.forEach(attachment => this.remove(attachment.id)); throw error }
  }

  addPath(atendimentoId: number, source: string): Anexo {
    const stat = fs.statSync(source); if (stat.size > 20 * 1024 * 1024) throw new Error('Cada imagem pode ter no máximo 20 MB.')
    const ext = path.extname(source).toLowerCase(); if (!allowed.has(ext)) throw new Error('Formato de imagem não suportado.')
    const folder = path.join(String(new Date().getFullYear()), String(new Date().getMonth() + 1).padStart(2, '0'))
    const name = `${crypto.randomUUID()}${ext === '.jpeg' ? '.jpg' : ext}`
    const destination = path.join(this.attachments, folder, name); fs.mkdirSync(path.dirname(destination), { recursive: true })
    const temp = `${destination}.tmp`; fs.copyFileSync(source, temp); fs.renameSync(temp, destination)
    return this.insert(atendimentoId, destination, path.basename(source), stat.size)
  }

  addBuffer(atendimentoId: number, bytes: Uint8Array, mime: string, originalName: string): Anexo {
    if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('Cada imagem pode ter no máximo 20 MB.')
    const extByMime: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/bmp': '.bmp', 'image/gif': '.gif' }
    const ext = extByMime[mime] || path.extname(originalName).toLowerCase(); if (!allowed.has(ext)) throw new Error('Formato de imagem não suportado.')
    const folder = path.join(String(new Date().getFullYear()), String(new Date().getMonth() + 1).padStart(2, '0'))
    const destination = path.join(this.attachments, folder, `${crypto.randomUUID()}${ext}`); fs.mkdirSync(path.dirname(destination), { recursive: true })
    const temp = `${destination}.tmp`; fs.writeFileSync(temp, bytes); fs.renameSync(temp, destination)
    return this.insert(atendimentoId, destination, originalName || `imagem${ext}`, bytes.byteLength)
  }

  private insert(atendimentoId: number, absolute: string, original: string, bytes: number): Anexo {
    const relative = path.relative(this.root, absolute).split(path.sep).join('/')
    const created = new Date().toISOString()
    const id = Number(this.database.db.prepare(`INSERT INTO anexos(atendimento_id,caminho,miniatura,nome_original,bytes,criado_em) VALUES(?,?,?,?,?,?)`).run(atendimentoId, relative, relative, original, bytes, created).lastInsertRowid)
    return { id, atendimento_id: atendimentoId, caminho: relative, miniatura: relative, nome_original: original, bytes, criado_em: created }
  }

  resolve(relative: string) {
    const target = path.resolve(this.root, relative.replace(/^\/+/, ''))
    const root = path.resolve(this.root) + path.sep
    if (!target.startsWith(root)) throw new Error('Caminho inválido.')
    return target
  }

  remove(id: number) {
    const item = this.database.db.prepare('SELECT caminho,miniatura FROM anexos WHERE id=?').get(id) as { caminho: string; miniatura: string } | undefined
    if (!item) return
    this.database.db.prepare('DELETE FROM anexos WHERE id=?').run(id)
    for (const relative of new Set([item.caminho, item.miniatura])) { const file = this.resolve(relative); if (fs.existsSync(file)) fs.rmSync(file) }
  }
  purgeAttendance(id: number) {
    const row = this.database.db.prepare('SELECT excluido_em FROM atendimentos WHERE id=?').get(id) as { excluido_em: string | null } | undefined
    if (!row?.excluido_em) return
    const attachments = this.database.db.prepare('SELECT id FROM anexos WHERE atendimento_id=?').all(id) as Array<{ id: number }>
    attachments.forEach(item => this.remove(item.id))
    this.database.db.prepare('DELETE FROM atendimentos WHERE id=?').run(id)
  }
  purgePending() {
    const rows = this.database.db.prepare('SELECT id FROM atendimentos WHERE excluido_em IS NOT NULL').all() as Array<{ id: number }>
    rows.forEach(item => this.purgeAttendance(item.id))
  }
  reveal(relative: string) { shell.showItemInFolder(this.resolve(relative)) }
  async copy(relative: string) {
    const absolute = this.resolve(relative); const ext = path.extname(absolute).toLowerCase()
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : ext === '.bmp' ? 'image/bmp' : 'image/png'
    const bytes = fs.readFileSync(absolute)
    await clipboard.write([new ClipboardItem({ [mime]: new Blob([bytes], { type: mime }) })])
  }
}
