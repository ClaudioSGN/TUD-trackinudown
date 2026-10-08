import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()], build: { lib: { entry: resolve('electron/main.ts'), formats: ['es'], fileName: () => 'main.js' } } },
  preload: { plugins: [externalizeDepsPlugin()], build: { lib: { entry: resolve('electron/preload.ts'), formats: ['cjs'], fileName: () => 'preload.js' } } },
  renderer: { root: '.', plugins: [react(), tailwindcss()], build: { rollupOptions: { input: resolve('index.html') } } }
})
