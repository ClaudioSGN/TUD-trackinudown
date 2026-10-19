import 'server-only'
import { gunzipSync } from 'node:zlib'
import { get } from '@vercel/blob'
import { WEB_SNAPSHOT_VERSION, type WebSnapshot } from '../../shared/web-snapshot'

export const SNAPSHOT_PATH = 'tud/snapshot.json.gz'
export const MEDIA_PREFIX = 'tud/media/'

export async function loadSnapshot(): Promise<WebSnapshot | null> {
  try {
    const result = await get(SNAPSHOT_PATH, { access: 'private', useCache: false })
    if (!result || result.statusCode !== 200) return null
    const compressed = Buffer.from(await new Response(result.stream).arrayBuffer())
    const snapshot = JSON.parse(gunzipSync(compressed).toString('utf8')) as WebSnapshot
    return snapshot.schemaVersion === WEB_SNAPSHOT_VERSION ? snapshot : null
  } catch { return null }
}

