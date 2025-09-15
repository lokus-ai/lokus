/**
 * Semantic Versioning Utilities
 * Comprehensive semver implementation for plugin version management
 */

/**
 * Version comparison constants
 */
export const VERSION_COMPARE = {
  LESS: -1,
  EQUAL: 0,
  GREATER: 1
}

/**
 * Version range operators
 */
export const RANGE_OPERATORS = {
  EXACT: '=',
  GREATER: '>',
  GREATER_EQUAL: '>=',
  LESS: '<',
  LESS_EQUAL: '<=',
  TILDE: '~',     // Patch-level changes
  CARET: '^',     // Compatible changes
  WILDCARD: '*'   // Any version
}

/**
 * Version parts
 */
export const VERSION_PARTS = {
  MAJOR: 'major',
  MINOR: 'minor',
  PATCH: 'patch',
  PRERELEASE: 'prerelease',
  BUILD: 'build'
}

/**
 * Semver validation regex
 */
const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

/**
 * Range validation regex
 */
const RANGE_REGEX = /^([\^~>=<]*)(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

/**
 * Parse a semantic version string
 */
export function parseVersion(version) {
  if (!version || typeof version !== 'string') {
    throw new Error('Version must be a non-empty string')
  }

  const match = version.match(SEMVER_REGEX)
  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`)
  }

  const [, major, minor, patch, prerelease, build] = match

  return {
    raw: version,
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    prerelease: prerelease ? prerelease.split('.') : null,
    build: build ? build.split('.') : null,
    version: `${major}.${minor}.${patch}`,
    toString() {
      let result = this.version
      if (this.prerelease) result += `-${this.prerelease.join('.')}`
      if (this.build) result += `+${this.build.join('.')}`
      return result
    }
  }
}

/**
 * Parse a version range string
 */
export function parseRange(range) {
  if (!range || typeof range !== 'string') {
    throw new Error('Range must be a non-empty string')
  }

  // Handle wildcard
  if (range === '*' || range === 'x' || range === 'X') {
    return {
      operator: RANGE_OPERATORS.WILDCARD,
      version: null,
      raw: range
    }
  }

  // Handle simple version (exact match)
  if (SEMVER_REGEX.test(range)) {
    return {
      operator: RANGE_OPERATORS.EXACT,
      version: parseVersion(range),
      raw: range
    }
  }

  const match = range.match(RANGE_REGEX)
  if (!match) {
    throw new Error(`Invalid version range: ${range}`)
  }

  const [, operators, major, minor, patch, prerelease, build] = match
  const versionStr = `${major}.${minor}.${patch}${prerelease ? `-${prerelease}` : ''}${build ? `+${build}` : ''}`
  
  // Determine operator (use the last one if multiple)
  let operator = RANGE_OPERATORS.EXACT
  if (operators) {
    if (operators.includes('^')) operator = RANGE_OPERATORS.CARET
    else if (operators.includes('~')) operator = RANGE_OPERATORS.TILDE
    else if (operators.includes('>=')) operator = RANGE_OPERATORS.GREATER_EQUAL
    else if (operators.includes('<=')) operator = RANGE_OPERATORS.LESS_EQUAL
    else if (operators.includes('>')) operator = RANGE_OPERATORS.GREATER
    else if (operators.includes('<')) operator = RANGE_OPERATORS.LESS
  }

  return {
    operator,
    version: parseVersion(versionStr),
    raw: range
  }
}

/**
 * Compare two versions
 */
export function compareVersions(v1, v2) {
  const version1 = typeof v1 === 'string' ? parseVersion(v1) : v1
  const version2 = typeof v2 === 'string' ? parseVersion(v2) : v2

  // Compare major, minor, patch
  if (version1.major !== version2.major) {
    return version1.major > version2.major ? VERSION_COMPARE.GREATER : VERSION_COMPARE.LESS
  }

  if (version1.minor !== version2.minor) {
    return version1.minor > version2.minor ? VERSION_COMPARE.GREATER : VERSION_COMPARE.LESS
  }

  if (version1.patch !== version2.patch) {
    return version1.patch > version2.patch ? VERSION_COMPARE.GREATER : VERSION_COMPARE.LESS
  }

  // Compare prerelease
  if (version1.prerelease && version2.prerelease) {
    return comparePrereleaseVersions(version1.prerelease, version2.prerelease)
  }

  // Version without prerelease is greater than version with prerelease
  if (version1.prerelease && !version2.prerelease) {
    return VERSION_COMPARE.LESS
  }
  
  if (!version1.prerelease && version2.prerelease) {
    return VERSION_COMPARE.GREATER
  }

  return VERSION_COMPARE.EQUAL
}

/**
 * Compare prerelease versions
 */
function comparePrereleaseVersions(pre1, pre2) {
  const maxLength = Math.max(pre1.length, pre2.length)
  
  for (let i = 0; i < maxLength; i++) {
    const part1 = pre1[i]
    const part2 = pre2[i]
    
    // If one is undefined, the defined one is greater
    if (part1 === undefined) return VERSION_COMPARE.LESS
    if (part2 === undefined) return VERSION_COMPARE.GREATER
    
    // If both are numeric, compare numerically
    const num1 = parseInt(part1, 10)
    const num2 = parseInt(part2, 10)
    
    if (!isNaN(num1) && !isNaN(num2)) {
      if (num1 !== num2) {
        return num1 > num2 ? VERSION_COMPARE.GREATER : VERSION_COMPARE.LESS
      }
    } else {
      // String comparison
      if (part1 !== part2) {
        return part1 > part2 ? VERSION_COMPARE.GREATER : VERSION_COMPARE.LESS
      }
    }
  }
  
  return VERSION_COMPARE.EQUAL
}

/**
 * Check if a version satisfies a range
 */
export function satisfiesRange(version, range) {
  const v = typeof version === 'string' ? parseVersion(version) : version
  const r = typeof range === 'string' ? parseRange(range) : range

  switch (r.operator) {
    case RANGE_OPERATORS.WILDCARD:
      return true

    case RANGE_OPERATORS.EXACT:
      return compareVersions(v, r.version) === VERSION_COMPARE.EQUAL

    case RANGE_OPERATORS.GREATER:
      return compareVersions(v, r.version) === VERSION_COMPARE.GREATER

    case RANGE_OPERATORS.GREATER_EQUAL:
      const cmp = compareVersions(v, r.version)
      return cmp === VERSION_COMPARE.GREATER || cmp === VERSION_COMPARE.EQUAL

    case RANGE_OPERATORS.LESS:
      return compareVersions(v, r.version) === VERSION_COMPARE.LESS

    case RANGE_OPERATORS.LESS_EQUAL:
      const cmp2 = compareVersions(v, r.version)
      return cmp2 === VERSION_COMPARE.LESS || cmp2 === VERSION_COMPARE.EQUAL

    case RANGE_OPERATORS.TILDE:
      return satisfiesTildeRange(v, r.version)

    case RANGE_OPERATORS.CARET:
      return satisfiesCaretRange(v, r.version)

    default:
      return false
  }
}

/**
 * Check if version satisfies tilde range (~x.y.z)
 * Allows patch-level changes if a minor version is specified
 */
function satisfiesTildeRange(version, rangeVersion) {
  if (version.major !== rangeVersion.major || version.minor !== rangeVersion.minor) {
    return false
  }
  
  return compareVersions(version, rangeVersion) >= VERSION_COMPARE.EQUAL
}

/**
 * Check if version satisfies caret range (^x.y.z)
 * Allows changes that do not modify the left-most non-zero digit
 */
function satisfiesCaretRange(version, rangeVersion) {
  if (version.major !== rangeVersion.major) {
    return false
  }
  
  // If major is 0, be more restrictive
  if (rangeVersion.major === 0) {
    if (version.minor !== rangeVersion.minor) {
      return false
    }
    
    // If minor is also 0, only allow patch changes
    if (rangeVersion.minor === 0) {
      return version.patch >= rangeVersion.patch
    }
  }
  
  const cmp = compareVersions(version, rangeVersion)
  return cmp >= VERSION_COMPARE.EQUAL
}

/**
 * Get the latest version from an array of versions
 */
export function getLatestVersion(versions, options = {}) {
  const {
    includePrerelease = false,
    range = null
  } = options

  if (!Array.isArray(versions) || versions.length === 0) {
    return null
  }

  let filteredVersions = versions.slice()

  // Filter out prerelease versions if not included
  if (!includePrerelease) {
    filteredVersions = filteredVersions.filter(v => {
      const parsed = typeof v === 'string' ? parseVersion(v) : v
      return !parsed.prerelease
    })
  }

  // Filter by range if specified
  if (range) {
    filteredVersions = filteredVersions.filter(v => satisfiesRange(v, range))
  }

  if (filteredVersions.length === 0) {
    return null
  }

  // Sort and return the latest
  return filteredVersions.sort(compareVersions).pop()
}

/**
 * Get all versions that satisfy a range
 */
export function getVersionsInRange(versions, range, options = {}) {
  const {
    includePrerelease = false,
    sortOrder = 'asc' // 'asc' or 'desc'
  } = options

  if (!Array.isArray(versions)) {
    return []
  }

  let filteredVersions = versions.filter(v => {
    try {
      if (!includePrerelease) {
        const parsed = typeof v === 'string' ? parseVersion(v) : v
        if (parsed.prerelease) return false
      }
      
      return satisfiesRange(v, range)
    } catch (error) {
      return false
    }
  })

  // Sort versions
  filteredVersions.sort(compareVersions)
  
  if (sortOrder === 'desc') {
    filteredVersions.reverse()
  }

  return filteredVersions
}

/**
 * Increment a version
 */
export function incrementVersion(version, type = VERSION_PARTS.PATCH, prerelease = null) {
  const v = typeof version === 'string' ? parseVersion(version) : version
  const newVersion = { ...v }

  switch (type) {
    case VERSION_PARTS.MAJOR:
      newVersion.major += 1
      newVersion.minor = 0
      newVersion.patch = 0
      newVersion.prerelease = null
      break

    case VERSION_PARTS.MINOR:
      newVersion.minor += 1
      newVersion.patch = 0
      newVersion.prerelease = null
      break

    case VERSION_PARTS.PATCH:
      newVersion.patch += 1
      newVersion.prerelease = null
      break

    case VERSION_PARTS.PRERELEASE:
      if (v.prerelease) {
        // Increment existing prerelease
        const lastPart = v.prerelease[v.prerelease.length - 1]
        const num = parseInt(lastPart, 10)
        
        if (!isNaN(num)) {
          newVersion.prerelease = [...v.prerelease.slice(0, -1), (num + 1).toString()]
        } else {
          newVersion.prerelease = [...v.prerelease, '0']
        }
      } else {
        // Add new prerelease
        newVersion.prerelease = prerelease ? prerelease.split('.') : ['0']
      }
      break

    default:
      throw new Error(`Invalid increment type: ${type}`)
  }

  // Update version string
  newVersion.version = `${newVersion.major}.${newVersion.minor}.${newVersion.patch}`
  
  return newVersion
}

/**
 * Check if a version string is valid
 */
export function isValidVersion(version) {
  try {
    parseVersion(version)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Check if a range string is valid
 */
export function isValidRange(range) {
  try {
    parseRange(range)
    return true
  } catch (error) {
    return false
  }
}

/**
 * Clean a version string (remove leading 'v', normalize)
 */
export function cleanVersion(version) {
  if (!version || typeof version !== 'string') {
    return version
  }

  // Remove leading 'v' or 'V'
  let cleaned = version.replace(/^[vV]/, '')
  
  // Try to parse and reformat
  try {
    const parsed = parseVersion(cleaned)
    return parsed.toString()
  } catch (error) {
    return cleaned
  }
}

/**
 * Generate version suggestions for dependency resolution
 */
export function suggestVersions(availableVersions, constraint, options = {}) {
  const {
    includePrerelease = false,
    maxSuggestions = 5
  } = options

  if (!constraint || constraint === '*') {
    return getVersionsInRange(availableVersions, '*', {
      includePrerelease,
      sortOrder: 'desc'
    }).slice(0, maxSuggestions)
  }

  try {
    const matching = getVersionsInRange(availableVersions, constraint, {
      includePrerelease,
      sortOrder: 'desc'
    })

    if (matching.length > 0) {
      return matching.slice(0, maxSuggestions)
    }

    // If no exact matches, suggest similar versions
    const parsedConstraint = parseRange(constraint)
    if (parsedConstraint.version) {
      const similar = availableVersions
        .filter(v => {
          try {
            const parsed = parseVersion(v)
            return parsed.major === parsedConstraint.version.major
          } catch (error) {
            return false
          }
        })
        .sort(compareVersions)
        .reverse()

      return similar.slice(0, maxSuggestions)
    }

    return []
  } catch (error) {
    return []
  }
}

/**
 * Utilities object for easy importing
 */
export const SemverUtils = {
  parseVersion,
  parseRange,
  compareVersions,
  satisfiesRange,
  getLatestVersion,
  getVersionsInRange,
  incrementVersion,
  isValidVersion,
  isValidRange,
  cleanVersion,
  suggestVersions,
  VERSION_COMPARE,
  RANGE_OPERATORS,
  VERSION_PARTS
}

export default SemverUtils