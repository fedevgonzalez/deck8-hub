import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Play, Pause, Upload, Volume2 } from "lucide-react";
import type { SoundEntry } from "@/lib/tauri";

interface SoundUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onGetDuration: (filePath: string) => Promise<number>;
  onPreviewTrim: (sourcePath: string, startMs: number, endMs: number) => void;
  onAddToLibrary: (filePath: string, displayName: string) => Promise<SoundEntry | null>;
  onAddToLibraryTrimmed: (filePath: string, displayName: string, startMs: number, endMs: number) => Promise<SoundEntry | null>;
}

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) {
    return `${min}:${sec.toFixed(2).padStart(5, "0")}`;
  }
  return `${sec.toFixed(2)}s`;
}

// Generate pseudo-random waveform bars for visual effect
function generateWaveform(count: number, seed: number): number[] {
  const bars: number[] = [];
  let x = seed;
  for (let i = 0; i < count; i++) {
    // Simple LCG for deterministic randomness
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const base = 0.15 + (x % 1000) / 1000 * 0.85;
    // Create envelope shape (louder in middle)
    const pos = i / count;
    const envelope = Math.sin(pos * Math.PI) * 0.5 + 0.5;
    bars.push(base * envelope);
  }
  return bars;
}

export function SoundUploadDialog({
  open,
  onClose,
  onGetDuration,
  onPreviewTrim,
  onAddToLibrary,
  onAddToLibraryTrimmed,
}: SoundUploadDialogProps) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [durationMs, setDurationMs] = useState(0);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed for waveform generation — changes per file
  const waveformSeed = useMemo(() => {
    if (!fileName) return 42;
    let hash = 0;
    for (let i = 0; i < fileName.length; i++) {
      hash = ((hash << 5) - hash + fileName.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }, [fileName]);

  const waveform = useMemo(() => generateWaveform(80, waveformSeed), [waveformSeed]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setFilePath(null);
      setFileName("");
      setDisplayName("");
      setDurationMs(0);
      setStartMs(0);
      setEndMs(0);
      setIsPlaying(false);
      setSubmitting(false);
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    }
  }, [open]);

  const handlePickFile = useCallback(async () => {
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: "Audio",
            extensions: ["wav", "mp3", "ogg", "flac", "m4a", "mp4"],
          },
        ],
      });
      if (selected) {
        setFilePath(selected);
        const name = selected.split(/[/\\]/).pop() || selected;
        setFileName(name);
        setDisplayName(name.replace(/\.[^.]+$/, ""));
        const dur = await onGetDuration(selected);
        setDurationMs(dur);
        setStartMs(0);
        setEndMs(dur);
      }
    } catch {
      // Dialog cancelled
    }
  }, [onGetDuration]);

  const handlePreview = useCallback(() => {
    if (!filePath || isPlaying) return;
    setIsPlaying(true);
    onPreviewTrim(filePath, startMs, endMs);
    // Auto-reset playing state after the clip duration
    const clipDuration = endMs - startMs;
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    playTimeoutRef.current = setTimeout(() => {
      setIsPlaying(false);
    }, clipDuration + 200);
  }, [filePath, startMs, endMs, isPlaying, onPreviewTrim]);

  const handleSubmit = useCallback(async () => {
    if (!filePath || !displayName.trim()) return;
    setSubmitting(true);
    try {
      if (startMs === 0 && endMs === durationMs) {
        await onAddToLibrary(filePath, displayName.trim());
      } else {
        await onAddToLibraryTrimmed(filePath, displayName.trim(), startMs, endMs);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [filePath, displayName, startMs, endMs, durationMs, onAddToLibrary, onAddToLibraryTrimmed, onClose]);

  // Calculate which waveform bars are in the selected range
  const startFrac = durationMs > 0 ? startMs / durationMs : 0;
  const endFrac = durationMs > 0 ? endMs / durationMs : 1;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-[420px] bg-[#111113] border-white/10 p-0 gap-0 overflow-hidden"
        showCloseButton={true}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-[15px] font-bold text-white/90">
            Sube un sonido
          </h2>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-5">
          {/* Waveform Preview */}
          <div className="flex flex-col gap-2">
            <span className="font-clean text-[11px] text-white/70 font-semibold">
              Previsualizar
            </span>
            <div
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-lg border",
                filePath
                  ? "bg-[#1a1a1e] border-white/[0.08]"
                  : "bg-[#0d0d0f] border-dashed border-white/[0.06]",
              )}
            >
              {/* Play button */}
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 transition-all",
                  filePath
                    ? isPlaying
                      ? "bg-white/20 text-white"
                      : "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/80"
                    : "bg-white/[0.04] text-white/15 cursor-not-allowed",
                )}
                onClick={handlePreview}
                disabled={!filePath || isPlaying}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              {/* Duration label */}
              {filePath && durationMs > 0 && (
                <span className="absolute bottom-1.5 left-4 font-clean text-[9px] text-cyan-400/50 tabular-nums">
                  {formatTime(endMs - startMs)}
                </span>
              )}

              {/* Waveform bars */}
              <div className="flex-1 flex items-center gap-[1.5px] h-12 overflow-hidden">
                {filePath && durationMs > 0 ? (
                  waveform.map((h, i) => {
                    const frac = i / waveform.length;
                    const inRange = frac >= startFrac && frac <= endFrac;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex-shrink-0 rounded-full transition-colors duration-100",
                          inRange
                            ? "bg-white/80"
                            : "bg-white/15",
                        )}
                        style={{
                          width: "2.5px",
                          height: `${Math.max(6, h * 100)}%`,
                        }}
                      />
                    );
                  })
                ) : (
                  // Empty placeholder bars
                  Array.from({ length: 80 }, (_, i) => (
                    <div
                      key={i}
                      className="flex-shrink-0 rounded-full bg-white/[0.06]"
                      style={{
                        width: "2.5px",
                        height: `${15 + Math.sin(i * 0.3) * 10}%`,
                      }}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Trim sliders (only when file loaded) */}
            {filePath && durationMs > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-[8px] text-white/30 uppercase tracking-widest">
                    Recortar
                  </span>
                  <span className="font-clean text-[9px] text-white/25 tabular-nums">
                    {formatTime(startMs)} — {formatTime(endMs)}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={durationMs}
                  step={50}
                  value={[startMs, endMs]}
                  onValueChange={([s, e]) => {
                    setStartMs(s);
                    setEndMs(e);
                  }}
                />
              </div>
            )}
          </div>

          {/* File picker */}
          <div className="flex flex-col gap-2">
            <span className="font-clean text-[11px] text-white/70 font-semibold">
              Archivo <span className="text-red-400">*</span>
            </span>
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg border",
                "bg-[#0d0d0f] border-white/[0.08]",
                filePath ? "border-white/[0.08]" : "border-amber-500/20",
              )}
            >
              <Upload className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
              <span className={cn(
                "flex-1 text-[11px] font-clean truncate",
                filePath ? "text-white/60" : "text-white/25",
              )}>
                {fileName || "Seleccionar archivo de audio..."}
              </span>
              <button
                type="button"
                className={cn(
                  "px-3 py-1 rounded-md text-[10px] font-clean font-bold transition-all flex-shrink-0",
                  "bg-white/[0.08] text-white/60 border border-white/[0.10]",
                  "hover:bg-white/[0.14] hover:text-white/80",
                )}
                onClick={handlePickFile}
              >
                Explorar
              </button>
            </div>
          </div>

          {/* Sound name */}
          <div className="flex flex-col gap-2">
            <span className="font-clean text-[11px] text-white/70 font-semibold">
              Nombre del sonido <span className="text-red-400">*</span>
            </span>
            <input
              type="text"
              className={cn(
                "w-full px-3 py-2.5 rounded-lg text-[11px] font-clean",
                "bg-[#0d0d0f] border text-white/70",
                "focus:outline-none focus:border-indigo-500/40",
                displayName.trim()
                  ? "border-white/[0.08]"
                  : "border-amber-500/20",
              )}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nombre del sonido"
            />
          </div>

          {/* Volume (preview) */}
          {filePath && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-3 h-3 text-white/25" />
                <span className="font-clean text-[11px] text-white/70 font-semibold">
                  Volumen del sonido
                </span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[1]}
                disabled
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg text-[12px] font-clean font-bold transition-all",
                "bg-white/[0.06] text-white/50 border border-white/[0.08]",
                "hover:bg-white/[0.10] hover:text-white/70",
              )}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg text-[12px] font-clean font-bold transition-all",
                filePath && displayName.trim() && !submitting
                  ? "bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700"
                  : "bg-indigo-600/30 text-white/30 cursor-not-allowed",
              )}
              disabled={!filePath || !displayName.trim() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Subiendo..." : "Subir"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
