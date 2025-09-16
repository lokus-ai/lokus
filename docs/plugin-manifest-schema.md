# Plugin Manifest Schema Documentation

## Overview

The plugin manifest (`plugin.json`) is the configuration file that defines your plugin's metadata, dependencies, permissions, and capabilities. Lokus supports both V1 and V2 manifest formats, with V2 being the recommended format for new plugins.

## Schema Validation

All manifests are validated against the Lokus Plugin Manifest Schema. Invalid manifests will prevent plugin loading.

## V2 Manifest Format (Recommended)

### Required Fields

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "main": "index.js",
  "lokusVersion": "^1.0.0"
}
```

#### Field Descriptions

- **`id`** (string): Unique plugin identifier. Must be lowercase, start with a letter, contain only letters, numbers, and hyphens.
- **`name`** (string): Human-readable plugin name displayed in the UI.
- **`version`** (string): Plugin version following semantic versioning (e.g., "1.0.0").
- **`main`** (string): Entry point file (must be .js, .mjs, or .ts).
- **`lokusVersion`** (string): Compatible Lokus version range (e.g., "^1.0.0", ">=1.0.0").

### Optional Fields

#### Basic Metadata

```json
{
  "description": "A comprehensive plugin that demonstrates various capabilities",
  "author": {
    "name": "Jane Developer",
    "email": "jane@example.com",
    "url": "https://janedeveloper.com"
  },
  "license": "MIT",
  "homepage": "https://github.com/jane/my-plugin",
  "repository": {
    "type": "git",
    "url": "https://github.com/jane/my-plugin.git"
  },
  "keywords": ["editor", "productivity", "formatting"],
  "icon": "assets/icon.png",
  "galleryBanner": {
    "color": "#007ACC",
    "theme": "dark"
  }
}
```

#### Plugin Classification

```json
{
  "categories": ["Editor", "Formatter"],
  "preview": false,
  "qna": "marketplace"
}
```

#### Permissions and Security

```json
{
  "permissions": [
    "read_files",
    "write_files",
    "modify_ui",
    "access_settings"
  ]
}
```

**Available Permissions:**
- `read_files`: Read files from filesystem
- `write_files`: Write files to filesystem
- `execute_commands`: Execute system commands
- `access_network`: Make network requests
- `modify_ui`: Modify application UI
- `access_settings`: Access application settings
- `access_vault`: Access vault/workspace
- `all`: All permissions (dangerous - use with caution)

#### Activation Events

```json
{
  "activationEvents": [
    "onStartup",
    "onCommand:my-command",
    "onFileType:markdown",
    "onView:editor",
    "workspaceContains:*.md"
  ]
}
```

**Available Activation Events:**
- `onStartup`: Activate on app startup
- `onCommand:*`: Activate on specific command
- `onLanguage:*`: Activate for specific language
- `onFileType:*`: Activate for specific file type
- `onView:*`: Activate when view is opened
- `onUri:*`: Activate on URI scheme
- `onWebviewPanel:*`: Activate on webview panel
- `workspaceContains:*`: Activate when workspace contains pattern

#### Plugin Dependencies

```json
{
  "dependencies": {
    "other-plugin": "^1.0.0",
    "utility-plugin": ">=2.0.0"
  }
}
```

#### Engine Compatibility

```json
{
  "engines": {
    "lokus": ">=1.0.0",
    "node": ">=16.0.0"
  }
}
```

#### Plugin Contributions

```json
{
  "contributes": {
    "commands": [
      {
        "command": "my-plugin.action",
        "title": "Execute Action",
        "category": "My Plugin"
      }
    ],
    "menus": {
      "editor/context": [
        {
          "command": "my-plugin.action",
          "when": "editorTextFocus",
          "group": "editing"
        }
      ]
    },
    "keybindings": [
      {
        "command": "my-plugin.action",
        "key": "ctrl+shift+a",
        "mac": "cmd+shift+a"
      }
    ],
    "configuration": {
      "type": "object",
      "title": "My Plugin Configuration",
      "properties": {
        "myPlugin.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable My Plugin"
        }
      }
    }
  }
}
```

## Complete V2 Example

```json
{
  "id": "advanced-word-processor",
  "name": "Advanced Word Processor",
  "version": "2.1.0",
  "description": "Professional word processing features including advanced formatting, citations, and document templates",
  "main": "dist/index.js",
  "lokusVersion": "^1.2.0",
  
  "author": {
    "name": "DocumentTech Solutions",
    "email": "support@documenttech.com",
    "url": "https://documenttech.com"
  },
  
  "license": "MIT",
  "homepage": "https://github.com/documenttech/lokus-word-processor",
  "repository": {
    "type": "git",
    "url": "https://github.com/documenttech/lokus-word-processor.git"
  },
  
  "keywords": [
    "word processor",
    "formatting",
    "citations",
    "templates",
    "academic writing"
  ],
  
  "icon": "assets/icon.svg",
  "galleryBanner": {
    "color": "#2E7D32",
    "theme": "dark"
  },
  
  "categories": ["Editor", "Formatter"],
  "preview": false,
  "qna": "marketplace",
  
  "permissions": [
    "read_files",
    "write_files",
    "modify_ui",
    "access_settings",
    "access_network"
  ],
  
  "activationEvents": [
    "onStartup",
    "onFileType:docx",
    "onFileType:markdown",
    "onCommand:word-processor.format"
  ],
  
  "dependencies": {
    "citation-manager": "^1.5.0"
  },
  
  "engines": {
    "lokus": ">=1.2.0",
    "node": ">=16.0.0"
  },
  
  "contributes": {
    "commands": [
      {
        "command": "word-processor.insertCitation",
        "title": "Insert Citation",
        "category": "Word Processor"
      },
      {
        "command": "word-processor.formatDocument",
        "title": "Format Document",
        "category": "Word Processor"
      }
    ],
    
    "menus": {
      "editor/context": [
        {
          "command": "word-processor.insertCitation",
          "when": "editorTextFocus",
          "group": "citations"
        }
      ],
      "editor/title": [
        {
          "command": "word-processor.formatDocument",
          "when": "resourceExtname == .md",
          "group": "formatting"
        }
      ]
    },
    
    "keybindings": [
      {
        "command": "word-processor.insertCitation",
        "key": "ctrl+shift+c",
        "mac": "cmd+shift+c",
        "when": "editorTextFocus"
      }
    ],
    
    "configuration": {
      "type": "object",
      "title": "Advanced Word Processor",
      "properties": {
        "wordProcessor.citationStyle": {
          "type": "string",
          "enum": ["APA", "MLA", "Chicago", "IEEE"],
          "default": "APA",
          "description": "Default citation style"
        },
        "wordProcessor.autoFormat": {
          "type": "boolean",
          "default": true,
          "description": "Enable automatic formatting"
        },
        "wordProcessor.templateDirectory": {
          "type": "string",
          "default": "",
          "description": "Directory containing document templates"
        }
      }
    },
    
    "views": {
      "explorer": [
        {
          "id": "wordProcessor.citations",
          "name": "Citations",
          "when": "workspaceHasDocuments"
        }
      ]
    }
  }
}
```

## V1 Manifest Format (Legacy)

For backward compatibility, Lokus still supports V1 manifests:

```json
{
  "name": "Word Count Plugin",
  "id": "word-count-plugin",
  "version": "1.0.0",
  "description": "Shows live word count and reading time",
  "author": "Lokus Team",
  "main": "index.js",
  "permissions": [
    "editor:read",
    "ui:sidebar",
    "ui:statusbar"
  ],
  "ui": {
    "sidebar": {
      "title": "Word Count",
      "position": "right",
      "icon": "counter",
      "defaultOpen": false
    },
    "statusbar": {
      "position": "right",
      "priority": 10
    }
  },
  "settings": {
    "showCharacterCount": {
      "type": "boolean",
      "default": true,
      "label": "Show Character Count"
    },
    "wordsPerMinute": {
      "type": "number",
      "default": 200,
      "min": 100,
      "max": 500,
      "label": "Reading Speed (WPM)"
    }
  },
  "engines": {
    "lokus": ">=1.0.0"
  }
}
```

## Validation Rules

### Field Constraints

1. **ID Format**: `/^[a-z][a-z0-9-]*[a-z0-9]$/`
2. **Version Format**: Semantic versioning (`/^\d+\.\d+\.\d+(-[\w\.-]+)?(\+[\w\.-]+)?$/`)
3. **Email Format**: Standard email validation
4. **URL Format**: Valid HTTP/HTTPS URLs
5. **File Extensions**: Main file must be `.js`, `.mjs`, or `.ts`

### Common Validation Errors

1. **Invalid Plugin ID**: Must be lowercase, start with letter, contain only letters/numbers/hyphens
2. **Invalid Version**: Must follow semantic versioning format
3. **Missing Required Fields**: id, name, version, main, lokusVersion are required
4. **Invalid Permissions**: Unknown permission values
5. **Invalid Activation Events**: Unknown activation event patterns
6. **Circular Dependencies**: Plugin cannot depend on itself
7. **Invalid Categories**: Must be from predefined list

### Validation Example

```javascript
import { validateManifest } from '@lokus/plugin-manifest';

const manifest = {
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",
  main: "index.js",
  lokusVersion: "^1.0.0"
};

const result = validateManifest(manifest);

if (result.valid) {
  console.log('Manifest is valid');
} else {
  console.error('Validation errors:', result.errors);
  console.warn('Validation warnings:', result.warnings);
}
```

## Best Practices

### Naming and Identification

1. **Unique IDs**: Use descriptive, unique plugin IDs
2. **Clear Names**: Use human-readable names that describe functionality
3. **Consistent Versioning**: Follow semantic versioning strictly
4. **Meaningful Descriptions**: Provide clear, concise descriptions

### Security and Permissions

1. **Minimal Permissions**: Only request necessary permissions
2. **Specific Activation**: Use specific activation events when possible
3. **Safe Dependencies**: Audit plugin dependencies
4. **Permission Documentation**: Document why permissions are needed

### Metadata Quality

1. **Complete Information**: Fill in optional fields for better discoverability
2. **Keywords**: Use relevant keywords for marketplace search
3. **Categories**: Choose appropriate categories
4. **Homepage/Repository**: Provide links to documentation and source code

### Configuration Schema

1. **Clear Property Names**: Use descriptive configuration property names
2. **Sensible Defaults**: Provide reasonable default values
3. **Type Safety**: Specify correct types for all properties
4. **Help Text**: Include descriptions for all configuration options

## Migration from V1 to V2

### Mapping Changes

| V1 Field | V2 Field | Notes |
|----------|----------|--------|
| `permissions` | `permissions` | Same format |
| `ui` | `contributes.views` | Restructured |
| `settings` | `contributes.configuration` | Moved to contributes |
| `engines.lokus` | `lokusVersion` | Renamed |

### Migration Example

V1 Manifest:
```json
{
  "permissions": ["editor:read"],
  "ui": {
    "sidebar": {
      "title": "My Panel",
      "position": "right"
    }
  },
  "settings": {
    "enabled": {
      "type": "boolean",
      "default": true
    }
  }
}
```

V2 Equivalent:
```json
{
  "permissions": ["read_files"],
  "contributes": {
    "views": {
      "explorer": [
        {
          "id": "myPlugin.panel",
          "name": "My Panel"
        }
      ]
    },
    "configuration": {
      "properties": {
        "myPlugin.enabled": {
          "type": "boolean",
          "default": true
        }
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Manifest Not Found**: Ensure `plugin.json` exists in plugin root
2. **Invalid JSON**: Validate JSON syntax
3. **Missing Fields**: Check all required fields are present
4. **Permission Errors**: Verify permission names are correct
5. **Version Conflicts**: Ensure lokusVersion compatibility

### Debugging Tips

1. Use the manifest validator before publishing
2. Test with different Lokus versions
3. Validate JSON syntax with online tools
4. Check plugin logs for detailed error messages

## Related Documentation

- [Plugin Development Guide](./plugin-development-guide.md)
- [Plugin API Reference](./plugin-api-reference.md)
- [Sample Plugins](./sample-plugins/)
- [Troubleshooting Guide](./plugin-troubleshooting.md)