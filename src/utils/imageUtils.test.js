import { describe, it, expect } from 'vitest';
import { isImageFile, formatFileSize, formatDate, findImageFiles, getAdjacentImage } from './imageUtils';

describe('imageUtils', () => {
    describe('isImageFile', () => {
        it('should identify image files', () => {
            expect(isImageFile('image.png')).toBe(true);
            expect(isImageFile('image.jpg')).toBe(true);
            expect(isImageFile('image.webp')).toBe(true);
        });

        it('should reject non-image files', () => {
            expect(isImageFile('file.txt')).toBe(false);
            expect(isImageFile('script.js')).toBe(false);
        });

        it('should handle case insensitivity', () => {
            expect(isImageFile('IMAGE.PNG')).toBe(true);
        });
    });

    describe('formatFileSize', () => {
        it('should format bytes', () => {
            expect(formatFileSize(1024)).toBe('1 KB');
            expect(formatFileSize(1024 * 1024)).toBe('1 MB');
        });
    });

    describe('findImageFiles', () => {
        it('should find image files in tree', () => {
            const files = [
                { path: 'img1.png', is_directory: false },
                { path: 'doc.txt', is_directory: false },
                {
                    path: 'folder',
                    is_directory: true,
                    children: [
                        { path: 'img2.jpg', is_directory: false }
                    ]
                }
            ];
            const images = findImageFiles(files);
            expect(images).toHaveLength(2);
            expect(images[0].path).toBe('img1.png');
            expect(images[1].path).toBe('img2.jpg');
        });
    });

    describe('getAdjacentImage', () => {
        const images = [
            { path: '1.png' },
            { path: '2.png' },
            { path: '3.png' }
        ];

        it('should get next image', () => {
            expect(getAdjacentImage(images, '1.png', 'next').path).toBe('2.png');
        });

        it('should loop to start on next', () => {
            expect(getAdjacentImage(images, '3.png', 'next').path).toBe('1.png');
        });

        it('should get previous image', () => {
            expect(getAdjacentImage(images, '2.png', 'prev').path).toBe('1.png');
        });

        it('should loop to end on prev', () => {
            expect(getAdjacentImage(images, '1.png', 'prev').path).toBe('3.png');
        });
    });
});
