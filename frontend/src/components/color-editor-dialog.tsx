import { useState, useEffect } from "react";
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
import { X, Copy } from "lucide-react";
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

  useEffect(() => {
    if (open) setSlot(editSlot);
  }, [open, editSlot]);

  const color = slot === "A" ? config.slot_a : config.slot_b;
  const previewColor = hsvToRgb(color.h, color.s, color.v);
  const hexColor = hsvToHex(color.h, color.s, color.v);
  const colorA = hsvToRgb(config.slot_a.h, config.slot_a.s, config.slot_a.v);
  const colorB = hsvToRgb(config.slot_b.h, config.slot_b.s, config.slot_b.v);

  const handleCopyToOtherSlot = () => {
    const targetSlot: ActiveSlot = slot === "A" ? "B" : "A";
    onColorChange(keyIndex, targetSlot, color.h, color.s, color.v);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm bg-[#111113] border-white/12 animate-scale-in">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm border border-white/20"
              style={{
                backgroundColor: config.override_enabled ? previewColor : "transparent",
              }}
            />
            Key {keyIndex + 1}
          </DialogTitle>
          <DialogDescription className="text-xs text-white/40">
            Configure the color for this key, or let it use the device animation.
          </DialogDescription>
        </DialogHeader>

        {/* Preview: dual-swatch showing both slots side by side */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-white/15">
            <div
              className="w-8 h-8"
              style={{
                backgroundColor: config.override_enabled ? colorA : "#1a1a1e",
              }}
            >
              {!config.override_enabled && (
                <div className="w-full h-full stripes-sm" />
              )}
            </div>
            <div className="w-px bg-black/30" />
            <div
              className="w-8 h-8"
              style={{
                backgroundColor: config.override_enabled ? colorB : "#1a1a1e",
              }}
            >
              {!config.override_enabled && (
                <div className="w-full h-full stripes-sm" />
              )}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-white/50 tabular-nums font-medium">
              {config.override_enabled ? hexColor : "Override disabled"}
            </div>
            <div className="text-[10px] text-white/30 tabular-nums">
              {config.override_enabled
                ? `H${color.h} S${color.s} V${color.v}`
                : "Using device animation"}
            </div>
          </div>
          <div className="flex gap-0.5 text-[8px] text-white/20 font-pixel">
            <span className="px-1 py-0.5 rounded bg-white/[0.06]">A</span>
            <span className="px-1 py-0.5 rounded bg-white/[0.06]">B</span>
          </div>
        </div>

        {/* Override toggle */}
        <button
          type="button"
          className={cn(
            "flex items-center gap-2.5 w-full rounded-lg border px-3 py-2.5 transition-smooth",
            config.override_enabled
              ? "border-emerald-500/20 bg-emerald-500/[0.06]"
              : "border-white/10 bg-transparent hover:bg-white/[0.02]",
          )}
          onClick={() => onToggleOverride(keyIndex)}
        >
          <div
            className={cn(
              "w-8 h-[18px] rounded-full p-[2px] transition-all duration-150",
              config.override_enabled ? "bg-emerald-400/90" : "bg-white/15",
            )}
          >
            <div
              className={cn(
                "w-[14px] h-[14px] rounded-full transition-all duration-150",
                config.override_enabled
                  ? "translate-x-[14px] bg-white"
                  : "translate-x-0 bg-white/40",
              )}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-white/60 font-medium">
              Color override
            </span>
            <span className="text-[9px] text-white/25">
              {config.override_enabled
                ? "Custom colors active"
                : "Using device built-in animation"}
            </span>
          </div>
        </button>

        {/* Slot tabs + color picker */}
        {config.override_enabled && (
          <div className="space-y-3 animate-fade-in">
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

            {/* Color picker */}
            <ColorPicker
              keyIndex={keyIndex}
              slot={slot}
              color={color}
              onChange={(h, s, v) => onColorChange(keyIndex, slot, h, s, v)}
              hideHeader
            />
          </div>
        )}

        <div className="border-t border-white/[0.06] -mx-6 mt-1" />

        <DialogFooter className="-mb-1">
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
