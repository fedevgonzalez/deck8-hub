import { hsvToRgb } from "@/lib/hsv";
import type { ActiveSlot, KeyConfig } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface KeyCellProps {
  index: number;
  config: KeyConfig;
  editSlot: ActiveSlot;
  isSelected: boolean;
  onClick: () => void;
  mode?: "color" | "keycode";
  keycodeLabel?: string;
}

export function KeyCell({
  index,
  config,
  editSlot,
  isSelected,
  onClick,
  mode = "color",
  keycodeLabel,
}: KeyCellProps) {
  const activeColor = editSlot === "A" ? config.slot_a : config.slot_b;
  const bgColor = hsvToRgb(activeColor.h, activeColor.s, activeColor.v);
  const colorA = hsvToRgb(config.slot_a.h, config.slot_a.s, config.slot_a.v);
  const colorB = hsvToRgb(config.slot_b.h, config.slot_b.s, config.slot_b.v);

  const isColorMode = mode === "color";
  const overrideDisabled = isColorMode && !config.override_enabled;

  return (
    <button
      type="button"
      className={cn(
        "flex flex-col items-center justify-center gap-1",
        "w-[70px] h-[70px] rounded-lg cursor-pointer",
        "transition-all duration-100",
        "border",
        isSelected
          ? "border-white/50 key-selected"
          : "border-white/[0.06] hover:border-white/20",
        overrideDisabled && "key-stripes",
      )}
      style={
        isColorMode && !overrideDisabled
          ? { backgroundColor: bgColor }
          : !isColorMode
            ? { backgroundColor: "rgba(255,255,255,0.04)" }
            : undefined
      }
      onClick={onClick}
    >
      {isColorMode ? (
        <>
          <span className="text-[10px] font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">
            K{index + 1}
          </span>
          {overrideDisabled ? (
            <span className="text-[8px] text-white/40">none</span>
          ) : (
            <div className="flex gap-1">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full border",
                  editSlot === "A" ? "border-white/60" : "border-white/20",
                )}
                style={{ backgroundColor: colorA }}
              />
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full border",
                  editSlot === "B" ? "border-white/60" : "border-white/20",
                )}
                style={{ backgroundColor: colorB }}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <span className="text-[9px] text-muted-foreground">
            K{index + 1}
          </span>
          <span className="text-[10px] font-semibold text-foreground leading-tight text-center px-1 truncate max-w-full">
            {keycodeLabel || "NO"}
          </span>
        </>
      )}
    </button>
  );
}
