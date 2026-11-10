export const ADDRESS_PREFIX = 'dsh-resource://xcode-workbench/session/'

export function workbenchAddress(sessionId: string, cwd: string): string {
  return `${ADDRESS_PREFIX}${encodeURIComponent(sessionId)}/${encodeURIComponent(cwd)}`
}

export function parseWorkbenchAddress(address: string): { sessionId: string; cwd: string } | undefined {
  if (!address.startsWith(ADDRESS_PREFIX)) return undefined
  const [session, cwd, extra] = address.slice(ADDRESS_PREFIX.length).split('/')
  if (!session || !cwd || extra !== undefined) return undefined
  try {
    return { sessionId: decodeURIComponent(session), cwd: decodeURIComponent(cwd) }
  } catch {
    return undefined
  }
}
