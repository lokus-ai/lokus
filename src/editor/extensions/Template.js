import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-plugin';
import { Decoration, DecorationSet } from 'prosemirror-view';

/**
 * Template Extension for TipTap Editor
 * 
 * Features:
 * - Template variable highlighting
 * - Cursor placeholder support
 * - Template insertion handling
 * - Variable validation
 */

const templatePluginKey = new PluginKey('template');

export const Template = Extension.create({
  name: 'template',

  addOptions() {
    return {
      // Variable pattern to match {{variable}}
      variablePattern: /\{\{([^}]+)\}\}/g,
      
      // JavaScript block pattern to match <% code %>
      jsBlockPattern: /<%\s*([\s\S]*?)\s*%>/g,
      
      // Comment pattern to match <%# comment %>
      commentPattern: /<%#[\s\S]*?%>/g,
      
      // CSS classes for styling
      variableClass: 'template-variable',
      jsBlockClass: 'template-js-block',
      commentClass: 'template-comment',
      invalidClass: 'template-invalid',
      cursorPlaceholderClass: 'template-cursor-placeholder',
      
      // Whether to highlight template syntax
      highlightSyntax: true,
      
      // Whether to validate variables
      validateVariables: true,
      
      // Built-in variables that don't need validation
      builtinVariables: [
        'date', 'time', 'datetime', 'timestamp', 'isodate', 'isotime',
        'date.short', 'date.long', 'date.year', 'date.month', 'date.day', 'date.weekday',
        'user', 'cursor', 'selection', 'uuid', 'random', 'randomInt',
        'app.name', 'app.version', 'title', 'filename', 'filepath'
      ],
      
      // Callback for when cursor placeholder is found
      onCursorPlaceholder: null,
      
      // Callback for variable validation
      onVariableValidation: null
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          templateVariable: {
            default: null,
            parseHTML: element => element.getAttribute('data-template-variable'),
            renderHTML: attributes => {
              if (!attributes.templateVariable) {
                return {};
              }
              return {
                'data-template-variable': attributes.templateVariable,
                class: this.options.variableClass
              };
            }
          }
        }
      }
    ];
  },

  addCommands() {
    return {
      insertTemplate: (content) => ({ tr, state, dispatch }) => {
        if (dispatch) {
          // Process template content for cursor placeholder
          const processedContent = this.processTemplateCursor(content);
          tr.insertText(processedContent);
        }
        return true;
      },

      insertTemplateVariable: (variableName) => ({ tr, state, dispatch }) => {
        if (dispatch) {
          const variable = `{{${variableName}}}`;
          tr.insertText(variable);
        }
        return true;
      },

      highlightTemplateVariables: () => ({ tr, state, dispatch }) => {
        if (dispatch) {
          // Trigger decoration update
          tr.setMeta(templatePluginKey, { action: 'highlight' });
        }
        return true;
      },

      insertCursorPlaceholder: () => ({ tr, state, dispatch }) => {
        if (dispatch) {
          tr.insertText('{{cursor}}');
        }
        return true;
      }
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: templatePluginKey,
        
        state: {
          init(config, state) {
            return {
              decorations: options.highlightSyntax ? this.buildDecorations(state.doc, options) : DecorationSet.empty,
              variables: new Set(),
              cursorPlaceholders: []
            };
          },

          apply(tr, pluginState, oldState, newState) {
            // Check if document changed or highlighting was requested
            const docChanged = !oldState.doc.eq(newState.doc);
            const highlightRequested = tr.getMeta(templatePluginKey)?.action === 'highlight';

            if (docChanged || highlightRequested) {
              return {
                decorations: options.highlightSyntax ? this.buildDecorations(newState.doc, options) : DecorationSet.empty,
                variables: this.extractVariables(newState.doc, options),
                cursorPlaceholders: this.findCursorPlaceholders(newState.doc)
              };
            }

            // Map decorations through the changes
            return {
              ...pluginState,
              decorations: pluginState.decorations.map(tr.mapping, tr.doc)
            };
          },

          buildDecorations(doc, options) {
            const decorations = [];
            
            // Walk through all text nodes in the document
            doc.descendants((node, pos) => {
              if (node.isText) {
                const text = node.text;
                
                // Find template variables
                this.findMatches(text, options.variablePattern, (match, start, end) => {
                  const from = pos + start;
                  const to = pos + end;
                  const variableName = match[1].trim();
                  
                  // Check if it's a cursor placeholder
                  if (variableName === 'cursor') {
                    decorations.push(
                      Decoration.inline(from, to, {
                        class: `${options.variableClass} ${options.cursorPlaceholderClass}`,
                        'data-variable': variableName,
                        'data-type': 'cursor-placeholder'
                      })
                    );
                  } else {
                    // Regular variable
                    const isBuiltin = options.builtinVariables.includes(variableName.split('||')[0].trim());
                    const classes = [options.variableClass];
                    
                    if (!isBuiltin && options.validateVariables) {
                      // Could be invalid if not defined
                      classes.push(options.invalidClass);
                    }
                    
                    decorations.push(
                      Decoration.inline(from, to, {
                        class: classes.join(' '),
                        'data-variable': variableName,
                        'data-type': 'variable',
                        'data-builtin': isBuiltin.toString()
                      })
                    );
                  }
                });

                // Find JavaScript blocks
                this.findMatches(text, options.jsBlockPattern, (match, start, end) => {
                  const from = pos + start;
                  const to = pos + end;
                  
                  decorations.push(
                    Decoration.inline(from, to, {
                      class: options.jsBlockClass,
                      'data-type': 'js-block'
                    })
                  );
                });

                // Find comments
                this.findMatches(text, options.commentPattern, (match, start, end) => {
                  const from = pos + start;
                  const to = pos + end;
                  
                  decorations.push(
                    Decoration.inline(from, to, {
                      class: options.commentClass,
                      'data-type': 'comment'
                    })
                  );
                });
              }
            });

            return DecorationSet.create(doc, decorations);
          },

          findMatches(text, pattern, callback) {
            let match;
            // Reset regex state
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(text)) !== null) {
              callback(match, match.index, match.index + match[0].length);
            }
          },

          extractVariables(doc, options) {
            const variables = new Set();
            
            doc.descendants((node) => {
              if (node.isText) {
                const text = node.text;
                let match;
                
                // Reset regex state
                options.variablePattern.lastIndex = 0;
                
                while ((match = options.variablePattern.exec(text)) !== null) {
                  const variableName = match[1].trim();
                  // Extract variable name (before any || default value)
                  const cleanName = variableName.split('||')[0].trim();
                  variables.add(cleanName);
                }
              }
            });

            return variables;
          },

          findCursorPlaceholders(doc) {
            const placeholders = [];
            
            doc.descendants((node, pos) => {
              if (node.isText) {
                const text = node.text;
                let match;
                
                // Reset regex state
                const cursorPattern = /\{\{cursor\}\}/g;
                
                while ((match = cursorPattern.exec(text)) !== null) {
                  placeholders.push({
                    pos: pos + match.index,
                    end: pos + match.index + match[0].length
                  });
                }
              }
            });

            return placeholders;
          }
        },

        props: {
          decorations(state) {
            return this.getState(state)?.decorations;
          },

          // Handle clicks on template elements
          handleClick(view, pos, event) {
            const pluginState = templatePluginKey.getState(view.state);
            if (!pluginState) return false;

            // Check if click is on a template decoration
            const decorations = pluginState.decorations.find(pos, pos);
            
            for (const decoration of decorations) {
              const spec = decoration.spec;
              
              if (spec['data-type'] === 'cursor-placeholder') {
                // Handle cursor placeholder click
                if (options.onCursorPlaceholder) {
                  options.onCursorPlaceholder(pos, view);
                }
                return true;
              }
              
              if (spec['data-type'] === 'variable') {
                // Handle variable click
                const variableName = spec['data-variable'];
                if (options.onVariableValidation) {
                  options.onVariableValidation(variableName, pos, view);
                }
                return true;
              }
            }

            return false;
          }
        },

        // Plugin view for custom behavior
        view(editorView) {
          return {
            update(view, prevState) {
              const pluginState = templatePluginKey.getState(view.state);
              if (!pluginState) return;

              // Notify about cursor placeholders
              if (pluginState.cursorPlaceholders.length > 0 && options.onCursorPlaceholder) {
                pluginState.cursorPlaceholders.forEach(placeholder => {
                  options.onCursorPlaceholder(placeholder.pos, view);
                });
              }
            },

            destroy() {
              // Cleanup if needed
            }
          };
        }
      })
    ];
  },

  // Helper methods
  processTemplateCursor(content) {
    // Find cursor placeholder and prepare for positioning
    const cursorPlaceholder = '{{cursor}}';
    const cursorIndex = content.indexOf(cursorPlaceholder);
    
    if (cursorIndex !== -1) {
      // Remove cursor placeholder for insertion
      return content.replace(cursorPlaceholder, '');
    }
    
    return content;
  },

  onUpdate() {
    // Called when editor content updates
    if (this.options.highlightSyntax) {
      // Trigger highlighting update
      this.editor.commands.highlightTemplateVariables();
    }
  }
});

export default Template;