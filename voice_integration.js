/**
 * Prime AI - Voice Integration
 * Connects voice WebSocket client with main app and mic button UI
 */

// Initialize voice client
let voiceClient = null;
let micWindow = null;
let isVoiceActive = false;

// Initialize voice system on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeVoiceSystem();
});

async function initializeVoiceSystem() {
    try {
        // Initialize WebSocket client
        if (typeof VoiceWebSocketClient === 'undefined') {
            throw new Error('VoiceWebSocketClient not loaded');
        }

        voiceClient = new VoiceWebSocketClient('http://localhost:5000');
        
        // Set up UI handlers immediately so button is active
        setupUIHandlers();
        
        // Set up event handlers
        setupVoiceEventHandlers();
        
        // Connect to server
        await voiceClient.connect();
        console.log('✅ Voice system initialized');
        
    } catch (error) {
        console.error('❌ Failed to initialize voice system:', error);
        console.log('Voice features will be disabled. Make sure voice_server.py is running.');
        // UI handlers are already set up, so button click will trigger alert if not connected
    }
}

function setupVoiceEventHandlers() {
    // Handle interim transcription results
    voiceClient.onInterimResult = (text, data) => {
        console.log('📝 Interim result:', text);
        
        // Send to mic window if open
        if (micWindow && !micWindow.closed) {
            micWindow.postMessage({
                type: 'transcription_update',
                text: text
            }, '*');
        }
    };
    
    // Handle final transcription results
    voiceClient.onResult = (text, data) => {
        console.log('✅ Final result:', text);
        
        // Insert text into chat input
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.value = text;
            chatInput.dispatchEvent(new Event('input'));
        }
        
        // Close mic window
        if (micWindow && !micWindow.closed) {
            micWindow.close();
            micWindow = null;
        }
        
        isVoiceActive = false;
    };
    
    // Handle status changes
    voiceClient.onStatusChange = (status, message) => {
        console.log(`Voice status: ${status} - ${message}`);
    };
    
    // Handle errors
    voiceClient.onError = (error) => {
        console.error('Voice error:', error);
        // alert(`Voice error: ${error}`); // Don't use alert, use UI feedback
        
        if (micWindow && !micWindow.closed) {
            // Send error to mic window
            micWindow.postMessage({
                type: 'error',
                message: error
            }, '*');
            
            // Do NOT close the window on error, so user can see what happened
            // micWindow.close(); 
            // micWindow = null;
        }
        
        isVoiceActive = false;
    };
}

function setupUIHandlers() {
    // Voice button click handler
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', handleVoiceButtonClick);
    }
    
    // Space bar handler (when not typing)
    document.addEventListener('keydown', (e) => {
        const chatInput = document.getElementById('chat-input');
        const isTyping = chatInput && document.activeElement === chatInput;
        
        if (e.code === 'Space' && !isTyping && !isVoiceActive) {
            e.preventDefault();
            handleVoiceButtonClick();
        }
    });
    
    // Listen for messages from mic window
    window.addEventListener('message', (event) => {
        if (!event.data || !event.data.type) return;
        
        switch (event.data.type) {
            case 'mic_ready':
                console.log('✅ Mic window ready');
                // Resolve the ready promise if it exists
                if (window.micReadyResolve) {
                    window.micReadyResolve();
                    window.micReadyResolve = null;
                }
                break;
            case 'stop_recording_request':
                console.log('🛑 Stop recording requested from mic window');
                stopVoiceRecording();
                break;
            case 'mic_result':
                console.log('Mic result:', event.data.text);
                // Insert into chat input
                const chatInput = document.getElementById('chat-input');
                if (chatInput) {
                    chatInput.value = event.data.text;
                    chatInput.dispatchEvent(new Event('input'));
                }
                break;
        }
    });
}

async function handleVoiceButtonClick() {
    if (!voiceClient || !voiceClient.isConnected) {
        alert('Voice server is not connected. Please start voice_server.py');
        return;
    }
    
    if (isVoiceActive) {
        // Stop recording
        await stopVoiceRecording();
    } else {
        // Start recording
        await startVoiceRecording();
    }
}

async function startVoiceRecording() {
    try {
        // Open mic window first
        openMicWindow();
        
        // Wait for window to be ready (signal from window or timeout)
        console.log('Waiting for mic window to be ready...');
        await new Promise(resolve => {
            window.micReadyResolve = resolve;
            // Fallback timeout of 3 seconds
            setTimeout(() => {
                if (window.micReadyResolve) {
                    console.log('Mic window ready timeout (fallback)');
                    resolve();
                    window.micReadyResolve = null;
                }
            }, 3000);
        });
        
        // Start recording
        const started = await voiceClient.startRecording();
        
        if (started) {
            isVoiceActive = true;
            console.log('✅ Voice recording started');
            
            // Notify mic window to start listening UI
            if (micWindow && !micWindow.closed) {
                micWindow.postMessage({
                    type: 'start_listening'
                }, '*');
            }
        } else {
            console.error('❌ Failed to start recording');
            if (micWindow && !micWindow.closed) {
                // micWindow.close(); // Keep open to show error
                micWindow.postMessage({
                    type: 'error',
                    message: 'Failed to start recording. Check console.'
                }, '*');
            }
        }
    } catch (error) {
        console.error('Error starting voice recording:', error);
        alert('Failed to start voice recording: ' + error.message);
        if (micWindow && !micWindow.closed) {
            // micWindow.close(); // Keep open to show error
             micWindow.postMessage({
                type: 'error',
                message: 'Failed to start recording: ' + error.message
            }, '*');
        }
    }
}

async function stopVoiceRecording() {
    try {
        // Stop recording
        voiceClient.stopRecording();
        
        // Notify mic window
        if (micWindow && !micWindow.closed) {
            micWindow.postMessage({
                type: 'stop_listening'
            }, '*');
        }
        
        isVoiceActive = false;
    } catch (error) {
        console.error('Error stopping voice recording:', error);
    }
}

function openMicWindow() {
    // Close existing window if open
    if (micWindow && !micWindow.closed) {
        micWindow.close();
    }
    
    // Open new mic window
    const width = 550;
    const height = 600;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    
    micWindow = window.open(
        'mic_button_ui.html',
        'PrimeAI_Microphone',
        `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=no`
    );
    
    // Handle window close
    if (micWindow) {
        const checkClosed = setInterval(() => {
            if (micWindow.closed) {
                clearInterval(checkClosed);
                if (isVoiceActive) {
                    stopVoiceRecording();
                }
                micWindow = null;
            }
        }, 500);
    }
}

// Export for debugging
window.voiceDebug = {
    client: () => voiceClient,
    window: () => micWindow,
    isActive: () => isVoiceActive,
    start: startVoiceRecording,
    stop: stopVoiceRecording
};
