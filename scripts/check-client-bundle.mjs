import { readFile } from 'node:fs/promises'

const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
const hostBundle = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8')
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

if (bundle.includes('conversation.input.dock')) {
  throw new Error('vision previews regressed to the detached composer dock')
}

const getStateCalls = bundle.match(/["']get-state["']/g) ?? []
if (getStateCalls.length !== 1) {
  throw new Error(`vision client must perform only the settings bootstrap get-state call; found ${getStateCalls.length}`)
}

for (const marker of [
  'conversation.input.left',
  'vision-reader-media',
  'autoVisionFallback',
  'set-auto-vision',
  'data-chat-flow-kind',
  'data-vr-submitted-media',
  'vr-sent-media',
  'prepend',
]) {
  if (!bundle.includes(marker)) throw new Error(`client bundle is missing vision composer marker: ${marker}`)
}

for (const marker of ['autoVisionFallback', 'set-auto-vision']) {
  if (!hostBundle.includes(marker)) throw new Error(`host bundle is missing automatic vision marker: ${marker}`)
}

for (const marker of [
  'Never mention or disclose the visual model',
  'mediaCount',
]) {
  if (!hostBundle.includes(marker)) throw new Error(`host bundle is missing non-disclosure marker: ${marker}`)
}

for (const leakedMarker of [
  '`Model: ${result.model',
  'model: result.model',
  'model: getConfig().selectedModel',
]) {
  if (hostBundle.includes(leakedMarker)) throw new Error(`host bundle leaks vision implementation metadata: ${leakedMarker}`)
}

console.log('dsh-vision-reader client loader contract: pass')
