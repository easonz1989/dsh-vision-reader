import type { Context } from '@deepseek-ai/cordis'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { createPortal } from 'react-dom'

const NS = 'vision-reader'
const CHANNEL = '/vision-reader'
const MAX_MEDIA_ITEMS = 6

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
  autoVisionFallback: boolean
}

interface ClientMedia {
  id: string
  name: string
  mime: string
  dataUrl: string
  previewUrl: string
}

interface InputState {
  draft: string
  phase: 'plain' | 'adjudicating' | 'claimed' | 'submitting'
}

interface InputActions {
  setDraft(text: string): void
}

type UseInput = <T>(selector: (state: InputState) => T) => T
type UseSession = <T>(selector: (snapshot: SessionSnapshot) => T) => T

interface SessionSnapshot {
  chat: {
    nodes: ReadonlyMap<string, {
      key: string
      kind: string
      data: { seq?: number }
    }>
  }
}

interface TranscriptMediaSummary {
  userMessageId: string
  userSeq: number
  items: { index: number; name: string; mime: string }[]
}

interface LoadedTranscriptMedia {
  userSeq: number
  items: { index: number; name: string; mime: string; dataUrl: string }[]
}

const clientMedia = new Map<string, readonly ClientMedia[]>()
const mediaListeners = new Map<string, Set<() => void>>()
const EMPTY_CLIENT_MEDIA: readonly ClientMedia[] = []
const transcriptMediaCache = new Map<string, { index: number; name: string; mime: string; dataUrl: string }>()
const transcriptRecordsCache = new Map<string, LoadedTranscriptMedia[]>()
const transcriptRecordFlights = new Map<string, Promise<LoadedTranscriptMedia[]>>()
const transcriptVersions = new Map<string, number>()
const transcriptListeners = new Map<string, Set<() => void>>()

function getClientMedia(sessionId: string): readonly ClientMedia[] {
  return clientMedia.get(sessionId) ?? EMPTY_CLIENT_MEDIA
}

function setClientMedia(sessionId: string, items: readonly ClientMedia[]): void {
  const previous = clientMedia.get(sessionId) ?? []
  const keep = new Set(items.map(item => item.id))
  for (const item of previous) {
    if (!keep.has(item.id)) URL.revokeObjectURL(item.previewUrl)
  }
  if (items.length === 0) clientMedia.delete(sessionId)
  else clientMedia.set(sessionId, items)
  for (const listener of mediaListeners.get(sessionId) ?? []) listener()
}

function subscribeClientMedia(sessionId: string, listener: () => void): () => void {
  const listeners = mediaListeners.get(sessionId) ?? new Set<() => void>()
  listeners.add(listener)
  mediaListeners.set(sessionId, listeners)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) mediaListeners.delete(sessionId)
  }
}

function useClientMedia(sessionId: string): readonly ClientMedia[] {
  return useSyncExternalStore(
    listener => subscribeClientMedia(sessionId, listener),
    () => getClientMedia(sessionId),
    () => getClientMedia(sessionId),
  )
}

function invalidateTranscriptRecords(sessionId: string): void {
  transcriptRecordsCache.delete(sessionId)
  transcriptRecordFlights.delete(sessionId)
  transcriptVersions.set(sessionId, (transcriptVersions.get(sessionId) ?? 0) + 1)
  for (const listener of transcriptListeners.get(sessionId) ?? []) listener()
}

function subscribeTranscriptVersion(sessionId: string, listener: () => void): () => void {
  const listeners = transcriptListeners.get(sessionId) ?? new Set<() => void>()
  listeners.add(listener)
  transcriptListeners.set(sessionId, listeners)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) transcriptListeners.delete(sessionId)
  }
}

function useTranscriptVersion(sessionId: string): number {
  return useSyncExternalStore(
    listener => subscribeTranscriptVersion(sessionId, listener),
    () => transcriptVersions.get(sessionId) ?? 0,
    () => transcriptVersions.get(sessionId) ?? 0,
  )
}

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
    autoLabel: '主模型不支持视觉时自动使用视觉插件', autoHint: '启用后，附加媒体会先由所选视觉模型读取，再把安全的文字分析交给主模型。',
    upload: '添加媒体', uploadBusy: '正在添加…', uploadTip: '添加最多 6 张图片或影片',
    defaultRequest: '请分析我附加的媒体。', attached: '视觉模型附件', remove: '移除', video: '影片',
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
    autoLabel: "Auto use vision plugin when model doesn't have vision", autoHint: 'Attached media is read by the selected vision model, then safe text analysis is passed to the primary model.',
    upload: 'Add media', uploadBusy: 'Adding…', uploadTip: 'Attach up to 6 images or videos',
    defaultRequest: 'Please analyze the attached media.', attached: 'Visual Model attachments', remove: 'Remove', video: 'Video',
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
.vr-toggle-row{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:16px;padding:10px 0}.vr-card.vr-toggle-row{padding:12px 16px}.vr-toggle-copy{display:flex;flex:1;flex-direction:column;gap:2px}.vr-switch{position:relative;flex:none;width:36px;height:20px;border:0;border-radius:10px;background:var(--dsw-alias-bg-module-platform);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2);cursor:pointer}.vr-switch:after{content:'';position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-tertiary);transition:transform .16s ease}.vr-switch-on{background:var(--dsw-alias-button-primary-fill);box-shadow:none}.vr-switch-on:after{transform:translateX(16px);background:var(--dsw-alias-label-primary-foreground)}
.vr-upload-wrap{position:relative;display:inline-flex;align-items:center}.vr-upload{box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}.vr-upload:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.vr-upload svg{width:15px;height:15px}.vr-upload-error{position:absolute;left:0;top:34px;z-index:20;width:max-content;max-width:300px;padding:7px 9px;border-radius:8px;background:var(--dsw-alias-bg-module-platform);box-shadow:0 4px 18px rgba(0,0,0,.18);color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:16px}
[data-composer-card]:has(.vr-media-dock){padding-top:90px}.vr-media-dock{box-sizing:border-box;position:absolute;z-index:2;top:10px;left:12px;right:12px;min-width:0;height:68px}.vr-media-list{display:flex;height:68px;gap:8px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin}.vr-media-item{position:relative;flex:none;width:76px;height:68px;overflow:hidden;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-1)}.vr-media-item img,.vr-media-item video{display:block;width:100%;height:100%;object-fit:cover}.vr-media-name{position:absolute;left:0;right:0;bottom:0;padding:14px 5px 4px;background:linear-gradient(transparent,rgba(0,0,0,.8));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:9px;line-height:12px}.vr-media-kind{position:absolute;left:5px;top:5px;padding:2px 5px;border-radius:8px;background:rgba(0,0,0,.66);color:#fff;font-size:9px;line-height:12px}.vr-media-remove{position:absolute;right:4px;top:4px;width:20px;height:20px;padding:0;border:0;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;font-size:15px;line-height:20px;cursor:pointer}.vr-media-remove:hover{background:rgba(0,0,0,.9)}.vr-media-remove:disabled{opacity:.45;cursor:default}.vr-media-dock>.vr-error{position:absolute;left:0;top:72px;max-width:100%;padding:5px 8px;border-radius:7px;background:var(--dsw-alias-bg-module-platform);box-shadow:0 4px 18px rgba(0,0,0,.18);font-size:11px;line-height:16px}
.vr-transcript-media{order:-1;display:grid;grid-template-columns:repeat(2,minmax(0,156px));gap:8px;max-width:min(525px,82vw)}.vr-transcript-media[data-count="1"]{grid-template-columns:minmax(0,min(360px,70vw))}.vr-transcript-image{display:block;width:100%;max-height:320px;object-fit:cover;border:1px solid var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-layer-1)}
`

function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key) => String(vars[key] ?? ''))
}

export const name = 'dsh-vision-reader'
export const inject = ['slots', 'locale', 'connection']

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
  if (!slots || !locale || !connection) return

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
  ctx.effect(() => () => {
    for (const sessionId of [...clientMedia.keys()]) setClientMedia(sessionId, [])
    mediaListeners.clear()
    transcriptMediaCache.clear()
    transcriptRecordsCache.clear()
    transcriptRecordFlights.clear()
    transcriptVersions.clear()
    transcriptListeners.clear()
  }, 'dsh-vision-reader: media preview teardown')

  const call = async (endpoint: string, payload: Record<string, unknown> = {}) => {
    const result = await connection.rpc.call(CHANNEL, endpoint, payload)
    if (result.ok) return result.value
    throw new Error(result.error?.message ?? 'RPC failed')
  }
  slots.inject('settings.section', () => slots.register({
    name: 'settings.section', id: 'vision-reader', order: 25,
    label: () => t('nav'), locale: NS as never,
    inject: () => ({ call, t }),
  }, VLProviderSection))

  slots.inject('conversation.input.left', () => slots.register({
    name: 'conversation.input.left', id: 'vision-reader-upload', order: 0, locale: NS as never,
    inject: (sessionId: string) => ({ call, t, sessionId }),
  }, UploadEntry))
  // Render previews through the supported in-card seat. The rail anchors to
  // the composer card and stays with the textbox instead of becoming a
  // detached full-width dock above it.
  slots.inject('conversation.input.left', () => slots.register({
    name: 'conversation.input.left', id: 'vision-reader-media', order: -1, locale: NS as never,
    inject: (sessionId: string) => ({ call, t, sessionId }),
  }, MediaDock))
  slots.inject('conversation.input.left', () => slots.register({
    name: 'conversation.input.left', id: 'vision-reader-transcript', order: -2, locale: NS as never,
    inject: (sessionId: string) => ({ call, sessionId }),
  }, TranscriptMediaController))
}

interface SectionProps {
  call: (endpoint: string, payload?: Record<string, unknown>) => Promise<unknown>
  t: (key: string, vars?: Record<string, unknown>) => string
}

function VLProviderSection({ call, t }: SectionProps) {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')
  const [autoVisionFallback, setAutoVisionFallback] = useState(true)
  const [models, setModels] = useState<ModelDescriptor[]>([])
  const [health, setHealth] = useState<ProbeResult | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState<'idle' | 'saving' | 'probing'>('idle')

  useEffect(() => {
    let live = true
    void call('get-state').then((value) => {
      if (!live) return
      const state = value as ServerState
      setBaseUrl(state.baseUrl ?? '')
      setHasKey(state.hasKey === true)
      setSelectedModel(state.selectedModel ?? '')
      setAutoVisionFallback(state.autoVisionFallback !== false)
    }).catch((cause: unknown) => { if (live) setError(messageOf(cause)) })
    return () => { live = false }
  }, [call])

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

  const changeAutoVision = async (): Promise<void> => {
    const next = !autoVisionFallback
    setAutoVisionFallback(next); setError('')
    try { await call('set-auto-vision', { enabled: next }) } catch (cause) { setAutoVisionFallback(!next); setError(messageOf(cause)) }
  }

  return <section className="vr-section">
    <h2 className="vr-title">{t('title')}</h2>
    <div className="vr-card vr-toggle-row"><span className="vr-toggle-copy"><span className="vr-card-title">{t('autoLabel')}</span><span className="vr-hint">{t('autoHint')}</span></span><button type="button" role="switch" aria-checked={autoVisionFallback} className={`vr-switch ${autoVisionFallback ? 'vr-switch-on' : ''}`} onClick={() => { void changeAutoVision() }} /></div>
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
  </section>
}

interface UploadProps {
  call: (endpoint: string, payload?: Record<string, unknown>) => Promise<unknown>
  t: (key: string, vars?: Record<string, unknown>) => string
  sessionId: string
  inputActions: InputActions
  useInput: UseInput
}

function UploadEntry({ call, t, sessionId, inputActions, useInput }: UploadProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const draft = useInput(state => state.draft)

  const onPick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const existing = getClientMedia(sessionId)
    const files = [...(event.target.files ?? [])].slice(0, Math.max(0, MAX_MEDIA_ITEMS - existing.length))
    event.target.value = ''
    if (files.length === 0) {
      if (existing.length >= MAX_MEDIA_ITEMS) setError(fmt(t('uploadFail'), { err: t('uploadTip') }))
      return
    }
    setBusy(true); setError('')
    let added: readonly ClientMedia[] = []
    try {
      added = await Promise.all(files.map(async file => ({
        id: crypto.randomUUID(),
        name: file.name || 'media',
        mime: file.type,
        dataUrl: await readFileAsDataUrl(file),
        previewUrl: URL.createObjectURL(file),
      })))
      const combined = [...existing, ...added]
      await call('receive-media', {
        sessionId,
        items: combined.map(item => ({ name: item.name, mime: item.mime, dataUrl: item.dataUrl })),
      })
      setClientMedia(sessionId, combined)
      if (!draft.trim()) inputActions.setDraft(t('defaultRequest'))
    } catch (cause) {
      for (const item of added) URL.revokeObjectURL(item.previewUrl)
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

interface TranscriptMediaControllerProps {
  call: (endpoint: string, payload?: Record<string, unknown>) => Promise<unknown>
  sessionId: string
  useSession: UseSession
}

/**
 * Project plugin-owned durable attachments into Harness's existing user stack.
 * The controller mounts through a public in-card slot and portals only its own
 * media nodes; the core user-message renderer and its actions remain untouched.
 */
function TranscriptMediaController({ call, sessionId, useSession }: TranscriptMediaControllerProps) {
  const nodeSignature = useSession(snapshot => [...snapshot.chat.nodes.values()]
    .map(node => `${node.kind}\t${String(node.data.seq ?? '')}\t${node.key}`)
    .join('\n'))
  const transcriptVersion = useTranscriptVersion(sessionId)
  const [records, setRecords] = useState<LoadedTranscriptMedia[]>([])
  const [targets, setTargets] = useState<ReadonlyMap<number, Element>>(new Map())

  useEffect(() => {
    let live = true
    const cachedRecords = transcriptRecordsCache.get(sessionId)
    if (cachedRecords) {
      setRecords(cachedRecords)
      return () => { live = false }
    }
    let flight = transcriptRecordFlights.get(sessionId)
    if (!flight) {
      flight = (async () => {
        const value = await call('get-state', { sessionId })
        const state = value as { transcriptMedia?: TranscriptMediaSummary[] }
        const summaries = Array.isArray(state.transcriptMedia) ? state.transcriptMedia : []
        const loaded = await Promise.all(summaries.map(async summary => ({
          userSeq: summary.userSeq,
          items: await Promise.all(summary.items.map(async item => {
            const cacheKey = `${sessionId}:${summary.userSeq}:${item.index}`
            const cached = transcriptMediaCache.get(cacheKey)
            if (cached) return cached
            const media = await call('read-transcript-media', {
              sessionId,
              userSeq: summary.userSeq,
              index: item.index,
            }) as { name: string; mime: string; dataUrl: string }
            const loadedItem = { index: item.index, name: media.name, mime: media.mime, dataUrl: media.dataUrl }
            transcriptMediaCache.set(cacheKey, loadedItem)
            return loadedItem
          })),
        })))
        const visible = loaded.filter(record => record.items.length > 0)
        if ((transcriptVersions.get(sessionId) ?? 0) === transcriptVersion) {
          transcriptRecordsCache.set(sessionId, visible)
        }
        return visible
      })()
      transcriptRecordFlights.set(sessionId, flight)
      void flight.finally(() => {
        if (transcriptRecordFlights.get(sessionId) === flight) transcriptRecordFlights.delete(sessionId)
      }).catch(() => {})
    }
    void flight.then(loaded => {
      if (live) setRecords(loaded)
    }).catch(() => {
      // Transcript rendering is additive. A transient media read must never
      // break the ordinary Harness message renderer.
    })
    return () => { live = false }
  }, [call, sessionId, transcriptVersion])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const userKeys = new Map<number, string>()
      for (const row of nodeSignature.split('\n')) {
        const [kind, rawSeq, ...keyParts] = row.split('\t')
        const seq = Number(rawSeq)
        if (kind === 'user' && Number.isSafeInteger(seq)) userKeys.set(seq, keyParts.join('\t'))
      }
      const next = new Map<number, Element>()
      const flowItems = [...document.querySelectorAll('[data-chat-flow-key]')]
      for (const record of records) {
        const key = userKeys.get(record.userSeq)
        if (!key) continue
        const flow = flowItems.find(element => element.getAttribute('data-chat-flow-key') === key)
        const stack = flow?.querySelector('[data-time-hover-root] > div')
        if (stack) next.set(record.userSeq, stack)
      }
      setTargets(next)
    })
    return () => { window.cancelAnimationFrame(frame) }
  }, [nodeSignature, records])

  return <>{records.map(record => {
    const target = targets.get(record.userSeq)
    if (!target) return null
    return createPortal(
      <div className="vr-transcript-media" data-count={record.items.length} data-vision-reader-transcript="">
        {record.items.map(item => <img key={item.index} className="vr-transcript-image" src={item.dataUrl} alt={item.name} />)}
      </div>,
      target,
      `vision-reader-${record.userSeq}`,
    )
  })}</>
}

interface MediaDockProps {
  call: (endpoint: string, payload?: Record<string, unknown>) => Promise<unknown>
  t: (key: string, vars?: Record<string, unknown>) => string
  sessionId: string
  useInput: UseInput
  inputActions: InputActions
}

function MediaDock({ call, t, sessionId, useInput, inputActions }: MediaDockProps) {
  const media = useClientMedia(sessionId)
  const draft = useInput(state => state.draft)
  const [removing, setRemoving] = useState('')
  const [error, setError] = useState('')

  // Once ordinary submit clears the draft, wait for the Host pre-step to
  // consume the matching media batch. A manual draft clear does not remove
  // previews because Host state still reports the batch as pending.
  useEffect(() => {
    if (media.length === 0 || draft !== '') return
    let live = true
    let timer = 0
    let delayMs = 750
    const poll = async () => {
      try {
        const state = await call('get-state', { sessionId }) as { media?: unknown[] }
        if (!live) return
        if (!Array.isArray(state.media) || state.media.length === 0) {
          setClientMedia(sessionId, [])
          invalidateTranscriptRecords(sessionId)
          // The Host clears the pending batch immediately before Harness
          // commits the correlated context event. Refresh once more after
          // that durable append so the new transcript image cannot race it.
          window.setTimeout(() => { invalidateTranscriptRecords(sessionId) }, 400)
          return
        }
      } catch {
        // The composer already reports transport failures. Keep the preview
        // rather than losing user media on a transient polling error.
      }
      delayMs = Math.min(delayMs * 2, 5_000)
      if (live) timer = window.setTimeout(() => { void poll() }, delayMs)
    }
    timer = window.setTimeout(() => { void poll() }, delayMs)
    return () => { live = false; window.clearTimeout(timer) }
  }, [call, draft, media.length, sessionId])

  if (media.length === 0) return null

  const remove = async (id: string): Promise<void> => {
    const remaining = media.filter(item => item.id !== id)
    setRemoving(id); setError('')
    try {
      if (remaining.length === 0) await call('clear-media', { sessionId })
      else {
        await call('receive-media', {
          sessionId,
          items: remaining.map(item => ({ name: item.name, mime: item.mime, dataUrl: item.dataUrl })),
        })
      }
      setClientMedia(sessionId, remaining)
      if (remaining.length === 0 && draft === t('defaultRequest')) inputActions.setDraft('')
    } catch (cause) {
      setError(fmt(t('uploadFail'), { err: messageOf(cause) }))
    } finally { setRemoving('') }
  }

  return <div className="vr-media-dock">
    <div className="vr-media-list" role="group" aria-label={t('attached')}>
      {media.map(item => <div className="vr-media-item" key={item.id}>
        {item.mime.startsWith('video/')
          ? <><video src={item.previewUrl} muted playsInline preload="metadata" /><span className="vr-media-kind">{t('video')}</span></>
          : <img src={item.previewUrl} alt={item.name} />}
        <span className="vr-media-name" title={item.name}>{item.name}</span>
        <button type="button" className="vr-media-remove" title={t('remove')} aria-label={`${t('remove')} ${item.name}`} disabled={removing !== ''} onClick={() => { void remove(item.id) }}>×</button>
      </div>)}
    </div>
    {error && <span className="vr-error" role="alert">{error}</span>}
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
