"use client";

import { useCallback, useRef, useState } from "react";

interface CapturedFrame {
  base64: string;
  mimeType: string;
}

interface UseCameraStreamReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  start: () => Promise<void>;
  stop: () => void;
  captureFrame: () => CapturedFrame | null;
}

const MAX_WIDTH = 640;
const MAX_HEIGHT = 480;
const JPEG_QUALITY = 0.7;

export function useCameraStream(): UseCameraStreamReturn {
  const [isActive, setIsActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: MAX_WIDTH }, height: { ideal: MAX_HEIGHT } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsActive(true);
    } catch (err) {
      console.warn("Camera access failed:", err);
      // Don't toast here — camera is optional; voice still works without it
      setIsActive(false);
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
  }, []);

  const captureFrame = useCallback((): CapturedFrame | null => {
    const video = videoRef.current;
    if (!video || !streamRef.current || video.readyState < 2) return null;

    // Lazily create canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;

    // Scale down if video is larger than max dimensions
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
      const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    // Strip "data:image/jpeg;base64," prefix
    const base64 = dataUrl.split(",")[1];
    if (!base64) return null;

    return { base64, mimeType: "image/jpeg" };
  }, []);

  return { videoRef, isActive, start, stop, captureFrame };
}
