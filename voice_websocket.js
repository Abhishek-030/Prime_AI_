/**
 * Prime AI - Voice WebSocket Client
 * Handles real-time voice communication with Python backend
 */

class VoiceWebSocketClient {
    constructor(serverUrl = 'http://localhost:5000') {
        this.serverUrl = serverUrl;
        this.socket = null;
        this.isConnected = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.onStatusChange = null;
        this.onResult = null;
        this.onInterimResult = null;
        this.onError = null;
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        return new Promise((resolve, reject) => {
            try {
                // Load Socket.IO client library
                if (typeof io === 'undefined') {
                    console.error('Socket.IO client library not loaded');
                    reject(new Error('Socket.IO client library not found'));
                    return;
                }

                console.log('Connecting to voice server:', this.serverUrl);
                this.socket = io(this.serverUrl, {
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionAttempts: 5
                });

                // Connection events
                this.socket.on('connect', () => {
                    console.log('✅ Connected to voice server');
                    this.isConnected = true;
                    this._notifyStatus('connected', 'Connected to voice server');
                    resolve();
                });

                this.socket.on('disconnect', () => {
                    console.log('❌ Disconnected from voice server');
                    this.isConnected = false;
                    this._notifyStatus('disconnected', 'Disconnected from voice server');
                });

                this.socket.on('connect_error', (error) => {
                    console.error('Connection error:', error);
                    this.isConnected = false;
                    this._notifyError('Connection failed. Is the voice server running?');
                    reject(error);
                });

                // Voice events
                this.socket.on('connection_status', (data) => {
                    console.log('Connection status:', data);
                    this._notifyStatus(data.status, data.message);
                });

                this.socket.on('voice_status', (data) => {
                    console.log('Voice status:', data);
                    this._notifyStatus(data.status, data.message);
                });

                this.socket.on('voice_result', (data) => {
                    console.log('Voice result:', data);
                    if (this.onResult) {
                        this.onResult(data.text, data);
                    }
                });

                this.socket.on('voice_interim', (data) => {
                    console.log('Voice interim result:', data);
                    if (this.onInterimResult) {
                        this.onInterimResult(data.text, data);
                    }
                });

                this.socket.on('voice_error', (data) => {
                    console.error('Voice error:', data);
                    this._notifyError(data.error || data.message);
                });

                this.socket.on('test_response', (data) => {
                    console.log('Test response:', data);
                });

            } catch (error) {
                console.error('Error connecting to voice server:', error);
                reject(error);
            }
        });
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }

    /**
     * Test connection
     */
    testConnection() {
        if (!this.isConnected) {
            console.error('Not connected to server');
            return false;
        }
        this.socket.emit('test_connection');
        return true;
    }

    /**
     * Start recording audio from microphone
     */
    async startRecording() {
        try {
            console.log('Requesting microphone access...');
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                } 
            });

            console.log('✅ Microphone access granted');

            // Create MediaRecorder
            const options = { mimeType: 'audio/webm' };
            this.mediaRecorder = new MediaRecorder(stream, options);
            this.audioChunks = [];

            // Handle data available - send chunks immediately for streaming
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    console.log('Audio chunk recorded:', event.data.size, 'bytes');
                    
                    // Send chunk immediately for real-time transcription
                    if (this.isConnected) {
                        this._sendAudioChunk(event.data);
                    }
                }
            };

            // Handle recording stop
            this.mediaRecorder.onstop = () => {
                console.log('Recording stopped, processing final audio...');
                this._processRecording();
            };

            // Start recording with timeslice for streaming (1000ms chunks)
            this.mediaRecorder.start(1000);
            console.log('🎤 Recording started in streaming mode (1s chunks)');

            // Notify server
            if (this.isConnected) {
                this.socket.emit('voice_start', { timestamp: Date.now() });
            }

            this._notifyStatus('recording', 'Recording...');
            return true;

        } catch (error) {
            console.error('Error starting recording:', error);
            this._notifyError('Failed to access microphone: ' + error.message);
            return false;
        }
    }

    /**
     * Stop recording audio
     */
    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            console.log('Stopping recording...');
            this.mediaRecorder.stop();
            
            // Stop all tracks
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            // Notify server
            if (this.isConnected) {
                this.socket.emit('voice_stop', { timestamp: Date.now() });
            }
            
            return true;
        }
        return false;
    }

    /**
     * Process recorded audio and send to server
     */
    async _processRecording() {
        try {
            if (this.audioChunks.length === 0) {
                console.warn('No audio chunks to process');
                return;
            }

            console.log('Processing', this.audioChunks.length, 'audio chunks');
            
            // Create blob from chunks
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            console.log('Audio blob created:', audioBlob.size, 'bytes');

            this._notifyStatus('processing', 'Processing audio...');

            // Convert to base64
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Audio = reader.result.split(',')[1];
                console.log('Audio converted to base64:', base64Audio.length, 'characters');

                // Send to server via WebSocket
                if (this.isConnected) {
                    this.socket.emit('voice_audio', {
                        audio: base64Audio,
                        format: 'webm',
                        timestamp: Date.now()
                    });
                    console.log('✅ Audio sent to server');
                } else {
                    console.error('Not connected to server');
                    this._notifyError('Not connected to voice server');
                }
            };

            reader.readAsDataURL(audioBlob);

        } catch (error) {
            console.error('Error processing recording:', error);
            this._notifyError('Failed to process audio: ' + error.message);
        }
    }

    /**
     * Send audio file to server for transcription
     */
    async transcribeFile(audioFile) {
        try {
            const formData = new FormData();
            formData.append('audio', audioFile);

            const response = await fetch(`${this.serverUrl}/api/voice/transcribe`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('Transcription result:', result.text);
                if (this.onResult) {
                    this.onResult(result.text, result);
                }
                return result.text;
            } else {
                throw new Error(result.error || 'Transcription failed');
            }

        } catch (error) {
            console.error('Error transcribing file:', error);
            this._notifyError('Transcription failed: ' + error.message);
            return null;
        }
    }

    /**
     * Send individual audio chunk for streaming transcription
     */
    async _sendAudioChunk(audioBlob) {
        try {
            // Convert blob to base64
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Audio = reader.result.split(',')[1];
                
                // Send to server via WebSocket for streaming transcription
                if (this.isConnected) {
                    this.socket.emit('voice_audio_stream', {
                        audio: base64Audio,
                        format: 'webm',
                        timestamp: Date.now()
                    });
                    console.log('📤 Sent audio chunk for streaming:', base64Audio.length, 'characters');
                }
            };
            reader.readAsDataURL(audioBlob);
        } catch (error) {
            console.error('Error sending audio chunk:', error);
        }
    }

    /**
     * Get voice system status
     */
    async getStatus() {
        try {
            const response = await fetch(`${this.serverUrl}/api/voice/status`);
            const status = await response.json();
            console.log('Voice system status:', status);
            return status;
        } catch (error) {
            console.error('Error getting status:', error);
            return null;
        }
    }

    /**
     * Notify status change
     */
    _notifyStatus(status, message) {
        if (this.onStatusChange) {
            this.onStatusChange(status, message);
        }
    }

    /**
     * Notify error
     */
    _notifyError(error) {
        if (this.onError) {
            this.onError(error);
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceWebSocketClient;
}
