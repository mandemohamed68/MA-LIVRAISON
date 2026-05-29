export const playNotificationSound = () => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    try {
        const ctx = new AudioContext();
        
        const playBeep = (time: number, freq: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
            
            osc.start(time);
            osc.stop(time + duration);
        };

        // Play a triple-beep sequence
        playBeep(ctx.currentTime, 880, 0.2);
        playBeep(ctx.currentTime + 0.25, 880, 0.2);
        playBeep(ctx.currentTime + 0.5, 1200, 0.4);
    } catch (e) {
        console.warn("Audio Context blocked or failed:", e);
    }
};
