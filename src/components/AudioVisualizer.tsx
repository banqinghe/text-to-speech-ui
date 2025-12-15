import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
}

export default function AudioVisualizer({ audioElement, isPlaying }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    if (!audioElement) return;

    // Initialize Audio Context only once
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      // Connect audio element to analyser
      try {
        sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      } catch (e) {
        console.error("Error connecting audio source:", e);
      }
    }

    return () => {
      // Cleanup if needed, though usually we keep context alive for the session
    };
  }, [audioElement]);

  const draw = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    analyserRef.current.getByteFrequencyData(dataArray);

    ctx.fillStyle = 'rgb(255, 255, 255)'; // Clear with white (or background color)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i] / 2;

      // Use a gray/black gradient or solid color for bars
      ctx.fillStyle = `rgb(${50}, ${50}, ${50})`;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

      x += barWidth + 1;
    }

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(draw);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      // Resume context if suspended (browser policy)
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      draw();
    } else {
      cancelAnimationFrame(animationRef.current);
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={100} 
      className="w-full h-24 bg-gray-50 rounded-lg border border-gray-200"
    />
  );
}
