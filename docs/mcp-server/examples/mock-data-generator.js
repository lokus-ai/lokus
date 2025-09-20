#!/usr/bin/env node

/**
 * Mock Data Generator for Lokus MCP Server Testing
 * 
 * This utility generates realistic test data for MCP server development and testing.
 * It creates sample workspaces, files, and configurations that demonstrate the
 * full capabilities of the MCP protocol.
 */

const fs = require('fs').promises;
const path = require('path');
const { faker } = require('@faker-js/faker');

class MockDataGenerator {
  constructor(outputDir = './mock-workspace') {
    this.outputDir = outputDir;
    this.createdFiles = [];
    this.createdResources = [];
    this.createdTools = [];
    this.createdPrompts = [];
  }

  async generateWorkspace(options = {}) {
    const config = {
      fileCount: 50,
      directoryDepth: 3,
      includeBinaryFiles: true,
      includeCodeFiles: true,
      includeDocuments: true,
      includeConfiguration: true,
      includeLargeFiles: false,
      ...options
    };

    console.log('🏗️  Generating mock workspace...');
    
    // Create directory structure
    await this.createDirectoryStructure();
    
    // Generate different types of content
    await this.generateMarkdownNotes(config.fileCount * 0.4);
    await this.generateProjectDocumentation();
    await this.generateMeetingNotes();
    await this.generateResearchNotes();
    await this.generateTodoLists();
    
    if (config.includeCodeFiles) {
      await this.generateCodeFiles();
    }
    
    if (config.includeConfiguration) {
      await this.generateConfigFiles();
    }
    
    if (config.includeBinaryFiles) {
      await this.generateBinaryFiles();
    }
    
    if (config.includeLargeFiles) {
      await this.generateLargeFiles();
    }

    // Generate MCP test data
    await this.generateMCPTestData();
    
    // Create manifest
    await this.createManifest();
    
    console.log(`✅ Generated mock workspace with ${this.createdFiles.length} files`);
    return {
      outputDir: this.outputDir,
      files: this.createdFiles,
      resources: this.createdResources,
      tools: this.createdTools,
      prompts: this.createdPrompts
    };
  }

  async createDirectoryStructure() {
    const directories = [
      'notes',
      'notes/daily',
      'notes/weekly',
      'notes/meetings',
      'notes/research',
      'projects',
      'projects/alpha',
      'projects/beta',
      'projects/archived',
      'documents',
      'documents/templates',
      'documents/drafts',
      'resources',
      'resources/images',
      'resources/data',
      'code',
      'code/scripts',
      'code/samples',
      'config',
      'config/templates',
      'inbox',
      'archive'
    ];

    for (const dir of directories) {
      const fullPath = path.join(this.outputDir, dir);
      await fs.mkdir(fullPath, { recursive: true });
    }
  }

  async generateMarkdownNotes(count = 20) {
    console.log(`📝 Generating ${count} markdown notes...`);
    
    for (let i = 0; i < count; i++) {
      const noteType = faker.helpers.arrayElement(['personal', 'work', 'research', 'ideas']);
      const title = this.generateNoteTitle(noteType);
      const content = this.generateNoteContent(title, noteType);
      
      const fileName = this.sanitizeFileName(title) + '.md';
      const filePath = path.join(this.outputDir, 'notes', fileName);
      
      await this.writeFile(filePath, content);
    }
  }

  generateNoteTitle(type) {
    const titles = {
      personal: [
        'Personal Goals for 2024',
        'Book Recommendations',
        'Travel Ideas',
        'Workout Routine',
        'Weekend Projects',
        'Learning Objectives'
      ],
      work: [
        'Project Alpha Planning',
        'Team Meeting Notes',
        'Client Requirements',
        'Performance Review Notes',
        'Budget Planning',
        'Quarterly Objectives'
      ],
      research: [
        'Machine Learning Trends',
        'Market Research Findings',
        'Technology Evaluation',
        'Competitive Analysis',
        'User Research Insights',
        'Industry Best Practices'
      ],
      ideas: [
        'Product Feature Ideas',
        'Business Opportunities',
        'Process Improvements',
        'Creative Concepts',
        'Innovation Brainstorming',
        'Solution Alternatives'
      ]
    };

    return faker.helpers.arrayElement(titles[type]);
  }

  generateNoteContent(title, type) {
    const date = faker.date.recent(90).toISOString().split('T')[0];
    const tags = this.generateTags(type);
    
    let content = `# ${title}\n\n`;
    content += `**Created:** ${date}\n`;
    content += `**Type:** ${type}\n`;
    content += `**Tags:** ${tags.join(', ')}\n\n`;
    
    // Add structured content based on type
    switch (type) {
      case 'work':
        content += this.generateWorkContent();
        break;
      case 'research':
        content += this.generateResearchContent();
        break;
      case 'ideas':
        content += this.generateIdeasContent();
        break;
      default:
        content += this.generateGeneralContent();
    }
    
    content += this.generateFooter();
    
    return content;
  }

  generateWorkContent() {
    return `## Overview

${faker.lorem.paragraphs(2)}

## Key Points

${this.generateBulletList(3, 6)}

## Action Items

${this.generateTaskList(2, 5)}

## Resources

- [${faker.company.name()} Documentation](${faker.internet.url()})
- [${faker.lorem.words(3)}](${faker.internet.url()})

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Planning | 2 weeks | ✅ Complete |
| Development | 4 weeks | 🔄 In Progress |
| Testing | 2 weeks | ⏳ Pending |
| Deployment | 1 week | ⏳ Pending |

`;
  }

  generateResearchContent() {
    return `## Research Question

${faker.lorem.sentence()}

## Methodology

${faker.lorem.paragraph()}

## Key Findings

${this.generateBulletList(4, 7)}

## Data Points

- **Sample Size:** ${faker.number.int({ min: 100, max: 5000 })}
- **Response Rate:** ${faker.number.int({ min: 60, max: 95 })}%
- **Confidence Level:** 95%

## Implications

${faker.lorem.paragraphs(2)}

## Next Steps

${this.generateTaskList(3, 5)}

`;
  }

  generateIdeasContent() {
    return `## Concept

${faker.lorem.paragraph()}

## Potential Impact

${this.generateBulletList(3, 5)}

## Implementation Ideas

${this.generateBulletList(4, 6)}

## Challenges

${this.generateBulletList(2, 4)}

## Success Metrics

- ${faker.lorem.words(3)}: ${faker.number.int({ min: 10, max: 100 })}%
- ${faker.lorem.words(2)}: ${faker.number.int({ min: 1000, max: 10000 })}
- ${faker.lorem.words(4)}: ${faker.number.float({ min: 1, max: 10, precision: 0.1 })}

`;
  }

  generateGeneralContent() {
    return `## Notes

${faker.lorem.paragraphs(3)}

## Key Points

${this.generateBulletList(3, 6)}

## References

${this.generateBulletList(2, 4)}

`;
  }

  generateBulletList(min, max) {
    const count = faker.number.int({ min, max });
    const items = [];
    
    for (let i = 0; i < count; i++) {
      items.push(`- ${faker.lorem.sentence()}`);
    }
    
    return items.join('\n');
  }

  generateTaskList(min, max) {
    const count = faker.number.int({ min, max });
    const items = [];
    const statuses = ['[ ]', '[x]', '[-]'];
    
    for (let i = 0; i < count; i++) {
      const status = faker.helpers.arrayElement(statuses);
      items.push(`- ${status} ${faker.lorem.sentence()}`);
    }
    
    return items.join('\n');
  }

  generateTags(type) {
    const baseTags = {
      personal: ['personal', 'goals', 'ideas', 'learning'],
      work: ['work', 'project', 'meeting', 'planning'],
      research: ['research', 'analysis', 'data', 'insights'],
      ideas: ['ideas', 'brainstorming', 'innovation', 'concepts']
    };

    const base = baseTags[type] || ['general'];
    const additional = [
      faker.lorem.word(),
      faker.date.recent().getFullYear().toString()
    ];

    return [...base, ...additional];
  }

  generateFooter() {
    return `
---

*Last updated: ${new Date().toISOString().split('T')[0]}*
`;
  }

  async generateProjectDocumentation() {
    console.log('📊 Generating project documentation...');
    
    const projects = ['alpha', 'beta'];
    
    for (const project of projects) {
      const projectDir = path.join(this.outputDir, 'projects', project);
      
      // README
      const readmeContent = `# Project ${project.toUpperCase()}

## Overview

${faker.lorem.paragraphs(2)}

## Features

${this.generateBulletList(5, 8)}

## Architecture

\`\`\`mermaid
graph TD
    A[Client] --> B[API Gateway]
    B --> C[Service Layer]
    C --> D[Database]
\`\`\`

## Getting Started

\`\`\`bash
git clone https://github.com/company/project-${project}.git
cd project-${project}
npm install
npm start
\`\`\`

## API Documentation

### Endpoints

- \`GET /api/users\` - List users
- \`POST /api/users\` - Create user
- \`PUT /api/users/:id\` - Update user
- \`DELETE /api/users/:id\` - Delete user

## Contributing

Please read our [contributing guidelines](CONTRIBUTING.md) before submitting PRs.
`;
      
      await this.writeFile(path.join(projectDir, 'README.md'), readmeContent);
      
      // Project plan
      const planContent = `# ${project.toUpperCase()} Project Plan

## Objectives

${faker.lorem.paragraph()}

## Scope

### In Scope
${this.generateBulletList(4, 6)}

### Out of Scope
${this.generateBulletList(2, 4)}

## Timeline

| Phase | Start Date | End Date | Status |
|-------|------------|----------|--------|
| Planning | 2024-01-01 | 2024-01-15 | ✅ |
| Development | 2024-01-16 | 2024-03-31 | 🔄 |
| Testing | 2024-04-01 | 2024-04-30 | ⏳ |
| Launch | 2024-05-01 | 2024-05-15 | ⏳ |

## Resources

- **Team Size:** ${faker.number.int({ min: 3, max: 8 })} developers
- **Budget:** $${faker.number.int({ min: 50000, max: 200000 })}
- **Duration:** ${faker.number.int({ min: 3, max: 12 })} months

## Risks

${this.generateBulletList(3, 5)}
`;
      
      await this.writeFile(path.join(projectDir, 'project-plan.md'), planContent);
      
      // Technical specifications
      const techSpecContent = `# Technical Specifications - Project ${project.toUpperCase()}

## Technology Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, PostgreSQL
- **Infrastructure:** AWS, Docker, Kubernetes
- **Testing:** Jest, Playwright, Cypress

## System Requirements

### Performance
- Response time: < 200ms for API calls
- Throughput: 1000 requests/second
- Availability: 99.9% uptime

### Security
- OAuth 2.0 authentication
- HTTPS encryption
- Input validation and sanitization
- Regular security audits

## Database Schema

\`\`\`sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## API Design

### Authentication
All API endpoints require Bearer token authentication.

### Error Handling
Standard HTTP status codes with JSON error responses:

\`\`\`json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  }
}
\`\`\`
`;
      
      await this.writeFile(path.join(projectDir, 'technical-spec.md'), techSpecContent);
    }
  }

  async generateMeetingNotes() {
    console.log('🤝 Generating meeting notes...');
    
    const meetingTypes = ['standup', 'planning', 'retrospective', 'review', 'client'];
    
    for (let i = 0; i < 10; i++) {
      const type = faker.helpers.arrayElement(meetingTypes);
      const date = faker.date.recent(30);
      const fileName = `${date.toISOString().split('T')[0]}-${type}-meeting.md`;
      
      const content = `# ${type.charAt(0).toUpperCase() + type.slice(1)} Meeting - ${date.toLocaleDateString()}

**Date:** ${date.toLocaleDateString()}
**Time:** ${faker.number.int({ min: 9, max: 17 })}:${faker.number.int({ min: 0, max: 59 }).toString().padStart(2, '0')}
**Duration:** ${faker.number.int({ min: 30, max: 120 })} minutes
**Location:** ${faker.helpers.arrayElement(['Conference Room A', 'Virtual (Zoom)', 'Office', 'Client Site'])}

## Attendees

${this.generateAttendeeList()}

## Agenda

${this.generateBulletList(3, 6)}

## Discussion Points

### ${faker.lorem.words(3)}
${faker.lorem.paragraph()}

### ${faker.lorem.words(3)}
${faker.lorem.paragraph()}

### ${faker.lorem.words(3)}
${faker.lorem.paragraph()}

## Decisions Made

${this.generateBulletList(2, 4)}

## Action Items

${this.generateActionItems()}

## Next Meeting

**Date:** ${faker.date.future({ years: 0.1 }).toLocaleDateString()}
**Agenda Items:**
${this.generateBulletList(2, 4)}

---
*Meeting notes taken by ${faker.person.fullName()}*
`;
      
      await this.writeFile(path.join(this.outputDir, 'notes', 'meetings', fileName), content);
    }
  }

  generateAttendeeList() {
    const count = faker.number.int({ min: 3, max: 8 });
    const attendees = [];
    
    for (let i = 0; i < count; i++) {
      const name = faker.person.fullName();
      const role = faker.person.jobTitle();
      attendees.push(`- **${name}** - ${role}`);
    }
    
    return attendees.join('\n');
  }

  generateActionItems() {
    const count = faker.number.int({ min: 3, max: 7 });
    const items = [];
    
    for (let i = 0; i < count; i++) {
      const task = faker.lorem.sentence();
      const assignee = faker.person.fullName();
      const dueDate = faker.date.future({ days: 14 }).toLocaleDateString();
      items.push(`- [ ] ${task} (**${assignee}** - Due: ${dueDate})`);
    }
    
    return items.join('\n');
  }

  async generateResearchNotes() {
    console.log('🔬 Generating research notes...');
    
    const topics = [
      'Machine Learning in Healthcare',
      'Sustainable Energy Solutions', 
      'Remote Work Productivity',
      'Cybersecurity Trends',
      'Consumer Behavior Analysis',
      'Market Research Findings'
    ];
    
    for (const topic of topics) {
      const fileName = this.sanitizeFileName(topic) + '.md';
      const content = `# Research: ${topic}

## Executive Summary

${faker.lorem.paragraph()}

## Background

${faker.lorem.paragraphs(2)}

## Methodology

${faker.lorem.paragraph()}

## Key Findings

### Finding 1: ${faker.lorem.words(4)}
${faker.lorem.paragraph()}

**Data:** ${faker.number.int({ min: 65, max: 95 })}% of respondents reported...

### Finding 2: ${faker.lorem.words(4)}
${faker.lorem.paragraph()}

**Data:** Average increase of ${faker.number.int({ min: 15, max: 45 })}% observed...

### Finding 3: ${faker.lorem.words(4)}
${faker.lorem.paragraph()}

**Data:** ${faker.number.int({ min: 3, max: 8 })} out of 10 participants indicated...

## Data Analysis

| Metric | Value | Change |
|--------|-------|--------|
| ${faker.lorem.words(2)} | ${faker.number.int({ min: 100, max: 1000 })} | +${faker.number.int({ min: 5, max: 25 })}% |
| ${faker.lorem.words(2)} | ${faker.number.float({ min: 1, max: 10, precision: 0.1 })} | -${faker.number.int({ min: 2, max: 15 })}% |
| ${faker.lorem.words(2)} | ${faker.number.int({ min: 50, max: 500 })} | +${faker.number.int({ min: 10, max: 40 })}% |

## Implications

${faker.lorem.paragraphs(2)}

## Recommendations

${this.generateBulletList(4, 6)}

## Further Research

${this.generateBulletList(3, 5)}

## References

- ${faker.person.fullName()}. "${faker.lorem.words(5)}." *${faker.company.name()} Journal*, ${faker.date.recent().getFullYear()}.
- ${faker.person.fullName()}. "${faker.lorem.words(4)}." *${faker.lorem.words(2)} Review*, ${faker.date.recent().getFullYear()}.
- ${faker.company.name()}. "${faker.lorem.words(6)}." Research Report, ${faker.date.recent().getFullYear()}.

---
*Research conducted by ${faker.person.fullName()}, ${new Date().toLocaleDateString()}*
`;
      
      await this.writeFile(path.join(this.outputDir, 'notes', 'research', fileName), content);
    }
  }

  async generateTodoLists() {
    console.log('✅ Generating todo lists...');
    
    const lists = [
      'Daily Tasks',
      'Weekly Goals',
      'Project Milestones',
      'Personal Objectives',
      'Learning Plan'
    ];
    
    for (const listName of lists) {
      const fileName = this.sanitizeFileName(listName) + '.md';
      const content = `# ${listName}

**Created:** ${new Date().toLocaleDateString()}
**Priority:** ${faker.helpers.arrayElement(['High', 'Medium', 'Low'])}

## In Progress

${this.generateTaskList(2, 4)}

## Todo

${this.generateTaskList(5, 10)}

## Completed

${this.generateTaskList(3, 7)}

## Notes

${faker.lorem.paragraph()}

## Deadlines

| Task | Due Date | Priority |
|------|----------|----------|
| ${faker.lorem.words(3)} | ${faker.date.future({ days: 7 }).toLocaleDateString()} | High |
| ${faker.lorem.words(4)} | ${faker.date.future({ days: 14 }).toLocaleDateString()} | Medium |
| ${faker.lorem.words(3)} | ${faker.date.future({ days: 21 }).toLocaleDateString()} | Low |

---
*Last updated: ${new Date().toLocaleDateString()}*
`;
      
      await this.writeFile(path.join(this.outputDir, 'notes', fileName), content);
    }
  }

  async generateCodeFiles() {
    console.log('💻 Generating code files...');
    
    // JavaScript example
    const jsContent = `/**
 * Utility functions for data processing
 * Generated for MCP testing purposes
 */

const faker = require('@faker-js/faker');

class DataProcessor {
  constructor(options = {}) {
    this.options = {
      batchSize: 100,
      timeout: 5000,
      retries: 3,
      ...options
    };
  }

  async processData(data) {
    try {
      const results = [];
      
      for (let i = 0; i < data.length; i += this.options.batchSize) {
        const batch = data.slice(i, i + this.options.batchSize);
        const processed = await this.processBatch(batch);
        results.push(...processed);
      }
      
      return results;
    } catch (error) {
      console.error('Data processing failed:', error);
      throw error;
    }
  }

  async processBatch(batch) {
    return batch.map(item => ({
      ...item,
      id: faker.string.uuid(),
      processedAt: new Date().toISOString(),
      status: 'processed'
    }));
  }

  validate(data) {
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array');
    }
    
    return data.every(item => 
      typeof item === 'object' && 
      item !== null
    );
  }
}

module.exports = DataProcessor;
`;
    
    await this.writeFile(path.join(this.outputDir, 'code', 'data-processor.js'), jsContent);
    
    // Python example
    const pythonContent = `#!/usr/bin/env python3
"""
Data analysis utilities
Generated for MCP testing purposes
"""

import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataAnalyzer:
    """Analyze and process data sets"""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.results = []
        
    def analyze_dataset(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze a dataset and return summary statistics"""
        
        if not data:
            return {"error": "No data provided"}
        
        try:
            stats = {
                "count": len(data),
                "fields": self._analyze_fields(data),
                "summary": self._generate_summary(data),
                "analysis_date": datetime.now().isoformat()
            }
            
            logger.info(f"Analyzed dataset with {len(data)} records")
            return stats
            
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            return {"error": str(e)}
    
    def _analyze_fields(self, data: List[Dict]) -> Dict[str, Any]:
        """Analyze field types and patterns"""
        
        if not data:
            return {}
        
        fields = {}
        sample = data[0]
        
        for field in sample.keys():
            field_types = set()
            non_null_count = 0
            
            for record in data:
                value = record.get(field)
                if value is not None:
                    non_null_count += 1
                    field_types.add(type(value).__name__)
            
            fields[field] = {
                "types": list(field_types),
                "non_null_count": non_null_count,
                "null_percentage": (len(data) - non_null_count) / len(data) * 100
            }
        
        return fields
    
    def _generate_summary(self, data: List[Dict]) -> str:
        """Generate a summary of the dataset"""
        
        return f"Dataset contains {len(data)} records with {len(data[0].keys()) if data else 0} fields"


def main():
    """Main function for testing"""
    
    # Sample data
    sample_data = [
        {"id": 1, "name": "Alice", "age": 30, "city": "New York"},
        {"id": 2, "name": "Bob", "age": 25, "city": "San Francisco"},
        {"id": 3, "name": "Charlie", "age": 35, "city": "Chicago"}
    ]
    
    analyzer = DataAnalyzer()
    results = analyzer.analyze_dataset(sample_data)
    
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
`;
    
    await this.writeFile(path.join(this.outputDir, 'code', 'data_analyzer.py'), pythonContent);
    
    // Shell script
    const shellContent = `#!/bin/bash

# Deployment script for MCP server
# Generated for testing purposes

set -e

PROJECT_NAME="lokus-mcp"
DEPLOY_ENV="\${1:-staging}"
VERSION="\${2:-latest}"

echo "🚀 Deploying $PROJECT_NAME to $DEPLOY_ENV (version: $VERSION)"

# Configuration
case "$DEPLOY_ENV" in
  "production")
    SERVER_URL="https://mcp.example.com"
    REPLICAS=3
    ;;
  "staging")
    SERVER_URL="https://mcp-staging.example.com"
    REPLICAS=1
    ;;
  *)
    echo "❌ Unknown environment: $DEPLOY_ENV"
    exit 1
    ;;
esac

echo "📋 Configuration:"
echo "  Environment: $DEPLOY_ENV"
echo "  Server URL: $SERVER_URL"
echo "  Replicas: $REPLICAS"
echo "  Version: $VERSION"

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running"
    exit 1
fi

# Build and deploy
echo "🏗️  Building application..."
docker build -t "$PROJECT_NAME:$VERSION" .

echo "🚀 Deploying to $DEPLOY_ENV..."
docker tag "$PROJECT_NAME:$VERSION" "$PROJECT_NAME:$DEPLOY_ENV"

# Health check
echo "🏥 Performing health check..."
sleep 5

if curl -f "$SERVER_URL/health" &> /dev/null; then
    echo "✅ Deployment successful!"
else
    echo "❌ Health check failed"
    exit 1
fi

echo "🎉 Deployment completed successfully!"
`;
    
    await this.writeFile(path.join(this.outputDir, 'code', 'scripts', 'deploy.sh'), shellContent);
  }

  async generateConfigFiles() {
    console.log('⚙️  Generating configuration files...');
    
    // Package.json
    const packageJson = {
      name: "mock-workspace",
      version: "1.0.0",
      description: "Mock workspace for MCP testing",
      scripts: {
        start: "node server.js",
        test: "jest",
        build: "webpack --mode production",
        dev: "webpack-dev-server --mode development"
      },
      dependencies: {
        express: "^4.18.0",
        "body-parser": "^1.20.0",
        cors: "^2.8.5",
        helmet: "^6.0.0"
      },
      devDependencies: {
        jest: "^29.0.0",
        webpack: "^5.70.0",
        "webpack-cli": "^4.9.0"
      }
    };
    
    await this.writeFile(
      path.join(this.outputDir, 'config', 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Environment config
    const envConfig = `# Environment Configuration

# Server
PORT=3001
HOST=localhost
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mock_db
DB_USER=admin
DB_PASSWORD=password123

# Redis
REDIS_URL=redis://localhost:6379

# API Keys
API_KEY=mock-api-key-12345
JWT_SECRET=super-secret-jwt-key

# Features
ENABLE_LOGGING=true
ENABLE_METRICS=true
ENABLE_RATE_LIMITING=true

# MCP Server
MCP_SERVER_ENABLED=true
MCP_SERVER_PORT=3001
MCP_MAX_CONNECTIONS=100
MCP_TIMEOUT=30000
`;
    
    await this.writeFile(path.join(this.outputDir, 'config', '.env.example'), envConfig);
    
    // Docker compose
    const dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - PORT=3001
    volumes:
      - ./workspace:/app/workspace
      - ./config:/app/config
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: mock_db
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
`;
    
    await this.writeFile(path.join(this.outputDir, 'config', 'docker-compose.yml'), dockerCompose);
  }

  async generateBinaryFiles() {
    console.log('📁 Generating sample binary files...');
    
    // Create simple SVG files
    const svgContent = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="${faker.color.rgb()}" />
  <text x="50" y="55" text-anchor="middle" fill="white" font-family="Arial" font-size="12">
    ${faker.lorem.word()}
  </text>
</svg>`;
    
    await this.writeFile(path.join(this.outputDir, 'resources', 'images', 'sample.svg'), svgContent);
    
    // Create CSV data file
    const csvData = ['Name,Age,City,Occupation'];
    for (let i = 0; i < 100; i++) {
      csvData.push([
        faker.person.fullName(),
        faker.number.int({ min: 18, max: 65 }),
        faker.location.city(),
        faker.person.jobTitle()
      ].join(','));
    }
    
    await this.writeFile(
      path.join(this.outputDir, 'resources', 'data', 'sample-data.csv'),
      csvData.join('\n')
    );
    
    // Create JSON data file
    const jsonData = {
      metadata: {
        generated: new Date().toISOString(),
        version: '1.0',
        records: 50
      },
      data: Array.from({ length: 50 }, () => ({
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        company: faker.company.name(),
        phone: faker.phone.number(),
        address: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          zip: faker.location.zipCode()
        },
        metadata: {
          createdAt: faker.date.recent().toISOString(),
          isActive: faker.datatype.boolean(),
          score: faker.number.float({ min: 0, max: 100, precision: 0.1 })
        }
      }))
    };
    
    await this.writeFile(
      path.join(this.outputDir, 'resources', 'data', 'sample-data.json'),
      JSON.stringify(jsonData, null, 2)
    );
  }

  async generateLargeFiles() {
    console.log('📚 Generating large files...');
    
    // Generate a large text file
    const largeContent = Array.from({ length: 1000 }, () => faker.lorem.paragraphs(5)).join('\n\n');
    
    await this.writeFile(
      path.join(this.outputDir, 'resources', 'large-document.txt'),
      largeContent
    );
    
    // Generate large CSV
    const largeCsvHeaders = ['ID', 'Name', 'Email', 'Company', 'Revenue', 'Employees', 'Industry', 'Founded', 'Location'];
    const largeCsvData = [largeCsvHeaders.join(',')];
    
    for (let i = 0; i < 5000; i++) {
      largeCsvData.push([
        i + 1,
        faker.company.name(),
        faker.internet.email(),
        faker.company.name(),
        faker.number.int({ min: 100000, max: 50000000 }),
        faker.number.int({ min: 10, max: 10000 }),
        faker.commerce.department(),
        faker.date.between({ from: '1950-01-01', to: '2020-12-31' }).getFullYear(),
        faker.location.city()
      ].join(','));
    }
    
    await this.writeFile(
      path.join(this.outputDir, 'resources', 'data', 'large-dataset.csv'),
      largeCsvData.join('\n')
    );
  }

  async generateMCPTestData() {
    console.log('🔧 Generating MCP test data...');
    
    // Generate sample resources
    this.createdResources = [
      {
        uri: 'file:///workspace/notes/project-alpha.md',
        name: 'Project Alpha Notes',
        description: 'Development notes for Project Alpha',
        type: 'file',
        mimeType: 'text/markdown',
        lastModified: new Date().toISOString()
      },
      {
        uri: 'file:///workspace/resources/data/sample-data.json',
        name: 'Sample Dataset',
        description: 'Generated sample data for testing',
        type: 'file',
        mimeType: 'application/json',
        lastModified: new Date().toISOString()
      },
      {
        uri: 'database://local/users',
        name: 'User Database',
        description: 'Local user database',
        type: 'database',
        mimeType: 'application/sql',
        lastModified: new Date().toISOString()
      }
    ];
    
    // Generate sample tools
    this.createdTools = [
      {
        name: 'search_files',
        description: 'Search for files in the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            fileTypes: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'File types to include'
            },
            includeContent: { type: 'boolean', description: 'Include file content in results' }
          },
          required: ['query']
        }
      },
      {
        name: 'create_note',
        description: 'Create a new note file',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Note title' },
            content: { type: 'string', description: 'Note content' },
            tags: { 
              type: 'array',
              items: { type: 'string' },
              description: 'Note tags'
            }
          },
          required: ['title', 'content']
        }
      },
      {
        name: 'analyze_data',
        description: 'Analyze data from CSV or JSON files',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to data file' },
            analysisType: { 
              type: 'string',
              enum: ['summary', 'correlation', 'distribution'],
              description: 'Type of analysis to perform'
            }
          },
          required: ['filePath', 'analysisType']
        }
      }
    ];
    
    // Generate sample prompts
    this.createdPrompts = [
      {
        name: 'summarize_content',
        description: 'Summarize the given content',
        template: 'Please summarize the following content in {{maxLength}} words or less:\n\n{{content}}',
        arguments: [
          { name: 'content', description: 'Content to summarize', required: true },
          { name: 'maxLength', description: 'Maximum length of summary', required: false }
        ]
      },
      {
        name: 'meeting_agenda',
        description: 'Generate a meeting agenda',
        template: 'Create a meeting agenda for "{{meetingTitle}}" with the following participants: {{participants}}.\n\nKey topics to cover:\n{{topics}}\n\nMeeting duration: {{duration}} minutes',
        arguments: [
          { name: 'meetingTitle', description: 'Title of the meeting', required: true },
          { name: 'participants', description: 'List of participants', required: true },
          { name: 'topics', description: 'Topics to discuss', required: true },
          { name: 'duration', description: 'Meeting duration in minutes', required: false }
        ]
      },
      {
        name: 'code_review',
        description: 'Generate code review comments',
        template: 'Please review the following {{language}} code and provide feedback:\n\n```{{language}}\n{{code}}\n```\n\nFocus on: {{focusAreas}}',
        arguments: [
          { name: 'code', description: 'Code to review', required: true },
          { name: 'language', description: 'Programming language', required: true },
          { name: 'focusAreas', description: 'Areas to focus on during review', required: false }
        ]
      }
    ];
    
    // Save MCP test data
    const mcpTestData = {
      resources: this.createdResources,
      tools: this.createdTools,
      prompts: this.createdPrompts,
      metadata: {
        generated: new Date().toISOString(),
        version: '1.0.0',
        protocol: '2024-11-05'
      }
    };
    
    await this.writeFile(
      path.join(this.outputDir, 'mcp-test-data.json'),
      JSON.stringify(mcpTestData, null, 2)
    );
  }

  async createManifest() {
    const manifest = {
      name: 'Mock Workspace',
      version: '1.0.0',
      description: 'Generated mock workspace for MCP server testing',
      generated: new Date().toISOString(),
      generator: 'Lokus Mock Data Generator',
      statistics: {
        totalFiles: this.createdFiles.length,
        fileTypes: this.getFileTypeStats(),
        directories: this.getDirectoryStats(),
        totalSize: await this.calculateTotalSize()
      },
      structure: {
        notes: 'Personal and work notes in Markdown format',
        projects: 'Project documentation and planning files',
        documents: 'Formal documents and templates',
        resources: 'Data files, images, and other resources',
        code: 'Code samples and scripts',
        config: 'Configuration files and templates',
        inbox: 'Incoming files and temporary storage',
        archive: 'Archived content'
      },
      mcpData: {
        resources: this.createdResources.length,
        tools: this.createdTools.length,
        prompts: this.createdPrompts.length
      }
    };

    await this.writeFile(
      path.join(this.outputDir, 'MANIFEST.json'),
      JSON.stringify(manifest, null, 2)
    );
  }

  getFileTypeStats() {
    const stats = {};
    
    this.createdFiles.forEach(file => {
      const ext = path.extname(file.path).toLowerCase();
      stats[ext] = (stats[ext] || 0) + 1;
    });
    
    return stats;
  }

  getDirectoryStats() {
    const dirs = new Set();
    
    this.createdFiles.forEach(file => {
      const dir = path.dirname(file.path);
      dirs.add(dir);
    });
    
    return dirs.size;
  }

  async calculateTotalSize() {
    let totalSize = 0;
    
    for (const file of this.createdFiles) {
      try {
        const stats = await fs.stat(file.path);
        totalSize += stats.size;
      } catch (error) {
        // File might not exist, skip
      }
    }
    
    return totalSize;
  }

  async writeFile(filePath, content) {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf8');
      
      this.createdFiles.push({
        path: filePath,
        relativePath: path.relative(this.outputDir, filePath),
        size: Buffer.byteLength(content, 'utf8'),
        type: path.extname(filePath),
        created: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`Error writing file ${filePath}:`, error);
      throw error;
    }
  }

  sanitizeFileName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const outputDir = args[0] || './mock-workspace';
  
  console.log(`🎯 Generating mock workspace in: ${outputDir}`);
  
  const generator = new MockDataGenerator(outputDir);
  
  try {
    const result = await generator.generateWorkspace({
      fileCount: 50,
      includeCodeFiles: true,
      includeConfiguration: true,
      includeBinaryFiles: true,
      includeLargeFiles: false
    });
    
    console.log(`\n✅ Mock workspace generated successfully!`);
    console.log(`📁 Output directory: ${result.outputDir}`);
    console.log(`📄 Files created: ${result.files.length}`);
    console.log(`🔧 MCP resources: ${result.resources.length}`);
    console.log(`🛠️  MCP tools: ${result.tools.length}`);
    console.log(`💬 MCP prompts: ${result.prompts.length}`);
    
    console.log(`\n🚀 You can now use this workspace to test the MCP server:`);
    console.log(`   cd ${outputDir}`);
    console.log(`   # Start your MCP server pointing to this directory`);
    
  } catch (error) {
    console.error('❌ Error generating mock workspace:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = MockDataGenerator;