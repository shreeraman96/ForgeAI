import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock: SpeechSynthesisUtterance
// ---------------------------------------------------------------------------

class MockSpeechSynthesisUtterance {
  text: string;
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  pitch = 1;
  volume = 1;

  onstart: ((ev: Event) => void) | null = null;
  onend: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onpause: ((ev: Event) => void) | null = null;
  onresume: ((ev: Event) => void) | null = null;

  constructor(text = "") {
    this.text = text;
  }

  // Helpers for tests to trigger lifecycle events
  _fireStart() {
    this.onstart?.(new Event("start"));
  }
  _fireEnd() {
    this.onend?.(new Event("end"));
  }
  _fireError() {
    this.onerror?.(new Event("error"));
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return false;
  }
}

// @ts-expect-error — replacing global for tests
globalThis.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

// ---------------------------------------------------------------------------
// Mock: speechSynthesis
// ---------------------------------------------------------------------------

const mockSpeechSynthesis = {
  speak: vi.fn((utterance: MockSpeechSynthesisUtterance) => {
    // Simulate async start
    setTimeout(() => utterance._fireStart(), 0);
  }),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => [
    {
      name: "Test English Voice",
      lang: "en-US",
      default: true,
      localService: true,
      voiceURI: "test",
    },
  ] as unknown as SpeechSynthesisVoice[]),
  speaking: false,
  paused: false,
  pending: false,
  onvoiceschanged: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
};

Object.defineProperty(window, "speechSynthesis", {
  value: mockSpeechSynthesis,
  writable: true,
  configurable: true,
});

// ---------------------------------------------------------------------------
// Mock: SpeechRecognition / webkitSpeechRecognition
// ---------------------------------------------------------------------------

// Store the latest recognition instance so tests can simulate events
export let lastRecognitionInstance: MockSpeechRecognition | null = null;

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";

  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;

  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastRecognitionInstance = this;
  }

  // Helper: simulate a speech result
  _simulateResult(transcript: string) {
    this.onresult?.({
      results: [[{ transcript }]],
      resultIndex: 0,
      get length() {
        return 1;
      },
    });
  }

  // Helper: simulate an error
  _simulateError(error: string) {
    this.onerror?.({ error });
  }

  // Helper: simulate recognition ending
  _simulateEnd() {
    this.onend?.();
  }
}

// @ts-expect-error — replacing global for tests
globalThis.SpeechRecognition = MockSpeechRecognition;
// @ts-expect-error — replacing global for tests
globalThis.webkitSpeechRecognition = MockSpeechRecognition;

// Also set on window for components that check `window.SpeechRecognition`
// @ts-expect-error — replacing global for tests
window.SpeechRecognition = MockSpeechRecognition;
// @ts-expect-error — replacing global for tests
window.webkitSpeechRecognition = MockSpeechRecognition;

// ---------------------------------------------------------------------------
// Mock: MediaRecorder (used by VoiceRecorder and voice conversation)
// ---------------------------------------------------------------------------

class MockMediaRecorder {
  state: "inactive" | "recording" | "paused" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start = vi.fn(() => {
    this.state = "recording";
  });
  stop = vi.fn(() => {
    this.state = "inactive";
    // Simulate a data chunk
    this.ondataavailable?.({ data: new Blob(["audio-data"], { type: "audio/webm" }) });
    setTimeout(() => this.onstop?.(), 0);
  });
  pause = vi.fn();
  resume = vi.fn();

  static isTypeSupported = vi.fn(() => true);
}

// @ts-expect-error — replacing global for tests
globalThis.MediaRecorder = MockMediaRecorder;

// ---------------------------------------------------------------------------
// Mock: AudioContext + AnalyserNode (used by silence detector)
// ---------------------------------------------------------------------------

class MockAnalyserNode {
  fftSize = 512;
  frequencyBinCount = 256;
  getFloatTimeDomainData = vi.fn((arr: Float32Array) => {
    arr.fill(0);
  });
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  state: "running" | "suspended" | "closed" = "running";
  createAnalyser = vi.fn(() => new MockAnalyserNode());
  createMediaStreamSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => {
    this.state = "closed";
    return Promise.resolve();
  });
}

// @ts-expect-error — replacing global for tests
globalThis.AudioContext = MockAudioContext;

// ---------------------------------------------------------------------------
// Mock: navigator.mediaDevices.getUserMedia
// ---------------------------------------------------------------------------

if (!navigator.mediaDevices) {
  Object.defineProperty(navigator, "mediaDevices", {
    value: {},
    writable: true,
    configurable: true,
  });
}

Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
  value: vi.fn(() =>
    Promise.resolve({
      getTracks: () => [{ stop: vi.fn() }],
    })
  ),
  writable: true,
  configurable: true,
});

// ---------------------------------------------------------------------------
// Mock: sonner toast (used by StepVoiceCommands and voice conversation)
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  lastRecognitionInstance = null;
});
