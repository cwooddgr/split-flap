// Clack sound for the web display. A port of FlipSoundPlayer in the tvOS app
// (SoundEffects.swift): the same 12 recorded clacks (CC0, Freesound #261244),
// a few of them per animation tick chosen at random with random gain and
// timing, so a 60 ms tick reads as clatter and not as a hum.

// clacks.wav is the 12 tvOS samples end to end, 3527 frames each at 44.1 kHz.
const CLIP_COUNT = 12;
const SPRITE_URL = new URL('./clacks.wav', import.meta.url);

class FlipSound {
    constructor() {
        this.clips = [];
        this.onStateChange = null;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            this.context = null;
            return;
        }
        this.context = new AudioContextClass();

        // Every clack goes through one gain and one compressor, so a busy
        // board gets denser without getting louder or clipping.
        this.master = this.context.createGain();
        this.master.gain.value = 0.8;
        const compressor = this.context.createDynamicsCompressor();
        this.master.connect(compressor);
        compressor.connect(this.context.destination);

        this.context.addEventListener('statechange', () => {
            if (this.onStateChange) this.onStateChange(this.needsGesture);
        });

        // Browsers keep the context suspended until the page gets a gesture.
        const resume = () => this.resume();
        for (const type of ['click', 'touchstart', 'keydown']) {
            document.addEventListener(type, resume, { passive: true });
        }

        this.load();
    }

    // True while the browser is waiting for a tap, click, or key press.
    get needsGesture() {
        return this.context !== null && this.context.state !== 'running';
    }

    resume() {
        if (this.needsGesture) {
            this.context.resume().catch(() => {});
        }
    }

    async load() {
        try {
            const response = await fetch(SPRITE_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const sprite = await this.context.decodeAudioData(await response.arrayBuffer());
            const frames = Math.floor(sprite.length / CLIP_COUNT);
            const samples = sprite.getChannelData(0);
            for (let i = 0; i < CLIP_COUNT; i++) {
                const clip = this.context.createBuffer(1, frames, sprite.sampleRate);
                clip.copyToChannel(samples.subarray(i * frames, (i + 1) * frames), 0);
                this.clips.push(clip);
            }
        } catch (error) {
            console.error('Clack samples failed to load, the board will be silent', error);
        }
    }

    // Play the clacks for one tick in which `activeTiles` tiles flipped. A real
    // board at full tilt is a texture, not one sound per tile: about one
    // audible clack per 6 tiles, never more than 5.
    play(activeTiles, tickSeconds) {
        if (activeTiles <= 0 || this.clips.length === 0 || this.needsGesture) return;

        const raw = activeTiles / 6 + (Math.random() * 1.5 - 0.75);
        const count = Math.min(Math.max(Math.round(raw), 1), 5);
        const now = this.context.currentTime;

        for (let i = 0; i < count; i++) {
            const source = this.context.createBufferSource();
            source.buffer = this.clips[Math.floor(Math.random() * this.clips.length)];
            const gain = this.context.createGain();
            gain.gain.value = 0.35 + Math.random() * 0.35;
            source.connect(gain);
            gain.connect(this.master);
            // Land somewhere inside the tick so no two ticks pulse in phase.
            source.start(now + Math.random() * tickSeconds);
        }
    }
}

export { FlipSound };
