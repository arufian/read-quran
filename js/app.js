// Qur'an Reader Application - Complete Fixed Version
// Features: Web Speech API, proper translations (EN/ID/JA), i18n, improved dark mode, continuous reading

class QuranApp {
    constructor() {
        this.currentView = 'library';
        this.currentSurah = null;
        this.currentLanguage = localStorage.getItem('quran-language') || 'en';
        this.bookmarks = JSON.parse(localStorage.getItem('quran-bookmarks') || '[]');
        this.lastRead = JSON.parse(localStorage.getItem('quran-lastread') || 'null');
        this.surahs = [];
        this.verses = [];
        this.versesData = [];
        this.isAudioPlaying = false;
        this.isSpeaking = false;
        this.currentSpeakingVerse = null;
        this.synth = null;
        this.voices = [];
        this.isContinuousReading = false;
        this.currentVerseIndex = 0;

        // FIXED: Correct translation IDs
        this.translationSources = {
            en: { name: 'English', author: 'Saheeh International', id: 85 },
            id: { name: 'Bahasa Indonesia', author: 'Indonesian Ministry of Religious Affairs', id: 33 },
            ja: { name: '日本語', author: 'Saeed Sato', id: 218 }
        };

        // i18n translations
        this.i18n = {
            en: {
                appTitle: "Read Qur'an",
                heroTitle: "Read the Qur'an",
                heroSubtitle: 'Experience the holy book with beautiful translations.',
                continueReading: 'Continue Reading',
                browseSurahs: 'Browse Surahs',
                surahs: 'Surahs',
                searchSurah: 'Search surah...',
                verses: 'verses',
                backToLibrary: 'Back to Library',
                previous: '← Previous',
                next: 'Next →',
                ambientSound: 'Ambient Sound',
                ambientSubtitle: 'Peaceful reading atmosphere',
                loading: 'Loading...',
                startReading: 'Start Reading',
                stopReading: 'Stop Reading',
                readingFrom: 'Reading verse'
            },
            id: {
                appTitle: "Read Qur'an",
                heroTitle: 'Baca Al-Quran',
                heroSubtitle: 'Rasakan kitab suci dengan terjemahan indah.',
                continueReading: 'Lanjutkan Membaca',
                browseSurahs: 'Jelajahi Surat',
                surahs: 'Surat',
                searchSurah: 'Cari surat...',
                verses: 'ayat',
                backToLibrary: 'Kembali',
                previous: '← Sebelumnya',
                next: 'Berikutnya →',
                ambientSound: 'Suara Ambien',
                ambientSubtitle: 'Suasana membaca yang tenang',
                loading: 'Memuat...',
                startReading: 'Mulai Membaca',
                stopReading: 'Berhenti Membaca',
                readingFrom: 'Membaca ayat'
            },
            ja: {
                appTitle: "Read Qur'an",
                heroTitle: 'コーランを読む',
                heroSubtitle: '美しい翻訳で聖典を体験してください。',
                continueReading: '続きを読む',
                browseSurahs: '章を閲覧',
                surahs: '章',
                searchSurah: '章を検索...',
                verses: '節',
                backToLibrary: 'ライブラリに戻る',
                previous: '← 前へ',
                next: '次へ →',
                ambientSound: '環境音',
                ambientSubtitle: '平和な読書雰囲気',
                loading: '読み込み中...',
                startReading: '読み始める',
                stopReading: '読むのを止める',
                readingFrom: '節を読む'
            }
        };

        this.init();
    }

    t(key) {
        return this.i18n[this.currentLanguage]?.[key] || this.i18n['en'][key];
    }

    async init() {
        this.setupEventListeners();
        this.setupAudioPlayer();
        this.setupSpeechSynthesis();
        this.loadLanguagePreference();
        this.loadAudioPreference();
        await this.fetchSurahs();
        this.updateAllUIText();
        this.renderSurahGrid();
        this.checkLastRead();
        this.setupContinuousReadingControls();
    }

    setupSpeechSynthesis() {
        if ('speechSynthesis' in window) {
            this.synth = window.speechSynthesis;
            this.loadVoices();
            if (speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = () => this.loadVoices();
            }
        }
    }

    loadVoices() {
        this.voices = this.synth.getVoices();
        console.log('Available voices:', this.voices.map(v => `${v.name} (${v.lang})`));
    }

    // IMPROVED: Prefer high-quality voices
    getVoiceForLanguage() {
        const langMap = {
            'en': ['en-US', 'en-GB', 'en'],
            'id': ['id-ID', 'id', 'ms-MY', 'ms'],
            'ja': ['ja-JP', 'ja']
        };

        const preferredLangs = langMap[this.currentLanguage] || ['en'];

        // List of known high-quality voice names to prefer
        const premiumVoiceNames = [
            'Google', 'Microsoft', 'Apple', 'Premium', 'Enhanced', 'Natural',
            'Samantha', 'Alex', 'Daniel', 'Karen', 'Moira', 'Tessa',
            'Kyoko', 'O-Ren', 'Google 日本語', 'Microsoft Sayaka'
        ];

        // First try to find a premium voice for the language
        for (const lang of preferredLangs) {
            // Look for premium voices first
            const premiumVoice = this.voices.find(v => {
                const isTargetLang = v.lang.startsWith(lang);
                const isPremium = premiumVoiceNames.some(name =>
                    v.name.includes(name) || v.name.toLowerCase().includes(name.toLowerCase())
                );
                return isTargetLang && isPremium;
            });
            if (premiumVoice) {
                console.log('Using premium voice:', premiumVoice.name);
                return premiumVoice;
            }
        }

        // Fallback to any voice for the language
        for (const lang of preferredLangs) {
            const voice = this.voices.find(v => v.lang.startsWith(lang));
            if (voice) return voice;
        }

        // Final fallback to default
        return this.voices.find(v => v.lang.startsWith('en')) || this.voices[0];
    }

    setupContinuousReadingControls() {
        const globalPlayBtn = document.getElementById('global-speech-toggle');
        if (globalPlayBtn) {
            globalPlayBtn.addEventListener('click', () => {
                if (this.isContinuousReading) {
                    this.stopContinuousReading();
                } else {
                    this.startContinuousReading();
                }
            });
        }
    }

    startContinuousReadingFrom(verseIndex) {
        if (!this.synth) {
            alert('Text-to-speech not supported');
            return;
        }

        // Stop any current reading first
        if (this.isSpeaking || this.isContinuousReading) {
            this.synth.cancel();
            this.isSpeaking = false;
            this.isContinuousReading = false;
            this.currentSpeakingVerse = null;
            this.highlightCurrentVerse();

            // Small delay to let browser process cancel before starting new
            setTimeout(() => {
                this.isContinuousReading = true;
                this.currentVerseIndex = verseIndex;
                this.updateGlobalPlayButton();
                this.speakCurrentVerse();
            }, 100);
        } else {
            this.isContinuousReading = true;
            this.currentVerseIndex = verseIndex;
            this.updateGlobalPlayButton();
            this.speakCurrentVerse();
        }
    }

    startContinuousReading() {
        this.startContinuousReadingFrom(this.currentVerseIndex);
    }

    stopContinuousReading() {
        this.isContinuousReading = false;
        if (this.synth) this.synth.cancel();
        this.isSpeaking = false;
        this.currentSpeakingVerse = null;
        this.updateGlobalPlayButton();
        this.highlightCurrentVerse();
    }

    speakCurrentVerse() {
        if (!this.isContinuousReading || this.currentVerseIndex >= this.versesData.length) {
            this.stopContinuousReading();
            return;
        }

        const verse = this.versesData[this.currentVerseIndex];
        const verseNumber = this.currentVerseIndex + 1;
        const verseText = verse.text || verse;
        // Clean HTML, entities, AND footnote numbers
        const cleanText = verseText
            .replace(/<[^>]*>/g, '')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/\s+\d+\s*$/g, '');

        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voice = this.getVoiceForLanguage();
        if (voice) utterance.voice = voice;

        const langMap = { 'en': 'en-US', 'id': 'id-ID', 'ja': 'ja-JP' };
        utterance.lang = langMap[this.currentLanguage] || 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1;

        utterance.onstart = () => {
            this.isSpeaking = true;
            this.currentSpeakingVerse = verseNumber;
            this.updateGlobalPlayButton();
            this.highlightCurrentVerse();
            this.scrollToVerse(verseNumber);
        };

        utterance.onend = () => {
            this.currentVerseIndex++;
            if (this.isContinuousReading && this.currentVerseIndex < this.versesData.length) {
                setTimeout(() => this.speakCurrentVerse(), 500);
            } else {
                this.stopContinuousReading();
            }
        };

        utterance.onerror = () => {
            this.stopContinuousReading();
        };

        this.synth.speak(utterance);
    }

    updateGlobalPlayButton() {
        const btn = document.getElementById('global-speech-toggle');
        const playIcon = document.getElementById('global-play-icon');
        const stopIcon = document.getElementById('global-stop-icon');
        const statusText = document.getElementById('speech-status');

        if (!btn) return;

        if (this.isContinuousReading) {
            btn.classList.add('playing', 'bg-red-100', 'hover:bg-red-200');
            btn.classList.remove('bg-emerald-100', 'hover:bg-emerald-200');
            playIcon?.classList.add('hidden');
            stopIcon?.classList.remove('hidden');
            if (statusText) {
                statusText.textContent = `${this.t('readingFrom')} ${this.currentSpeakingVerse || this.currentVerseIndex + 1}`;
            }
        } else {
            btn.classList.remove('playing', 'bg-red-100', 'hover:bg-red-200');
            btn.classList.add('bg-emerald-100', 'hover:bg-emerald-200');
            playIcon?.classList.remove('hidden');
            stopIcon?.classList.add('hidden');
            if (statusText) {
                statusText.textContent = this.currentView === 'reader' ? this.t('startReading') : '';
            }
        }
    }

    highlightCurrentVerse() {
        document.querySelectorAll('.verse-container').forEach((el, index) => {
            el.classList.remove('currently-playing');
            if (this.isSpeaking && index + 1 === this.currentSpeakingVerse) {
                el.classList.add('currently-playing');
            }
        });
    }

    scrollToVerse(verseNumber) {
        const verseEl = document.getElementById(`verse-${verseNumber}`);
        if (verseEl) {
            verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    updateAllUIText() {
        const elements = {
            'app-title': this.t('appTitle'),
            'hero-title': this.t('heroTitle'),
            'hero-subtitle': this.t('heroSubtitle'),
            'continue-reading': this.t('continueReading'),
            'browse-surahs': this.t('browseSurahs'),
            'surahs-heading': this.t('surahs'),
            'back-to-library-text': this.t('backToLibrary'),
            'prev-surah': this.t('previous'),
            'next-surah': this.t('next'),
            'ambient-sound': this.t('ambientSound'),
            'ambient-subtitle': this.t('ambientSubtitle'),
            'loading-text': this.t('loading')
        };

        for (const [id, text] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el && text) el.textContent = text;
        }

        const searchInput = document.getElementById('search-surah');
        if (searchInput) searchInput.placeholder = this.t('searchSurah');
    }

    setupEventListeners() {
        document.getElementById('language-select')?.addEventListener('change', (e) => {
            this.changeLanguage(e.target.value);
        });
        document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('browse-surahs')?.addEventListener('click', () => this.showLibrary());
        document.getElementById('continue-reading')?.addEventListener('click', () => {
            if (this.lastRead) this.openSurah(this.lastRead.surahNumber, this.lastRead.verseNumber);
        });
        document.getElementById('back-to-library')?.addEventListener('click', () => this.showLibrary());
        document.getElementById('header-logo')?.addEventListener('click', () => this.showLibrary());
        document.getElementById('search-surah')?.addEventListener('input', (e) => this.searchSurahs(e.target.value));
        document.getElementById('prev-surah')?.addEventListener('click', () => {
            if (this.currentSurah > 1) this.openSurah(this.currentSurah - 1);
        });
        document.getElementById('next-surah')?.addEventListener('click', () => {
            if (this.currentSurah < 114) this.openSurah(this.currentSurah + 1);
        });
        document.getElementById('audio-toggle')?.addEventListener('click', () => this.toggleAudio());
        document.getElementById('volume-slider')?.addEventListener('input', (e) => this.setVolume(e.target.value / 100));

        // Spacebar shortcut to stop or resume reading
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.isContinuousReading) {
                    // Stop if currently reading
                    this.stopContinuousReading();
                } else if (this.currentView === 'reader' && this.versesData.length > 0) {
                    // Resume if in reader view with verses loaded
                    this.startContinuousReading();
                }
                // Do nothing if nothing to resume
            }
        });
    }

    setupAudioPlayer() {
        this.audioElement = null;
        this.currentAudioFile = localStorage.getItem('quran-audio-file') || 'birds';
        this.volume = parseFloat(localStorage.getItem('quran-audio-volume')) || 0.3;
        this.isAudioPlaying = false;

        // Available audio files
        this.audioFiles = {
            birds: 'audio/birds.mp3',
            rain: 'audio/rain.mp3',
            wave: 'audio/wave.mp3'
        };
    }

    initAudioElement() {
        if (!this.audioElement) {
            this.audioElement = new Audio();
            this.audioElement.loop = true;
            this.audioElement.volume = this.volume;
            this.loadAudioFile(this.currentAudioFile);
        }
    }

    loadAudioFile(audioType) {
        // Always update current audio file and save preference
        this.currentAudioFile = audioType;
        localStorage.setItem('quran-audio-file', audioType);

        // Only set src if audio element exists
        if (this.audioElement) {
            this.audioElement.src = this.audioFiles[audioType];
        }
    }

    playAmbientSound() {
        this.initAudioElement();
        if (this.audioElement) {
            this.audioElement.play().catch((error) => {
                console.error('Failed to play audio:', error);
            });
        }
    }

    stopAmbientSound() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
    }

    toggleAudio() {
        this.isAudioPlaying = !this.isAudioPlaying;
        const playIcon = document.getElementById('audio-icon-play');
        const pauseIcon = document.getElementById('audio-icon-pause');

        if (this.isAudioPlaying) {
            playIcon?.classList.add('hidden');
            pauseIcon?.classList.remove('hidden');
            this.playAmbientSound();
        } else {
            playIcon?.classList.remove('hidden');
            pauseIcon?.classList.add('hidden');
            this.stopAmbientSound();
        }
    }

    setVolume(value) {
        this.volume = value;
        localStorage.setItem('quran-audio-volume', value);
        if (this.audioElement) {
            this.audioElement.volume = value;
        }
    }

    changeAudioFile(audioType) {
        const wasPlaying = this.isAudioPlaying;

        // Stop current audio
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }

        // Load new audio file
        this.loadAudioFile(audioType);

        // Resume if was playing
        if (wasPlaying && this.audioElement) {
            this.audioElement.play().catch((error) => {
                console.error('Failed to play audio:', error);
            });
        }
    }

    loadAudioPreference() {
        const select = document.getElementById('ambient-audio-select');
        if (select) {
            select.value = this.currentAudioFile;
            select.addEventListener('change', (e) => {
                this.changeAudioFile(e.target.value);
            });
        }

        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            volumeSlider.value = this.volume * 100;
        }
    }

    async fetchSurahs() {
        this.showLoading(true);
        try {
            const response = await fetch('https://api.quran.com/api/v4/chapters');
            const data = await response.json();
            this.surahs = data.chapters;

            // Trigger background caching after Surahs are loaded
            this.triggerBackgroundCaching();
        } catch (error) {
            console.error('Failed to fetch surahs:', error);
            this.surahs = this.getFallbackSurahs();
        }
        this.showLoading(false);
    }

    triggerBackgroundCaching() {
        // Send message to Service Worker to pre-cache all Surah data
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            console.log('[App] Triggering background caching of all Surahs...');
            navigator.serviceWorker.controller.postMessage('precache-all-surahs');
        } else if ('serviceWorker' in navigator) {
            // Wait for service worker to be ready
            navigator.serviceWorker.ready.then((registration) => {
                if (registration.active) {
                    console.log('[App] Triggering background caching of all Surahs...');
                    registration.active.postMessage('precache-all-surahs');
                }
            });
        }
    }

    async fetchVerses(surahNumber) {
        this.showLoading(true);
        try {
            const translationId = this.translationSources[this.currentLanguage].id;
            const response = await fetch(
                `https://api.quran.com/api/v4/quran/translations/${translationId}?chapter_number=${surahNumber}`
            );
            const data = await response.json();
            return data.translations || [];
        } catch (error) {
            console.error('Failed to fetch verses:', error);
            return [];
        } finally {
            this.showLoading(false);
        }
    }

    getFallbackSurahs() {
        return [
            { id: 1, name_simple: "Al-Fatihah", name_arabic: "الفاتحة", verses_count: 7, translated_name: { name: "The Opening" }, revelation_place: "Mecca" },
            { id: 2, name_simple: "Al-Baqarah", name_arabic: "البقرة", verses_count: 286, translated_name: { name: "The Cow" }, revelation_place: "Medina" },
            { id: 3, name_simple: "Ali 'Imran", name_arabic: "آل عمران", verses_count: 200, translated_name: { name: "Family of Imran" }, revelation_place: "Medina" }
        ];
    }

    renderSurahGrid(filter = '') {
        const container = document.getElementById('surah-cards');
        if (!container) return;
        container.innerHTML = '';

        const filteredSurahs = this.surahs.filter(surah => {
            const searchTerm = filter.toLowerCase();
            return surah.name_simple.toLowerCase().includes(searchTerm) ||
                surah.translated_name.name.toLowerCase().includes(searchTerm);
        });

        filteredSurahs.forEach((surah, index) => {
            const card = this.createSurahCard(surah);
            card.style.animationDelay = `${index * 0.03}s`;
            card.classList.add('card-entrance');
            container.appendChild(card);
        });
    }

    createSurahCard(surah) {
        const div = document.createElement('div');
        div.className = 'surah-card bg-white rounded-xl p-5 border border-emerald-100 cursor-pointer';
        div.innerHTML = `
            <div class="flex items-start justify-between mb-3">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-700 font-bold">${surah.id}</div>
                <div class="text-right">
                    <p class="arabic-text text-xl text-emerald-800 font-medium">${surah.name_arabic}</p>
                </div>
            </div>
            <h4 class="font-semibold text-emerald-900 mb-1">${surah.name_simple}</h4>
            <p class="text-sm text-emerald-600 mb-3">${surah.translated_name.name}</p>
            <div class="flex items-center justify-between text-xs text-emerald-500">
                <span>${surah.verses_count} ${this.t('verses')}</span>
                <span>${surah.revelation_place || 'Mecca'}</span>
            </div>
        `;
        div.addEventListener('click', () => this.openSurah(surah.id));
        return div;
    }

    async openSurah(surahNumber, verseNumber = 1) {
        this.currentSurah = surahNumber;
        const surah = this.surahs.find(s => s.id === surahNumber);
        if (!surah) return;

        document.getElementById('reader-surah-name').textContent = `${surah.name_simple} - ${surah.name_arabic}`;
        document.getElementById('reader-surah-info').textContent = `${surah.translated_name.name} • ${surah.verses_count} ${this.t('verses')} • ${surah.revelation_place || ''}`;

        document.getElementById('hero').classList.add('hidden');
        document.getElementById('surah-grid').classList.add('hidden');
        document.getElementById('reader-view').classList.remove('hidden');
        document.getElementById('reader-view').classList.add('page-enter');

        document.getElementById('prev-surah').disabled = surahNumber === 1;
        document.getElementById('next-surah').disabled = surahNumber === 114;

        const verses = await this.fetchVerses(surahNumber);
        this.renderVerses(verses, surahNumber);
        this.saveLastRead(surahNumber, verseNumber);

        if (verseNumber > 1) {
            this.currentVerseIndex = verseNumber - 1;
            setTimeout(() => {
                const verseEl = document.getElementById(`verse-${verseNumber}`);
                if (verseEl) verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }

        this.currentView = 'reader';
        this.updateGlobalPlayButton();
    }

    renderVerses(verses, surahNumber) {
        const container = document.getElementById('verses-container');
        if (!container) return;
        container.innerHTML = '';

        this.versesData = verses;
        this.currentVerseIndex = 0;

        verses.forEach((verse, index) => {
            const verseEl = this.createVerseElement(verse, surahNumber, index + 1);
            verseEl.id = `verse-${index + 1}`;
            verseEl.classList.add('verse-reveal');
            verseEl.style.animationDelay = `${index * 0.05}s`;
            container.appendChild(verseEl);
        });

        const progressEl = document.getElementById('reading-progress');
        if (progressEl) progressEl.textContent = `${verses.length} ${this.t('verses')}`;

        this.isContinuousReading = false;
        this.isSpeaking = false;
        this.currentSpeakingVerse = null;
        this.updateGlobalPlayButton();
    }

    createVerseElement(verse, surahNumber, verseNumber) {
        const div = document.createElement('div');
        div.className = 'verse-container';
        div.dataset.verseNumber = verseNumber;

        const isBookmarked = this.isBookmarked(surahNumber, verseNumber);
        let verseText = verse.text || verse;
        // Strip footnote markers (numbers like "1", "2" that appear at end or standalone)
        verseText = verseText.replace(/\s+\d+\s*$/g, '').replace(/<sup[^>]*>\d+<\/sup>/gi, '');

        div.innerHTML = `
            <div class="flex items-start gap-4">
                <div class="flex-shrink-0"><span class="verse-number">${verseNumber}</span></div>
                <div class="flex-1">
                    <p class="verse-text text-base leading-relaxed text-slate-700 ${this.currentLanguage === 'ja' ? 'japanese-text' : ''}">${verseText}</p>
                </div>
                <div class="flex flex-col gap-2">
                    <button class="bookmark-btn ${isBookmarked ? 'active' : ''} p-2 hover:bg-amber-50 rounded-lg transition-colors" onclick="app.toggleBookmark(${surahNumber}, ${verseNumber}, this)">
                        <svg class="w-5 h-5 ${isBookmarked ? 'text-amber-500 fill-current' : 'text-slate-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        div.addEventListener('click', (e) => {
            if (!e.target.closest('.bookmark-btn')) {
                this.startContinuousReadingFrom(verseNumber - 1);
            }
        });

        return div;
    }

    showLibrary() {
        this.stopContinuousReading();
        if (this.isSpeaking && this.synth) {
            this.synth.cancel();
            this.isSpeaking = false;
            this.currentSpeakingVerse = null;
        }

        document.getElementById('hero').classList.remove('hidden');
        document.getElementById('surah-grid').classList.remove('hidden');
        document.getElementById('reader-view').classList.add('hidden');
        document.getElementById('reader-view').classList.remove('page-enter');

        this.currentView = 'library';
        this.currentSurah = null;
        this.renderSurahGrid();
        this.updateGlobalPlayButton();
    }

    searchSurahs(query) {
        this.renderSurahGrid(query);
    }

    changeLanguage(lang) {
        this.currentLanguage = lang;
        localStorage.setItem('quran-language', lang);
        this.updateAllUIText();

        if (this.currentView === 'reader' && this.currentSurah) {
            this.openSurah(this.currentSurah);
        } else {
            this.renderSurahGrid();
        }
    }

    loadLanguagePreference() {
        const select = document.getElementById('language-select');
        if (select) select.value = this.currentLanguage;
    }

    toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('quran-dark-mode', isDark);
    }

    checkLastRead() {
        if (this.lastRead) {
            const btn = document.getElementById('continue-reading');
            const surah = this.surahs.find(s => s.id === this.lastRead.surahNumber);
            if (btn && surah) {
                btn.classList.remove('hidden');
                btn.textContent = `${this.t('continueReading')}: ${surah.name_simple}`;
            }
        }
    }

    saveLastRead(surahNumber, verseNumber) {
        this.lastRead = { surahNumber, verseNumber, timestamp: Date.now() };
        localStorage.setItem('quran-lastread', JSON.stringify(this.lastRead));
    }

    isBookmarked(surahNumber, verseNumber) {
        return this.bookmarks.some(b => b.surahNumber === surahNumber && b.verseNumber === verseNumber);
    }

    toggleBookmark(surahNumber, verseNumber, btn) {
        const index = this.bookmarks.findIndex(b => b.surahNumber === surahNumber && b.verseNumber === verseNumber);

        if (index > -1) {
            this.bookmarks.splice(index, 1);
            btn.classList.remove('active');
            btn.querySelector('svg').classList.remove('text-amber-500', 'fill-current');
            btn.querySelector('svg').classList.add('text-slate-400');
        } else {
            this.bookmarks.push({
                surahNumber,
                verseNumber,
                timestamp: Date.now(),
                surahName: this.surahs.find(s => s.id === surahNumber)?.name_simple || ''
            });
            btn.classList.add('active', 'bookmark-sparkle');
            btn.querySelector('svg').classList.add('text-amber-500', 'fill-current');
            btn.querySelector('svg').classList.remove('text-slate-400');
            setTimeout(() => btn.classList.remove('bookmark-sparkle'), 400);
        }

        localStorage.setItem('quran-bookmarks', JSON.stringify(this.bookmarks));
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            if (show) overlay.classList.remove('hidden');
            else overlay.classList.add('hidden');
        }
    }
}

const app = new QuranApp();

if (localStorage.getItem('quran-dark-mode') === 'true') {
    document.body.classList.add('dark-mode');
}
