import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ColorPicker } from "@/components/color-picker";
import { hsvToRgb, hsvToHex } from "@/lib/hsv";
import { X, Cpu, ToggleRight } from "lucide-react";
import type { ActiveSlot, KeyConfig } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface ColorEditorDialogProps {
  open: boolean;
  keyIndex: number;
  config: KeyConfig;
  onColorChange: (keyIndex: number, slot: ActiveSlot | "both", h: number, s: number, v: number) => void;
  onToggleOverride: (keyIndex: number) => void;
  onSaveCustom: () => void;
  onClose: () => void;
}

export function ColorEditorDialog({
  open,
  keyIndex,
  config,
  onColorChange,
  onToggleOverride,
  onSaveCustom,
  onClose,
}: ColorEditorDialogProps) {
  const [slot, setSlot] = useState<ActiveSlot>(config.active_slot ?? "A");
  const [toggleMode, setToggleMode] = useState(false);
  const didAutoEnable = useRef(false);
  const prevOpen = useRef(false);

  // Refs to avoid stale closures in drag handlers (mousemove captures onChange at mousedown time)
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const toggleModeRef = useRef(toggleMode);
  toggleModeRef.current = toggleMode;

  // Reset state only when dialog OPENS (false→true), not on every active_slot change
  useEffect(() => {
    if (open && !prevOpen.current) {
      setSlot(config.active_slot ?? "A");
      // Auto-enable toggle mode if A and B have different colors
      const { slot_a: a, slot_b: b } = config;
      setToggleMode(a.h !== b.h || a.s !== b.s || a.v !== b.v);
      didAutoEnable.current = false;
    }
    prevOpen.current = open;
  }, [open, config.active_slot, config.slot_a, config.slot_b]);

  const color = slot === "A" ? config.slot_a : config.slot_b;
  const previewColor = hsvToRgb(color.h, color.s, color.v);
  const hexColor = hsvToHex(color.h, color.s, color.v);

  const handleColorChange = useCallback(
    (h: number, s: number, v: number) => {
      // Auto-enable override once per dialog open
      if (!config.override_enabled && !didAutoEnable.current) {
        didAutoEnable.current = true;
        onToggleOverride(keyIndex);
      }
      // Use refs to always read the latest slot/toggleMode (avoids stale closures during drag)
      const currentSlot = slotRef.current;
      const currentToggle = toggleModeRef.current;
      onColorChange(keyIndex, currentToggle ? currentSlot : "both", h, s, v);
    },
    [config.override_enabled, keyIndex, onColorChange, onToggleOverride],
  );

  const handleResetToDevice = () => {
    if (config.override_enabled) {
      didAutoEnable.current = false;
      onToggleOverride(keyIndex);
    }
  };

  const handleClose = useCallback(() => {
    setSlot("A");
    setToggleMode(false);
    // Persist per-key overrides to device EEPROM on dialog close
    onSaveCustom();
    onClose();
  }, [onClose, onSaveCustom]);

  const handleToggleModeChange = () => {
    const keySlot = config.active_slot ?? "A";
    if (!toggleMode) {
      // Turning ON: start on the key's own active slot
      setSlot(keySlot);
      setToggleMode(true);
    } else {
      // Turning OFF: sync both slots to match slot A
      const a = config.slot_a;
      onColorChange(keyIndex, "both", a.h, a.s, a.v);
      setSlot(keySlot);
      setToggleMode(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm bg-[#111113] border-white/12 animate-scale-in">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm border border-white/20"
              style={{ backgroundColor: previewColor }}
            />
            Key {keyIndex + 1}
          </DialogTitle>
          <DialogDescription className="text-xs text-white/40">
            Pick a color or use the device animation.
          </DialogDescription>
        </DialogHeader>

        {/* Preview bar */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-white/15">
            {toggleMode ? (
              /* Toggle mode: show both slots with labels */
              <>
                <div className="relative w-10 h-8" style={{ backgroundColor: hsvToRgb(config.slot_a.h, config.slot_a.s, config.slot_a.v) }}>
                  <span className="absolute bottom-0.5 left-1 font-pixel text-[7px] text-white/60 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">A</span>
                </div>
                <div className="w-px bg-black/30" />
                <div className="relative w-10 h-8" style={{ backgroundColor: hsvToRgb(config.slot_b.h, config.slot_b.s, config.slot_b.v) }}>
                  <span className="absolute bottom-0.5 right-1 font-pixel text-[7px] text-white/60 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">B</span>
                </div>
              </>
            ) : (
              /* Single mode: one swatch */
              <div className="w-10 h-8" style={{ backgroundColor: previewColor }} />
            )}
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-white/50 tabular-nums font-medium">
              {hexColor}
            </div>
            <div className="text-[10px] text-white/30 tabular-nums">
              H{color.h} S{color.s} V{color.v}
            </div>
          </div>
          {!config.override_enabled && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06]">
              <Cpu className="w-2.5 h-2.5 text-white/25" />
              <span className="font-pixel text-[8px] text-white/25 uppercase">device</span>
            </div>
          )}
        </div>

        {/* Toggle mode switch */}
        <button
          type="button"
          className={cn(
            "flex items-center gap-2.5 w-full rounded-lg border px-3 py-2 transition-smooth",
            toggleMode
              ? "border-violet-500/20 bg-violet-500/[0.06]"
              : "border-white/[0.06] bg-transparent hover:bg-white/[0.02]",
          )}
          onClick={handleToggleModeChange}
        >
          <div
            className={cn(
              "w-7 h-[16px] rounded-full p-[2px] transition-all duration-150",
              toggleMode ? "bg-violet-400/90" : "bg-white/12",
            )}
          >
            <div
              className={cn(
                "w-3 h-3 rounded-full transition-all duration-150",
                toggleMode
                  ? "translate-x-[12px] bg-white"
                  : "translate-x-0 bg-white/35",
              )}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <ToggleRight className={cn("w-3 h-3", toggleMode ? "text-violet-400/70" : "text-white/20")} />
            <span className={cn("text-[10px] font-medium", toggleMode ? "text-violet-300/70" : "text-white/30")}>
              Toggle mode
            </span>
          </div>
          {toggleMode && (
            <span className="ml-auto text-[9px] text-violet-300/40">
              A/B independent
            </span>
          )}
        </button>

        {/* Slot switcher — only in toggle mode */}
        {toggleMode && (
          <div className="flex gap-1.5 animate-fade-in">
            {(["A", "B"] as const).map((s) => {
              const slotColor = s === "A"
                ? hsvToRgb(config.slot_a.h, config.slot_a.s, config.slot_a.v)
                : hsvToRgb(config.slot_b.h, config.slot_b.s, config.slot_b.v);
              const slotHex = s === "A"
                ? hsvToHex(config.slot_a.h, config.slot_a.s, config.slot_a.v)
                : hsvToHex(config.slot_b.h, config.slot_b.s, config.slot_b.v);
              const isActive = slot === s;
              return (
                <button
                  key={s}
                  type="button"
                  className={cn(
                    "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                    isActive
                      ? "border-violet-400/30 bg-violet-500/[0.08]"
                      : "border-white/[0.06] bg-transparent hover:bg-white/[0.02] hover:border-white/10",
                  )}
                  onClick={() => {
                    setSlot(s);
                    // Push this slot's color to the device immediately
                    const c = s === "A" ? config.slot_a : config.slot_b;
                    onColorChange(keyIndex, s, c.h, c.s, c.v);
                  }}
                >
                  <span
                    className={cn(
                      "w-4 h-4 rounded-md border transition-all",
                      isActive
                        ? "border-white/40 shadow-[0_0_8px_rgba(255,255,255,0.1)]"
                        : "border-white/15",
                    )}
                    style={{ backgroundColor: slotColor }}
                  />
                  <div className="flex flex-col items-start">
                    <span className={cn(
                      "text-[10px] font-bold leading-none",
                      isActive ? "text-white/80" : "text-white/30",
                    )}>
                      Slot {s}
                    </span>
                    <span className={cn(
                      "text-[8px] tabular-nums leading-none mt-0.5",
                      isActive ? "text-white/35" : "text-white/15",
                    )}>
                      {slotHex}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Color picker — always visible */}
        <ColorPicker
          key={`${keyIndex}-${slot}`}
          keyIndex={keyIndex}
          slot={slot}
          color={color}
          onChange={handleColorChange}
          hideHeader
        />

        <div className="border-t border-white/[0.06] -mx-6 mt-1" />

        <DialogFooter className="-mb-1 flex justify-between">
          {config.override_enabled ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] text-white/25 hover:text-red-400/70 hover:bg-red-500/[0.06] h-7 px-3 gap-1.5 transition-smooth font-medium rounded-md"
              onClick={handleResetToDevice}
            >
              <Cpu className="w-3 h-3" />
              Reset to device
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] text-white/35 hover:text-white/70 hover:bg-white/[0.06] h-7 px-3 gap-1.5 transition-smooth font-medium rounded-md"
            onClick={handleClose}
          >
            <X className="w-3 h-3" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
