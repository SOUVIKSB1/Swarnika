// Swarnika Interactive Chatbot
// Dynamic API based on environment
const CHAT_API = (function() {
  const host = window.location.hostname;
  if (host === 'localhost' || host.startsWith('127.')) {
    return `${location.protocol}//${host}:5001/api`;
  }
  return window.API || '/api';
})();
const BOT_NAME = "Swarnika ChatBot";
let recognition;
let isListening = false;
let isMuted = true; // ✅ Muted by default so users are not startled

// ----------------------------
// Strip HTML helper for clean TTS
// ----------------------------
function stripHtmlTags(html) {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

// ----------------------------
// Voice Output (Female Tone)
// ----------------------------
function speak(text) {
  if (isMuted) return;
  const cleanText = stripHtmlTags(text);
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'en-IN';
  utterance.pitch = 1.1;
  utterance.rate = 1;

  let voices = speechSynthesis.getVoices();
  const setVoice = () => {
    voices = speechSynthesis.getVoices();
    const femaleVoice = voices.find(v =>
      v.name.toLowerCase().includes('female') ||
      (v.lang.includes('en') && v.name.toLowerCase().includes('google')) ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('zira')
    );
    if (femaleVoice) utterance.voice = femaleVoice;
    speechSynthesis.speak(utterance);
  };

  if (!voices.length) {
    speechSynthesis.onvoiceschanged = setVoice;
  } else {
    setVoice();
  }
}

// ----------------------------
// Helper Functions
// ----------------------------
function parseIntent(text) {
  const t = text.toLowerCase();
  const categories = ['ring', 'earrings', 'necklace', 'pendant', 'bracelet', 'bangle', 'anklet'];
  const metals = ['gold', 'silver', 'platinum', 'rose gold'];
  return {
    category: categories.find(c => t.includes(c)),
    metal: metals.find(m => t.includes(m))
  };
}

function renderMessage(container, text, who = 'bot') {
  const div = document.createElement('div');
  div.className = `msg ${who}`;
  div.innerHTML = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  if (who === 'bot') speak(text);
}

function renderGuidance(container, messages, quickReplies = []) {
  messages.forEach(msg => renderMessage(container, msg, 'bot'));
  if (quickReplies.length) {
    const qrDiv = document.createElement('div');
    qrDiv.className = 'quick-replies';
    quickReplies.forEach(({ label, query }) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.dataset.q = query;
      qrDiv.appendChild(btn);
    });
    container.appendChild(qrDiv);
    handleQuickClicks(container);
  }
  container.scrollTop = container.scrollHeight;
}

// ----------------------------
// Voice Input (Recognition)
// ----------------------------
function startVoiceRecognition(submitQuery) {
  if (!('webkitSpeechRecognition' in window)) {
    alert('Speech recognition not supported on this browser.');
    return;
  }

  recognition = new webkitSpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    speak("I'm listening...");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const body = document.querySelector('#chatbot-body');
    renderMessage(body, transcript, 'user');
    submitQuery(transcript);
  };

  recognition.onerror = () => speak("Sorry, I didn't catch that. Please try again.");
  recognition.onend = () => { isListening = false; };
  recognition.start();
}

// ----------------------------
// Chatbot Core UI + Logic
// ----------------------------
function chatRenderIntro(container) {
  const intro = document.createElement('div');
  intro.className = 'msg bot';
  intro.innerHTML = `
    <p>Welcome to <strong>Swarnika Jewels</strong> 💎<br>
    I am your personal jewelry assistant. Let’s discover something exquisite together.</p>
    <div class="quick-replies">
      <button data-q="gold ring">Gold Rings</button>
      <button data-q="silver earrings">Silver Earrings</button>
      <button data-q="pendant">Pendants</button>
      <button data-q="bracelet">Bracelets</button>
      <button data-q="talk">🎤 Talk to Me</button>
    </div>`;
  container.appendChild(intro);
  speak("Welcome to Swarnika Jewels. I am your personal jewelry assistant. Let's discover something exquisite together.");
  handleQuickClicks(container);
}

// ----------------------------
// Homepage suggestion popups database
// ----------------------------
const HOME_POPUP_SUGGESTIONS = [
  "👋 Looking for certified 22K Gold Ornaments? Tap here to search!",
  "✨ Need help finding the perfect Gift for a special occasion? Tap here!",
  "💍 Explore customized silver bands & bridal necklaces. Tap to ask!",
  "🔥 Limited time: Flat 10% off on Gold Jewellery. Tap to discover!"
];

function handleQuickClicks(container) {
  container.querySelectorAll('.quick-replies button').forEach(b => {
    b.addEventListener('click', () => {
      const q = b.dataset.q;
      if (q === 'talk') startVoiceRecognition(submitQuery);
      else submitQuery(q);
    });
  });
}

// ----------------------------
// Conversation Logic
// ----------------------------
async function submitQuery(text) {
  const body = document.querySelector('#chatbot-body');
  renderMessage(body, text, 'user');

  const intent = parseIntent(text);
  const lower = text.toLowerCase();

  if (intent.category || intent.metal) {
    renderGuidance(body, [
      `💎 A fine choice! ${intent.metal ? intent.metal.charAt(0).toUpperCase() + intent.metal.slice(1) : ''} ${intent.category || 'jewelry'} are among our most exquisite designs.`,
      `✨ Would you like to explore them on our homepage or hear about our special offers first?`
    ], [
      { label: '🏠 Homepage', query: 'go home' },
      { label: '💰 Offers', query: 'show offers' },
      { label: '⏳ Later', query: 'end chat' }
    ]);
    return;
  }

  if (lower.includes('hi') || lower.includes('hello')) {
    renderGuidance(body, [
      `👋 Hello there! Welcome back to Swarnika Jewels.`,
      `Would you like to explore our timeless pieces or see what’s trending this week?`
    ], [
      { label: '✨ Trending', query: 'go home' },
      { label: '💎 Offers', query: 'show offers' },
      { label: '🙏 Not now', query: 'end chat' }
    ]);
    return;
  }

  if (lower === 'show offers') {
    renderGuidance(body, [
      `💰 Current Offers:`,
      `• 10% off all gold jewelry 💛<br>• 5% extra off for new members 🆕<br>• Free delivery on orders above ₹5,000 🚚`,
      `Would you like to shop now?`
    ], [
      { label: '🛍️ Yes', query: 'go home' },
      { label: '⏳ Maybe later', query: 'end chat' }
    ]);
    return;
  }

  if (lower === 'go home' || lower.includes('take me')) {
    renderGuidance(body, [
      `🌟 Wonderful! Taking you to the home of brilliance...`
    ]);
    setTimeout(() => window.location.href = 'index.html', 1800);
    return;
  }

  if (lower === 'end chat' || lower.includes('later')) {
    renderGuidance(body, [
      `✨ No worries! I’ll be here whenever you’re ready to explore more elegance.`
    ]);
    return;
  }

  renderGuidance(body, [
    `I can guide you to our homepage where you’ll find stunning gold, silver, and platinum jewelry.`,
    `Would you like to go there now or hear about offers first?`
  ], [
    { label: '🏠 Homepage', query: 'go home' },
    { label: '💰 Offers', query: 'show offers' },
    { label: '⏳ Later', query: 'end chat' }
  ]);
}

// ----------------------------
// Chatbot Initialization
// ----------------------------
function mountChatbot() {
  if (document.getElementById('chatbot-toggle')) return;

  // Toggle button
  const toggle = document.createElement('button');
  toggle.id = 'chatbot-toggle';
  toggle.className = 'btn btn-primary';
  toggle.innerHTML = '💬';
  document.body.appendChild(toggle);

  // Home page dynamic popup bubble
  const bubble = document.createElement('div');
  bubble.id = 'chatbot-bubble';
  bubble.style.display = 'none';
  bubble.innerHTML = `
    <span id="chatbot-bubble-close">&times;</span>
    <div id="chatbot-bubble-text">👋 Welcome to Swarnika! Looking for premium gold designs? Tap here.</div>
  `;
  document.body.appendChild(bubble);

  // Chat panel
  const panel = document.createElement('div');
  panel.id = 'chatbot-panel';
  panel.innerHTML = `
    <div id="chatbot-header">
      <strong>Swarnika Assistant 💎</strong>
      <div class="btn-group">
        <button id="mute-btn">🔇</button>
        <button id="chatbot-close">✕</button>
      </div>
    </div>
    <div id="chatbot-body"></div>
    <div id="chatbot-input">
      <input type="text" id="chatbot-text" class="form-control" placeholder="Ask me about gold rings...">
      <button class="btn btn-secondary" id="chatbot-voice">🎤</button>
      <button class="btn btn-primary" id="chatbot-send">Send</button>
    </div>`;
  document.body.appendChild(panel);

  const body = panel.querySelector('#chatbot-body');
  const muteBtn = document.getElementById('mute-btn');

  // Load mute state from localStorage if available
  const storedMute = localStorage.getItem('chatMuted');
  if (storedMute !== null) {
    isMuted = storedMute === '1';
    muteBtn.textContent = isMuted ? '🔇' : '🔔';
  } else {
    // Default to muted
    isMuted = true;
    muteBtn.textContent = '🔇';
  }

  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? '🔇' : '🔔';
    localStorage.setItem('chatMuted', isMuted ? '1' : '0');
    if (!isMuted) speak('Voice enabled.');
  });

  panel.querySelector('#chatbot-send').addEventListener('click', () => {
    const input = panel.querySelector('#chatbot-text');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    submitQuery(text);
  });

  panel.querySelector('#chatbot-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') panel.querySelector('#chatbot-send').click();
  });

  panel.querySelector('#chatbot-voice').addEventListener('click', () => startVoiceRecognition(submitQuery));

  const openChat = () => {
    panel.classList.add('open');
    bubble.style.display = 'none'; // hide bubble when chat opens
    const body = panel.querySelector('#chatbot-body');
    if (!body.dataset.welcomed) {
      chatRenderIntro(body);
      body.dataset.welcomed = true;
    }
  };

  toggle.addEventListener('click', () => {
    if (panel.classList.contains('open')) {
      panel.classList.remove('open');
    } else {
      openChat();
    }
  });

  bubble.addEventListener('click', (e) => {
    if (e.target.id === 'chatbot-bubble-close') {
      e.stopPropagation();
      bubble.style.display = 'none';
      localStorage.setItem('chatBubbleClosed', '1');
    } else {
      openChat();
    }
  });

  panel.querySelector('#chatbot-close').addEventListener('click', () => panel.classList.remove('open'));

  // Trigger bubble popup on homepage sometimes (5 seconds after landing)
  const isHomepage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');
  const wasBubbleClosed = localStorage.getItem('chatBubbleClosed') === '1';

  if (isHomepage && !wasBubbleClosed) {
    setTimeout(() => {
      if (!panel.classList.contains('open')) {
        const randIdx = Math.floor(Math.random() * HOME_POPUP_SUGGESTIONS.length);
        document.getElementById('chatbot-bubble-text').textContent = HOME_POPUP_SUGGESTIONS[randIdx];
        bubble.style.display = 'block';
      }
    }, 5000);
  }
}

// Auto Mount
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', mountChatbot)
  : mountChatbot();
