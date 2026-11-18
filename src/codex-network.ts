import { AsyncLocalStorage } from 'node:async_hooks'
import { ProxyAgent, fetch as proxyFetch } from 'undici'
import { validateNetworkSettings, type CodexNetworkSettings } from './network-settings.ts'

interface Route {
  key: string
  custom: boolean
  agent?: ProxyAgent
  users: number
  retired: boolean
  closing?: boolean
}

interface OperationScope {
  route: Route
  active: boolean
}

/** Owns only this plugin's connections. Async scopes pin retries to one route. */
export class CodexNetwork {
  private readonly scope = new AsyncLocalStorage<OperationScope>()
  private current?: Route
  private readonly routes = new Set<Route>()
  private disposed = false

  constructor(private readonly settings: () => CodexNetworkSettings, private readonly hostFetch: typeof fetch = fetch) {}

  private acquire(): Route {
    if (this.disposed) throw new Error('Codex network is disposed')
    const inherited = this.scope.getStore()
    if (inherited?.active) { inherited.route.users++; return inherited.route }
    const settings = validateNetworkSettings(this.settings())
    const key = settings.mode === 'custom' ? settings.proxyUrl : 'inherit'
    if (this.current?.key !== key) {
      const previous = this.current
      this.current = {
        key, custom: settings.mode === 'custom', users: 0, retired: false,
        ...(settings.mode === 'custom' ? { agent: new ProxyAgent(settings.proxyUrl) } : {}),
      }
      this.routes.add(this.current)
      if (previous) { previous.retired = true; this.closeRetired(previous) }
    }
    this.current.users++
    return this.current
  }

  private closeRetired(route: Route): void {
    if (!route.retired || route.users !== 0 || route.closing) return
    route.closing = true
    // close drains response bodies; it does not interrupt a live stream.
    if (route.agent) void route.agent.close().catch(() => {}).finally(() => { this.routes.delete(route) })
    else this.routes.delete(route)
  }

  private release(route: Route): void { route.users--; this.closeRetired(route) }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const route = this.acquire()
    const scope = { route, active: true }
    try { return await this.scope.run(scope, operation) }
    finally { scope.active = false; this.release(route) }
  }

  stream<T extends { result(): Promise<unknown> }>(operation: (custom: boolean) => T): T {
    const route = this.acquire()
    const scope = { route, active: true }
    const release = (): void => { scope.active = false; this.release(route) }
    try {
      const stream = this.scope.run(scope, () => operation(route.custom))
      void stream.result().then(release, release)
      return stream
    } catch (error) { release(); throw error }
  }

  readonly fetch: typeof fetch = async (input, init) => {
    const route = this.acquire()
    try {
      if (!route.agent) return await this.hostFetch(input, init)
      // Undici 8 dispatchers require its own fetch handler protocol; Node 22's
      // bundled fetch uses an older protocol. Normalize through a native Request
      // to preserve native FormData / Request inputs without mixing constructors.
      const request = new Request(input, init)
      return await proxyFetch(request.url, {
        method: request.method,
        headers: [...request.headers],
        body: request.body,
        duplex: 'half',
        signal: request.signal,
        redirect: request.redirect,
        credentials: request.credentials,
        cache: request.cache,
        mode: request.mode,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
        integrity: request.integrity,
        keepalive: request.keepalive,
        dispatcher: route.agent,
      }) as unknown as Response
    } finally { this.release(route) }
  }

  loginEnvironment(): NodeJS.ProcessEnv | undefined {
    const settings = validateNetworkSettings(this.settings())
    if (settings.mode === 'inherit') return undefined
    const env = { ...process.env }
    for (const key of Object.keys(env)) {
      if (['http_proxy', 'https_proxy', 'all_proxy', 'no_proxy'].includes(key.toLowerCase())) delete env[key]
    }
    return { ...env, HTTP_PROXY: settings.proxyUrl, HTTPS_PROXY: settings.proxyUrl }
  }

  async dispose(): Promise<void> {
    this.disposed = true
    await Promise.all([...this.routes].map(route => route.agent?.destroy()))
    this.routes.clear()
  }
}
