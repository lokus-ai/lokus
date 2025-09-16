# Feature Documentation Template

Use this template when creating documentation for new features in Lokus. This ensures consistency and completeness across all feature documentation.

## File Naming Convention
- Use kebab-case for file names: `feature-name.md`
- Place in appropriate directory: `/docs/features/`
- Use descriptive names that match the feature

## Template Structure

```markdown
# Feature Name

Brief description of what this feature does and its primary benefits. Keep this to 1-2 sentences that clearly explain the feature's purpose.

## Overview

The [feature name] provides:
- **Key capability 1** - Brief description
- **Key capability 2** - Brief description  
- **Key capability 3** - Brief description
- **Key capability 4** - Brief description
- **Key capability 5** - Brief description
- **Key capability 6** - Brief description

## Getting Started / Opening [Feature]

### Access Methods
List all ways to access this feature:
- **Keyboard Shortcut**: `⌘K` (macOS) / `Ctrl+K` (Windows/Linux)
- **Command Palette**: Search for "[Feature Name]" in Command Palette (`⌘K`)
- **Menu Path**: Menu → Submenu → Feature Name
- **UI Element**: Click [specific UI element] in [location]

### Interface Layout
Describe the main interface elements:
- **Primary Area** - Main interaction space
- **Control Panel** - Settings and options
- **Information Display** - Status and feedback
- **Navigation Elements** - How to move around

## Core Features

### Primary Feature Category
Describe the main functionality:

#### Specific Feature 1
- **Description** - What this specific feature does
- **Usage** - How to use it
- **Options** - Available configuration options
- **Examples** - Practical examples

#### Specific Feature 2
- **Description** - What this specific feature does
- **Usage** - How to use it
- **Options** - Available configuration options
- **Examples** - Practical examples

### Secondary Feature Category
[Repeat structure as needed]

## Advanced Features

### Advanced Capability 1
Describe more complex or power-user features:
- Technical details
- Advanced configuration
- Expert usage patterns

### Advanced Capability 2
[Continue as needed]

## Configuration and Settings

### Feature Preferences
Access feature settings through [location]:

#### Category 1
- **Setting Name** - Description and options
- **Another Setting** - Description and options

#### Category 2
[Continue pattern]

### Customization Options
- **Option 1** - How to customize this aspect
- **Option 2** - How to customize this aspect

## Integration with Other Features

### Feature Integration 1
How this feature works with other Lokus features:
- **Interaction Description** - How they work together
- **Benefits** - What this integration provides
- **Usage Examples** - Practical examples

### Feature Integration 2
[Continue pattern]

## Performance and Optimization

### Performance Features
- **Optimization 1** - How the feature is optimized
- **Optimization 2** - Performance considerations

### Large Data Handling
If applicable, describe how feature handles large amounts of data:
- **Scaling strategies**
- **Memory management**
- **User considerations**

## Accessibility

### Keyboard Navigation
- **Full Keyboard Support** - Description of keyboard accessibility
- **Specific Shortcuts** - List important keyboard shortcuts
- **Navigation Patterns** - How to navigate with keyboard

### Screen Reader Support
- **ARIA Support** - How screen readers interact with feature
- **Announcements** - What gets announced to users
- **Context Information** - How context is provided

### Visual Accessibility
- **High Contrast** - High contrast mode support
- **Color Independence** - Features not dependent on color
- **Focus Indicators** - Visual focus indication
- **Scaling Support** - How feature scales with font size

## Use Cases and Examples

### Use Case 1
Describe a specific use case:
- **Scenario** - When/why someone would use this
- **Step-by-step** - How to accomplish the task
- **Tips** - Best practices for this use case

### Use Case 2
[Continue pattern]

## Troubleshooting

### Common Issues

**Issue description:**
- Possible causes
- Step-by-step solution
- Prevention tips

**Another issue:**
[Continue pattern]

### Performance Tips
1. **Tip 1** - Specific actionable advice
2. **Tip 2** - Another optimization tip
3. **Tip 3** - Additional best practice

## Best Practices

### Workflow Optimization
1. **Practice 1** - Specific recommendation
2. **Practice 2** - Another best practice
3. **Practice 3** - Additional guidance

### Organization Tips
1. **Tip 1** - How to stay organized with this feature
2. **Tip 2** - Another organizational strategy

## Advanced Usage

### Power User Features
Describe advanced techniques for experienced users:
- **Advanced Technique 1**
- **Advanced Technique 2**

### API/Extension Points
If applicable, describe how developers can extend the feature:
- **Extension Points**
- **API References**

## Related Features

List related features with brief descriptions:
- **[Related Feature 1](./related-feature-1.md)** - How it relates
- **[Related Feature 2](./related-feature-2.md)** - How it relates
- **[Related Feature 3](./related-feature-3.md)** - How it relates

---

*For technical implementation details, see the [Feature API Documentation](../api/feature-api.md).*
```

## Guidelines for Using This Template

### Content Guidelines
1. **Be Specific** - Use concrete examples and specific instructions
2. **User-Focused** - Write from the user's perspective, not the developer's
3. **Complete Coverage** - Cover all aspects of the feature thoroughly
4. **Practical Examples** - Include real-world usage examples
5. **Consistent Terminology** - Use consistent terms throughout

### Writing Style
- **Active Voice** - Use active voice for instructions
- **Clear Language** - Avoid technical jargon when possible
- **Scannable Format** - Use headers, lists, and formatting for easy scanning
- **Progressive Disclosure** - Start simple, then add complexity
- **Cross-References** - Link to related features and concepts

### Section Guidelines

#### Overview Section
- List 4-6 key capabilities
- Use bullet points with bold labels
- Keep descriptions brief but informative
- Focus on user benefits

#### Core Features Section
- Break down into logical categories
- Use consistent subsection structure
- Include practical examples
- Provide step-by-step instructions

#### Advanced Features Section
- Cover power-user functionality
- Include technical details when necessary
- Provide expert usage patterns
- Link to API documentation when relevant

#### Troubleshooting Section
- Address common user issues
- Provide clear solutions
- Include prevention tips
- Offer performance optimization advice

### Technical Considerations
- **Screenshots** - Include screenshots when they add value
- **Code Examples** - Use proper code formatting
- **Version Information** - Note when features were added
- **Platform Differences** - Highlight any platform-specific behavior

### Maintenance
- **Regular Updates** - Update documentation when features change
- **User Feedback** - Incorporate user feedback and questions
- **Accuracy Checks** - Verify examples and instructions work correctly
- **Link Maintenance** - Ensure all links are current and functional

## Checklist for New Feature Documentation

Before publishing feature documentation, verify:

- [ ] All sections from template are included or marked as not applicable
- [ ] Examples are tested and work correctly
- [ ] Screenshots are current and high quality
- [ ] Links to related features are correct
- [ ] Accessibility information is complete
- [ ] Troubleshooting covers common issues
- [ ] Language is clear and user-friendly
- [ ] Content is organized logically
- [ ] Cross-references are accurate
- [ ] Technical details are correct

## Review Process
1. **Technical Review** - Verify technical accuracy
2. **User Experience Review** - Ensure documentation serves users well
3. **Editorial Review** - Check grammar, style, and clarity
4. **Accessibility Review** - Verify accessibility information is complete
5. **Final Approval** - Get final approval before publishing

---

*This template should be used for all new feature documentation to ensure consistency and quality across the Lokus documentation ecosystem.*