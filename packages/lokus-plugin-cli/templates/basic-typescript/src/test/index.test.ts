import { {{pluginNamePascalCase}} } from '../index';
import { PluginContext, PluginLogger } from 'lokus-plugin-sdk';

// Mock the plugin SDK
jest.mock('lokus-plugin-sdk', () => ({
  PluginContext: jest.fn(),
  PluginLogger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('{{pluginNamePascalCase}}', () => {
  let mockContext: jest.Mocked<PluginContext>;
  let plugin: {{pluginNamePascalCase}};
  let mockLogger: jest.Mocked<PluginLogger>;

  beforeEach(() => {
    // Create mock context
    mockContext = {
      pluginId: '{{pluginName}}',
      api: {
        commands: {
          register: jest.fn()
        },
        ui: {
          showMessage: jest.fn()
        }
      }
    } as any;

    plugin = new {{pluginNamePascalCase}}(mockContext);
    // Get the logger instance (it's private, but we can access it via casting or just rely on the mock)
    mockLogger = (plugin as any).logger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create plugin instance', () => {
      expect(plugin).toBeInstanceOf({{pluginNamePascalCase}});
      expect(mockLogger.info).toHaveBeenCalledWith('{{pluginNamePascalCase}} plugin initialized');
    });
  });

  describe('activate', () => {
    it('should activate plugin successfully', async () => {
      await plugin.activate();

      expect(mockLogger.info).toHaveBeenCalledWith('Activating {{pluginName}} plugin...');
      expect(mockContext.api.commands.register).toHaveBeenCalledWith('{{pluginName}}.helloWorld', {
        title: 'Hello World',
        callback: expect.any(Function)
      });
      expect(mockLogger.info).toHaveBeenCalledWith('{{pluginName}} plugin activated successfully');
    });

    it('should handle activation errors', async () => {
      const error = new Error('Activation failed');
      (mockContext.api.commands.register as jest.Mock).mockRejectedValue(error);

      await expect(plugin.activate()).rejects.toThrow('Activation failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to activate plugin:', error);
    });
  });

  describe('deactivate', () => {
    it('should deactivate plugin successfully', async () => {
      await plugin.deactivate();

      expect(mockLogger.info).toHaveBeenCalledWith('Deactivating {{pluginName}} plugin...');
      expect(mockLogger.info).toHaveBeenCalledWith('{{pluginName}} plugin deactivated successfully');
    });
  });

  describe('commands', () => {
    beforeEach(async () => {
      await plugin.activate();
    });

    it('should execute hello world command', () => {
      // Get the registered command callback
      const registerCall = (mockContext.api.commands.register as jest.Mock).mock.calls.find(
        (call: any) => call[0] === '{{pluginName}}.helloWorld'
      );
      
      expect(registerCall).toBeDefined();
      
      const callback = registerCall![1].callback;
      callback();

      expect(mockContext.api.ui.showMessage).toHaveBeenCalledWith(
        'Hello World from {{pluginName}}!',
        'info'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Hello World command executed');
    });
  });
});

describe('Plugin Entry Points', () => {
  let mockContext: jest.Mocked<PluginContext>;

  beforeEach(() => {
    mockContext = {
      pluginId: '{{pluginName}}',
      api: {
        commands: {
          register: jest.fn()
        },
        ui: {
          showMessage: jest.fn()
        }
      }
    } as any;
  });

  it('should activate plugin through entry point', async () => {
    const { default: activate } = await import('../index');
    
    const plugin = activate(mockContext);
    
    expect(plugin).toBeInstanceOf({{pluginNamePascalCase}});
  });

  it('should deactivate plugin through entry point', async () => {
    const { default: activate, deactivate } = await import('../index');
    
    const plugin = activate(mockContext);
    const deactivateSpy = jest.spyOn(plugin, 'deactivate');
    
    deactivate(plugin);
    
    expect(deactivateSpy).toHaveBeenCalled();
  });
});
