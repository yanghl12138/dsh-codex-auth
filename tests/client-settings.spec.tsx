/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentType } from 'react'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { PartialArguments } from '@deepseek-ai/dsh-util-values'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { CodexImageSettings } from '../src/image.ts'
import type { CodexSearchSettings } from '../src/search.ts'
import type { CodexAuthRpcClient, CodexAuthStatusView, CodexUsageView } from '../src/rpc-contract.ts'
import {
  CodexCapabilitySettings, CodexImageToolView, apply, inject,
} from '../src/client/index.ts'
import { en, zh } from '../src/client/locales.ts'
import { CODEX_LONG_CONTEXT_MODEL_IDS, createDefaultCodexLlmSettings } from '../src/codex-context.ts'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-attachment', () => ({
  ImageGallery: ({ images }: { images: Array<{ attachment: ImageAttachmentRef }> }) => (
    <div>{images.map(({ attachment }) => <img key={String(attachment.attachmentId)} alt={attachment.name ?? 'Generated image'} />)}</div>
  ),
}))

const LLM = createDefaultCodexLlmSettings()

const SEARCH: CodexSearchSettings = {
  enabled: true,
  mode: 'live',
  contextSize: 'medium',
  fallbackModel: 'gpt-5.4',
  maxOutputTokens: 2048,
}
const IMAGE: CodexImageSettings = {
  enabled: true,
  model: 'gpt-image-2',
  n: 1,
  size: 'auto',
  quality: 'auto',
  background: 'auto',
}

function fakeScope<T>(
  initial: T,
  status: ConfigFormSnapshot<T>['status'] = 'ready',
  writable = true,
  beforeSet?: () => Promise<void>,
): { scope: ConfigForm<T>; set: ReturnType<typeof vi.fn> } {
  let snapshot: ConfigFormSnapshot<T> = {
    status,
    value: initial,
    base: initial,
    user: {},
    revision: 1,
    writable,
  }
  const listeners = new Set<() => void>()
  const set = vi.fn(async (field: string, value: unknown) => {
    await beforeSet?.()
    snapshot = { ...snapshot, value: { ...(snapshot.value ?? initial), [field]: value } }
    for (const listener of listeners) listener()
    return true
  })
  const scope = {
    getSnapshot() {
      if (this !== scope) throw new Error('getSnapshot lost its ConfigForm receiver')
      return snapshot
    },
    subscribe(listener: () => void) {
      if (this !== scope) throw new Error('subscribe lost its ConfigForm receiver')
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set,
    unset: vi.fn(async () => true),
    mutate: vi.fn(async () => true),
  } satisfies ConfigForm<T>
  return { set, scope }
}

function authStatus(overrides: Partial<CodexAuthStatusView>): CodexAuthStatusView {
  return {
    available: true,
    configured: true,
    credentialRef: '~/.codex/auth.json',
    authFileExists: true,
    ...overrides,
  }
}

function rpc(status: CodexAuthStatusView, usage: CodexUsageView = {}): CodexAuthRpcClient {
  return {
    status: vi.fn(async () => ({ ok: true as const, value: { status } })),
    usage: vi.fn(async () => ({ ok: true as const, value: { usage } })),
    login: vi.fn(async () => ({ ok: true as const, value: { started: true } })),
  }
}

const t = (key: keyof typeof en): string => en[key]
const subscribe = (): (() => void) => () => {}

afterEach(() => cleanup())

describe('Codex Capability Bundle settings', () => {
  it('saves each global tier without changing context or other capabilities, even before login', async () => {
    const llm = fakeScope(LLM)
    const search = fakeScope(SEARCH)
    const image = fakeScope(IMAGE)
    render(<CodexCapabilitySettings rpc={rpc(authStatus({ configured: false, authFileExists: false }))} t={t} subscribe={subscribe}
      llmScope={llm.scope} searchScope={search.scope} imageScope={image.scope} />)
    await screen.findByText('Not logged in')
    const select = screen.getByRole('combobox', { name: 'Service tier' }) as HTMLSelectElement
    expect(select.disabled).toBe(false)
    expect(select.value).toBe('inherit')
    expect(Array.from(select.options, option => [option.value, option.text])).toEqual([
      ['inherit', 'No override (default)'], ['default', 'Standard'], ['fast', 'Fast'],
    ])
    expect(screen.getByRole('heading', { name: 'Context' })).toBeTruthy()
    for (const value of ['fast', 'default', 'inherit']) {
      fireEvent.change(select, { target: { value } })
      await waitFor(() => expect(llm.set).toHaveBeenLastCalledWith('serviceTier', value))
      expect(select.value).toBe(value)
    }
    expect(llm.set).toHaveBeenCalledTimes(3)
    expect(search.set).not.toHaveBeenCalled()
    expect(image.set).not.toHaveBeenCalled()
    expect(screen.getByText(en.serviceTierBehavior)).toBeTruthy()
    expect(screen.getByText(en.serviceTierWarning)).toBeTruthy()
  })

  it('defaults a missing tier to inherit without saving or changing existing context switches', () => {
    const { serviceTier: _serviceTier, ...legacy } = { ...LLM, 'gpt-6.1-sol': true }
    const llm = fakeScope(legacy as typeof LLM)
    render(<CodexCapabilitySettings rpc={rpc(authStatus({}))} t={t} subscribe={subscribe}
      llmScope={llm.scope} searchScope={fakeScope(SEARCH).scope} imageScope={fakeScope(IMAGE).scope} />)
    expect((screen.getByLabelText('Service tier') as HTMLSelectElement).value).toBe('inherit')
    expect((screen.getByLabelText('GPT-6.1 Sol') as HTMLInputElement).checked).toBe(true)
    expect(llm.set).not.toHaveBeenCalled()
  })

  it('reports failed tier saves and retains the saved selection', async () => {
    const llm = fakeScope({ ...LLM, serviceTier: 'fast' as const })
    llm.set.mockRejectedValueOnce(new Error('tier save failed'))
    render(<CodexCapabilitySettings rpc={rpc(authStatus({}))} t={t} subscribe={subscribe}
      llmScope={llm.scope} searchScope={fakeScope(SEARCH).scope} imageScope={fakeScope(IMAGE).scope} />)
    fireEvent.change(screen.getByLabelText('Service tier'), { target: { value: 'default' } })
    expect(await screen.findByText('tier save failed')).toBeTruthy()
    expect((screen.getByLabelText('Service tier') as HTMLSelectElement).value).toBe('fast')
    expect(llm.set).toHaveBeenCalledExactlyOnceWith('serviceTier', 'default')
  })

  it.each(['loading', 'unavailable', 'readonly'] as const)('prevents tier edits when settings are %s', state => {
    const llm = fakeScope(LLM, state === 'readonly' ? 'ready' : state, state !== 'readonly')
    render(<CodexCapabilitySettings rpc={rpc(authStatus({}))} t={t} subscribe={subscribe}
      llmScope={llm.scope} searchScope={fakeScope(SEARCH).scope} imageScope={fakeScope(IMAGE).scope} />)
    const select = screen.queryByLabelText('Service tier') as HTMLSelectElement | null
    if (state === 'readonly') expect(select?.disabled).toBe(true)
    else expect(select).toBeNull()
    expect(llm.set).not.toHaveBeenCalled()
  })

  it('provides Chinese tier controls and grouped LLM settings', () => {
    render(<CodexCapabilitySettings rpc={rpc(authStatus({}))} t={key => zh[key]} subscribe={subscribe}
      llmScope={fakeScope(LLM).scope} searchScope={fakeScope(SEARCH).scope} imageScope={fakeScope(IMAGE).scope} />)
    expect(screen.getByRole('heading', { name: 'LLM 设置' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '上下文' })).toBeTruthy()
    const select = screen.getByLabelText('服务档位') as HTMLSelectElement
    expect(Array.from(select.options, option => [option.value, option.text])).toEqual([
      ['inherit', '不覆盖（默认）'], ['default', '标准'], ['fast', 'Fast'],
    ])
    expect(screen.getByText(zh.serviceTierBehavior)).toBeTruthy()
    expect(screen.getByText(zh.serviceTierWarning)).toBeTruthy()
  })

  it('blocks editing until a pending exclusion save settles, then permits clearing the saved list', async () => {
    const pending = Promise.withResolvers<void>()
    const llm = fakeScope({ ...LLM, excludedModelIds: [] as string[] }, 'ready', true, () => pending.promise)
    render(<CodexCapabilitySettings rpc={rpc(authStatus({}))} t={t} subscribe={subscribe}
      llmScope={llm.scope} searchScope={fakeScope(SEARCH).scope} imageScope={fakeScope(IMAGE).scope} />)
    const input = screen.getByLabelText('Excluded model IDs') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'gpt-5.3-codex-spark' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.disabled).toBe(true)
    fireEvent.blur(input)
    expect(llm.set).toHaveBeenCalledTimes(1)
    pending.resolve()
    await waitFor(() => expect(input.disabled).toBe(false))
    expect(input.value).toBe('gpt-5.3-codex-spark')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    await waitFor(() => expect(llm.set).toHaveBeenLastCalledWith('excludedModelIds', []))
    await waitFor(() => expect(input.disabled).toBe(false))
    expect(input.value).toBe('')
  })

  it('saves exact model exclusions on blur or Enter, deduplicates input, and clears to an empty list', async () => {
    const llm = fakeScope({ ...LLM, excludedModelIds: ['gpt-5.4'] })
    render(<CodexCapabilitySettings rpc={rpc(authStatus({}))} t={t} subscribe={subscribe}
      llmScope={llm.scope} searchScope={fakeScope(SEARCH).scope} imageScope={fakeScope(IMAGE).scope} />)
    const input = screen.getByLabelText('Excluded model IDs') as HTMLInputElement
    expect(input.value).toBe('gpt-5.4')
    expect(screen.getByText(/catalog visibility, not request permissions/)).toBeTruthy()
    fireEvent.change(input, { target: { value: ' gpt-5.3-codex-spark, unknown, gpt-5.3-codex-spark, ' } })
    expect(llm.set).not.toHaveBeenCalled()
    fireEvent.blur(input)
    await waitFor(() => expect(llm.set).toHaveBeenCalledWith('excludedModelIds', ['gpt-5.3-codex-spark', 'unknown']))
    fireEvent.change(input, { target: { value: ' ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(llm.set).toHaveBeenCalledWith('excludedModelIds', []))
  })

  it('resets exclusion drafts when switching profiles and surfaces save failures', async () => {
    const first = fakeScope({ ...LLM, excludedModelIds: ['gpt-5.4'] })
    const second = fakeScope({ ...LLM, excludedModelIds: ['gpt-6-sol'] })
    const props = { rpc: rpc(authStatus({})), t, subscribe, searchScope: fakeScope(SEARCH).scope, imageScope: fakeScope(IMAGE).scope }
    const { rerender } = render(<CodexCapabilitySettings {...props} llmScope={first.scope} />)
    fireEvent.change(screen.getByLabelText('Excluded model IDs'), { target: { value: 'unsaved' } })
    rerender(<CodexCapabilitySettings {...props} llmScope={second.scope} />)
    expect((screen.getByLabelText('Excluded model IDs') as HTMLInputElement).value).toBe('gpt-6-sol')
    second.set.mockRejectedValueOnce(new Error('Storage unavailable'))
    fireEvent.change(screen.getByLabelText('Excluded model IDs'), { target: { value: 'gpt-5.4' } })
    fireEvent.blur(screen.getByLabelText('Excluded model IDs'))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Storage unavailable')
    second.set.mockResolvedValueOnce(false)
    fireEvent.change(screen.getByLabelText('Excluded model IDs'), { target: { value: 'unknown' } })
    fireEvent.blur(screen.getByLabelText('Excluded model IDs'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveProperty('textContent', en.writeFailed))
    expect(first.set).not.toHaveBeenCalled()
  })

  it('reports false aggregate saves without changing the tier or exclusions', async () => {
    const llm = fakeScope({ ...LLM, serviceTier: 'fast' as const, excludedModelIds: ['gpt-6.1-sol'] })
    llm.set.mockResolvedValue(false)
    render(<CodexCapabilitySettings rpc={rpc(authStatus({}))} t={t} subscribe={subscribe}
      llmScope={llm.scope} searchScope={fakeScope(SEARCH).scope} imageScope={fakeScope(IMAGE).scope} />)
    fireEvent.click(screen.getByLabelText(en.toggleAllLongContext))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', en.writeFailed)
    expect(llm.set).toHaveBeenCalledTimes(CODEX_LONG_CONTEXT_MODEL_IDS.length)
    expect(llm.set).not.toHaveBeenCalledWith('serviceTier', expect.anything())
    expect(llm.set).not.toHaveBeenCalledWith('excludedModelIds', expect.anything())
    expect((screen.getByLabelText(en.serviceTier) as HTMLSelectElement).value).toBe('fast')
    expect((screen.getByLabelText(en.excludedModelIds) as HTMLInputElement).value).toBe('gpt-6.1-sol')
  })

  it('saves GPT Image 2.5 quality and custom dimensions while rejecting incomplete sizes', async () => {
    const image = fakeScope({ ...IMAGE, model: 'gpt-image-2.5-sunburst' })
    render(<CodexCapabilitySettings rpc={rpc(authStatus({ planType: 'plus' }))} t={t} subscribe={subscribe}
      llmScope={fakeScope(LLM).scope} searchScope={fakeScope(SEARCH).scope} imageScope={image.scope} />)
    await screen.findByText('Active')
    fireEvent.click(screen.getByRole('button', { name: 'Expand Image Creation settings' }))
    const modelOptions = (screen.getByLabelText('Image model') as HTMLInputElement).list?.options
    expect(Array.from(modelOptions ?? [], option => option.value)).toContain('gpt-image-2.5-flare')
    fireEvent.change(screen.getByLabelText('Default quality'), { target: { value: 'max' } })
    await waitFor(() => expect(image.set).toHaveBeenCalledWith('quality', 'max'))
    const size = screen.getByLabelText('Default size')
    fireEvent.change(size, { target: { value: '1536x' } })
    fireEvent.blur(size)
    expect(image.set).not.toHaveBeenCalledWith('size', expect.anything())
    fireEvent.change(size, { target: { value: '1536x864' } })
    fireEvent.blur(size)
    await waitFor(() => expect(image.set).toHaveBeenCalledWith('size', '1536x864'))
    fireEvent.change(screen.getByLabelText('Image model'), { target: { value: 'gpt-image-2' } })
    await waitFor(() => expect(image.set).toHaveBeenCalledWith('model', 'gpt-image-2'))
    expect((screen.getByRole('option', { name: 'Maximum' }) as HTMLOptionElement).disabled).toBe(true)
  })

  it('renders Login, LLM Settings, Search, and Image Creation as one live four-card section', async () => {
    const llm = fakeScope(LLM)
    const search = fakeScope(SEARCH)
    const image = fakeScope(IMAGE)
    render(<CodexCapabilitySettings
      rpc={rpc(
        authStatus({ credentialRef: '/Users/alice/.codex/auth.json', accountId: 'acct-1', planType: 'plus' }),
        { weeklyRemainingPercent: 49, weeklyResetAt: '2026-08-20T12:00:00.000Z' },
      )}
      t={t}
      subscribe={subscribe}
      llmScope={llm.scope}
      searchScope={search.scope}
      imageScope={image.scope}
    />)

    expect(await screen.findByText('Active')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Login' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'LLM Settings' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Web Search' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Image Creation' })).toBeTruthy()
    // The login block only surfaces plan, remaining quota, and weekly reset.
    expect(screen.getByText('Plus plan')).toBeTruthy()
    expect(screen.getByText('49%')).toBeTruthy()
    expect(screen.getByText('Remaining quota')).toBeTruthy()
    expect(screen.getByText('Weekly limit resets')).toBeTruthy()
    expect(screen.queryByText('acct-1')).toBeNull()
    expect(screen.queryByText('/Users/alice/.codex/auth.json')).toBeNull()
    expect(screen.getByText(/no token value is ever sent to the Web client/i)).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Enable or disable long context for all models'))
    await waitFor(() => expect(llm.set).toHaveBeenCalledTimes(CODEX_LONG_CONTEXT_MODEL_IDS.length))
    for (const id of CODEX_LONG_CONTEXT_MODEL_IDS) {
      expect(llm.set).toHaveBeenCalledWith(id, true)
    }
    expect((screen.getByLabelText('Enable or disable long context for all models') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('Long context enabled for 7/7 models')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('GPT-6 Sol'))
    await waitFor(() => expect(llm.set).toHaveBeenCalledWith('gpt-6-sol', false))
    expect((screen.getByLabelText('Enable or disable long context for all models') as HTMLInputElement).indeterminate).toBe(true)
    expect(screen.getByText('Long context enabled for 6/7 models')).toBeTruthy()

    const expandSearch = screen.getByRole('button', { name: 'Expand Web Search settings' })
    const expandImage = screen.getByRole('button', { name: 'Expand Image Creation settings' })
    expect(expandSearch.getAttribute('aria-expanded')).toBe('false')
    expect(expandImage.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(expandSearch)
    fireEvent.click(expandImage)
    expect(screen.getByRole('button', { name: 'Collapse Web Search settings' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Collapse Image Creation settings' }).getAttribute('aria-expanded')).toBe('true')

    fireEvent.change(screen.getByLabelText('Search mode'), { target: { value: 'cached' } })
    await waitFor(() => expect(search.set).toHaveBeenCalledWith('mode', 'cached'))
    fireEvent.change(screen.getByLabelText('Default image count'), { target: { value: '3' } })
    await waitFor(() => expect(image.set).toHaveBeenCalledWith('n', 3))
  })

  it('toggles GPT-6.1 Sol independently and includes it in mixed and all-off states without changing the tier', async () => {
    const llm = fakeScope({ ...LLM, serviceTier: 'fast' as const })
    render(<CodexCapabilitySettings rpc={rpc(authStatus({ planType: 'plus' }))} t={t} subscribe={subscribe}
      llmScope={llm.scope} searchScope={fakeScope(SEARCH).scope} imageScope={fakeScope(IMAGE).scope} />)
    await screen.findByText('Active')
    expect(screen.getByText('Long context enabled for 0/7 models')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('GPT-6.1 Sol'))
    await waitFor(() => expect(llm.set).toHaveBeenCalledExactlyOnceWith('gpt-6.1-sol', true))
    const aggregate = screen.getByLabelText('Enable or disable long context for all models') as HTMLInputElement
    expect(aggregate.indeterminate).toBe(true)
    expect(screen.getByText('Long context enabled for 1/7 models')).toBeTruthy()
    llm.set.mockClear()
    fireEvent.click(aggregate)
    await waitFor(() => expect(llm.set).toHaveBeenCalledTimes(7))
    for (const id of CODEX_LONG_CONTEXT_MODEL_IDS) expect(llm.set).toHaveBeenCalledWith(id, true)
    expect(aggregate.indeterminate).toBe(false)
    expect(aggregate.checked).toBe(true)
    llm.set.mockClear()
    fireEvent.click(aggregate)
    await waitFor(() => expect(llm.set).toHaveBeenCalledTimes(7))
    for (const id of CODEX_LONG_CONTEXT_MODEL_IDS) expect(llm.set).toHaveBeenCalledWith(id, false)
    expect(aggregate.checked).toBe(false)
    expect(screen.getByText('Long context enabled for 0/7 models')).toBeTruthy()
    expect(llm.set).not.toHaveBeenCalledWith('serviceTier', expect.anything())
    expect((screen.getByLabelText('Service tier') as HTMLSelectElement).value).toBe('fast')
  })

  it('announces loading settings while keeping skeleton rows decorative', async () => {
    const { container } = render(<CodexCapabilitySettings
      rpc={rpc(authStatus({ planType: 'plus' }))}
      t={t}
      subscribe={subscribe}
      llmScope={fakeScope(LLM, 'loading').scope}
      searchScope={fakeScope(SEARCH, 'loading').scope}
      imageScope={fakeScope(IMAGE, 'loading').scope}
    />)

    expect(await screen.findByText('Active')).toBeTruthy()
    expect(screen.getAllByText('Loading settings…')).toHaveLength(3)
    const visibleBusyRegions = screen.getAllByRole('status')
      .filter(region => region.getAttribute('aria-busy') === 'true')
    expect(visibleBusyRegions).toHaveLength(1)
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(3)
    expect(container.querySelectorAll('[aria-busy="true"] > div:not([aria-hidden="true"])')).toHaveLength(0)
  })

  it('identifies a known Free plan while leaving unknown plans backend-authoritative', async () => {
    const { rerender } = render(<CodexCapabilitySettings
      rpc={rpc(authStatus({ credentialRef: '/tmp/auth.json', accountId: 'acct-free', planType: 'free' }))}
      t={t}
      subscribe={subscribe}
      llmScope={fakeScope(LLM).scope}
      searchScope={fakeScope(SEARCH).scope}
      imageScope={fakeScope(IMAGE).scope}
    />)
    expect(await screen.findByText('Unavailable on Free plan')).toBeTruthy()
    expect((screen.getByLabelText('Enable Image Creation') as HTMLInputElement).disabled).toBe(true)

    rerender(<CodexCapabilitySettings
      rpc={rpc(authStatus({ credentialRef: '/tmp/auth.json' }))}
      t={t}
      subscribe={subscribe}
      llmScope={fakeScope(LLM).scope}
      searchScope={fakeScope(SEARCH).scope}
      imageScope={fakeScope(IMAGE).scope}
    />)
    // A configured non-Free plan carries no badge on either capability card.
    expect(await screen.findByText('Unknown plan')).toBeTruthy()
    expect(screen.queryByText('Entitlement checked on use')).toBeNull()
    expect(screen.queryByText('Deployment-wide provider')).toBeNull()

    rerender(<CodexCapabilitySettings
      rpc={rpc(authStatus({ configured: false, authFileExists: false }))}
      t={t}
      subscribe={subscribe}
      llmScope={fakeScope(LLM).scope}
      searchScope={fakeScope(SEARCH).scope}
      imageScope={fakeScope(IMAGE).scope}
    />)
    expect((await screen.findAllByText('Available after login')).length).toBe(2)
    expect((screen.getByLabelText('Enable Web Search') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Enable Image Creation') as HTMLInputElement).disabled).toBe(true)
  })
})

describe('Codex Image Creation tool view', () => {
  it('renders only generated images after a successful call', async () => {
    const attachment: ImageAttachmentRef = {
      attachmentId: 'att-1' as ImageAttachmentRef['attachmentId'],
      mediaType: 'image/png',
      bytes: 68,
      width: 1,
      height: 1,
      name: 'generated.png',
    }
    const block: ToolCallBlock = {
      kind: 'tool-result',
      seq: 3,
      time: 30,
      callId: 'call-1',
      name: 'generate_image',
      args: PartialArguments.fromObject({ prompt: 'fox' }),
      call: { name: 'generate_image', argsRaw: '{"prompt":"fox"}' },
      callTime: 10,
      content: [{ type: 'image', attachment }],
      isError: false,
      meta: {
        operation: 'generate',
        images: [{ handle: 'image:att-1', attachment, origin: 'generated' }],
        references: [],
        warnings: [{ index: 1, code: 'IMAGE_MEDIA_INVALID', message: 'One item was invalid.' }],
      },
      subCalls: [],
    }
    const loadImage = vi.fn(async () => 'data:image/png;base64,iVBORw0KGgo=')

    const { container } = render(<CodexImageToolView block={block} loadImage={loadImage} />)

    expect(await screen.findByRole('img', { name: 'generated.png' })).toBeTruthy()
    expect(container.textContent).toBe('')
    expect(screen.queryByText('image:att-1')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save to workspace' })).toBeNull()
  })

  it('shows a stable in-progress state before a tool result lands', () => {
    const block: ToolCallBlock = {
      callId: 'call-1',
      name: 'generate_image',
      phase: 'start',
      args: PartialArguments.fromObject({ prompt: 'fox' }),
      argsRaw: '{"prompt":"fox"}',
      turn: 1,
      step: 1,
      time: 10,
      subCalls: [],
    }
    const { rerender } = render(<CodexImageToolView block={block} loadImage={vi.fn()} />)
    expect(screen.getByText('Creating images…')).toBeTruthy()
    rerender(<CodexImageToolView block={block} loadImage={vi.fn()} t={key => zh[key]} />)
    expect(screen.getByText('正在创作图片…')).toBeTruthy()
  })
})

describe('client plugin registration', () => {
  it('registers one settings row and keyed views for both image tools', () => {
    const registered: Array<Record<string, unknown>> = []
    const scopes = new Map<string, ConfigForm<unknown>>([
      ['llm-codex-auth', fakeScope(LLM).scope],
      ['codex-search', fakeScope(SEARCH).scope],
      ['codex-image', fakeScope(IMAGE).scope],
    ])
    const sessions = { binding: vi.fn() }
    const connection = { isLoopback: true, rpc: { call: vi.fn() } }
    const ctx = {
      effect: (setup: () => unknown) => setup(),
      on: vi.fn(() => () => {}),
      get: (name: string) => name === 'connection' ? connection : undefined,
      sessions,
      locale: { register: vi.fn(() => () => {}), bind: vi.fn(() => t) },
      slots: {
        inject: (_name: string, setup: () => unknown) => setup(),
        register: (registration: Record<string, unknown>, component: unknown) => {
          registered.push({ ...registration, component })
          return () => {}
        },
      },
      configForms: { get: (entryId: string) => scopes.get(entryId) },
    }

    apply(ctx as never)

    expect(inject).toEqual(expect.arrayContaining(['remote', 'configForms', 'sessions']))
    expect(registered).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'settings.section', id: 'codex-auth' }),
      expect.objectContaining({ name: 'tool.call.toolview', key: 'generate_image' }),
      expect.objectContaining({ name: 'tool.call.toolview', key: 'list_images' }),
    ]))

    const ListImagesView = registered.find(item => item.key === 'list_images')?.component as ComponentType<{
      block: ToolCallBlock
      sessionId: string
      t: typeof t
    }>
    const listBlock: ToolCallBlock = {
      kind: 'tool-result',
      seq: 4,
      time: 40,
      callId: 'call-list',
      name: 'list_images',
      args: PartialArguments.EMPTY,
      call: { name: 'list_images', argsRaw: '{}' },
      callTime: 30,
      content: [],
      isError: false,
      meta: { operation: 'list', items: [], nextCursor: null },
      subCalls: [],
    }
    const listResult = render(<ListImagesView block={listBlock} sessionId="session-a" t={t} />)
    expect(listResult.container.firstElementChild).toBeNull()
  })
})
