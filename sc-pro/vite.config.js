import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const scProRoot = path.dirname(fileURLToPath(import.meta.url))

/** Vite loadEnv only returns vars whose names match these prefixes (VITE_ first for assistant key). */
const ENV_PREFIXES = ['VITE_', 'ANTHROPIC_']

function normalizeAnthropicKey(raw) {
  let s = String(raw ?? '')
    .trim()
    .replace(/^\ufeff/, '')
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

/** Naive .env parser; file order matches Vite (later files override). */
function readAnthropicKeyFromEnvFiles(mode) {
  const names = ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]
  const seen = new Set()
  let key = ''
  for (const name of names) {
    const p = path.join(scProRoot, name)
    if (seen.has(p) || !fs.existsSync(p)) continue
    seen.add(p)
    let text
    try {
      text = fs.readFileSync(p, 'utf-8')
    } catch {
      continue
    }
    let fromViteName = ''
    let fromAnthropicName = ''
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const m = trimmed.match(/^(VITE_ANTHROPIC_API_KEY|ANTHROPIC_API_KEY)\s*=\s*(.*)$/)
      if (!m) continue
      const v = normalizeAnthropicKey(m[2])
      if (!v) continue
      if (m[1] === 'VITE_ANTHROPIC_API_KEY') fromViteName = v
      else fromAnthropicName = v
    }
    const fileKey = fromViteName || fromAnthropicName
    if (fileKey) key = fileKey
  }
  return key
}

function getAnthropicKey(mode) {
  const fromVite = loadEnv(mode, scProRoot, ENV_PREFIXES)
  const fromViteKey = normalizeAnthropicKey(
    fromVite.VITE_ANTHROPIC_API_KEY || fromVite.ANTHROPIC_API_KEY || '',
  )
  const fromDisk = readAnthropicKeyFromEnvFiles(mode)
  const fromProcess = normalizeAnthropicKey(
    process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '',
  )
  return fromViteKey || fromDisk || fromProcess
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const anthropicKeyAtBoot = getAnthropicKey(mode)

  if (mode === 'development' && !anthropicKeyAtBoot) {
    console.warn(
      `[sc-pro] No Anthropic API key found for the dev proxy. Add VITE_ANTHROPIC_API_KEY (or ANTHROPIC_API_KEY) to ${path.join(scProRoot, '.env')} or .env.local, then restart the dev server.`,
    )
  }

  const anthropicProxy = {
    '/anthropic': {
      target: 'https://api.anthropic.com',
      changeOrigin: true,
      secure: true,
      rewrite: (path) => path.replace(/^\/anthropic/, ''),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          const key = getAnthropicKey(mode)
          if (key) {
            proxyReq.setHeader('x-api-key', key)
          }
          proxyReq.setHeader('anthropic-version', '2023-06-01')
        })
      },
    },
  }

  return {
    root: scProRoot,
    envDir: scProRoot,
    plugins: [react()],
    server: { proxy: anthropicProxy },
    preview: { proxy: anthropicProxy },
  }
})
