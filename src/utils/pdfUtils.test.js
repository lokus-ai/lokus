import { describe, it, expect } from 'vitest'
import { isPDFFile, getExtension, formatPDFFileSize } from './pdfUtils'

describe('pdfUtils', () => {
    describe('isPDFFile', () => {
        it('should return true for pdf files', () => {
            expect(isPDFFile('document.pdf')).toBe(true)
            expect(isPDFFile('document.PDF')).toBe(true)
        })

        it('should return false for non-pdf files', () => {
            expect(isPDFFile('image.png')).toBe(false)
            expect(isPDFFile('note.md')).toBe(false)
            expect(isPDFFile('file')).toBe(false)
        })
    })

    describe('getExtension', () => {
        it('should return extension', () => {
            expect(getExtension('file.txt')).toBe('txt')
            expect(getExtension('path/to/file.pdf')).toBe('pdf')
        })

        it('should return empty string if no extension', () => {
            expect(getExtension('file')).toBe('')
            expect(getExtension('')).toBe('')
        })
    })

    describe('formatPDFFileSize', () => {
        it('should format bytes', () => {
            expect(formatPDFFileSize(0)).toBe('0 Bytes')
            expect(formatPDFFileSize(1024)).toBe('1 KB')
            expect(formatPDFFileSize(1024 * 1024)).toBe('1 MB')
        })
    })
})
