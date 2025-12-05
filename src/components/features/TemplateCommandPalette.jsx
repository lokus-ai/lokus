import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { useTemplates, useTemplateProcessor } from "../../hooks/useTemplates.js";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command.jsx";

export default function TemplateCommandPalette({ onSelect, onClose }) {
  const { templates, loading } = useTemplates();
  const { process: processTemplate } = useTemplateProcessor();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter templates based on search
  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelect = async (template) => {
    
    try {
      // Process the template with built-in variables
      const result = await processTemplate(template.id, {}, {
        context: {}
      });
      
      
      // Call onSelect with both template and processed content
      onSelect?.(template, result.result || result.content || result);
      onClose?.();
    } catch (err) {
      // Fallback to raw template content
      onSelect?.(template, template.content);
      onClose?.();
    }
  };

  if (loading) {
    return (
      <Command className="rounded-lg border shadow-md">
        <CommandInput 
          placeholder="Search templates..." 
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>Loading templates...</CommandEmpty>
        </CommandList>
      </Command>
    );
  }

  return (
    <Command className="rounded-lg border shadow-md">
      <CommandInput 
        placeholder="Search templates..." 
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>No templates found.</CommandEmpty>
        <CommandGroup heading="Templates">
          {filteredTemplates.map((template) => (
            <CommandItem
              key={template.id}
              onSelect={() => handleSelect(template)}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer"
            >
              <FileText className="h-4 w-4 text-app-muted" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-app-text">{template.name}</div>
                <div className="text-xs text-app-muted">
                  {template.category}
                  {template.tags.length > 0 && ` • ${template.tags.slice(0, 2).join(', ')}`}
                </div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}