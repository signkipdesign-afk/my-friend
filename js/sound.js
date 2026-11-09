// Sound synthesizer using Web Audio API (No external audio files needed)
class SoundEffects {
    constructor() {
        this.audioCtx = null;
        this.ringingInterval = null;
        this.callingInterval = null;
    }

    init() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    // Play a dual tone for incoming ringtone
    playIncomingRing() {
        this.init();
        this.stopAll();

        const playBurst = () => {
            if (!this.audioCtx) return;
            try {
                const now = this.audioCtx.currentTime;
                
                // First tone (520Hz)
                const osc1 = this.audioCtx.createOscillator();
                const gain1 = this.audioCtx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(520, now);
                gain1.gain.setValueAtTime(0.15, now);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
                osc1.connect(gain1);
                gain1.connect(this.audioCtx.destination);
                osc1.start(now);
                osc1.stop(now + 1.2);

                // Second harmonic tone (680Hz)
                const osc2 = this.audioCtx.createOscillator();
                const gain2 = this.audioCtx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(680, now);
                gain2.gain.setValueAtTime(0.12, now);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
                osc2.connect(gain2);
                gain2.connect(this.audioCtx.destination);
                osc2.start(now);
                osc2.stop(now + 1.2);
            } catch (e) {
                console.error("Ring sound error:", e);
            }
        };

        playBurst();
        this.ringingInterval = setInterval(playBurst, 2500);
    }

    // Play outgoing dial/calling tone (standard beep... beep...)
    playOutgoingRing() {
        this.init();
        this.stopAll();

        const playTone = () => {
            if (!this.audioCtx) return;
            try {
                const now = this.audioCtx.currentTime;
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now); // standard A4
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.setValueAtTime(0.12, now + 1.0);
                gain.gain.linearRampToValueAtTime(0.0001, now + 1.05);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now);
                osc.stop(now + 1.1);
            } catch (e) {
                console.error("Calling tone error:", e);
            }
        };

        playTone();
        this.callingInterval = setInterval(playTone, 3000);
    }

    // Play short cheerful chime when call connects
    playConnectedSound() {
        this.init();
        this.stopAll();
        try {
            const now = this.audioCtx.currentTime;
            [523.25, 659.25, 783.99].forEach((freq, idx) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + idx * 0.12);
                gain.gain.setValueAtTime(0.15, now + idx * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now + idx * 0.12);
                osc.stop(now + idx * 0.12 + 0.35);
            });
        } catch (e) {
            console.error("Connect sound error:", e);
        }
    }

    // Play call hangup / decline sound
    playEndSound() {
        this.init();
        this.stopAll();
        try {
            const now = this.audioCtx.currentTime;
            [400, 300].forEach((freq, idx) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.15);
                gain.gain.setValueAtTime(0.18, now + idx * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.18);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now + idx * 0.15);
                osc.stop(now + idx * 0.15 + 0.18);
            });
        } catch (e) {
            console.error("End sound error:", e);
        }
    }

    stopAll() {
        if (this.ringingInterval) {
            clearInterval(this.ringingInterval);
            this.ringingInterval = null;
        }
        if (this.callingInterval) {
            clearInterval(this.callingInterval);
            this.callingInterval = null;
        }
    }
}

window.soundEffects = new SoundEffects();
