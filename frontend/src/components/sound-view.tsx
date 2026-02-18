import { useState } from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import {
  Volume2,
  Mic,
  Play,
  Music,
  RefreshCw,
  Cable,
  Plus,
  Trash2,
  Library,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  CheckCircle2,
  Circle,
} from "lucide-react";
import type { AudioConfig, AudioDeviceList, SoundEntry } from "@/lib/tauri";
import { SoundUploadDialog } from "@/components/sound-upload-dialog";

/**
 * Maps visual grid position to hardware index.
 * Top row: left-to-right = 0,1,2,3
 * Bottom row: left-to-right = 7,6,5,4 (firmware scans right-to-left)
 */
const DISPLAY_ORDER = [0, 1, 2, 3, 7, 6, 5, 4];

interface SoundViewProps {
  audioConfig: AudioConfig;
  audioDevices: AudioDeviceList;
  onSelectInput: (name: string) => void;
  onSelectOutput: (name: string) => void;
  onSoundVolumeChange: (vol: number) => void;
  onMicVolumeChange: (vol: number) => void;
  onRefreshDevices: () => void;
  onGetDuration: (filePath: string) => Promise<number>;
  onPreviewTrim: (sourcePath: string, startMs: number, endMs: number) => void;
  onAddToLibrary: (filePath: string, displayName: string) => Promise<SoundEntry | null>;
  onAddToLibraryTrimmed: (filePath: string, displayName: string, startMs: number, endMs: number) => Promise<SoundEntry | null>;
  onRemoveFromLibrary: (soundId: string) => void;
  onRenameSound: (soundId: string, newName: string) => void;
  onSetKeySound: (keyIndex: number, soundId: string | null) => void;
  onPreviewLibrarySound: (soundId: string) => void;
}

export function SoundView({
  audioConfig,
  audioDevices,
  onSelectInput,
  onSelectOutput,
  onSoundVolumeChange,
  onMicVolumeChange,
  onRefreshDevices,
  onGetDuration,
  onPreviewTrim,
  onAddToLibrary,
  onAddToLibraryTrimmed,
  onRemoveFromLibrary,
  onSetKeySound,
  onPreviewLibrarySound,
}: SoundViewProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [keyDropdown, setKeyDropdown] = useState<number | null>(null);

  const getSoundName = (soundId: string | null): string | null => {
    if (!soundId) return null;
    const entry = audioConfig.sound_library.find((e) => e.id === soundId);
    return entry?.display_name ?? null;
  };

  const hasVirtualCable = audioDevices.output_devices.some(
    (d) =>
      d.name.toLowerCase().includes("cable") ||
      d.name.toLowerCase().includes("blackhole") ||
      d.name.toLowerCase().includes("virtual"),
  );

  const hasInputSelected = !!audioConfig.audio_input_device;
  const hasOutputSelected = !!audioConfig.audio_output_device;
  const isOutputVirtualCable = hasOutputSelected && (() => {
    const name = (audioConfig.audio_output_device ?? "").toLowerCase();
    return name.includes("cable") || name.includes("blackhole") || name.includes("virtual");
  })();
  const pipelineReady = hasVirtualCable && hasInputSelected && isOutputVirtualCable;

  const [guideOpen, setGuideOpen] = useState(!pipelineReady);

  const steps = [
    {
      done: hasVirtualCable,
      text: "Instalá un cable de audio virtual",
      detail: "Windows: VB-Cable / macOS: BlackHole 2ch",
    },
    {
      done: hasInputSelected,
      text: "Seleccioná tu micrófono como Input",
      detail: "El micrófono que usás para hablar (ej: HyperX, Blue Yeti)",
    },
    {
      done: isOutputVirtualCable,
      text: "Seleccioná el cable virtual como Output",
      detail: "Elegí \"CABLE Input\" (VB-Cable) o \"BlackHole 2ch\" (macOS)",
    },
    {
      done: false, // Can't auto-detect Discord settings
      text: "En Discord: Dispositivo de entrada → \"CABLE Output\"",
      detail: "Ajustes → Voz y vídeo → Dispositivo de entrada",
    },
    {
      done: false,
      text: "En Discord: Desactivar sensibilidad automática",
      detail: "Desactivá \"Ajustar automáticamente la sensibilidad\" y poné el slider manual bajo",
    },
  ];

  const completedSteps = steps.filter((s) => s.done).length;

  return (
    <div className="flex flex-1 min-h-0 flex-col items-center overflow-y-auto py-4">
      <div className="animate-fade-in w-full max-w-md flex flex-col">
        {/* ── Header ─────────────────────────────── */}
        <div className="px-5 py-3 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-cyan-400/70" />
            <span className="font-pixel text-[11px] text-white/70 font-bold uppercase tracking-wider">
              Soundboard
            </span>
            {audioConfig.soundboard_enabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 animate-pulse-subtle" />
            )}
          </div>
        </div>

        {/* ── Setup Guide ──────────────────────────── */}
        <div className="px-5 pb-2">
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-all",
              "hover:bg-white/[0.03]",
              pipelineReady
                ? "bg-emerald-500/[0.04] border border-emerald-500/10"
                : "bg-cyan-500/[0.04] border border-cyan-500/10",
            )}
            onClick={() => setGuideOpen(!guideOpen)}
          >
            <HelpCircle className={cn("w-3.5 h-3.5 flex-shrink-0", pipelineReady ? "text-emerald-400/60" : "text-cyan-400/60")} />
            <span className="font-clean text-[10px] text-white/60 flex-1 text-left">
              {pipelineReady ? "Pipeline configurado" : `Configuración (${completedSteps}/${steps.length})`}
            </span>
            {guideOpen ? (
              <ChevronDown className="w-3 h-3 text-white/25" />
            ) : (
              <ChevronRight className="w-3 h-3 text-white/25" />
            )}
          </button>

          {guideOpen && (
            <div className="mt-2 flex flex-col gap-1.5 pl-1">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  {step.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/70 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-white/15 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className={cn(
                      "font-clean text-[10px] leading-tight",
                      step.done ? "text-white/40 line-through" : "text-white/60",
                    )}>
                      {i + 1}. {step.text}
                    </span>
                    <span className="font-clean text-[9px] text-white/25 leading-tight">
                      {step.detail}
                    </span>
                  </div>
                </div>
              ))}

              {!hasVirtualCable && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 mt-1 rounded-lg bg-amber-500/[0.06] border border-amber-500/15">
                  <Cable className="w-3.5 h-3.5 text-amber-400/60 mt-0.5 flex-shrink-0" />
                  <div className="font-clean text-[9px] text-amber-300/50 leading-relaxed">
                    No se detectó un cable virtual. Instalá{" "}
                    <span className="text-amber-300/70">VB-Cable</span> (Windows) o{" "}
                    <span className="text-amber-300/70">BlackHole</span> (macOS).
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Device Selection ─────────────────────────────── */}
        <div className="px-5 py-2 flex flex-col gap-2.5">
          {/* Input device */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Mic className="w-3 h-3 text-white/20" />
              <span className="font-pixel text-[9px] text-white/40 uppercase tracking-wider">
                Input (Microphone)
              </span>
              <button
                type="button"
                className="ml-auto text-white/20 hover:text-white/40 transition-colors"
                onClick={onRefreshDevices}
                title="Refresh devices"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
            <select
              className={cn(
                "w-full px-2.5 py-1.5 rounded-lg text-[10px] font-clean",
                "bg-[#0d0d0f] border border-white/[0.08] text-white/60",
                "focus:outline-none focus:border-cyan-500/30",
                "appearance-none cursor-pointer",
              )}
              value={audioConfig.audio_input_device ?? ""}
              onChange={(e) => onSelectInput(e.target.value)}
            >
              <option value="" disabled>
                Select microphone...
              </option>
              {audioDevices.input_devices.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Output device */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3 h-3 text-white/20" />
              <span className="font-pixel text-[9px] text-white/40 uppercase tracking-wider">
                Output (Virtual Cable)
              </span>
            </div>
            <select
              className={cn(
                "w-full px-2.5 py-1.5 rounded-lg text-[10px] font-clean",
                "bg-[#0d0d0f] border border-white/[0.08] text-white/60",
                "focus:outline-none focus:border-cyan-500/30",
                "appearance-none cursor-pointer",
              )}
              value={audioConfig.audio_output_device ?? ""}
              onChange={(e) => onSelectOutput(e.target.value)}
            >
              <option value="" disabled>
                Select output device...
              </option>
              {audioDevices.output_devices.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Volume Sliders ──────────────────────────────── */}
        <div className="px-5 py-2 flex flex-col gap-2.5">
          {/* Sound volume */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Music className="w-3 h-3 text-white/20" />
              <span className="font-pixel text-[9px] text-white/40 uppercase tracking-wider">
                Sound Volume
              </span>
              <span className="font-clean text-[10px] text-white/50 tabular-nums ml-auto">
                {Math.round(audioConfig.sound_volume * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[audioConfig.sound_volume]}
              onValueChange={([v]) => onSoundVolumeChange(v)}
            />
          </div>

          {/* Mic volume */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Mic className="w-3 h-3 text-white/20" />
              <span className="font-pixel text-[9px] text-white/40 uppercase tracking-wider">
                Mic Volume
              </span>
              <span className="font-clean text-[10px] text-white/50 tabular-nums ml-auto">
                {Math.round(audioConfig.mic_volume * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[audioConfig.mic_volume]}
              onValueChange={([v]) => onMicVolumeChange(v)}
            />
          </div>
        </div>

        <div className="px-5">
          <div className="border-b border-white/[0.06]" />
        </div>

        {/* ── Sound Library ────────────────────────────────── */}
        <div className="px-5 py-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Library className="w-3.5 h-3.5 text-violet-400/60" />
            <span className="font-pixel text-[11px] text-white/70 font-bold uppercase tracking-wider">
              Sound Library
            </span>
            <span className="font-clean text-[10px] text-white/25 ml-auto">
              {audioConfig.sound_library.length} sound{audioConfig.sound_library.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Library list */}
          {audioConfig.sound_library.length > 0 && (
            <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto">
              {audioConfig.sound_library.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors group"
                >
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-white/10 text-white/25 hover:text-emerald-400/80 transition-colors flex-shrink-0"
                    onClick={() => onPreviewLibrarySound(entry.id)}
                    title="Preview"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                  <span className="font-clean text-[10px] text-white/60 truncate flex-1">
                    {entry.display_name}
                  </span>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-white/10 text-white/15 hover:text-red-400/70 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                    onClick={() => onRemoveFromLibrary(entry.id)}
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add sound button → opens upload dialog */}
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg",
              "bg-white/[0.03] border border-dashed border-white/[0.10] text-white/35",
              "hover:bg-white/[0.06] hover:text-white/55 hover:border-white/15 transition-all",
              "font-clean text-[10px]",
            )}
            onClick={() => setUploadOpen(true)}
          >
            <Plus className="w-3 h-3" />
            Add Sound
          </button>
        </div>

        <div className="px-5">
          <div className="border-b border-white/[0.06]" />
        </div>

        {/* ── Key Assignments ──────────────────────────────── */}
        <div className="px-5 py-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Music className="w-3.5 h-3.5 text-cyan-400/50" />
            <span className="font-pixel text-[11px] text-white/70 font-bold uppercase tracking-wider">
              Key Assignments
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2" style={{ width: "100%" }}>
            {DISPLAY_ORDER.map((hwIndex) => {
              const soundId = audioConfig.key_sounds[hwIndex];
              const soundName = getSoundName(soundId);
              const isDropdownOpen = keyDropdown === hwIndex;

              return (
                <div key={hwIndex} className="relative">
                  <button
                    type="button"
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-1 w-full",
                      "rounded-lg border transition-all duration-150 min-h-[72px] p-2",
                      soundName
                        ? "border-cyan-500/20 bg-cyan-500/[0.04] hover:bg-cyan-500/[0.08]"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10",
                    )}
                    onClick={() => setKeyDropdown(isDropdownOpen ? null : hwIndex)}
                    title={soundName ? `Assigned: ${soundName}` : "Click to assign sound"}
                  >
                    {/* Key number badge */}
                    <span className="absolute top-1 left-1.5 font-pixel text-[7px] text-white/20">
                      {hwIndex + 1}
                    </span>

                    {soundName ? (
                      <>
                        <Music className="w-3.5 h-3.5 text-cyan-400/60" />
                        <span className="font-clean text-[9px] text-cyan-300/50 truncate w-full text-center leading-tight">
                          {soundName}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded-md border border-dashed border-white/10 flex items-center justify-center">
                          <Music className="w-3 h-3 text-white/15" />
                        </div>
                        <span className="font-pixel text-[7px] text-white/20">
                          empty
                        </span>
                      </>
                    )}
                  </button>

                  {/* Dropdown for sound selection */}
                  {isDropdownOpen && (
                    <div className="absolute z-20 top-full left-0 mt-1 w-40 max-h-[160px] overflow-y-auto rounded-lg bg-[#111113] border border-white/10 shadow-xl">
                      {/* None option */}
                      <button
                        type="button"
                        className={cn(
                          "w-full px-2.5 py-1.5 text-left font-clean text-[10px] transition-colors",
                          !soundId
                            ? "text-white/50 bg-white/[0.06]"
                            : "text-white/30 hover:bg-white/[0.04] hover:text-white/50",
                        )}
                        onClick={() => {
                          onSetKeySound(hwIndex, null);
                          setKeyDropdown(null);
                        }}
                      >
                        None
                      </button>
                      {audioConfig.sound_library.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className={cn(
                            "w-full px-2.5 py-1.5 text-left font-clean text-[10px] transition-colors truncate",
                            soundId === entry.id
                              ? "text-cyan-300/80 bg-cyan-500/[0.08]"
                              : "text-white/50 hover:bg-white/[0.04] hover:text-white/70",
                          )}
                          onClick={() => {
                            onSetKeySound(hwIndex, entry.id);
                            setKeyDropdown(null);
                          }}
                        >
                          {entry.display_name}
                        </button>
                      ))}
                      {audioConfig.sound_library.length === 0 && (
                        <div className="px-2.5 py-2 font-clean text-[10px] text-white/20 text-center">
                          No sounds in library
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Upload dialog */}
      <SoundUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onGetDuration={onGetDuration}
        onPreviewTrim={onPreviewTrim}
        onAddToLibrary={onAddToLibrary}
        onAddToLibraryTrimmed={onAddToLibraryTrimmed}
      />
    </div>
  );
}
