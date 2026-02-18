import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  keycodeToLabel,
  getKeycodesByCategory,
  composeKeycode,
  decomposeKeycode,
  keyEventToKeycode,
  CATEGORIES,
  type KeycodeCategory,
  type KeycodeDef,
} from "@/lib/keycodes";
import { cn } from "@/lib/utils";
import { Trash2, Play, Music, Plus, Volume2 } from "lucide-react";
import { isInternalKeycode } from "@/lib/tauri";
import type { SoundEntry } from "@/lib/tauri";

interface KeyEditorDialogProps {
  open: boolean;
  keyIndex: number;
  currentKeycode: number;
  onSave: (keycode: number) => void;
  onClose: () => void;
  soundLibrary: SoundEntry[];
  currentSoundId: string | null;
  onSoundChange: (soundId: string | null) => void;
  onPreviewSound: (soundId: string) => void;
  onAddSound: () => void;
}

export function KeyEditorDialog({
  open,
  keyIndex,
  currentKeycode,
  onSave,
  onClose,
  soundLibrary,
  currentSoundId,
  onSoundChange,
  onPreviewSound,
  onAddSound,
}: KeyEditorDialogProps) {
  const [newKeycode, setNewKeycode] = useState(currentKeycode);
  const [category, setCategory] = useState<KeycodeCategory>("basic");
  const [outerTab, setOuterTab] = useState<"shortcut" | "sound">("shortcut");

  // Treat internal keycodes (auto-assigned for sound-only) as 0x0000 in the UI
  const displayKeycode = isInternalKeycode(currentKeycode) ? 0 : currentKeycode;

  useEffect(() => {
    if (open) {
      setNewKeycode(displayKeycode);
      setOuterTab("shortcut");
    }
  }, [open, displayKeycode]);

  useEffect(() => {
    if (!open || outerTab !== "shortcut") return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const kc = keyEventToKeycode(e);
      if (kc !== null) setNewKeycode(kc);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, outerTab]);

  const decomposed = decomposeKeycode(newKeycode);

  const toggleMod = useCallback(
    (mod: "ctrl" | "shift" | "alt" | "gui") => {
      const d = decomposeKeycode(newKeycode);
      const next = { ...d, [mod]: !d[mod] };
      setNewKeycode(composeKeycode(next.base, next.ctrl, next.shift, next.alt, next.gui));
    },
    [newKeycode],
  );

  const selectBase = useCallback(
    (code: number) => {
      const d = decomposeKeycode(newKeycode);
      if (code > 0xff) {
        setNewKeycode(code);
      } else {
        setNewKeycode(composeKeycode(code, d.ctrl, d.shift, d.alt, d.gui));
      }
    },
    [newKeycode],
  );

  const currentSoundName = soundLibrary.find((e) => e.id === currentSoundId)?.display_name ?? null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#111113] border-white/12 animate-scale-in">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">
            Edit Key {keyIndex + 1}
          </DialogTitle>
          <DialogDescription className="text-xs text-white/40">
            Configure shortcut or sound for this key.
          </DialogDescription>
        </DialogHeader>

        {/* Outer tabs: Shortcut | Sound */}
        <div className="flex gap-1 p-1 rounded-lg bg-[#0d0d0f] border border-white/[0.06]">
          <button
            type="button"
            className={cn(
              "flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all",
              outerTab === "shortcut"
                ? "bg-white/10 text-white/80"
                : "text-white/30 hover:text-white/50",
            )}
            onClick={() => setOuterTab("shortcut")}
          >
            Shortcut
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1",
              outerTab === "sound"
                ? "bg-white/10 text-white/80"
                : "text-white/30 hover:text-white/50",
            )}
            onClick={() => setOuterTab("sound")}
          >
            <Volume2 className="w-3 h-3" />
            Sound
            {currentSoundName && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-cyan-400/60" />
            )}
          </button>
        </div>

        {outerTab === "shortcut" ? (
          <>
            {/* Current → New */}
            <div className="flex items-center justify-center gap-3 py-2">
              <KeycodeChip label={keycodeToLabel(displayKeycode)} muted />
              <span className="text-white/20 text-xs">&rarr;</span>
              <KeycodeChip label={keycodeToLabel(newKeycode)} />
            </div>

            {/* Modifiers */}
            <div className="flex gap-1.5 justify-center">
              {(["ctrl", "shift", "alt", "gui"] as const).map((mod) => (
                <button
                  key={mod}
                  type="button"
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all duration-100",
                    decomposed[mod]
                      ? "bg-white text-black border-white/40 scale-105"
                      : "bg-transparent text-white/35 border-white/10 hover:border-white/25 hover:text-white/60",
                  )}
                  onClick={() => toggleMod(mod)}
                >
                  {mod === "gui" ? "Win" : mod.charAt(0).toUpperCase() + mod.slice(1)}
                </button>
              ))}
            </div>

            {/* Virtual keyboard */}
            <Tabs value={category} onValueChange={(v) => setCategory(v as KeycodeCategory)}>
              <TabsList className="w-full bg-[#1a1a1e] border border-white/10">
                {CATEGORIES.map((cat) => (
                  <TabsTrigger key={cat.id} value={cat.id} className="text-[10px] data-[state=active]:font-bold">
                    {cat.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {CATEGORIES.map((cat) => (
                <TabsContent key={cat.id} value={cat.id}>
                  <div className="grid grid-cols-6 gap-1 max-h-[200px] overflow-y-auto p-2 rounded-lg bg-[#0d0d0f]">
                    {getKeycodesByCategory(cat.id).map((kc) => (
                      <VirtualKey
                        key={kc.code}
                        def={kc}
                        isActive={isBaseMatch(newKeycode, kc.code)}
                        onClick={() => selectBase(kc.code)}
                      />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <DialogFooter className="flex justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-white/25 hover:text-red-400/70 hover:bg-red-500/[0.06] gap-1.5"
                onClick={() => { onSave(0x0000); onClose(); }}
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-xs text-white/40" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="text-xs font-semibold"
                  onClick={() => { onSave(newKeycode); onClose(); }}
                >
                  Save
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Sound picker */}
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
              {/* Current assignment */}
              {currentSoundName && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/[0.06] border border-cyan-500/15">
                  <Music className="w-3.5 h-3.5 text-cyan-400/60 flex-shrink-0" />
                  <span className="font-clean text-[10px] text-cyan-300/70 truncate flex-1">
                    {currentSoundName}
                  </span>
                  <span className="font-pixel text-[7px] text-cyan-400/40 uppercase tracking-wider">assigned</span>
                </div>
              )}

              {/* None option */}
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left",
                  !currentSoundId
                    ? "border-white/15 bg-white/[0.06] text-white/60"
                    : "border-white/[0.06] bg-white/[0.02] text-white/35 hover:bg-white/[0.04] hover:text-white/50",
                )}
                onClick={() => { onSoundChange(null); onClose(); }}
              >
                <Trash2 className="w-3 h-3 flex-shrink-0" />
                <span className="font-clean text-[10px]">None (no sound)</span>
              </button>

              {/* Library sounds */}
              {soundLibrary.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                    currentSoundId === entry.id
                      ? "border-cyan-500/20 bg-cyan-500/[0.06]"
                      : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
                  )}
                >
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-white/10 text-white/25 hover:text-emerald-400/80 transition-colors flex-shrink-0"
                    onClick={() => onPreviewSound(entry.id)}
                    title="Preview"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "font-clean text-[10px] truncate flex-1 text-left",
                      currentSoundId === entry.id ? "text-cyan-300/80" : "text-white/55",
                    )}
                    onClick={() => { onSoundChange(entry.id); onClose(); }}
                  >
                    {entry.display_name}
                  </button>
                  {currentSoundId === entry.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 flex-shrink-0" />
                  )}
                </div>
              ))}

              {soundLibrary.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <Music className="w-5 h-5 text-white/10" />
                  <span className="font-clean text-[10px] text-white/25">
                    No sounds in library
                  </span>
                </div>
              )}
            </div>

            {/* Upload button */}
            <button
              type="button"
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg",
                "bg-white/[0.03] border border-dashed border-white/[0.10] text-white/35",
                "hover:bg-white/[0.06] hover:text-white/55 hover:border-white/15 transition-all",
                "font-clean text-[10px]",
              )}
              onClick={() => { onAddSound(); }}
            >
              <Plus className="w-3 h-3" />
              Upload Sound
            </button>

            <DialogFooter>
              <Button variant="ghost" size="sm" className="text-xs text-white/40" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KeycodeChip({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "px-4 py-2 rounded-lg text-xs font-bold border min-w-[60px] text-center",
        muted
          ? "bg-[#0d0d0f] border-white/8 text-white/30"
          : "bg-white/10 border-white/20 text-white/90",
      )}
    >
      {label}
    </span>
  );
}

function VirtualKey({
  def,
  isActive,
  onClick,
}: {
  def: KeycodeDef;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "py-1.5 rounded-md text-[9px] font-bold border transition-all truncate",
        def.wide ? "col-span-2 px-2" : "px-1",
        isActive
          ? "bg-white text-black border-white/50 scale-105 shadow-sm"
          : "bg-[#161618] text-white/35 border-white/8 hover:border-white/20 hover:text-white/60",
      )}
      onClick={onClick}
      title={def.label}
    >
      {def.label}
    </button>
  );
}

function isBaseMatch(keycode: number, defCode: number): boolean {
  if (defCode > 0xff) return keycode === defCode;
  const base = keycode <= 0xff ? keycode : keycode & 0xff;
  return base === defCode;
}
