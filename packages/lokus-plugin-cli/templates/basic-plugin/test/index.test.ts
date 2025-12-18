import { {{pluginNamePascalCase}} } from '../src/index';
import { createMockPluginContext, createMockActivationContext } from 'lokus-plugin-sdk/testing';

describe('{{pluginNamePascalCase}}', () => {
  let plugin: {{pluginNamePascalCase}};
  let mockContext: any;
  let mockActivationContext: any;

  beforeEach(() => {
    mockContext = createMockPluginContext();
    mockActivationContext = createMockActivationContext();
    plugin = new {{pluginNamePascalCase}}(mockContext);
  });

  afterEach(async () => {
    if (plugin) {
      await plugin.deactivate();
    }
  });

  describe('constructor', () => {
    it('should create plugin instance', () => {
      expect(plugin).toBeInstanceOf({{pluginNamePascalCase}});
      expect(mockContext.logger.info).toHaveBeenCalledWith('{{pluginNamePascalCase}} plugin initialized');
    });
  });

  describe('activate', () => {
    it('should activate successfully', async () => {
      await plugin.activate(mockActivationContext);

      expect(mockContext.logger.info).toHaveBeenCalledWith('Activating {{pluginNamePascalCase}} plugin...');
      expect(mockContext.logger.info).toHaveBeenCalledWith('{{pluginNamePascalCase}} plugin activated successfully');
    });

    it('should register commands', async () => {
      await plugin.activate(mockActivationContext);

      expect(mockActivationContext.commands.registerCommand).toHaveBeenCalledWith(
        '{{pluginNameCamelCase}}.helloWorld',
        expect.any(Function)
      );
    });

    it('should handle activation errors', async () => {
      const error = new Error('Activation failed');
      mockActivationContext.commands.registerCommand.mockRejectedValue(error);

      await expect(plugin.activate(mockActivationContext)).rejects.toThrow('Activation failed');
      expect(mockContext.logger.error).toHaveBeenCalledWith('Failed to activate plugin:', error);
    });
  });

  describe('deactivate', () => {
    it('should deactivate successfully', async () => {
      await plugin.activate(mockActivationContext);
      await plugin.deactivate();

      expect(mockContext.logger.info).toHaveBeenCalledWith('Deactivating {{pluginNamePascalCase}} plugin...');
      expect(mockContext.logger.info).toHaveBeenCalledWith('{{pluginNamePascalCase}} plugin deactivated successfully');
    });
  });

  describe('commands', () => {
    it('should execute hello world command', async () => {
      await plugin.activate(mockActivationContext);

      // Get the registered command handler
      const commandHandler = mockActivationContext.commands.registerCommand.mock.calls[0][1];

      // Execute the command
      commandHandler();

      expect(mockContext.ui.showInformationMessage).toHaveBeenCalledWith(
        'Hello from {{pluginNamePascalCase}} plugin!'
      );
      expect(mockContext.logger.info).toHaveBeenCalledWith('Hello World command executed');
    });
  });
});
