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
import { X, Copy, Cpu } from "lucide-react";
import type { ActiveSlot, KeyConfig } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface ColorEditorDialogProps {
  open: boolean;
  keyIndex: number;
  config: KeyConfig;
  editSlot: ActiveSlot;
  onColorChange: (keyIndex: number, slot: ActiveSlot, h: number, s: number, v: number) => void;
  onToggleOverride: (keyIndex: number) => void;
  onClose: () => void;
}

export function ColorEditorDialog({
  open,
  keyIndex,
  config,
  editSlot,
  onColorChange,
  onToggleOverride,
  onClose,
}: ColorEditorDialogProps) {
  const [slot, setSlot] = useState<ActiveSlot>(editSlot);
  const didAutoEnable = useRef(false);

  useEffect(() => {
    if (open) {
      setSlot(editSlot);
      didAutoEnable.current = false;
    }
  }, [open, editSlot]);

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
      onColorChange(keyIndex, slot, h, s, v);
    },
    [config.override_enabled, keyIndex, slot, onColorChange, onToggleOverride],
  );

  const handleCopyToOtherSlot = () => {
    if (!config.override_enabled) {
      onToggleOverride(keyIndex);
    }
    const targetSlot: ActiveSlot = slot === "A" ? "B" : "A";
    onColorChange(keyIndex, targetSlot, color.h, color.s, color.v);
  };

  const handleResetToDevice = () => {
    if (config.override_enabled) {
      didAutoEnable.current = false;
      onToggleOverride(keyIndex);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
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

        {/* Preview: dual-swatch showing both slots */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-white/15">
            <div
              className="w-8 h-8"
              style={{
                backgroundColor: hsvToRgb(config.slot_a.h, config.slot_a.s, config.slot_a.v),
              }}
            />
            <div className="w-px bg-black/30" />
            <div
              className="w-8 h-8"
              style={{
                backgroundColor: hsvToRgb(config.slot_b.h, config.slot_b.s, config.slot_b.v),
              }}
            />
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

        {/* Slot switcher with copy button */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex gap-1 p-0.5 rounded-lg bg-[#0d0d0f] border border-white/8">
            {(["A", "B"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all",
                  slot === s
                    ? "bg-white/10 text-white/90 border border-white/15"
                    : "text-white/30 border border-transparent hover:text-white/50",
                )}
                onClick={() => setSlot(s)}
              >
                <span
                  className="w-2 h-2 rounded-sm border border-white/20"
                  style={{
                    backgroundColor:
                      s === "A"
                        ? hsvToRgb(config.slot_a.h, config.slot_a.s, config.slot_a.v)
                        : hsvToRgb(config.slot_b.h, config.slot_b.s, config.slot_b.v),
                  }}
                />
                Slot {s}
              </button>
            ))}
          </div>

          {/* Copy to other slot */}
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[9px] font-medium text-white/25 hover:text-white/60 hover:bg-white/[0.06] border border-white/8 transition-smooth"
            onClick={handleCopyToOtherSlot}
            title={`Copy current color to Slot ${slot === "A" ? "B" : "A"}`}
          >
            <Copy className="w-2.5 h-2.5" />
            {slot === "A" ? "A>B" : "B>A"}
          </button>
        </div>

        {/* Color picker — always visible */}
        <ColorPicker
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
            onClick={onClose}
          >
            <X className="w-3 h-3" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
