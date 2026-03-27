/**
 * Prime AI - Main Application JavaScript
 * Dark Black & Navy Blue Theme with Lively Animations
 */

// ===================================
// Configuration
// ===================================

const CONFIG = {
  API_BASE_URL: "http://localhost:5000/api",
  WS_URL: "ws://localhost:5000/ws",
  LOADING_DURATION: 2500, // Loading screen duration in ms
};

// ===================================
// Application State
// ===================================

const AppState = {
  currentChatId: "welcome",
  isVoiceActive: false,
  chatHistory: [],
  chats: {
    welcome: {
      id: "welcome",
      title: "Welcome to Prime AI",
      messages: [],
      timestamp: new Date(),
    },
  },
  selectedPersonality: "study",
  settings: {
    theme: "dark",
    voiceEnabled: true,
    ttsEnabled: true,
    saveHistory: true,
    soundEffects: true,
    analytics: true,
    notifications: true,
  },
  // Voice / TTS settings saved to localStorage
  voiceSettings: {
    gender: "female",
    speed: 1.0,
    pitch: 1.0,
    volume: 1.0,
    selectedVoiceURI: null,
    lang: "en-US",
  },
  voiceClient: null,
  _healthPollId: null,
  pomodoro: {
    running: false,
    phase: "focus",
    timeLeft: 25 * 60,
    totalFocus: 25 * 60,
    completedSessions: 0,
    totalFocusMinutes: 0,
    streak: 0,
    _intervalId: null,
  },
};

// ===================================
// Loading Screen
// ===================================

function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");

  // Fade out loading screen after LOADING_DURATION (2500ms)
  // The percentage counter is driven by CSS @property animation (countUp)
  setTimeout(() => {
    loadingScreen.style.opacity = "0";
    setTimeout(() => {
      loadingScreen.style.display = "none";
    }, 500);
  }, CONFIG.LOADING_DURATION);
}

// ===================================
// Initialization
// ===================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("Prime AI initializing...");

  hideLoadingScreen();

  // Core
  initTheme();
  initChat();
  initSidebar();
  initSettings();
  initVoiceRecognition();

  loadSettings();
  loadUserFromStorage();
  loadAvatarFromStorage();
  loadPersonality();

  // ── NEW FEATURES ──────────────────────────────────
  loadVoiceSettings();
  initVoiceSettingsPanel();
  initSystemHealthPanel();
  initFocusMode();
  initWeeklySummary();
  initProactiveSuggestions();
  initSettingsTabs();
  initTTSStatusChip();
  // ──────────────────────────────────────────────────

  console.log("Prime AI ready!");
});

// ===================================
// Theme Management
// ===================================

function initTheme() {
  const themeToggle = document.getElementById("theme-toggle");
  const savedTheme = localStorage.getItem("theme") || "dark";

  // Initialize state
  AppState.settings.theme = savedTheme;

  // Apply theme
  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }
}

function toggleTheme() {
  const isLight = document.body.classList.contains("light-theme");
  const newTheme = isLight ? "dark" : "light";
  applyTheme(newTheme);
}

function applyTheme(theme) {
  let effectiveTheme = theme;

  // Handle auto theme
  if (theme === "auto") {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    effectiveTheme = prefersDark ? "dark" : "light";
  }

  // Apply class
  if (effectiveTheme === "light") {
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.remove("light-theme");
  }

  // Update state and storage
  AppState.settings.theme = theme;
  localStorage.setItem("theme", theme);

  // Update UI if exists (syncs sidebar toggle with settings)
  const themeSelect = document.getElementById("theme-select");
  if (themeSelect) {
    themeSelect.value = theme;
  }
}

// ===================================
// Sidebar Management
// ===================================

function initSidebar() {
  // Sidebar toggle for mobile
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebar = document.querySelector(".sidebar");

  sidebarToggle?.addEventListener("click", () => {
    sidebar.classList.toggle("active");
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener("click", (e) => {
    if (window.innerWidth <= 768) {
      if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
        sidebar.classList.remove("active");
      }
    }
  });

  // Resizable sidebar functionality
  initResizableSidebar();

  // New chat button
  const newChatBtn = document.getElementById("new-chat-btn");
  newChatBtn.addEventListener("click", createNewChat);

  // User profile menu
  const userProfile = document.getElementById("user-profile");
  const userMenu = document.getElementById("user-menu");

  userProfile?.addEventListener("click", (e) => {
    e.stopPropagation();
    userMenu.classList.toggle("active");
  });

  document.addEventListener("click", () => {
    userMenu?.classList.remove("active");
  });

  // History item clicks
  document.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", function (e) {
      if (
        !e.target.classList.contains("delete-chat-btn") &&
        !e.target.closest(".delete-chat-btn")
      ) {
        selectChat(this);
      }
    });
  });

  // Delete buttons
  document.querySelectorAll(".delete-chat-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      deleteChat(this.closest(".history-item"));
    });
  });

  // Register button
  const registerBtn = document.getElementById("register-btn");
  registerBtn?.addEventListener("click", () => {
    openAuthModal("register");
  });

  // Sign In button
  const signInBtn = document.getElementById("sign-in-btn");
  signInBtn?.addEventListener("click", () => {
    openAuthModal("signin");
  });

  // Sign Out button
  const signOutBtn = document.getElementById("sign-out-btn");
  signOutBtn?.addEventListener("click", () => {
    handleSignOut();
  });

  // Profile button
  const profileBtn = document.getElementById("profile-btn");
  profileBtn?.addEventListener("click", () => {
    openProfileModal();
  });


  // Personality selector
  const modelBtn = document.getElementById("model-btn");
  const personalityMenu = document.getElementById("personality-menu");
  const personalityBackdrop = document.getElementById("personality-backdrop");

  modelBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    personalityMenu.classList.toggle("active");
    personalityBackdrop?.classList.toggle("active");
    // Close user menu if open
    userMenu?.classList.remove("active");
  });

  // Close personality menu when clicking outside
  document.addEventListener("click", () => {
    personalityMenu?.classList.remove("active");
    personalityBackdrop?.classList.remove("active");
  });

  // Close menu when clicking backdrop
  personalityBackdrop?.addEventListener("click", () => {
    personalityMenu?.classList.remove("active");
    personalityBackdrop?.classList.remove("active");
  });

  // Prevent personality menu from closing when clicking inside it
  personalityMenu?.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Prevent user menu from closing when clicking inside it
  userMenu?.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Handle personality selection
  document.querySelectorAll(".personality-option").forEach((option) => {
    option.addEventListener("click", function (e) {
      e.stopPropagation();

      // Remove active class from all options
      document.querySelectorAll(".personality-option").forEach((opt) => {
        opt.classList.remove("active");
      });

      // Add active class to selected option
      this.classList.add("active");

      // Update button text
      const selectedPersonality = this.querySelector("span").textContent;
      modelBtn.querySelector("span").textContent = selectedPersonality;

      // Store selected personality
      const personalityType = this.dataset.personality;
      AppState.selectedPersonality = personalityType;
      localStorage.setItem("prime-ai-personality", personalityType);

      // Show notification
      showNotification(`Switched to ${selectedPersonality}`, "success");

      // Close menu and backdrop
      personalityMenu.classList.remove("active");
      personalityBackdrop?.classList.remove("active");
    });
  });
}

// Resizable Sidebar Implementation
function initResizableSidebar() {
  const sidebar = document.getElementById("sidebar");
  const resizeHandle = document.getElementById("resize-handle");
  const bgParticles = document.querySelector(".bg-particles");

  if (!sidebar || !resizeHandle) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizeHandle.addEventListener("mousedown", (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    const dx = e.clientX - startX;
    const newWidth = Math.max(200, Math.min(400, startWidth + dx));

    sidebar.style.width = `${newWidth}px`;

    // Update particles position
    if (bgParticles) {
      bgParticles.style.left = `${newWidth}px`;
    }
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });
}

function createNewChat() {
  const chatId = "chat_" + Date.now();
  const newChat = {
    id: chatId,
    title: "New Chat",
    messages: [],
    timestamp: new Date(),
  };

  AppState.chats[chatId] = newChat;
  AppState.currentChatId = chatId;

  // Clear chat messages
  const chatMessages = document.getElementById("chat-messages");
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
  document.querySelectorAll(".history-item").forEach((item) => {
    item.classList.remove("active");
  });
  historyItem.classList.add("active");

  // Load chat messages
  // TODO: Load messages for selected chat
}

function deleteChat(historyItem) {
  if (confirm("Delete this chat?")) {
    historyItem.remove();
    // TODO: Remove from AppState.chats
  }
}

// ===================================
// Chat Functionality
// ===================================

function initChat() {
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const voiceBtn = document.getElementById("voice-btn");
  const attachBtn = document.getElementById("attach-btn");

  // Auto-resize textarea
  chatInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 200) + "px";

    // Enable/disable send button
    sendBtn.disabled = !this.value.trim();
  });

  // Send on Enter (Shift+Enter for new line)
  chatInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Send button click
  sendBtn.addEventListener("click", sendMessage);

  // Voice button - Toggle voice recording
  // voiceBtn.addEventListener('click', toggleVoiceRecording); // Legacy - replaced by voice_integration.js

  // Attach button
  attachBtn.addEventListener("click", () => {
    openFileModal();
  });

  // Suggestion cards
  attachSuggestionListeners();
}

function attachSuggestionListeners() {
  document.querySelectorAll(".suggestion-card").forEach((card) => {
    card.addEventListener("click", function () {
      const prompt = this.getAttribute("data-prompt");
      document.getElementById("chat-input").value = prompt;
      sendMessage();
    });
  });
}

// Keywords that trigger the code-generation model (qwen2.5-coder:7b)
const CODE_KEYWORDS = [
  "write", "generate", "create", "code", "function", "class", "script",
  "implement", "program", "algorithm", "snippet", "method", "loop",
  "sort", "search", "recursion", "api", "fetch", "async", "regex",
  "html", "css", "javascript", "python", "java", "c++", "sql",
];

// Keywords that trigger intent routing (/api/chat with intent detection)
const COMMAND_KEYWORDS = [
  "open", "launch", "start", "run", "close", "kill",
  "create folder", "make folder", "mkdir", "make dir",
  "system info", "cpu", "ram", "disk", "memory", "battery",
];

function isCodeRequest(message) {
  const lower = message.toLowerCase();
  return CODE_KEYWORDS.some((kw) => lower.includes(kw));
}

function isCommandRequest(message) {
  const lower = message.toLowerCase();
  return COMMAND_KEYWORDS.some((kw) => lower.startsWith(kw) || lower.includes(kw));
}

async function sendMessage() {
  const chatInput = document.getElementById("chat-input");
  const message = chatInput.value.trim();

  if (!message) return;

  // Clear input
  chatInput.value = "";
  chatInput.style.height = "auto";
  document.getElementById("send-btn").disabled = true;

  // Remove welcome screen if present
  const welcomeScreen = document.querySelector(".welcome-screen");
  if (welcomeScreen) {
    welcomeScreen.remove();
  }

  // Add user message
  addMessage(message, "user");

  // Route to the right endpoint:
  // code keywords  → /api/code  (streams code with syntax highlight)
  // command words  → /api/chat  (intent detection + command execution)
  // everything else→ /api/reply (direct stream, no intent detection = instant)
  if (isCodeRequest(message)) {
    await streamCodeMessage(message);
  } else if (isCommandRequest(message)) {
    await streamChatMessage(message, true);   // true = use /api/chat
  } else {
    await streamChatMessage(message, false);  // false = use /api/reply
  }
}


/**
 * Streams a chat reply via SSE.
 * useCommandRoute=true  → /api/chat (intent detection, for commands like 'open chrome')
 * useCommandRoute=false → /api/reply (no intent detection, instant first token for conversation)
 */
async function streamChatMessage(message, useCommandRoute = false) {
  const chatMessages = document.getElementById("chat-messages");
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  // Show typing indicator (bouncing dots) immediately while waiting for server
  const typingEl = createTypingIndicator();
  chatMessages.appendChild(typingEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Pre-build the real response bubble (not shown yet)
  const msgDiv = document.createElement("div");
  msgDiv.className = "message assistant";
  msgDiv.innerHTML = `
    <div class="message-avatar"><i class="fas fa-brain"></i></div>
    <div class="message-content">
      <span class="chat-streaming-text"></span>
      <div class="message-time">${time}</div>
    </div>
  `;

  const textEl = msgDiv.querySelector(".chat-streaming-text");
  let fullText = "";
  let bubbleShown = false;

  try {
    const endpoint = useCommandRoute ? `${CONFIG.API_BASE_URL}/chat` : `${CONFIG.API_BASE_URL}/reply`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") break;

        // First token: swap dots → real bubble
        if (!bubbleShown) {
          typingEl.remove();
          chatMessages.appendChild(msgDiv);
          bubbleShown = true;
        }

        // Unescape newlines encoded server-side
        const token = payload.replace(/\\n/g, "\n");
        fullText += token;
        textEl.textContent = fullText;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }

    // Edge case: stream ended with no tokens (command that returned empty)
    if (!bubbleShown) {
      typingEl.remove();
      chatMessages.appendChild(msgDiv);
    }

    AppState.chatHistory.push({ sender: "assistant", text: fullText, time });

    // ── TTS: speak the full response once streaming is done ──
    if (AppState.settings.ttsEnabled) {
      speakText(fullText);
    }

  } catch (error) {
    console.error("Chat stream error:", error);
    typingEl.remove();
    if (!bubbleShown) chatMessages.appendChild(msgDiv);
    textEl.textContent = "Sorry, I could not connect to the backend. Make sure app.py is running on port 5000.";
  }
}

/**

 * Streams code from /api/code and renders it live into the chat.
 * Each SSE token is appended to a <pre><code> element as it arrives.
 */
async function streamCodeMessage(message) {
  const chatMessages = document.getElementById("chat-messages");

  // Build the message bubble immediately
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const msgDiv = document.createElement("div");
  msgDiv.className = "message assistant";

  // Detect language hint from the user message for Highlight.js
  const langHint = detectLanguage(message);

  msgDiv.innerHTML = `
    <div class="message-avatar"><i class="fas fa-brain"></i></div>
    <div class="message-content">
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-lang-label">${langHint}</span>
          <button class="code-copy-btn" title="Copy code">
            <i class="fas fa-copy"></i> Copy
          </button>
        </div>
        <pre class="streaming-pre"><code class="hljs language-${langHint} streaming-code"></code></pre>
      </div>
      <div class="message-time">${time}</div>
    </div>
  `;

  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const codeEl = msgDiv.querySelector(".streaming-code");
  const copyBtn = msgDiv.querySelector(".code-copy-btn");
  let fullCode = "";

  // Copy button handler
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(fullCode).then(() => {
      copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 2000);
    });
  });

  // Fetch the SSE stream
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6); // strip "data: "
        if (payload === "[DONE]") break;

        // Unescape the \n we escaped server-side
        const token = payload.replace(/\\n/g, "\n");
        fullCode += token;

        // Render raw text while streaming (escaping HTML)
        codeEl.textContent = fullCode;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }

    // Apply Highlight.js once streaming is complete
    if (window.hljs) {
      hljs.highlightElement(codeEl);
    }

    AppState.chatHistory.push({ sender: "assistant", text: fullCode, time });

  } catch (error) {
    console.error("Code stream error:", error);
    codeEl.textContent = `// Error: Could not connect to backend.\n// Make sure app.py is running on port 5000.`;
  }
}

/**
 * Naively detect the coding language from the user's prompt for labelling.
 */
function detectLanguage(msg) { 
  const m = msg.toLowerCase();
  if (m.includes("python")) return "python";
  if (m.includes("javascript") || m.includes(" js ")) return "javascript";
  if (m.includes("typescript")) return "typescript";
  if (m.includes("java") && !m.includes("javascript")) return "java";
  if (m.includes("c++") || m.includes("cpp")) return "cpp";
  if (m.includes("c#") || m.includes("csharp")) return "csharp";
  if (m.includes("html")) return "html";
  if (m.includes("css")) return "css";
  if (m.includes("sql")) return "sql";
  if (m.includes("bash") || m.includes("shell")) return "bash";
  return "python"; // sensible default
}

function addMessage(text, sender = "user") {
  const chatMessages = document.getElementById("chat-messages");

  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${sender}`;

  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const avatar =
    sender === "user"
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
  if (sender === "assistant" && AppState.settings.ttsEnabled) {
    speakText(text);
  }
}

function createTypingIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "message assistant";
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
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");

      document.getElementById("chat-input").value = transcript;
      document.getElementById("send-btn").disabled = false;
    };

    recognition.onend = () => {
      stopVoiceInput();
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
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
    alert("Speech recognition is not supported in your browser.");
    return;
  }

  if (!AppState.settings.voiceEnabled) {
    alert("Voice input is disabled. Enable it in settings.");
    return;
  }

  AppState.isVoiceActive = true;
  document.getElementById("voice-btn").classList.add("active");

  try {
    recognition.start();
  } catch (error) {
    console.error("Error starting recognition:", error);
    stopVoiceInput();
  }
}

function stopVoiceInput() {
  AppState.isVoiceActive = false;
  document.getElementById("voice-btn").classList.remove("active");

  if (recognition) {
    try {
      recognition.stop();
    } catch (error) {
      console.error("Error stopping recognition:", error);
    }
  }
}

// ===================================
// Voice Client Integration
// ===================================

/* LEGACY VOICE CLIENT INTEGRATION - Replaced by voice_integration.js
function initVoiceClient() {
    // Check if VoiceWebSocketClient is available
    if (typeof VoiceWebSocketClient === 'undefined') {
        console.warn('VoiceWebSocketClient not loaded');
        return;
    }
    
    // Create voice client instance
    AppState.voiceClient = new VoiceWebSocketClient('http://localhost:5000');
    
    // Set up event handlers
    AppState.voiceClient.onStatusChange = (status, message) => {
        console.log(`Voice status: ${status} - ${message}`);
        updateVoiceButtonStatus(status);
    };
    
    AppState.voiceClient.onResult = (text, data) => {
        console.log('Voice transcription:', text);
        handleVoiceTranscription(text);
    };
    
    AppState.voiceClient.onInterimResult = (text, data) => {
        console.log('Voice interim transcription:', text);
        // Send interim results to mic window for real-time display
        sendToMicWindow({
            type: 'transcription_update',
            text: text,
            interim: true
        });
    };
    
    AppState.voiceClient.onError = (error) => {
        console.error('Voice error:', error);
        showNotification(error, 'error');
        stopVoiceRecording();
    };
    
    // Connect to voice server
    AppState.voiceClient.connect()
        .then(() => {
            console.log('✅ Voice client connected');
        })
        .catch((error) => {
            console.error('❌ Voice client connection failed:', error);
            console.log('Make sure voice server is running on http://localhost:5000');
        });
}

function updateVoiceButtonStatus(status) {
    const voiceBtn = document.getElementById('voice-btn');
    if (!voiceBtn) return;
    
    switch (status) {
        case 'recording':
        case 'listening':
            voiceBtn.classList.add('active');
            voiceBtn.title = 'Recording... Click to stop';
            break;
        case 'processing':
            voiceBtn.classList.add('processing');
            voiceBtn.title = 'Processing audio...';
            break;
        default:
            voiceBtn.classList.remove('active', 'processing');
            voiceBtn.title = 'Voice input';
    }
}

function handleVoiceTranscription(text) {
    // Put transcription in chat input
    const chatInput = document.getElementById('chat-input');
    chatInput.value = text;
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
    
    // Enable send button
    document.getElementById('send-btn').disabled = false;
    
    // Focus input for editing
    chatInput.focus();
    
    // Send transcription to mic window for display
    sendToMicWindow({
        type: 'transcription_update',
        text: text
    });
    
    // Show notification
    showNotification('Voice transcribed successfully', 'success');
}

function startVoiceRecording() {
    if (!AppState.voiceClient || !AppState.voiceClient.isConnected) {
        showNotification('Voice server not connected. Please start the voice server.', 'error');
        return;
    }
    
    if (!AppState.settings.voiceEnabled) {
        showNotification('Voice input is disabled. Enable it in settings.', 'error');
        return;
    }
    
    AppState.isVoiceActive = true;
    AppState.voiceClient.startRecording();
    
    // Notify mic window that recording has started
    sendToMicWindow({
        type: 'start_listening'
    });
}

function stopVoiceRecording() {
    if (AppState.voiceClient) {
        AppState.voiceClient.stopRecording();
    }
    AppState.isVoiceActive = false;
    
    // Notify mic window that recording has stopped
    sendToMicWindow({
        type: 'stop_listening'
    });
}

function toggleVoiceRecording() {
    if (AppState.isVoiceActive) {
        stopVoiceRecording();
    } else {
        // Open mic window when starting voice recording
        openMicWindow();
        startVoiceRecording();
    }
}
*/
// ===================================
// User Profile Interactions
// ===================================

// ===================================
// Mic Window Integration
// ===================================

/* LEGACY MIC WINDOW INTEGRATION - Replaced by voice_integration.js
// let micWindow = null;

// function openMicWindow() {
//     if (micWindow && !micWindow.closed) {
//         micWindow.focus();
//         return;
//     }

//     // Calculate center position
//     const width = 500;
//     const height = 500;
//     const left = (screen.width - width) / 2;
//     const top = (screen.height - height) / 2;

//     // Open popup window
//     micWindow = window.open(
//         'mic_button_ui.html',
//         'PrimeAI_Voice',
//         `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
//     );

//     // Setup message listener
//     window.addEventListener('message', handleMicMessage);

//     // Check if window is closed
//     const checkClosed = setInterval(() => {
//         if (micWindow && micWindow.closed) {
//             clearInterval(checkClosed);
//             updateVoiceStatus(false);
//             micWindow = null;
//         }
//     }, 500);
// }

// // Handle messages from mic window
// function handleMicMessage(event) {
//     if (!event.data || !event.data.type) return;

//     switch (event.data.type) {
//         case 'mic_listening':
//             AppState.isVoiceActive = event.data.listening;
//             updateVoiceStatus(event.data.listening);
//             console.log('Mic listening:', event.data.listening);
//             break;

//         case 'mic_result':
//             handleVoiceCommand(event.data.text);
//             break;

//         case 'mic_processing':
//             console.log('Processing audio...');
//             break;
//     }
// }

// // Update voice button status
// function updateVoiceStatus(listening) {
//     const voiceBtn = document.getElementById('voice-btn');
//     if (!voiceBtn) return;

//     if (listening) {
//         voiceBtn.classList.add('active');
//         voiceBtn.title = 'Listening...';
//     } else {
//         voiceBtn.classList.remove('active');
//         voiceBtn.title = 'Voice input';
//     }
// }

// // Process voice commands from mic window
// function handleVoiceCommand(text) {
//     console.log('Voice Command Received:', text);
    
//     const command = text.toLowerCase();

//     // Hide welcome screen if visible
//     const welcomeScreen = document.querySelector('.welcome-screen');
//     if (welcomeScreen) {
//         welcomeScreen.remove();
//     }

//     // Add user message
//     addMessage(text, 'user');

//     // Process specific commands
//     if (command.includes('open file') || command.includes('file manager')) {
//         setTimeout(() => {
//             addMessage('Opening file manager... What would you like me to help you with?', 'assistant');
//         }, 500);
//     }
//     else if (command.includes('create file')) {
//         setTimeout(() => {
//             addMessage('What type of file would you like to create? (e.g., document, spreadsheet, text file)', 'assistant');
//         }, 500);
//     }
//     else if (command.includes('organize files') || command.includes('organize my files')) {
//         setTimeout(() => {
//             addMessage('I\'ll help you organize your files. Would you like me to sort them by date, type, or size?', 'assistant');
//         }, 500);
//     }
//     else if (command.includes('summarize') || command.includes('summary')) {
//         setTimeout(() => {
//             addMessage('I can help you generate a summary. Please upload the document you\'d like me to summarize.', 'assistant');
//         }, 500);
//     }
//     else if (command.includes('study plan') || command.includes('study schedule')) {
//         setTimeout(() => {
//             addMessage('I\'ll create a study plan for you. What subjects or topics would you like to focus on?', 'assistant');
//         }, 500);
//     }
//     else if (command.includes('explain code') || command.includes('code explanation')) {
//         setTimeout(() => {
//             addMessage('I can help explain code. Please paste the code you\'d like me to explain.', 'assistant');
//         }, 500);
//     }
//     else if (command.includes('debug')) {
//         setTimeout(() => {
//             addMessage('I\'ll help you debug your code. Please share the code and describe the issue you\'re experiencing.', 'assistant');
//         }, 500);
//     }
//     else if (command.includes('check system') || command.includes('system health')) {
//         setTimeout(() => {
//             addMessage('Running system health check...\n\n📊 CPU Usage: 45%\n💾 RAM: 62% (8.2 GB / 16 GB)\n💿 Disk Space: 78% used (234 GB free)\n🌡️ Temperature: Normal\n\nYour system is running smoothly! Would you like me to suggest any optimizations?', 'assistant');
//         }, 500);
//     }
//     else if (command.includes('settings')) {
//         setTimeout(() => {
//             addMessage('Opening settings panel...', 'assistant');
//             document.getElementById('settings-btn').click();
//         }, 500);
//     }
//     else if (command.includes('help')) {
//         setTimeout(() => {
//             addMessage('Here are some things I can help you with:\n\n📁 File Management - "organize my files", "open file manager"\n📚 Study Support - "create study plan", "summarize document"\n💻 Coding Help - "explain code", "debug this code"\n⚙️ System Monitoring - "check system health"\n\nWhat would you like to do?', 'assistant');
//         }, 500);
//     }
//     else if (command.includes('new chat')) {
//         createNewChat();
//         setTimeout(() => {
//             addMessage('Started a new chat! How can I help you?', 'assistant');
//         }, 500);
//     }
//     // Default response
//     else {
//         setTimeout(() => {
//             addMessage(`I heard you say: "${text}"\n\nHow can I help you with this?`, 'assistant');
//         }, 500);
//     }
// }

// Send message to mic window (optional)
// function sendToMicWindow(message) {
//     if (micWindow && !micWindow.closed) {
//         micWindow.postMessage(message, '*');
//     }
// }
*/

// ===================================
// Text-to-Speech
// ===================================

function speakText(text) {
  if (!("speechSynthesis" in window)) return;
  if (!AppState.settings.ttsEnabled) return;
  if (!text || !text.trim()) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  function _doSpeak() {
    // Clean text for TTS (strip markdown-style symbols)
    const cleanText = text
      .replace(/#{1,6}\s/g, "")
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
      .replace(/`{1,3}[^`]*`{1,3}/g, "")
      .replace(/\n+/g, ". ")
      .substring(0, 600); // Cap at 600 chars to avoid very long speech

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Apply voice settings from AppState
    const vs = AppState.voiceSettings;
    utterance.rate   = vs.speed  || 1.0;
    utterance.pitch  = vs.pitch  || 1.0;
    utterance.volume = vs.volume || 1.0;

    // Pick the selected voice
    const voices = window.speechSynthesis.getVoices();
    if (vs.selectedVoiceURI) {
      const chosen = voices.find(v => v.voiceURI === vs.selectedVoiceURI);
      if (chosen) {
        utterance.voice = chosen;
        utterance.lang  = chosen.lang;
      }
    } else {
      // Fallback: pick a voice matching preferred gender/lang
      const langPref = vs.lang || "en-US";
      const genderPref = vs.gender || "female";
      // Try to find a voice matching language & name hints
      let best = voices.find(v => v.lang === langPref) ||
                 voices.find(v => v.lang.startsWith("en")) ||
                 voices[0];
      if (best) { utterance.voice = best; utterance.lang = best.lang; }
    }

    // Update TTS status chip
    const chip = document.getElementById("tts-voice-name");
    if (chip) {
      const voiceName = utterance.voice ? utterance.voice.name.split(" ")[0] : "Voice";
      chip.textContent = `${voiceName} · ${(vs.speed || 1.0).toFixed(1)}×`;
    }
    const chipEl = document.getElementById("tts-status-chip");
    chipEl?.classList.add("speaking");

    utterance.onend = () => {
      chipEl?.classList.remove("speaking");
    };

    window.speechSynthesis.speak(utterance);
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      setTimeout(_doSpeak, 100);
    };
  } else {
    setTimeout(_doSpeak, 150);
  }
}

// ===================================
// Notification System
// ===================================

function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transform: translateX(400px);
        transition: transform 0.3s ease;
        z-index: 10000;
        max-width: 300px;
    `;

  // Set background based on type
  const backgrounds = {
    success: "linear-gradient(135deg, #4caf50, #45a049)",
    error: "linear-gradient(135deg, #f44336, #d32f2f)",
    info: "linear-gradient(135deg, #2196f3, #1976d2)",
    warning: "linear-gradient(135deg, #ff9800, #f57c00)",
  };
  notification.style.background = backgrounds[type] || backgrounds.info;

  // Add to body
  document.body.appendChild(notification);

  // Show notification
  setTimeout(() => {
    notification.style.transform = "translateX(0)";
  }, 10);

  // Hide and remove after 3 seconds
  setTimeout(() => {
    notification.style.transform = "translateX(400px)";
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// ===================================
// Settings Management
// ===================================

function initSettings() {
  const settingsBtn = document.getElementById("settings-btn");
  const settingsModal = document.getElementById("settings-modal");
  const closeModalBtns = settingsModal.querySelectorAll(".close-modal");

  settingsBtn.addEventListener("click", () => {
    settingsModal.classList.add("active");
    loadSettingsToUI();
  });

  closeModalBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      settingsModal.classList.remove("active");
    });
  });

  // Close on outside click
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.remove("active");
    }
  });

  // Live theme preview
  const themeSelect = document.getElementById("theme-select");
  themeSelect?.addEventListener("change", (e) => {
    applyTheme(e.target.value);
  });

  // Save Settings button
  document.getElementById("save-settings-btn")?.addEventListener("click", () => {
    saveSettingsFromUI();
    settingsModal.classList.remove("active");
    showNotification("Settings saved!", "success");
  });

  // Clear all chats
  document.getElementById("clear-all-chats-btn")?.addEventListener("click", () => {
    if (confirm("Clear all chat history? This cannot be undone.")) {
      AppState.chats = {};
      AppState.chatHistory = [];
      localStorage.removeItem("prime-ai-chats");
      createNewChat();
      showNotification("All chats cleared!", "success");
    }
  });

  // Reset to defaults
  document.getElementById("reset-settings-btn")?.addEventListener("click", () => {
    if (confirm("Reset all settings to defaults?")) {
      AppState.settings = {
        theme: "dark",
        voiceEnabled: true,
        ttsEnabled: true,
        saveHistory: true,
        analytics: true,
        notifications: true,
        soundEffects: true,
      };
      localStorage.setItem("prime-ai-settings", JSON.stringify(AppState.settings));
      applyTheme("dark");
      loadSettingsToUI();
      showNotification("Settings reset to defaults!", "success");
    }
  });
}

function loadSettingsToUI() {
  const s = AppState.settings;
  document.getElementById("theme-select").value        = s.theme       || "dark";
  document.getElementById("voice-enabled").checked     = s.voiceEnabled  !== false;
  document.getElementById("tts-enabled").checked       = s.ttsEnabled    !== false;
  document.getElementById("sound-effects").checked     = s.soundEffects  !== false;
  document.getElementById("save-history").checked      = s.saveHistory   !== false;
  document.getElementById("analytics").checked         = s.analytics     !== false;
  document.getElementById("notifications").checked     = s.notifications !== false;
}

function saveSettingsFromUI() {
  AppState.settings.theme         = document.getElementById("theme-select").value;
  AppState.settings.voiceEnabled  = document.getElementById("voice-enabled").checked;
  AppState.settings.ttsEnabled    = document.getElementById("tts-enabled").checked;
  AppState.settings.soundEffects  = document.getElementById("sound-effects").checked;
  AppState.settings.saveHistory   = document.getElementById("save-history").checked;
  AppState.settings.analytics     = document.getElementById("analytics").checked;
  AppState.settings.notifications = document.getElementById("notifications").checked;

  localStorage.setItem("prime-ai-settings", JSON.stringify(AppState.settings));
}

function loadSettings() {
  const saved = localStorage.getItem("prime-ai-settings");
  if (saved) {
    AppState.settings = { ...AppState.settings, ...JSON.parse(saved) };
  }
}

// ===================================
// Personality Management
// ===================================

function loadPersonality() {
  const savedPersonality = localStorage.getItem("prime-ai-personality");
  if (savedPersonality) {
    AppState.selectedPersonality = savedPersonality;

    // Update UI
    const modelBtn = document.getElementById("model-btn");
    const personalityOptions = document.querySelectorAll(".personality-option");

    personalityOptions.forEach((option) => {
      if (option.dataset.personality === savedPersonality) {
        option.classList.add("active");
        if (modelBtn) {
          modelBtn.querySelector("span").textContent =
            option.querySelector("span").textContent;
        }
      } else {
        option.classList.remove("active");
      }
    });
  }
}

// ===================================
// File Attachment Modal
// ===================================

let selectedFiles = [];

function openFileModal() {
  const fileModal = document.getElementById("file-modal");
  fileModal.classList.add("active");
  initFileModalHandlers();
}

function closeFileModal() {
  const fileModal = document.getElementById("file-modal");
  fileModal.classList.remove("active");
  selectedFiles = [];
  updateFilesList();
}

function initFileModalHandlers() {
  const fileModal = document.getElementById("file-modal");
  const fileUploadZone = document.getElementById("file-upload-zone");
  const fileInput = document.getElementById("file-input");
  const browseBtn = document.getElementById("browse-btn");
  const attachFilesBtn = document.getElementById("attach-files-btn");
  const closeModalBtns = fileModal.querySelectorAll(".close-modal");

  // Remove existing listeners to prevent duplicates
  const newUploadZone = fileUploadZone.cloneNode(true);
  fileUploadZone.parentNode.replaceChild(newUploadZone, fileUploadZone);

  // Close modal handlers
  closeModalBtns.forEach((btn) => {
    btn.addEventListener("click", closeFileModal);
  });

  fileModal.addEventListener("click", (e) => {
    if (e.target === fileModal) {
      closeFileModal();
    }
  });

  // Browse button
  document.getElementById("browse-btn").addEventListener("click", () => {
    fileInput.click();
  });

  // File input change
  fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
  });

  // Drag and drop
  const uploadZone = document.getElementById("file-upload-zone");

  uploadZone.addEventListener("click", () => {
    fileInput.click();
  });

  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("drag-over");
  });

  uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("drag-over");
  });

  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    handleFiles(e.dataTransfer.files);
  });

  // File type filters
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      // Filter logic can be added here if needed
    });
  });

  // Attach files button
  attachFilesBtn.addEventListener("click", () => {
    if (selectedFiles.length > 0) {
      const fileNames = selectedFiles.map((f) => f.name).join(", ");
      addMessage(
        `📎 Attached ${selectedFiles.length} file(s): ${fileNames}`,
        "user",
      );
      showNotification(
        `${selectedFiles.length} file(s) attached successfully!`,
        "success",
      );
      closeFileModal();
    }
  });
}

function handleFiles(files) {
  const filesArray = Array.from(files);

  filesArray.forEach((file) => {
    // Check if file already exists
    if (
      !selectedFiles.find((f) => f.name === file.name && f.size === file.size)
    ) {
      selectedFiles.push(file);
    }
  });

  updateFilesList();
}

function updateFilesList() {
  const filesList = document.getElementById("files-list");
  const attachBtn = document.getElementById("attach-files-btn");

  if (selectedFiles.length === 0) {
    filesList.innerHTML = '<p class="no-files">No files selected</p>';
    attachBtn.disabled = true;
  } else {
    attachBtn.disabled = false;
    filesList.innerHTML = selectedFiles
      .map((file, index) => {
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
      })
      .join("");
  }
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  updateFilesList();
}

function getFileIcon(fileType) {
  if (fileType.startsWith("image/")) return "fas fa-image";
  if (fileType.startsWith("video/")) return "fas fa-video";
  if (fileType.startsWith("audio/")) return "fas fa-music";
  if (fileType.includes("pdf")) return "fas fa-file-pdf";
  if (fileType.includes("word") || fileType.includes("document"))
    return "fas fa-file-word";
  if (fileType.includes("excel") || fileType.includes("sheet"))
    return "fas fa-file-excel";
  if (fileType.includes("powerpoint") || fileType.includes("presentation"))
    return "fas fa-file-powerpoint";
  if (
    fileType.includes("zip") ||
    fileType.includes("rar") ||
    fileType.includes("compressed")
  )
    return "fas fa-file-archive";
  if (fileType.includes("text")) return "fas fa-file-alt";
  return "fas fa-file";
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// ===================================
// Authentication Functions
// ===================================

function openAuthModal(tab = "signin") {
  const authModal = document.getElementById("auth-modal");
  authModal.classList.add("active");

  // Switch to the specified tab
  switchAuthTab(tab);

  // Initialize modal handlers
  initAuthModalHandlers();

  // Close user menu
  document.getElementById("user-menu")?.classList.remove("active");
}

function closeAuthModal() {
  const authModal = document.getElementById("auth-modal");
  authModal.classList.remove("active");

  // Reset forms
  document.getElementById("signin-form-element")?.reset();
  document.getElementById("register-form-element")?.reset();
}

function switchAuthTab(tab) {
  // Update tab buttons
  document.querySelectorAll(".auth-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  // Update form containers
  document.querySelectorAll(".auth-form-container").forEach((container) => {
    container.classList.toggle("active", container.id === `${tab}-form`);
  });
}

function initAuthModalHandlers() {
  const authModal = document.getElementById("auth-modal");
  const closeModalBtns = authModal.querySelectorAll(".close-modal");

  // Close modal handlers
  closeModalBtns.forEach((btn) => {
    btn.removeEventListener("click", closeAuthModal);
    btn.addEventListener("click", closeAuthModal);
  });

  authModal.removeEventListener("click", handleModalOutsideClick);
  authModal.addEventListener("click", handleModalOutsideClick);

  // Tab switching
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.removeEventListener("click", handleTabClick);
    tab.addEventListener("click", handleTabClick);
  });

  // Form submissions
  const signinForm = document.getElementById("signin-form-element");
  const registerForm = document.getElementById("register-form-element");

  signinForm?.removeEventListener("submit", handleSignInSubmit);
  signinForm?.addEventListener("submit", handleSignInSubmit);

  registerForm?.removeEventListener("submit", handleRegisterSubmit);
  registerForm?.addEventListener("submit", handleRegisterSubmit);
}

function handleModalOutsideClick(e) {
  if (e.target === document.getElementById("auth-modal")) {
    closeAuthModal();
  }
}

function handleTabClick(e) {
  const tab = e.currentTarget.dataset.tab;
  switchAuthTab(tab);
}

function handleSignInSubmit(e) {
  e.preventDefault();

  const username = document.getElementById("signin-username").value.trim();
  const password = document.getElementById("signin-password").value;

  if (!username || !password) {
    showNotification("Please fill in all fields", "warning");
    return;
  }

  // Update user info in sidebar
  const userNameEl = document.querySelector(".user-name");
  const userEmailEl = document.querySelector(".user-email");

  if (userNameEl) {
    userNameEl.textContent = username;
  }

  const email = username.includes("@")
    ? username
    : `${username.toLowerCase().replace(/\s+/g, "")}@primeai.com`;

  if (userEmailEl) {
    userEmailEl.textContent = email;
  }

  // Store in AppState
  AppState.user = {
    name: username,
    email: email,
    isAuthenticated: true,
  };

  // Save to localStorage
  localStorage.setItem("prime-ai-user", JSON.stringify(AppState.user));

  // Show success notification
  showNotification(`Welcome back, ${username}!`, "success");

  // Close modal
  closeAuthModal();

  // Add welcome message to chat
  addMessage(
    `Welcome back, ${username}! How can I help you today?`,
    "assistant",
  );
}

function handleRegisterSubmit(e) {
  e.preventDefault();

  const fullname = document.getElementById("register-fullname").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const username = document.getElementById("register-username").value.trim();
  const password = document.getElementById("register-password").value;
  const confirmPassword = document.getElementById(
    "register-confirm-password",
  ).value;

  // Validation
  if (!fullname || !email || !username || !password || !confirmPassword) {
    showNotification("Please fill in all fields", "warning");
    return;
  }

  if (password !== confirmPassword) {
    showNotification("Passwords do not match", "warning");
    return;
  }

  if (password.length < 6) {
    showNotification("Password must be at least 6 characters", "warning");
    return;
  }

  // Update user info in sidebar
  const userNameEl = document.querySelector(".user-name");
  const userEmailEl = document.querySelector(".user-email");

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
    isAuthenticated: true,
  };

  // Save to localStorage
  localStorage.setItem("prime-ai-user", JSON.stringify(AppState.user));

  // Show success notification
  showNotification(
    `Account created successfully! Welcome, ${fullname}!`,
    "success",
  );

  // Close modal
  closeAuthModal();

  // Add welcome message to chat
  addMessage(
    `Welcome to Prime AI, ${fullname}! Your account has been created successfully. How can I assist you today?`,
    "assistant",
  );
}

function handleSignOut() {
  if (confirm("Are you sure you want to sign out?")) {
    // Reset user info to default
    const userNameEl = document.querySelector(".user-name");
    const userEmailEl = document.querySelector(".user-email");

    if (userNameEl) {
      userNameEl.textContent = "User";
    }

    if (userEmailEl) {
      userEmailEl.innerHTML =
        '<a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="81f4f2e4f3c1f1f3e8ece4e0e8afe2eeec">[email&#160;protected]</a>';
    }

    // Update AppState
    AppState.user = {
      name: "User",
      email: "user@example.com",
      isAuthenticated: false,
    };

    // Remove from localStorage
    localStorage.removeItem("prime-ai-user");

    // Show notification
    showNotification("You have been signed out successfully.", "info");

    // Close user menu
    document.getElementById("user-menu")?.classList.remove("active");

    // Clear chat history if desired
    // createNewChat();
  }
}

// Load user from localStorage on init
function loadUserFromStorage() {
  const savedUser = localStorage.getItem("prime-ai-user");
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      AppState.user = user;

      // Update UI
      const userNameEl = document.querySelector(".user-name");
      const userEmailEl = document.querySelector(".user-email");

      if (userNameEl && user.name) {
        userNameEl.textContent = user.name;
      }

      if (userEmailEl && user.email) {
        userEmailEl.textContent = user.email;
      }
    } catch (error) {
      console.error("Error loading user from storage:", error);
    }
  }
}

// ===================================
// Profile and Settings Modals
// ===================================

function openProfileModal() {
  const profileModal = document.getElementById("profile-modal");
  profileModal.classList.add("active");

  // Load user data into profile
  loadProfileData();

  // Initialize modal handlers
  initProfileModalHandlers();

  // Close user menu
  document.getElementById("user-menu")?.classList.remove("active");
}

function closeProfileModal() {
  const profileModal = document.getElementById("profile-modal");
  profileModal.classList.remove("active");
}

function loadProfileData() {
  const user = AppState.user || {};

  document.getElementById("profile-name").value = user.name || "";
  document.getElementById("profile-username").value = user.username || "";
  document.getElementById("profile-email").value = user.email || "";

  // Load avatar if exists
  if (user.avatar) {
    updateAvatarDisplay(user.avatar);
  }
}

function initProfileModalHandlers() {
  const profileModal = document.getElementById("profile-modal");
  const closeModalBtns = profileModal.querySelectorAll(".close-modal");
  const editProfileBtn = document.getElementById("edit-profile-btn");
  const changeAvatarBtn = document.getElementById("change-avatar-btn");

  // Close modal handlers
  closeModalBtns.forEach((btn) => {
    btn.removeEventListener("click", closeProfileModal);
    btn.addEventListener("click", closeProfileModal);
  });

  profileModal.removeEventListener("click", handleProfileModalOutsideClick);
  profileModal.addEventListener("click", handleProfileModalOutsideClick);

  // Edit profile button
  editProfileBtn?.removeEventListener("click", handleEditProfile);
  editProfileBtn?.addEventListener("click", handleEditProfile);

  // Change avatar button
  changeAvatarBtn?.removeEventListener("click", handleChangeAvatar);
  changeAvatarBtn?.addEventListener("click", handleChangeAvatar);
}

function handleProfileModalOutsideClick(e) {
  if (e.target === document.getElementById("profile-modal")) {
    closeProfileModal();
  }
}

function handleEditProfile() {
  const profileName = document.getElementById("profile-name");
  const profileUsername = document.getElementById("profile-username");
  const profileEmail = document.getElementById("profile-email");
  const editBtn = document.getElementById("edit-profile-btn");

  if (profileName.readOnly) {
    // Enable editing
    profileName.readOnly = false;
    profileUsername.readOnly = false;
    profileEmail.readOnly = false;
    editBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    showNotification("You can now edit your profile", "info");
  } else {
    // Save changes
    const newName = profileName.value.trim();
    const newUsername = profileUsername.value.trim();
    const newEmail = profileEmail.value.trim();

    if (!newName || !newEmail) {
      showNotification("Name and email are required", "warning");
      return;
    }

    // Update user info in sidebar
    const userNameEl = document.querySelector(".user-name");
    const userEmailEl = document.querySelector(".user-email");

    if (userNameEl) userNameEl.textContent = newName;
    if (userEmailEl) userEmailEl.textContent = newEmail;

    // Update AppState
    AppState.user = {
      ...AppState.user,
      name: newName,
      username: newUsername,
      email: newEmail,
    };

    // Save to localStorage
    localStorage.setItem("prime-ai-user", JSON.stringify(AppState.user));

    // Disable editing
    profileName.readOnly = true;
    profileUsername.readOnly = true;
    profileEmail.readOnly = true;
    editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit Profile';

    showNotification("Profile updated successfully!", "success");
  }
}

function handleChangeAvatar() {
  const avatarFileInput = document.getElementById("avatar-file-input");

  // Trigger file input click
  avatarFileInput.click();

  // Handle file selection
  avatarFileInput.onchange = function (e) {
    const file = e.target.files[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      showNotification("Please select an image file", "warning");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showNotification("Image size should be less than 5MB", "warning");
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
        avatar: imageDataUrl,
      };

      localStorage.setItem("prime-ai-user", JSON.stringify(AppState.user));

      showNotification("Avatar updated successfully!", "success");
    };

    reader.onerror = function () {
      showNotification("Error reading image file", "error");
    };

    reader.readAsDataURL(file);
  };
}

function updateAvatarDisplay(imageDataUrl) {
  // Update in profile modal
  const avatarIcon = document.getElementById("avatar-icon");
  const avatarImage = document.getElementById("avatar-image");

  if (avatarIcon && avatarImage) {
    if (imageDataUrl) {
      avatarIcon.style.display = "none";
      avatarImage.src = imageDataUrl;
      avatarImage.style.display = "block";
    } else {
      avatarIcon.style.display = "block";
      avatarImage.style.display = "none";
    }
  }

  // Update in sidebar
  const sidebarAvatar = document.querySelector(".user-avatar");
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
  const settingsModal = document.getElementById("settings-user-modal");
  settingsModal.classList.add("active");

  // Load current settings
  loadUserSettings();

  // Initialize modal handlers
  initSettingsModalHandlers();

  // Close user menu
  document.getElementById("user-menu")?.classList.remove("active");
}

function closeSettingsModal() {
  const settingsModal = document.getElementById("settings-user-modal");
  settingsModal.classList.remove("active");
}

function loadUserSettings() {
  document.getElementById("user-theme-select").value =
    AppState.settings.theme || "dark";
  document.getElementById("user-voice-enabled").checked =
    AppState.settings.voiceEnabled !== false;
  document.getElementById("user-tts-enabled").checked =
    AppState.settings.ttsEnabled !== false;
  document.getElementById("user-save-history").checked =
    AppState.settings.saveHistory !== false;
}

function initSettingsModalHandlers() {
  const settingsModal = document.getElementById("settings-user-modal");
  const closeModalBtns = settingsModal.querySelectorAll(".close-modal");
  const saveSettingsBtn = document.getElementById("save-user-settings-btn");
  const clearChatsBtn = document.getElementById("clear-all-chats-btn");
  const resetSettingsBtn = document.getElementById("reset-settings-btn");
  const themeSelect = document.getElementById("user-theme-select");

  // Close modal handlers
  closeModalBtns.forEach((btn) => {
    btn.removeEventListener("click", closeSettingsModal);
    btn.addEventListener("click", closeSettingsModal);
  });

  settingsModal.removeEventListener("click", handleSettingsModalOutsideClick);
  settingsModal.addEventListener("click", handleSettingsModalOutsideClick);

  // Live theme preview — apply as soon as dropdown changes
  const handleThemeChange = (e) => applyTheme(e.target.value);
  themeSelect?.removeEventListener("change", handleThemeChange);
  themeSelect?.addEventListener("change", handleThemeChange);

  // Save settings button
  saveSettingsBtn?.removeEventListener("click", handleSaveUserSettings);
  saveSettingsBtn?.addEventListener("click", handleSaveUserSettings);

  // Clear chats button
  clearChatsBtn?.removeEventListener("click", handleClearAllChats);
  clearChatsBtn?.addEventListener("click", handleClearAllChats);

  // Reset settings button
  resetSettingsBtn?.removeEventListener("click", handleResetSettings);
  resetSettingsBtn?.addEventListener("click", handleResetSettings);
}

function handleSettingsModalOutsideClick(e) {
  if (e.target === document.getElementById("settings-user-modal")) {
    closeSettingsModal();
  }
}

function handleSaveUserSettings() {
  AppState.settings.theme = document.getElementById("user-theme-select").value;
  AppState.settings.voiceEnabled =
    document.getElementById("user-voice-enabled").checked;
  AppState.settings.ttsEnabled =
    document.getElementById("user-tts-enabled").checked;
  AppState.settings.saveHistory =
    document.getElementById("user-save-history").checked;

  localStorage.setItem("prime-ai-settings", JSON.stringify(AppState.settings));

  // Apply theme (handles dark / light / auto correctly)
  applyTheme(AppState.settings.theme);

  showNotification("Settings saved successfully!", "success");
  closeSettingsModal();
}

function handleClearAllChats() {
  if (
    confirm("Are you sure you want to clear all chats? This cannot be undone.")
  ) {
    AppState.chats = {};
    AppState.chatHistory = [];
    localStorage.removeItem("prime-ai-chats");
    createNewChat();
    showNotification("All chats cleared!", "success");
  }
}

function handleResetSettings() {
  if (confirm("Reset all settings to default values?")) {
    AppState.settings = {
      theme: "dark",
      voiceEnabled: true,
      ttsEnabled: true,
      saveHistory: true,
    };
    localStorage.setItem(
      "prime-ai-settings",
      JSON.stringify(AppState.settings),
    );
    loadUserSettings();
    showNotification("Settings reset to defaults!", "success");
  }
}

// ===================================
// Utility Functions
// ===================================

function showNotification(message, type = "info") {
  // Create toast notification
  const toast = document.createElement("div");
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
  speakText,
};

console.log("Prime AI ready! Access via window.PrimeAI");

// ╔══════════════════════════════════════════════════════════════╗
// ║            PRIME AI v3.0 — NEW FEATURE MODULES              ║
// ╚══════════════════════════════════════════════════════════════╝


// ═══════════════════════════════════════════════════════════════
// 1. VOICE SETTINGS  (Gender · Variant · Speed · Pitch · Volume)
// ═══════════════════════════════════════════════════════════════

const VOICE_PRESETS = [
  // Male
  { id: "male_neutral",  name: "Alex",   gender: "male",   accent: "American",   icon: "🎙️", lang: "en-US" },
  { id: "male_british",  name: "James",  gender: "male",   accent: "British",    icon: "🎙️", lang: "en-GB" },
  { id: "male_au",       name: "Jack",   gender: "male",   accent: "Australian", icon: "🎙️", lang: "en-AU" },
  // Female
  { id: "female_neutral",name: "Aria",   gender: "female", accent: "American",   icon: "🎤", lang: "en-US" },
  { id: "female_british",name: "Sophie", gender: "female", accent: "British",    icon: "🎤", lang: "en-GB" },
  { id: "female_indian", name: "Priya",  gender: "female", accent: "Indian",     icon: "🎤", lang: "en-IN" },
  { id: "female_au",     name: "Emma",   gender: "female", accent: "Australian", icon: "🎤", lang: "en-AU" },
];

function loadVoiceSettings() {
  const saved = localStorage.getItem("prime-ai-voice");
  if (saved) {
    AppState.voiceSettings = { ...AppState.voiceSettings, ...JSON.parse(saved) };
  }
}

function saveVoiceSettings() {
  localStorage.setItem("prime-ai-voice", JSON.stringify(AppState.voiceSettings));
  updateTTSStatusChip();
}

function initVoiceSettingsPanel() {
  const speedSlider  = document.getElementById("tts-speed");
  const pitchSlider  = document.getElementById("tts-pitch");
  const volumeSlider = document.getElementById("tts-volume");
  const speedVal     = document.getElementById("speed-val");
  const pitchVal     = document.getElementById("pitch-val");
  const volumeVal    = document.getElementById("volume-val");
  const testBtn      = document.getElementById("test-voice-btn");
  const malBtn       = document.getElementById("gender-male-btn");
  const femBtn       = document.getElementById("gender-female-btn");

  if (!speedSlider) return;

  // Set initial values from saved settings
  const vs = AppState.voiceSettings;
  speedSlider.value  = vs.speed;
  pitchSlider.value  = vs.pitch;
  volumeSlider.value = vs.volume;
  speedVal.textContent  = `${parseFloat(vs.speed).toFixed(1)}×`;
  pitchVal.textContent  = parseFloat(vs.pitch).toFixed(1);
  volumeVal.textContent = `${Math.round(vs.volume * 100)}%`;

  // Sync gender buttons
  updateGenderBtns(vs.gender);

  // Render voice cards for current gender
  renderVoiceCards(vs.gender);

  // ── Gender toggle ──
  malBtn?.addEventListener("click", () => {
    AppState.voiceSettings.gender = "male";
    updateGenderBtns("male");
    renderVoiceCards("male");
    saveVoiceSettings();
  });
  femBtn?.addEventListener("click", () => {
    AppState.voiceSettings.gender = "female";
    updateGenderBtns("female");
    renderVoiceCards("female");
    saveVoiceSettings();
  });

  // ── Speed slider ──
  speedSlider.addEventListener("input", () => {
    const val = parseFloat(speedSlider.value);
    AppState.voiceSettings.speed = val;
    speedVal.textContent = `${val.toFixed(1)}×`;
    saveVoiceSettings();
  });

  // ── Pitch slider ──
  pitchSlider.addEventListener("input", () => {
    const val = parseFloat(pitchSlider.value);
    AppState.voiceSettings.pitch = val;
    pitchVal.textContent = val.toFixed(1);
    saveVoiceSettings();
  });

  // ── Volume slider ──
  volumeSlider.addEventListener("input", () => {
    const val = parseFloat(volumeSlider.value);
    AppState.voiceSettings.volume = val;
    volumeVal.textContent = `${Math.round(val * 100)}%`;
    saveVoiceSettings();
  });

  // ── Test voice button ──
  testBtn?.addEventListener("click", () => {
    const preset = VOICE_PRESETS.find(p => p.id === AppState.voiceSettings.selectedPreset)
      || VOICE_PRESETS.find(p => p.gender === AppState.voiceSettings.gender)
      || VOICE_PRESETS[0];
    const testText = `Hello! I am ${preset.name}, your Prime AI assistant. My speed is ${parseFloat(AppState.voiceSettings.speed).toFixed(1)} times normal.`;
    // Temporarily enable TTS for test even if disabled
    const prev = AppState.settings.ttsEnabled;
    AppState.settings.ttsEnabled = true;
    speakText(testText);
    AppState.settings.ttsEnabled = prev;
    showNotification(`Testing voice: ${preset.name} (${preset.accent})`, "info");
  });
}

function updateGenderBtns(gender) {
  document.getElementById("gender-male-btn")?.classList.toggle("active", gender === "male");
  document.getElementById("gender-female-btn")?.classList.toggle("active", gender === "female");
}

function renderVoiceCards(gender) {
  const container = document.getElementById("voice-variants");
  if (!container) return;

  const filtered = VOICE_PRESETS.filter(p => p.gender === gender);
  // Find the best matching voice from browser's speech synthesis voices
  const availableVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];

  container.innerHTML = filtered.map(preset => {
    const isActive = AppState.voiceSettings.selectedPreset === preset.id ||
      (!AppState.voiceSettings.selectedPreset && preset.accent === "American" && preset.gender === gender);

    // Find matching browser voice
    const matched = availableVoices.find(v =>
      v.lang.startsWith(preset.lang.slice(0, 2)) &&
      v.lang === preset.lang
    ) || availableVoices.find(v => v.lang.startsWith("en"));

    return `
      <div class="voice-card ${isActive ? "active" : ""}" data-preset-id="${preset.id}" data-lang="${preset.lang}" data-voice-uri="${matched ? matched.voiceURI : ""}">
        <div class="voice-card-avatar">${preset.icon}</div>
        <div class="voice-card-info">
          <div class="voice-card-name">${preset.name}</div>
          <div class="voice-card-accent">${preset.accent}</div>
        </div>
      </div>
    `;
  }).join("");

  // Attach click handlers
  container.querySelectorAll(".voice-card").forEach(card => {
    card.addEventListener("click", () => {
      container.querySelectorAll(".voice-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      const presetId  = card.dataset.presetId;
      const voiceUri  = card.dataset.voiceUri;
      const lang      = card.dataset.lang;
      AppState.voiceSettings.selectedPreset  = presetId;
      AppState.voiceSettings.selectedVoiceURI = voiceUri || null;
      AppState.voiceSettings.lang = lang;
      saveVoiceSettings();
      showNotification(`Voice changed to ${VOICE_PRESETS.find(p=>p.id===presetId)?.name}`, "success");
    });
  });
}

function initSettingsTabs() {
  const tabs  = document.querySelectorAll(".settings-tab");
  const panels = document.querySelectorAll(".settings-tab-panel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const panelId = `tab-${tab.dataset.tab}`;
      document.getElementById(panelId)?.classList.add("active");

      // Load voice cards when switching to voice tab (voices may now be available)
      if (tab.dataset.tab === "voice") {
        renderVoiceCards(AppState.voiceSettings.gender);
      }
    });
  });
}

function initTTSStatusChip() {
  const chip = document.getElementById("tts-status-chip");
  chip?.addEventListener("click", () => {
    // Toggle TTS
    AppState.settings.ttsEnabled = !AppState.settings.ttsEnabled;
    chip.style.opacity = AppState.settings.ttsEnabled ? "1" : "0.4";
    showNotification(
      AppState.settings.ttsEnabled ? "TTS enabled" : "TTS muted",
      AppState.settings.ttsEnabled ? "success" : "info"
    );
    localStorage.setItem("prime-ai-settings", JSON.stringify(AppState.settings));
    updateTTSStatusChip();
  });
}

function updateTTSStatusChip() {
  const vs = AppState.voiceSettings;
  const preset = VOICE_PRESETS.find(p => p.id === vs.selectedPreset)
    || VOICE_PRESETS.find(p => p.gender === vs.gender)
    || VOICE_PRESETS[0];
  const nameEl = document.getElementById("tts-voice-name");
  if (nameEl) nameEl.textContent = `${preset.name} · ${parseFloat(vs.speed).toFixed(1)}×`;
}


// ═══════════════════════════════════════════════════════════════
// 2. SYSTEM HEALTH MONITOR
// ═══════════════════════════════════════════════════════════════

function initSystemHealthPanel() {
  const toggleBtn  = document.getElementById("health-toggle-btn");
  const closeBtn   = document.getElementById("health-close-btn");
  const refreshBtn = document.getElementById("health-refresh-btn");
  const panel      = document.getElementById("health-panel");

  toggleBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("active");
    if (panel.classList.contains("active")) {
      fetchSystemHealth();
      startHealthPolling();
    } else {
      stopHealthPolling();
    }
  });

  closeBtn?.addEventListener("click", () => {
    panel.classList.remove("active");
    stopHealthPolling();
  });

  refreshBtn?.addEventListener("click", () => {
    refreshBtn.style.animation = "none";
    refreshBtn.offsetHeight; // reflow
    refreshBtn.style.animation = "spin 0.6s linear";
    fetchSystemHealth();
    setTimeout(() => { refreshBtn.style.animation = ""; }, 600);
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (panel.classList.contains("active") &&
        !panel.contains(e.target) &&
        !toggleBtn.contains(e.target)) {
      panel.classList.remove("active");
      stopHealthPolling();
    }
  });
}

function startHealthPolling() {
  stopHealthPolling();
  AppState._healthPollId = setInterval(fetchSystemHealth, 10000);
}

function stopHealthPolling() {
  if (AppState._healthPollId) {
    clearInterval(AppState._healthPollId);
    AppState._healthPollId = null;
  }
}

async function fetchSystemHealth() {
  try {
    const res  = await fetch(`${CONFIG.API_BASE_URL.replace("/api", "")}/api/system/health`);
    const data = await res.json();
    renderSystemHealth(data);
    document.getElementById("health-last-updated").textContent =
      "Updated " + new Date().toLocaleTimeString("en-US", {hour: "2-digit", minute: "2-digit", second: "2-digit"});
  } catch (err) {
    document.getElementById("health-last-updated").textContent = "Backend offline";
    renderOfflineHealth();
  }
}

function renderSystemHealth(data) {
  // CPU
  updateHealthCard("cpu", data.cpu?.percent, data.cpu?.status,
    `${data.cpu?.percent?.toFixed(0)}%`, `${data.cpu?.count} cores · ${data.cpu?.freq_mhz ?? "—"} MHz`);

  // RAM
  updateHealthCard("ram", data.ram?.percent, data.ram?.status,
    `${data.ram?.percent?.toFixed(0)}%`, `${data.ram?.used_gb} / ${data.ram?.total_gb} GB`);

  // Disk
  updateHealthCard("disk", data.disk?.percent, data.disk?.status,
    `${data.disk?.percent?.toFixed(0)}%`, `${data.disk?.used_gb} / ${data.disk?.total_gb} GB`);

  // Network
  const netCard = document.getElementById("net-card");
  if (netCard && data.network) {
    document.getElementById("net-value").textContent = "Active";
    document.getElementById("net-sub").textContent =
      `↑ ${data.network.sent_mb} MB  ↓ ${data.network.recv_mb} MB`;
  }

  // Top Processes
  const list = document.getElementById("health-processes-list");
  if (list && data.processes?.length > 0) {
    list.innerHTML = data.processes.map(p => `
      <div class="health-process-item">
        <span class="hp-name">${p.name}</span>
        <span class="hp-cpu">${p.cpu}% CPU</span>
        <span class="hp-mem">${p.memory?.toFixed(1)}% MEM</span>
      </div>
    `).join("");
  }

  // Update health dot in nav
  const worst = [data.cpu?.status, data.ram?.status, data.disk?.status]
    .reduce((acc, s) => {
      if (s === "critical" || acc === "critical") return "critical";
      if (s === "warning"  || acc === "warning")  return "warning";
      return "good";
    }, "good");
  const dot = document.getElementById("health-dot");
  dot?.setAttribute("class", `health-dot ${worst === "good" ? "" : worst}`);
}

function updateHealthCard(type, percent, status, valueText, subText) {
  const card    = document.getElementById(`${type}-card`);
  const valEl   = document.getElementById(`${type}-value`);
  const barEl   = document.getElementById(`${type}-bar`);
  const subEl   = document.getElementById(`${type}-sub`);
  if (!card) return;

  card.className = `health-stat-card ${status || ""}`;
  if (valEl)  valEl.textContent  = valueText || "—";
  if (subEl)  subEl.textContent  = subText   || "";
  if (barEl) {
    barEl.style.width = `${Math.min(percent || 0, 100)}%`;
    barEl.className = `health-bar-fill ${status === "good" ? "" : status || ""}`;
  }
}

function renderOfflineHealth() {
  ["cpu", "ram", "disk"].forEach(type => updateHealthCard(type, 0, "", "—", "Backend offline"));
}


// ═══════════════════════════════════════════════════════════════
// 3. FOCUS / STUDY MODE  (Pomodoro Timer)
// ═══════════════════════════════════════════════════════════════

const POMO_FOCUS_SECS  = 25 * 60;
const POMO_BREAK_SECS  = 5  * 60;
const RING_CIRCUMFERENCE = 2 * Math.PI * 88; // r=88 → ≈553px

function initFocusMode() {
  const focusBtn   = document.getElementById("focus-mode-btn");
  const overlay    = document.getElementById("focus-overlay");
  const closeBtn   = document.getElementById("focus-close-btn");
  const startBtn   = document.getElementById("pomo-start-btn");
  const resetBtn   = document.getElementById("pomo-reset-btn");
  const skipBtn    = document.getElementById("pomo-skip-btn");

  focusBtn?.addEventListener("click", () => {
    overlay.classList.toggle("active");
    focusBtn.classList.toggle("active");
    if (overlay.classList.contains("active")) updatePomodoroUI();
  });

  closeBtn?.addEventListener("click", () => {
    overlay.classList.remove("active");
    document.getElementById("focus-mode-btn").classList.remove("active");
  });

  startBtn?.addEventListener("click", togglePomodoro);
  resetBtn?.addEventListener("click", resetPomodoro);
  skipBtn?.addEventListener("click",  skipPhase);

  // Init ring gradient via SVG defs
  const svg = document.querySelector(".pomodoro-ring");
  if (svg) {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
      <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="#1e3a8a"/>
        <stop offset="100%" stop-color="#60a5fa"/>
      </linearGradient>`;
    svg.prepend(defs);
  }

  updatePomodoroUI();
}

function togglePomodoro() {
  const p = AppState.pomodoro;
  if (p.running) {
    clearInterval(p._intervalId);
    p.running = false;
    document.getElementById("pomo-play-icon").className = "fas fa-play";
  } else {
    p.running = true;
    document.getElementById("pomo-play-icon").className = "fas fa-pause";
    p._intervalId = setInterval(tickPomodoro, 1000);
  }
}

function tickPomodoro() {
  const p = AppState.pomodoro;
  p.timeLeft--;

  if (p.timeLeft <= 0) {
    // Phase complete
    clearInterval(p._intervalId);
    p.running = false;
    document.getElementById("pomo-play-icon").className = "fas fa-play";

    if (p.phase === "focus") {
      p.completedSessions++;
      p.totalFocusMinutes += 25;
      showNotification("🎉 Focus session complete! Take a break.", "success");
      speakText("Focus session complete. Time for a break!");
      switchPhase("break");
    } else {
      showNotification("⚡ Break over! Ready to focus?", "info");
      speakText("Break is over. Let's get back to work!");
      switchPhase("focus");
    }
  }

  updatePomodoroUI();
}

function switchPhase(phase) {
  const p = AppState.pomodoro;
  p.phase    = phase;
  p.timeLeft = phase === "focus" ? POMO_FOCUS_SECS : POMO_BREAK_SECS;
  p.totalFocus = p.timeLeft;
  updatePomodoroUI();
  updateSessionDots();
}

function resetPomodoro() {
  const p = AppState.pomodoro;
  clearInterval(p._intervalId);
  p.running  = false;
  p.phase    = "focus";
  p.timeLeft = POMO_FOCUS_SECS;
  p.totalFocus = POMO_FOCUS_SECS;
  document.getElementById("pomo-play-icon").className = "fas fa-play";
  updatePomodoroUI();
}

function skipPhase() {
  const p = AppState.pomodoro;
  clearInterval(p._intervalId);
  p.running = false;
  document.getElementById("pomo-play-icon").className = "fas fa-play";
  switchPhase(p.phase === "focus" ? "break" : "focus");
}

function updatePomodoroUI() {
  const p = AppState.pomodoro;
  const mins = Math.floor(p.timeLeft / 60);
  const secs = p.timeLeft % 60;
  const timeStr = `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;

  const timeEl  = document.getElementById("pomodoro-time");
  const phaseEl = document.getElementById("pomodoro-phase");
  const ringEl  = document.getElementById("ring-progress");

  if (timeEl)  timeEl.textContent  = timeStr;
  if (phaseEl) phaseEl.textContent = p.phase === "focus" ? "Focus" : "Break";

  if (ringEl) {
    const progress   = p.timeLeft / p.totalFocus;
    const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
    ringEl.style.strokeDashoffset = dashOffset;
    ringEl.style.stroke = p.phase === "focus" ? "url(#ringGradient)" : "#10b981";
  }

  // Stats
  const fcEl = document.getElementById("focus-completed");
  const ftEl = document.getElementById("focus-total-min");
  const fsEl = document.getElementById("focus-streak");
  if (fcEl) fcEl.textContent = p.completedSessions;
  if (ftEl) ftEl.textContent = p.totalFocusMinutes;
  if (fsEl) fsEl.textContent = p.streak;
}

function updateSessionDots() {
  const p = AppState.pomodoro;
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById(`sess-${i}`);
    if (!dot) continue;
    if (i <= p.completedSessions % 4) {
      dot.classList.remove("active");
      dot.classList.add("done");
    } else if (i === (p.completedSessions % 4) + 1) {
      dot.classList.add("active");
      dot.classList.remove("done");
    } else {
      dot.classList.remove("active", "done");
    }
  }
}


// ═══════════════════════════════════════════════════════════════
// 4. WEEKLY SUMMARY
// ═══════════════════════════════════════════════════════════════

function initWeeklySummary() {
  const btn = document.getElementById("weekly-summary-btn");
  btn?.addEventListener("click", openWeeklySummary);

  // Close modal
  const modal = document.getElementById("weekly-modal");
  modal?.querySelectorAll(".close-modal").forEach(b => {
    b.addEventListener("click", () => modal.classList.remove("active"));
  });
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("active");
  });
}

async function openWeeklySummary() {
  const modal = document.getElementById("weekly-modal");
  modal?.classList.add("active");

  try {
    const res  = await fetch(`${CONFIG.API_BASE_URL.replace("/api", "")}/api/stats/weekly`);
    const data = await res.json();
    renderWeeklySummary(data);
  } catch (err) {
    // Use local data when backend isn't running
    renderWeeklySummary({
      messages_sent: AppState.chatHistory.filter(m => m.sender === "user").length,
      code_generated: AppState.chatHistory.filter(m => m.text?.includes("```")).length,
      files_managed: 0,
      total_focus_minutes: AppState.pomodoro.totalFocusMinutes,
      daily_activity: [2, 5, 3, 8, 6, 4, AppState.chatHistory.length],
      top_topics: ["Chat", "Study", "Code"],
    });
  }
}

function renderWeeklySummary(data) {
  document.getElementById("ws-messages").textContent = data.messages_sent ?? "—";
  document.getElementById("ws-code").textContent     = data.code_generated ?? "—";
  document.getElementById("ws-files").textContent    = data.files_managed  ?? "—";
  document.getElementById("ws-focus").textContent    = data.total_focus_minutes ?? AppState.pomodoro.totalFocusMinutes;

  // Bar chart
  const chart  = document.getElementById("weekly-chart");
  const days   = data.daily_activity || [0,0,0,0,0,0,0];
  const maxVal = Math.max(...days, 1);
  const today  = new Date().getDay(); // 0=Sun
  if (chart) {
    chart.innerHTML = days.map((v, i) => {
      const h = Math.round((v / maxVal) * 72) + 4;
      return `<div class="weekly-bar ${i === today ? "today" : ""}" style="height:${h}px" title="${v} messages"></div>`;
    }).join("");
  }

  // Topics
  const topicsEl = document.getElementById("weekly-topics");
  if (topicsEl && data.top_topics) {
    topicsEl.innerHTML = data.top_topics.map(t =>
      `<div class="topic-tag">${t}</div>`
    ).join("");
  }
}


// ═══════════════════════════════════════════════════════════════
// 5. PROACTIVE SUGGESTIONS  (time-aware greeting & tips)
// ═══════════════════════════════════════════════════════════════

function initProactiveSuggestions() {
  const msgEl = document.getElementById("proactive-msg");
  if (!msgEl) return;

  const hour = new Date().getHours();
  let greeting = "Ready to help.";

  if (hour < 6)        greeting = "Working late? I've got you covered. 🌙";
  else if (hour < 12)  greeting = "Good morning! Let's have a productive day. ☀️";
  else if (hour < 17)  greeting = "Good afternoon! What are we tackling today? 💪";
  else if (hour < 21)  greeting = "Good evening! Need help wrapping up? 🌆";
  else                 greeting = "Good night! Studying late? I'll help. 📖";

  msgEl.textContent = greeting;
}


// ═══════════════════════════════════════════════════════════════
// 6. WAKE WORD VISUAL INDICATOR  (cosmetic — real detection via WhisperFlow)
// ═══════════════════════════════════════════════════════════════

function setWakeWordActive(active) {
  const badge = document.getElementById("wake-word-badge");
  badge?.classList.toggle("active", active);
}

// Hook into voice button as a proxy (until WhisperFlow wake word is live)
document.addEventListener("DOMContentLoaded", () => {
  const voiceBtn = document.getElementById("voice-btn");
  voiceBtn?.addEventListener("click", () => {
    const isActive = voiceBtn.classList.contains("active");
    setWakeWordActive(!isActive);
  });
});


// ═══════════════════════════════════════════════════════════════
// UPDATE EXPORT
// ═══════════════════════════════════════════════════════════════

window.PrimeAI = {
  AppState,
  addMessage,
  toggleTheme,
  createNewChat,
  speakText,
  // New APIs
  fetchSystemHealth,
  togglePomodoro,
  resetPomodoro,
  openWeeklySummary,
  setWakeWordActive,
  VOICE_PRESETS,
};

console.log("Prime AI v3.0 ready! Access via window.PrimeAI");
