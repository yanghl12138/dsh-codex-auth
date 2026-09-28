# Repository Guidelines

## Project Structure & Module Organization

This package adds Codex capabilities to DeepSeek Harness. Host TypeScript lives in `src/`; web settings and React components live in `src/client/` beside their CSS modules. Keep Vitest specs in `tests/`, shared fixtures in `tests/support/`, and live checks in `tests/live/`. Build helpers are in `build/` and `scripts/`; design decisions are in `docs/adr/`. `cordis.patch.yml` wires the plugin into DSH. `lib/` is generated output.

## Build, Test, and Development Commands

Use the Node version in `.node-version` and pnpm 11.7.0. Run `pnpm install --frozen-lockfile` to install dependencies. `pnpm test` runs Vitest; `pnpm run lint` runs oxlint; `pnpm run typecheck` checks host and client TypeScript. `pnpm run build` produces distributable files in `lib/`. Before submitting, run `pnpm run check`, which also checks peers and package compatibility. `pnpm run test:live:native-compaction` requires a local DSH/Codex setup.

## Coding Style & Naming Conventions

Follow existing TypeScript style: two-space indentation, single quotes, no semicolons, and explicit `.ts` extensions in relative imports. Use kebab-case for host modules (`codex-auth-service.ts`), PascalCase for React components (`CodexAuthCard.tsx`), and matching `*.module.css` files for component styles. Keep host credentials and account logic out of client modules. Oxlint and strict TypeScript settings are the enforced style checks; there is no repository-wide formatter script.

## Testing Guidelines

Name regular tests `*.spec.ts` or `*.spec.tsx` under `tests/`; Vitest discovers both. Add focused tests for behavior changes, especially auth, RPC boundaries, and checkpoint handling. Run a single spec with `pnpm exec vitest run tests/codex-auth.spec.ts`. Live tests use `*.live.ts` and are excluded from `pnpm test`. No coverage threshold is configured.

## Commit & Pull Request Guidelines

Recent commits use concise, imperative Conventional Commit subjects such as `feat: add ...`, `fix(compaction): preserve ...`, `docs: add ...`, and `chore: release ...`. Keep each commit scoped to one change. In pull requests, explain the behavior and compatibility impact, link related issues when applicable, and report the checks run. Include screenshots for settings or other UI changes; CI runs `pnpm run check` and packs the release artifact.

## Security & Configuration

The plugin reads Codex CLI login state from the local auth file. Never commit tokens or auth files, and keep token values out of client RPC responses, logs, and test fixtures. Preserve the loopback guard on account-control endpoints when changing authentication or routing code.
