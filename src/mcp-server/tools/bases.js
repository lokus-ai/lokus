/**
 * Bases (Database) Tools for MCP
 * Tools for working with Lokus Bases - structured data views
 */

import { readFile, writeFile, readdir, mkdir } from "fs/promises";
import { join } from "path";

export const basesTools = [
  {
    name: "list_bases",
    description: "List all bases (databases) in the workspace",
    inputSchema: {
      type: "object",
      properties: {},
    }
  },
  {
    name: "get_base",
    description: "Get details of a specific base including schema and records",
    inputSchema: {
      type: "object",
      properties: {
        baseName: {
          type: "string",
          description: "Name of the base"
        }
      },
      required: ["baseName"]
    }
  },
  {
    name: "create_base",
    description: "Create a new base with specified schema",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the new base"
        },
        schema: {
          type: "object",
          description: "Schema definition for the base",
          properties: {
            fields: {
              type: "array",
              description: "Field definitions"
            }
          }
        },
        description: {
          type: "string",
          description: "Description of the base"
        }
      },
      required: ["name", "schema"]
    }
  },
  {
    name: "add_base_record",
    description: "Add a new record to a base",
    inputSchema: {
      type: "object",
      properties: {
        baseName: {
          type: "string",
          description: "Name of the base"
        },
        record: {
          type: "object",
          description: "Record data"
        }
      },
      required: ["baseName", "record"]
    }
  },
  {
    name: "query_base",
    description: "Query records from a base with filters",
    inputSchema: {
      type: "object",
      properties: {
        baseName: {
          type: "string",
          description: "Name of the base"
        },
        filter: {
          type: "object",
          description: "Filter criteria"
        },
        sort: {
          type: "object",
          description: "Sort criteria"
        },
        limit: {
          type: "number",
          description: "Maximum records to return"
        }
      },
      required: ["baseName"]
    }
  },
  {
    name: "update_base_record",
    description: "Update a record in a base",
    inputSchema: {
      type: "object",
      properties: {
        baseName: {
          type: "string",
          description: "Name of the base"
        },
        recordId: {
          type: "string",
          description: "ID of the record to update"
        },
        updates: {
          type: "object",
          description: "Fields to update"
        }
      },
      required: ["baseName", "recordId", "updates"]
    }
  },
  {
    name: "delete_base_record",
    description: "Delete a record from a base",
    inputSchema: {
      type: "object",
      properties: {
        baseName: {
          type: "string",
          description: "Name of the base"
        },
        recordId: {
          type: "string",
          description: "ID of the record to delete"
        }
      },
      required: ["baseName", "recordId"]
    }
  },
  {
    name: "get_base_stats",
    description: "Get statistics about a base",
    inputSchema: {
      type: "object",
      properties: {
        baseName: {
          type: "string",
          description: "Name of the base"
        }
      },
      required: ["baseName"]
    }
  }
];

export async function executeBaseTool(tool, args, workspace, apiUrl) {
  switch (tool) {
    case "list_bases":
      return await listBases(workspace);

    case "get_base":
      return await getBase(workspace, args.baseName);

    case "create_base":
      return await createBase(workspace, args);

    case "add_base_record":
      return await addBaseRecord(workspace, args);

    case "query_base":
      return await queryBase(workspace, args);

    case "update_base_record":
      return await updateBaseRecord(workspace, args);

    case "delete_base_record":
      return await deleteBaseRecord(workspace, args);

    case "get_base_stats":
      return await getBaseStats(workspace, args.baseName);

    default:
      throw new Error(`Unknown bases tool: ${tool}`);
  }
}

async function listBases(workspace) {
  const basesDir = join(workspace, '.lokus', 'bases');

  try {
    const entries = await readdir(basesDir, { withFileTypes: true });
    const bases = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const baseName = entry.name.replace('.json', '');
        try {
          const content = await readFile(join(basesDir, entry.name), 'utf-8');
          const base = JSON.parse(content);
          bases.push({
            name: baseName,
            recordCount: base.records ? base.records.length : 0,
            fields: base.schema?.fields?.length || 0,
            description: base.description
          });
        } catch (e) {
          // Skip invalid bases
        }
      }
    }

    return {
      content: [{
        type: "text",
        text: `**Bases in Workspace:**\n\n${
          bases.length > 0
            ? bases.map(b => `📊 **${b.name}**\n  - Records: ${b.recordCount}\n  - Fields: ${b.fields}\n  - ${b.description || 'No description'}`).join('\n\n')
            : 'No bases found in this workspace'
        }`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: "Bases feature not configured in this workspace"
      }]
    };
  }
}

async function getBase(workspace, baseName) {
  const basePath = join(workspace, '.lokus', 'bases', `${baseName}.json`);

  try {
    const content = await readFile(basePath, 'utf-8');
    const base = JSON.parse(content);

    return {
      content: [{
        type: "text",
        text: `**Base: ${baseName}**\n
Description: ${base.description || 'No description'}
Created: ${base.created || 'Unknown'}
Modified: ${base.modified || 'Unknown'}

**Schema:**
${base.schema?.fields?.map(f => `- ${f.name} (${f.type})`).join('\n') || 'No schema defined'}

**Records (${base.records?.length || 0}):**
${base.records?.slice(0, 5).map(r => JSON.stringify(r)).join('\n') || 'No records'}
${base.records?.length > 5 ? `\n... and ${base.records.length - 5} more records` : ''}`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `Base "${baseName}" not found`
      }]
    };
  }
}

async function createBase(workspace, { name, schema, description }) {
  const basesDir = join(workspace, '.lokus', 'bases');
  const basePath = join(basesDir, `${name}.json`);

  // Ensure bases directory exists
  await mkdir(basesDir, { recursive: true });

  const base = {
    name,
    description,
    schema,
    records: [],
    created: new Date().toISOString(),
    modified: new Date().toISOString()
  };

  await writeFile(basePath, JSON.stringify(base, null, 2));

  return {
    content: [{
      type: "text",
      text: `✅ Base "${name}" created successfully with ${schema.fields?.length || 0} fields`
    }]
  };
}

async function addBaseRecord(workspace, { baseName, record }) {
  const basePath = join(workspace, '.lokus', 'bases', `${baseName}.json`);

  try {
    const content = await readFile(basePath, 'utf-8');
    const base = JSON.parse(content);

    // Add ID if not present
    if (!record.id) {
      record.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Add timestamps
    record.created = new Date().toISOString();
    record.modified = new Date().toISOString();

    base.records = base.records || [];
    base.records.push(record);
    base.modified = new Date().toISOString();

    await writeFile(basePath, JSON.stringify(base, null, 2));

    return {
      content: [{
        type: "text",
        text: `✅ Record added to base "${baseName}" with ID: ${record.id}`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to add record: ${e.message}`
      }]
    };
  }
}

async function queryBase(workspace, { baseName, filter = {}, sort = null, limit = 100 }) {
  const basePath = join(workspace, '.lokus', 'bases', `${baseName}.json`);

  try {
    const content = await readFile(basePath, 'utf-8');
    const base = JSON.parse(content);

    let results = base.records || [];

    // Apply filters
    if (Object.keys(filter).length > 0) {
      results = results.filter(record => {
        for (const [key, value] of Object.entries(filter)) {
          if (record[key] !== value) return false;
        }
        return true;
      });
    }

    // Apply sorting
    if (sort) {
      const sortField = Object.keys(sort)[0];
      const sortOrder = sort[sortField];
      results.sort((a, b) => {
        if (sortOrder === 'asc') {
          return a[sortField] > b[sortField] ? 1 : -1;
        } else {
          return a[sortField] < b[sortField] ? 1 : -1;
        }
      });
    }

    // Apply limit
    results = results.slice(0, limit);

    return {
      content: [{
        type: "text",
        text: `**Query Results (${results.length} records):**\n\n${
          results.map(r => JSON.stringify(r, null, 2)).join('\n---\n')
        }`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `❌ Query failed: ${e.message}`
      }]
    };
  }
}

async function updateBaseRecord(workspace, { baseName, recordId, updates }) {
  const basePath = join(workspace, '.lokus', 'bases', `${baseName}.json`);

  try {
    const content = await readFile(basePath, 'utf-8');
    const base = JSON.parse(content);

    const recordIndex = base.records?.findIndex(r => r.id === recordId);
    if (recordIndex === -1) {
      throw new Error(`Record with ID ${recordId} not found`);
    }

    // Update record
    base.records[recordIndex] = {
      ...base.records[recordIndex],
      ...updates,
      id: recordId, // Preserve ID
      modified: new Date().toISOString()
    };

    base.modified = new Date().toISOString();

    await writeFile(basePath, JSON.stringify(base, null, 2));

    return {
      content: [{
        type: "text",
        text: `✅ Record ${recordId} updated in base "${baseName}"`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `❌ Update failed: ${e.message}`
      }]
    };
  }
}

async function deleteBaseRecord(workspace, { baseName, recordId }) {
  const basePath = join(workspace, '.lokus', 'bases', `${baseName}.json`);

  try {
    const content = await readFile(basePath, 'utf-8');
    const base = JSON.parse(content);

    const initialLength = base.records?.length || 0;
    base.records = base.records?.filter(r => r.id !== recordId) || [];

    if (base.records.length === initialLength) {
      throw new Error(`Record with ID ${recordId} not found`);
    }

    base.modified = new Date().toISOString();

    await writeFile(basePath, JSON.stringify(base, null, 2));

    return {
      content: [{
        type: "text",
        text: `✅ Record ${recordId} deleted from base "${baseName}"`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `❌ Delete failed: ${e.message}`
      }]
    };
  }
}

async function getBaseStats(workspace, baseName) {
  const basePath = join(workspace, '.lokus', 'bases', `${baseName}.json`);

  try {
    const content = await readFile(basePath, 'utf-8');
    const base = JSON.parse(content);

    const stats = {
      recordCount: base.records?.length || 0,
      fieldCount: base.schema?.fields?.length || 0,
      created: base.created,
      modified: base.modified,
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      fieldTypes: {}
    };

    // Count field types
    if (base.schema?.fields) {
      for (const field of base.schema.fields) {
        stats.fieldTypes[field.type] = (stats.fieldTypes[field.type] || 0) + 1;
      }
    }

    // Calculate fill rate for each field
    if (base.records?.length > 0) {
      stats.fillRates = {};
      for (const field of base.schema?.fields || []) {
        const filledCount = base.records.filter(r => r[field.name] != null).length;
        stats.fillRates[field.name] = `${((filledCount / base.records.length) * 100).toFixed(1)}%`;
      }
    }

    return {
      content: [{
        type: "text",
        text: `**Base Statistics: ${baseName}**\n
📊 Records: ${stats.recordCount}
📋 Fields: ${stats.fieldCount}
📅 Created: ${stats.created}
🔄 Modified: ${stats.modified}
💾 Size: ${(stats.sizeBytes / 1024).toFixed(2)} KB

**Field Types:**
${Object.entries(stats.fieldTypes).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

${stats.fillRates ? `**Field Fill Rates:**\n${Object.entries(stats.fillRates).map(([field, rate]) => `- ${field}: ${rate}`).join('\n')}` : ''}`
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: `❌ Failed to get stats: ${e.message}`
      }]
    };
  }
}