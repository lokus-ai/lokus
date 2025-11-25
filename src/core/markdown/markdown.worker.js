import { MarkdownCompiler } from './compiler-logic.js';

const compiler = new MarkdownCompiler();

self.onmessage = (e) => {
    const { id, text, type } = e.data;

    try {
        let result;
        if (type === 'isMarkdown') {
            result = compiler.isMarkdown(text);
        } else if (type === 'processTemplate') {
            result = compiler.processTemplate(text);
        } else {
            result = compiler.compile(text);
        }

        self.postMessage({ id, result });
    } catch (error) {
        self.postMessage({ id, error: error.message });
    }
};
