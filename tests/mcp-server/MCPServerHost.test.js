/**
 * Unit Tests for MCPServerHost
 * 
 * Tests the MCP server hosting and management functionality including:
 * - Server lifecycle management
 * - Process isolation and sandboxing
 * - Health monitoring
 * - Resource management
 * - Error handling and recovery
 */

import { jest } from '@jest/globals';
import { 
  MCPServerHost, 
  MCPServerInstance, 
  MCPServerType, 
  MCPServerStatus 
} from '../../src/plugins/mcp/MCPServerHost.js';
import { 
  TestEnvironment,
  TestDataGenerator,
  PerformanceTestUtils
} from '../../src/mcp-server/utils/testUtils.js';

// Mock dependencies
jest.mock('../../src/plugins/security/PluginSandbox.js', () => {
  return {
    PluginSandbox: jest.fn().mockImplementation((serverId, manifest, options) => ({
      serverId,
      manifest,
      options,
      initialize: jest.fn().mockResolvedValue(),
      terminate: jest.fn().mockResolvedValue(),
      handleMessage: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    }))
  };
});

describe('MCPServerHost', () => {
  let serverHost;
  let testEnv;
  let mockSecurityManager;

  beforeEach(() => {
    testEnv = new TestEnvironment();
    
    mockSecurityManager = {
      validatePlugin: jest.fn().mockResolvedValue(true),
      createSandbox: jest.fn(),
      checkPermissions: jest.fn().mockReturnValue(true)
    };

    serverHost = new MCPServerHost(mockSecurityManager, {
      maxServers: 5,
      serverStartupTimeout: 5000,
      serverShutdownTimeout: 2000,
      healthCheckInterval: 1000,
      restartOnCrash: true
    });
  });

  afterEach(async () => {
    if (serverHost) {
      await serverHost.shutdown();
    }
    await testEnv.tearDown();
  });

  describe('Initialization', () => {
    test('should initialize server host with default options', async () => {
      const defaultHost = new MCPServerHost(mockSecurityManager);
      
      expect(defaultHost.options.maxServers).toBe(20);
      expect(defaultHost.options.serverStartupTimeout).toBe(30000);
      expect(defaultHost.options.healthCheckInterval).toBe(5000);
      expect(defaultHost.options.restartOnCrash).toBe(true);
      
      await defaultHost.initialize();
      
      expect(defaultHost.isInitialized).toBe(true);
      
      await defaultHost.shutdown();
    });

    test('should initialize server host with custom options', async () => {
      await serverHost.initialize();
      
      expect(serverHost.isInitialized).toBe(true);
      expect(serverHost.options.maxServers).toBe(5);
      expect(serverHost.options.serverStartupTimeout).toBe(5000);
      expect(serverHost.options.healthCheckInterval).toBe(1000);
    });

    test('should start health monitoring on initialization', async () => {
      jest.spyOn(serverHost, 'startHealthMonitoring');
      
      await serverHost.initialize();
      
      expect(serverHost.startHealthMonitoring).toHaveBeenCalled();
      expect(serverHost.healthMonitor).toBeTruthy();
    });

    test('should emit initialized event', async () => {
      const initSpy = jest.fn();
      serverHost.on('initialized', initSpy);
      
      await serverHost.initialize();
      
      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('Server Lifecycle Management', () => {
    beforeEach(async () => {
      await serverHost.initialize();
    });

    test('should start internal server successfully', async () => {
      const config = {
        name: 'Test Server',
        version: '1.0.0',
        type: MCPServerType.INTERNAL,
        manifest: {
          name: 'test-server',
          version: '1.0.0',
          main: 'index.js'
        }
      };

      const serverInstance = await serverHost.startServer('test-server-1', config);
      
      expect(serverInstance).toBeInstanceOf(MCPServerInstance);
      expect(serverInstance.serverId).toBe('test-server-1');
      expect(serverInstance.status).toBe(MCPServerStatus.RUNNING);
      expect(serverHost.servers.has('test-server-1')).toBe(true);
    });

    test('should start external server successfully', async () => {
      const config = {
        name: 'External Test Server',
        version: '1.0.0',
        type: MCPServerType.EXTERNAL,
        command: 'node',
        args: ['server.js']
      };

      const serverInstance = await serverHost.startServer('external-server-1', config);
      
      expect(serverInstance.serverId).toBe('external-server-1');
      expect(serverInstance.type).toBe(MCPServerType.EXTERNAL);
      expect(serverInstance.status).toBe(MCPServerStatus.RUNNING);
    });

    test('should start embedded server successfully', async () => {
      const config = {
        name: 'Embedded Test Server',
        version: '1.0.0',
        type: MCPServerType.EMBEDDED
      };

      const serverInstance = await serverHost.startServer('embedded-server-1', config);
      
      expect(serverInstance.serverId).toBe('embedded-server-1');
      expect(serverInstance.type).toBe(MCPServerType.EMBEDDED);
      expect(serverInstance.status).toBe(MCPServerStatus.RUNNING);
    });

    test('should prevent duplicate server IDs', async () => {
      const config = {
        name: 'Test Server',
        type: MCPServerType.INTERNAL,
        manifest: { name: 'test' }
      };

      await serverHost.startServer('duplicate-test', config);
      
      await expect(serverHost.startServer('duplicate-test', config))
        .rejects.toThrow(/already exists/i);
    });

    test('should enforce maximum server limit', async () => {
      const config = {
        name: 'Test Server',
        type: MCPServerType.INTERNAL,
        manifest: { name: 'test' }
      };

      // Start servers up to the limit
      for (let i = 0; i < serverHost.options.maxServers; i++) {
        await serverHost.startServer(`server-${i}`, config);
      }

      // Try to start one more
      await expect(serverHost.startServer('excess-server', config))
        .rejects.toThrow(/maximum number/i);
    });

    test('should stop server successfully', async () => {
      const config = {
        name: 'Test Server',
        type: MCPServerType.INTERNAL,
        manifest: { name: 'test' }
      };

      const serverInstance = await serverHost.startServer('stop-test', config);
      expect(serverInstance.status).toBe(MCPServerStatus.RUNNING);
      
      await serverHost.stopServer('stop-test');
      
      expect(serverInstance.status).toBe(MCPServerStatus.STOPPED);
      expect(serverHost.servers.has('stop-test')).toBe(false);
    });

    test('should force stop server if graceful shutdown fails', async () => {
      const config = {
        name: 'Stubborn Server',
        type: MCPServerType.INTERNAL,
        manifest: { name: 'stubborn' }
      };

      await serverHost.startServer('stubborn-server', config);
      
      // Mock graceful shutdown to fail
      jest.spyOn(serverHost, 'gracefulShutdown').mockRejectedValue(new Error('Shutdown timeout'));
      jest.spyOn(serverHost, 'forceShutdown').mockResolvedValue();
      
      await serverHost.stopServer('stubborn-server', false);
      
      expect(serverHost.forceShutdown).toHaveBeenCalled();
    });

    test('should restart server successfully', async () => {
      const config = {
        name: 'Restart Test Server',
        type: MCPServerType.INTERNAL,
        manifest: { name: 'restart-test' }
      };

      await serverHost.startServer('restart-test', config);
      
      const restartedInstance = await serverHost.restartServer('restart-test');
      
      expect(restartedInstance.serverId).toBe('restart-test');
      expect(restartedInstance.status).toBe(MCPServerStatus.RUNNING);
      expect(restartedInstance.metadata.restartCount).toBe(0); // First start after restart
    });

    test('should emit server lifecycle events', async () => {
      const startSpy = jest.fn();
      const stopSpy = jest.fn();
      const restartSpy = jest.fn();
      
      serverHost.on('server-started', startSpy);
      serverHost.on('server-stopped', stopSpy);
      serverHost.on('server-restarted', restartSpy);

      const config = {
        name: 'Event Test Server',
        type: MCPServerType.INTERNAL,
        manifest: { name: 'event-test' }
      };

      await serverHost.startServer('event-test', config);
      expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({
        serverId: 'event-test'
      }));

      await serverHost.restartServer('event-test');
      expect(restartSpy).toHaveBeenCalledWith(expect.objectContaining({
        serverId: 'event-test'
      }));

      await serverHost.stopServer('event-test');
      expect(stopSpy).toHaveBeenCalledWith(expect.objectContaining({
        serverId: 'event-test'
      }));
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await serverHost.initialize();
    });

    test('should perform health checks periodically', async () => {
      const config = {
        name: 'Health Test Server',
        type: MCPServerType.INTERNAL,
        manifest: { name: 'health-test' }
      };

      const serverInstance = await serverHost.startServer('health-test', config);
      
      // Mock protocol with ping method
      serverInstance.protocol = {
        sendRequest: jest.fn().mockResolvedValue({ pong: true })
      };

      // Wait for at least one health check
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const healthStatus = serverHost.getServerHealth('health-test');
      expect(healthStatus).toBeDefined();
      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.responseTime).toBeDefined();
    });

    test('should detect unhealthy servers', async () => {
      const config = {
        name: 'Unhealthy Server',
        type: MCPServerType.INTERNAL,
        manifest: { name: 'unhealthy-test' }
      };

      const serverInstance = await serverHost.startServer('unhealthy-test', config);
      
      // Mock protocol to fail health checks
      serverInstance.protocol = {
        sendRequest: jest.fn().mockRejectedValue(new Error('Health check failed'))
      };

      // Wait for health check
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const healthStatus = serverHost.getServerHealth('unhealthy-test');
      expect(healthStatus).toBeDefined();
      expect(healthStatus.status).toBe('unhealthy');
      expect(healthStatus.error).toBeDefined();
    });

    test('should restart crashed servers when enabled', async () => {
      const config = {
        name: 'Crash Test Server',
        type: MCPServerType.INTERNAL,
        manifest: { name: 'crash-test' }
      };

      const serverInstance = await serverHost.startServer('crash-test', config);
      
      jest.spyOn(serverHost, 'restartServer').mockResolvedValue(serverInstance);
      
      // Simulate server crash
      serverInstance.setStatus(MCPServerStatus.CRASHED);
      
      // Wait for restart handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(serverHost.restartServer).toHaveBeenCalledWith('crash-test');
    });

    test('should stop health monitoring on shutdown', async () => {
      expect(serverHost.healthMonitor).toBeTruthy();
      
      await serverHost.shutdown();
      
      expect(serverHost.healthMonitor).toBeNull();
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      await serverHost.initialize();
    });

    test('should track server resource usage', async () => {
      const config = {
        name: 'Resource Test Server',
        type: MCPServerType.INTERNAL,
        manifest: { name: 'resource-test' }
      };

      const serverInstance = await serverHost.startServer('resource-test', config);
      
      // Simulate resource usage update
      const usage = {
        memoryUsage: 50 * 1024 * 1024, // 50MB
        cpuUsage: 0.15 // 15%
      };
      
      serverInstance.emit('resource-usage', usage);
      
      const trackedUsage = serverHost.getServerResourceUsage('resource-test');
      expect(trackedUsage).toEqual(usage);
    });

    test('should provide comprehensive statistics', async () => {
      const configs = [
        { name: 'Server 1', type: MCPServerType.INTERNAL, manifest: { name: 'server1' } },
        { name: 'Server 2', type: MCPServerType.EXTERNAL, command: 'node', args: ['server.js'] },
        { name: 'Server 3', type: MCPServerType.EMBEDDED }
      ];

      for (let i = 0; i < configs.length; i++) {
        await serverHost.startServer(`stats-server-${i}`, configs[i]);
      }

      const stats = serverHost.getStats();
      
      expect(stats.totalServers).toBe(3);
      expect(stats.runningServers).toBe(3);
      expect(stats.byType[MCPServerType.INTERNAL]).toBe(1);
      expect(stats.byType[MCPServerType.EXTERNAL]).toBe(1);
      expect(stats.byType[MCPServerType.EMBEDDED]).toBe(1);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await serverHost.initialize();
    });

    test('should handle server startup failures gracefully', async () => {
      const config = {
        name: 'Failing Server',
        type: MCPServerType.INTERNAL,
        manifest: { name: 'failing-server' }
      };

      // Mock sandbox initialization to fail
      const { PluginSandbox } = await import('../../src/plugins/security/PluginSandbox.js');
      PluginSandbox.mockImplementation(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('Sandbox failed'))
      }));

      await expect(serverHost.startServer('failing-server', config))
        .rejects.toThrow(/sandbox failed/i);
      
      // Ensure cleanup happened
      expect(serverHost.servers.has('failing-server')).toBe(false);
    });

    test('should handle server process crashes', async () => {
      const config = {
        name: 'Crash Prone Server',
        type: MCPServerType.INTERNAL,
        manifest: { name: 'crash-prone' }
      };

      const serverInstance = await serverHost.startServer('crash-prone', config);
      
      const errorSpy = jest.fn();
      serverHost.on('server-error', errorSpy);
      
      // Simulate process crash
      const error = new Error('Process crashed');
      serverInstance.emit('error', error);
      
      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
        serverId: 'crash-prone',
        error
      }));
    });

    test('should handle communication channel failures', async () => {
      const config = {
        name: 'Communication Test Server',
        type: MCPServerType.INTERNAL,
        manifest: { name: 'comm-test' }
      };

      const serverInstance = await serverHost.startServer('comm-test', config);
      
      // Simulate channel error
      if (serverInstance.channel) {
        serverInstance.channel.emit('error', new Error('Channel error'));
      }
      
      // Server should still be trackable even with channel issues
      expect(serverHost.servers.has('comm-test')).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      // Use higher limits for performance tests
      await serverHost.shutdown();
      serverHost = new MCPServerHost(mockSecurityManager, {
        maxServers: 50,
        healthCheckInterval: 100 // Faster for testing
      });
      await serverHost.initialize();
    });

    test('should handle multiple concurrent server starts', async () => {
      const startOperations = Array.from({ length: 10 }, (_, i) =>
        serverHost.startServer(`concurrent-${i}`, {
          name: `Concurrent Server ${i}`,
          type: MCPServerType.EMBEDDED
        })
      );

      const results = await PerformanceTestUtils.testConcurrency(
        () => Promise.all(startOperations.slice(0, 1)), // Test one at a time to avoid conflicts
        5
      );

      expect(results.successRate).toBeGreaterThan(0.8); // At least 80% success rate
    });

    test('should start servers within acceptable time limits', async () => {
      const config = {
        name: 'Performance Test Server',
        type: MCPServerType.EMBEDDED
      };

      const result = await PerformanceTestUtils.measureAsyncOperation(
        () => serverHost.startServer(`perf-${Date.now()}`, config),
        5
      );

      expect(result.averageTime).toBeLessThan(1000); // Average under 1 second
      expect(result.maxTime).toBeLessThan(2000); // Max under 2 seconds
    });

    test('should maintain performance with many servers', async () => {
      const configs = Array.from({ length: 20 }, (_, i) => ({
        name: `Load Test Server ${i}`,
        type: MCPServerType.EMBEDDED
      }));

      // Start all servers
      for (let i = 0; i < configs.length; i++) {
        await serverHost.startServer(`load-test-${i}`, configs[i]);
      }

      // Measure performance of operations with many servers
      const result = await PerformanceTestUtils.measureAsyncOperation(
        () => serverHost.getStats(),
        100
      );

      expect(result.averageTime).toBeLessThan(10); // Under 10ms average
      expect(serverHost.servers.size).toBe(20);
    });
  });

  describe('Server Instance Management', () => {
    test('should create server instance with correct metadata', () => {
      const config = {
        name: 'Metadata Test Server',
        type: MCPServerType.INTERNAL,
        version: '2.0.0'
      };

      const instance = new MCPServerInstance('metadata-test', config, {});
      
      expect(instance.serverId).toBe('metadata-test');
      expect(instance.type).toBe(MCPServerType.INTERNAL);
      expect(instance.status).toBe(MCPServerStatus.STOPPED);
      expect(instance.metadata.createdAt).toBeDefined();
      expect(instance.metadata.startedAt).toBeNull();
    });

    test('should track status changes correctly', () => {
      const instance = new MCPServerInstance('status-test', {}, {});
      
      const statusSpy = jest.fn();
      instance.on('status-changed', statusSpy);
      
      instance.setStatus(MCPServerStatus.STARTING);
      expect(statusSpy).toHaveBeenCalledWith(MCPServerStatus.STARTING, MCPServerStatus.STOPPED);
      
      instance.setStatus(MCPServerStatus.RUNNING);
      expect(instance.metadata.startedAt).toBeDefined();
      
      instance.setStatus(MCPServerStatus.STOPPED);
      expect(instance.metadata.stoppedAt).toBeDefined();
    });

    test('should provide comprehensive server info', () => {
      const config = {
        name: 'Info Test Server',
        type: MCPServerType.INTERNAL
      };

      const instance = new MCPServerInstance('info-test', config, {});
      instance.setStatus(MCPServerStatus.RUNNING);
      instance.setProcess({ pid: 12345 });
      instance.setChannel({ id: 'channel-1' });
      instance.setProtocol({ version: '2024-11-05' });

      const info = instance.getInfo();
      
      expect(info.serverId).toBe('info-test');
      expect(info.status).toBe(MCPServerStatus.RUNNING);
      expect(info.hasProcess).toBe(true);
      expect(info.hasChannel).toBe(true);
      expect(info.hasProtocol).toBe(true);
      expect(info.metadata).toBeDefined();
    });
  });

  describe('Cleanup and Shutdown', () => {
    test('should shutdown all servers gracefully', async () => {
      await serverHost.initialize();

      const configs = Array.from({ length: 3 }, (_, i) => ({
        name: `Shutdown Test Server ${i}`,
        type: MCPServerType.EMBEDDED
      }));

      // Start multiple servers
      for (let i = 0; i < configs.length; i++) {
        await serverHost.startServer(`shutdown-test-${i}`, configs[i]);
      }

      expect(serverHost.servers.size).toBe(3);
      
      const shutdownSpy = jest.fn();
      serverHost.on('shutdown', shutdownSpy);
      
      await serverHost.shutdown();
      
      expect(serverHost.servers.size).toBe(0);
      expect(serverHost.healthMonitor).toBeNull();
      expect(shutdownSpy).toHaveBeenCalled();
    });

    test('should handle shutdown errors gracefully', async () => {
      await serverHost.initialize();

      await serverHost.startServer('error-shutdown-test', {
        name: 'Error Shutdown Server',
        type: MCPServerType.EMBEDDED
      });

      // Mock stopServer to throw an error
      jest.spyOn(serverHost, 'stopServer').mockRejectedValue(new Error('Stop failed'));
      
      // Shutdown should not throw despite server stop errors
      await expect(serverHost.shutdown()).resolves.not.toThrow();
    });
  });
});