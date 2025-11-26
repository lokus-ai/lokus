/**
 * Template Management Tools for MCP
 * Tools for creating and managing templates in Lokus
 */

import { readFile, writeFile, readdir, stat, mkdir, unlink } from "fs/promises";
import { join } from "path";

export const templatesTools = [
  {
    name: "list_templates",
    description: "List all templates in the workspace",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category (optional)"
        }
      }
    }
  },
  {
    name: "create_template",
    description: "Create a new template with proper frontmatter. Templates support variables like {{date}}, {{time}}, {{cursor}}, {{title}}, and custom variables.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Unique template ID (lowercase, hyphenated)"
        },
        name: {
          type: "string",
          description: "Display name for the template"
        },
        content: {
          type: "string",
          description: "Template content with variables (e.g., {{date}}, {{time}}, {{cursor}})"
        },
        category: {
          type: "string",
          description: "Category for organization (Personal, Work, Documentation, etc.)",
          default: "Personal"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for categorization"
        }
      },
      required: ["id", "name", "content"]
    }
  },
  {
    name: "read_template",
    description: "Read a template's content and metadata",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Template ID"
        }
      },
      required: ["id"]
    }
  },
  {
    name: "update_template",
    description: "Update an existing template",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Template ID"
        },
        name: {
          type: "string",
          description: "New name (optional)"
        },
        content: {
          type: "string",
          description: "New content (optional)"
        },
        category: {
          type: "string",
          description: "New category (optional)"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "New tags (optional)"
        }
      },
      required: ["id"]
    }
  },
  {
    name: "delete_template",
    description: "Delete a template",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Template ID to delete"
        }
      },
      required: ["id"]
    }
  }
];

/**
 * Execute template tool commands
 */
export async function executeTemplateTool(toolName, args, workspace, apiUrl) {
  const templatesDir = join(workspace, "templates");

  // Ensure templates directory exists
  try {
    await mkdir(templatesDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  switch (toolName) {
    case "list_templates":
      return await listTemplates(templatesDir, args);

    case "create_template":
      return await createTemplate(templatesDir, args);

    case "read_template":
      return await readTemplate(templatesDir, args);

    case "update_template":
      return await updateTemplate(templatesDir, args);

    case "delete_template":
      return await deleteTemplate(templatesDir, args);

    default:
      throw new Error(`Unknown template tool: ${toolName}`);
  }
}

/**
 * List all templates
 */
async function listTemplates(templatesDir, args) {
  try {
    const files = await readdir(templatesDir);
    const templates = [];

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      try {
        const filePath = join(templatesDir, file);
        const content = await readFile(filePath, 'utf-8');
        const parsed = parseTemplateFile(content, file);

        // Filter by category if specified
        if (!args.category || parsed.category === args.category) {
          templates.push({
            id: parsed.id,
            name: parsed.name,
            category: parsed.category,
            tags: parsed.tags,
            createdAt: parsed.createdAt,
            updatedAt: parsed.updatedAt
          });
        }
      } catch (error) {
        // Skip files that can't be parsed
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ templates, total: templates.length }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error listing templates: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Create a new template
 */
async function createTemplate(templatesDir, args) {
  try {
    const { id, name, content, category = "Personal", tags = [] } = args;

    // Validate ID format
    if (!/^[a-z0-9-_]+$/.test(id)) {
      throw new Error("Template ID must be lowercase alphanumeric with hyphens/underscores");
    }

    const filename = `${id}.md`;
    const filePath = join(templatesDir, filename);

    // Create YAML frontmatter
    const now = new Date().toISOString();
    const frontmatter = createFrontmatter({
      id,
      name,
      category,
      tags,
      createdAt: now,
      updatedAt: now
    });

    // Combine frontmatter and content
    const fileContent = `---\n${frontmatter}---\n\n${content}`;

    // Write file
    await writeFile(filePath, fileContent, 'utf-8');

    return {
      content: [
        {
          type: "text",
          text: `Template "${name}" created successfully!\n\nID: ${id}\nFile: ${filePath}\n\n**Important**: The template has been created as a file, but to see it in the UI:\n1. Open Template Manager in Lokus\n2. Click the "Refresh" button\n3. The template will now appear in the list\n\nAlternatively, restart the Lokus app to load the new template.`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error creating template: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Read a template
 */
async function readTemplate(templatesDir, args) {
  try {
    const { id } = args;
    const filePath = join(templatesDir, `${id}.md`);

    const content = await readFile(filePath, 'utf-8');
    const parsed = parseTemplateFile(content, `${id}.md`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(parsed, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error reading template: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Update a template
 */
async function updateTemplate(templatesDir, args) {
  try {
    const { id, name, content, category, tags } = args;
    const filePath = join(templatesDir, `${id}.md`);

    // Read existing template
    const existingContent = await readFile(filePath, 'utf-8');
    const existing = parseTemplateFile(existingContent, `${id}.md`);

    // Merge updates
    const updated = {
      id: existing.id,
      name: name || existing.name,
      content: content || existing.content,
      category: category || existing.category,
      tags: tags || existing.tags,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };

    // Create new file content
    const frontmatter = createFrontmatter(updated);
    const fileContent = `---\n${frontmatter}---\n\n${updated.content}`;

    // Write updated file
    await writeFile(filePath, fileContent, 'utf-8');

    return {
      content: [
        {
          type: "text",
          text: `Template "${updated.name}" updated successfully!\n\n**Remember to refresh the Template Manager** to see the changes.`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error updating template: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Delete a template
 */
async function deleteTemplate(templatesDir, args) {
  try {
    const { id } = args;
    const filePath = join(templatesDir, `${id}.md`);

    await unlink(filePath);

    return {
      content: [
        {
          type: "text",
          text: `Template "${id}" deleted successfully!\n\n**Remember to refresh the Template Manager** to see the changes.`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error deleting template: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Create YAML frontmatter from template metadata
 */
function createFrontmatter(metadata) {
  let yaml = '';
  yaml += `id: ${metadata.id}\n`;
  yaml += `name: "${metadata.name}"\n`;
  yaml += `category: ${metadata.category}\n`;

  if (metadata.tags && metadata.tags.length > 0) {
    yaml += `tags:\n`;
    metadata.tags.forEach(tag => {
      yaml += `  - ${tag}\n`;
    });
  } else {
    yaml += `tags: []\n`;
  }

  yaml += `createdAt: ${metadata.createdAt}\n`;
  yaml += `updatedAt: ${metadata.updatedAt}\n`;

  return yaml;
}

/**
 * Parse template file (frontmatter + content)
 */
function parseTemplateFile(content, filename) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    // No frontmatter, treat entire content as template
    const id = filename.replace('.md', '');
    return {
      id,
      name: id,
      content: content.trim(),
      category: 'Personal',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  const frontmatterText = match[1];
  const templateContent = match[2].trim();
  const metadata = parseFrontmatter(frontmatterText);

  return {
    id: metadata.id || filename.replace('.md', ''),
    name: metadata.name || metadata.id || filename.replace('.md', ''),
    content: templateContent,
    category: metadata.category || 'Personal',
    tags: metadata.tags || [],
    createdAt: metadata.createdAt || new Date().toISOString(),
    updatedAt: metadata.updatedAt || new Date().toISOString()
  };
}

/**
 * Simple YAML frontmatter parser
 */
function parseFrontmatter(text) {
  const lines = text.split('\n');
  const metadata = {};
  let currentKey = null;
  let currentArray = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Array item
    if (trimmed.startsWith('- ')) {
      if (currentKey) {
        currentArray.push(trimmed.substring(2).trim());
      }
      continue;
    }

    // Save previous array
    if (currentKey && currentArray.length > 0) {
      metadata[currentKey] = currentArray;
      currentArray = [];
      currentKey = null;
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > -1) {
      const key = trimmed.substring(0, colonIndex).trim();
      let value = trimmed.substring(colonIndex + 1).trim();

      // Remove quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }

      // Empty array
      if (value === '[]') {
        metadata[key] = [];
      }
      // Start of array
      else if (!value) {
        currentKey = key;
        currentArray = [];
      }
      // Simple value
      else {
        metadata[key] = value;
      }
    }
  }

  // Save last array
  if (currentKey && currentArray.length > 0) {
    metadata[currentKey] = currentArray;
  }

  return metadata;
}
