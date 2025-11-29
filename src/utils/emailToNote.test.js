import { describe, it, expect, vi, beforeEach } from 'vitest'
import { emailToMarkdown, generateEmailFilename, saveEmailAsNote } from './emailToNote'

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}))

import { invoke } from '@tauri-apps/api/core'

describe('emailToNote', () => {
    const mockEmail = {
        id: '123',
        subject: 'Test Subject',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        date: '2023-01-01T12:00:00Z',
        body: 'Test Body',
        snippet: 'Test Snippet'
    }

    describe('emailToMarkdown', () => {
        it('should convert email to markdown', () => {
            const markdown = emailToMarkdown(mockEmail)
            expect(markdown).toContain('# Test Subject')
            expect(markdown).toContain('**From:** sender@example.com')
            expect(markdown).toContain('Test Body')
        })

        it('should handle missing fields', () => {
            const emptyEmail = { id: '456' }
            const markdown = emailToMarkdown(emptyEmail)
            expect(markdown).toContain('# No Subject')
            expect(markdown).toContain('Unknown Sender')
        })
    })

    describe('generateEmailFilename', () => {
        it('should generate filename with date and subject', () => {
            const filename = generateEmailFilename(mockEmail)
            expect(filename).toContain('Test_Subject')
            expect(filename).toContain('2023-01-01')
            expect(filename).toMatch(/\.md$/)
        })

        it('should sanitize filename', () => {
            const dirtyEmail = { ...mockEmail, subject: 'Test/Subject: With Special Chars' }
            const filename = generateEmailFilename(dirtyEmail)
            expect(filename).not.toContain('/')
            expect(filename).not.toContain(':')
            expect(filename).toContain('TestSubject_With_Special_Chars')
        })
    })

    describe('saveEmailAsNote', () => {
        beforeEach(() => {
            vi.clearAllMocks()
        })

        it('should save email as note', async () => {
            await saveEmailAsNote(mockEmail, '/workspace')
            expect(invoke).toHaveBeenCalledWith('write_file_content', expect.objectContaining({
                path: expect.stringContaining('/workspace/emails/'),
                content: expect.any(String)
            }))
        })

        it('should create directory if needed', async () => {
            invoke.mockResolvedValueOnce(undefined) // create_directory
            invoke.mockResolvedValueOnce(undefined) // write_file_content

            await saveEmailAsNote(mockEmail, '/workspace')
            expect(invoke).toHaveBeenCalledWith('create_directory', { path: '/workspace/emails' })
        })
    })
})
