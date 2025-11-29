/**
 * Semantic Versioning Utility
 * Provides version parsing, comparison, and range checking
 */

/**
 * Parse a semantic version string
 * @param {string} version - Version string (e.g., "1.2.3", "1.2.3-alpha.1", "1.2.3+build.123")
 * @returns {Object} Parsed version object or null if invalid
 */
export function parseSemver(version) {
  if (typeof version !== 'string') {
    return null;
  }

  // Semver regex: major.minor.patch[-prerelease][+build]
  const regex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
  const match = version.trim().match(regex);

  if (!match) {
    return null;
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || '',
    build: match[5] || '',
    raw: version
  };
}

/**
 * Compare two semantic versions
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2, null if invalid
 */
export function compareSemver(v1, v2) {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);

  if (!p1 || !p2) {
    return null;
  }

  // Compare major, minor, patch
  if (p1.major !== p2.major) {
    return p1.major > p2.major ? 1 : -1;
  }
  if (p1.minor !== p2.minor) {
    return p1.minor > p2.minor ? 1 : -1;
  }
  if (p1.patch !== p2.patch) {
    return p1.patch > p2.patch ? 1 : -1;
  }

  // If versions are equal so far, check prerelease
  if (!p1.prerelease && !p2.prerelease) {
    return 0; // Both are stable releases
  }
  if (!p1.prerelease) {
    return 1; // v1 is stable, v2 is prerelease (stable > prerelease)
  }
  if (!p2.prerelease) {
    return -1; // v1 is prerelease, v2 is stable
  }

  // Both have prereleases, compare them lexicographically
  if (p1.prerelease < p2.prerelease) return -1;
  if (p1.prerelease > p2.prerelease) return 1;
  return 0;
}

/**
 * Check if a version satisfies a version range
 * Supports: ^1.2.3, ~1.2.3, >=1.2.3, >1.2.3, <=1.2.3, <1.2.3, 1.2.3, *, x, X
 * @param {string} version - Version to check
 * @param {string} range - Version range
 * @returns {boolean} True if version satisfies range
 */
export function satisfiesSemver(version, range) {
  if (!version || !range) {
    return false;
  }

  const v = parseSemver(version);
  if (!v) {
    return false;
  }

  // Wildcard: *, x, X
  if (range === '*' || range === 'x' || range === 'X') {
    return true;
  }

  // Exact match
  if (!range.match(/^[~^<>=]/)) {
    const r = parseSemver(range);
    return r && compareSemver(version, range) === 0;
  }

  // Caret range: ^1.2.3 means >=1.2.3 <2.0.0
  if (range.startsWith('^')) {
    const r = parseSemver(range.slice(1));
    if (!r) return false;

    if (v.major !== r.major) {
      return false;
    }
    if (r.major > 0) {
      // ^1.2.3 := >=1.2.3 <2.0.0
      return compareSemver(version, range.slice(1)) >= 0;
    }
    if (r.minor > 0) {
      // ^0.2.3 := >=0.2.3 <0.3.0
      if (v.minor !== r.minor) return false;
      return v.patch >= r.patch;
    }
    // ^0.0.3 := >=0.0.3 <0.0.4
    return v.minor === r.minor && v.patch === r.patch;
  }

  // Tilde range: ~1.2.3 means >=1.2.3 <1.3.0
  if (range.startsWith('~')) {
    const r = parseSemver(range.slice(1));
    if (!r) return false;

    return v.major === r.major &&
           v.minor === r.minor &&
           v.patch >= r.patch;
  }

  // Greater than or equal: >=1.2.3
  if (range.startsWith('>=')) {
    const r = range.slice(2);
    return compareSemver(version, r) >= 0;
  }

  // Greater than: >1.2.3
  if (range.startsWith('>')) {
    const r = range.slice(1);
    return compareSemver(version, r) > 0;
  }

  // Less than or equal: <=1.2.3
  if (range.startsWith('<=')) {
    const r = range.slice(2);
    return compareSemver(version, r) <= 0;
  }

  // Less than: <1.2.3
  if (range.startsWith('<')) {
    const r = range.slice(1);
    return compareSemver(version, r) < 0;
  }

  return false;
}

/**
 * Check if a version is compatible with a required version
 * Defaults to caret range if no operator specified
 * @param {string} actualVersion - The actual version
 * @param {string} requiredVersion - The required version or range
 * @returns {boolean} True if compatible
 */
export function isVersionCompatible(actualVersion, requiredVersion) {
  if (!actualVersion || !requiredVersion) {
    return false;
  }

  // If required version has no operator, default to caret range
  if (!requiredVersion.match(/^[~^<>=*xX]/)) {
    requiredVersion = `^${requiredVersion}`;
  }

  return satisfiesSemver(actualVersion, requiredVersion);
}

/**
 * Get the maximum version from an array of versions
 * @param {string[]} versions - Array of version strings
 * @returns {string|null} Maximum version or null if array is empty
 */
export function maxSemver(versions) {
  if (!Array.isArray(versions) || versions.length === 0) {
    return null;
  }

  return versions.reduce((max, current) => {
    if (!max) return current;
    const cmp = compareSemver(current, max);
    return cmp > 0 ? current : max;
  }, null);
}

/**
 * Get the minimum version from an array of versions
 * @param {string[]} versions - Array of version strings
 * @returns {string|null} Minimum version or null if array is empty
 */
export function minSemver(versions) {
  if (!Array.isArray(versions) || versions.length === 0) {
    return null;
  }

  return versions.reduce((min, current) => {
    if (!min) return current;
    const cmp = compareSemver(current, min);
    return cmp < 0 ? current : min;
  }, null);
}

/**
 * Sort versions in ascending order
 * @param {string[]} versions - Array of version strings
 * @returns {string[]} Sorted array
 */
export function sortSemver(versions) {
  if (!Array.isArray(versions)) {
    return [];
  }

  return [...versions].sort((a, b) => {
    const cmp = compareSemver(a, b);
    return cmp === null ? 0 : cmp;
  });
}

/**
 * Validate if a string is a valid semver version
 * @param {string} version - Version string to validate
 * @returns {boolean} True if valid
 */
export function isValidSemver(version) {
  return parseSemver(version) !== null;
}

export default {
  parse: parseSemver,
  compare: compareSemver,
  satisfies: satisfiesSemver,
  isCompatible: isVersionCompatible,
  max: maxSemver,
  min: minSemver,
  sort: sortSemver,
  isValid: isValidSemver
};
