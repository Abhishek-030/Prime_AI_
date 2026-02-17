/**
 * Prime AI - Main Application JavaScript
 * Dark Black & Navy Blue Theme with Lively Animations
 */

// ===================================
// Configuration
// ===================================

const CONFIG = {
    API_BASE_URL: 'http://localhost:5000/api',
    WS_URL: 'ws://localhost:5000/ws',
    LOADING_DURATION: 2500, // Loading screen duration in ms
};

// ===================================
// Application State
// ===================================

const AppState = {
    currentChatId: 'welcome',
    isVoiceActive: false,
    chatHistory: [],
    chats: {
        welcome: {
            id: 'welcome',
            title: 'Welcome to Prime AI',
            messages: [],
            timestamp: new Date()
        }
    },
    selectedPersonality: 'study', // Default personality
    settings: {
        theme: 'dark',
        voiceEnabled: true,
        ttsEnabled: true,
        saveHistory: true,
    }
};

// ===================================
// Loading Screen
// ===================================

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }, CONFIG.LOADING_DURATION);
}

// ===================================
// Initialization
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Prime AI initializing...');

    // Hide loading screen
    hideLoadingScreen();

    // Initialize components
    initTheme();
    initChat();
    initSidebar();
    initSettings();
    initVoiceRecognition();

    loadSettings();
    loadUserFromStorage();
    loadAvatarFromStorage();
    loadPersonality();

    console.log('Prime AI ready!');
});

// ===================================
// Theme Management
// ===================================

function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'dark';

    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        // Keep moon icon always
    }

    themeToggle.addEventListener('click', toggleTheme);
}

function toggleTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const isLight = document.body.classList.toggle('light-theme');
    // Keep moon icon always - don't change it

    if (isLight) {
        localStorage.setItem('theme', 'light');
        AppState.settings.theme = 'light';
    } else {
        localStorage.setItem('theme', 'dark');
        AppState.settings.theme = 'dark';
    }
}

// ===================================
// Sidebar Management
// ===================================

function initSidebar() {
    // Sidebar toggle for mobile
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');

    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        }
    });

    // Resizable sidebar functionality
    initResizableSidebar();

    // New chat button
    const newChatBtn = document.getElementById('new-chat-btn');
    newChatBtn.addEventListener('click', createNewChat);

    // User profile menu
    const userProfile = document.getElementById('user-profile');
    const userMenu = document.getElementById('user-menu');

    userProfile?.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenu.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        userMenu?.classList.remove('active');
    });

    // History item clicks
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', function (e) {
            if (!e.target.classList.contains('delete-chat-btn') &&
                !e.target.closest('.delete-chat-btn')) {
                selectChat(this);
            }
        });
    });

    // Delete buttons
    document.querySelectorAll('.delete-chat-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            deleteChat(this.closest('.history-item'));
        });
    });

    // Register button
    const registerBtn = document.getElementById('register-btn');
    registerBtn?.addEventListener('click', () => {
        openAuthModal('register');
    });

    // Sign In button
    const signInBtn = document.getElementById('sign-in-btn');
    signInBtn?.addEventListener('click', () => {
        openAuthModal('signin');
    });

    // Sign Out button
    const signOutBtn = document.getElementById('sign-out-btn');
    signOutBtn?.addEventListener('click', () => {
        handleSignOut();
    });

    // Profile button
    const profileBtn = document.getElementById('profile-btn');
    profileBtn?.addEventListener('click', () => {
        openProfileModal();
    });

    // Settings button
    const settingsMenuBtn = document.getElementById('settings-menu-btn');
    settingsMenuBtn?.addEventListener('click', () => {
        openSettingsModal();
    });

    // Personality selector
    const modelBtn = document.getElementById('model-btn');
    const personalityMenu = document.getElementById('personality-menu');
    const personalityBackdrop = document.getElementById('personality-backdrop');

    modelBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        personalityMenu.classList.toggle('active');
        personalityBackdrop?.classList.toggle('active');
        // Close user menu if open
        userMenu?.classList.remove('active');
    });

    // Close personality menu when clicking outside
    document.addEventListener('click', () => {
        personalityMenu?.classList.remove('active');
        personalityBackdrop?.classList.remove('active');
    });

    // Close menu when clicking backdrop
    personalityBackdrop?.addEventListener('click', () => {
        personalityMenu?.classList.remove('active');
        personalityBackdrop?.classList.remove('active');
    });

    // Prevent personality menu from closing when clicking inside it
    personalityMenu?.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Prevent user menu from closing when clicking inside it
    userMenu?.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Handle personality selection
    document.querySelectorAll('.personality-option').forEach(option => {
        option.addEventListener('click', function (e) {
            e.stopPropagation();

            // Remove active class from all options
            document.querySelectorAll('.personality-option').forEach(opt => {
                opt.classList.remove('active');
            });

            // Add active class to selected option
            this.classList.add('active');

            // Update button text
            const selectedPersonality = this.querySelector('span').textContent;
            modelBtn.querySelector('span').textContent = selectedPersonality;

            // Store selected personality
            const personalityType = this.dataset.personality;
            AppState.selectedPersonality = personalityType;
            localStorage.setItem('prime-ai-personality', personalityType);

            // Show notification
            showNotification(`Switched to ${selectedPersonality}`, 'success');

            // Close menu and backdrop
            personalityMenu.classList.remove('active');
            personalityBackdrop?.classList.remove('active');
        });
    });
}

// Resizable Sidebar Implementation
function initResizableSidebar() {
    const sidebar = document.getElementById('sidebar');
    const resizeHandle = document.getElementById('resize-handle');
    const bgParticles = document.querySelector('.bg-particles');

    if (!sidebar || !resizeHandle) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = sidebar.offsetWidth;

        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';

        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const dx = e.clientX - startX;
        const newWidth = Math.max(200, Math.min(400, startWidth + dx));

        sidebar.style.width = `${newWidth}px`;

        // Update particles position
        if (bgParticles) {
            bgParticles.style.left = `${newWidth}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

function createNewChat() {
    const chatId = 'chat_' + Date.now();
    const newChat = {
        id: chatId,
        title: 'New Chat',
        messages: [],
        timestamp: new Date()
    };

    AppState.chats[chatId] = newChat;
    AppState.currentChatId = chatId;

    // Clear chat messages
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = `
        <div class="welcome-screen">
            <div class="welcome-logo">
                <i class="fas fa-brain"></i>
            </div>
            <h1>Prime AI</h1>
            <p class="welcome-subtitle">Your intelligent personal assistant</p>
            
            <div class="suggestion-cards">
                <button class="suggestion-card" data-prompt="Help me organize my files by date and type">
                    <i class="fas fa-folder-tree"></i>
                    <span>Organize my files</span>
                </button>
                <button class="suggestion-card" data-prompt="Create a study schedule for the next week">
                    <i class="fas fa-calendar-alt"></i>
                    <span>Create study plan</span>
                </button>
                <button class="suggestion-card" data-prompt="Explain this code and help me debug it">
                    <i class="fas fa-code"></i>
                    <span>Debug my code</span>
                </button>
                <button class="suggestion-card" data-prompt="Check my system health and suggest optimizations">
                    <i class="fas fa-heartbeat"></i>
                    <span>System health check</span>
                </button>
            </div>
        </div>
    `;

    // Re-attach suggestion card listeners
    attachSuggestionListeners();

    // Update sidebar
    // TODO: Add new chat to sidebar history
}

function selectChat(historyItem) {
    document.querySelectorAll('.history-item').forEach(item => {
        item.classList.remove('active');
    });
    historyItem.classList.add('active');

    // Load chat messages
    // TODO: Load messages for selected chat
}

function deleteChat(historyItem) {
    if (confirm('Delete this chat?')) {
        historyItem.remove();
        // TODO: Remove from AppState.chats
    }
}

// ===================================
// Chat Functionality
// ===================================

function initChat() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceBtn = document.getElementById('voice-btn');
    const attachBtn = document.getElementById('attach-btn');

    // Auto-resize textarea
    chatInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';

        // Enable/disable send button
        sendBtn.disabled = !this.value.trim();
    });

    // Send on Enter (Shift+Enter for new line)
    chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Send button click
    sendBtn.addEventListener('click', sendMessage);

    // Voice button - Open mic window
    voiceBtn.addEventListener('click', openMicWindow);

    // Attach button
    attachBtn.addEventListener('click', () => {
        openFileModal();
    });

    // Suggestion cards
    attachSuggestionListeners();
}

function attachSuggestionListeners() {
    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', function () {
            const prompt = this.getAttribute('data-prompt');
            document.getElementById('chat-input').value = prompt;
            sendMessage();
        });
    });
}

async function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();

    if (!message) return;

    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    document.getElementById('send-btn').disabled = true;

    // Remove welcome screen if present
    const welcomeScreen = document.querySelector('.welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.remove();
    }

    // Add user message
    addMessage(message, 'user');

    // Add typing indicator
    const typingIndicator = createTypingIndicator();
    document.getElementById('chat-messages').appendChild(typingIndicator);


    // Simulate API call (replace with actual API call)
    // setTimeout(() => {
    //     typingIndicator.remove();
    //     const response = "I'm currently in demo mode. Connect me to the backend to get real responses! I can help you with file management, coding, studying, automation, and more.";
    //     addMessage(response, 'assistant');
    // }, 1500);

    // TODO: Actual API call
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const data = await response.json();
        typingIndicator.remove();

        let finalResponse = data.response;

        // Check if the response is an object (System Info)
        if (typeof finalResponse === 'object' && finalResponse !== null) {
            // Convert the dictionary into a readable string
            finalResponse = `
        <strong>System Information:</strong><br>
        • OS: ${finalResponse.os_name}<br>
        • CPU Usage: ${finalResponse.cpu_usage}%<br>
        • RAM: ${finalResponse.memory.percent}% (${finalResponse.memory.used_gb}GB / ${finalResponse.memory.total_gb}GB)<br>
        • Disk: ${finalResponse.disk.percent}%
    `;
        }

        // Now add it to the chat
        addMessage(finalResponse, 'assistant');

        // addMessage(data.response, 'assistant');
    } catch (error) {
        typingIndicator.remove();
        addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    }
}

function addMessage(text, sender = 'user') {
    const chatMessages = document.getElementById('chat-messages');

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const time = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const avatar = sender === 'user'
        ? '<i class="fas fa-user"></i>'
        : '<i class="fas fa-brain"></i>';

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            ${text}
            <div class="message-time">${time}</div>
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Store in state
    AppState.chatHistory.push({ sender, text, time });

    // Speak if TTS enabled
    if (sender === 'assistant' && AppState.settings.ttsEnabled) {
        speakText(text);
    }
}

function createTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message assistant';
    indicator.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="message-content typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    return indicator;
}

// ===================================
// Voice Recognition
// ===================================

let recognition = null;

function initVoiceRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join('');

            document.getElementById('chat-input').value = transcript;
            document.getElementById('send-btn').disabled = false;
        };

        recognition.onend = () => {
            stopVoiceInput();
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            stopVoiceInput();
        };
    }
}

function toggleVoiceInput() {
    if (AppState.isVoiceActive) {
        stopVoiceInput();
    } else {
        startVoiceInput();
    }
}

function startVoiceInput() {
    if (!recognition) {
        alert('Speech recognition is not supported in your browser.');
        return;
    }

    if (!AppState.settings.voiceEnabled) {
        alert('Voice input is disabled. Enable it in settings.');
        return;
    }

    AppState.isVoiceActive = true;
    document.getElementById('voice-btn').classList.add('active');

    try {
        recognition.start();
    } catch (error) {
        console.error('Error starting recognition:', error);
        stopVoiceInput();
    }
}

function stopVoiceInput() {
    AppState.isVoiceActive = false;
    document.getElementById('voice-btn').classList.remove('active');

    if (recognition) {
        try {
            recognition.stop();
        } catch (error) {
            console.error('Error stopping recognition:', error);
        }
    }
}

// ===================================
// User Profile Interactions
// ===================================


// ===================================
// Mic Window Integration
// ===================================

let micWindow = null;

function openMicWindow() {
    if (micWindow && !micWindow.closed) {
        micWindow.focus();
        return;
    }

    // Calculate center position
    const width = 500;
    const height = 500;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    // Open popup window
    micWindow = window.open(
        'mic_button_ui.html',
        'PrimeAI_Voice',
        `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
    );

    // Setup message listener
    window.addEventListener('message', handleMicMessage);

    // Check if window is closed
    const checkClosed = setInterval(() => {
        if (micWindow && micWindow.closed) {
            clearInterval(checkClosed);
            updateVoiceStatus(false);
            micWindow = null;
        }
    }, 500);
}

// Handle messages from mic window
function handleMicMessage(event) {
    if (!event.data || !event.data.type) return;

    switch (event.data.type) {
        case 'mic_listening':
            AppState.isVoiceActive = event.data.listening;
            updateVoiceStatus(event.data.listening);
            console.log('Mic listening:', event.data.listening);
            break;

        case 'mic_result':
            handleVoiceCommand(event.data.text);
            break;

        case 'mic_processing':
            console.log('Processing audio...');
            break;
    }
}

// Update voice button status
function updateVoiceStatus(listening) {
    const voiceBtn = document.getElementById('voice-btn');
    if (!voiceBtn) return;

    if (listening) {
        voiceBtn.classList.add('active');
        voiceBtn.title = 'Listening...';
    } else {
        voiceBtn.classList.remove('active');
        voiceBtn.title = 'Voice input';
    }
}

// Process voice commands from mic window
function handleVoiceCommand(text) {
    console.log('Voice Command Received:', text);

    const command = text.toLowerCase();

    // Hide welcome screen if visible
    const welcomeScreen = document.querySelector('.welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.remove();
    }

    document.getElementById('chat-input').value = text;
    sendMessage()

    // Add user message
    // addMessage(text, 'user');

    // Process specific commands
    // if (command.includes('open file') || command.includes('file manager')) {
    //     setTimeout(() => {
    //         addMessage('Opening file manager... What would you like me to help you with?', 'assistant');
    //     }, 500);
    // }
    // else if (command.includes('create file')) {
    //     setTimeout(() => {
    //         addMessage('What type of file would you like to create? (e.g., document, spreadsheet, text file)', 'assistant');
    //     }, 500);
    // }
    // else if (command.includes('organize files') || command.includes('organize my files')) {
    //     setTimeout(() => {
    //         addMessage('I\'ll help you organize your files. Would you like me to sort them by date, type, or size?', 'assistant');
    //     }, 500);
    // }
    // else if (command.includes('summarize') || command.includes('summary')) {
    //     setTimeout(() => {
    //         addMessage('I can help you generate a summary. Please upload the document you\'d like me to summarize.', 'assistant');
    //     }, 500);
    // }
    // else if (command.includes('study plan') || command.includes('study schedule')) {
    //     setTimeout(() => {
    //         addMessage('I\'ll create a study plan for you. What subjects or topics would you like to focus on?', 'assistant');
    //     }, 500);
    // }
    // else if (command.includes('explain code') || command.includes('code explanation')) {
    //     setTimeout(() => {
    //         addMessage('I can help explain code. Please paste the code you\'d like me to explain.', 'assistant');
    //     }, 500);
    // }
    // else if (command.includes('debug')) {
    //     setTimeout(() => {
    //         addMessage('I\'ll help you debug your code. Please share the code and describe the issue you\'re experiencing.', 'assistant');
    //     }, 500);
    // }
    // else if (command.includes('check system') || command.includes('system health')) {
    //     setTimeout(() => {
    //         addMessage('Running system health check...\n\n📊 CPU Usage: 45%\n💾 RAM: 62% (8.2 GB / 16 GB)\n💿 Disk Space: 78% used (234 GB free)\n🌡️ Temperature: Normal\n\nYour system is running smoothly! Would you like me to suggest any optimizations?', 'assistant');
    //     }, 500);
    // }
    // else if (command.includes('settings')) {
    //     setTimeout(() => {
    //         addMessage('Opening settings panel...', 'assistant');
    //         document.getElementById('settings-btn').click();
    //     }, 500);
    // }
    // else if (command.includes('help')) {
    //     setTimeout(() => {
    //         addMessage('Here are some things I can help you with:\n\n📁 File Management - "organize my files", "open file manager"\n📚 Study Support - "create study plan", "summarize document"\n💻 Coding Help - "explain code", "debug this code"\n⚙️ System Monitoring - "check system health"\n\nWhat would you like to do?', 'assistant');
    //     }, 500);
    // }
    // else if (command.includes('new chat')) {
    //     createNewChat();
    //     setTimeout(() => {
    //         addMessage('Started a new chat! How can I help you?', 'assistant');
    //     }, 500);
    // }
    // // Default response
    // else {
    //     setTimeout(() => {
    //         addMessage(`I heard you say: "${text}"\n\nHow can I help you with this?`, 'assistant');
    //     }, 500);
    // }
}

// Send message to mic window (optional)
function sendToMicWindow(message) {
    if (micWindow && !micWindow.closed) {
        micWindow.postMessage(message, '*');
    }
}

// ===================================
// Text-to-Speech
// ===================================

function speakText(text) {
    if ('speechSynthesis' in window && AppState.settings.ttsEnabled) {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        window.speechSynthesis.speak(utterance);
    }
}

// ===================================
// Settings Management
// ===================================

function initSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtns = document.querySelectorAll('.close-modal');

    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
        loadSettingsToUI();
    });

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            settingsModal.classList.remove('active');
            saveSettingsFromUI();
        });
    });

    // Close on outside click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
            saveSettingsFromUI();
        }
    });

    // Clear chats button
    document.querySelector('.clear-btn')?.addEventListener('click', () => {
        if (confirm('Clear all chat history? This cannot be undone.')) {
            AppState.chats = {};
            AppState.chatHistory = [];
            localStorage.removeItem('prime-ai-chats');
            createNewChat();
            alert('All chats cleared!');
        }
    });
}

function loadSettingsToUI() {
    document.getElementById('theme-select').value = AppState.settings.theme;
    document.getElementById('voice-enabled').checked = AppState.settings.voiceEnabled;
    document.getElementById('tts-enabled').checked = AppState.settings.ttsEnabled;
    document.getElementById('save-history').checked = AppState.settings.saveHistory;
}

function saveSettingsFromUI() {
    AppState.settings.theme = document.getElementById('theme-select').value;
    AppState.settings.voiceEnabled = document.getElementById('voice-enabled').checked;
    AppState.settings.ttsEnabled = document.getElementById('tts-enabled').checked;
    AppState.settings.saveHistory = document.getElementById('save-history').checked;

    localStorage.setItem('prime-ai-settings', JSON.stringify(AppState.settings));
}

function loadSettings() {
    const saved = localStorage.getItem('prime-ai-settings');
    if (saved) {
        AppState.settings = { ...AppState.settings, ...JSON.parse(saved) };
    }
}

// ===================================
// Personality Management
// ===================================

function loadPersonality() {
    const savedPersonality = localStorage.getItem('prime-ai-personality');
    if (savedPersonality) {
        AppState.selectedPersonality = savedPersonality;

        // Update UI
        const modelBtn = document.getElementById('model-btn');
        const personalityOptions = document.querySelectorAll('.personality-option');

        personalityOptions.forEach(option => {
            if (option.dataset.personality === savedPersonality) {
                option.classList.add('active');
                if (modelBtn) {
                    modelBtn.querySelector('span').textContent = option.querySelector('span').textContent;
                }
            } else {
                option.classList.remove('active');
            }
        });
    }
}

// ===================================
// File Attachment Modal
// ===================================

let selectedFiles = [];

function openFileModal() {
    const fileModal = document.getElementById('file-modal');
    fileModal.classList.add('active');
    initFileModalHandlers();
}

function closeFileModal() {
    const fileModal = document.getElementById('file-modal');
    fileModal.classList.remove('active');
    selectedFiles = [];
    updateFilesList();
}

function initFileModalHandlers() {
    const fileModal = document.getElementById('file-modal');
    const fileUploadZone = document.getElementById('file-upload-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const attachFilesBtn = document.getElementById('attach-files-btn');
    const closeModalBtns = fileModal.querySelectorAll('.close-modal');

    // Remove existing listeners to prevent duplicates
    const newUploadZone = fileUploadZone.cloneNode(true);
    fileUploadZone.parentNode.replaceChild(newUploadZone, fileUploadZone);

    // Close modal handlers
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', closeFileModal);
    });

    fileModal.addEventListener('click', (e) => {
        if (e.target === fileModal) {
            closeFileModal();
        }
    });

    // Browse button
    document.getElementById('browse-btn').addEventListener('click', () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Drag and drop
    const uploadZone = document.getElementById('file-upload-zone');

    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    // File type filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            // Filter logic can be added here if needed
        });
    });

    // Attach files button
    attachFilesBtn.addEventListener('click', () => {
        if (selectedFiles.length > 0) {
            const fileNames = selectedFiles.map(f => f.name).join(', ');
            addMessage(`📎 Attached ${selectedFiles.length} file(s): ${fileNames}`, 'user');
            showNotification(`${selectedFiles.length} file(s) attached successfully!`, 'success');
            closeFileModal();
        }
    });
}

function handleFiles(files) {
    const filesArray = Array.from(files);

    filesArray.forEach(file => {
        // Check if file already exists
        if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
        }
    });

    updateFilesList();
}

function updateFilesList() {
    const filesList = document.getElementById('files-list');
    const attachBtn = document.getElementById('attach-files-btn');

    if (selectedFiles.length === 0) {
        filesList.innerHTML = '<p class="no-files">No files selected</p>';
        attachBtn.disabled = true;
    } else {
        attachBtn.disabled = false;
        filesList.innerHTML = selectedFiles.map((file, index) => {
            const icon = getFileIcon(file.type);
            const size = formatFileSize(file.size);

            return `
                <div class="file-item">
                    <div class="file-item-icon">
                        <i class="${icon}"></i>
                    </div>
                    <div class="file-item-info">
                        <div class="file-item-name">${file.name}</div>
                        <div class="file-item-size">${size}</div>
                    </div>
                    <button class="file-item-remove" onclick="removeFile(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');
    }
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFilesList();
}

function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) return 'fas fa-image';
    if (fileType.startsWith('video/')) return 'fas fa-video';
    if (fileType.startsWith('audio/')) return 'fas fa-music';
    if (fileType.includes('pdf')) return 'fas fa-file-pdf';
    if (fileType.includes('word') || fileType.includes('document')) return 'fas fa-file-word';
    if (fileType.includes('excel') || fileType.includes('sheet')) return 'fas fa-file-excel';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'fas fa-file-powerpoint';
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('compressed')) return 'fas fa-file-archive';
    if (fileType.includes('text')) return 'fas fa-file-alt';
    return 'fas fa-file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ===================================
// Authentication Functions
// ===================================

function openAuthModal(tab = 'signin') {
    const authModal = document.getElementById('auth-modal');
    authModal.classList.add('active');

    // Switch to the specified tab
    switchAuthTab(tab);

    // Initialize modal handlers
    initAuthModalHandlers();

    // Close user menu
    document.getElementById('user-menu')?.classList.remove('active');
}

function closeAuthModal() {
    const authModal = document.getElementById('auth-modal');
    authModal.classList.remove('active');

    // Reset forms
    document.getElementById('signin-form-element')?.reset();
    document.getElementById('register-form-element')?.reset();
}

function switchAuthTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.auth-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update form containers
    document.querySelectorAll('.auth-form-container').forEach(container => {
        container.classList.toggle('active', container.id === `${tab}-form`);
    });
}

function initAuthModalHandlers() {
    const authModal = document.getElementById('auth-modal');
    const closeModalBtns = authModal.querySelectorAll('.close-modal');

    // Close modal handlers
    closeModalBtns.forEach(btn => {
        btn.removeEventListener('click', closeAuthModal);
        btn.addEventListener('click', closeAuthModal);
    });

    authModal.removeEventListener('click', handleModalOutsideClick);
    authModal.addEventListener('click', handleModalOutsideClick);

    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.removeEventListener('click', handleTabClick);
        tab.addEventListener('click', handleTabClick);
    });

    // Form submissions
    const signinForm = document.getElementById('signin-form-element');
    const registerForm = document.getElementById('register-form-element');

    signinForm?.removeEventListener('submit', handleSignInSubmit);
    signinForm?.addEventListener('submit', handleSignInSubmit);

    registerForm?.removeEventListener('submit', handleRegisterSubmit);
    registerForm?.addEventListener('submit', handleRegisterSubmit);
}

function handleModalOutsideClick(e) {
    if (e.target === document.getElementById('auth-modal')) {
        closeAuthModal();
    }
}

function handleTabClick(e) {
    const tab = e.currentTarget.dataset.tab;
    switchAuthTab(tab);
}

function handleSignInSubmit(e) {
    e.preventDefault();

    const username = document.getElementById('signin-username').value.trim();
    const password = document.getElementById('signin-password').value;

    if (!username || !password) {
        showNotification('Please fill in all fields', 'warning');
        return;
    }

    // Update user info in sidebar
    const userNameEl = document.querySelector('.user-name');
    const userEmailEl = document.querySelector('.user-email');

    if (userNameEl) {
        userNameEl.textContent = username;
    }

    const email = username.includes('@') ? username : `${username.toLowerCase().replace(/\s+/g, '')}@primeai.com`;

    if (userEmailEl) {
        userEmailEl.textContent = email;
    }

    // Store in AppState
    AppState.user = {
        name: username,
        email: email,
        isAuthenticated: true
    };

    // Save to localStorage
    localStorage.setItem('prime-ai-user', JSON.stringify(AppState.user));

    // Show success notification
    showNotification(`Welcome back, ${username}!`, 'success');

    // Close modal
    closeAuthModal();

    // Add welcome message to chat
    addMessage(`Welcome back, ${username}! How can I help you today?`, 'assistant');
}

function handleRegisterSubmit(e) {
    e.preventDefault();

    const fullname = document.getElementById('register-fullname').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    // Validation
    if (!fullname || !email || !username || !password || !confirmPassword) {
        showNotification('Please fill in all fields', 'warning');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'warning');
        return;
    }

    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'warning');
        return;
    }

    // Update user info in sidebar
    const userNameEl = document.querySelector('.user-name');
    const userEmailEl = document.querySelector('.user-email');

    if (userNameEl) {
        userNameEl.textContent = fullname;
    }

    if (userEmailEl) {
        userEmailEl.textContent = email;
    }

    // Store in AppState
    AppState.user = {
        name: fullname,
        username: username,
        email: email,
        isAuthenticated: true
    };

    // Save to localStorage
    localStorage.setItem('prime-ai-user', JSON.stringify(AppState.user));

    // Show success notification
    showNotification(`Account created successfully! Welcome, ${fullname}!`, 'success');

    // Close modal
    closeAuthModal();

    // Add welcome message to chat
    addMessage(`Welcome to Prime AI, ${fullname}! Your account has been created successfully. How can I assist you today?`, 'assistant');
}

function handleSignOut() {
    if (confirm('Are you sure you want to sign out?')) {
        // Reset user info to default
        const userNameEl = document.querySelector('.user-name');
        const userEmailEl = document.querySelector('.user-email');

        if (userNameEl) {
            userNameEl.textContent = 'User';
        }

        if (userEmailEl) {
            userEmailEl.innerHTML = '<a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="81f4f2e4f3c1f1f3e8ece4e0e8afe2eeec">[email&#160;protected]</a>';
        }

        // Update AppState
        AppState.user = {
            name: 'User',
            email: 'user@example.com',
            isAuthenticated: false
        };

        // Remove from localStorage
        localStorage.removeItem('prime-ai-user');

        // Show notification
        showNotification('You have been signed out successfully.', 'info');

        // Close user menu
        document.getElementById('user-menu')?.classList.remove('active');

        // Clear chat history if desired
        // createNewChat();
    }
}

// Load user from localStorage on init
function loadUserFromStorage() {
    const savedUser = localStorage.getItem('prime-ai-user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            AppState.user = user;

            // Update UI
            const userNameEl = document.querySelector('.user-name');
            const userEmailEl = document.querySelector('.user-email');

            if (userNameEl && user.name) {
                userNameEl.textContent = user.name;
            }

            if (userEmailEl && user.email) {
                userEmailEl.textContent = user.email;
            }
        } catch (error) {
            console.error('Error loading user from storage:', error);
        }
    }
}

// ===================================
// Profile and Settings Modals
// ===================================

function openProfileModal() {
    const profileModal = document.getElementById('profile-modal');
    profileModal.classList.add('active');

    // Load user data into profile
    loadProfileData();

    // Initialize modal handlers
    initProfileModalHandlers();

    // Close user menu
    document.getElementById('user-menu')?.classList.remove('active');
}

function closeProfileModal() {
    const profileModal = document.getElementById('profile-modal');
    profileModal.classList.remove('active');
}

function loadProfileData() {
    const user = AppState.user || {};

    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-username').value = user.username || '';
    document.getElementById('profile-email').value = user.email || '';

    // Load avatar if exists
    if (user.avatar) {
        updateAvatarDisplay(user.avatar);
    }
}

function initProfileModalHandlers() {
    const profileModal = document.getElementById('profile-modal');
    const closeModalBtns = profileModal.querySelectorAll('.close-modal');
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const changeAvatarBtn = document.getElementById('change-avatar-btn');

    // Close modal handlers
    closeModalBtns.forEach(btn => {
        btn.removeEventListener('click', closeProfileModal);
        btn.addEventListener('click', closeProfileModal);
    });

    profileModal.removeEventListener('click', handleProfileModalOutsideClick);
    profileModal.addEventListener('click', handleProfileModalOutsideClick);

    // Edit profile button
    editProfileBtn?.removeEventListener('click', handleEditProfile);
    editProfileBtn?.addEventListener('click', handleEditProfile);

    // Change avatar button
    changeAvatarBtn?.removeEventListener('click', handleChangeAvatar);
    changeAvatarBtn?.addEventListener('click', handleChangeAvatar);
}

function handleProfileModalOutsideClick(e) {
    if (e.target === document.getElementById('profile-modal')) {
        closeProfileModal();
    }
}

function handleEditProfile() {
    const profileName = document.getElementById('profile-name');
    const profileUsername = document.getElementById('profile-username');
    const profileEmail = document.getElementById('profile-email');
    const editBtn = document.getElementById('edit-profile-btn');

    if (profileName.readOnly) {
        // Enable editing
        profileName.readOnly = false;
        profileUsername.readOnly = false;
        profileEmail.readOnly = false;
        editBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        showNotification('You can now edit your profile', 'info');
    } else {
        // Save changes
        const newName = profileName.value.trim();
        const newUsername = profileUsername.value.trim();
        const newEmail = profileEmail.value.trim();

        if (!newName || !newEmail) {
            showNotification('Name and email are required', 'warning');
            return;
        }

        // Update user info in sidebar
        const userNameEl = document.querySelector('.user-name');
        const userEmailEl = document.querySelector('.user-email');

        if (userNameEl) userNameEl.textContent = newName;
        if (userEmailEl) userEmailEl.textContent = newEmail;

        // Update AppState
        AppState.user = {
            ...AppState.user,
            name: newName,
            username: newUsername,
            email: newEmail
        };

        // Save to localStorage
        localStorage.setItem('prime-ai-user', JSON.stringify(AppState.user));

        // Disable editing
        profileName.readOnly = true;
        profileUsername.readOnly = true;
        profileEmail.readOnly = true;
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Profile';

        showNotification('Profile updated successfully!', 'success');
    }
}

function handleChangeAvatar() {
    const avatarFileInput = document.getElementById('avatar-file-input');

    // Trigger file input click
    avatarFileInput.click();

    // Handle file selection
    avatarFileInput.onchange = function (e) {
        const file = e.target.files[0];

        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            showNotification('Please select an image file', 'warning');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showNotification('Image size should be less than 5MB', 'warning');
            return;
        }

        // Read and display the image
        const reader = new FileReader();

        reader.onload = function (event) {
            const imageDataUrl = event.target.result;

            // Update avatar display
            updateAvatarDisplay(imageDataUrl);

            // Save to AppState and localStorage
            AppState.user = {
                ...AppState.user,
                avatar: imageDataUrl
            };

            localStorage.setItem('prime-ai-user', JSON.stringify(AppState.user));

            showNotification('Avatar updated successfully!', 'success');
        };

        reader.onerror = function () {
            showNotification('Error reading image file', 'error');
        };

        reader.readAsDataURL(file);
    };
}

function updateAvatarDisplay(imageDataUrl) {
    // Update in profile modal
    const avatarIcon = document.getElementById('avatar-icon');
    const avatarImage = document.getElementById('avatar-image');

    if (avatarIcon && avatarImage) {
        if (imageDataUrl) {
            avatarIcon.style.display = 'none';
            avatarImage.src = imageDataUrl;
            avatarImage.style.display = 'block';
        } else {
            avatarIcon.style.display = 'block';
            avatarImage.style.display = 'none';
        }
    }

    // Update in sidebar
    const sidebarAvatar = document.querySelector('.user-avatar');
    if (sidebarAvatar) {
        if (imageDataUrl) {
            sidebarAvatar.innerHTML = `<img src="${imageDataUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" alt="User Avatar">`;
        } else {
            sidebarAvatar.innerHTML = '<i class="fas fa-user"></i>';
        }
    }
}

function loadAvatarFromStorage() {
    const user = AppState.user;
    if (user && user.avatar) {
        updateAvatarDisplay(user.avatar);
    }
}

// Settings Modal
function openSettingsModal() {
    const settingsModal = document.getElementById('settings-user-modal');
    settingsModal.classList.add('active');

    // Load current settings
    loadUserSettings();

    // Initialize modal handlers
    initSettingsModalHandlers();

    // Close user menu
    document.getElementById('user-menu')?.classList.remove('active');
}

function closeSettingsModal() {
    const settingsModal = document.getElementById('settings-user-modal');
    settingsModal.classList.remove('active');
}

function loadUserSettings() {
    document.getElementById('user-theme-select').value = AppState.settings.theme || 'dark';
    document.getElementById('user-voice-enabled').checked = AppState.settings.voiceEnabled !== false;
    document.getElementById('user-tts-enabled').checked = AppState.settings.ttsEnabled !== false;
    document.getElementById('user-save-history').checked = AppState.settings.saveHistory !== false;
}

function initSettingsModalHandlers() {
    const settingsModal = document.getElementById('settings-user-modal');
    const closeModalBtns = settingsModal.querySelectorAll('.close-modal');
    const saveSettingsBtn = document.getElementById('save-user-settings-btn');
    const clearChatsBtn = document.getElementById('clear-all-chats-btn');
    const resetSettingsBtn = document.getElementById('reset-settings-btn');

    // Close modal handlers
    closeModalBtns.forEach(btn => {
        btn.removeEventListener('click', closeSettingsModal);
        btn.addEventListener('click', closeSettingsModal);
    });

    settingsModal.removeEventListener('click', handleSettingsModalOutsideClick);
    settingsModal.addEventListener('click', handleSettingsModalOutsideClick);

    // Save settings button
    saveSettingsBtn?.removeEventListener('click', handleSaveUserSettings);
    saveSettingsBtn?.addEventListener('click', handleSaveUserSettings);

    // Clear chats button
    clearChatsBtn?.removeEventListener('click', handleClearAllChats);
    clearChatsBtn?.addEventListener('click', handleClearAllChats);

    // Reset settings button
    resetSettingsBtn?.removeEventListener('click', handleResetSettings);
    resetSettingsBtn?.addEventListener('click', handleResetSettings);
}

function handleSettingsModalOutsideClick(e) {
    if (e.target === document.getElementById('settings-user-modal')) {
        closeSettingsModal();
    }
}

function handleSaveUserSettings() {
    AppState.settings.theme = document.getElementById('user-theme-select').value;
    AppState.settings.voiceEnabled = document.getElementById('user-voice-enabled').checked;
    AppState.settings.ttsEnabled = document.getElementById('user-tts-enabled').checked;
    AppState.settings.saveHistory = document.getElementById('user-save-history').checked;

    localStorage.setItem('prime-ai-settings', JSON.stringify(AppState.settings));

    // Apply theme change
    if (AppState.settings.theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }

    showNotification('Settings saved successfully!', 'success');
    closeSettingsModal();
}

function handleClearAllChats() {
    if (confirm('Are you sure you want to clear all chats? This cannot be undone.')) {
        AppState.chats = {};
        AppState.chatHistory = [];
        localStorage.removeItem('prime-ai-chats');
        createNewChat();
        showNotification('All chats cleared!', 'success');
    }
}

function handleResetSettings() {
    if (confirm('Reset all settings to default values?')) {
        AppState.settings = {
            theme: 'dark',
            voiceEnabled: true,
            ttsEnabled: true,
            saveHistory: true
        };
        localStorage.setItem('prime-ai-settings', JSON.stringify(AppState.settings));
        loadUserSettings();
        showNotification('Settings reset to defaults!', 'success');
    }
}

// ===================================
// Utility Functions
// ===================================

function showNotification(message, type = 'info') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        padding: 16px 20px;
        border-radius: var(--radius);
        box-shadow: var(--shadow-lg);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ===================================
// Export for debugging
// ===================================

window.PrimeAI = {
    AppState,
    addMessage,
    toggleTheme,
    createNewChat,
    speakText
};

console.log('Prime AI ready! Access via window.PrimeAI');
