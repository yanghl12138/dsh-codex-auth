# DSH source compatibility verification

Main targets coherent DSH `0.2.2-rc.1` and `0.2.2-rc.2` with pi-ai exactly `1.3.0`.
The `0.2.1` branch retains the pre-upgrade implementation. The development lockfile
and default source target use rc.2. Old runtimes, mixed RC graphs, future RCs and
stable versions are refused without exemptions. Historical verification below
belongs to earlier code and is not evidence for this upgrade.

| DSH | Official tag | Commit |
| --- | --- | --- |
| 0.2.2-rc.1 | `dsh-v0.2.2-rc.1` | `66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db` |
| 0.2.2-rc.2 | `dsh-v0.2.2-rc.2` | `ddac96760b6edf8fa0fe17cbdcf0b512f4c12b2c` |

## Build and verify

Build each graph separately in a scratch directory. Use Node >=24.9.0 and the
upstream pnpm 11.28.5 for official source builds; this plugin uses pnpm 11.7.0.

```sh
git clone --depth 1 --branch dsh-v0.2.2-rc.2 https://github.com/deepseek-ai/deepseek-harness.git harness
cd harness
git rev-parse HEAD
PNPM_CONFIG_MINIMUM_RELEASE_AGE=0 pnpm install --frozen-lockfile --ignore-scripts
pnpm run build:lib
pnpm --filter './packages/**' --filter './vendor/*' -r pack --pack-destination ../dsh-packages
```

From the plugin directory:

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm run check:dsh-source -- /absolute/path/to/dsh-packages /absolute/path/to/harness/patches/@earendil-works__pi-ai@1.3.0.patch
```

Repeat with artifacts built from rc.1 and set `DSH_VERIFY_VERSION=0.2.2-rc.1`
for that source check. Never mix artifact directories. Both tags use patch
SHA-256 `4e1c90fd00aea42989664504668633033c1962e53c07860901edb4f72d843765`.
The patch retains final tool arguments while avoiding repeated partial parsing,
and includes Gemini tool signature preservation.

The runner rejects unknown targets, mixed, missing or duplicate DSH artifacts,
and incorrect patches before installation. It copies the plugin and complete
source dependency closure into a temporary directory, applies the exact Desktop
patch, runs peer checks and the full package gate, and retains an `artifacts.json`
receipt identifying the supplied bytes. Fixed-tag build instructions establish
provenance; the runner does not authenticate arbitrary supplied tarballs. Local
file overrides never enter the main manifest or lockfile.

Model-switch compaction uses the previous committed model to summarize and
capture Native state; Basic prices the proposed destination and owns its
transaction. Old-model turn state is not handed to the destination. Native
failure falls back to Portable. V4 sessions and checkpoint codec v1 remain
unchanged; old checkpoints replay only when final request semantics match.

中文：主分支仅适配 0.2.2-rc.1 / rc.2 与 pi-ai 1.3.0；旧代码保存在
`0.2.1` 分支。两个 RC 必须分别验证完整依赖图。源码检查使用准确的 Desktop
补丁、保留制品回执，不修改现用 profile。离线检查不证明真实 OAuth、私有
模型/搜索/图片后端或已安装 Desktop 的可用性。

## 0.2.2 verification record

Verified on 2026-11-13, Linux x64. Plugin checks used Node `22.22.2`, pnpm
`11.7.0` and complete npm `11.16.0`. Official artifact builds used Node `24.18.0`
and upstream pnpm `11.28.5`. The main frozen install passed with the rc.2 registry
lockfile; no source paths or overrides enter that lockfile.

| Graph | Selected source packages | Tests | Complete `pnpm run check` |
| --- | --- | --- | --- |
| rc.2 registry baseline | — | 538 / 538 | Passed |
| rc.1 official source | 99 | 538 / 538 | Passed |
| rc.2 official source | 100 | 538 / 538 | Passed |

The complete gate includes peer checks, lint, Host/client type checks, Vitest,
builds, packed-artifact smoke and publint. Both final `check:dsh-source` commands
passed end to end. Both graphs use the pi-ai 1.3.0 Desktop patch identified above.
The regressions cover model-switch Native success and summary failure, previous
model preservation, turn-state isolation, old V4 restore/fork/continuation,
Native/Portable replay, request transports, image tools, account RPC and search
readiness. rc.1 keeps developer tool declarations in history, whereas rc.2 can
project them into current tools; tests verify declaration retention and Portable
fallback in both representations. Leading system heads remain eligible for
matching Native replay; in-history instructions and tool-history updates remain
Portable before conversion can erase those distinctions.

The unrestricted upstream workspace build exceeded available memory (exit 137).
The retained artifacts were subsequently built from unmodified official tag
sources using the original per-package TypeScript and tsdown configurations,
with the complete plugin dependency/peer closure selected by package-directory
filters. Host bundling ran in batches of six, followed by Client bundling and
packing. Typert metadata and the generator build plugin were compiled first.
This validates the required Host/Client libraries, not a full Desktop application.
The temporary build harness and detailed commands remain at
`/tmp/dsh-build-022-source.py`, with logs `/tmp/dsh-022rc1-serial-final.log` and
`/tmp/dsh-022rc2-serial.log`. Source installation used frozen upstream lockfiles.

Temporary-directory quota failures were resolved by using a separate cache on
disk. A repeat check can set `TMPDIR` to an existing writable scratch directory
outside this repository and any live DSH installation. Failed preliminary runs
are not counted as passing gates.

| DSH | Retained receipt | Receipt SHA-256 |
| --- | --- | --- |
| rc.1 | `$HOME/.cache/dsh-source-verification/dsh-codex-auth-dsh-source-AShaSc/artifacts.json` | `107ac4068649e567870e31c44c2d004dd2cafc9f5406c57b9a9138bbb43f0f4c` |
| rc.2 | `$HOME/.cache/dsh-source-verification/dsh-codex-auth-dsh-source-CF2aRO/artifacts.json` | `9d1f3df98ecb8e1997c8bb2914cc49da7f483777dc61fff826834c662d346427` |

Official tag archive SHA-256: rc.1 =
`416750920b64272899259c26b2fa0a4341132c9c19b43337da502ab7ebd599f1`;
rc.2 = `d376fe64ec4b7c9b5837fb1155ed3a48e7e0e5f5b0aae0b91d9fb836daa8c20e`.
Final logs are `/tmp/dsh-022-node22-check-final.log`,
`/tmp/dsh-022rc1-source-final.log` and `/tmp/dsh-022rc2-source-final.log`.
The `0.2.1` branch remains at `1c58ad32d5d0be49b4a14bae77ac1b8893568753`.
No npm version/tag, installed profile, login file or checkpoint bytes were changed.
Live OAuth, private backend availability and installed Desktop UI remain unverified.

## RC4 / RC5 verification record

The workspace adds rc.4 and rc.5 to the finite compatibility set. Official inputs:

| DSH | Official source tag | Commit |
| --- | --- | --- |
| 0.2.1-rc.4 | `dsh-v0.2.1-rc.4` | `504a01a9578abc2c6f1fb896b1dc322c9fe24f66` |
| 0.2.1-rc.5 | `dsh-v0.2.1-rc.5` | `b830ec950faba0a46dda564be3e2d854afed94f1` |

Comparing the complete rc.3 and rc.5 source archives finds identical source files in Agent, Compaction, Basic compaction, Token Meter, LLM, the pi-ai adapter, and Session. The upstream lockfile and pi-ai 1.1.0 Desktop patch are unchanged. The reasoning Body Slot change is confined to client display (`rawText` preserves original output; `text` is display-ready); this plugin does not contribute to that Slot. No checkpoint migration or codec change is required by these source differences.

The updated regressions cover all five coherent graphs, all 20 ordered mixed LLM/adapter pairs on the wire, rc.4/rc.5 rejection by the frozen released manifest, and future RC/stable refusal. Earlier rc.3 results remain historical evidence only; the current verification uses Node `22.22.2`, plugin pnpm `11.7.0`, and upstream pnpm `11.28.5` on Linux x64.

Verified on 2026-11-02. The rc.1 frozen install and complete gate passed with the unchanged main lockfile. Each source graph was built and packed separately from its pinned official archive; both Host and Client library builds passed.

| DSH | Dependency graph | Tests | Complete `pnpm run check` |
| --- | --- | --- | --- |
| 0.2.1-rc.1 | Registry baseline | 526 / 526 | Passed |
| 0.2.1-rc.4 | Official source, 97 packages | 526 / 526 | Passed |
| 0.2.1-rc.5 | Official source, 97 packages | 526 / 526 | Passed |

The complete gate includes peers, lint, Host/client type checks, Vitest, builds, packed-artifact smoke, and publint. rc.4 sets `DSH_VERIFY_VERSION=0.2.1-rc.4`; rc.5 uses the default source target. Both isolated graphs apply the unchanged Desktop pi-ai patch with SHA-256 `66eaf960054f10441b93ac3857114e96c1901f6d183713e2f21437b007111644`.

| DSH | Retained receipt under `/tmp` | Receipt SHA-256 |
| --- | --- | --- |
| 0.2.1-rc.4 | `dsh-codex-auth-dsh-source-O5BwJj/artifacts.json` | `931feb96c11cfbe2e8d3ae09250db0e8dcf94f230a1a838d7a0cd5f8f8b590e9` |
| 0.2.1-rc.5 | `dsh-codex-auth-dsh-source-na8vw1/artifacts.json` | `98f56c1a3fc2d8ca6c891698628bd3e08fe3b9523eebf9abe6e88a0681bbc88c` |

The downloaded official tag archives have SHA-256 `27ad476ccbd4d0829475fdea5a71c39a5dda0eaffcd1b6406203fed937e07fde` (rc.4) and `b1c6de73088f79ede05b316f42d060057d04a8c40d149f4c8d6315c256497b26` (rc.5). Archive builds set `DSH_CLIENT_COMMIT_HASH` to the matching full commit. Temporary receipts and logs are local evidence, not published package contents.

An initial baseline run hit the existing 5-second timeout in one dual-checkpoint test during concurrent dependency installation. Its separate 73-test suite and the subsequent complete baseline gate passed without test timeout changes. Source builds were completed sequentially after concurrent builds caused memory pressure.

中文：本次将 rc.4/rc.5 加入有限兼容集合，不写入版本豁免。核心压缩、转换、会话源码及 pi-ai 补丁未变；保持 rc.1 主锁文件、V4 会话和 checkpoint codec v1。rc.1 基线及 rc.4/rc.5 官方源码图均通过完整检查，各 526 项测试成功。真实 OAuth、私有后端和已安装 Desktop 不属于离线检查的验证范围。

## RC3 verification record

Verified on Windows x64 on 2026-10-27. All plugin checks used Node `22.22.2` and pnpm `11.7.0`. Official source library builds used the upstream repository's declared pnpm `11.28.5`; no upstream package source was changed.

| DSH | Dependency graph | Tests | Complete `pnpm run check` |
| --- | --- | --- | --- |
| 0.2.1-rc.1 | Registry baseline | 502 / 502 | Passed |
| 0.2.1-rc.2 | Official source, 97 packages | 502 / 502 | Passed |
| 0.2.1-rc.3 | Official source, 97 packages | 502 / 502 | Passed |

The complete gate includes peer checks, oxlint, Host/client type checking, Vitest, Host/client builds, packed-artifact smoke, and publint. The rc.2/rc.3 checks use `pnpm run check:dsh-source` with their respective packed official dependency closures and the Desktop pi-ai patch. rc.2 explicitly sets `DSH_VERIFY_VERSION=0.2.1-rc.2`; rc.3 explicitly sets `DSH_VERIFY_VERSION=0.2.1-rc.3`. Both source graphs contain 97 packages, all DSH packages at the selected version, with pi-ai exactly `1.1.0` and patch SHA-256 `66eaf960054f10441b93ac3857114e96c1901f6d183713e2f21437b007111644`.

Official inputs: rc.2 at `687f282e8625c6b8d11ff58211a90524be2e4317`; rc.3 at `1f81c047fc48fa190a683e469daa699857e9afe8`. The commit archives have SHA-256 `157903b22c2881d3678d846755afe957a48df834e747deda805a1195ce25a146` and `fc671f856222bef95c7f6bd65b5adfb6c09770ffd5b1f3f61b7b1e1cbe582c60`, respectively. When building an archive without Git metadata, set `DSH_CLIENT_COMMIT_HASH` to that archive's full official commit before the Desktop bundle step. Host and Client libraries were built for each graph.

The regression suite exercises the frozen pre-adaptation manifest's three-peer rc.3 refusal, all adapted bundle rows without exemptions, all ordered mixed-RC pairs, Portable-only wire payloads for mixed replay runtimes, unknown prerelease/stable refusal, old V4 restore/fork/continuation, dual checkpoints, static model discovery, account RPC, settings, and image-tool rendering. Windows verification also fixes platform-dependent path assertions and launches npm/pnpm through executable entrypoints. The main manifest keeps its existing package version and rc.1 development dependencies; `pnpm install --frozen-lockfile` succeeds with the unchanged main lockfile, whose root dependency specifiers already pin the duplicated peers to rc.1. No lockfile resolution was upgraded.

Logs and source inputs remain under `$TEMP/dsh-rc3-verification/` (`rc1-check.log`, `rc2-plugin-check.log`, `rc3-plugin-check.log`, source build/pack logs, archives, and tarballs). The isolated checkouts and complete per-package SHA-512 receipts remain at the following paths relative to `$TEMP`:

| DSH | Receipt | Receipt SHA-256 |
| --- | --- | --- |
| 0.2.1-rc.2 | `dsh-codex-auth-dsh-source-fnvHnu/artifacts.json` | `bc456b45ee339a20f959befd5e95c68c57aa89a349b44efa42ffa1e1e54e4e25` |
| 0.2.1-rc.3 | `dsh-codex-auth-dsh-source-U5OyXj/artifacts.json` | `abde052c3896cf07b6b17eeec1b8874d7c864b8493c4e88bfb9d1a1a94f76220` |

These results cover offline compatibility of the Unreleased workspace. No npm release was published, no version exemption was granted, and no installed DSH profile was changed. Live OAuth, private model/search/image requests, and rendered installed Desktop behavior were not exercised.

中文：rc.1 主依赖图与 rc.2/rc.3 隔离源码依赖图均通过完整检查，各 502 项测试全部通过。三版本混装继续被拒绝或使用既有 Portable 回退；主锁文件、包版本、V4 会话和 checkpoint 格式保持原状。上述记录属于 Unreleased 工作区的离线验证，不代表已发布 npm 包或真实后端联调。

## Upgrade from DSH 0.2.0-rc.2

The previous source tag is `dsh-v0.2.0-rc.2` at `639ed015397290b3745d163aafe02ffee4aa3f84`; the target is `dsh-v0.2.1-rc.1` at `1600d8a1e140dcde43a1a0941940a0480712c011`. The graph uses Cordis 4.0.5, Schemastery 3.18.5, and pi-ai 1.1.0. Three exact optional peers still prevent the released rc.4 bundle from loading on the new Host. No compatibility exemption is added: 0.3.4-rc.1 declares and checks the new coherent graph, rejects old/mixed experimental graphs, and leaves npm `latest` and `alpha` unchanged.

DSH removed the runtime invariant registry and companions. This package removes `@deepseek-ai/dsh-invariants` and the `dsh-codex-auth/invariant` export; remove any user-authored rows naming those modules. The normal three-row bundle never mounted them. Account routes now pass `browserPeer`, remain on Connection's owner-authenticated exact routes, and retain the explicit loopback-only guard. Settings tests use Config Forms without the removed `mode`, and stock image-tool fixtures use the current PartialArguments/phase contract.

Unlike the new generic PiAiAdapter, the Codex route keeps its existing static catalog policy: listing models does not resolve or refresh Login State. That avoids an empty cached catalog before login and preserves per-profile exclusion edits without authentication side effects. Real requests still resolve credentials through the single Host coordinator and fail with `MISSING_CREDENTIAL` when needed; listing is not evidence of account access.

The Session header remains V4 and Basic's compaction transaction is unchanged. Frozen synthetic fixtures from both 0.2.0 release candidates restore, fork and continue without rewriting native blocks. A fixture produced using the released rc.2 Session and codec is also replayed through the target adapter. Leading-system conversion changes are covered by the final instructions digest. The existing v1 digest does not model in-history instruction/tool availability updates, so final inputs containing system/developer messages, `additional_tools`, `tool_search_call` or `tool_search_output` stay Portable for both new creation and replay. This is a safety fallback, not a checkpoint migration or a downgrade guarantee.

The registry gate and source-artifact gate are separate. The source gate applies the pi-ai patch used by Desktop, rather than claiming unpatched npm bytes are the exact Desktop runtime. All account, settings, session and provider cases here use temporary synthetic fixtures or mocked transport. Installed Desktop replacement/restart, real profiles, OAuth, and live model/search/image backend operations remain unverified by these offline checks.

### 中文：0.2.0-rc.2 → 0.2.1-rc.1

0.3.4-rc.1 对齐完整新依赖图，不增加兼容性豁免，不更新稳定 `latest` 或 `alpha`。删除已退役的 invariant 模块；若自定义配置曾引用它们，应删除相关行。认证仍通过 Connection 的所有者认证路由和明确 loopback 限制。模型目录保持静态可见，不因打开选择器而读取或刷新登录态；真正请求仍须通过认证。

保留 V4 会话与 Native codec v1，验证旧合成会话恢复、分叉、继续和回放，不改写持久状态。旧 digest 无法表达的工具搜索及会话中指令更新使用 Portable 回退。源码检查明确应用 Desktop 的 pi-ai 补丁并记录哈希；这些离线证据不等于已安装桌面端、真实 OAuth 或私有后端实测。

## Upgrade from DSH 0.2.0-rc.1

The official tags are `dsh-v0.2.0-rc.1` at `4878cdabd87d4041bdaff61d04c966883b9fd07a` and `dsh-v0.2.0-rc.2` at `639ed015397290b3745d163aafe02ffee4aa3f84`. The relevant upstream change is pi-ai `0.85.1` → `0.87.1`, including catalog metadata and final Responses payload defaults. The Session header stays V4; core Session, JSONL persistence, credentials, settings, storage implementations, and profile compatibility readers are unchanged between these tags. A new qualified user-question reply source is recorded as a same-version extension; existing logs remain valid. This is forward-read evidence, not a downgrade guarantee for new rc.2 events.

The published `dsh-codex-auth@0.3.3-rc.2` declares three exact rc.1 peers: compaction, Basic compaction, and token-meter. DSH evaluates optional declared peers too, so upgrading the Host alone denies all three bundle rows before plugin import: authentication/LLM, Search, and Image. An rc.1 exemption does not authorize rc.2. Version `0.3.3-rc.3` updates the complete graph and exact gates instead of granting an exemption; it accepts rc.2 with pi-ai 0.87.1 and refuses mixed graphs, rc.1, or another pi-ai version. It uses the npm `rc` channel; the stable `latest` channel retains the previous stable release.

Desktop rc.2 also supplies its own CLI carrier for plugin management of the reserved Desktop profile and imports the macOS login-shell environment. An older npm `dsh` command may still exist on PATH; check `dsh --version` and use the intended rc.2 installation before managing a profile. These launcher changes are inspected in source, not exercised against the installed Desktop.

The synthetic regression in `tests/dsh-upgrade.spec.ts` invokes the real app-boot admission functions on temporary profile manifests and permissions. It verifies old-row denial, adapted-row admission without a grant, and unchanged synthetic configuration/login files. Its committed V4 fixture was produced by Session from the official rc.1 source build and the existing plugin codec; it contains only synthetic text and native state. The rc.2 Session implementation restores and forks that fixture, appends a new turn, and preserves both checkpoint representations. The Native replay regression separately proves that an old digest with omitted reasoning continues through Portable when pi-ai 0.87.1 sends explicit `reasoning: { effort: 'none' }`. Compatible newly captured Native checkpoints still replay through the offline provider tests. Codec/schema generations and durable bytes are not rewritten to force a match.

Run the complete package gate, including these regressions:

```sh
pnpm install --frozen-lockfile
pnpm run check
```

Run `check:dsh-source` with artifacts built from the pinned rc.2 tag to repeat the gate against the official source dependency graph. These checks never start the installed Desktop, load a real profile, or resolve live account credentials. Desktop application replacement/restart, actual persisted user logs, live OAuth, and provider availability remain unverified.

### 中文：rc.1 → rc.2

官方 tag 分别是上述 rc.1 / rc.2 提交。相关运行差异包括 pi-ai 升至 0.87.1、模型目录元数据和最终 Responses 载荷默认值；Session 头仍为 V4，会话持久化、凭据、设置、存储和 profile 版本豁免读取实现没有变化。新 user-question reply 来源被上游声明为同版本扩展，既有日志仍有效；这不证明 rc.2 新事件可降级读取。

Desktop rc.2 还新增自带的 CLI 管理入口，并读取 macOS login-shell 环境。旧 npm `dsh` 可能仍在 PATH 中，管理 profile 前应核对 `dsh --version`；本次未在已安装 Desktop 上验证这些启动器行为。

只升级 Host 会让已发布插件的三个精确 rc.1 peer 不匹配，即使这些 peer 标记 optional，DSH 仍会在 import 前拒绝认证/LLM、搜索、图片三条 bundle 行。旧 rc.1 豁免不会延续到 rc.2。`0.3.3-rc.3` 升级完整依赖图和精确运行门控，不增加豁免；使用 npm `rc` 预发布渠道，`latest` 保留既有稳定版本。合成 profile 回归确认旧行被拒绝、新行无需豁免即可准入，合成配置和登录文件保持原字节；rc.1 生成的 V4 Dual Checkpoint 可以恢复、分叉并继续。旧 Native digest 因 reasoning 默认值变化不匹配时，会使用 Portable 文本，不改写旧 checkpoint。所有这些证据均来自隔离、离线检查，不是本机 Desktop 实际升级成功。

## 2026-10-17 verification record

- Plugin candidate: `0.3.4-rc.1`; Node `24.19.0`, project pnpm `11.7.0`.
- Frozen registry install and complete `pnpm run check`: 24 test files, 441 tests; peer checks, lint, Host/client type checks, build, packaged-artifact smoke and publint passed.
- Official source at `1600d8a1e140dcde43a1a0941940a0480712c011`: Host/client library build and package packing passed. The isolated plugin check selected 97 source closure artifacts, recorded their SHA-512 hashes, and applied the verified pi-ai patch above. The same complete gate and 441 tests passed there.
- Final account-route coverage checks unauthenticated and untrusted-origin denial, non-owner Peer denial before the delegate, owner `browserPeer` forwarding, malformed requests, route disposal, and the retained loopback guard.
- Image row lifecycle regressions use real Cordis plugin fibers and deferred Login State completion: active refreshes continue, while late initial-status and watcher callbacks no longer touch disposed services. Both new cases failed before the lifecycle guard and pass with it.
- These results do not establish installed Electron/Desktop behavior, live OAuth, or live model, search and image backend availability.


## 0.3.4-rc.2: rc.1 / rc.2 compatibility matrix

The installed Desktop may auto-update independently of a plugin release. The published 0.3.4-rc.1 package correctly remains the immutable rc.1-only artifact; its three exact optional peers are checked before installation and deny rc.2. Changing only peer metadata would still leave the Native replay and compaction gates refusing rc.2.

Released `0.3.4-rc.2` declares the finite semver union `0.2.1-rc.1 || 0.2.1-rc.2` for those three peers and the same supported runtime set internally. The Host uses `semver.satisfies` with `includePrerelease: true`; explicit alternatives avoid accidentally admitting rc.1.1, rc.2.1, rc.3, stable 0.2.1, or another minor release. Every experimental runtime package must still belong to one identical supported graph, and pi-ai must still be exactly 1.1.0. No `engines.dsh` override or compatibility exemption bypasses peer checks.

Official tags: rc.1 = `1600d8a1e140dcde43a1a0941940a0480712c011`; rc.2 = `687f282e8625c6b8d11ff58211a90524be2e4317`. Comparing the 72 referenced Host/client/development packages finds source changes only in dsh-web: search/fetch configuration becomes volatile and is read for each request. Session, Basic compaction, token meter, LLM/pi-ai conversion, account RPC, plugin admission, Cordis and the exact pi-ai patch are unchanged. rc.2 also adds official DeepSeek search/fetch providers and display/settings plugins. Codex continues using the stock Web registration interface and the bundle's explicit provider selection; tests construct WebRuntime through its own Config schema so both contracts are exercised correctly.

The complete package gate must pass separately on rc.1 and rc.2. For a packed official-source graph, set `DSH_VERIFY_VERSION=0.2.1-rc.1` to select the old pinned source identity, or set `DSH_VERIFY_VERSION=0.2.1-rc.2` for the rc.2 source target (the current default is rc.5). Do not mix source artifacts. Registry baseline scripts default to rc.1; alternate graph checks set `DSH_VERIFY_VERSION=0.2.1-rc.2` and install the complete rc.2 development closure in an isolated checkout.

Version `0.3.4-rc.2` carries this compatibility update on the npm `rc` channel and GitHub prerelease channel. Installation and offline Host checks do not establish rendered Desktop UI, live OAuth, model, search backend or image-generation behavior.


Real profile loading also exposes a pre-existing metadata lookup defect: Node's `findPackageJSON` on a bare specifier uses the built-in resolver, rather than the DSH installation/profile interception. The reader now resolves the ESM entry first and then locates its package metadata; a custom-resolver, import-only package fixture and both actual Host loaders cover this distinction. The strict coherent-graph and exact pi-ai guard remain intact. See [Node's resolver caveat](https://nodejs.org/api/module.html#modulefindpackagejsonspecifier-base).

The local installation matrix uses the official `initProfile` output, including `nodeLinker: hoisted` and `autoInstallPeers: false`, then the real `dsh plugin add` command. Omitting that generated configuration creates an invalid test environment with pnpm-injected duplicate Host dependencies; successful admission in such a directory alone is not runtime compatibility evidence. The valid matrix checks the imported pi-ai and Basic engine against the actual Host modules, normal teardown, and immediate unload. rc.2 uses the installed Desktop carrier; rc.1 uses the official isolated CLI graph with the exact Desktop pi-ai 1.1.0 patch. No live credentials, provider requests, or user profile changes are involved.
