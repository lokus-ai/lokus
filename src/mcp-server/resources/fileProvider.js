/**
 * File Resource Provider (Simplified)
 */

export class FileProvider {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
  }

  async listResources() {
    return [
      {
        uri: 'file://workspace',
        name: 'Workspace Files',
        description: 'All files in the workspace',
        type: 'directory'
      }
    ];
  }

  async readResource(uri) {
    return {
      contents: [{
        type: 'text',
        text: 'File content placeholder'
      }]
    };
  }
}