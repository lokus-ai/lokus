
// Simple smoke test plugin to verify API fixes
// We use 'lokus' global which is exposed by the new loader (or should be)
// But wait, the loader exposes 'pluginAPI' to the factory function or 'this.api' in class.
// Let's assume standard class-based structure which the CLI generates.

export default class SmokeTestPlugin {
    async activate(context) {
        console.log('Smoke Test Plugin Activated');
        this.api = context;

        // Test 1: UI API - Show Information Message
        try {
            await this.api.ui.showInformationMessage('Smoke Test: UI API Working!');
            console.log('✅ UI API: showInformationMessage passed');
        } catch (e) {
            console.error('❌ UI API: showInformationMessage failed', e);
        }

        // Test 2: Filesystem API - Stat (New)
        try {
            // We need a file to stat. Let's try to stat the plugin manifest.
            // Relative path 'plugin.json' should work.
            const stats = await this.api.fs.stat('plugin.json');
            console.log('✅ FS API: stat passed', stats);
        } catch (e) {
            console.error('❌ FS API: stat failed', e);
        }

        // Test 3: Filesystem API - Read Directory (New)
        try {
            const files = await this.api.fs.readdir('.');
            console.log('✅ FS API: readdir passed', files);
        } catch (e) {
            console.error('❌ FS API: readdir failed', e);
        }

        // Test 4: Workspace API - Relative Path (New)
        try {
            // Mock a path - use a generic example path
            const rel = this.api.workspace.asRelativePath('/path/to/workspace/tests/smoke-plugin/index.js');
            console.log('✅ Workspace API: asRelativePath passed', rel);
        } catch (e) {
            console.error('❌ Workspace API: asRelativePath failed', e);
        }

        // Test 5: Register a Command (The "Real" Integration)
        try {
            this.api.commands.registerCommand({
                id: 'smoke-test.hello',
                title: 'Smoke Test: Say Hello',
                handler: async () => {
                    await this.api.ui.showInformationMessage('Hello from the Plugin! 👋');
                }
            });
            console.log('✅ Command registered: Smoke Test: Say Hello');
        } catch (e) {
            console.error('❌ Command registration failed', e);
        }
    }

    deactivate() {
        console.log('Smoke Test Plugin Deactivated');
    }
}

