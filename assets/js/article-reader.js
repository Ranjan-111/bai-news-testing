export class ArticleReader {
    constructor() {
        this.isPlaying = false;
        this.isPaused = false;
        this.isDragging = false;
        this.currentWordIndex = 0;
        this.words = [];
        this.wordElements = [];
        this.highlighters = [];

        // Piper TTS state
        this.tts = null;
        this.piperReady = false;
        this.piperLoading = false;
        this.voiceId = 'en_US-libritts_r-medium';

        // Audio playback state (Web Audio API — AudioBufferSourceNode)
        this.audioContext = null;
        this.sourceNode = null;           // Current AudioBufferSourceNode
        this.currentAudioBuffer = null;   // Decoded AudioBuffer for current chunk
        this.playStartMark = 0;           // audioContext.currentTime when playback started
        this.playOffset = 0;              // Offset (seconds) into the buffer where playback started
        this.pausePosition = 0;           // Elapsed seconds when paused
        this._stoppedManually = false;    // Flag to differentiate stop() from natural end
        this._playbackGen = 0;            // Generation counter to cancel stale async playback

        // Sentence chunking state
        this.sentenceChunks = [];      // Array of { text, words, wordStartIdx, wordEndIdx }
        this.currentChunkIndex = 0;
        this.chunkWordTimings = [];    // Array of { startTime, endTime } for words in current chunk
        this.chunkStartWordIndex = 0;  // Global word index where current chunk starts
        this.rafId = null;

        // Pre-synthesis buffer
        this.nextChunkBuffer = null;      // Pre-decoded AudioBuffer for next chunk
        this.nextChunkDuration = 0;

        this.init();
    }

    init() {
        const playBtn = document.getElementById('play-pause-btn-circle');
        const verticalBar = document.getElementById('progress-bar-vertical');
        const readerContainer = document.getElementById('reader-container-vertical');

        playBtn.addEventListener('click', async () => {
            const isMobile = window.innerWidth <= 600;

            // Prepare words if not done yet
            if (this.words.length === 0) {
                this.prepareArticleText();
            }

            // Ensure Piper is loaded before any playback
            if (!this.piperReady && !this.piperLoading) {
                await this.initPiper();
                if (!this.piperReady) return; // failed to load
            }

            if (!this.isPlaying) {
                // Start playing
                if (isMobile) {
                    readerContainer.classList.add('expanded');
                    setTimeout(() => {
                        this.startReading();
                        const mobileProgress = document.getElementById('mobile-progress-container');
                        if (mobileProgress) mobileProgress.classList.add('active');
                    }, 400);
                } else {
                    this.startReading();
                    verticalBar.classList.remove('hidden');
                }
            } else if (this.isPaused) {
                this.resumeReading();
            } else {
                this.pauseReading();
            }
        });

        // Make the vertical progress bar draggable (desktop/tablet)
        const progressHandle = document.getElementById('progress-handle-vertical');
        this.initDraggableProgress(verticalBar, progressHandle);

        // Initialize horizontal progress bar for mobile
        this.initMobileProgressBar();

        // Prepare text after a small delay to ensure DOM is ready
        setTimeout(() => {
            this.prepareArticleText();
        }, 100);
    }

    // ─────────────────────────────────────────────────
    //  Piper TTS Initialization
    // ─────────────────────────────────────────────────

    async initPiper() {
        if (this.piperReady || this.piperLoading) return;
        this.piperLoading = true;

        const statusEl = document.getElementById('voice-download-status');
        const statusText = document.getElementById('voice-download-text');

        try {
            // Show download status
            if (statusEl) statusEl.classList.remove('hidden');
            if (statusText) statusText.textContent = 'Loading voice engine...';

            // Dynamic import of the Piper TTS library from CDN
            const ttsModule = await import('https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@latest/+esm');
            this.tts = ttsModule;

            // Check if model is already stored in OPFS
            const storedModels = await this.tts.stored();
            const isStored = storedModels.includes(this.voiceId);

            if (!isStored) {
                if (statusText) statusText.textContent = 'initializing (first time)...';

                // Download model with progress
                await this.tts.download(this.voiceId, (progress) => {
                    if (progress.total > 0) {
                        const pct = Math.round((progress.loaded / progress.total) * 100);
                        if (statusText) statusText.textContent = `Initializing voice... ${pct}%`;
                    }
                });
            }

            // Create AudioContext for decoding WAV durations
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            this.piperReady = true;
            if (statusText) statusText.textContent = 'initialized!';

            // Hide status after a short delay
            setTimeout(() => {
                if (statusEl) statusEl.classList.add('hidden');
            }, 1000);

        } catch (err) {
            console.error('Failed to initialize Piper TTS:', err);
            if (statusText) statusText.textContent = 'Voice failed to load';
            setTimeout(() => {
                if (statusEl) statusEl.classList.add('hidden');
            }, 3000);
        } finally {
            this.piperLoading = false;
        }
    }

    // ─────────────────────────────────────────────────
    //  Mobile Progress Bar Logic
    // ─────────────────────────────────────────────────

    initMobileProgressBar() {
        const horizontalBar = document.getElementById('progress-bar-horizontal');
        const horizontalHandle = document.getElementById('progress-handle-horizontal');

        if (!horizontalBar || !horizontalHandle) return;

        const seekToPosition = (clientX) => {
            if (!horizontalBar || this.words.length === 0) return;

            const rect = horizontalBar.getBoundingClientRect();
            const barWidth = rect.width;
            const offsetX = clientX - rect.left;
            const clampedX = Math.max(0, Math.min(offsetX, barWidth));
            const percentage = Math.max(0, Math.min(1, clampedX / barWidth));

            let newIndex = Math.floor(percentage * this.words.length);
            if (newIndex >= this.words.length) newIndex = this.words.length - 1;
            if (newIndex < 0) newIndex = 0;

            this.currentWordIndex = newIndex;
            this.updateProgress();

            if (!this.isDragging && this.isPlaying && !this.isPaused) {
                this.seekToWordIndex(newIndex);
            } else {
                this.updateFloatingHighlighter(this.currentWordIndex);
            }
        };

        const onMouseDown = (e) => {
            this.isDragging = true;
            seekToPosition(e.clientX);
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (this.isDragging) {
                seekToPosition(e.clientX);
            }
        };

        const onMouseUp = () => {
            if (this.isDragging) {
                this.isDragging = false;
                if (this.isPlaying && !this.isPaused) {
                    this.seekToWordIndex(this.currentWordIndex);
                }
            }
        };

        const onTouchStart = (e) => {
            this.isDragging = true;
            seekToPosition(e.touches[0].clientX);
            e.preventDefault();
        };

        const onTouchMove = (e) => {
            if (this.isDragging) {
                seekToPosition(e.touches[0].clientX);
                e.preventDefault();
            }
        };

        const onTouchEnd = () => {
            if (this.isDragging) {
                this.isDragging = false;
                if (this.isPlaying && !this.isPaused) {
                    this.seekToWordIndex(this.currentWordIndex);
                }
            }
        };

        horizontalHandle.addEventListener('mousedown', onMouseDown);
        horizontalBar.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        horizontalHandle.addEventListener('touchstart', onTouchStart);
        horizontalBar.addEventListener('touchstart', onTouchStart);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }

    // ─────────────────────────────────────────────────
    //  Desktop Draggable Progress Bar
    // ─────────────────────────────────────────────────

    initDraggableProgress(progressBar, handle) {
        if (!progressBar || !handle) return;

        const seekToPosition = (clientY) => {
            if (!progressBar || this.words.length === 0) return;

            const rect = progressBar.getBoundingClientRect();
            const barHeight = rect.height;
            const offsetY = clientY - rect.top;
            const clampedY = Math.max(0, Math.min(offsetY, barHeight));

            // Invert: top = 0%, bottom = 100% (fill grows from bottom)
            const percentage = Math.max(0, Math.min(1, 1 - (clampedY / barHeight)));

            let newIndex = Math.floor(percentage * this.words.length);
            if (newIndex >= this.words.length) newIndex = this.words.length - 1;
            if (newIndex < 0) newIndex = 0;

            this.currentWordIndex = newIndex;
            this.updateProgress();

            if (!this.isDragging && this.isPlaying && !this.isPaused) {
                this.seekToWordIndex(newIndex);
            } else {
                this.updateFloatingHighlighter(this.currentWordIndex);
            }
        };

        const onMouseDown = (e) => {
            this.isDragging = true;
            seekToPosition(e.clientY);
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (this.isDragging) {
                seekToPosition(e.clientY);
            }
        };

        const onMouseUp = () => {
            if (this.isDragging) {
                this.isDragging = false;
                if (this.isPlaying && !this.isPaused) {
                    this.seekToWordIndex(this.currentWordIndex);
                }
            }
        };

        // Mouse events
        handle.addEventListener('mousedown', onMouseDown);
        progressBar.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        // Touch events for mobile
        const onTouchStart = (e) => {
            this.isDragging = true;
            seekToPosition(e.touches[0].clientY);
            e.preventDefault();
        };

        const onTouchMove = (e) => {
            if (this.isDragging) {
                seekToPosition(e.touches[0].clientY);
                e.preventDefault();
            }
        };

        const onTouchEnd = () => {
            if (this.isDragging) {
                this.isDragging = false;
                if (this.isPlaying && !this.isPaused) {
                    this.seekToWordIndex(this.currentWordIndex);
                }
            }
        };

        handle.addEventListener('touchstart', onTouchStart);
        progressBar.addEventListener('touchstart', onTouchStart);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }

    // ─────────────────────────────────────────────────
    //  Text Preparation — Extract readable words
    // ─────────────────────────────────────────────────

    prepareArticleText() {
        const contentEl = document.getElementById('article-content');
        if (!contentEl) return;

        this.words = [];
        this.wordElements = [];

        // Helper: wrap text nodes inside an element with word spans
        const wrapWordsInElement = (el) => {
            if (!el.textContent.trim()) return;

            // Skip elements that contain non-readable nested content
            if (el.querySelector('pre, img, figure')) return;

            const text = el.textContent;
            const wordsArr = text.split(/(\s+)/);

            // Clear the element and rebuild with word spans
            el.innerHTML = '';
            el.style.position = 'relative';
            el.style.zIndex = '2';

            wordsArr.forEach(word => {
                if (word.trim()) {
                    const span = document.createElement('span');
                    span.className = 'word';
                    span.textContent = word;
                    this.wordElements.push(span);
                    this.words.push(word);
                    el.appendChild(span);
                } else {
                    el.appendChild(document.createTextNode(word));
                }
            });
        };

        // Walk ALL readable elements in a SINGLE querySelectorAll pass.
        // querySelectorAll returns elements in document order, so headings,
        // paragraphs, lists, and table cells are read in the correct sequence.
        const allReadable = contentEl.querySelectorAll(
            'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote'
        );

        allReadable.forEach(el => {
            // Skip if already processed (e.g. by a parent element)
            if (el.querySelector('.word')) return;

            // Skip elements inside code blocks or chart containers
            if (el.closest('pre') || el.closest('.premium-chart-container')) return;

            // Skip blockquotes that contain child <p> (those will be handled individually)
            if (el.tagName === 'BLOCKQUOTE' && el.querySelector('p')) return;

            // Skip paragraphs that contain images or figures
            if (el.querySelector('img, figure')) return;

            // Skip empty elements
            if (!el.textContent.trim()) return;

            wrapWordsInElement(el);
        });

        // FALLBACK: If no words were found (e.g. plain text content without
        // standard HTML tags like <p>, <h1>, etc.), walk through all text nodes
        // and wrap their words in <span> elements WITHOUT destroying the DOM.
        if (this.words.length === 0 && contentEl.textContent.trim()) {
            const textNodes = [];
            const walker = document.createTreeWalker(
                contentEl, NodeFilter.SHOW_TEXT, null, false
            );
            let node;
            while (node = walker.nextNode()) {
                if (node.textContent.trim()) textNodes.push(node);
            }

            textNodes.forEach(textNode => {
                const parent = textNode.parentNode;
                // Skip nodes inside pre/code/chart containers
                if (parent.closest && (parent.closest('pre') || parent.closest('.premium-chart-container'))) return;

                const text = textNode.textContent;
                const parts = text.split(/(\s+)/);
                const fragment = document.createDocumentFragment();

                parts.forEach(part => {
                    if (part.trim()) {
                        const span = document.createElement('span');
                        span.className = 'word';
                        span.textContent = part;
                        this.wordElements.push(span);
                        this.words.push(part);
                        fragment.appendChild(span);
                    } else if (part) {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });

                parent.replaceChild(fragment, textNode);
            });

            contentEl.style.position = 'relative';
            contentEl.style.zIndex = '2';
        }

        // Build sentence chunks from the collected words
        this.buildSentenceChunks();
    }

    // ─────────────────────────────────────────────────
    //  Sentence Chunking — Split words into sentences
    // ─────────────────────────────────────────────────

    buildSentenceChunks() {
        this.sentenceChunks = [];
        if (this.words.length === 0) return;

        let currentSentenceWords = [];
        let sentenceStartIdx = 0;

        for (let i = 0; i < this.words.length; i++) {
            const word = this.words[i];
            currentSentenceWords.push(word);

            // Detect sentence boundaries: word ends with `.`, `!`, `?`, `:`, `;`
            // Also force a break every 25 words to keep chunks manageable
            const isSentenceEnd = /[.!?;:]$/.test(word);
            const isTooLong = currentSentenceWords.length >= 25;

            if (isSentenceEnd || isTooLong || i === this.words.length - 1) {
                this.sentenceChunks.push({
                    text: currentSentenceWords.join(' '),
                    words: [...currentSentenceWords],
                    wordStartIdx: sentenceStartIdx,
                    wordEndIdx: i
                });
                currentSentenceWords = [];
                sentenceStartIdx = i + 1;
            }
        }
    }

    // ─────────────────────────────────────────────────
    //  Playback Control
    // ─────────────────────────────────────────────────

    startReading() {
        this.isPlaying = true;
        this.isPaused = false;
        if (this.currentWordIndex >= this.words.length) {
            this.currentWordIndex = 0;
        }

        // Find which chunk contains the current word index
        this.currentChunkIndex = this.findChunkForWordIndex(this.currentWordIndex);
        this.updateButtonUI('pause');
        this.playCurrentChunk();
    }

    pauseReading() {
        this.isPaused = true;
        // Record where we are in the buffer
        this.pausePosition = this.getCurrentPlaybackTime();
        this.stopSourceNode();
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.updateButtonUI('play');
        // Keep highlighter visible at current position
        this.updateFloatingHighlighter(this.currentWordIndex);
    }

    resumeReading() {
        this.isPaused = false;
        this.updateButtonUI('pause');
        if (this.currentAudioBuffer) {
            // Resume from the paused position within the same buffer
            this.startSourceNode(this.currentAudioBuffer, this.pausePosition);
            this.trackPlayback();
        } else {
            // If buffer was cleaned up, restart from current chunk
            this.playCurrentChunk();
        }
    }

    stopReading() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentWordIndex = 0;
        this.currentChunkIndex = 0;

        // Stop audio source node
        this.stopSourceNode();
        this.currentAudioBuffer = null;

        // Cancel animation frame
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // Clear pre-synthesized buffer
        this.nextChunkBuffer = null;
        this.nextChunkDuration = 0;

        this.updateButtonUI('play');
        this.highlighters.forEach(h => h.remove());
        this.highlighters = [];
        this.updateProgress();

        // Reset mobile UI
        const isMobile = window.innerWidth <= 600;
        if (isMobile) {
            const readerContainer = document.getElementById('reader-container-vertical');
            const mobileProgress = document.getElementById('mobile-progress-container');

            if (mobileProgress) {
                mobileProgress.classList.remove('active');
            }

            setTimeout(() => {
                if (readerContainer) {
                    readerContainer.classList.remove('expanded');
                }
            }, 400);
        }
    }

    // ─────────────────────────────────────────────────
    //  Seek to a specific word index (from progress bar drag)
    // ─────────────────────────────────────────────────

    seekToWordIndex(wordIndex) {
        // Increment generation to cancel any in-flight async playCurrentChunk
        this._playbackGen++;

        // Stop current playback
        this.stopSourceNode();
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        const targetChunk = this.findChunkForWordIndex(wordIndex);

        // Keep currentAudioBuffer if seeking within the same chunk (instant seek)
        if (targetChunk !== this.currentChunkIndex) {
            // Check if the target chunk was already synthesized (cached on the chunk object)
            const cached = this.sentenceChunks[targetChunk];
            this.currentAudioBuffer = cached._audioBuffer || null;
        }

        // Update indices and restart
        this.currentWordIndex = wordIndex;
        this.currentChunkIndex = targetChunk;
        this.playCurrentChunk();
    }

    // ─────────────────────────────────────────────────
    //  Core Synthesis & Playback
    // ─────────────────────────────────────────────────

    async playCurrentChunk() {
        const myGen = this._playbackGen;

        if (this.isPaused || this.currentChunkIndex >= this.sentenceChunks.length) {
            if (this.currentChunkIndex >= this.sentenceChunks.length) {
                this.stopReading();
            }
            return;
        }

        const chunk = this.sentenceChunks[this.currentChunkIndex];
        this.chunkStartWordIndex = chunk.wordStartIdx;

        try {
            let audioBuffer, audioDuration;

            // 1. Reuse current buffer (same chunk seek or pause/resume)
            if (this.currentAudioBuffer) {
                audioBuffer = this.currentAudioBuffer;
                audioDuration = this.currentAudioBuffer.duration;
            // 2. Check chunk-level cache (previously synthesized)
            } else if (chunk._audioBuffer) {
                audioBuffer = chunk._audioBuffer;
                audioDuration = audioBuffer.duration;
            // 3. Use pre-synthesized next-chunk buffer
            } else if (this.nextChunkBuffer) {
                audioBuffer = this.nextChunkBuffer;
                audioDuration = this.nextChunkDuration;
                this.nextChunkBuffer = null;
                this.nextChunkDuration = 0;
            } else {
                // 4. Synthesize from scratch
                const result = await this.synthesizeChunk(chunk.text);

                // RACE CHECK: bail out if a newer seek/stop happened during synthesis
                if (myGen !== this._playbackGen) return;

                audioBuffer = result.audioBuffer;
                audioDuration = result.duration;
            }

            // Cache on the chunk object so future seeks to this chunk are instant
            chunk._audioBuffer = audioBuffer;
            this.currentAudioBuffer = audioBuffer;

            // Calculate word timings for this chunk
            this.chunkWordTimings = this.calculateWordTimings(chunk.words, audioDuration);

            // Set the current word index to the start of this chunk
            // (unless we're seeking into the middle of a chunk)
            if (this.currentWordIndex < chunk.wordStartIdx || this.currentWordIndex > chunk.wordEndIdx) {
                this.currentWordIndex = chunk.wordStartIdx;
            }

            // Calculate the audio offset for seeking within the chunk
            let startOffset = 0;
            const offsetInChunk = this.currentWordIndex - chunk.wordStartIdx;
            if (offsetInChunk > 0 && offsetInChunk < this.chunkWordTimings.length) {
                startOffset = this.chunkWordTimings[offsetInChunk].startTime;
            }

            // Immediately show highlighter at the correct position
            this.updateFloatingHighlighter(this.currentWordIndex);

            // RACE CHECK: bail out if a newer seek happened during computation
            if (myGen !== this._playbackGen) return;

            // Play using AudioBufferSourceNode — start(when, offset) is precise!
            this.startSourceNode(audioBuffer, startOffset);

            // Start tracking playback for highlighter sync
            this.trackPlayback();

            // Pre-synthesize upcoming chunks in background
            this.preSynthesizeNextChunks();

        } catch (err) {
            if (myGen !== this._playbackGen) return; // Stale, ignore
            console.error('Error playing chunk:', err);
            // Try next chunk
            this.currentChunkIndex++;
            if (this.currentChunkIndex < this.sentenceChunks.length) {
                this.currentWordIndex = this.sentenceChunks[this.currentChunkIndex].wordStartIdx;
                this.playCurrentChunk();
            } else {
                this.stopReading();
            }
        }
    }

    async synthesizeChunk(text) {
        if (!this.tts || !this.piperReady) {
            throw new Error('Piper TTS not initialized');
        }

        // Generate WAV audio from text
        const wavBlob = await this.tts.predict({
            text: text,
            voiceId: this.voiceId
        });

        // Decode into an AudioBuffer (used directly by AudioBufferSourceNode)
        const arrayBuffer = await wavBlob.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        return { audioBuffer, duration: audioBuffer.duration };
    }

    async preSynthesizeNextChunks() {
        // Pre-synthesize 2 chunks ahead for smoother playback
        for (let offset = 1; offset <= 2; offset++) {
            const idx = this.currentChunkIndex + offset;
            if (idx >= this.sentenceChunks.length) break;

            const chunk = this.sentenceChunks[idx];
            // Skip if already cached
            if (chunk._audioBuffer) continue;

            try {
                const result = await this.synthesizeChunk(chunk.text);
                // Only store if we haven't moved past this chunk
                if (this.currentChunkIndex + offset === idx) {
                    chunk._audioBuffer = result.audioBuffer;
                    // Also store as the immediate-next buffer for the playback path
                    if (offset === 1) {
                        this.nextChunkBuffer = result.audioBuffer;
                        this.nextChunkDuration = result.duration;
                    }
                }
            } catch (err) {
                console.warn('Pre-synthesis failed:', err);
                break; // Don't try further if one fails
            }
        }
    }

    // ─────────────────────────────────────────────────
    //  Word Timing Calculation
    //  Distributes sentence duration across words
    //  proportionally by character length + punctuation pauses
    // ─────────────────────────────────────────────────

    calculateWordTimings(words, totalDuration) {
        const timings = [];
        if (words.length === 0 || totalDuration <= 0) return timings;

        // Calculate weighted character count for each word
        const weights = words.map(word => {
            let weight = word.length;

            // Punctuation at end of word adds a small pause
            if (/[.,;:]$/.test(word)) weight += 2;
            if (/[!?]$/.test(word)) weight += 3;

            // Long words get slightly less per-char weight (they're spoken faster proportionally)
            if (word.length > 10) weight = word.length * 0.85;

            return Math.max(weight, 1);
        });

        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let currentTime = 0;

        for (let i = 0; i < words.length; i++) {
            const wordDuration = (weights[i] / totalWeight) * totalDuration;
            timings.push({
                startTime: currentTime,
                endTime: currentTime + wordDuration
            });
            currentTime += wordDuration;
        }

        return timings;
    }

    // ─────────────────────────────────────────────────
    //  Playback Tracking — requestAnimationFrame loop
    //  Syncs the floating highlighter with audio.currentTime
    // ─────────────────────────────────────────────────

    trackPlayback() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }

        const tick = () => {
            if (!this.sourceNode || this.isPaused || !this.isPlaying || this.isDragging) {
                return;
            }

            const currentTime = this.getCurrentPlaybackTime();
            const chunk = this.sentenceChunks[this.currentChunkIndex];
            if (!chunk) return;

            // Find which word we're currently on based on audio time
            let localWordIdx = 0;
            for (let i = 0; i < this.chunkWordTimings.length; i++) {
                if (currentTime >= this.chunkWordTimings[i].startTime) {
                    localWordIdx = i;
                }
            }

            const globalWordIdx = chunk.wordStartIdx + localWordIdx;

            if (globalWordIdx !== this.currentWordIndex) {
                this.currentWordIndex = globalWordIdx;
                this.updateProgress();
                this.updateFloatingHighlighter(this.currentWordIndex);
            }

            this.rafId = requestAnimationFrame(tick);
        };

        this.rafId = requestAnimationFrame(tick);
    }

    // ─────────────────────────────────────────────────
    //  Utility: Find which chunk contains a given word index
    // ─────────────────────────────────────────────────

    findChunkForWordIndex(wordIndex) {
        for (let i = 0; i < this.sentenceChunks.length; i++) {
            const chunk = this.sentenceChunks[i];
            if (wordIndex >= chunk.wordStartIdx && wordIndex <= chunk.wordEndIdx) {
                return i;
            }
        }
        return 0;
    }

    // ─────────────────────────────────────────────────
    //  Web Audio API — AudioBufferSourceNode helpers
    //  Used instead of Audio element for reliable seeking
    // ─────────────────────────────────────────────────

    /**
     * Start playing an AudioBuffer from the given offset (in seconds).
     * Uses AudioBufferSourceNode.start(when, offset) for precise positioning.
     */
    startSourceNode(audioBuffer, offset = 0) {
        // Stop any existing source first
        this.stopSourceNode();

        // CRITICAL: Reset the flag so the new source's onended
        // won't think it was a manual stop
        this._stoppedManually = false;
        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = audioBuffer;
        this.sourceNode.connect(this.audioContext.destination);

        // Record timing marks
        this.playStartMark = this.audioContext.currentTime;
        this.playOffset = offset;

        // Handle natural end of playback (not manual stop)
        this.sourceNode.onended = () => {
            if (this._stoppedManually) {
                this._stoppedManually = false;
                return;
            }
            if (this.isDragging || this.isPaused) return;

            // Move to next chunk
            this.currentChunkIndex++;
            this.currentAudioBuffer = null;
            if (this.currentChunkIndex < this.sentenceChunks.length) {
                this.currentWordIndex = this.sentenceChunks[this.currentChunkIndex].wordStartIdx;
                this.playCurrentChunk();
            } else {
                this.stopReading();
            }
        };

        // Start playback from the specified offset
        this.sourceNode.start(0, offset);
    }

    /**
     * Stop the current AudioBufferSourceNode (sets a flag so onended
     * knows this was a manual stop, not a natural end of audio).
     */
    stopSourceNode() {
        if (this.sourceNode) {
            this._stoppedManually = true;
            try {
                this.sourceNode.stop();
            } catch (e) {
                // Already stopped — ignore
            }
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
    }

    /**
     * Get the current playback position in seconds, relative to
     * the start of the current chunk's AudioBuffer.
     */
    getCurrentPlaybackTime() {
        if (!this.sourceNode || !this.audioContext) return this.pausePosition || 0;
        return this.audioContext.currentTime - this.playStartMark + this.playOffset;
    }

    // ─────────────────────────────────────────────────
    //  Floating Highlighter (unchanged logic)
    // ─────────────────────────────────────────────────

    updateFloatingHighlighter(index) {
        // Remove old highlighters
        this.highlighters.forEach(h => h.remove());
        this.highlighters = [];

        // Get previous, current, and next word for 3-word highlight
        const prevWord = index > 0 ? this.wordElements[index - 1] : null;
        const currentWord = this.wordElements[index];
        const nextWord = index < this.wordElements.length - 1 ? this.wordElements[index + 1] : null;

        if (!currentWord) return;

        const articleContent = document.getElementById('article-content');

        // Use prev, current, next for broader highlight flow
        const words = [prevWord, currentWord, nextWord].filter(w => w !== null);

        // Group words by line (handle line wrapping)
        const lineGroups = [];
        let currentLine = [];
        let lastTop = null;

        words.forEach(word => {
            const rect = word.getBoundingClientRect();
            if (rect.width === 0) return;

            const top = Math.round(rect.top);

            if (lastTop === null || Math.abs(top - lastTop) < 5) {
                currentLine.push(word);
            } else {
                if (currentLine.length > 0) lineGroups.push(currentLine);
                currentLine = [word];
            }
            lastTop = top;
        });

        if (currentLine.length > 0) {
            lineGroups.push(currentLine);
        }

        // Create highlighter for each line
        lineGroups.forEach(lineWords => {
            const firstWord = lineWords[0];
            const lastWord = lineWords[lineWords.length - 1];

            const firstRect = firstWord.getBoundingClientRect();
            const lastRect = lastWord.getBoundingClientRect();
            const contentRect = articleContent.getBoundingClientRect();

            const highlighter = document.createElement('div');
            highlighter.className = 'floating-highlighter';

            // Calculate position relative to the container
            const left = firstRect.left - contentRect.left;
            const top = firstRect.top - contentRect.top;
            const width = lastRect.right - firstRect.left;
            const height = Math.max(firstRect.height, lastRect.height);

            highlighter.style.left = `${left}px`;
            highlighter.style.top = `${top}px`;
            highlighter.style.width = `${width}px`;
            highlighter.style.height = `${height}px`;

            articleContent.appendChild(highlighter);
            this.highlighters.push(highlighter);
        });
    }

    // ─────────────────────────────────────────────────
    //  Progress Bar Update (unchanged logic)
    // ─────────────────────────────────────────────────

    updateProgress() {
        if (this.words.length === 0) return;
        const progress = (this.currentWordIndex / this.words.length) * 100;

        // Update vertical progress bar (desktop/tablet)
        const progressFillVertical = document.getElementById('progress-fill-vertical');
        if (progressFillVertical) {
            progressFillVertical.style.height = `${progress}%`;
        }

        // Update horizontal progress bar (mobile)
        const progressFillHorizontal = document.getElementById('progress-fill-horizontal');
        if (progressFillHorizontal) {
            progressFillHorizontal.style.width = `${progress}%`;
        }
    }

    // ─────────────────────────────────────────────────
    //  Button UI (unchanged logic)
    // ─────────────────────────────────────────────────

    updateButtonUI(state) {
        const btn = document.getElementById('play-pause-btn-circle');
        if (state === 'pause') {
            btn.classList.add('playing'); // Add class for red background
            btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        } else {
            btn.classList.remove('playing'); // Remove class for black background
            btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
        }
    }
}
