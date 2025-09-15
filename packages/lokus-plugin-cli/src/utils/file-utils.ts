import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import archiver from 'archiver';
const extractZip = require('extract-zip');
import { logger } from './logger';
import { ErrorHandler } from './error-handler';

export class FileUtils {
  static async ensureDir(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  static async copyTemplate(templatePath: string, targetPath: string, variables: Record<string, any> = {}): Promise<void> {
    const Handlebars = require('handlebars');
    
    await fs.ensureDir(path.dirname(targetPath));
    
    if (await fs.pathExists(templatePath)) {
      const content = await fs.readFile(templatePath, 'utf8');
      const template = Handlebars.compile(content);
      const processedContent = template(variables);
      await fs.writeFile(targetPath, processedContent);
    } else {
      throw ErrorHandler.createError('FileNotFoundError', `Template not found: ${templatePath}`);
    }
  }

  static async copyTemplateDir(
    templateDir: string, 
    targetDir: string, 
    variables: Record<string, any> = {},
    options: { exclude?: string[] } = {}
  ): Promise<void> {
    const { exclude = [] } = options;
    
    await fs.ensureDir(targetDir);
    
    const files = await glob('**/*', { 
      cwd: templateDir, 
      dot: true,
      ignore: ['node_modules/**', '.git/**', ...exclude]
    });

    for (const file of files) {
      const srcPath = path.join(templateDir, file);
      const destPath = path.join(targetDir, file);
      
      const stat = await fs.stat(srcPath);
      
      if (stat.isDirectory()) {
        await fs.ensureDir(destPath);
      } else {
        await this.copyTemplate(srcPath, destPath, variables);
      }
    }
  }

  static async createArchive(sourceDir: string, outputPath: string, format: 'zip' | 'tar' = 'zip'): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver(format, {
        zlib: { level: 9 } // Maximum compression
      });

      output.on('close', () => {
        logger.success(`Archive created: ${outputPath} (${archive.pointer()} bytes)`);
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  static async extractArchive(archivePath: string, targetDir: string): Promise<void> {
    await fs.ensureDir(targetDir);
    
    if (archivePath.endsWith('.zip')) {
      await extractZip(archivePath, { dir: targetDir });
    } else {
      throw ErrorHandler.createError('ValidationError', 'Unsupported archive format. Only .zip is currently supported.');
    }
  }

  static async findFiles(pattern: string, cwd: string = process.cwd()): Promise<string[]> {
    return glob(pattern, { cwd });
  }

  static async readJsonFile<T = any>(filePath: string): Promise<T> {
    try {
      return await fs.readJson(filePath);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw ErrorHandler.createError('ValidationError', `Invalid JSON in file: ${filePath}`);
      }
      throw error;
    }
  }

  static async writeJsonFile(filePath: string, data: any): Promise<void> {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJson(filePath, data, { spaces: 2 });
  }

  static async fileExists(filePath: string): Promise<boolean> {
    return fs.pathExists(filePath);
  }

  static async deleteDir(dirPath: string): Promise<void> {
    await fs.remove(dirPath);
  }

  static async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  static async calculateDirSize(dirPath: string): Promise<number> {
    let totalSize = 0;
    const files = await glob('**/*', { cwd: dirPath, nodir: true });
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        const size = await this.getFileSize(filePath);
        totalSize += size;
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
    
    return totalSize;
  }

  static resolvePath(inputPath: string, basePath: string = process.cwd()): string {
    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }
    return path.resolve(basePath, inputPath);
  }

  static sanitizeFileName(name: string): string {
    // Remove or replace invalid filename characters
    return name
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  static async createBackup(filePath: string): Promise<string> {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.copy(filePath, backupPath);
    return backupPath;
  }

  static async cleanupBackups(basePath: string, maxBackups: number = 5): Promise<void> {
    const backupPattern = `${basePath}.backup.*`;
    const backups = await glob(backupPattern);
    
    if (backups.length > maxBackups) {
      // Sort by creation time and remove oldest
      const backupsWithStats = await Promise.all(
        backups.map(async (backup) => ({
          path: backup,
          mtime: (await fs.stat(backup)).mtime
        }))
      );
      
      backupsWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      for (let i = maxBackups; i < backupsWithStats.length; i++) {
        await fs.remove(backupsWithStats[i].path);
      }
    }
  }
}