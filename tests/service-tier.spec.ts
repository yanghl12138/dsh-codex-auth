/** Verify both wrapped pi-ai provider entry points with an offline transport. */
import { zstdDecompressSync } from 'node:zlib'
import { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { PiAiAdapterOptions } from '@deepseek-ai/dsh-llm-pi-ai'
import { normalizeContext } from '@earendil-works/pi-ai'
import type { Provider } from '@earendil-works/pi-ai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodexAuthAdapter } from '../src/codex-auth-adapter.ts'
import { createDefaultCodexLlmSettings } from '../src/codex-context.ts'
import type { CodexServiceTier } from '../src/codex-context.ts'

const captured = vi.hoisted(() => ({ options: undefined as PiAiAdapterOptions | undefined }))
vi.mock('@deepseek-ai/dsh-llm-pi-ai', async importOriginal => ({
  ...await importOriginal(),
  PiAiAdapter: class {
    constructor(options: PiAiAdapterOptions) { captured.options = options }
  },
}))

let ctx: Context | undefined
afterEach(async () => {
  await ctx?.fiber.dispose()
  ctx = undefined
  captured.options = undefined
  vi.unstubAllGlobals()
})

describe.each(['stream', 'streamSimple'] as const)('service tier in provider.%s', entry => {
  it.each(['inherit', 'default', 'fast'] as const)(
    'applies %s after configured and request callbacks', async serviceTier => {
      ctx = new Context()
      const bodies: Array<Record<string, unknown>> = []
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        let body = init?.body
        if (body instanceof Uint8Array) {
          const bytes = new Headers(init?.headers).get('content-encoding') === 'zstd'
            ? zstdDecompressSync(body) : body
          body = Buffer.from(bytes).toString('utf8')
        }
        if (typeof body !== 'string') throw new Error('Expected a serialized request body')
        bodies.push(JSON.parse(body) as Record<string, unknown>)
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
      const requestHook = vi.fn(async (payload: unknown) => {
        expect(payload).toMatchObject({ service_tier: 'configured-tier', configured_marker: true })
        await Promise.resolve()
        // Settings may change while a hook runs, but not this request's snapshot.
        currentTier = 'default'
        return { ...(payload as Record<string, unknown>), service_tier: 'flex', request_marker: true }
      })
      const stream = provider[entry](model, normalizeContext({ messages: [] }), {
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
