// Sample book text - Harry Potter and the Sorcerer's Stone (first chapter excerpt)
const bookTextRaw = [
    "While Mrs. Dursley was in the bathroom, Mr. Dursley crept to the bedroom window and peered down into the front garden.",
    "The cat was still there. It was staring down Privet Drive as though it were waiting for something.",
    "Was he imagining things? Could all this have something to do with the Potters?",
    "He didn't think he could bear it if anyone found out about the Potters.",
    "Mrs. Dursley came back into the bedroom and he had to pretend to be asleep.",
    "The next morning, Mr. Dursley woke to a bright, clear Tuesday.",
    "There was not a cloud in the sky, and the sun shone brightly on the neat front gardens of Privet Drive.",
    "Mr. Dursley hummed as he picked out his most boring tie for work.",
    "At half past eight, Mr. Dursley picked up his briefcase, pecked Mrs. Dursley on the cheek, and tried to kiss Dudley goodbye.",
    "He missed, because Dudley was now having a tantrum and throwing his cereal at the walls.",
    "Little tyke, chortled Mr. Dursley as he left the house.",
    "He got into his car and backed out of number four's drive.",
    "It was on the corner of the street that he noticed the first sign of something peculiar.",
    "A cat reading a map. For a second, Mr. Dursley didn't realize what he had seen.",
    "Then he jerked his head around to look again.",
    "There was a tabby cat standing on the corner of Privet Drive, but there wasn't a map in sight.",
    "What could he have been thinking of? It must have been a trick of the light.",
    "Mr. Dursley blinked and stared at the cat. It stared back.",
    "As Mr. Dursley drove around the corner and up the road, he watched the cat in his mirror.",
    "It was now reading the sign that said Privet Drive—no, looking at the sign.",
];

// Normalize text to use standard keyboard characters
function normalizeText(text) {
    return text
        // Em dash and en dash → regular hyphen
        .replace(/—/g, '-')
        .replace(/–/g, '-')
        // Smart quotes → regular quotes
        .replace(/"/g, '"')
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        .replace(/'/g, "'")
        // Ellipsis → three periods
        .replace(/…/g, '...');
}

// Normalize all book text on load
const bookText = bookTextRaw.map(sentence => normalizeText(sentence));

// App State
let state = {
    currentSentenceIndex: 0,
    currentCharIndex: 0,
    totalWordsTyped: 0,
    correctChars: 0,
    totalChars: 0,
    startTime: null,
    wpm: 0,
    accuracy: 100,
    fontSize: 24,
    isTyping: false,
    typingTimeout: null,

    // Rolling history for smooth stats
    sentenceHistory: [], // Array of {wpm, correctChars, totalChars, duration} for last 25 sentences
    currentSentenceStartTime: null,
    currentSentenceCorrectChars: 0,
    currentSentenceTotalChars: 0,
};

// Caret element
let caretEl = null;

// DOM Elements
const passageEl = document.getElementById('passage');
const wpmEl = document.getElementById('wpm');
const accuracyEl = document.getElementById('accuracy');
const totalWordsEl = document.getElementById('totalWords');
const hiddenInput = document.getElementById('hiddenInput');
const menuBtn = document.getElementById('menuBtn');
const settingsBtn = document.getElementById('settingsBtn');
const menuModal = document.getElementById('menuModal');
const settingsModal = document.getElementById('settingsModal');
const closeMenuBtn = document.getElementById('closeMenu');
const closeSettingsBtn = document.getElementById('closeSettings');
const resetProgressBtn = document.getElementById('resetProgress');
const fontSizeSlider = document.getElementById('fontSize');
const fontSizeValue = document.getElementById('fontSizeValue');
const startHint = document.getElementById('startHint');

// Initialize
function init() {
    loadProgress();
    loadSettings();
    displayCurrentSentence();
    setupEventListeners();

    // Focus input after a short delay to ensure DOM is ready
    setTimeout(() => {
        focusInput();
        console.log('App initialized, input focused, caret visible');
    }, 100);

    // Additional focus attempt after animation completes
    setTimeout(() => {
        focusInput();
    }, 700);
}

// Load progress from localStorage
function loadProgress() {
    const saved = localStorage.getItem('retypeProgress');
    if (saved) {
        const progress = JSON.parse(saved);
        state.currentSentenceIndex = progress.currentSentenceIndex || 0;
        state.totalWordsTyped = progress.totalWordsTyped || 0;
        state.sentenceHistory = progress.sentenceHistory || [];

        // Ensure we don't load more than 25 sentences
        if (state.sentenceHistory.length > 25) {
            state.sentenceHistory = state.sentenceHistory.slice(-25);
        }
    }
}

// Save progress to localStorage
function saveProgress() {
    localStorage.setItem('retypeProgress', JSON.stringify({
        currentSentenceIndex: state.currentSentenceIndex,
        totalWordsTyped: state.totalWordsTyped,
        sentenceHistory: state.sentenceHistory,
    }));
}

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem('retypeSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        state.fontSize = settings.fontSize || 24;
        fontSizeSlider.value = state.fontSize;
        fontSizeValue.textContent = state.fontSize + 'px';
        passageEl.style.fontSize = state.fontSize + 'px';
    }
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('retypeSettings', JSON.stringify({
        fontSize: state.fontSize,
    }));
}

// Display current sentence
function displayCurrentSentence() {
    const sentence = bookText[state.currentSentenceIndex];
    passageEl.innerHTML = '';

    // Create character spans
    for (let i = 0; i < sentence.length; i++) {
        const span = document.createElement('span');
        const char = sentence[i];

        // Add base class
        span.className = 'char';

        // Add space class for space characters
        if (char === ' ') {
            span.classList.add('space');
        }

        span.textContent = char;
        span.dataset.index = i;
        passageEl.appendChild(span);
    }

    // Create caret element
    if (caretEl) {
        caretEl.remove();
    }
    caretEl = document.createElement('div');
    caretEl.className = 'caret always-visible';
    caretEl.style.display = 'block';
    caretEl.style.visibility = 'visible';
    passageEl.appendChild(caretEl);

    // Reset state for new sentence
    state.currentCharIndex = 0;
    state.currentSentenceStartTime = null;
    state.currentSentenceCorrectChars = 0;
    state.currentSentenceTotalChars = 0;

    // Position caret at first character after DOM updates
    requestAnimationFrame(() => {
        updateCaret();
    });
}

// Update caret position with smooth animation
function updateCaret() {
    if (!caretEl) return;

    const chars = passageEl.querySelectorAll('.char');

    // Remove current class from all chars (don't highlight any character)
    chars.forEach(char => char.classList.remove('current'));

    if (state.currentCharIndex < chars.length) {
        const currentChar = chars[state.currentCharIndex];

        // DO NOT add 'current' class - we don't want to highlight the character
        // The caret position is enough to show where the user should type
        // Only typed characters should be white, untyped should stay gray

        // Get position of current character
        const charRect = currentChar.getBoundingClientRect();
        const passageRect = passageEl.getBoundingClientRect();

        // Calculate relative position
        const leftOffset = charRect.left - passageRect.left;
        const topOffset = charRect.top - passageRect.top;
        const height = charRect.height;

        // Update caret position and height
        caretEl.style.height = height + 'px';
        caretEl.style.transform = `translate(${leftOffset}px, ${topOffset}px)`;

        // Ensure caret is always visible
        caretEl.style.display = 'block';
        caretEl.style.visibility = 'visible';

        // Show typing state (stop blinking)
        if (state.isTyping) {
            caretEl.classList.add('typing');

            // Clear existing timeout
            if (state.typingTimeout) {
                clearTimeout(state.typingTimeout);
            }

            // Reset to blinking after 500ms of no typing
            state.typingTimeout = setTimeout(() => {
                state.isTyping = false;
                caretEl.classList.remove('typing');
            }, 500);
        }
    }
}

// Handle typing - renamed from handleInput
function handleKeyPress(typedChar) {
    const sentence = bookText[state.currentSentenceIndex];

    // Ignore null or empty input
    if (typedChar === null || typedChar === undefined) {
        return;
    }

    // Hide start hint on first keystroke
    if (startHint && !startHint.classList.contains('hidden')) {
        startHint.classList.add('hidden');
    }

    // Start timer on first keystroke of session
    if (state.startTime === null) {
        state.startTime = Date.now();
    }

    // Start timer for current sentence on first keystroke
    if (state.currentSentenceStartTime === null) {
        state.currentSentenceStartTime = Date.now();
    }

    // Set typing state
    state.isTyping = true;

    // Ignore if sentence is complete
    if (state.currentCharIndex >= sentence.length) {
        return;
    }

    const expectedChar = sentence[state.currentCharIndex];
    const charEl = passageEl.querySelector(`[data-index="${state.currentCharIndex}"]`);

    if (!charEl) {
        console.error('Character element not found at index:', state.currentCharIndex);
        return; // Safety check
    }

    // Debug logging
    console.log('Typed:', JSON.stringify(typedChar), 'Expected:', JSON.stringify(expectedChar), 'Match:', typedChar === expectedChar);

    // Track stats for current sentence
    state.currentSentenceTotalChars++;

    // Track global stats (for total words display)
    state.totalChars++;

    if (typedChar === expectedChar) {
        // Correct character
        charEl.classList.add('typed');
        charEl.classList.remove('error');

        // Track stats
        state.currentSentenceCorrectChars++;
        state.correctChars++;
        state.currentCharIndex++;

        // Check if sentence is complete
        if (state.currentCharIndex >= sentence.length) {
            handleSentenceComplete();
        } else {
            updateCaret();
        }
    } else {
        // Incorrect character - show error but keep caret in place
        charEl.classList.add('error');
        setTimeout(() => {
            charEl.classList.remove('error');
        }, 300);

        // Keep caret visible and in the same position (don't move it)
        // The caret should stay at the current character until user types correctly
        if (caretEl) {
            caretEl.style.display = 'block';
            caretEl.style.visibility = 'visible';
        }
    }

    updateStats();
}

// Handle sentence completion
function handleSentenceComplete() {
    // Count words in completed sentence (split by space and filter empty strings)
    const sentence = bookText[state.currentSentenceIndex];
    const words = sentence.split(' ').filter(w => w.trim().length > 0).length;
    state.totalWordsTyped += words;

    // Calculate stats for this sentence
    const sentenceDuration = (Date.now() - state.currentSentenceStartTime) / 1000 / 60; // in minutes
    const sentenceWPM = sentenceDuration > 0 ? (words / sentenceDuration) : 0;

    // Add sentence data to history
    const sentenceData = {
        wpm: sentenceWPM,
        correctChars: state.currentSentenceCorrectChars,
        totalChars: state.currentSentenceTotalChars,
        duration: sentenceDuration,
        words: words
    };

    state.sentenceHistory.push(sentenceData);

    // Keep only last 25 sentences for accuracy calculation
    if (state.sentenceHistory.length > 25) {
        state.sentenceHistory.shift(); // Remove oldest
    }

    console.log('Sentence complete! Words:', words, 'WPM:', Math.round(sentenceWPM), 'Total words:', state.totalWordsTyped);
    console.log('History length:', state.sentenceHistory.length);

    // Update stats one final time
    updateStats();

    // Save progress
    saveProgress();

    // Fade out current sentence
    passageEl.classList.add('fade-out');

    setTimeout(() => {
        passageEl.classList.remove('fade-out');

        // Move to next sentence
        state.currentSentenceIndex++;

        // Loop back to start if at end
        if (state.currentSentenceIndex >= bookText.length) {
            state.currentSentenceIndex = 0;
        }

        displayCurrentSentence();
        saveProgress();
    }, 400);
}

// Update stats with rolling averages
function updateStats() {
    // Calculate WPM based on rolling average of last 4 completed sentences
    if (state.sentenceHistory.length > 0) {
        // Get last 4 sentences (or fewer if we don't have 4 yet)
        const last4Sentences = state.sentenceHistory.slice(-4);

        // Calculate average WPM from these sentences
        const totalWPM = last4Sentences.reduce((sum, s) => sum + s.wpm, 0);
        const avgWPM = totalWPM / last4Sentences.length;

        // If currently typing, blend in current sentence progress
        if (state.currentSentenceStartTime && state.currentCharIndex > 0) {
            const currentDuration = (Date.now() - state.currentSentenceStartTime) / 1000 / 60;
            const currentWords = state.currentCharIndex / 5; // 5 chars = 1 word
            const currentWPM = currentDuration > 0 ? (currentWords / currentDuration) : 0;

            // Blend: 70% historical average, 30% current sentence
            state.wpm = Math.round(avgWPM * 0.7 + currentWPM * 0.3);
        } else {
            state.wpm = Math.round(avgWPM);
        }
    } else if (state.currentSentenceStartTime && state.currentCharIndex > 0) {
        // No history yet, use current sentence only
        const currentDuration = (Date.now() - state.currentSentenceStartTime) / 1000 / 60;
        const currentWords = state.currentCharIndex / 5;
        state.wpm = currentDuration > 0 ? Math.round(currentWords / currentDuration) : 0;
    } else {
        state.wpm = 0;
    }

    // Calculate accuracy based on rolling average of last 25 sentences
    if (state.sentenceHistory.length > 0) {
        // Sum up all correct and total chars from history
        const totalCorrect = state.sentenceHistory.reduce((sum, s) => sum + s.correctChars, 0);
        const totalTyped = state.sentenceHistory.reduce((sum, s) => sum + s.totalChars, 0);

        // Add current sentence progress
        const combinedCorrect = totalCorrect + state.currentSentenceCorrectChars;
        const combinedTotal = totalTyped + state.currentSentenceTotalChars;

        state.accuracy = combinedTotal > 0
            ? Math.round((combinedCorrect / combinedTotal) * 100)
            : 100;
    } else if (state.currentSentenceTotalChars > 0) {
        // No history yet, use current sentence only
        state.accuracy = Math.round((state.currentSentenceCorrectChars / state.currentSentenceTotalChars) * 100);
    } else {
        state.accuracy = 100;
    }

    // Update UI
    wpmEl.textContent = `${state.wpm} WPM`;
    accuracyEl.textContent = `Accuracy: ${state.accuracy}%`;
    totalWordsEl.textContent = `Words: ${state.totalWordsTyped}`;
}

// Focus hidden input - aggressive focus management
function focusInput() {
    if (!hiddenInput) return;

    // Clear the input to prevent any stale values
    hiddenInput.value = '';

    // Force focus
    hiddenInput.focus();

    // Ensure caret stays visible even if focus is lost
    if (caretEl) {
        caretEl.style.display = 'block';
        caretEl.style.visibility = 'visible';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Keep focus on hidden input - click anywhere to refocus
    document.addEventListener('click', (e) => {
        // Don't refocus if clicking on modal buttons or links
        if (!e.target.closest('.modal-content') && !e.target.closest('button')) {
            focusInput();
        }
    });

    // Also handle mousedown to catch focus before it's lost
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.modal-content') &&
            !e.target.closest('button') &&
            e.target !== hiddenInput) {
            // Refocus after mousedown completes
            setTimeout(() => focusInput(), 0);
        }
    });

    // Prevent input from losing focus - aggressive refocus
    hiddenInput.addEventListener('blur', (e) => {
        console.log('Input lost focus, refocusing...');
        // Always refocus unless a modal is active
        if (!document.querySelector('.modal.active')) {
            // Use multiple methods to ensure focus is regained
            setTimeout(() => focusInput(), 0);
            setTimeout(() => focusInput(), 10);
            setTimeout(() => focusInput(), 50);
        }
    });

    // Periodically check focus (safety net)
    setInterval(() => {
        if (document.activeElement !== hiddenInput && !document.querySelector('.modal.active')) {
            console.log('Focus lost, recovering...');
            focusInput();
        }
    }, 100);

    // Track last processed character to prevent duplicates
    let lastProcessedChar = null;
    let lastProcessedTime = 0;

    // Use input event ONLY - this prevents double processing
    hiddenInput.addEventListener('input', (e) => {
        // Get the input value
        const value = hiddenInput.value;

        // Clear the input immediately to prevent accumulation
        hiddenInput.value = '';

        // Process only if we have a value
        if (!value || value.length === 0) {
            return;
        }

        // Get the last character typed
        const typedChar = value[value.length - 1];

        // Prevent duplicate processing (within 50ms window)
        const now = Date.now();
        if (typedChar === lastProcessedChar && (now - lastProcessedTime) < 50) {
            console.log('Duplicate character detected, ignoring:', typedChar);
            return;
        }

        // Update tracking
        lastProcessedChar = typedChar;
        lastProcessedTime = now;

        // Process the character
        handleKeyPress(typedChar);
    });

    // Handle keydown only for special keys (prevent default behavior)
    hiddenInput.addEventListener('keydown', (e) => {
        // Prevent unwanted keys
        if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
            e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'End' ||
            e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            return;
        }
    });
    
    // Menu button
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menuModal.classList.add('active');
        hiddenInput.blur(); // Temporarily blur to allow modal interaction
    });

    // Settings button
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsModal.classList.add('active');
        hiddenInput.blur(); // Temporarily blur to allow modal interaction
    });

    // Close modals and refocus
    closeMenuBtn.addEventListener('click', () => {
        menuModal.classList.remove('active');
        setTimeout(focusInput, 100);
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('active');
        setTimeout(focusInput, 100);
    });

    // Close modal on backdrop click
    [menuModal, settingsModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                setTimeout(focusInput, 100);
            }
        });
    });
    
    // Reset progress
    resetProgressBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset your progress? This will clear all your typing history.')) {
            // Clear all localStorage data
            localStorage.removeItem('retypeProgress');
            localStorage.removeItem('retypeSettings');

            // Reset all state variables to initial values
            state.currentSentenceIndex = 0;
            state.currentCharIndex = 0;
            state.totalWordsTyped = 0;
            state.correctChars = 0;
            state.totalChars = 0;
            state.startTime = null;
            state.wpm = 0;
            state.accuracy = 100;
            state.isTyping = false;
            state.typingTimeout = null;

            // Reset rolling history
            state.sentenceHistory = [];
            state.currentSentenceStartTime = null;
            state.currentSentenceCorrectChars = 0;
            state.currentSentenceTotalChars = 0;

            // Reset font size to default
            state.fontSize = 24;
            fontSizeSlider.value = 24;
            fontSizeValue.textContent = '24px';
            passageEl.style.fontSize = '24px';

            // Save the reset state
            saveProgress();
            saveSettings();

            // Display first sentence (fresh start)
            displayCurrentSentence();

            // Update stats display to show defaults
            updateStats();

            // Close modal
            menuModal.classList.remove('active');

            // Refocus input
            setTimeout(() => focusInput(), 100);

            console.log('Progress reset - starting fresh!');
        }
    });
    
    // Font size slider
    fontSizeSlider.addEventListener('input', (e) => {
        state.fontSize = parseInt(e.target.value);
        fontSizeValue.textContent = state.fontSize + 'px';
        passageEl.style.fontSize = state.fontSize + 'px';
        saveSettings();
        // Recalculate caret position after font size change
        setTimeout(() => updateCaret(), 50);
    });

    // Recalculate caret position on window resize
    window.addEventListener('resize', () => {
        if (caretEl) {
            updateCaret();
        }
    });

    // Ensure focus and caret visibility when window gains focus
    window.addEventListener('focus', () => {
        console.log('Window gained focus');
        focusInput();
        if (caretEl) {
            caretEl.style.display = 'block';
            caretEl.style.visibility = 'visible';
        }
    });

    // Keep caret visible even when window loses focus
    window.addEventListener('blur', () => {
        console.log('Window lost focus');
        if (caretEl) {
            caretEl.style.display = 'block';
            caretEl.style.visibility = 'visible';
        }
    });

    // Handle visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('Tab became visible');
            focusInput();
            if (caretEl) {
                caretEl.style.display = 'block';
                caretEl.style.visibility = 'visible';
            }
        }
    });
}

// Start the app
init();

