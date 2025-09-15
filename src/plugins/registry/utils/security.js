/**
 * Security Verification Utilities
 * Comprehensive security checking and verification for plugin registry
 */

/**
 * Security risk levels
 */
export const RISK_LEVEL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
}

/**
 * Vulnerability types
 */
export const VULNERABILITY_TYPE = {
  MALICIOUS_CODE: 'malicious_code',
  SUSPICIOUS_PERMISSIONS: 'suspicious_permissions',
  OUTDATED_DEPENDENCIES: 'outdated_dependencies',
  CODE_INJECTION: 'code_injection',
  DATA_EXFILTRATION: 'data_exfiltration',
  PRIVILEGE_ESCALATION: 'privilege_escalation',
  UNSAFE_EVAL: 'unsafe_eval',
  NETWORK_ACCESS: 'network_access',
  FILE_SYSTEM_ACCESS: 'file_system_access',
  PROCESS_EXECUTION: 'process_execution'
}

/**
 * Permission risk levels
 */
export const PERMISSION_RISK = {
  'read:workspace': RISK_LEVEL.LOW,
  'write:workspace': RISK_LEVEL.MEDIUM,
  'read:files': RISK_LEVEL.LOW,
  'write:files': RISK_LEVEL.HIGH,
  'execute:commands': RISK_LEVEL.CRITICAL,
  'network:http': RISK_LEVEL.MEDIUM,
  'network:websocket': RISK_LEVEL.MEDIUM,
  'system:clipboard': RISK_LEVEL.LOW,
  'system:notifications': RISK_LEVEL.LOW,
  'system:filesystem': RISK_LEVEL.HIGH,
  'system:process': RISK_LEVEL.CRITICAL,
  'editor:modify': RISK_LEVEL.MEDIUM,
  'editor:read': RISK_LEVEL.LOW,
  'settings:read': RISK_LEVEL.LOW,
  'settings:write': RISK_LEVEL.MEDIUM
}

/**
 * Suspicious code patterns
 */
const SUSPICIOUS_PATTERNS = [
  // Code execution
  /eval\s*\(/gi,
  /Function\s*\(/gi,
  /setTimeout\s*\(\s*['"`]/gi,
  /setInterval\s*\(\s*['"`]/gi,
  /new\s+Function\s*\(/gi,
  
  // Process execution
  /require\s*\(\s*['"`]child_process['"`]\s*\)/gi,
  /spawn\s*\(/gi,
  /exec\s*\(/gi,
  /execSync\s*\(/gi,
  
  // File system access
  /require\s*\(\s*['"`]fs['"`]\s*\)/gi,
  /readFileSync\s*\(/gi,
  /writeFileSync\s*\(/gi,
  /unlinkSync\s*\(/gi,
  
  // Network access
  /require\s*\(\s*['"`]http['"`]\s*\)/gi,
  /require\s*\(\s*['"`]https['"`]\s*\)/gi,
  /require\s*\(\s*['"`]net['"`]\s*\)/gi,
  /fetch\s*\(/gi,
  /XMLHttpRequest\s*\(/gi,
  
  // Obfuscation
  /String\.fromCharCode\s*\(/gi,
  /atob\s*\(/gi,
  /btoa\s*\(/gi,
  /\\x[0-9a-f]{2}/gi,
  /\\u[0-9a-f]{4}/gi,
  
  // Suspicious URLs
  /https?:\/\/[^\/\s]+\.tk\//gi,
  /https?:\/\/[^\/\s]+\.ml\//gi,
  /https?:\/\/[^\/\s]+\.ga\//gi,
  /bit\.ly\//gi,
  /tinyurl\.com\//gi
]

/**
 * Known malicious domains
 */
const MALICIOUS_DOMAINS = [
  'malware.com',
  'phishing.net',
  'suspicious.tk'
  // Add more as needed
]

/**
 * Security scanner class
 */
export class SecurityScanner {
  constructor(config = {}) {
    this.config = {
      strictMode: false,
      allowedDomains: [],
      blockedDomains: [...MALICIOUS_DOMAINS],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      scanTimeout: 30000, // 30 seconds
      ...config
    }
    
    this.vulnerabilities = []
    this.warnings = []
    this.scanStartTime = null
  }

  /**
   * Perform comprehensive security scan
   */
  async scanPlugin(pluginData, options = {}) {
    const {
      scanCode = true,
      scanManifest = true,
      scanPermissions = true,
      scanDependencies = true,
      scanFiles = true
    } = options

    this.vulnerabilities = []
    this.warnings = []
    this.scanStartTime = Date.now()

    const scanResult = {
      pluginId: pluginData.id || pluginData.name,
      riskLevel: RISK_LEVEL.LOW,
      score: 100, // Start with perfect score, deduct for issues
      vulnerabilities: [],
      warnings: [],
      scanTime: 0,
      recommendations: []
    }

    try {
      // Scan manifest
      if (scanManifest && pluginData.manifest) {
        await this.scanManifest(pluginData.manifest)
      }

      // Scan permissions
      if (scanPermissions && pluginData.manifest?.permissions) {
        await this.scanPermissions(pluginData.manifest.permissions)
      }

      // Scan dependencies
      if (scanDependencies && pluginData.manifest?.dependencies) {
        await this.scanDependencies(pluginData.manifest.dependencies)
      }

      // Scan source code files
      if (scanCode && pluginData.files) {
        await this.scanSourceCode(pluginData.files)
      }

      // Scan file structure
      if (scanFiles && pluginData.files) {
        await this.scanFileStructure(pluginData.files)
      }

      // Calculate final risk assessment
      scanResult.vulnerabilities = this.vulnerabilities
      scanResult.warnings = this.warnings
      scanResult.riskLevel = this.calculateRiskLevel()
      scanResult.score = this.calculateSecurityScore()
      scanResult.recommendations = this.generateRecommendations()
      scanResult.scanTime = Date.now() - this.scanStartTime

      return scanResult

    } catch (error) {
      scanResult.error = error.message
      scanResult.riskLevel = RISK_LEVEL.HIGH
      scanResult.score = 0
      return scanResult
    }
  }

  /**
   * Scan plugin manifest for security issues
   */
  async scanManifest(manifest) {
    // Check for suspicious metadata
    if (!manifest.author || typeof manifest.author !== 'string') {
      this.addWarning('Missing or invalid author information')
    }

    if (!manifest.description || manifest.description.length < 10) {
      this.addWarning('Missing or insufficient description')
    }

    if (!manifest.version || !this.isValidVersion(manifest.version)) {
      this.addVulnerability(VULNERABILITY_TYPE.MALICIOUS_CODE, 'Invalid version format', RISK_LEVEL.MEDIUM)
    }

    // Check for suspicious URLs
    const urls = [manifest.homepage, manifest.repository?.url].filter(Boolean)
    for (const url of urls) {
      if (this.isSuspiciousURL(url)) {
        this.addVulnerability(VULNERABILITY_TYPE.DATA_EXFILTRATION, `Suspicious URL: ${url}`, RISK_LEVEL.HIGH)
      }
    }

    // Check activation events
    if (manifest.activationEvents) {
      const suspiciousEvents = ['onStartup', 'onInstall', '*']
      for (const event of manifest.activationEvents) {
        if (suspiciousEvents.includes(event)) {
          this.addWarning(`Broad activation event: ${event}`)
        }
      }
    }
  }

  /**
   * Scan permissions for security risks
   */
  async scanPermissions(permissions) {
    let totalRisk = 0
    const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 }

    for (const permission of permissions) {
      const risk = PERMISSION_RISK[permission] || RISK_LEVEL.MEDIUM
      riskCounts[risk]++
      
      switch (risk) {
        case RISK_LEVEL.CRITICAL:
          totalRisk += 40
          this.addVulnerability(
            VULNERABILITY_TYPE.PRIVILEGE_ESCALATION,
            `Critical permission: ${permission}`,
            RISK_LEVEL.CRITICAL
          )
          break
        case RISK_LEVEL.HIGH:
          totalRisk += 20
          this.addVulnerability(
            VULNERABILITY_TYPE.SUSPICIOUS_PERMISSIONS,
            `High-risk permission: ${permission}`,
            RISK_LEVEL.HIGH
          )
          break
        case RISK_LEVEL.MEDIUM:
          totalRisk += 10
          this.addWarning(`Medium-risk permission: ${permission}`)
          break
      }
    }

    // Flag plugins with too many high-risk permissions
    if (riskCounts.critical > 2 || riskCounts.high > 5) {
      this.addVulnerability(
        VULNERABILITY_TYPE.PRIVILEGE_ESCALATION,
        'Excessive high-risk permissions requested',
        RISK_LEVEL.HIGH
      )
    }

    return { totalRisk, riskCounts }
  }

  /**
   * Scan dependencies for security issues
   */
  async scanDependencies(dependencies) {
    const suspiciousDependencies = [
      'eval',
      'vm2',
      'child_process',
      'fs-extra'
    ]

    for (const [depName, version] of Object.entries(dependencies)) {
      // Check for suspicious dependency names
      if (suspiciousDependencies.includes(depName)) {
        this.addVulnerability(
          VULNERABILITY_TYPE.SUSPICIOUS_PERMISSIONS,
          `Suspicious dependency: ${depName}`,
          RISK_LEVEL.MEDIUM
        )
      }

      // Check for wildcard or loose version constraints
      if (version === '*' || version.includes('x') || version.includes('X')) {
        this.addWarning(`Loose version constraint for ${depName}: ${version}`)
      }

      // Check for pre-release dependencies
      if (version.includes('-') && version.includes('alpha', 'beta', 'rc')) {
        this.addWarning(`Pre-release dependency: ${depName}@${version}`)
      }
    }
  }

  /**
   * Scan source code for malicious patterns
   */
  async scanSourceCode(files) {
    const codeFiles = files.filter(file => 
      file.path.endsWith('.js') || 
      file.path.endsWith('.ts') || 
      file.path.endsWith('.jsx') || 
      file.path.endsWith('.tsx')
    )

    for (const file of codeFiles) {
      if (!file.content) continue

      // Check file size
      if (file.content.length > this.config.maxFileSize) {
        this.addWarning(`Large file detected: ${file.path} (${file.content.length} bytes)`)
      }

      // Scan for suspicious patterns
      for (const pattern of SUSPICIOUS_PATTERNS) {
        const matches = file.content.match(pattern)
        if (matches) {
          const riskLevel = this.getPatternRisk(pattern)
          this.addVulnerability(
            VULNERABILITY_TYPE.MALICIOUS_CODE,
            `Suspicious pattern in ${file.path}: ${matches[0]}`,
            riskLevel
          )
        }
      }

      // Check for obfuscated code
      if (this.isObfuscated(file.content)) {
        this.addVulnerability(
          VULNERABILITY_TYPE.MALICIOUS_CODE,
          `Potentially obfuscated code in ${file.path}`,
          RISK_LEVEL.HIGH
        )
      }

      // Check for minified code without source maps
      if (this.isMinified(file.content) && !this.hasSourceMap(file.path, files)) {
        this.addWarning(`Minified code without source map: ${file.path}`)
      }

      // Check for external script loading
      const scriptMatches = file.content.match(/src\s*=\s*['"`]https?:\/\/[^'"`]+['"`]/gi)
      if (scriptMatches) {
        for (const match of scriptMatches) {
          const url = match.match(/https?:\/\/[^'"`]+/)[0]
          if (this.isSuspiciousURL(url)) {
            this.addVulnerability(
              VULNERABILITY_TYPE.DATA_EXFILTRATION,
              `External script from suspicious domain: ${url}`,
              RISK_LEVEL.HIGH
            )
          }
        }
      }
    }
  }

  /**
   * Scan file structure for security issues
   */
  async scanFileStructure(files) {
    const suspiciousFiles = [
      '.env',
      '.secrets',
      'config.json',
      'credentials.json',
      '.ssh/',
      'id_rsa',
      'id_dsa'
    ]

    const executableExtensions = ['.exe', '.bat', '.sh', '.ps1', '.cmd']

    for (const file of files) {
      // Check for suspicious files
      for (const suspicious of suspiciousFiles) {
        if (file.path.includes(suspicious)) {
          this.addVulnerability(
            VULNERABILITY_TYPE.DATA_EXFILTRATION,
            `Suspicious file: ${file.path}`,
            RISK_LEVEL.MEDIUM
          )
        }
      }

      // Check for executable files
      for (const ext of executableExtensions) {
        if (file.path.endsWith(ext)) {
          this.addVulnerability(
            VULNERABILITY_TYPE.PROCESS_EXECUTION,
            `Executable file: ${file.path}`,
            RISK_LEVEL.HIGH
          )
        }
      }

      // Check for hidden files
      if (file.path.includes('/.') && !file.path.includes('/.git/')) {
        this.addWarning(`Hidden file: ${file.path}`)
      }
    }

    // Check file count
    if (files.length > 1000) {
      this.addWarning(`Large number of files: ${files.length}`)
    }
  }

  /**
   * Calculate overall risk level
   */
  calculateRiskLevel() {
    const criticalCount = this.vulnerabilities.filter(v => v.riskLevel === RISK_LEVEL.CRITICAL).length
    const highCount = this.vulnerabilities.filter(v => v.riskLevel === RISK_LEVEL.HIGH).length
    const mediumCount = this.vulnerabilities.filter(v => v.riskLevel === RISK_LEVEL.MEDIUM).length

    if (criticalCount > 0) return RISK_LEVEL.CRITICAL
    if (highCount > 2) return RISK_LEVEL.HIGH
    if (highCount > 0 || mediumCount > 3) return RISK_LEVEL.MEDIUM
    
    return RISK_LEVEL.LOW
  }

  /**
   * Calculate security score (0-100)
   */
  calculateSecurityScore() {
    let score = 100

    for (const vuln of this.vulnerabilities) {
      switch (vuln.riskLevel) {
        case RISK_LEVEL.CRITICAL:
          score -= 30
          break
        case RISK_LEVEL.HIGH:
          score -= 20
          break
        case RISK_LEVEL.MEDIUM:
          score -= 10
          break
        case RISK_LEVEL.LOW:
          score -= 5
          break
      }
    }

    // Deduct for warnings
    score -= this.warnings.length * 2

    return Math.max(0, score)
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations() {
    const recommendations = []

    // Critical vulnerabilities
    const criticalVulns = this.vulnerabilities.filter(v => v.riskLevel === RISK_LEVEL.CRITICAL)
    if (criticalVulns.length > 0) {
      recommendations.push({
        priority: 'critical',
        message: 'Address critical security vulnerabilities before installation',
        details: criticalVulns.map(v => v.message)
      })
    }

    // Permission recommendations
    const permissionVulns = this.vulnerabilities.filter(v => 
      v.type === VULNERABILITY_TYPE.SUSPICIOUS_PERMISSIONS ||
      v.type === VULNERABILITY_TYPE.PRIVILEGE_ESCALATION
    )
    if (permissionVulns.length > 0) {
      recommendations.push({
        priority: 'high',
        message: 'Review requested permissions carefully',
        details: ['Only grant permissions that are necessary for plugin functionality']
      })
    }

    // Code quality recommendations
    if (this.warnings.length > 5) {
      recommendations.push({
        priority: 'medium',
        message: 'Multiple code quality issues detected',
        details: ['Consider reviewing plugin code quality and maintenance']
      })
    }

    return recommendations
  }

  /**
   * Helper methods
   */
  
  addVulnerability(type, message, riskLevel) {
    this.vulnerabilities.push({
      type,
      message,
      riskLevel,
      timestamp: Date.now()
    })
  }

  addWarning(message) {
    this.warnings.push({
      message,
      timestamp: Date.now()
    })
  }

  isSuspiciousURL(url) {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.toLowerCase()
      
      return this.config.blockedDomains.some(blocked => 
        domain.includes(blocked)
      ) || this.isShortURL(url)
    } catch (error) {
      return true // Invalid URLs are suspicious
    }
  }

  isShortURL(url) {
    const shortDomains = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly']
    return shortDomains.some(domain => url.includes(domain))
  }

  isValidVersion(version) {
    return /^\d+\.\d+\.\d+/.test(version)
  }

  isObfuscated(code) {
    // Simple heuristics for obfuscated code
    const indicators = [
      /var\s+_0x[a-f0-9]+/gi,
      /\\x[0-9a-f]{2}/gi,
      /\\u[0-9a-f]{4}/gi,
      /eval\s*\(/gi,
      /String\.fromCharCode/gi
    ]
    
    let obfuscationScore = 0
    for (const indicator of indicators) {
      if (indicator.test(code)) {
        obfuscationScore++
      }
    }
    
    return obfuscationScore >= 2
  }

  isMinified(code) {
    // Simple check for minified code
    const lines = code.split('\n')
    const avgLineLength = code.length / lines.length
    
    return avgLineLength > 200 && lines.length < code.length / 100
  }

  hasSourceMap(filePath, files) {
    const mapPath = filePath + '.map'
    return files.some(file => file.path === mapPath)
  }

  getPatternRisk(pattern) {
    const criticalPatterns = [
      /eval\s*\(/gi,
      /spawn\s*\(/gi,
      /exec\s*\(/gi
    ]
    
    if (criticalPatterns.some(p => p.source === pattern.source)) {
      return RISK_LEVEL.CRITICAL
    }
    
    return RISK_LEVEL.HIGH
  }
}

/**
 * Checksum verification utilities
 */
export class ChecksumVerifier {
  constructor() {
    this.supportedAlgorithms = ['sha256', 'sha512', 'md5']
  }

  /**
   * Verify file checksum
   */
  async verifyChecksum(data, expectedChecksum, algorithm = 'sha256') {
    if (!this.supportedAlgorithms.includes(algorithm)) {
      throw new Error(`Unsupported checksum algorithm: ${algorithm}`)
    }

    try {
      const computedChecksum = await this.computeChecksum(data, algorithm)
      return {
        valid: computedChecksum === expectedChecksum.toLowerCase(),
        computed: computedChecksum,
        expected: expectedChecksum.toLowerCase(),
        algorithm
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        algorithm
      }
    }
  }

  /**
   * Compute checksum for data
   */
  async computeChecksum(data, algorithm = 'sha256') {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Browser environment
      const encoder = new TextEncoder()
      const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data
      
      const hashBuffer = await crypto.subtle.digest(algorithm.toUpperCase().replace('SHA', 'SHA-'), dataBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } else {
      // Node.js environment (would need to be implemented separately)
      throw new Error('Checksum computation not available in this environment')
    }
  }
}

/**
 * Security utilities
 */
export const SecurityUtils = {
  /**
   * Create a security scanner instance
   */
  createScanner(config) {
    return new SecurityScanner(config)
  },

  /**
   * Create a checksum verifier instance
   */
  createVerifier() {
    return new ChecksumVerifier()
  },

  /**
   * Quick security assessment
   */
  async quickScan(pluginData) {
    const scanner = new SecurityScanner()
    return await scanner.scanPlugin(pluginData, {
      scanCode: false,
      scanFiles: false
    })
  },

  /**
   * Verify plugin signature (placeholder for future implementation)
   */
  async verifySignature(pluginData, signature, publicKey) {
    // TODO: Implement digital signature verification
    return {
      valid: false,
      message: 'Signature verification not yet implemented'
    }
  },

  /**
   * Check if plugin is from trusted source
   */
  isTrustedSource(publisherId, trustedPublishers = []) {
    return trustedPublishers.includes(publisherId)
  },

  /**
   * Generate security report
   */
  generateSecurityReport(scanResults) {
    return {
      summary: {
        riskLevel: scanResults.riskLevel,
        score: scanResults.score,
        vulnerabilityCount: scanResults.vulnerabilities.length,
        warningCount: scanResults.warnings.length
      },
      details: scanResults,
      timestamp: new Date().toISOString()
    }
  }
}

export default SecurityUtils