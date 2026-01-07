/**
 * Email to Note Conversion Utilities
 * 
 * This module provides functionality to convert Gmail emails into markdown notes
 * that can be saved and managed within the Lokus workspace.
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Sanitizes a string to be used as a filename
 * @param {string} str - The string to sanitize
 * @returns {string} - A filesystem-safe filename
 */
function sanitizeFilename(str) {
  if (!str || typeof str !== 'string') return 'untitled';

  return str
    .replace(/[<>:"/\\|?*]/g, '') // Remove illegal filename characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/\.+$/, '') // Remove trailing dots
    .trim()
    .substring(0, 100) // Limit length
    || 'untitled';
}

/**
 * Formats a date for use in the note
 * @param {string|Date} date - The date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  if (!date) return 'Unknown date';

  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'Invalid date';

    return dateObj.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Extracts plain text from HTML content
 * @param {string} html - HTML content
 * @returns {string} - Plain text content
 */
function extractTextFromHtml(html) {
  if (!html || typeof html !== 'string') return '';

  // Basic HTML tag removal and entity decoding
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove style tags
    .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Decode ampersands
    .replace(/&lt;/g, '<') // Decode less than
    .replace(/&gt;/g, '>') // Decode greater than
    .replace(/&quot;/g, '"') // Decode quotes
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec)) // Decode numeric entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Converts email attachments info to markdown
 * @param {Array} attachments - Array of attachment objects
 * @returns {string} - Markdown representation of attachments
 */
function formatAttachments(attachments) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return '';
  }

  const attachmentList = attachments
    .map(attachment => {
      const name = attachment.filename || attachment.name || 'Unknown file';
      const size = attachment.size ? ` (${formatFileSize(attachment.size)})` : '';
      const type = attachment.mimeType || attachment.type || '';

      return `- **${name}**${size}${type ? ` - ${type}` : ''}`;
    })
    .join('\n');

  return `\n## Attachments\n\n${attachmentList}\n`;
}

/**
 * Formats file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Converts a Gmail email object to markdown format
 * @param {Object} email - Gmail email object
 * @param {Object} options - Conversion options
 * @returns {string} - Markdown content
 */
export function emailToMarkdown(email, options = {}) {
  const {
    includeHeaders = true,
    includeThreadInfo = true,
    includeAttachments = true,
    includeMetadata = true,
    customTemplate = null
  } = options;

  if (!email) {
    throw new Error('Email object is required');
  }

  // Extract email data with fallbacks
  const subject = email.subject || email.snippet || 'No Subject';
  const from = email.from || email.fromEmail || 'Unknown Sender';
  const to = email.to || email.toEmail || 'Unknown Recipient';
  const date = formatDate(email.date || email.internalDate || email.timestamp);
  const body = email.body || email.textPlain || email.htmlBody || email.snippet || '';

  // Use custom template if provided
  if (customTemplate && typeof customTemplate === 'function') {
    return customTemplate(email, options);
  }

  let markdown = '';

  // Add frontmatter metadata
  if (includeMetadata) {
    markdown += '---\n';
    markdown += `title: "${subject.replace(/"/g, '\\"')}"\n`;
    markdown += `type: email\n`;
    markdown += `source: gmail\n`;
    markdown += `from: "${from.replace(/"/g, '\\"')}"\n`;
    markdown += `to: "${to.replace(/"/g, '\\"')}"\n`;
    markdown += `date: "${date}"\n`;
    markdown += `messageId: "${email.id || email.messageId || ''}"\n`;
    if (email.threadId) {
      markdown += `threadId: "${email.threadId}"\n`;
    }
    if (email.labels && Array.isArray(email.labels)) {
      markdown += `labels: [${email.labels.map(label => `"${label}"`).join(', ')}]\n`;
    }
    markdown += '---\n\n';
  }

  // Add title
  markdown += `# ${subject}\n\n`;

  // Add email headers
  if (includeHeaders) {
    markdown += '## Email Details\n\n';
    markdown += `**From:** ${from}\n`;
    markdown += `**To:** ${to}\n`;
    markdown += `**Date:** ${date}\n`;

    if (email.cc) {
      markdown += `**CC:** ${email.cc}\n`;
    }
    if (email.bcc) {
      markdown += `**BCC:** ${email.bcc}\n`;
    }
    if (email.replyTo) {
      markdown += `**Reply-To:** ${email.replyTo}\n`;
    }

    markdown += '\n';
  }

  // Add thread information
  if (includeThreadInfo && email.threadId) {
    markdown += '## Thread Information\n\n';
    markdown += `**Thread ID:** ${email.threadId}\n`;
    if (email.threadSubject && email.threadSubject !== subject) {
      markdown += `**Thread Subject:** ${email.threadSubject}\n`;
    }
    markdown += '\n';
  }

  // Add email body
  markdown += '## Content\n\n';

  // Process HTML or plain text body
  if (email.htmlBody && body.includes('<')) {
    const textContent = extractTextFromHtml(body);
    markdown += textContent || 'No content available';
  } else {
    markdown += body || 'No content available';
  }

  markdown += '\n\n';

  // Add attachments
  if (includeAttachments && email.attachments) {
    markdown += formatAttachments(email.attachments);
  }

  // Add tags based on labels
  if (email.labels && Array.isArray(email.labels) && email.labels.length > 0) {
    markdown += '## Tags\n\n';
    const tags = email.labels
      .filter(label => !['INBOX', 'UNREAD', 'IMPORTANT'].includes(label))
      .map(label => `#${label.toLowerCase().replace(/\s+/g, '-')}`)
      .join(' ');
    if (tags) {
      markdown += `${tags}\n\n`;
    }
  }

  // Add footer with conversion info
  markdown += '---\n\n';
  markdown += `*Converted from Gmail on ${new Date().toLocaleDateString()}*\n`;

  return markdown;
}

/**
 * Generates a suggested filename for the email note
 * @param {Object} email - Gmail email object
 * @param {Object} options - Filename generation options
 * @returns {string} - Suggested filename
 */
export function generateEmailFilename(email, options = {}) {
  const {
    includeDate = true,
    includeSender = true,
    maxLength = 80,
    prefix = '',
    suffix = ''
  } = options;

  if (!email) {
    return 'email-note.md';
  }

  let filename = '';

  // Add prefix
  if (prefix) {
    filename += `${sanitizeFilename(prefix)}-`;
  }

  // Add date
  if (includeDate && (email.date || email.internalDate)) {
    try {
      const date = new Date(email.date || email.internalDate);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      filename += `${dateStr}-`;
    } catch (err) {
      console.error('emailToNote: Failed to format date', err);
    }
  }

  // Add sender info
  if (includeSender && email.from) {
    const senderName = email.from.replace(/<.*?>/, '').trim();
    const sanitizedSender = sanitizeFilename(senderName);
    if (sanitizedSender && sanitizedSender !== 'untitled') {
      filename += `${sanitizedSender}-`;
    }
  }

  // Add subject
  const subject = email.subject || email.snippet || 'no-subject';
  filename += sanitizeFilename(subject);

  // Add suffix
  if (suffix) {
    filename += `-${sanitizeFilename(suffix)}`;
  }

  // Ensure .md extension
  if (!filename.endsWith('.md')) {
    filename += '.md';
  }

  // Limit length
  if (filename.length > maxLength) {
    const extension = '.md';
    const maxBaseLength = maxLength - extension.length;
    filename = filename.substring(0, maxBaseLength) + extension;
  }

  return filename;
}

/**
 * Saves an email as a note in the workspace
 * @param {Object} email - Gmail email object
 * @param {string} workspacePath - Path to the workspace
 * @param {Object} options - Save options
 * @returns {Promise<string>} - Path to the saved note
 */
export async function saveEmailAsNote(email, workspacePath, options = {}) {
  const {
    customPath = null,
    customFilename = null,
    subfolder = 'emails',
    ...conversionOptions
  } = options;

  if (!email) {
    throw new Error('Email object is required');
  }

  if (!workspacePath) {
    throw new Error('Workspace path is required');
  }

  try {
    // Generate markdown content
    const markdown = emailToMarkdown(email, conversionOptions);

    // Determine the file path
    let filePath;
    if (customPath) {
      filePath = customPath;
    } else {
      const filename = customFilename || generateEmailFilename(email, options);

      if (subfolder) {
        filePath = `${workspacePath}/${subfolder}/${filename}`;

        // Ensure the subfolder exists
        try {
          await invoke('create_directory', { path: `${workspacePath}/${subfolder}` });
        } catch (error) {
          // Directory might already exist, which is fine, but log as debug
          console.debug('emailToNote: Directory creation suppressed error', error);
        }
      } else {
        filePath = `${workspacePath}/${filename}`;
      }
    }

    // Save the file
    await invoke('write_file_content', {
      path: filePath,
      content: markdown
    });

    return filePath;
  } catch (error) {
    throw new Error(`Failed to save email as note: ${error.message}`);
  }
}

/**
 * Converts multiple emails to notes
 * @param {Array} emails - Array of Gmail email objects
 * @param {string} workspacePath - Path to the workspace
 * @param {Object} options - Conversion options
 * @returns {Promise<Array>} - Array of saved file paths
 */
export async function saveEmailsAsNotes(emails, workspacePath, options = {}) {
  const {
    batchSize = 5,
    onProgress = null,
    ...saveOptions
  } = options;

  if (!Array.isArray(emails) || emails.length === 0) {
    throw new Error('Emails array is required and must not be empty');
  }

  const results = [];
  const total = emails.length;

  // Process emails in batches to avoid overwhelming the system
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const batchPromises = batch.map(async (email, index) => {
      try {
        const filePath = await saveEmailAsNote(email, workspacePath, saveOptions);

        // Report progress
        if (onProgress) {
          onProgress({
            current: i + index + 1,
            total,
            email,
            filePath,
            success: true
          });
        }

        return { email, filePath, success: true };
      } catch (error) {

        // Report progress
        if (onProgress) {
          onProgress({
            current: i + index + 1,
            total,
            email,
            error: error.message,
            success: false
          });
        }

        return { email, error: error.message, success: false };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay between batches
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Creates a custom template function for email conversion
 * @param {string} template - Template string with placeholders
 * @returns {Function} - Template function
 */
export function createEmailTemplate(template) {
  return (email, options) => {
    let result = template;

    // Replace placeholders
    const replacements = {
      '{{subject}}': email.subject || 'No Subject',
      '{{from}}': email.from || 'Unknown Sender',
      '{{to}}': email.to || 'Unknown Recipient',
      '{{date}}': formatDate(email.date || email.internalDate),
      '{{body}}': email.body || email.textPlain || email.snippet || 'No content',
      '{{id}}': email.id || email.messageId || '',
      '{{threadId}}': email.threadId || '',
      '{{labels}}': (email.labels || []).join(', ')
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }

    return result;
  };
}

export default {
  emailToMarkdown,
  generateEmailFilename,
  saveEmailAsNote,
  saveEmailsAsNotes,
  createEmailTemplate
};