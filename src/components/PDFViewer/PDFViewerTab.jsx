import { useState, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { invoke } from '@tauri-apps/api/core';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './pdfViewer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFViewerTab({ file, onClose }) {
  const [pdfData, setPdfData] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Read PDF file as binary data
    async function loadPDF() {
      try {
        setLoading(true);
        setError(null);
        setPdfData(null); // Clear previous data
        console.log('Loading PDF from:', file);

        // Read file as binary using Tauri command
        const binaryData = await invoke('read_binary_file', { path: file });

        // Convert to Uint8Array - this needs to be done only once
        const uint8Array = new Uint8Array(binaryData);
        console.log('PDF loaded, size:', uint8Array.length, 'bytes');

        // Important: Set data in a way that doesn't trigger re-render
        setPdfData(uint8Array);
      } catch (err) {
        console.error('Failed to load PDF:', err);
        setError('Failed to load PDF file: ' + err.message);
        setLoading(false);
      }
    }

    loadPDF();
  }, [file]);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  }

  function onDocumentLoadError(error) {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF file. The file might be corrupted or in an unsupported format.');
    setLoading(false);
  }

  function changePage(offset) {
    setPageNumber(prevPageNumber => {
      const newPage = prevPageNumber + offset;
      return Math.max(1, Math.min(newPage, numPages));
    });
  }

  function previousPage() {
    changePage(-1);
  }

  function nextPage() {
    changePage(1);
  }

  function zoomIn() {
    setScale(prevScale => Math.min(prevScale + 0.25, 3.0));
  }

  function zoomOut() {
    setScale(prevScale => Math.max(prevScale - 0.25, 0.5));
  }

  function resetZoom() {
    setScale(1.0);
  }

  // Memoize file and options to prevent unnecessary reloads
  const fileConfig = useMemo(() => ({ data: pdfData }), [pdfData]);
  const workerOptions = useMemo(() => ({
    workerSrc: `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  }), []);

  return (
    <div className="pdf-viewer-container">
      {/* Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-section">
          <button
            onClick={previousPage}
            disabled={pageNumber <= 1}
            className="pdf-button"
            title="Previous page (Arrow Left)"
          >
            ← Previous
          </button>
          <span className="pdf-page-info">
            Page {pageNumber} of {numPages || '?'}
          </span>
          <button
            onClick={nextPage}
            disabled={pageNumber >= numPages}
            className="pdf-button"
            title="Next page (Arrow Right)"
          >
            Next →
          </button>
        </div>

        <div className="pdf-toolbar-section">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="pdf-button"
            title="Zoom out"
          >
            −
          </button>
          <span className="pdf-zoom-info">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            className="pdf-button"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={resetZoom}
            className="pdf-button"
            title="Reset zoom"
          >
            Reset
          </button>
        </div>

        {onClose && (
          <div className="pdf-toolbar-section">
            <button
              onClick={onClose}
              className="pdf-button pdf-button-close"
              title="Close PDF"
            >
              ✕ Close
            </button>
          </div>
        )}
      </div>

      {/* PDF Content */}
      <div className="pdf-content">
        {loading && (
          <div className="pdf-loading">
            <div className="pdf-spinner"></div>
            <p>Loading PDF...</p>
          </div>
        )}

        {error && (
          <div className="pdf-error">
            <p>{error}</p>
            <button onClick={onClose} className="pdf-button">
              Close
            </button>
          </div>
        )}

        {!error && pdfData && (
          <Document
            file={fileConfig}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<div className="pdf-loading"><div className="pdf-spinner"></div></div>}
            options={workerOptions}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="pdf-hint">
        <small>
          Tip: Use arrow keys to navigate pages, +/- to zoom
        </small>
      </div>
    </div>
  );
}
