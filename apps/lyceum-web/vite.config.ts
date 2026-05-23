import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function normalizeBase(rawBase: string): string {
  if (!rawBase) {
    return '/'
  }

  let normalized = rawBase.trim()
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }
  if (!normalized.endsWith('/')) {
    normalized = `${normalized}/`
  }
  return normalized
}

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const inferredPagesBase = repositoryName ? `/${repositoryName}/` : '/'
const base = normalizeBase(
  process.env.VITE_BASE_PATH ?? (process.env.GITHUB_ACTIONS === 'true' ? inferredPagesBase : '/')
)

// https://vite.dev/config/
export default defineConfig({
  base,
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true
  },
  plugins: [react()],
});
