import { readTextFile, writeTextFile, exists, mkdir, remove } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { join, appDataDir } from '@tauri-apps/api/path';

class FilesystemManager {
    async getPluginFilePath(pluginId, relativePath) {
        const appData = await appDataDir();
        return await join(appData, 'plugins', pluginId, relativePath);
    }

    async readFile(path) {
        return await readTextFile(path);
    }

    async writeFile(path, content) {
        return await writeTextFile(path, content);
    }

    async exists(path) {
        return await exists(path);
    }

    async ensureDir(path) {
        if (!(await exists(path))) {
            await mkdir(path, { recursive: true });
        }
    }

    async openFileDialog(options) {
        return await open({
            multiple: options.multiple,
            filters: options.accept ? [{ name: 'Files', extensions: options.accept }] : [],
            title: options.title
        });
    }
}

export const filesystemManager = new FilesystemManager();
