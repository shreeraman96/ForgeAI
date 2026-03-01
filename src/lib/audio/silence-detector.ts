export interface SilenceDetector {
  start(stream: MediaStream): void;
  stop(): void;
  /** Returns current RMS audio level (0–1) for UI visualization. */
  getLevel(): number;
  /** Called when silence exceeds the configured duration. */
  onSilence: (() => void) | null;
}

interface SilenceDetectorOptions {
  /** RMS threshold below which audio is considered silent. Default 0.01. */
  silenceThreshold?: number;
  /** Milliseconds of continuous silence before triggering onSilence. Default 1500. */
  silenceDuration?: number;
  /** Milliseconds between audio level polls. Default 100. */
  pollInterval?: number;
}

export function createSilenceDetector(
  options: SilenceDetectorOptions = {}
): SilenceDetector {
  const threshold = options.silenceThreshold ?? 0.01;
  const duration = options.silenceDuration ?? 1500;
  const interval = options.pollInterval ?? 100;

  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let silentSince: number | null = null;
  let currentLevel = 0;
  let triggered = false;

  const detector: SilenceDetector = {
    onSilence: null,

    start(stream: MediaStream) {
      this.stop();
      triggered = false;

      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // iOS Safari may suspend AudioContext created outside user gesture,
      // but start() is called from a user-initiated action so this should be fine.
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const dataArray = new Float32Array(analyser.frequencyBinCount);

      intervalId = setInterval(() => {
        if (!analyser || triggered) return;

        analyser.getFloatTimeDomainData(dataArray);

        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        currentLevel = Math.sqrt(sum / dataArray.length);

        if (currentLevel < threshold) {
          if (silentSince === null) {
            silentSince = Date.now();
          } else if (Date.now() - silentSince >= duration) {
            triggered = true;
            detector.onSilence?.();
          }
        } else {
          silentSince = null;
        }
      }, interval);
    },

    stop() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      source?.disconnect();
      source = null;
      analyser?.disconnect();
      analyser = null;
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch(() => {});
      }
      audioContext = null;
      silentSince = null;
      currentLevel = 0;
      triggered = false;
    },

    getLevel() {
      return currentLevel;
    },
  };

  return detector;
}
