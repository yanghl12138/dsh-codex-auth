/** Catalog overlay and Long Context Mode policy for the openai-codex route. */
import type { Api, Model } from '@earendil-works/pi-ai'
import { builtinProviders } from '@earendil-works/pi-ai/providers/all'
import { describe, expect, it } from 'vitest'
import {
  applyCodexContextPolicy,
  CODEX_GPT_6_1_SOL_MODEL_ID,
  CODEX_GPT_6_LONG_CONTEXT_WINDOW,
  CODEX_LONG_CONTEXT_MODEL_IDS,
  CODEX_LONG_CONTEXT_WINDOW,
  CODEX_STANDARD_CONTEXT_WINDOW,
  createDefaultCodexLlmSettings,
} from '../src/codex-context.ts'
import type { CodexModelSupplement } from '../src/codex-context.ts'

function fakeModel(id: string, extra: Partial<Model<Api>> = {}): Model<Api> {
  return {
    id,
    name: id,
    api: 'openai-codex-responses',
    provider: 'openai-codex',
    baseUrl: 'https://chatgpt.com/backend-api',
    reasoning: true,
    input: ['text', 'image'],
    cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
    contextWindow: CODEX_STANDARD_CONTEXT_WINDOW,
    maxTokens: 128_000,
    thinkingLevelMap: { xhigh: 'xhigh', max: 'max', minimal: 'low' },
    compat: { supportsOpenAIGrammarTools: true, supportsAdditionalTools: true, supportsToolSearch: true },
    ...extra,
  } as Model<Api>
}

describe('applyCodexContextPolicy', () => {
  it('keeps empty and omitted exclusions identical and ignores unknown exact IDs', () => {
    const models = Object.freeze([fakeModel('gpt-5.4'), fakeModel('gpt-5.3-codex-spark')])
    const settings = createDefaultCodexLlmSettings()
    expect(applyCodexContextPolicy(models, settings)).toBe(models)
    expect(applyCodexContextPolicy(models, { ...settings, excludedModelIds: [] })).toBe(models)
    const catalog = applyCodexContextPolicy(models, {
      ...settings, excludedModelIds: ['unknown', 'GPT-5.4', 'gpt-5.4*', ' gpt-5.4 '],
    })
    expect(catalog).toEqual(models)
    catalog.forEach((model, index) => expect(model).toBe(models[index]))
  })

  it('excludes duplicate exact IDs while preserving descriptor references, fields and order', () => {
    const models = Object.freeze([
      Object.freeze(fakeModel('gpt-5.4', { maxTokens: 456, name: 'Provider name' })),
      Object.freeze(fakeModel('gpt-5.3-codex-spark')),
      Object.freeze(fakeModel('gpt-5.3-codex-spark-preview')),
    ])
    const before = structuredClone(models)
    const catalog = applyCodexContextPolicy(models, {
      ...createDefaultCodexLlmSettings(), excludedModelIds: ['gpt-5.3-codex-spark', 'gpt-5.3-codex-spark'],
    })
    expect(catalog).toEqual([models[0], models[2]])
    expect(catalog[0]).toBe(models[0])
    expect(catalog[1]).toBe(models[2])
    expect(models).toEqual(before)
  })

  it('preserves pi-ai descriptors and supplements Terra by default', () => {
    const provider = builtinProviders().find(provider => provider.id === 'openai-codex')
    if (provider === undefined) throw new Error('missing Codex provider')
    const models = Object.freeze(provider.getModels().map(model => Object.freeze(structuredClone(model))))
    const catalog = applyCodexContextPolicy(models, createDefaultCodexLlmSettings())
    expect(catalog.map(model => model.id)).toEqual(expect.arrayContaining([...CODEX_LONG_CONTEXT_MODEL_IDS]))
    expect(catalog.slice(1)).toEqual(models)
    models.forEach((model, index) => expect(catalog[index + 1]).toBe(model))
    expect(catalog[0]).toMatchObject({
      id: 'gpt-6.1-terra', contextWindow: 500_000, maxTokens: 128_000,
      cost: { input: 1, output: 5, cacheRead: 0.05, cacheWrite: 1.25,
        tiers: [{ inputTokensAbove: 272_000, input: 2, output: 7.5, cacheRead: 0.1, cacheWrite: 2.5 }] },
      thinkingLevelMap: { off: null, minimal: 'low', max: 'max' },
    })
    const long = applyCodexContextPolicy(models, { ...createDefaultCodexLlmSettings(), 'gpt-6.1-terra': true })
    expect(long[0]).toEqual({ ...catalog[0], contextWindow: 872_000 })
    expect(long.slice(1)).toEqual(models)
    const installed = Object.freeze({ ...catalog[0]!, contextWindow: 600_000 })
    const complete = Object.freeze([installed, ...models])
    expect(applyCodexContextPolicy(complete, createDefaultCodexLlmSettings())).toBe(complete)
    expect(applyCodexContextPolicy(models, {
      ...createDefaultCodexLlmSettings(), 'gpt-6.1-terra': true, excludedModelIds: ['gpt-6.1-terra'],
    })).toEqual(models)
  })

  it('does not recreate retired GPT-6 fallbacks from legacy templates', () => {
    const models = Object.freeze([fakeModel('gpt-5.6-sol'), fakeModel('gpt-5.6-luna')])
    expect(applyCodexContextPolicy(models, createDefaultCodexLlmSettings())).toBe(models)
  })

  it('supplements an explicitly registered model without changing its template', () => {
    const template = Object.freeze(fakeModel('fixture-template', { contextWindow: 300_000, maxTokens: 64_000 }))
    const models = Object.freeze([template])
    const overrides = Object.freeze({
      id: 'fixture-new-model', name: 'New model', contextWindow: 400_000,
      cost: { input: 7, output: 8, cacheRead: 1, cacheWrite: 2 },
      thinkingLevelMap: { off: null, low: 'low' },
    })
    const supplements = Object.freeze([{ templateId: template.id, overrides }])
    const before = structuredClone({ models, supplements })
    const catalog = applyCodexContextPolicy(models, createDefaultCodexLlmSettings(), supplements)
    expect(catalog).toEqual([{ ...template, ...overrides }, template])
    expect(catalog[0]?.maxTokens).toBe(64_000)
    expect(catalog[0]?.compat).toBe(template.compat)
    expect(catalog[1]).toBe(template)
    expect({ models, supplements }).toEqual(before)
  })

  it('preserves installed models, skips absent templates and deduplicates supplements', () => {
    const installed = Object.freeze(fakeModel('fixture-installed', { name: 'Provider-owned model' }))
    const template = Object.freeze(fakeModel('fixture-template'))
    const models = Object.freeze([installed, template])
    const supplements: readonly CodexModelSupplement[] = [
      { templateId: template.id, overrides: { id: installed.id, name: 'Ignored replacement' } },
      { templateId: 'absent', overrides: { id: 'fixture-new-model', name: 'No template' } },
      { templateId: template.id, overrides: { id: 'fixture-new-model', name: 'New model' } },
      { templateId: template.id, overrides: { id: 'fixture-new-model', name: 'Ignored duplicate' } },
    ]
    const catalog = applyCodexContextPolicy(models, createDefaultCodexLlmSettings(), supplements)
    expect(catalog.map(model => model.id)).toEqual(['fixture-new-model', installed.id, template.id])
    expect(catalog[0]?.name).toBe('New model')
    expect(catalog[1]).toBe(installed)
    expect(catalog[2]).toBe(template)
    expect(applyCodexContextPolicy(models, createDefaultCodexLlmSettings(), supplements.slice(0, 2))).toBe(models)
  })

  it.each([false, true])('filters after supplements and context policy with long context %s', longContextEnabled => {
    const models = Object.freeze([Object.freeze(fakeModel('fixture-template'))])
    const before = structuredClone(models)
    const supplements = [{ templateId: 'fixture-template', overrides: {
      id: CODEX_GPT_6_1_SOL_MODEL_ID, name: 'Supplement fixture',
    } }]
    const settings = { ...createDefaultCodexLlmSettings(), 'gpt-6.1-sol': longContextEnabled, serviceTier: 'fast' as const }
    const complete = applyCodexContextPolicy(models, settings, supplements)
    expect(complete[0]?.contextWindow).toBe(
      longContextEnabled ? CODEX_GPT_6_LONG_CONTEXT_WINDOW : CODEX_STANDARD_CONTEXT_WINDOW,
    )
    const catalog = applyCodexContextPolicy(models, {
      ...settings, excludedModelIds: [CODEX_GPT_6_1_SOL_MODEL_ID],
    }, supplements)
    expect(catalog).toEqual(models)
    expect(catalog[0]).toBe(models[0])
    expect(models).toEqual(before)
    expect(applyCodexContextPolicy(models, {
      ...settings, excludedModelIds: complete.map(model => model.id),
    }, supplements)).toEqual([])
  })

  it('preserves every installed descriptor field except opt-in capacity and does not mutate inputs', () => {
    const installed = fakeModel(CODEX_GPT_6_1_SOL_MODEL_ID, {
      name: 'Provider-owned Sol', contextWindow: 300_000, maxTokens: 64_000,
      cost: { input: 7, output: 8, cacheRead: 1, cacheWrite: 2 },
      thinkingLevelMap: { off: null, low: 'low', max: 'max' },
    })
    Object.freeze(installed)
    const models = Object.freeze([installed])
    expect(applyCodexContextPolicy(models, createDefaultCodexLlmSettings(), [])).toBe(models)
    const [long] = applyCodexContextPolicy(models, { ...createDefaultCodexLlmSettings(), 'gpt-6.1-sol': true }, [])
    expect(long).toEqual({ ...installed, contextWindow: CODEX_GPT_6_LONG_CONTEXT_WINDOW })
    expect(installed.contextWindow).toBe(300_000)
    expect(applyCodexContextPolicy(models, createDefaultCodexLlmSettings(), [])[0]).toBe(installed)
  })

  it('applies each long-context budget independently to the known family', () => {
    const gpt54 = fakeModel('gpt-5.4')
    const models = [...CODEX_LONG_CONTEXT_MODEL_IDS.map(id => fakeModel(id)), gpt54]
    const settings = { ...createDefaultCodexLlmSettings(), 'gpt-5.6-sol': true }
    const catalog = applyCodexContextPolicy(models, settings)
    expect(catalog.find(model => model.id === 'gpt-5.6-sol')?.contextWindow).toBe(CODEX_LONG_CONTEXT_WINDOW)
    for (const id of CODEX_LONG_CONTEXT_MODEL_IDS.filter(id => id !== 'gpt-5.6-sol')) {
      expect(catalog.find(model => model.id === id)?.contextWindow).toBe(CODEX_STANDARD_CONTEXT_WINDOW)
    }
    expect(catalog.find(model => model.id === 'gpt-5.4')).toBe(gpt54)
  })

  it('enables GPT-6.1 Sol context independently without mutating provider descriptors', () => {
    const models = CODEX_LONG_CONTEXT_MODEL_IDS.map(id => fakeModel(id))
    const before = structuredClone(models)
    const catalog = applyCodexContextPolicy(models, { ...createDefaultCodexLlmSettings(), 'gpt-6.1-sol': true })
    expect(catalog.find(model => model.id === CODEX_GPT_6_1_SOL_MODEL_ID)?.contextWindow).toBe(CODEX_GPT_6_LONG_CONTEXT_WINDOW)
    for (const id of CODEX_LONG_CONTEXT_MODEL_IDS.filter(id => id !== CODEX_GPT_6_1_SOL_MODEL_ID)) {
      expect(catalog.find(model => model.id === id)?.contextWindow).toBe(CODEX_STANDARD_CONTEXT_WINDOW)
    }
    expect(models).toEqual(before)
  })
})
