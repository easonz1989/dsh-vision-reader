import type { Context } from '@deepseek-ai/cordis'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { SettingsScopeSpec, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'

const NS = 'vision-reader'
const CHANNEL = '/vision-reader'
const MAX_MEDIA_ITEMS = 6

interface ClientConfig {
  selectedModel?: string
  followLocale?: boolean
}

interface ModelDescriptor {
  id: string
  name: string
  vision: boolean
}

interface ProbeResult {
  ok: boolean
  error?: string
  status?: number
  count?: number
  models: ModelDescriptor[]
}

interface ServerState {
  baseUrl: string
  hasKey: boolean
  selectedModel: string
  followLocale: boolean
}

interface DraftAttachment {
  id: string
  file: File
  previewUrl: string
}

interface ConversationService {
  createDraftImages(files: readonly File[]): readonly DraftAttachment[]
  releaseDraftImages(attachments: readonly DraftAttachment[]): void
}

interface InputActions {
  addImages(ids: readonly string[]): boolean
}

let latestFollowLocale = true

const dict = {
  zh: {
    nav: '视觉模型', title: '视觉模型',
    hint: '连接 OpenAI 兼容的视觉 Provider。地址与密钥只保存在 DS Harness 服务端，不会发送到浏览器设置。',
    providerTitle: 'Provider 连接', providerCaption: 'OpenAI-compatible API',
    baseUrl: 'API Base URL', baseUrlPlaceholder: 'https://provider.example.com/v1',
    apiKey: 'API Key', apiKeyPlaceholder: '输入 VISION_KEY', apiKeyFilled: '已安全保存；留空保持原密钥',
    envHint: '服务端环境：VISION_BASE · VISION_KEY', save: '保存', saving: '保存中…',
    probe: '检测连接', probing: '检测中…', saved: '设置已安全保存',
    healthOk: '连接正常 · HTTP {status} · {count} 个模型', healthBad: 'Provider 检测失败', notProbed: '尚未检测连接',
    modelTitle: '视觉模型', modelHint: '选择处理已附加图片与影片的模型。', noModels: '检测 Provider 后会在这里显示模型。',
    selected: '当前：{model}', supported: '支持视觉', unsupported: '未声明视觉能力',
    followLabel: '设置标题跟随界面语言', followHint: '关闭后固定显示“视觉模型”。',
    upload: '添加媒体', uploadBusy: '正在添加…', uploadTip: '添加最多 6 张图片或影片',
    uploadFail: '无法添加媒体：{err}', conversationUnavailable: 'Harness 附件服务尚未就绪',
  },
  en: {
    nav: 'Visual Model', title: 'Visual Model',
    hint: 'Connect an OpenAI-compatible vision provider. The endpoint and key stay on the DS Harness server and are never projected into browser settings.',
    providerTitle: 'Provider connection', providerCaption: 'OpenAI-compatible API',
    baseUrl: 'API Base URL', baseUrlPlaceholder: 'https://provider.example.com/v1',
    apiKey: 'API Key', apiKeyPlaceholder: 'Enter VISION_KEY', apiKeyFilled: 'Securely saved; leave blank to keep it',
    envHint: 'Server environment: VISION_BASE · VISION_KEY', save: 'Save', saving: 'Saving…',
    probe: 'Test connection', probing: 'Testing…', saved: 'Settings saved securely',
    healthOk: 'Connected · HTTP {status} · {count} models', healthBad: 'Provider check failed', notProbed: 'Connection has not been tested',
    modelTitle: 'Vision model', modelHint: 'Choose the model that processes attached images and videos.', noModels: 'Models appear here after testing the provider.',
    selected: 'Current: {model}', supported: 'Vision capable', unsupported: 'Vision capability not declared',
    followLabel: 'Follow the interface language', followHint: 'When off, the section name stays “视觉模型”.',
    upload: 'Add media', uploadBusy: 'Adding…', uploadTip: 'Attach up to 6 images or videos',
    uploadFail: 'Could not add media: {err}', conversationUnavailable: 'Harness attachment service is not ready',
  },
}

const styles = `
.vr-section{display:flex;flex-direction:column;gap:12px;max-width:720px;color:var(--dsw-alias-label-primary)}
.vr-title{margin:0;font-size:16px;line-height:24px;font-weight:500}.vr-intro{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-tertiary)}
.vr-card{border-radius:12px;background:var(--dsw-alias-bg-module-platform);padding:14px 16px;display:flex;flex-direction:column;gap:14px}
.vr-card-head{display:flex;align-items:baseline;gap:8px}.vr-card-title{font-size:14px;line-height:22px;font-weight:500}.vr-caption,.vr-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.vr-field{display:flex;flex-direction:column;gap:6px}.vr-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.vr-input{box-sizing:border-box;width:100%;height:36px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;outline:none}
.vr-input:focus{border-color:var(--dsw-alias-border-l3);box-shadow:0 0 0 2px var(--dsw-alias-interactive-bg-hover)}
.vr-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-top:2px}.vr-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 14px;border-radius:18px;font:inherit;font-size:14px;line-height:22px;cursor:pointer}
.vr-primary{border:0;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.vr-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.vr-secondary{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary)}.vr-secondary:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}
.vr-button:disabled{opacity:.4;cursor:default}.vr-button:focus-visible,.vr-model:focus-visible,.vr-upload:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.vr-status{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l3);border-radius:10px;font-size:12px;line-height:18px}.vr-dot{flex:none;width:8px;height:8px;border-radius:50%;margin-top:5px;background:var(--dsw-alias-label-tertiary)}.vr-ok .vr-dot{background:var(--dsw-alias-state-success-primary)}.vr-bad .vr-dot{background:var(--dsw-alias-state-error-primary)}
.vr-error{color:var(--dsw-alias-state-error-primary);white-space:pre-wrap}.vr-saved{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:18px}
.vr-models{display:flex;flex-direction:column;gap:8px}.vr-model{box-sizing:border-box;width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}.vr-model:hover{background:var(--dsw-alias-interactive-bg-hover)}.vr-model-selected{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-interactive-bg-hover-solid)}
.vr-radio{box-sizing:border-box;flex:none;width:16px;height:16px;border:1px solid var(--dsw-alias-border-l3);border-radius:50%;padding:3px}.vr-model-selected .vr-radio:after{content:'';display:block;width:100%;height:100%;border-radius:50%;background:var(--dsw-alias-button-primary-fill)}.vr-model-copy{min-width:0;flex:1}.vr-model-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px}.vr-model-meta{display:block;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.vr-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 0}.vr-toggle-copy{display:flex;flex-direction:column;gap:2px}.vr-switch{position:relative;flex:none;width:36px;height:20px;border:0;border-radius:10px;background:var(--dsw-alias-bg-module-platform);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2);cursor:pointer}.vr-switch:after{content:'';position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-tertiary);transition:transform .16s ease}.vr-switch-on{background:var(--dsw-alias-button-primary-fill);box-shadow:none}.vr-switch-on:after{transform:translateX(16px);background:var(--dsw-alias-label-primary-foreground)}
.vr-upload-wrap{position:relative;display:inline-flex;align-items:center}.vr-upload{box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}.vr-upload:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.vr-upload svg{width:15px;height:15px}.vr-upload-error{position:absolute;left:0;top:34px;z-index:20;width:max-content;max-width:300px;padding:7px 9px;border-radius:8px;background:var(--dsw-alias-bg-module-platform);box-shadow:0 4px 18px rgba(0,0,0,.18);color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:16px}
`

function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key) => String(vars[key] ?? ''))
}

export const name = 'dsh-vision-reader'
export const inject = ['slots', 'locale', 'connection', 'settingsScope', 'conversation']

export async function apply(ctx: Context) {
  const slots = ctx.get('slots') as
    | { inject(key: string, cb: () => unknown): unknown; register(opts: unknown, comp: unknown): unknown }
    | undefined
  const locale = ctx.get('locale') as
    | { bind(ns: string): (key: string, vars?: Record<string, unknown>) => string; register(ns: string, value: unknown): unknown }
    | undefined
  const connection = ctx.get('connection') as
    | { rpc: { call(ch: string, ep: string, payload: unknown): Promise<{ ok: boolean; value?: unknown; error?: { message?: string } }> } }
    | undefined
  const settingsScope = ctx.get('settingsScope') as
    | { bind<T>(spec: SettingsScopeSpec<T>): SettingsScope<T> }
    | undefined
  const conversation = ctx.get('conversation') as ConversationService | undefined

  if (!slots || !locale || !connection || !settingsScope) return

  const t = locale.bind(NS as never)
  ctx.effect(() => {
    const dispose = locale.register(NS as never, dict as never)
    return () => { if (typeof dispose === 'function') dispose() }
  }, 'dsh-vision-reader: dictionaries')
  ctx.effect(() => {
    const element = document.createElement('style')
    element.dataset['dshVisionReader'] = 'true'
    element.textContent = styles
    document.head.append(element)
    return () => { element.remove() }
  }, 'dsh-vision-reader: styles')

  const scope = settingsScope.bind<ClientConfig>({ namespace: NS })
  const call = async (endpoint: string, payload: Record<string, unknown> = {}) => {
    const result = await connection.rpc.call(CHANNEL, endpoint, payload)
    if (result.ok) return result.value
    throw new Error(result.error?.message ?? 'RPC failed')
  }
  const readFollow = () => { latestFollowLocale = scope.getSnapshot().value?.followLocale ?? true }
  const unsubscribe = scope.subscribe(readFollow)
  readFollow()
  ctx.effect(() => () => { if (typeof unsubscribe === 'function') unsubscribe() }, 'dsh-vision-reader: settings subscription')

  const toggleFollow = async (value: boolean) => {
    latestFollowLocale = value
    await scope.set('followLocale', value)
  }

  slots.inject('settings.section', () => slots.register({
    name: 'settings.section', id: 'vision-reader', order: 25,
    label: () => (latestFollowLocale ? t('nav') : '视觉模型'), locale: NS as never,
    inject: () => ({ scope, call, t, toggleFollow }),
  }, VLProviderSection))

  slots.inject('conversation.input.left', () => slots.register({
    name: 'conversation.input.left', id: 'vision-reader-upload', order: 0, locale: NS as never,
    inject: (sessionId: string) => ({ call, t, conversation, sessionId }),
  }, UploadEntry))
}

interface SectionProps {
  scope: SettingsScope<ClientConfig>
  call: (endpoint: string, payload?: Record<string, unknown>) => Promise<unknown>
  t: (key: string, vars?: Record<string, unknown>) => string
  toggleFollow: (value: boolean) => Promise<void>
}

function VLProviderSection({ scope, call, t, toggleFollow }: SectionProps) {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')
  const [followLocale, setFollowLocale] = useState(true)
  const [models, setModels] = useState<ModelDescriptor[]>([])
  const [health, setHealth] = useState<ProbeResult | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState<'idle' | 'saving' | 'probing'>('idle')

  useEffect(() => {
    let live = true
    const initialFollow = scope.getSnapshot().value?.followLocale ?? true
    setFollowLocale(initialFollow)
    latestFollowLocale = initialFollow
    void call('get-state').then((value) => {
      if (!live) return
      const state = value as ServerState
      setBaseUrl(state.baseUrl ?? '')
      setHasKey(state.hasKey === true)
      setSelectedModel(state.selectedModel ?? '')
    }).catch((cause: unknown) => { if (live) setError(messageOf(cause)) })
    return () => { live = false }
  }, [call, scope])

  const probe = async (): Promise<void> => {
    setBusy('probing'); setError(''); setSaved(false)
    try {
      const result = await call('probe') as ProbeResult
      setHealth(result); setModels(result.models ?? [])
      if (!result.ok) setError(result.error ?? t('healthBad'))
    } catch (cause) {
      setHealth({ ok: false, models: [] }); setError(messageOf(cause))
    } finally { setBusy('idle') }
  }

  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault(); setBusy('saving'); setError(''); setSaved(false)
    try {
      const result = await call('save-config', { baseUrl, apiKey }) as { baseUrl: string; hasKey: boolean }
      setBaseUrl(result.baseUrl); setHasKey(result.hasKey); setApiKey(''); setSaved(true)
      const checked = await call('probe') as ProbeResult
      setHealth(checked); setModels(checked.models ?? [])
      if (!checked.ok) setError(checked.error ?? t('healthBad'))
    } catch (cause) { setError(messageOf(cause)) } finally { setBusy('idle') }
  }

  const pickModel = async (model: string): Promise<void> => {
    setError('')
    try { await call('set-model', { model }); setSelectedModel(model) } catch (cause) { setError(messageOf(cause)) }
  }

  const changeFollow = async (): Promise<void> => {
    const next = !followLocale
    setFollowLocale(next)
    try { await toggleFollow(next) } catch (cause) { setFollowLocale(!next); setError(messageOf(cause)) }
  }

  return <section className="vr-section">
    <h2 className="vr-title">{t('title')}</h2>
    <p className="vr-intro">{t('hint')}</p>

    <form className="vr-card" onSubmit={save}>
      <div className="vr-card-head"><span className="vr-card-title">{t('providerTitle')}</span><span className="vr-caption">{t('providerCaption')}</span></div>
      <label className="vr-field"><span className="vr-label">{t('baseUrl')}</span><input className="vr-input" value={baseUrl} placeholder={t('baseUrlPlaceholder')} onChange={event => setBaseUrl(event.target.value)} autoComplete="url" /></label>
      <label className="vr-field"><span className="vr-label">{t('apiKey')}</span><input className="vr-input" type="password" value={apiKey} placeholder={hasKey ? t('apiKeyFilled') : t('apiKeyPlaceholder')} onChange={event => setApiKey(event.target.value)} autoComplete="off" /></label>
      <span className="vr-hint">{t('envHint')}</span>
      {saved && <span className="vr-saved" role="status">{t('saved')}</span>}
      <div className="vr-actions">
        <button className="vr-button vr-secondary" type="button" disabled={busy !== 'idle' || !baseUrl.trim()} onClick={() => { void probe() }}>{busy === 'probing' ? t('probing') : t('probe')}</button>
        <button className="vr-button vr-primary" type="submit" disabled={busy !== 'idle' || !baseUrl.trim()}>{busy === 'saving' ? t('saving') : t('save')}</button>
      </div>
    </form>

    <div className={`vr-status ${health?.ok ? 'vr-ok' : health ? 'vr-bad' : ''}`} role="status"><span className="vr-dot" /><span>{health?.ok ? fmt(t('healthOk'), { status: health.status ?? '', count: health.count ?? models.length }) : health ? t('healthBad') : t('notProbed')}</span></div>
    {error && <div className="vr-error" role="alert">{error}</div>}

    <div className="vr-card">
      <div><div className="vr-card-title">{t('modelTitle')}</div><div className="vr-hint">{t('modelHint')}</div></div>
      <div className="vr-models">
        {models.length === 0 && <div className="vr-hint">{t('noModels')}</div>}
        {models.map(model => <button key={model.id} type="button" className={`vr-model ${selectedModel === model.id ? 'vr-model-selected' : ''}`} onClick={() => { void pickModel(model.id) }}>
          <span className="vr-radio" /><span className="vr-model-copy"><span className="vr-model-name" title={model.id}>{model.name}</span><span className="vr-model-meta">{model.vision ? t('supported') : t('unsupported')}</span></span>
        </button>)}
      </div>
      {selectedModel && <div className="vr-hint">{fmt(t('selected'), { model: selectedModel })}</div>}
    </div>

    <div className="vr-toggle-row"><span className="vr-toggle-copy"><span className="vr-card-title">{t('followLabel')}</span><span className="vr-hint">{t('followHint')}</span></span><button type="button" role="switch" aria-checked={followLocale} className={`vr-switch ${followLocale ? 'vr-switch-on' : ''}`} onClick={() => { void changeFollow() }} /></div>
  </section>
}

interface UploadProps {
  call: (endpoint: string, payload?: Record<string, unknown>) => Promise<unknown>
  t: (key: string, vars?: Record<string, unknown>) => string
  conversation?: ConversationService
  sessionId: string
  inputActions?: InputActions
}

function UploadEntry({ call, t, conversation, sessionId, inputActions }: UploadProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const onPick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = [...(event.target.files ?? [])].slice(0, MAX_MEDIA_ITEMS)
    event.target.value = ''
    if (files.length === 0) return
    setBusy(true); setError('')
    let drafts: readonly DraftAttachment[] = []
    try {
      if (!conversation || !inputActions) throw new Error(t('conversationUnavailable'))
      const items = await Promise.all(files.map(async file => ({ name: file.name, mime: file.type, dataUrl: await readFileAsDataUrl(file) })))
      const previews = await Promise.all(files.map(file => previewFile(file)))
      drafts = conversation.createDraftImages(previews)
      await call('receive-media', { sessionId, items })
      if (!inputActions.addImages(drafts.map(item => item.id))) {
        conversation.releaseDraftImages(drafts)
        drafts = []
        await call('clear-media', { sessionId })
        throw new Error(t('conversationUnavailable'))
      }
    } catch (cause) {
      if (drafts.length > 0) conversation?.releaseDraftImages(drafts)
      setError(fmt(t('uploadFail'), { err: messageOf(cause) }))
    } finally { setBusy(false) }
  }

  return <div className="vr-upload-wrap">
    <button type="button" className="vr-upload" title={t('uploadTip')} disabled={busy} onClick={() => inputRef.current?.click()}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
      {busy ? t('uploadBusy') : t('upload')}
    </button>
    <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={event => { void onPick(event) }} />
    {error && <span className="vr-upload-error" role="alert">{error}</span>}
  </div>
}

function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : String(value)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'))
    reader.readAsDataURL(file)
  })
}

async function previewFile(file: File): Promise<File> {
  if (/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return file
  if (file.type.startsWith('image/')) return renderImagePreview(file)
  if (file.type.startsWith('video/')) return renderVideoPreview(file)
  throw new Error(`Unsupported media type: ${file.type || 'unknown'}`)
}

async function renderImagePreview(file: File): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return canvasFile(drawToCanvas(image, image.naturalWidth, image.naturalHeight), `${file.name || 'image'}-preview.jpg`)
  } finally { URL.revokeObjectURL(url) }
}

async function renderVideoPreview(file: File): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.muted = true; video.playsInline = true; video.preload = 'metadata'; video.src = url
    await eventOnce(video, 'loadeddata', 10_000)
    if (Number.isFinite(video.duration) && video.duration > 0.1) {
      video.currentTime = Math.min(0.25, video.duration / 10)
      await eventOnce(video, 'seeked', 10_000)
    }
    const canvas = drawToCanvas(video, video.videoWidth || 640, video.videoHeight || 360)
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = 'rgba(0,0,0,.58)'; context.beginPath(); context.arc(34, 34, 20, 0, Math.PI * 2); context.fill()
      context.fillStyle = '#fff'; context.beginPath(); context.moveTo(29, 24); context.lineTo(29, 44); context.lineTo(44, 34); context.closePath(); context.fill()
    }
    return canvasFile(canvas, `${file.name || 'video'}-preview.jpg`)
  } finally { URL.revokeObjectURL(url) }
}

function drawToCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const max = 1280
  const scale = Math.min(1, max / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

function canvasFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) reject(new Error('Could not create media preview'))
    else resolve(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }))
  }, 'image/jpeg', 0.86))
}

function eventOnce(target: HTMLMediaElement, name: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error(`Video preview timed out at ${name}`)), timeoutMs)
    const onSuccess = () => finish()
    const onError = () => finish(new Error('The browser could not decode this video for preview'))
    const finish = (error?: Error) => {
      window.clearTimeout(timer); target.removeEventListener(name, onSuccess); target.removeEventListener('error', onError)
      if (error) reject(error); else resolve()
    }
    target.addEventListener(name, onSuccess, { once: true }); target.addEventListener('error', onError, { once: true })
  })
}
