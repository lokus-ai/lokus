#!/usr/bin/env node

/**
 * Simple script to show only failing test names during development
 */

import { spawn } from 'child_process'

function runTests() {
  console.log('🧪 Running tests...\n')
  
  const vitest = spawn('npx', ['vitest', 'run', '--reporter=basic'], {
    stdio: ['inherit', 'pipe', 'pipe']
  })

  let output = ''
  let hasFailures = false

  vitest.stdout.on('data', (data) => {
    output += data.toString()
  })

  vitest.stderr.on('data', (data) => {
    output += data.toString()
  })

  vitest.on('close', (code) => {
    if (code !== 0) {
      hasFailures = true
      console.log('❌ Test failures detected:\n')
      
      // Extract failed test names
      const lines = output.split('\n')
      const failedTests = []
      
      for (const line of lines) {
        if (line.includes('✗') || line.includes('FAIL')) {
          const cleaned = line
            .replace(/✗|FAIL|×/g, '')
            .replace(/^\s+/, '')
            .replace(/\s+\d+ms$/, '')
            .trim()
          
          if (cleaned && !cleaned.startsWith('Test Files') && !cleaned.startsWith('Tests')) {
            failedTests.push(cleaned)
          }
        }
      }
      
      // Remove duplicates and show unique failed tests
      const uniqueFailures = [...new Set(failedTests)]
      uniqueFailures.forEach((test, index) => {
        console.log(`${index + 1}. ${test}`)
      })
      
      console.log(`\n📊 Total: ${uniqueFailures.length} failed tests`)
    } else {
      console.log('✅ All tests passed!')
    }
    
    // Show basic stats
    const statsMatch = output.match(/Tests\s+(\d+)\s+failed.*?(\d+)\s+passed\s+\((\d+)\)/)
    if (statsMatch) {
      const [, failed, passed, total] = statsMatch
      console.log(`📈 Test summary: ${passed}/${total} passing, ${failed} failing`)
    }
  })
}

runTests()