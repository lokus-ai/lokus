/**
 * Hello World Plugin
 * A simple example demonstrating Lokus plugin capabilities
 */

// Plugin activation function - called when plugin is enabled
export function activate(context, lokus) {

  try {
    // Show a welcome notification
    lokus.notifications.show({
      type: 'success',
      title: 'Hello World Plugin',
      message: 'Plugin successfully activated! 👋',
      duration: 3000
    });

    // Register a command
    lokus.commands.register({
      id: 'helloWorld.greet',
      name: 'Hello World: Greet',
      description: 'Shows a friendly greeting',
      execute: () => {
        lokus.notifications.success(
          'Hello from the Hello World plugin!',
          'Greetings',
          4000
        );
      }
    });

    // Register a slash command to insert greeting text
    lokus.editor.addSlashCommand({
      name: 'hello',
      description: 'Insert a friendly greeting',
      icon: '👋',
      execute: async () => {
        try {
          await lokus.editor.insertNode('paragraph', {}, 'Hello from Lokus! 👋');
          lokus.notifications.success('Greeting inserted!', null, 2000);
        } catch (error) {
          lokus.notifications.error('Failed to insert greeting', null, 3000);
          console.error('Insert error:', error);
        }
      }
    });

    // Register another command to insert custom greeting
    lokus.commands.register({
      id: 'helloWorld.insertGreeting',
      name: 'Hello World: Insert Greeting',
      shortcut: 'Mod-Shift-H',
      description: 'Inserts a custom greeting into the editor',
      execute: async () => {
        try {
          const selection = await lokus.editor.getSelection();

          if (selection && !selection.empty) {
            // Replace selected text with greeting
            await lokus.editor.replaceSelection(`Hello, ${selection.text}! 👋`);
          } else {
            // Insert at cursor
            await lokus.editor.insertNode('paragraph', {}, 'Hello from the Hello World plugin! 👋');
          }

          lokus.notifications.success('Greeting inserted!');
        } catch (error) {
          lokus.notifications.error('Failed to insert greeting');
          console.error('Insert error:', error);
        }
      }
    });

    // Add a toolbar button
    lokus.editor.addToolbarItem({
      id: 'hello-world-button',
      title: 'Say Hello',
      icon: '👋',
      group: 'plugin',
      handler: () => {
        lokus.notifications.info('Hello from the toolbar! 👋');
      }
    });


  } catch (error) {
    console.error('Hello World plugin activation error:', error);
    lokus.notifications.error(
      'Failed to activate Hello World plugin',
      'Plugin Error',
      5000
    );
  }
}

// Plugin deactivation function - called when plugin is disabled
export function deactivate(lokus) {

  try {
    // Show goodbye notification
    lokus.notifications.show({
      type: 'info',
      title: 'Hello World Plugin',
      message: 'Plugin deactivated. Goodbye! 👋',
      duration: 2000
    });
  } catch (error) {
    console.error('Hello World plugin deactivation error:', error);
  }
}

// Default export for CommonJS compatibility
export default {
  activate,
  deactivate
};
