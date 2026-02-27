/**
 * Deepgram Transcription Service
 * 
 * Wraps the Deepgram Nova-2 Medical model for clinical audio transcription.
 * Used by echoService.transcribeAudio() as the primary transcription provider,
 * with OpenAI Whisper as automatic fallback.
 * 
 * Pricing: ~$0.0043/min (vs Whisper $0.006/min) — ~30% cheaper
 * Model: nova-2-medical (healthcare-optimized vocabulary)
 */

const { createClient } = require('@deepgram/sdk');

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

let deepgramClient = null;

function getClient() {
    if (!deepgramClient && DEEPGRAM_API_KEY) {
        deepgramClient = createClient(DEEPGRAM_API_KEY);
    }
    return deepgramClient;
}

/**
 * Transcribe audio buffer using Deepgram Nova-2 Medical
 * 
 * @param {Buffer} buffer - Raw audio buffer (webm, wav, mp3, etc.)
 * @param {Object} options
 * @param {string} options.mimetype - Audio MIME type (default: 'audio/webm')
 * @param {string} options.mode - 'dictation' or 'ambient' (affects model config)
 * @returns {Promise<{ text: string, duration: number, provider: string }>}
 */
async function transcribeAudio(buffer, options = {}) {
    const client = getClient();
    if (!client) {
        throw new Error('Deepgram client not initialized. Check DEEPGRAM_API_KEY.');
    }

    const mimetype = options.mimetype || 'audio/webm';
    const isAmbient = options.mode === 'ambient';

    const startTime = Date.now();

    try {
        const { result, error } = await client.listen.prerecorded.transcribeFile(
            buffer,
            {
                model: 'nova-2-medical',
                detect_language: true,  // Auto-detect spoken language (en, es, fr, pt, etc.)
                smart_format: true,
                punctuate: true,
                paragraphs: isAmbient,
                utterances: isAmbient,
                diarize: isAmbient,      // Speaker separation for ambient (doctor vs patient)
                filler_words: false,      // Remove "um", "uh" etc.
                mimetype,
            }
        );

        if (error) {
            console.error('[Deepgram] API Error:', error);
            throw new Error(`Deepgram API error: ${error.message || JSON.stringify(error)}`);
        }

        const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        const duration = result?.metadata?.duration || 0;

        const latencyMs = Date.now() - startTime;
        console.log(`[Deepgram] Transcribed ${duration.toFixed(1)}s audio in ${latencyMs}ms (mode: ${options.mode || 'dictation'})`);

        return {
            text: transcript,
            duration: Math.ceil(duration / 60), // duration in minutes for billing
            durationSeconds: duration,
            provider: 'deepgram',
            latencyMs
        };
    } catch (err) {
        console.error('[Deepgram] Transcription failed:', err.message);
        throw err;
    }
}

/**
 * Check if Deepgram is configured and available
 */
function isAvailable() {
    return !!DEEPGRAM_API_KEY;
}

module.exports = {
    transcribeAudio,
    isAvailable,
};
