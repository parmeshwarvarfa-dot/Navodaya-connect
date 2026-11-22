import { Platform } from "react-native";

export interface SpeechVoiceOption {
  name: string;
  lang: string;
  default?: boolean;
}

export interface AudioVisualizerLevels {
  volume: number; // 0 to 1
  bars: number[]; // 5 to 7 normalized frequency bands
}

// Clean markdown syntax so speech synthesis reads naturally like a human speaking
export function cleanTextForSpeech(text: string): string {
  if (!text) return "";
  return text
    .replace(/```[\s\S]*?```/g, "Code omitted.") // remove long code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // markdown links -> just label
    .replace(/[*_~#>-]/g, " ") // formatting characters
    .replace(/https?:\/\/\S+/g, "") // bare urls
    .replace(/\s+/g, " ")
    .trim();
}

class VoiceService {
  private recognitionInstance: any = null;
  private isRecognizing = false;
  private audioContext: any = null;
  private analyserNode: any = null;
  private mediaStream: any = null;
  private mediaRecorder: any = null;
  private recordedChunks: any[] = [];
  private animFrameId: any = null;

  // ── 1. SPEECH RECOGNITION (STT) ───────────────────────────────────────────

  public isSpeechRecognitionSupported(): boolean {
    if (Platform.OS !== "web") return false;
    if (typeof window === "undefined") return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public startListening(options: {
    lang?: "en-IN" | "en-US" | "hi-IN";
    continuous?: boolean;
    interimResults?: boolean;
    onStart?: () => void;
    onResult: (transcript: string, isFinal: boolean) => void;
    onError?: (err: string) => void;
    onEnd?: () => void;
  }): boolean {
    if (!this.isSpeechRecognitionSupported()) {
      options.onError?.("Speech recognition is not supported in this environment.");
      return false;
    }

    try {
      this.stopListening();

      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognitionClass();

      recognition.lang = options.lang || "en-IN";
      recognition.continuous = options.continuous ?? false;
      recognition.interimResults = options.interimResults ?? true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        this.isRecognizing = true;
        options.onStart?.();
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          const transcriptText = item[0]?.transcript || "";
          if (item.isFinal) {
            final += transcriptText;
          } else {
            interim += transcriptText;
          }
        }

        const combined = (final || interim).trim();
        if (combined) {
          options.onResult(combined, Boolean(final));
        }
      };

      recognition.onerror = (event: any) => {
        this.isRecognizing = false;
        const errType = event.error || "Speech recognition error";
        if (errType !== "no-speech" && errType !== "aborted") {
          options.onError?.(errType);
        }
      };

      recognition.onend = () => {
        this.isRecognizing = false;
        options.onEnd?.();
      };

      this.recognitionInstance = recognition;
      recognition.start();
      return true;
    } catch (err: any) {
      this.isRecognizing = false;
      options.onError?.(err?.message || "Failed to start microphone");
      return false;
    }
  }

  public stopListening(): void {
    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.stop();
        this.recognitionInstance.abort();
      } catch {}
      this.recognitionInstance = null;
    }
    this.isRecognizing = false;
  }

  // ── 2. SPEECH SYNTHESIS (TTS) & BARGE-IN ────────────────────────────────────

  public isSpeechSynthesisSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "speechSynthesis" in window;
  }

  public getAvailableVoices(): SpeechVoiceOption[] {
    if (!this.isSpeechSynthesisSupported()) return [];
    try {
      const voices = window.speechSynthesis.getVoices() || [];
      return voices.map((v) => ({
        name: v.name,
        lang: v.lang,
        default: v.default,
      }));
    } catch {
      return [];
    }
  }

  // Instant barge-in: cancel any speaking audio playback immediately
  public cancelSpeech(): void {
    if (this.isSpeechSynthesisSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  public speak(
    text: string,
    options?: {
      lang?: "en-IN" | "en-US" | "hi-IN";
      rate?: number;
      pitch?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    }
  ): void {
    if (!this.isSpeechSynthesisSupported()) {
      options?.onError?.("Speech synthesis not supported in this browser.");
      return;
    }

    // Cancel any previous speech before starting new speech
    this.cancelSpeech();

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) {
      options?.onEnd?.();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);

      // Auto-detect Hindi vs English if not specified
      const hasHindi = /[\u0900-\u097F]/.test(cleanText);
      const chosenLang = options?.lang || (hasHindi ? "hi-IN" : "en-IN");
      utterance.lang = chosenLang;
      utterance.rate = options?.rate ?? 1.0;
      utterance.pitch = options?.pitch ?? 1.0;

      // Select preferred regional voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const preferredVoice =
          voices.find((v) => v.lang === chosenLang) ||
          voices.find((v) => v.lang.startsWith(chosenLang.split("-")[0])) ||
          null;
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      utterance.onstart = () => {
        options?.onStart?.();
      };

      utterance.onend = () => {
        options?.onEnd?.();
      };

      utterance.onerror = (e) => {
        if (e.error !== "canceled" && e.error !== "interrupted") {
          options?.onError?.(e);
        } else {
          options?.onEnd?.();
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      options?.onError?.(err);
    }
  }

  // ── 3. AUDIO VISUALIZER & MEDIA RECORDER ───────────────────────────────────

  public async startAudioVisualizer(
    onLevels: (levels: AudioVisualizerLevels) => void
  ): Promise<boolean> {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      this.stopAudioVisualizer();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;

      const AudioContextClass =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      this.audioContext = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      this.analyserNode = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const render = () => {
        if (!this.analyserNode) return;
        this.analyserNode.getByteFrequencyData(dataArray);

        let sum = 0;
        const bars: number[] = [];
        const step = Math.floor(dataArray.length / 5);

        for (let i = 0; i < 5; i++) {
          const val = dataArray[i * step] / 255;
          bars.push(val);
          sum += val;
        }

        const volume = Math.min(1, sum / 5);
        onLevels({ volume, bars });
        this.animFrameId = requestAnimationFrame(render);
      };

      render();
      return true;
    } catch {
      return false;
    }
  }

  public stopAudioVisualizer(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.analyserNode) {
      this.analyserNode = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track: any) => track.stop());
      } catch {}
      this.mediaStream = null;
    }
  }

  // Record voice message as base64 audio
  public async startRecordingVoiceMessage(): Promise<boolean> {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      this.recordedChunks = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;

      const mimeType = (window as any).MediaRecorder?.isTypeSupported?.("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : (window as any).MediaRecorder?.isTypeSupported?.("audio/mp4")
        ? "audio/mp4"
        : "audio/webm";

      const recorder = new (window as any).MediaRecorder(stream, { mimeType });
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      recorder.start(100);
      return true;
    } catch {
      return false;
    }
  }

  public async stopRecordingVoiceMessage(): Promise<{ base64: string; mimeType: string } | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder.mimeType || "audio/webm",
          });

          // Stop all stream tracks
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track: any) => track.stop());
            this.mediaStream = null;
          }

          // Convert blob to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1] || "";
            resolve({
              base64,
              mimeType: blob.type,
            });
          };
          reader.readAsDataURL(blob);
        } catch {
          resolve(null);
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        resolve(null);
      }
    });
  }

  public cancelRecordingVoiceMessage(): void {
    if (this.mediaRecorder) {
      try {
        this.mediaRecorder.stop();
      } catch {}
      this.mediaRecorder = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track: any) => track.stop());
      } catch {}
      this.mediaStream = null;
    }
    this.recordedChunks = [];
  }
}

export const voiceService = new VoiceService();
