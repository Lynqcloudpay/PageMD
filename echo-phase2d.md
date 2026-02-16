# Task: Echo Phase 2D — Smart Dictation & Voice

## Objective
Enable clinical providers to dictate notes and instructions directly into Echo using Voice-to-Text (Whisper).

## Backend
- **echo.js (Routes)**:
    - Add `POST /api/echo/transcribe` endpoint.
    - Setup `multer` memory storage for processing audio blobs.
    - Implement `transcribeAudio` function using OpenAI Whisper API.

## Frontend
- **EchoPanel.jsx**:
    - Add `Record` button near the chat input.
    - Implement `MediaRecorder` logic for capturing audio.
    - Add visual feedback for recording (timer/pulse).
    - Auto-send transcribed text to the chat.

## Verification
1. Click Microphone button.
2. Say: "Summarize the patient's recent vitals."
3. Stop recording.
4. Verify text appears in chat and Echo responds with a vital summary.
