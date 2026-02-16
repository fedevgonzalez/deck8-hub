import { useState, useCallback, useRef } from "react";
import { KeyGrid } from "@/components/key-grid";
import { ColorEditorDialog } from "@/components/color-editor-dialog";
import { applyColors, disableAllOverrides } from "@/lib/tauri";
import type { ActiveSlot, KeyConfig } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  EyeOff,
  Check,
  Palette,
  Cpu,
  ArrowUpFromLine,
} from "lucide-react";
import { toast } from "sonner";

interface ColorViewProps {
  keys: KeyConfig[];
  editSlot: ActiveSlot;
  selectedKey: number | null;
  onSelectKey: (index: number) => void;
  onColorChange: (keyIndex: number, slot: ActiveSlot, h: number, s: number, v: number) => void;
  onToggleOverride: (keyIndex: number) => void;
  connected: boolean;
}

type SyncStatus = "idle" | "syncing" | "done";

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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

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

  const handleSync = useCallback(async () => {
    if (syncStatus === "syncing") return;
    setSyncStatus("syncing");
    try {
      await applyColors();
      setSyncStatus("done");
      toast.success("Colors synced to device");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } catch (e) {
      setSyncStatus("idle");
      toast.error(`Sync failed: ${e}`);
    }
  }, [syncStatus]);

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

  // Auto-open dialog when toggling a key ON
  const dialogTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const handleToggleOverride = useCallback((keyIndex: number) => {
    const wasOff = !keys[keyIndex]?.override_enabled;
    onToggleOverride(keyIndex);
    if (wasOff) {
      onSelectKey(keyIndex);
      // Clear any pending timer
      if (dialogTimerRef.current) clearTimeout(dialogTimerRef.current);
      dialogTimerRef.current = setTimeout(() => setEditorOpen(true), 150);
    }
  }, [keys, onToggleOverride, onSelectKey]);

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
              onToggleOverride={handleToggleOverride}
              mode="color"
            />
          </div>
        </div>

        {/* Sync footer — terminal style */}
        <div className={cn(
          "relative z-[1] flex items-center gap-3 px-5 py-3 border-t transition-colors duration-200",
          syncStatus === "done"
            ? "border-emerald-500/20 bg-emerald-500/[0.04]"
            : "border-white/[0.06] bg-[#0a0a0c]",
        )}>
          {!connected ? (
            /* Disconnected — terminal waiting state */
            <div className="flex items-center gap-3 w-full">
              <span className="font-pixel text-[10px] text-white/15">{">"}_</span>
              <span className="font-pixel text-[10px] text-white/25">
                awaiting device connection
              </span>
              <span className="terminal-cursor font-pixel text-[10px] text-white/30">_</span>
              <div className="flex-1" />
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400/50 animate-pulse-subtle" />
                <span className="font-pixel text-[8px] text-red-400/40 uppercase tracking-wider">
                  offline
                </span>
              </div>
            </div>
          ) : (
            /* Connected — terminal command style */
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                className={cn(
                  "sync-button flex items-center gap-2.5 px-4 py-2 rounded-lg text-[11px] font-bold",
                  "border transition-all duration-150",
                  syncStatus === "syncing"
                    ? "border-white/10 bg-white/[0.04] text-white/30 cursor-wait"
                    : syncStatus === "done"
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                      : "border-white/15 bg-white/[0.08] text-white/70 hover:bg-white/[0.14] hover:text-white/90 hover:border-white/25 hover:shadow-[0_0_20px_-6px_rgba(255,255,255,0.08)]",
                )}
                onClick={handleSync}
                disabled={syncStatus === "syncing"}
              >
                {syncStatus === "syncing" ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : syncStatus === "done" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                )}
                {syncStatus === "syncing"
                  ? "Syncing..."
                  : syncStatus === "done"
                    ? "Synced"
                    : "Sync"}
              </button>

              <span className="font-pixel text-[9px] text-white/20 flex-1">
                {syncStatus === "done"
                  ? "> colors pushed OK"
                  : hasOverrides
                    ? `> ${overrideCount} override${overrideCount !== 1 ? "s" : ""} pending`
                    : "> all keys on device mode"}
              </span>

              {/* Connection status */}
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                <span className="font-pixel text-[8px] text-emerald-400/50 uppercase tracking-wider">
                  live
                </span>
              </div>
            </div>
          )}
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
