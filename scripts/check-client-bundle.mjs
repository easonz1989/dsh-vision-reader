import { readFile } from 'node:fs/promises'

const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
const required = [
  'window.__ModuleLoader__.load({',
  'id: "dsh-vision-reader"',
  'factory: (require) => {',
  'return module.exports;',
]

for (const marker of required) {
  if (!bundle.includes(marker)) throw new Error(`client bundle is missing loader marker: ${marker}`)
}

if (/^import\s/m.test(bundle)) {
  throw new Error('client bundle contains a top-level ESM import instead of loader-table requires')
}

console.log('dsh-vision-reader client loader contract: pass')
