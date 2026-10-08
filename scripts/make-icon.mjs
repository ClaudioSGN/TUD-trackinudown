import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

await mkdir('resources/icon-png', { recursive: true })
const svg = await readFile('resources/icon.svg')
const sizes = [16, 24, 32, 48, 64, 128, 256]
const files = []
for (const size of sizes) {
  const file = `resources/icon-png/${size}.png`
  await sharp(svg).resize(size, size).png().toFile(file)
  files.push(file)
}
await writeFile('resources/icon.ico', await pngToIco(files))
