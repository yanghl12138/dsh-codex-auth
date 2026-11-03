/** Live Codex catalog overlay and context-capacity policy owned by the LLM route. */
import type { Api, Model } from '@earendil-works/pi-ai'
import z from '@deepseek-ai/schemastery'

/** Legacy namespace; DSH 0.2 uses the llm-codex-auth entry's Config Form. */
export const CODEX_LLM_SETTINGS_NAMESPACE = 'codex-llm'
/** Context baseline of the pinned pi-ai 1.1.0 long-context models. */
export const CODEX_STANDARD_CONTEXT_WINDOW = 272_000
/** Legacy opt-in budget for the supported GPT-5.6 family. */
export const CODEX_LONG_CONTEXT_WINDOW = 1_000_000
/** GPT-6 Codex OAuth maximum, distinct from public API total-context limits. */
export const CODEX_GPT_6_LONG_CONTEXT_WINDOW = 872_000
/** GPT-6 model ids exposed on the Codex route. */
export const CODEX_GPT_6_ASTRA_MODEL_ID = 'gpt-6-astra'
export const CODEX_GPT_6_SOL_MODEL_ID = 'gpt-6-sol'
export const CODEX_GPT_6_1_SOL_MODEL_ID = 'gpt-6.1-sol'
export const CODEX_GPT_6_1_TERRA_MODEL_ID = 'gpt-6.1-terra'
export const CODEX_GPT_6_LUNA_MODEL_ID = 'gpt-6-luna'

/** Models with a model-specific opt-in long-context budget. */
export const CODEX_LONG_CONTEXT_MODEL_IDS = [
  'gpt-5.6-luna',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  CODEX_GPT_6_ASTRA_MODEL_ID,
  CODEX_GPT_6_SOL_MODEL_ID,
  CODEX_GPT_6_1_SOL_MODEL_ID,
  CODEX_GPT_6_1_TERRA_MODEL_ID,
  CODEX_GPT_6_LUNA_MODEL_ID,
] as const

const LONG_CONTEXT_MODEL_IDS = new Set<string>(CODEX_LONG_CONTEXT_MODEL_IDS)

/** Explicit descriptor overrides for a model missing from the installed catalog. */
export interface CodexModelSupplement {
  readonly templateId: string
  readonly overrides: Pick<Model<Api>, 'id' | 'name'> & Partial<Model<Api>>
}

/**
 * Terra is absent from pi-ai 1.1.0. Transport/image compatibility follows Sol;
 * Codex capacities/reasoning and API cost estimates: docs/codex-model-policy.md.
 */
const CODEX_MODEL_SUPPLEMENTS: readonly CodexModelSupplement[] = [{
  templateId: CODEX_GPT_6_1_SOL_MODEL_ID,
  overrides: {
    id: CODEX_GPT_6_1_TERRA_MODEL_ID,
    name: 'GPT-6.1 Terra',
    contextWindow: 500_000,
    maxTokens: 128_000,
    thinkingLevelMap: {
      off: null, minimal: 'low', low: 'low', medium: 'medium',
      high: 'high', xhigh: 'xhigh', max: 'max',
    },
    cost: {
      input: 1, output: 5, cacheRead: 0.05, cacheWrite: 1.25,
      tiers: [{
        inputTokensAbove: 272_000,
        input: 2, output: 7.5, cacheRead: 0.1, cacheWrite: 2.5,
      }],
    },
  },
}]

/** Codex catalog source and API estimate provenance: docs/codex-model-policy.md. */
export function codexLongContextWindow(modelId: string): number | undefined {
  if (!LONG_CONTEXT_MODEL_IDS.has(modelId)) return undefined
  return modelId.startsWith('gpt-5.6-') ? CODEX_LONG_CONTEXT_WINDOW : CODEX_GPT_6_LONG_CONTEXT_WINDOW
}

/** Request policy labels; Fast uses the compatible `priority` wire value. */
export type CodexServiceTier = 'inherit' | 'default' | 'fast'

/** Live context and request preferences owned by the openai-codex route. */
export type CodexLlmSettings = Record<typeof CODEX_LONG_CONTEXT_MODEL_IDS[number], boolean> & {
  serviceTier: CodexServiceTier
  /** Exact model IDs hidden from this profile's catalog; omission preserves the catalog. */
  excludedModelIds?: string[]
}

export function createDefaultCodexLlmSettings(): CodexLlmSettings {
  return {
    ...Object.fromEntries(CODEX_LONG_CONTEXT_MODEL_IDS.map(id => [id, false])) as Record<typeof CODEX_LONG_CONTEXT_MODEL_IDS[number], boolean>,
    serviceTier: 'inherit',
    excludedModelIds: [],
  }
}

export const CodexLlmSettingsConfig: z<CodexLlmSettings> = z.object({
  ...Object.fromEntries(CODEX_LONG_CONTEXT_MODEL_IDS.map(id => [id, z.boolean().default(false)])) as {
    [K in typeof CODEX_LONG_CONTEXT_MODEL_IDS[number]]: z<boolean>
  },
  serviceTier: z.union([z.const('inherit'), z.const('default'), z.const('fast')]).default('inherit'),
  excludedModelIds: z.array(z.string()).default([]),
})

/**
 * Keep the generated pi-ai catalog intact and apply explicit supplements only
 * when that installed catalog omits them. Enabling Long Context Mode changes
 * only the individually enabled long-context models; every other descriptor
 * and every non-capacity field remains provider-owned. Exact ID exclusions
 * apply last, including to overlay models, without mutating source objects.
 */
export function applyCodexContextPolicy(
  models: readonly Model<Api>[],
  settings: CodexLlmSettings,
  supplements: readonly CodexModelSupplement[] = CODEX_MODEL_SUPPLEMENTS,
): readonly Model<Api>[] {
  const completeCatalog = ensureCodexCatalogModels(models, supplements)
  const catalog = !CODEX_LONG_CONTEXT_MODEL_IDS.some(id => settings[id]) ? completeCatalog : completeCatalog.map(model => {
    const contextWindow = codexLongContextWindow(model.id)
    return contextWindow !== undefined && settings[model.id as typeof CODEX_LONG_CONTEXT_MODEL_IDS[number]]
      ? { ...model, contextWindow }
      : model
  })
  if (!settings.excludedModelIds?.length) return catalog
  const excluded = new Set(settings.excludedModelIds)
  return catalog.filter(model => !excluded.has(model.id))
}

function ensureCodexCatalogModels(
  models: readonly Model<Api>[],
  supplements: readonly CodexModelSupplement[],
): readonly Model<Api>[] {
  if (supplements.length === 0) return models
  const existingIds = new Set(models.map(model => model.id))
  const missing = supplements.flatMap(descriptor => {
    if (existingIds.has(descriptor.overrides.id)) return []
    const template = models.find(model => model.id === descriptor.templateId)
    if (template === undefined) return []
    existingIds.add(descriptor.overrides.id)
    return [{ ...template, ...descriptor.overrides }]
  })
  return missing.length === 0 ? models : [...missing, ...models]
}
