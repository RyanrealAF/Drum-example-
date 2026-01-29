
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DrumHit, ProcessingState } from './types';
import { analyzeDrumStem } from './services/gemini';
import DrumOrb from './components/DrumOrb';
import * as MidiWriter from 'midi-writer-js';

const App: React.FC = () => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [hits, setHits] = useState<DrumHit[]>([]);
  const [processState, setProcessState] = useState<ProcessingState>({ status: 'idle' });
  const [lastHitTimes, setLastHitTimes] = useState({ kick: 0, snare: 0, hihat: 0 });
  const [velocities, setVelocities] = useState({ kick: 0, snare: 0, hihat: 0 });
  
  const firedHitsRef = useRef<Set<number>>(new Set());
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);
  const hitsRef = useRef<DrumHit[]>([]);

  // Update hitsRef whenever hits state changes to keep callback fresh
  useEffect(() => {
    hitsRef.current = hits;
  }, [hits]);

  const cleanDetections = (rawHits: DrumHit[]): DrumHit[] => {
    if (!rawHits || rawHits.length === 0) return [];
    const sorted = [...rawHits].sort((a, b) => a.time - b.time);
    const cleaned: DrumHit[] = [];
    const DEBOUNCE_THRESHOLD = 0.035;

    sorted.forEach(hit => {
      const isDuplicate = cleaned.some(c => 
        c.type === hit.type && 
        Math.abs(c.time - hit.time) < DEBOUNCE_THRESHOLD
      );

      if (!isDuplicate) {
        cleaned.push({
          ...hit,
          velocity: Math.max(0.1, Math.min(1.0, hit.velocity))
        });
      }
    });
    return cleaned;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset previous state
    firedHitsRef.current.clear();
    setHits([]);
    
    // Set audio immediately so user can hear it
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setProcessState({ status: 'analyzing', message: 'Analyzing Audio Transients...' });

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const rawHits = await analyzeDrumStem(base64, file.type);
        const cleaned = cleanDetections(rawHits);
        setHits(cleaned);
        setProcessState({ status: 'ready' });
      };
    } catch (err: any) {
      setProcessState({ status: 'error', message: err.message || 'Analysis failed.' });
    }
  };

  const downloadMidi = () => {
    if (hits.length === 0) return;
    const track = new (MidiWriter.Track as any)();
    track.setTimeSignature(4, 4);
    const MIDI_KICK = 'C1';    
    const MIDI_SNARE = 'D1';   
    const MIDI_HIHAT = 'F#1';  
    track.addTrackName('DrumVision Clean Export');

    hits.forEach((hit) => {
      let pitch = MIDI_KICK;
      if (hit.type === 'snare') pitch = MIDI_SNARE;
      if (hit.type === 'hihat') pitch = MIDI_HIHAT;
      const startTick = Math.round((hit.time * 120 * 128) / 60);
      track.addEvent(new (MidiWriter.NoteEvent as any)({
        pitch: [pitch],
        duration: 't64',
        startTick: startTick,
        velocity: Math.floor(hit.velocity * 127)
      }));
    });

    const write = new (MidiWriter.Writer as any)(track);
    const blob = new Blob([write.buildFile()], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `drums_${Date.now()}.mid`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const updateVisuals = useCallback(() => {
    if (!audioRef.current) {
      rafRef.current = requestAnimationFrame(updateVisuals);
      return;
    }
    
    const time = audioRef.current.currentTime;
    
    // Auto-reset fired hits if audio loops or restarts
    if (time < 0.1 && firedHitsRef.current.size > (hitsRef.current.length / 2)) {
      firedHitsRef.current.clear();
    }

    // Trigger hits that have passed but haven't fired yet
    const currentHitsToFire: DrumHit[] = [];
    hitsRef.current.forEach((h, idx) => {
      // Small lookahead/behind to ensure we don't skip hits due to frame timing
      if (h.time <= time && !firedHitsRef.current.has(idx)) {
        firedHitsRef.current.add(idx);
        currentHitsToFire.push(h);
      }
    });

    if (currentHitsToFire.length > 0) {
      setLastHitTimes(prev => {
        const next = { ...prev };
        currentHitsToFire.forEach(h => {
          next[h.type] = performance.now();
        });
        return next;
      });
      
      setVelocities(prev => {
        const next = { ...prev };
        currentHitsToFire.forEach(h => {
          next[h.type] = h.velocity;
        });
        return next;
      });
    }

    rafRef.current = requestAnimationFrame(updateVisuals);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(updateVisuals);
    return () => cancelAnimationFrame(rafRef.current);
  }, [updateVisuals]);

  return (
    <div className="relative w-full h-screen bg-slate-50 flex flex-col items-center justify-center overflow-hidden">
      {/* Header UI */}
      <div className="absolute top-8 left-8 z-50">
        <h1 className="text-2xl font-light tracking-tighter text-slate-800">DRUM<span className="font-semibold text-cyan-600">VISION</span></h1>
        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-[0.2em]">High-Fidelity AI Transcription</p>
      </div>

      {/* Control Panel */}
      <div className="absolute bottom-8 z-50 bg-white/95 backdrop-blur-2xl px-10 py-5 rounded-full border border-slate-200 shadow-2xl flex items-center gap-8 transition-all">
        <div className="flex items-center gap-4">
          <input 
            type="file" 
            accept="audio/*" 
            onChange={handleFileUpload} 
            className="hidden" 
            id="audio-upload"
          />
          <label 
            htmlFor="audio-upload"
            className={`cursor-pointer px-8 py-3 rounded-full text-xs uppercase tracking-widest font-bold transition-all shadow-md ${
              processState.status === 'analyzing' 
              ? 'bg-slate-200 text-slate-400' 
              : 'bg-slate-900 text-white hover:bg-slate-800 hover:scale-[1.02]'
            }`}
          >
            {processState.status === 'analyzing' ? 'Processing...' : 'Load Drum Stem'}
          </label>

          {processState.status === 'ready' && hits.length > 0 && (
            <button 
              onClick={downloadMidi}
              className="bg-cyan-500 text-white px-8 py-3 rounded-full text-xs uppercase tracking-widest font-bold hover:bg-cyan-600 hover:scale-[1.02] active:scale-95 transition-all shadow-md flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export MIDI
            </button>
          )}
        </div>

        {audioUrl && (
          <>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-4">
              <audio 
                ref={audioRef}
                src={audioUrl} 
                controls 
                className="h-10 w-56 opacity-90 contrast-75 brightness-110"
              />
              {processState.status === 'analyzing' && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-500 rounded-full animate-ping" />
                  <span className="text-[10px] text-cyan-600 font-bold uppercase tracking-widest">Cleaning MIDI...</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Error Message */}
      {processState.status === 'error' && (
        <div className="absolute top-24 px-6 py-3 bg-red-50 border border-red-200 rounded-full text-red-600 text-sm font-medium z-50 shadow-sm animate-bounce">
          {processState.message}
        </div>
      )}

      {/* Visualization Stage */}
      <div className="relative w-full h-full max-w-6xl flex items-center justify-center pointer-events-none">
        <DrumOrb 
          label="Hi-Hat" 
          position="top" 
          lastHitTime={lastHitTimes.hihat} 
          velocity={velocities.hihat} 
        />
        <DrumOrb 
          label="Kick" 
          position="left" 
          lastHitTime={lastHitTimes.kick} 
          velocity={velocities.kick} 
        />
        <DrumOrb 
          label="Snare" 
          position="right" 
          lastHitTime={lastHitTimes.snare} 
          velocity={velocities.snare} 
        />
        <div className="absolute inset-x-20 bottom-[45%] h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent z-0 opacity-50" />
      </div>

      {/* Status Bar */}
      {hits.length > 0 && (
        <div className="absolute top-8 right-8 text-right font-mono text-[10px] text-slate-400">
          DETECTION COUNT: {hits.length}<br/>
          PIPELINE: {processState.status === 'ready' ? 'READY' : 'PROCESSING'}
        </div>
      )}

      {/* Background Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <div className="grid grid-cols-24 h-full w-full">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="border-r border-slate-900" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
