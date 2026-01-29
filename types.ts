
export type DrumType = 'kick' | 'snare' | 'hihat';

export interface DrumHit {
  time: number;
  type: DrumType;
  velocity: number;
}

export interface ProcessingState {
  status: 'idle' | 'analyzing' | 'ready' | 'error';
  message?: string;
}
