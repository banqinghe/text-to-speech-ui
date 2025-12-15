import { useState, useRef, useEffect } from 'react';
import { generateSpeech } from './services/tts';
import { saveGeneration, getGenerations, type Generation } from './services/db';
import AudioVisualizer from './components/AudioVisualizer';

// Icons
const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
);
const PauseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
);
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
);
const LoaderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
);
const HistoryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 6v6l4 2"/></svg>
);

export default function App() {
  const [text, setText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Generation[]>([]);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const gens = await getGenerations();
      setHistory(gens);
    } catch (e) {
      console.error("Failed to load history", e);
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    if (!apiKey.trim()) {
      setError('Please enter your API Key');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAudioUrl(null); // Reset previous audio
    setAudioElement(null); // Reset audio element state

    try {
      const blob = await generateSpeech({ text, apiKey });
      await saveGeneration(text, blob);
      await loadHistory(); // Refresh history
      
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (err: any) {
      setError(err.message || 'Failed to generate speech');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHistorySelect = (item: Generation) => {
    setAudioUrl(null);
    setAudioElement(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    
    // Small timeout to allow cleanup
    setTimeout(() => {
      const url = URL.createObjectURL(item.blob);
      setAudioUrl(url);
      setText(item.text);
    }, 0);
  };

  const togglePlay = () => {
    if (!audioElement) return;
    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioElement) {
      setCurrentTime(audioElement.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioElement) {
      setDuration(audioElement.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioElement) {
      audioElement.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = audioUrl;
    a.download = 'speech.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-white text-gray-900 font-sans selection:bg-gray-200">
      {/* Left Column: Text Input */}
      <div className="w-full md:w-1/2 p-6 md:p-12 flex flex-col border-b md:border-b-0 md:border-r border-gray-100">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Text to Speech</h1>
          <p className="text-gray-500 mt-2 text-sm">Enter your text below to generate audio.</p>
        </header>
        
        <textarea
          className="flex-grow w-full resize-none outline-none text-lg md:text-xl leading-relaxed placeholder-gray-300 text-gray-800"
          placeholder="Type something wonderful here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* Right Column: Controls & Output */}
      <div className="w-full md:w-1/2 p-6 md:p-12 bg-gray-50 flex flex-col justify-center items-center relative">
        
        <div className="w-full max-w-md space-y-8">
          
          {/* API Key Input */}
          <div className="space-y-2">
            <label htmlFor="apiKey" className="block text-xs font-medium text-gray-500 uppercase tracking-wider">API Key</label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          {/* Generate Button */}
          {!audioUrl && !isLoading && (
            <button
              onClick={handleGenerate}
              disabled={!text.trim() || !apiKey.trim()}
              className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-4 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Generate Speech
            </button>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="text-gray-900 animate-spin">
                <LoaderIcon />
              </div>
              <p className="text-sm text-gray-500 animate-pulse">Synthesizing audio...</p>
            </div>
          )}

          {/* Audio Player */}
          {audioUrl && !isLoading && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Generated</span>
                 </div>
                 <button 
                   onClick={() => { setAudioUrl(null); setIsPlaying(false); }}
                   className="text-xs text-gray-400 hover:text-gray-600 underline"
                 >
                   Reset
                 </button>
              </div>

              <AudioVisualizer audioElement={audioElement} isPlaying={isPlaying} />

              <audio
                ref={setAudioElement}
                src={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                className="hidden"
              />

              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                />
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={togglePlay}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-md"
                >
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>

                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors text-sm font-medium"
                >
                  <DownloadIcon />
                  <span>Download</span>
                </button>
              </div>
            </div>
          )}

          {/* History List */}
          {history.length > 0 && !isLoading && (
            <div className="pt-8 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-4 text-gray-500">
                <HistoryIcon />
                <h3 className="text-sm font-medium uppercase tracking-wider">Recent History</h3>
              </div>
              <div className="space-y-3">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleHistorySelect(item)}
                    className="w-full text-left p-4 rounded-xl bg-white border border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all group"
                  >
                    <p className="text-sm text-gray-900 font-medium line-clamp-1 mb-1 group-hover:text-emerald-600 transition-colors">
                      {item.text}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
