/**
 * Template Validation Framework for Lokus
 * 
 * Comprehensive validation system for plugin templates that ensures:
 * - Template structure integrity
 * - Code quality and standards
 * - Security compliance
 * - Performance optimization
 * - Accessibility compliance
 * - Cross-platform compatibility
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import { ESLint } from 'eslint'
import typescript from 'typescript'
import postcss from 'postcss'
import autoprefixer from 'autoprefixer'
import cssnano from 'cssnano'
import htmlparser2 from 'htmlparser2'
import { JSDOM } from 'jsdom'

export class TemplateValidator {
  constructor(options = {}) {
    this.options = {
      strict: false,
      skipTests: false,
      skipLinting: false,
      outputFormat: 'detailed', // 'summary' | 'detailed' | 'json'
      ...options
    }
    
    this.results = {
      template: null,
      structure: [],
      codeQuality: [],
      security: [],
      performance: [],
      accessibility: [],
      compatibility: [],
      score: 0,
      status: 'pending'
    }
    
    this.eslint = new ESLint({
      baseConfig: this.getESLintConfig(),
      useEslintrc: false
    })
  }

  /**
   * Validate a template directory
   */
  async validateTemplate(templatePath) {
    try {
      console.log(`🔍 Validating template: ${templatePath}`)
      
      this.results.template = {
        path: templatePath,
        name: path.basename(templatePath),
        startTime: Date.now()
      }

      // 1. Validate structure
      await this.validateStructure(templatePath)
      
      // 2. Validate code quality
      if (!this.options.skipLinting) {
        await this.validateCodeQuality(templatePath)
      }
      
      // 3. Security validation
      await this.validateSecurity(templatePath)
      
      // 4. Performance validation
      await this.validatePerformance(templatePath)
      
      // 5. Accessibility validation
      await this.validateAccessibility(templatePath)
      
      // 6. Compatibility validation
      await this.validateCompatibility(templatePath)
      
      // 7. Calculate score
      this.calculateScore()
      
      this.results.template.endTime = Date.now()
      this.results.template.duration = this.results.template.endTime - this.results.template.startTime
      this.results.status = 'completed'
      
      return this.results
      
    } catch (error) {
      this.results.status = 'failed'
      this.results.error = error.message
      throw error
    }
  }

  /**
   * Validate template structure
   */
  async validateStructure(templatePath) {
    console.log('📁 Validating template structure...')
    
    const issues = []
    
    try {
      // Check required files
      const requiredFiles = [
        'plugin.json',
        'package.json',
        'README.md',
        'src/index.ts',
        'src/index.js'
      ]
      
      for (const file of requiredFiles) {
        if (file.includes('|')) {
          // At least one of these files should exist
          const alternatives = file.split('|')
          const exists = await Promise.all(
            alternatives.map(alt => this.fileExists(path.join(templatePath, alt)))
          )
          
          if (!exists.some(Boolean)) {
            issues.push({
              type: 'error',
              category: 'structure',
              message: `Missing required file: one of ${alternatives.join(', ')}`,
              file: alternatives[0]
            })
          }
        } else {
          const exists = await this.fileExists(path.join(templatePath, file))
          if (!exists) {
            issues.push({
              type: 'error',
              category: 'structure',
              message: `Missing required file: ${file}`,
              file
            })
          }
        }
      }
      
      // Check recommended files
      const recommendedFiles = [
        'CHANGELOG.md',
        'LICENSE',
        '.gitignore',
        'tsconfig.json',
        'vitest.config.js',
        'test/'
      ]
      
      for (const file of recommendedFiles) {
        const exists = await this.fileExists(path.join(templatePath, file))
        if (!exists) {
          issues.push({
            type: 'warning',
            category: 'structure',
            message: `Recommended file missing: ${file}`,
            file
          })
        }
      }
      
      // Validate plugin.json
      await this.validatePluginManifest(templatePath, issues)
      
      // Validate package.json
      await this.validatePackageJson(templatePath, issues)
      
      // Check directory structure
      await this.validateDirectoryStructure(templatePath, issues)
      
    } catch (error) {
      issues.push({
        type: 'error',
        category: 'structure',
        message: `Structure validation failed: ${error.message}`,
        error
      })
    }
    
    this.results.structure = issues
  }

  /**
   * Validate plugin manifest
   */
  async validatePluginManifest(templatePath, issues) {
    const manifestPath = path.join(templatePath, 'plugin.json')
    
    try {
      const content = await fs.readFile(manifestPath, 'utf8')
      const manifest = JSON.parse(content)
      
      // Required fields
      const requiredFields = [
        'id', 'name', 'version', 'description', 'author', 'main'
      ]
      
      for (const field of requiredFields) {
        if (!manifest[field]) {
          issues.push({
            type: 'error',
            category: 'manifest',
            message: `Missing required field in plugin.json: ${field}`,
            file: 'plugin.json'
          })
        }
      }
      
      // Validate version format
      if (manifest.version && !this.isValidSemver(manifest.version)) {
        issues.push({
          type: 'error',
          category: 'manifest',
          message: `Invalid version format: ${manifest.version}`,
          file: 'plugin.json'
        })
      }
      
      // Validate permissions
      if (manifest.permissions) {
        const validPermissions = [
          'editor:extensions', 'ui:panels', 'ui:commands', 'storage:local',
          'storage:remote', 'network:http', 'network:https', 'clipboard:read',
          'clipboard:write', 'files:read', 'files:write'
        ]
        
        for (const permission of manifest.permissions) {
          if (!validPermissions.includes(permission)) {
            issues.push({
              type: 'warning',
              category: 'manifest',
              message: `Unknown permission: ${permission}`,
              file: 'plugin.json'
            })
          }
        }
      }
      
    } catch (error) {
      issues.push({
        type: 'error',
        category: 'manifest',
        message: `Failed to parse plugin.json: ${error.message}`,
        file: 'plugin.json'
      })
    }
  }

  /**
   * Validate package.json
   */
  async validatePackageJson(templatePath, issues) {
    const packagePath = path.join(templatePath, 'package.json')
    
    try {
      const content = await fs.readFile(packagePath, 'utf8')
      const packageJson = JSON.parse(content)
      
      // Check for required scripts
      const requiredScripts = ['build', 'test']
      const recommendedScripts = ['dev', 'lint', 'type-check']
      
      if (!packageJson.scripts) {
        issues.push({
          type: 'error',
          category: 'package',
          message: 'Missing scripts section in package.json',
          file: 'package.json'
        })
      } else {
        for (const script of requiredScripts) {
          if (!packageJson.scripts[script]) {
            issues.push({
              type: 'error',
              category: 'package',
              message: `Missing required script: ${script}`,
              file: 'package.json'
            })
          }
        }
        
        for (const script of recommendedScripts) {
          if (!packageJson.scripts[script]) {
            issues.push({
              type: 'warning',
              category: 'package',
              message: `Recommended script missing: ${script}`,
              file: 'package.json'
            })
          }
        }
      }
      
      // Check dependencies
      if (packageJson.dependencies) {
        await this.validateDependencies(packageJson.dependencies, issues, 'production')
      }
      
      if (packageJson.devDependencies) {
        await this.validateDependencies(packageJson.devDependencies, issues, 'development')
      }
      
    } catch (error) {
      issues.push({
        type: 'error',
        category: 'package',
        message: `Failed to parse package.json: ${error.message}`,
        file: 'package.json'
      })
    }
  }

  /**
   * Validate dependencies
   */
  async validateDependencies(dependencies, issues, type) {
    const vulnerablePackages = [
      'event-stream', 'eslint-scope', 'flatmap-stream'
    ]
    
    const outdatedPackages = {}
    
    for (const [pkg, version] of Object.entries(dependencies)) {
      // Check for vulnerable packages
      if (vulnerablePackages.includes(pkg)) {
        issues.push({
          type: 'error',
          category: 'security',
          message: `Vulnerable package detected: ${pkg}`,
          file: 'package.json'
        })
      }
      
      // Check for version constraints
      if (!version.match(/^[\^~]?[\d\.]+/)) {
        issues.push({
          type: 'warning',
          category: 'dependencies',
          message: `Unusual version constraint for ${pkg}: ${version}`,
          file: 'package.json'
        })
      }
    }
  }

  /**
   * Validate directory structure
   */
  async validateDirectoryStructure(templatePath, issues) {
    const expectedDirs = ['src', 'test', 'docs']
    const deprecatedDirs = ['lib', 'build', 'dist']
    
    for (const dir of expectedDirs) {
      const dirPath = path.join(templatePath, dir)
      const exists = await this.directoryExists(dirPath)
      
      if (!exists && dir !== 'docs') {
        issues.push({
          type: 'warning',
          category: 'structure',
          message: `Recommended directory missing: ${dir}`,
          file: dir
        })
      }
    }
    
    for (const dir of deprecatedDirs) {
      const dirPath = path.join(templatePath, dir)
      const exists = await this.directoryExists(dirPath)
      
      if (exists) {
        issues.push({
          type: 'warning',
          category: 'structure',
          message: `Found potentially generated directory: ${dir} (should be in .gitignore)`,
          file: dir
        })
      }
    }
  }

  /**
   * Validate code quality
   */
  async validateCodeQuality(templatePath) {
    console.log('🔧 Validating code quality...')
    
    const issues = []
    
    try {
      // Find all source files
      const sourceFiles = await this.findSourceFiles(templatePath)
      
      // ESLint validation
      for (const file of sourceFiles.js) {
        await this.validateJavaScript(file, issues)
      }
      
      // TypeScript validation
      for (const file of sourceFiles.ts) {
        await this.validateTypeScript(file, issues)
      }
      
      // CSS validation
      for (const file of sourceFiles.css) {
        await this.validateCSS(file, issues)
      }
      
      // HTML/JSX validation
      for (const file of sourceFiles.jsx) {
        await this.validateJSX(file, issues)
      }
      
    } catch (error) {
      issues.push({
        type: 'error',
        category: 'code-quality',
        message: `Code quality validation failed: ${error.message}`,
        error
      })
    }
    
    this.results.codeQuality = issues
  }

  /**
   * Validate JavaScript files
   */
  async validateJavaScript(filePath, issues) {
    try {
      const results = await this.eslint.lintFiles([filePath])
      
      for (const result of results) {
        for (const message of result.messages) {
          issues.push({
            type: message.severity === 2 ? 'error' : 'warning',
            category: 'javascript',
            message: `${message.message} (${message.ruleId})`,
            file: path.relative(process.cwd(), result.filePath),
            line: message.line,
            column: message.column,
            rule: message.ruleId
          })
        }
      }
    } catch (error) {
      issues.push({
        type: 'error',
        category: 'javascript',
        message: `JavaScript validation failed: ${error.message}`,
        file: path.relative(process.cwd(), filePath)
      })
    }
  }

  /**
   * Validate TypeScript files
   */
  async validateTypeScript(filePath, issues) {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      
      // Create TypeScript program
      const compilerOptions = {
        target: typescript.ScriptTarget.ES2020,
        module: typescript.ModuleKind.ESNext,
        strict: true,
        noEmit: true
      }
      
      const sourceFile = typescript.createSourceFile(
        filePath,
        content,
        typescript.ScriptTarget.ES2020,
        true
      )
      
      const program = typescript.createProgram([filePath], compilerOptions)
      const diagnostics = typescript.getPreEmitDiagnostics(program)
      
      for (const diagnostic of diagnostics) {
        const message = typescript.flattenDiagnosticMessageText(
          diagnostic.messageText, '\n'
        )
        
        const file = diagnostic.file
        const position = file ? file.getLineAndCharacterOfPosition(diagnostic.start) : null
        
        issues.push({
          type: 'error',
          category: 'typescript',
          message,
          file: path.relative(process.cwd(), filePath),
          line: position ? position.line + 1 : undefined,
          column: position ? position.character + 1 : undefined
        })
      }
      
    } catch (error) {
      issues.push({
        type: 'error',
        category: 'typescript',
        message: `TypeScript validation failed: ${error.message}`,
        file: path.relative(process.cwd(), filePath)
      })
    }
  }

  /**
   * Validate CSS files
   */
  async validateCSS(filePath, issues) {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      
      const result = await postcss([
        autoprefixer(),
        cssnano({ preset: 'default' })
      ]).process(content, { from: filePath })
      
      // Check for CSS warnings
      for (const warning of result.warnings()) {
        issues.push({
          type: 'warning',
          category: 'css',
          message: warning.text,
          file: path.relative(process.cwd(), filePath),
          line: warning.line,
          column: warning.column
        })
      }
      
      // Custom CSS validations
      await this.validateCSSCustom(content, filePath, issues)
      
    } catch (error) {
      issues.push({
        type: 'error',
        category: 'css',
        message: `CSS validation failed: ${error.message}`,
        file: path.relative(process.cwd(), filePath)
      })
    }
  }

  /**
   * Custom CSS validations
   */
  async validateCSSCustom(content, filePath, issues) {
    // Check for hardcoded colors (should use CSS variables)
    const hardcodedColorRegex = /#[0-9a-fA-F]{3,6}|rgb\(|rgba\(/g
    const matches = content.match(hardcodedColorRegex)
    
    if (matches && matches.length > 0) {
      issues.push({
        type: 'warning',
        category: 'css',
        message: `Found ${matches.length} hardcoded colors. Consider using CSS variables for theme compatibility.`,
        file: path.relative(process.cwd(), filePath)
      })
    }
    
    // Check for important declarations
    const importantRegex = /!important/g
    const importantMatches = content.match(importantRegex)
    
    if (importantMatches && importantMatches.length > 3) {
      issues.push({
        type: 'warning',
        category: 'css',
        message: `Excessive use of !important (${importantMatches.length} occurrences). Review CSS specificity.`,
        file: path.relative(process.cwd(), filePath)
      })
    }
  }

  /**
   * Validate security
   */
  async validateSecurity(templatePath) {
    console.log('🔒 Validating security...')
    
    const issues = []
    
    try {
      // Check for sensitive data in files
      await this.scanForSensitiveData(templatePath, issues)
      
      // Validate dependencies for vulnerabilities
      await this.scanDependencyVulnerabilities(templatePath, issues)
      
      // Check for dangerous patterns in code
      await this.scanDangerousPatterns(templatePath, issues)
      
    } catch (error) {
      issues.push({
        type: 'error',
        category: 'security',
        message: `Security validation failed: ${error.message}`,
        error
      })
    }
    
    this.results.security = issues
  }

  /**
   * Scan for sensitive data
   */
  async scanForSensitiveData(templatePath, issues) {
    const sensitivePatterns = [
      { pattern: /password\s*[:=]\s*["'](.+)["']/gi, name: 'Password' },
      { pattern: /api[_-]?key\s*[:=]\s*["'](.+)["']/gi, name: 'API Key' },
      { pattern: /secret\s*[:=]\s*["'](.+)["']/gi, name: 'Secret' },
      { pattern: /token\s*[:=]\s*["'](.+)["']/gi, name: 'Token' },
      { pattern: /private[_-]?key\s*[:=]\s*["'](.+)["']/gi, name: 'Private Key' }
    ]
    
    const files = await this.getAllFiles(templatePath)
    
    for (const file of files) {
      if (file.endsWith('.git') || file.includes('node_modules')) continue
      
      try {
        const content = await fs.readFile(file, 'utf8')
        
        for (const { pattern, name } of sensitivePatterns) {
          const matches = content.match(pattern)
          if (matches) {
            issues.push({
              type: 'error',
              category: 'security',
              message: `Potential ${name} found in source code`,
              file: path.relative(templatePath, file)
            })
          }
        }
      } catch (error) {
        // Skip binary files
      }
    }
  }

  /**
   * Scan dependency vulnerabilities
   */
  async scanDependencyVulnerabilities(templatePath, issues) {
    try {
      const packageJsonPath = path.join(templatePath, 'package.json')
      const exists = await this.fileExists(packageJsonPath)
      
      if (exists) {
        // Run npm audit
        try {
          const auditResult = execSync('npm audit --json', {
            cwd: templatePath,
            encoding: 'utf8'
          })
          
          const audit = JSON.parse(auditResult)
          
          if (audit.vulnerabilities) {
            for (const [pkg, vuln] of Object.entries(audit.vulnerabilities)) {
              issues.push({
                type: vuln.severity === 'critical' ? 'error' : 'warning',
                category: 'security',
                message: `Vulnerability in ${pkg}: ${vuln.via[0]?.title || 'Unknown'}`,
                file: 'package.json'
              })
            }
          }
        } catch (error) {
          // npm audit might fail if no package-lock.json exists
          issues.push({
            type: 'info',
            category: 'security',
            message: 'Could not run npm audit. Run `npm install` first.',
            file: 'package.json'
          })
        }
      }
    } catch (error) {
      issues.push({
        type: 'warning',
        category: 'security',
        message: `Dependency vulnerability scan failed: ${error.message}`
      })
    }
  }

  /**
   * Scan for dangerous patterns
   */
  async scanDangerousPatterns(templatePath, issues) {
    const dangerousPatterns = [
      { pattern: /eval\s*\(/gi, name: 'eval() usage', severity: 'error' },
      { pattern: /innerHTML\s*=/gi, name: 'innerHTML assignment', severity: 'warning' },
      { pattern: /document\.write\s*\(/gi, name: 'document.write() usage', severity: 'warning' },
      { pattern: /setTimeout\s*\(\s*["'].*["']/gi, name: 'setTimeout with string', severity: 'warning' },
      { pattern: /setInterval\s*\(\s*["'].*["']/gi, name: 'setInterval with string', severity: 'warning' }
    ]
    
    const sourceFiles = await this.findSourceFiles(templatePath)
    const allFiles = [...sourceFiles.js, ...sourceFiles.ts, ...sourceFiles.jsx]
    
    for (const file of allFiles) {
      try {
        const content = await fs.readFile(file, 'utf8')
        
        for (const { pattern, name, severity } of dangerousPatterns) {
          const matches = content.match(pattern)
          if (matches) {
            issues.push({
              type: severity,
              category: 'security',
              message: `Potentially dangerous pattern: ${name}`,
              file: path.relative(templatePath, file)
            })
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  /**
   * Validate performance
   */
  async validatePerformance(templatePath) {
    console.log('⚡ Validating performance...')
    
    const issues = []
    
    try {
      // Check bundle size
      await this.checkBundleSize(templatePath, issues)
      
      // Check for performance anti-patterns
      await this.checkPerformancePatterns(templatePath, issues)
      
      // Check for heavy dependencies
      await this.checkHeavyDependencies(templatePath, issues)
      
    } catch (error) {
      issues.push({
        type: 'error',
        category: 'performance',
        message: `Performance validation failed: ${error.message}`,
        error
      })
    }
    
    this.results.performance = issues
  }

  /**
   * Check bundle size
   */
  async checkBundleSize(templatePath, issues) {
    try {
      // Try to build the plugin and check size
      const buildScript = 'npm run build'
      
      try {
        execSync(buildScript, { cwd: templatePath, stdio: 'pipe' })
        
        const distPath = path.join(templatePath, 'dist')
        const distExists = await this.directoryExists(distPath)
        
        if (distExists) {
          const files = await fs.readdir(distPath)
          let totalSize = 0
          
          for (const file of files) {
            const filePath = path.join(distPath, file)
            const stats = await fs.stat(filePath)
            totalSize += stats.size
          }
          
          // Warn if bundle is too large (> 1MB)
          if (totalSize > 1024 * 1024) {
            issues.push({
              type: 'warning',
              category: 'performance',
              message: `Large bundle size: ${Math.round(totalSize / 1024)}KB`,
              file: 'dist/'
            })
          }
        }
      } catch (buildError) {
        issues.push({
          type: 'warning',
          category: 'performance',
          message: 'Could not build plugin to check bundle size',
          file: 'package.json'
        })
      }
    } catch (error) {
      // Build might fail for various reasons, not critical
    }
  }

  /**
   * Check performance patterns
   */
  async checkPerformancePatterns(templatePath, issues) {
    const performancePatterns = [
      { 
        pattern: /useEffect\s*\(\s*[^,]+\s*\)/gi, 
        name: 'useEffect without dependencies', 
        severity: 'warning' 
      },
      { 
        pattern: /useState\s*\(\s*(?:new\s+)?(?:Array|Object)\s*\(/gi, 
        name: 'useState with object/array literal', 
        severity: 'warning' 
      },
      { 
        pattern: /\.map\s*\([^)]*\)\.map\s*\(/gi, 
        name: 'Chained array maps', 
        severity: 'warning' 
      }
    ]
    
    const sourceFiles = await this.findSourceFiles(templatePath)
    const reactFiles = [...sourceFiles.jsx, ...sourceFiles.ts.filter(f => f.includes('tsx'))]
    
    for (const file of reactFiles) {
      try {
        const content = await fs.readFile(file, 'utf8')
        
        for (const { pattern, name, severity } of performancePatterns) {
          const matches = content.match(pattern)
          if (matches) {
            issues.push({
              type: severity,
              category: 'performance',
              message: `Performance concern: ${name}`,
              file: path.relative(templatePath, file)
            })
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  /**
   * Validate accessibility
   */
  async validateAccessibility(templatePath) {
    console.log('♿ Validating accessibility...')
    
    const issues = []
    
    try {
      // Check for accessibility patterns in JSX
      await this.checkA11yPatterns(templatePath, issues)
      
      // Check CSS for accessibility
      await this.checkA11yCSS(templatePath, issues)
      
    } catch (error) {
      issues.push({
        type: 'error',
        category: 'accessibility',
        message: `Accessibility validation failed: ${error.message}`,
        error
      })
    }
    
    this.results.accessibility = issues
  }

  /**
   * Check accessibility patterns
   */
  async checkA11yPatterns(templatePath, issues) {
    const a11yPatterns = [
      {
        pattern: /<img(?![^>]*alt=)/gi,
        name: 'Image without alt attribute',
        severity: 'error'
      },
      {
        pattern: /<button(?![^>]*aria-label)(?![^>]*title)>[\s]*<\/button>/gi,
        name: 'Button without accessible text',
        severity: 'error'
      },
      {
        pattern: /<div(?![^>]*role=)(?=[^>]*onClick)/gi,
        name: 'Clickable div without role',
        severity: 'warning'
      }
    ]
    
    const sourceFiles = await this.findSourceFiles(templatePath)
    const jsxFiles = sourceFiles.jsx
    
    for (const file of jsxFiles) {
      try {
        const content = await fs.readFile(file, 'utf8')
        
        for (const { pattern, name, severity } of a11yPatterns) {
          const matches = content.match(pattern)
          if (matches) {
            issues.push({
              type: severity,
              category: 'accessibility',
              message: `Accessibility issue: ${name}`,
              file: path.relative(templatePath, file)
            })
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  /**
   * Validate compatibility
   */
  async validateCompatibility(templatePath) {
    console.log('🌐 Validating compatibility...')
    
    const issues = []
    
    try {
      // Check Node.js version compatibility
      await this.checkNodeCompatibility(templatePath, issues)
      
      // Check browser compatibility
      await this.checkBrowserCompatibility(templatePath, issues)
      
      // Check Lokus version compatibility
      await this.checkLokusCompatibility(templatePath, issues)
      
    } catch (error) {
      issues.push({
        type: 'error',
        category: 'compatibility',
        message: `Compatibility validation failed: ${error.message}`,
        error
      })
    }
    
    this.results.compatibility = issues
  }

  /**
   * Calculate overall score
   */
  calculateScore() {
    const weights = {
      structure: 0.25,
      codeQuality: 0.25,
      security: 0.20,
      performance: 0.15,
      accessibility: 0.10,
      compatibility: 0.05
    }
    
    let totalScore = 0
    
    for (const [category, weight] of Object.entries(weights)) {
      const issues = this.results[category] || []
      const errors = issues.filter(i => i.type === 'error').length
      const warnings = issues.filter(i => i.type === 'warning').length
      
      // Score calculation: start with 100, subtract points for issues
      let categoryScore = 100 - (errors * 10) - (warnings * 5)
      categoryScore = Math.max(0, categoryScore) // Minimum 0
      
      totalScore += categoryScore * weight
    }
    
    this.results.score = Math.round(totalScore)
    
    // Determine status based on score
    if (this.results.score >= 90) {
      this.results.status = 'excellent'
    } else if (this.results.score >= 80) {
      this.results.status = 'good'
    } else if (this.results.score >= 70) {
      this.results.status = 'fair'
    } else {
      this.results.status = 'poor'
    }
  }

  /**
   * Generate report
   */
  generateReport() {
    const { outputFormat } = this.options
    
    switch (outputFormat) {
      case 'json':
        return this.generateJSONReport()
      case 'summary':
        return this.generateSummaryReport()
      default:
        return this.generateDetailedReport()
    }
  }

  /**
   * Generate detailed report
   */
  generateDetailedReport() {
    const { template, score, status } = this.results
    const scoreEmoji = this.getScoreEmoji(score)
    
    let report = `
📊 Template Validation Report
════════════════════════════════════════

Template: ${template.name}
Path: ${template.path}
Score: ${score}/100 ${scoreEmoji}
Status: ${status.toUpperCase()}
Duration: ${template.duration}ms

`
    
    // Add category summaries
    const categories = ['structure', 'codeQuality', 'security', 'performance', 'accessibility', 'compatibility']
    
    for (const category of categories) {
      const issues = this.results[category] || []
      const errors = issues.filter(i => i.type === 'error').length
      const warnings = issues.filter(i => i.type === 'warning').length
      const infos = issues.filter(i => i.type === 'info').length
      
      report += `${this.getCategoryEmoji(category)} ${this.formatCategoryName(category)}\n`
      report += `   Errors: ${errors}, Warnings: ${warnings}, Info: ${infos}\n\n`
      
      // Add detailed issues
      for (const issue of issues) {
        const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️'
        report += `   ${icon} ${issue.message}\n`
        if (issue.file) report += `      File: ${issue.file}\n`
        if (issue.line) report += `      Line: ${issue.line}\n`
        report += '\n'
      }
    }
    
    // Add recommendations
    report += this.generateRecommendations()
    
    return report
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    const { score } = this.results
    let recommendations = '\n💡 Recommendations\n══════════════════\n\n'
    
    if (score < 70) {
      recommendations += '• Focus on fixing critical errors first\n'
      recommendations += '• Review security best practices\n'
      recommendations += '• Add comprehensive tests\n'
    } else if (score < 90) {
      recommendations += '• Address remaining warnings\n'
      recommendations += '• Improve documentation\n'
      recommendations += '• Consider performance optimizations\n'
    } else {
      recommendations += '• Excellent work! Consider publishing this template\n'
      recommendations += '• Add it to the showcase examples\n'
    }
    
    return recommendations
  }

  /**
   * Helper methods
   */
  
  getScoreEmoji(score) {
    if (score >= 90) return '🌟'
    if (score >= 80) return '✅'
    if (score >= 70) return '👍'
    return '❌'
  }
  
  getCategoryEmoji(category) {
    const emojis = {
      structure: '📁',
      codeQuality: '🔧',
      security: '🔒',
      performance: '⚡',
      accessibility: '♿',
      compatibility: '🌐'
    }
    return emojis[category] || '📋'
  }
  
  formatCategoryName(category) {
    return category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  async findSourceFiles(templatePath) {
    const files = await this.getAllFiles(templatePath)
    
    return {
      js: files.filter(f => f.endsWith('.js') && !f.includes('node_modules')),
      ts: files.filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('node_modules')),
      jsx: files.filter(f => (f.endsWith('.jsx') || f.endsWith('.tsx')) && !f.includes('node_modules')),
      css: files.filter(f => (f.endsWith('.css') || f.endsWith('.scss')) && !f.includes('node_modules'))
    }
  }

  async getAllFiles(dir) {
    const files = []
    
    async function traverse(currentDir) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await traverse(fullPath)
        } else if (entry.isFile()) {
          files.push(fullPath)
        }
      }
    }
    
    await traverse(dir)
    return files
  }

  isValidSemver(version) {
    const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/
    return semverRegex.test(version)
  }

  getESLintConfig() {
    return {
      env: {
        browser: true,
        es2021: true,
        node: true
      },
      extends: [
        'eslint:recommended',
        '@typescript-eslint/recommended'
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      plugins: [
        '@typescript-eslint',
        'react',
        'react-hooks',
        'jsx-a11y'
      ],
      rules: {
        'no-console': 'warn',
        'no-unused-vars': 'error',
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'react/jsx-uses-react': 'error',
        'react/jsx-uses-vars': 'error',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        'jsx-a11y/alt-text': 'error',
        'jsx-a11y/aria-role': 'error'
      }
    }
  }
}

export default TemplateValidator