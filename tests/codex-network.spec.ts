import { createServer, request as httpRequest, type Server } from 'node:http'
import { connect } from 'node:net'
import { once } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import { getGlobalDispatcher } from 'undici'
import { CodexNetwork } from '../src/codex-network.ts'
import { DEFAULT_NETWORK_SETTINGS, validateNetworkSettings, type CodexNetworkSettings } from '../src/network-settings.ts'
import { liveValue } from '../src/volatile-config.ts'
import { Config } from '../src/index.ts'

const parseConfig = Config as unknown as (value: Record<string, unknown>) => import('../src/index.ts').Config

const cleanups: Array<() => Promise<unknown>> = []
afterEach(async () => { for (const cleanup of cleanups.reverse()) await cleanup(); cleanups.length = 0 })
async function listen(server: Server): Promise<string> {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  cleanups.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) })
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`
}
async function proxy(): Promise<{ url: string; hits: string[] }> {
  const hits: string[] = []
  const sockets = new Set<import('node:stream').Duplex>()
  const server = createServer((req, res) => {
    hits.push(req.url!)
    const upstream = httpRequest(req.url!, { method: req.method, headers: req.headers }, response => {
      res.writeHead(response.statusCode!, response.headers)
      response.pipe(res)
    })
    upstream.on('error', () => { res.destroy() })
    req.pipe(upstream)
    res.on('close', () => upstream.destroy())
  })
  server.on('connect', (req, client, head) => {
    hits.push(req.url!)
    const [host, port] = req.url!.split(':')
    const upstream = connect(Number(port), host, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      upstream.write(head)
      client.pipe(upstream).pipe(client)
    })
    for (const socket of [client, upstream]) {
      sockets.add(socket)
      socket.on('error', () => { client.destroy(); upstream.destroy() })
      socket.on('close', () => sockets.delete(socket))
    }
  })
  const url = await listen(server)
  cleanups.push(async () => { for (const socket of sockets) socket.destroy() })
  return { url, hits }
}

it('defaults to inheritance and rejects unsupported or credential-bearing addresses', () => {
  expect(liveValue(parseConfig({}).network!)).toEqual(DEFAULT_NETWORK_SETTINGS)
  for (const proxyUrl of ['', 'socks5://localhost:1080', 'http://user:password@localhost', 'http://localhost/path', 'http://localhost?x=1', 'http://localhost/#x', 'http://localhost:99999']) {
    expect(() => validateNetworkSettings({ mode: 'custom', proxyUrl })).toThrow()
    expect(() => parseConfig({ network: { mode: 'custom', proxyUrl } })).toThrow()
  }
})

it('isolates custom traffic and pins operation retries across a settings change', async () => {
  const target = await listen(createServer((_req, res) => res.end('ok')))
  const first = await proxy()
  const second = await proxy()
  let settings: CodexNetworkSettings = { mode: 'custom', proxyUrl: first.url }
  const original = getGlobalDispatcher()
  const network = new CodexNetwork(() => settings)
  cleanups.push(() => network.dispose())
  await network.run(async () => {
    expect(await (await network.fetch(target)).text()).toBe('ok')
    settings = { mode: 'custom', proxyUrl: second.url }
    expect(await (await network.fetch(target)).text()).toBe('ok')
    expect(second.hits).toHaveLength(0)
  })
  await Promise.all([
    network.run(async () => expect(await (await network.fetch(target)).text()).toBe('ok')),
    fetch(target).then(response => response.text()),
  ])
  expect(first.hits.length).toBeGreaterThan(0)
  expect(second.hits).toHaveLength(1)
  expect(getGlobalDispatcher()).toBe(original)
  settings = { mode: 'inherit', proxyUrl: second.url }
  expect(await (await network.fetch(target)).text()).toBe('ok')
  expect(second.hits).toHaveLength(1)
})

it('passes inherited fetch unchanged and limits custom environment to a child copy', async () => {
  let settings = DEFAULT_NETWORK_SETTINGS
  const hostFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))
  const network = new CodexNetwork(() => settings, hostFetch)
  cleanups.push(() => network.dispose())
  const init = { headers: { test: 'value' } }
  await network.fetch('https://example.com', init)
  expect(hostFetch).toHaveBeenCalledWith('https://example.com', init)
  expect(network.loginEnvironment()).toBeUndefined()
  const before = { ...process.env }
  settings = { mode: 'custom', proxyUrl: 'http://localhost:7890' }
  const env = network.loginEnvironment()!
  expect(env.HTTP_PROXY).toBe(settings.proxyUrl)
  expect(env.HTTPS_PROXY).toBe(settings.proxyUrl)
  expect(env.NO_PROXY).toBeUndefined()
  expect(env.https_proxy).toBeUndefined()
  expect(process.env).toEqual(before)
})

it('never falls back when the custom proxy fails, and disposes outstanding requests', async () => {
  let hits = 0
  const target = await listen(createServer((_req, res) => { hits++; res.end('unexpected') }))
  const network = new CodexNetwork(() => ({ mode: 'custom', proxyUrl: 'http://127.0.0.1:1' }))
  await expect(network.fetch(target)).rejects.toThrow()
  expect(hits).toBe(0)
  await network.dispose()
  await expect(network.fetch(target)).rejects.toThrow('disposed')
})

it('keeps a response body readable when a new route retires its connection pool', async () => {
  let finish!: () => void
  const target = await listen(createServer((_req, res) => {
    res.writeHead(200)
    res.write('first')
    finish = () => res.end('last')
  }))
  const tunnel = await proxy()
  let settings: CodexNetworkSettings = { mode: 'custom', proxyUrl: tunnel.url }
  const network = new CodexNetwork(() => settings)
  cleanups.push(() => network.dispose())
  const response = await network.fetch(target)
  settings = DEFAULT_NETWORK_SETTINGS
  await network.run(async () => {})
  finish()
  expect(await response.text()).toBe('firstlast')
})

it('honors cancellation of a pending custom request', async () => {
  const received = Promise.withResolvers<void>()
  const target = await listen(createServer(() => received.resolve()))
  const tunnel = await proxy()
  const network = new CodexNetwork(() => ({ mode: 'custom', proxyUrl: tunnel.url }))
  cleanups.push(() => network.dispose())
  const controller = new AbortController()
  const request = network.fetch(target, { signal: controller.signal })
  const rejection = expect(request).rejects.toThrow()
  await received.promise
  controller.abort()
  await rejection
})

it('sends HTTPS through CONNECT and never retries a rejected tunnel directly', async () => {
  const destinations: string[] = []
  const server = createServer()
  server.on('connect', (request, socket) => {
    destinations.push(request.url!)
    socket.end('HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
  })
  const url = await listen(server)
  const network = new CodexNetwork(() => ({ mode: 'custom', proxyUrl: url }))
  cleanups.push(() => network.dispose())
  await expect(network.fetch('https://codex.invalid/example', { signal: AbortSignal.timeout(1000) })).rejects.toThrow()
  expect(destinations).toEqual(['codex.invalid:443'])
})

it('preserves native Request bodies and headers through the proxy', async () => {
  const target = await listen(createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    res.end(JSON.stringify({ method: req.method, marker: req.headers['x-marker'], body: Buffer.concat(chunks).toString() }))
  }))
  const tunnel = await proxy()
  const network = new CodexNetwork(() => ({ mode: 'custom', proxyUrl: tunnel.url }))
  cleanups.push(() => network.dispose())
  const request = new Request(target, { method: 'POST', headers: { 'x-marker': 'synthetic' }, body: 'test payload' })
  expect(await (await network.fetch(request)).json()).toEqual({ method: 'POST', marker: 'synthetic', body: 'test payload' })
})

it('background work created inside an ended operation uses the latest route', async () => {
  const target = await listen(createServer((_req, res) => res.end('ok')))
  const first = await proxy()
  const second = await proxy()
  let settings: CodexNetworkSettings = { mode: 'custom', proxyUrl: first.url }
  const network = new CodexNetwork(() => settings)
  cleanups.push(() => network.dispose())
  const gate = Promise.withResolvers<void>()
  let delayed!: Promise<string>
  await network.run(async () => {
    await (await network.fetch(target)).text()
    delayed = gate.promise.then(async () => (await network.fetch(target)).text())
  })
  settings = { mode: 'custom', proxyUrl: second.url }
  await network.run(async () => {})
  gate.resolve()
  expect(await delayed).toBe('ok')
  expect(second.hits).toHaveLength(1)
})

it.each(['timeout', 'dispose'] as const)('ends pending custom requests on %s', async action => {
  const received = Promise.withResolvers<void>()
  const target = await listen(createServer(() => received.resolve()))
  const tunnel = await proxy()
  const network = new CodexNetwork(() => ({ mode: 'custom', proxyUrl: tunnel.url }))
  cleanups.push(() => network.dispose())
  const request = network.fetch(target, action === 'timeout' ? { signal: AbortSignal.timeout(150) } : undefined)
  const outcome = request.then(() => false, () => true)
  await received.promise
  if (action === 'dispose') await network.dispose()
  expect(await outcome).toBe(true)
})
