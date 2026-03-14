/**
 * Deepgram Real-time Transcription Service
 *
 * Connects to Deepgram's WebSocket API for real-time speech-to-text.
 * Receives audio chunks from Tauri's audio capture module (lokus:audio-chunk
 * events containing base64-encoded i16 LE PCM) and streams them to Deepgram.
 *
 * BYOK — the user supplies their own Deepgram API key.
 *
 * @module services/deepgram-transcription
 */

import { listen } from '@tauri-apps/api/event';

const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen';

/**
 * Create a Deepgram real-time transcription session.
 *
 * Call `start()` to connect and begin streaming audio from Tauri's mic capture.
 * Call `stop()` to gracefully close the connection and clean up listeners.
 *
 * @param {Object} options
 * @param {string}   options.apiKey       - Deepgram API key.
 * @param {function} options.onTranscript - Called with each transcript segment:
 *                                          { text, is_final, speaker, timestamp, words }
 * @param {function} [options.onError]    - Called on connection or protocol errors.
 * @param {function} [options.onOpen]     - Called when the WebSocket is connected.
 * @param {function} [options.onClose]    - Called when the WebSocket closes.
 * @returns {{ start: () => Promise<void>, stop: () => void }}
 */
export function createDeepgramSession({ apiKey, onTranscript, onError, onOpen, onClose }) {
  let ws = null;
  let audioUnlisten = null;
  let isStarted = false;

  const params = new URLSearchParams({
    model: 'nova-3',
    smart_format: 'true',
    interim_results: 'true',
    utterance_end_ms: '1000',
    vad_events: 'true',
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
    punctuate: 'true',
    diarize: 'true',
  });

  async function start() {
    if (isStarted) return;
    isStarted = true;

    // Listen for audio chunks from Rust audio capture before opening the WS,
    // so no chunks are missed during the handshake.
    audioUnlisten = await listen('lokus:audio-chunk', (event) => {
      if (ws?.readyState === WebSocket.OPEN) {
        const base64 = event.payload.data;
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        ws.send(bytes.buffer);
      }
    });

    ws = new WebSocket(`${DEEPGRAM_WS_URL}?${params}`, ['token', apiKey]);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('[Deepgram] Connected');
      onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'Results') {
          const alt = data.channel?.alternatives?.[0];
          const transcript = alt?.transcript;
          if (transcript) {
            onTranscript({
              text: transcript,
              is_final: data.is_final ?? false,
              speaker: alt?.words?.[0]?.speaker ?? null,
              timestamp: Date.now(),
              words: alt?.words ?? [],
            });
          }
        }
      } catch (err) {
        console.error('[Deepgram] Parse error:', err);
      }
    };

    ws.onerror = () => {
      console.error('[Deepgram] WebSocket error');
      onError?.('Deepgram connection error. Check your API key.');
    };

    ws.onclose = (event) => {
      console.log(`[Deepgram] Closed: code=${event.code}`);
      onClose?.();
    };
  }

  function stop() {
    isStarted = false;
    if (audioUnlisten) {
      audioUnlisten();
      audioUnlisten = null;
    }
    if (ws) {
      if (ws.readyState === WebSocket.OPEN) {
        // Deepgram's close-stream message
        ws.send(JSON.stringify({ type: 'CloseStream' }));
      }
      ws.close();
      ws = null;
    }
  }

  return { start, stop };
}
