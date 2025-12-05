import React, { useState } from 'react';
import { useTemplatePrompts } from "./TemplatePromptsManager";
import { TemplatePrompts } from "../../../core/templates/prompts";

/**
 * Example component showing how to use template prompts
 *
 * This demonstrates:
 * - Text input prompts
 * - Dropdown/suggester prompts
 * - Checkbox prompts
 * - Multiple prompts in sequence
 * - Processing templates with user input
 */
const TemplatePromptsExample = () => {
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const { showPrompts, PromptsManager } = useTemplatePrompts();

  // Example templates
  const exampleTemplates = {
    simple: `# {{prompt:title:What is the title?:My Document}}

Written by {{prompt:author:Who is the author?:John Doe}}`,

    withDropdown: `# Task: {{suggest:status:Select task status:Todo,In Progress,Done,Blocked:Todo}}

Priority: {{suggest:priority:Select priority:Low,Medium,High,Critical:Medium}}`,

    withCheckbox: `# Settings

Debug Mode: {{checkbox:debug:Enable debug mode?:false}}
Auto Save: {{checkbox:autosave:Enable auto-save?:true}}`,

    mixed: `# {{prompt:title:Enter project title:New Project}}

Status: {{suggest:status:Select status:Planning,Active,On Hold,Completed:Planning}}
Public: {{checkbox:public:Make this public?:false}}

## Details

Author: {{prompt:author:Who is the author?:Team Member}}
Description: {{prompt:description:Enter description:Project description here}}`,

    complex: `# {{prompt:companyName:Company Name:Acme Corp}}

## Meeting Notes - {{prompt:date:Meeting Date:2024-01-15}}

**Attendees**: {{prompt:attendees:List attendees:John, Jane, Bob}}
**Status**: {{suggest:meetingType:Meeting Type:Planning,Review,Standup,Retrospective:Planning}}
**Action Required**: {{checkbox:actionRequired:Are there action items?:true}}

## Agenda

{{prompt:agenda:What was discussed?:Discussion topics...}}

## Decisions

{{suggest:decision:Main decision:Approved,Rejected,Deferred,Needs Discussion:Approved}}

## Next Steps

{{prompt:nextSteps:What are the next steps?:Follow-up tasks...}}

---
**Confidential**: {{checkbox:confidential:Mark as confidential?:false}}
`
  };

  const handleTestTemplate = async (templateName) => {
    setError('');
    setResult('');

    const template = exampleTemplates[templateName];

    try {
      // Show prompts and collect values
      const values = await showPrompts(template);

      // Process template with collected values
      const promptsParser = new TemplatePrompts();
      const processed = promptsParser.replacePrompts(template, values);

      setResult(processed);
    } catch (err) {
      setError(err.message || 'User cancelled or error occurred');
    }
  };

  const handleAnalyze = (templateName) => {
    const template = exampleTemplates[templateName];
    const promptsParser = new TemplatePrompts();

    // Get statistics
    const stats = promptsParser.getStatistics(template);
    const prompts = promptsParser.parsePrompts(template);
    const validation = promptsParser.validate(template);


    alert(`Template Statistics:
Total Prompts: ${stats.total}
- Text Prompts: ${stats.byType.prompt}
- Dropdowns: ${stats.byType.suggest}
- Checkboxes: ${stats.byType.checkbox}
With Defaults: ${stats.withDefaults}
Unique Variables: ${stats.uniqueVariables}

Valid: ${validation.valid}
${validation.warnings.length > 0 ? '\nWarnings:\n' + validation.warnings.join('\n') : ''}
${validation.errors.length > 0 ? '\nErrors:\n' + validation.errors.join('\n') : ''}
`);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-app-text">Template Prompts Examples</h1>
        <p className="text-app-text opacity-70">
          Test different types of template prompts and see how they work
        </p>
      </div>

      {/* Example Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Simple Text Prompt */}
        <div className="bg-app-panel border border-app-border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-app-text">Simple Text Prompts</h3>
          <p className="text-sm text-app-text opacity-70">
            Basic text input fields with default values
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleTestTemplate('simple')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Test
            </button>
            <button
              onClick={() => handleAnalyze('simple')}
              className="px-4 py-2 bg-app-bg-secondary text-app-text rounded-lg hover:bg-app-bg-hover transition-colors"
            >
              Analyze
            </button>
          </div>
        </div>

        {/* Dropdown Prompts */}
        <div className="bg-app-panel border border-app-border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-app-text">Dropdown Prompts</h3>
          <p className="text-sm text-app-text opacity-70">
            Select from predefined options
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleTestTemplate('withDropdown')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Test
            </button>
            <button
              onClick={() => handleAnalyze('withDropdown')}
              className="px-4 py-2 bg-app-bg-secondary text-app-text rounded-lg hover:bg-app-bg-hover transition-colors"
            >
              Analyze
            </button>
          </div>
        </div>

        {/* Checkbox Prompts */}
        <div className="bg-app-panel border border-app-border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-app-text">Checkbox Prompts</h3>
          <p className="text-sm text-app-text opacity-70">
            Boolean yes/no questions
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleTestTemplate('withCheckbox')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Test
            </button>
            <button
              onClick={() => handleAnalyze('withCheckbox')}
              className="px-4 py-2 bg-app-bg-secondary text-app-text rounded-lg hover:bg-app-bg-hover transition-colors"
            >
              Analyze
            </button>
          </div>
        </div>

        {/* Mixed Prompts */}
        <div className="bg-app-panel border border-app-border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-app-text">Mixed Prompts</h3>
          <p className="text-sm text-app-text opacity-70">
            Combination of all prompt types
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleTestTemplate('mixed')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Test
            </button>
            <button
              onClick={() => handleAnalyze('mixed')}
              className="px-4 py-2 bg-app-bg-secondary text-app-text rounded-lg hover:bg-app-bg-hover transition-colors"
            >
              Analyze
            </button>
          </div>
        </div>

        {/* Complex Template */}
        <div className="bg-app-panel border border-app-border rounded-lg p-4 space-y-3 md:col-span-2">
          <h3 className="font-semibold text-app-text">Complex Meeting Notes Template</h3>
          <p className="text-sm text-app-text opacity-70">
            Real-world example with multiple prompts in sequence
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleTestTemplate('complex')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Test
            </button>
            <button
              onClick={() => handleAnalyze('complex')}
              className="px-4 py-2 bg-app-bg-secondary text-app-text rounded-lg hover:bg-app-bg-hover transition-colors"
            >
              Analyze
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <h3 className="font-semibold text-red-400 mb-2">Error</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="bg-app-panel border border-app-border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-app-text">Result</h3>
            <button
              onClick={() => setResult('')}
              className="text-sm text-app-text opacity-70 hover:opacity-100"
            >
              Clear
            </button>
          </div>
          <pre className="bg-app-bg-secondary rounded-lg p-4 text-sm text-app-text overflow-auto whitespace-pre-wrap">
            {result}
          </pre>
        </div>
      )}

      {/* Syntax Reference */}
      <div className="bg-app-panel border border-app-border rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-app-text text-xl">Syntax Reference</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-app-text">Text Input</h4>
            <code className="block bg-app-bg-secondary rounded px-3 py-2 text-sm text-green-400">
              {'{{prompt:varName:question:defaultValue}}'}
            </code>
            <p className="text-sm text-app-text opacity-70">
              Shows a text input dialog. Default value is optional.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-app-text">Dropdown/Suggester</h4>
            <code className="block bg-app-bg-secondary rounded px-3 py-2 text-sm text-green-400">
              {'{{suggest:varName:question:option1,option2,option3:default}}'}
            </code>
            <p className="text-sm text-app-text opacity-70">
              Shows a dropdown with options. Default is optional (uses first option if not specified).
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-app-text">Checkbox</h4>
            <code className="block bg-app-bg-secondary rounded px-3 py-2 text-sm text-green-400">
              {'{{checkbox:varName:question:defaultBool}}'}
            </code>
            <p className="text-sm text-app-text opacity-70">
              Shows a checkbox for boolean values. Default is optional (false if not specified).
            </p>
          </div>
        </div>
      </div>

      {/* Prompts Manager */}
      {PromptsManager}
    </div>
  );
};

export default TemplatePromptsExample;
