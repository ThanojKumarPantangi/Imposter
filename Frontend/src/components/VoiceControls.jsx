import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import { useVoiceChat } from '../context/VoiceChatContext';

export function VoiceControls({ compact = false }) {
  const { micEnabled, speakerEnabled, toggleMicrophone, toggleSpeaker, voiceError } = useVoiceChat();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 bg-dark-900/90 border border-slate-800 p-1.5 rounded-xl backdrop-blur-md shadow-md">
        {/* Mic Button */}
        <button
          onClick={toggleMicrophone}
          title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone (Default OFF)'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
            micEnabled
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
          }`}
        >
          {micEnabled ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
          {!compact && <span>{micEnabled ? 'Mic ON' : 'Mic OFF'}</span>}
        </button>

        {/* Speaker Button */}
        <button
          onClick={toggleSpeaker}
          title={speakerEnabled ? 'Deafen Audio' : 'Undeafen Audio (Default ON)'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
            speakerEnabled
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/30'
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
          }`}
        >
          {speakerEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          {!compact && <span>{speakerEnabled ? 'Audio ON' : 'Deafened'}</span>}
        </button>
      </div>

      {voiceError && (
        <div className="flex items-center gap-1 text-[11px] text-rose-400 px-2 py-0.5 bg-rose-500/10 rounded">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>{voiceError}</span>
        </div>
      )}
    </div>
  );
}
