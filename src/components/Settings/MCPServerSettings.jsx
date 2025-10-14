/**
 * MCP Server Settings Component
 *
 * User-friendly GUI for managing MCP server configuration and status
 * Provides one-click setup, status monitoring, and troubleshooting
 */

import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Server,
  Play,
  Square,
  RotateCw,
  Check,
  X,
  AlertCircle,
  Loader,
  ExternalLink,
  Copy,
  Settings,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react'

export default function MCPServerSettings() {
  // Server status state
  const [status, setStatus] = useState({
    is_running: false,
    port: 3456,
    pid: null,
    url: null,
    last_error: null
  })

  // UI state
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [configureResult, setConfigureResult] = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [autoStart, setAutoStart] = useState(false)
  const [portInput, setPortInput] = useState(3456)

  // Load initial status
  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 5000) // Poll every 5 seconds
    return () => clearInterval(interval)
  }, [])

  // Load server status
  const loadStatus = async () => {
    try {
      const result = await invoke('mcp_status')
      setStatus(result)
    } catch (error) {
      console.error('Failed to load MCP status:', error)
    }
  }

  // Start server
  const handleStart = async () => {
    setLoading(true)
    try {
      const result = await invoke('mcp_start', { port: portInput || null })
      setStatus(result)
      setTestResult(null)
    } catch (error) {
      setStatus(prev => ({ ...prev, last_error: error.toString() }))
    } finally {
      setLoading(false)
    }
  }

  // Stop server
  const handleStop = async () => {
    setLoading(true)
    try {
      const result = await invoke('mcp_stop')
      setStatus(result)
      setTestResult(null)
    } catch (error) {
      setStatus(prev => ({ ...prev, last_error: error.toString() }))
    } finally {
      setLoading(false)
    }
  }

  // Restart server
  const handleRestart = async () => {
    setLoading(true)
    try {
      const result = await invoke('mcp_restart', { port: portInput || null })
      setStatus(result)
      setTestResult(null)
    } catch (error) {
      setStatus(prev => ({ ...prev, last_error: error.toString() }))
    } finally {
      setLoading(false)
    }
  }

  // Test connection
  const handleTest = async () => {
    setLoading(true)
    setTestResult(null)
    try {
      const result = await invoke('mcp_health_check')
      setTestResult({
        success: result,
        message: result ? 'Server is healthy and responding' : 'Server is not responding'
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: error.toString()
      })
    } finally {
      setLoading(false)
    }
  }

  // Auto-configure AI Desktop
  const handleConfigure = async () => {
    setLoading(true)
    setConfigureResult(null)
    try {
      const result = await invoke('setup_mcp_integration')
      setConfigureResult({
        success: true,
        message: result
      })
    } catch (error) {
      setConfigureResult({
        success: false,
        message: error.toString()
      })
    } finally {
      setLoading(false)
    }
  }

  // Copy URL to clipboard
  const copyUrl = () => {
    if (status.url) {
      navigator.clipboard.writeText(status.url)
      // TODO: Show toast notification
    }
  }

  // Open in browser
  const openInBrowser = () => {
    if (status.url) {
      window.open(`${status.url}/health`, '_blank')
    }
  }

  // Status indicator component
  const StatusIndicator = ({ running }) => {
    const colors = running
      ? 'bg-green-500 shadow-green-500/50'
      : 'bg-gray-400 shadow-gray-400/50'
    return (
      <div className={`w-3 h-3 rounded-full ${colors} shadow-lg animate-pulse`} />
    )
  }

  return (
    <div className="mcp-server-settings" style={{ padding: '24px', maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Server size={28} />
          MCP Server Integration
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Connect Lokus to AI assistants via Model Context Protocol
        </p>
      </div>

      {/* Status Card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <StatusIndicator running={status.is_running} />
            <div>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>
                {status.is_running ? 'Running' : 'Stopped'}
              </div>
              {status.is_running && (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Port {status.port} • PID {status.pid}
                </div>
              )}
            </div>
          </div>

          {/* Control Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {!status.is_running ? (
              <button
                onClick={handleStart}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? <Loader size={16} className="animate-spin" /> : <Play size={16} />}
                Start
              </button>
            ) : (
              <>
                <button
                  onClick={handleStop}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    background: 'var(--surface-hover)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  <Square size={16} />
                  Stop
                </button>
                <button
                  onClick={handleRestart}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    background: 'var(--surface-hover)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  <RotateCw size={16} />
                  Restart
                </button>
              </>
            )}
          </div>
        </div>

        {/* Connection URL */}
        {status.is_running && status.url && (
          <div style={{
            background: 'var(--surface-hover)',
            padding: '12px',
            borderRadius: '6px',
            marginTop: '12px'
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Connection URL:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <code style={{
                flex: 1,
                fontSize: '13px',
                fontFamily: 'monospace',
                padding: '6px 10px',
                background: 'var(--surface)',
                borderRadius: '4px'
              }}>
                {status.url}
              </code>
              <button
                onClick={copyUrl}
                style={{
                  padding: '6px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                title="Copy URL"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={openInBrowser}
                style={{
                  padding: '6px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                title="Open in Browser"
              >
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {status.last_error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '12px',
            borderRadius: '6px',
            marginTop: '12px',
            display: 'flex',
            gap: '10px'
          }}>
            <AlertCircle size={18} color="rgb(239, 68, 68)" />
            <div style={{ fontSize: '13px', color: 'rgb(239, 68, 68)' }}>
              {status.last_error}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          Quick Setup
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Test Connection */}
          <div>
            <button
              onClick={handleTest}
              disabled={!status.is_running || loading}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'var(--surface-hover)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: (!status.is_running || loading) ? 'not-allowed' : 'pointer',
                opacity: (!status.is_running || loading) ? 0.6 : 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={18} />
                <span>Test Connection</span>
              </div>
              {testResult && (
                testResult.success ? (
                  <Check size={18} color="rgb(34, 197, 94)" />
                ) : (
                  <X size={18} color="rgb(239, 68, 68)" />
                )
              )}
            </button>
            {testResult && (
              <div style={{
                padding: '8px 12px',
                marginTop: '8px',
                fontSize: '13px',
                borderRadius: '6px',
                background: testResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: testResult.success ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
              }}>
                {testResult.message}
              </div>
            )}
          </div>

          {/* Auto-Configure */}
          <div>
            <button
              onClick={handleConfigure}
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Settings size={18} />
                  <span>Auto-Configure AI Apps</span>
                </div>
                <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 'normal' }}>
                  Configures both Desktop and CLI
                </span>
              </div>
              {loading ? <Loader size={18} className="animate-spin" /> : <ChevronDown size={18} />}
            </button>
            {configureResult && (
              <div style={{
                padding: '8px 12px',
                marginTop: '8px',
                fontSize: '13px',
                borderRadius: '6px',
                background: configureResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: configureResult.success ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
              }}>
                {configureResult.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '600'
          }}
        >
          <span>Advanced Settings</span>
          {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showAdvanced && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Port Configuration */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                Server Port
              </label>
              <input
                type="number"
                value={portInput}
                onChange={(e) => setPortInput(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Default: 3456. Change if port is already in use.
              </p>
            </div>

            {/* Auto-start */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500' }}>
                  Auto-start with Lokus
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Automatically start MCP server when Lokus launches
                </p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoStart}
                  onChange={(e) => setAutoStart(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div style={{
        marginTop: '20px',
        padding: '16px',
        background: 'var(--surface-hover)',
        borderRadius: '8px',
        fontSize: '13px',
        color: 'var(--text-muted)'
      }}>
        <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--text)' }}>
          Need Help?
        </strong>
        <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
          <li>Click "Start" to begin the MCP server</li>
          <li>Use "Auto-Configure AI Apps" to set up both Desktop and CLI automatically</li>
          <li>Test the connection to verify everything is working</li>
          <li>Restart your AI applications after configuration</li>
          <li>The server URL works with any MCP-compatible application</li>
        </ul>
      </div>
    </div>
  )
}
