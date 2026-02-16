import { useState, useCallback } from "react";
import { KeyGrid } from "@/components/key-grid";
import { ColorEditorDialog } from "@/components/color-editor-dialog";
import { disableAllOverrides } from "@/lib/tauri";
import type { ActiveSlot, KeyConfig } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { EyeOff, Palette, Cpu } from "lucide-react";
import { toast } from "sonner";

interface ColorViewProps {
  keys: KeyConfig[];
  editSlot: ActiveSlot;
  selectedKey: number | null;
  onSelectKey: (index: number) => void;
  onColorChange: (keyIndex: number, slot: ActiveSlot | "both", h: number, s: number, v: number) => void;
  onToggleOverride: (keyIndex: number) => void;
  connected: boolean;
}

export function ColorView({
  keys,
  editSlot,
  selectedKey,
  onSelectKey,
  onColorChange,
  onToggleOverride,
  connected,
}: ColorViewProps) {
  const [editorOpen, setEditorOpen] = useState(false);

  const handleSelectKey = (i: number) => {
    if (selectedKey === i) {
      setEditorOpen(true);
    } else {
      onSelectKey(i);
      setEditorOpen(true);
    }
  };

  const overrideCount = keys.filter((k) => k.override_enabled).length;
  const deviceCount = keys.length - overrideCount;

  const handleDisableAll = useCallback(async () => {
    try {
      await disableAllOverrides();
      keys.forEach((k, i) => {
        if (k.override_enabled) {
          onToggleOverride(i);
        }
      });
      toast.success("All overrides disabled");
    } catch (e) {
      toast.error(`Failed: ${e}`);
    }
  }, [keys, onToggleOverride]);

  const hasOverrides = overrideCount > 0;

  return (
    <div className="flex flex-1 min-h-0 flex-col items-center justify-center">
      {/* Unified color panel */}
      <div className="color-panel relative animate-fade-in">
        {/* Panel header: status counters */}
        <div className="relative z-[1] flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            {/* Custom count */}
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center justify-center w-5 h-5 rounded-md",
                hasOverrides
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-white/[0.06] text-white/20",
              )}>
                <Palette className="w-3 h-3" />
              </div>
              <div className="flex flex-col">
                <span className={cn(
                  "font-pixel text-xs leading-none tabular-nums",
                  hasOverrides ? "text-emerald-400/90" : "text-white/30",
                )}>
                  {overrideCount}
                </span>
                <span className="font-pixel text-[8px] text-white/25 uppercase tracking-wider leading-none mt-0.5">
                  custom
                </span>
              </div>
            </div>

            {/* Separator dot */}
            <span className="w-1 h-1 rounded-full bg-white/10" />

            {/* Device count */}
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-md bg-white/[0.06] text-white/20">
                <Cpu className="w-3 h-3" />
              </div>
              <div className="flex flex-col">
                <span className="font-pixel text-xs text-white/40 leading-none tabular-nums">
                  {deviceCount}
                </span>
                <span className="font-pixel text-[8px] text-white/20 uppercase tracking-wider leading-none mt-0.5">
                  device
                </span>
              </div>
            </div>
          </div>

          {/* Reset all button */}
          {hasOverrides && (
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
                "font-pixel text-[9px] uppercase tracking-wide",
                "text-white/25 hover:text-white/60",
                "bg-transparent hover:bg-white/[0.04]",
                "border border-transparent hover:border-white/10",
                "transition-smooth",
              )}
              onClick={handleDisableAll}
              title="Disable all color overrides"
            >
              <EyeOff className="w-3 h-3" />
              reset all
            </button>
          )}
        </div>

        {/* Key grid hero area — PCB trace background */}
        <div className="relative z-[1] px-5 py-5 pcb-grid">
          {/* Ambient glow behind grid — emerald when overrides, neutral when all standby */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-500"
            style={{
              opacity: hasOverrides ? 0.05 : 0.02,
              background: hasOverrides
                ? "radial-gradient(ellipse at center, rgba(52,211,153,0.6) 0%, transparent 70%)"
                : "radial-gradient(ellipse at center, rgba(255,255,255,0.3) 0%, transparent 70%)",
            }}
          />

          <div className="relative flex justify-center">
            <KeyGrid
              keys={keys}
              editSlot={editSlot}
              selectedKey={selectedKey}
              onSelectKey={handleSelectKey}
              mode="color"
            />
          </div>
        </div>

        {/* Status footer */}
        <div className="relative z-[1] flex items-center gap-3 px-5 py-2.5 border-t border-white/[0.06] bg-[#0a0a0c]">
          <span className="font-pixel text-[9px] text-white/20 flex-1">
            {hasOverrides
              ? `> ${overrideCount} override${overrideCount !== 1 ? "s" : ""} active`
              : "> all keys on device mode"}
          </span>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              connected ? "bg-emerald-400/80" : "bg-red-400/50 animate-pulse-subtle",
            )} />
            <span className={cn(
              "font-pixel text-[8px] uppercase tracking-wider",
              connected ? "text-emerald-400/50" : "text-red-400/40",
            )}>
              {connected ? "live" : "offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Color editor dialog */}
      {selectedKey !== null && keys[selectedKey] && (
        <ColorEditorDialog
          open={editorOpen}
          keyIndex={selectedKey}
          config={keys[selectedKey]}
          editSlot={editSlot}
          onColorChange={onColorChange}
          onToggleOverride={onToggleOverride}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}
