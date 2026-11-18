/** Browser-safe network settings; proxy credentials are deliberately unsupported. */
export interface CodexNetworkSettings {
  mode: 'inherit' | 'custom'
  proxyUrl: string
}

export const DEFAULT_NETWORK_SETTINGS: CodexNetworkSettings = { mode: 'inherit', proxyUrl: '' }

export function validateNetworkSettings(value: CodexNetworkSettings): CodexNetworkSettings {
  if (value.mode !== 'inherit' && value.mode !== 'custom') throw new Error('Invalid network mode')
  const proxyUrl = value.proxyUrl.trim()
  if (proxyUrl || value.mode === 'custom') {
    let url: URL
    try { url = new URL(proxyUrl) } catch { throw new Error('Enter a valid HTTP/HTTPS proxy address') }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname
      || url.username || url.password || url.search || url.hash
      || (url.pathname !== '' && url.pathname !== '/')) {
      throw new Error('Use an HTTP/HTTPS proxy without credentials, path, query or fragment')
    }
  }
  return { mode: value.mode, proxyUrl }
}
