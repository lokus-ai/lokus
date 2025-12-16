import { readTextFile, writeTextFile, readFile, writeFile, exists, mkdir, remove, rename, copyFile, stat, readDir } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { join, homeDir } from '@tauri-apps/api/path';

class FilesystemManager {
    async getPluginFilePath(pluginId, relativePath) {
        const home = await homeDir();
        return await join(home, '.lokus', 'plugins', pluginId, relativePath);
    }

    async readFile(path, encoding = 'utf8') {
        if (encoding === 'binary') {
            return await readFile(path);
        }
        return await readTextFile(path);
    }

    async writeFile(path, content) {
        if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
            return await writeFile(path, content);
        }
        return await writeTextFile(path, content);
    }

    async readDirectory(path) {
        const entries = await readDir(path);
        return entries.map(e => e.name);
    }

    async createFolder(path) {
        return await mkdir(path, { recursive: true });
    }

    async deleteFile(path) {
        return await remove(path, { recursive: true });
    }

    async renameFile(oldPath, newPath) {
        return await rename(oldPath, newPath);
    }

    async copyFile(source, destination) {
        return await copyFile(source, destination);
    }

    async stat(path) {
        return await stat(path);
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
