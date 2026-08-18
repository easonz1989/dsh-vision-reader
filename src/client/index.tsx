import type { Context } from '@deepseek-ai/cordis'
import { useState, useEffect } from 'react'
import type { SettingsScopeSpec, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'

/** Must match the host-registered namespace in src/index.ts. */
const NS = 'vision-reader'
const CHANNEL = '/vision-reader'

interface ClientConfig {
  baseUrl?: string
  apiKey?: string
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

// Module-level mirror of the durable `followLocale` flag so the settings nav
// label thunk (which runs outside React) can honor it.
let latestFollowLocale = true

const dict = {
  zh: {
    nav: '视觉模型',
    title: '视觉媒体 (VL) Provider',
    hint: '填写 OpenAI 兼容的 Provider API 与 Key，保存后自动读取健康状态和 VL 模型列表。没有视觉能力的模型会被拒绝。',
    baseUrlPlaceholder: 'https://api.provider.com/v1',
    apiKeyPlaceholder: 'API Key（如有）',
    apiKeyFilled: '••••••••（已填写，可留空保持不变）',
    saveProbe: '保存并检测',
    saveProbeBusy: '保存并检测中…',
    reprobe: '重新检测',
    healthOk: 'Provider 正常 (HTTP {status})，发现 {count} 个模型',
    healthBad: 'Provider 健康检查失败',
    notProbed: '尚未检测 Provider 状态',
    pickModel: '选择用于分析的 VL 模型：',
    selected: '已选择: {model}',
    followLabel: '设置项文案跟随界面语言',
    followOn: '跟随（中文=视觉模型 / English=Visual Model）',
    followOff: '固定为“视觉模型”',
    upload: '上传',
    uploadTip: '上传图片或影片供 VL 模型分析',
    uploaded: '已上传「{name}」，可以说“分析这个媒体”',
    uploadFail: '上传失败: {err}',
  },
  en: {
    nav: 'Visual Model',
    title: 'Visual Media (VL) Provider',
    hint: 'Fill in an OpenAI-compatible Provider API and Key; save to auto-read health and the VL model list. Models without vision are rejected.',
    baseUrlPlaceholder: 'https://api.provider.com/v1',
    apiKeyPlaceholder: 'API Key (if any)',
    apiKeyFilled: '•••••••• (saved; leave blank to keep)',
    saveProbe: 'Save & probe',
    saveProbeBusy: 'Saving…',
    reprobe: 'Re-probe',
    healthOk: 'Provider OK (HTTP {status}), {count} models found',
    healthBad: 'Provider health check failed',
    notProbed: 'Provider not probed yet',
    pickModel: 'Choose the VL model to analyze with:',
    selected: 'Selected: {model}',
    followLabel: 'Section text follows UI language',
    followOn: 'Follow (中文=视觉模型 / English=Visual Model)',
    followOff: 'Fixed to “视觉模型”',
    upload: 'Upload',
    uploadTip: 'Upload an image or video for the VL model',
    uploaded: 'Uploaded “{name}” — say “analyze this media”',
    uploadFail: 'Upload failed: {err}',
  },
}

function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k] ?? ''))
}

export const name = 'dsh-vision-reader'
export const inject = ['slots', 'locale', 'connection', 'settingsScope']

export async function apply(ctx: Context) {
  const slots = ctx.get('slots') as
    | { inject(key: string, cb: () => unknown): unknown; register(opts: unknown, comp: unknown): unknown }
    | undefined
  const locale = ctx.get('locale') as
    | {
        bind(ns: string): (key: string, vars?: Record<string, unknown>) => string
        register(ns: string, dict: Record<string, Record<string, string>>): unknown
        getLocale<T = { active: string }>(): T
      }
    | undefined
  const connection = ctx.get('connection') as
    | { rpc: { call(ch: string, ep: string, p: unknown): Promise<{ ok: boolean; value?: unknown; error?: { message?: string } }> } }
    | undefined
  const settingsScope = ctx.get('settingsScope') as
    | { bind<T>(spec: SettingsScopeSpec<T>): SettingsScope<T> }
    | undefined

  if (!slots || !locale || !connection || !settingsScope) return

  const t = locale.bind(NS as never)
  ctx.effect(() => {
    const dispose = locale.register(NS as never, dict as never)
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  }, 'dsh-vision-reader: dictionaries')

  const scope = settingsScope.bind<ClientConfig>({ namespace: NS })

  const call = async (endpoint: string, payload: Record<string, unknown> = {}) => {
    const r = await connection.rpc.call(CHANNEL, endpoint, payload)
    if (r.ok) return r.value
    throw new Error(r.error?.message ?? 'RPC failed')
  }

  const readFollow = () => {
    const v = scope.getSnapshot().value
    latestFollowLocale = v?.followLocale ?? true
  }
  scope.subscribe(readFollow)
  readFollow()

  const toggleFollow = async (v: boolean) => {
    latestFollowLocale = v
    await scope.set('followLocale', v)
  }

  // ---- settings.section with locale-following nav label ----
  slots.inject('settings.section', () =>
    slots.register(
      {
        name: 'settings.section',
        id: 'vision-reader',
        order: 25,
        label: () => (latestFollowLocale ? t('nav') : '视觉模型'),
        locale: NS as never,
        inject: () => ({ scope, call, t, toggleFollow }),
      },
      VLProviderSection,
    ),
  )

  // ---- Upload entry in the composer tool row ----
  slots.inject('conversation.input.left', () =>
    slots.register(
      {
        name: 'conversation.input.left',
        id: 'vision-reader-upload',
        order: 0,
        locale: NS as never,
        inject: (sessionId: string) => ({ scope, call, t }),
      },
      UploadEntry,
    ),
  )
}

interface SectionProps {
  scope: SettingsScope<ClientConfig>
  call: (endpoint: string, payload?: Record<string, unknown>) => Promise<unknown>
  t: (key: string, vars?: Record<string, unknown>) => string
  toggleFollow: (v: boolean) => Promise<void>
}

function VLProviderSection({ scope, call, t, toggleFollow }: SectionProps) {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')
  const [followLocale, setFollowLocaleState] = useState(true)
  const [models, setModels] = useState<ModelDescriptor[]>([])
  const [health, setHealth] = useState<ProbeResult | null>(null)
  const [error, setError] = useState('')
  const [probeState, setProbeState] = useState<'idle' | 'probing'>('idle')

  useEffect(() => {
    const v = scope.getSnapshot().value ?? {}
    setBaseUrl(v.baseUrl ?? '')
    setHasKey(!!v.apiKey)
    setSelectedModel(v.selectedModel ?? '')
    setFollowLocaleState(v.followLocale ?? true)
    readFollow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function readFollow() {
    latestFollowLocale = scope.getSnapshot().value?.followLocale ?? true
  }

  const save = async () => {
    setError('')
    setProbeState('probing')
    try {
      await call('save-config', { baseUrl, apiKey })
      await probe()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProbeState('idle')
    }
  }

  const probe = async () => {
    setProbeState('probing')
    setError('')
    try {
      const r = (await call('probe')) as ProbeResult
      setHealth(r)
      setModels(r.models ?? [])
      if (!r.ok) setError(r.error ?? '检测失败')
    } catch (e) {
      setHealth({ ok: false, models: [] })
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProbeState('idle')
    }
  }

  const pickModel = async (id: string) => {
    setError('')
    try {
      await call('set-model', { model: id })
      setSelectedModel(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSelectedModel('')
    }
  }

  const onToggle = async () => {
    const next = !followLocale
    setFollowLocaleState(next)
    await toggleFollow(next)
  }

  const styleInput: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14,
    lineHeight: '22px',
    color: 'var(--dsw-alias-label-primary, inherit)',
  }
  const styleField: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 32,
    padding: '0 8px',
    boxSizing: 'border-box',
    border: '1px solid var(--dsw-alias-border-l2, #bbb)',
    borderRadius: 8,
    background: 'var(--dsw-alias-bg-layer-1, transparent)',
    margin: '6px 0',
  }
  const styleRow: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' }
  const styleButton: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 14px',
    height: 32,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    color: '#fff',
    background: 'var(--dsw-alias-brand-primary, #4f7cff)',
  }
  const styleBadge: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12 }

  return (
    <div style={{ padding: 4, color: 'var(--dsw-alias-label-primary, inherit)' }}>
      <h3>{t('title')}</h3>
      <p style={{ fontSize: 12, opacity: 0.7 }}>{t('hint')}</p>

      <div style={styleRow}>
        <div style={styleField}>
          <input
            style={styleInput}
            placeholder={t('baseUrlPlaceholder')}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>
      </div>
      <div style={styleRow}>
        <div style={styleField}>
          <input
            style={styleInput}
            type="password"
            placeholder={hasKey ? t('apiKeyFilled') : t('apiKeyPlaceholder')}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      </div>

      <div style={styleRow}>
        <button style={styleButton} disabled={probeState === 'probing' || !baseUrl.trim()} onClick={save}>
          {probeState === 'probing' ? t('saveProbeBusy') : t('saveProbe')}
        </button>
        <button
          style={{
            ...styleButton,
            background: 'transparent',
            color: 'var(--dsw-alias-label-primary)',
            border: '1px solid var(--dsw-alias-border-l2, #bbb)',
          }}
          disabled={probeState === 'probing'}
          onClick={probe}
        >
          {t('reprobe')}
        </button>
      </div>

      <div style={{ ...styleRow, margin: '8px 0', cursor: 'pointer' }} onClick={onToggle}>
        <input type="checkbox" checked={followLocale} onChange={onToggle} style={{ marginRight: 6 }} />
        <span style={{ fontSize: 13 }}>
          {t('followLabel')} — {followLocale ? t('followOn') : t('followOff')}
        </span>
      </div>

      {health ? (
        <div style={styleRow}>
          {health.ok ? (
            <span style={{ ...styleBadge, color: 'var(--dsw-alias-state-success-primary, #16a34a)' }}>
              {fmt(t('healthOk'), { status: health.status ?? '', count: health.count ?? models.length })}
            </span>
          ) : (
            <span style={{ ...styleBadge, color: 'var(--dsw-alias-state-error-primary, #dc2626)' }}>{t('healthBad')}</span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.7 }}>{t('notProbed')}</div>
      )}

      {error ? (
        <div style={{ color: 'var(--dsw-alias-state-error-primary, #dc2626)', fontSize: 12, whiteSpace: 'pre-wrap', margin: '6px 0' }}>
          {error}
        </div>
      ) : null}

      {models.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{t('pickModel')}</div>
          {models.map((m) => (
            <div
              key={m.id}
              style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0', cursor: 'pointer' }}
              onClick={() => pickModel(m.id)}
            >
              <span>{selectedModel === m.id ? '● ' : '○ '}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.id}>
                {m.name}
              </span>
              <span
                style={{
                  ...styleBadge,
                  color: m.vision ? 'var(--dsw-alias-state-success-primary, #16a34a)' : 'var(--dsw-alias-state-error-primary, #dc2626)',
                }}
              >
                {m.vision ? 'VL' : '无VL / No VL'}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {selectedModel ? (
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{fmt(t('selected'), { model: selectedModel })}</div>
      ) : null}
    </div>
  )
}

interface UploadProps {
  call: (endpoint: string, payload?: Record<string, unknown>) => Promise<unknown>
  t: (key: string, vars?: Record<string, unknown>) => string
}

function UploadEntry({ call, t }: UploadProps) {
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const inputRef: { current: HTMLInputElement | null } = { current: null }

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      await call('receive-media', { name: file.name, mime: file.type || 'application/octet-stream', dataUrl })
      setName(file.name)
    } catch (err) {
      setName('')
      window.alert(fmt(t('uploadFail'), { err: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 8px',
          cursor: 'pointer',
          border: '1px solid var(--dsw-alias-border-l2, #bbb)',
          borderRadius: 8,
          background: 'transparent',
          color: 'var(--dsw-alias-label-primary, inherit)',
          fontSize: 13,
        }}
        title={t('uploadTip')}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? '…' : name || t('upload')}
      </button>
      <input
        ref={(el) => (inputRef.current = el)}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={onPick}
      />
    </div>
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
