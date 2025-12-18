import { {{pluginNamePascalCase}} } from '../src';
import { PluginContext } from '@lokus/plugin-sdk';

// Mock the plugin SDK
jest.mock('@lokus/plugin-sdk', () => ({
  PluginContext: jest.fn(),
  Logger: jest.fn()
}));

describe('{{pluginNamePascalCase}}', () => {
  let mockContext: jest.Mocked<PluginContext>;
  let plugin: {{pluginNamePascalCase}};

  beforeEach(() => {
    // Create mock context
    mockContext = {
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      commands: {
        register: jest.fn()
      },
      ui: {
        showMessage: jest.fn()
      },
      configuration: {
        get: jest.fn(),
        update: jest.fn(),
        onDidChange: jest.fn()
      }
    } as any;

    plugin = new {{pluginNamePascalCase}}(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create plugin instance', () => {
      expect(plugin).toBeInstanceOf({{pluginNamePascalCase}});
      expect(mockContext.logger.info).toHaveBeenCalledWith('{{pluginNamePascalCase}} plugin initialized');
    });
  });

  describe('activate', () => {
    it('should activate plugin successfully', async () => {
      await plugin.activate();

      expect(mockContext.logger.info).toHaveBeenCalledWith('Activating {{pluginName}} plugin...');
      expect(mockContext.commands.register).toHaveBeenCalledWith('{{pluginName}}.helloWorld', {
        title: 'Hello World',
        callback: expect.any(Function)
      });
      expect(mockContext.logger.info).toHaveBeenCalledWith('{{pluginName}} plugin activated successfully');
    });

    it('should handle activation errors', async () => {
      const error = new Error('Activation failed');
      mockContext.commands.register.mockRejectedValue(error);

      await expect(plugin.activate()).rejects.toThrow('Activation failed');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to activate plugin:', error);
    });
  });

  describe('deactivate', () => {
    it('should deactivate plugin successfully', async () => {
      await plugin.deactivate();

      expect(mockContext.logger.info).toHaveBeenCalledWith('Deactivating {{pluginName}} plugin...');
      expect(mockContext.logger.info).toHaveBeenCalledWith('{{pluginName}} plugin deactivated successfully');
    });
  });

  describe('commands', () => {
    beforeEach(async () => {
      await plugin.activate();
    });

    it('should execute hello world command', () => {
      // Get the registered command callback
      const registerCall = mockContext.commands.register.mock.calls.find(
        call => call[0] === '{{pluginName}}.helloWorld'
      );
      
      expect(registerCall).toBeDefined();
      
      const callback = registerCall![1].callback;
      callback();

      expect(mockContext.ui.showMessage).toHaveBeenCalledWith(
        'Hello World from {{pluginName}}!',
        'info'
      );
      expect(mockContext.logger.info).toHaveBeenCalledWith('Hello World command executed');
    });
  });
});

describe('Plugin Entry Points', () => {
  let mockContext: jest.Mocked<PluginContext>;

  beforeEach(() => {
    mockContext = {
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      commands: {
        register: jest.fn()
      },
      ui: {
        showMessage: jest.fn()
      }
    } as any;
  });

  it('should activate plugin through entry point', async () => {
    const { default: activate } = await import('../src');
    
    const plugin = activate(mockContext);
    
    expect(plugin).toBeInstanceOf({{pluginNamePascalCase}});
  });

  it('should deactivate plugin through entry point', async () => {
    const { default: activate, deactivate } = await import('../src');
    
    const plugin = activate(mockContext);
    const deactivateSpy = jest.spyOn(plugin, 'deactivate');
    
    deactivate(plugin);
    
    expect(deactivateSpy).toHaveBeenCalled();
  });
});