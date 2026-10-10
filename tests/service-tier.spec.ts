/** Verify both wrapped pi-ai provider entry points with an offline transport. */
import { zstdDecompressSync } from 'node:zlib'
import { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { PiAiAdapterOptions } from '@deepseek-ai/dsh-llm-pi-ai'
import type { Provider } from '@earendil-works/pi-ai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodexAuthAdapter } from '../src/codex-auth-adapter.ts'
import { createDefaultCodexLlmSettings } from '../src/codex-context.ts'
import type { CodexServiceTier } from '../src/codex-context.ts'
import { apply, Config } from '../src/index.ts'

const captured = vi.hoisted(() => ({ options: undefined as PiAiAdapterOptions | undefined }))
vi.mock('@deepseek-ai/dsh-llm-pi-ai', async importOriginal => ({
  ...await importOriginal<typeof import('@deepseek-ai/dsh-llm-pi-ai')>(),
  PiAiAdapter: class {
    constructor(options: PiAiAdapterOptions) { captured.options = options }
  },
}))
vi.mock('../src/env-proxy.ts', () => ({ installEnvHttpProxy: vi.fn() }))
vi.mock('../src/codex-auth-service.ts', () => ({ CodexAuthService: class {} }))

let ctx: Context | undefined
afterEach(async () => {
  await ctx?.fiber.dispose()
  ctx = undefined
  vi.unstubAllGlobals()
})

it('keeps route generations stable for tier-only updates while republishing context changes', () => {
  let settings = createDefaultCodexLlmSettings()
  let changed: (() => void) | undefined
  const replace = vi.fn()
  const retire = vi.spyOn(CodexAuthAdapter.prototype, 'replaceRouteGeneration')
  const pluginCtx = {
    logger: { info: vi.fn() },
    llm: { listProviders: () => [], registerAdapter: () => ({ replace }) },
    on: vi.fn(),
    effect: vi.fn(),
    inject: (dependencies: string[], callback: (ctx: unknown) => void) => {
      if (!dependencies.includes('settings')) return
      callback({ settings: {
        installSection: (_owner: unknown, _namespace: string, _schema: unknown, _entry: unknown, hooks: {
          setSource: (source: () => typeof settings) => void
          onChange: () => void
        }) => {
          hooks.setSource(() => settings)
          changed = hooks.onChange
          changed()
        },
      } })
    },
  }
  const parse = Config as unknown as (input: Record<string, unknown>) => Config
  apply(pluginCtx as unknown as Context, parse({ authJsonPath: '/nonexistent/tier-auth.json' }))
  expect(replace).toHaveBeenCalledTimes(1)
  expect(retire).toHaveBeenCalledTimes(1)
  settings = { ...settings, serviceTier: 'fast' }
  changed!()
  expect(replace).toHaveBeenCalledTimes(1)
  expect(retire).toHaveBeenCalledTimes(1)
  settings = { ...settings, 'gpt-6.1-sol': true }
  changed!()
  expect(replace).toHaveBeenCalledTimes(2)
  expect(retire).toHaveBeenCalledTimes(2)
})

describe.each(['stream', 'streamSimple'] as const)('service tier in provider.%s', entry => {
  it.each(['inherit', 'default', 'fast'] as const)(
    'applies %s after configured and request callbacks', async serviceTier => {
      ctx = new Context()
      const bodies: Array<Record<string, unknown>> = []
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = init?.body
        const bytes = body instanceof Uint8Array
          ? new Headers(init?.headers).get('content-encoding') === 'zstd' ? zstdDecompressSync(body) : body
          : undefined
        bodies.push(JSON.parse(typeof body === 'string' ? body : Buffer.from(bytes!).toString('utf8')))
        return new Response('offline tier fixture stop', { status: 400 })
      })
      vi.stubGlobal('fetch', fetchMock)
      const token = ['header', Buffer.from(JSON.stringify({
        'https://api.openai.com/auth': { chatgpt_account_id: 'synthetic-tier-account' },
      })).toString('base64url'), 'signature'].join('.')
      let currentTier: CodexServiceTier = serviceTier
      const configured = vi.fn((payload: unknown) => ({
        ...(payload as Record<string, unknown>), service_tier: 'configured-tier', configured_marker: true,
      }))
      new CodexAuthAdapter(ctx, {
        auth: { credential: async () => ({ accessToken: token, accountId: 'synthetic-tier-account' }) },
        authJsonPath: '/nonexistent/tier-fixture-auth.json',
        credentialRef: credentialRef('SYNTHETIC_TIER'),
        refreshLeadMs: 300_000,
        fetchImpl: fetchMock,
        displayName: 'Offline tier fixture',
        settings: () => ({ ...createDefaultCodexLlmSettings(), serviceTier: currentTier }),
        transport: 'sse',
        websocketConnectTimeoutMs: 1_000,
        timeoutMs: 1_000,
        onPayload: configured,
      })
      const profile = captured.options?.profiles().get('openai-codex') as { piProvider: Provider }
      const provider = profile.piProvider
      const model = provider.getModels().find(model => model.id === 'gpt-6.1-sol')!
      const requestHook = vi.fn((payload: unknown) => {
        expect(payload).toMatchObject({ service_tier: 'configured-tier', configured_marker: true })
        // A concurrent settings change cannot change the current request snapshot.
        currentTier = 'default'
        return { ...(payload as Record<string, unknown>), service_tier: 'flex', request_marker: true }
      })
      const stream = provider[entry](model, { messages: [] }, {
        apiKey: token, transport: 'sse', onPayload: requestHook,
      })
      for await (const _event of stream) { /* capture the offline request */ }
      expect(configured).toHaveBeenCalledTimes(1)
      expect(requestHook).toHaveBeenCalledTimes(1)
      expect(bodies).toHaveLength(1)
      expect(bodies[0]).toMatchObject({
        service_tier: serviceTier === 'inherit' ? 'flex' : serviceTier === 'fast' ? 'priority' : 'default',
        configured_marker: true, request_marker: true,
      })
    },
  )
})
