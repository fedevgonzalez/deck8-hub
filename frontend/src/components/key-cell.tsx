import { memo } from "react";
import { hsvToRgb } from "@/lib/hsv";
import type { KeyConfig } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface KeyCellProps {
  config: KeyConfig;
  isSelected: boolean;
  onClick: () => void;
  onToggleSlot?: () => void;
  mode?: "color" | "keycode";
  keycodeLabel?: string;
}

export const KeyCell = memo(function KeyCell({
  config,
  isSelected,
  onClick,
  mode = "color",
  keycodeLabel,
}: KeyCellProps) {
  const keySlot = config.active_slot ?? "A";
  const activeColor = keySlot === "A" ? config.slot_a : config.slot_b;
  const bgColor = hsvToRgb(activeColor.h, activeColor.s, activeColor.v);

  const isColorMode = mode === "color";
  const overrideOn = config.override_enabled;

  // ── Keycode mode ──
  if (!isColorMode) {
    return (
      <button
        type="button"
        className={cn(
          "relative flex flex-col items-center justify-center",
          "w-20 h-20 rounded-xl cursor-pointer",
          "transition-all duration-100",
          "border",
          isSelected
            ? "border-white/60 key-selected"
            : "border-white/10 hover:border-white/25 hover:scale-[1.03]",
        )}
        style={{
          backgroundColor: "#141416",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 2px rgba(0,0,0,0.3)",
        }}
        onClick={onClick}
      >
        <span className="font-pixel text-[13px] text-white/80 leading-tight text-center px-1.5 truncate max-w-full">
          {keycodeLabel || "\u2014"}
        </span>
      </button>
    );
  }

  // ── Color mode ──
  return (
    <button
      type="button"
      className={cn(
        "key-cell-color relative rounded-xl cursor-pointer",
        "w-20 h-20 transition-all duration-100",
        "border",
        isSelected
          ? "border-white/60 key-selected"
          : overrideOn
            ? "border-white/15 hover:border-white/30 hover:scale-[1.03]"
            : "border-white/[0.08] hover:border-white/15 hover:scale-[1.03]",
      )}
      style={{
        backgroundColor: overrideOn ? bgColor : "#111113",
        ...(overrideOn && !isSelected
          ? { boxShadow: `0 4px 16px -6px ${bgColor}` }
          : {}),
      }}
      onClick={onClick}
    />
  );
});
