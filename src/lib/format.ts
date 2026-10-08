import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
export const dateTime = (value: string) => format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: ptBR })
export const ago = (value: string) => formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR })
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase()
export const mediaUrl = (relative: string) => `tud-media://media/${relative.split('/').map(encodeURIComponent).join('/')}`
export const ticketId = (id: number) => `TUD-${String(id).padStart(4, '0')}`
