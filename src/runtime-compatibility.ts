import semver from 'semver'

/**
 * Accept the 0.2.2 RC line from rc.1 onward plus the 0.2.2 stable release.
 * The upper bound needs the `-0` sentinel because DSH evaluates peer ranges
 * with `includePrerelease`, which would otherwise admit 0.2.3 RCs.
 */
export const SUPPORTED_DSH_PEER_RANGE = '>=0.2.2-rc.1 <0.2.3-0'

/** DSH admission uses `includePrerelease`; runtime guards must agree with it. */
const SEMVER_OPTIONS = { includePrerelease: true } as const

/** Accept any observed runtime package that falls inside the supported range. */
export function areSupportedDshVersions(versions: readonly string[]): boolean {
  return versions.length > 0
    && versions.every(version => semver.satisfies(version, SUPPORTED_DSH_PEER_RANGE, SEMVER_OPTIONS))
}
