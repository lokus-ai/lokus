import MarkdownWorker from './markdown.worker.js?worker';

class MarkdownCompilerClient {
  constructor() {
    this.worker = new MarkdownWorker();
    this.pending = new Map();
    this.msgId = 0;

    this.worker.onmessage = (e) => {
      const { id, result, error } = e.data;
      if (this.pending.has(id)) {
        const { resolve, reject } = this.pending.get(id);
        this.pending.delete(id);
        if (error) reject(new Error(error));
        else resolve(result);
      }
    };
  }

  async _send(type, text) {
    const id = this.msgId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, text });
    });
  }

  async compile(text) {
    return this._send('compile', text);
  }

  async isMarkdown(text) {
    return this._send('isMarkdown', text);
  }

  async process(text) {
    // Logic from original: check isMarkdown then compile
    const isMd = await this.isMarkdown(text);
    if (!isMd) return text;
    return this.compile(text);
  }

  async processTemplate(content) {
    return this._send('processTemplate', content);
  }
}

// Global instance
let compiler = null;

export function getMarkdownCompiler() {
  if (!compiler) {
    compiler = new MarkdownCompilerClient();
  }
  return compiler;
}

export default MarkdownCompilerClient;
