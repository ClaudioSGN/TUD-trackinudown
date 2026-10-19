import path from 'node:path'
import type { NextConfig } from 'next'

const config: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd(), '..'),
  poweredByHeader: false,
  experimental: { externalDir: true }
}

export default config

