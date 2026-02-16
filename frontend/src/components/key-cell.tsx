import { memo } from "react";
import { hsvToRgb, hsvToHex } from "@/lib/hsv";
import type { ActiveSlot, KeyConfig } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { Cpu } from "lucide-react";

interface KeyCellProps {
  index: number;
  config: KeyConfig;
  editSlot: ActiveSlot;
  isSelected: boolean;
  onClick: () => void;
  onToggleOverride?: () => void;
  mode?: "color" | "keycode";
  keycodeLabel?: string;
}

export const KeyCell = memo(function KeyCell({
  index,
  config,
  editSlot,
  isSelected,
  onClick,
  onToggleOverride,
  mode = "color",
  keycodeLabel,
}: KeyCellProps) {
  const activeColor = editSlot === "A" ? config.slot_a : config.slot_b;
  const bgColor = hsvToRgb(activeColor.h, activeColor.s, activeColor.v);
  const colorA = hsvToRgb(config.slot_a.h, config.slot_a.s, config.slot_a.v);
  const colorB = hsvToRgb(config.slot_b.h, config.slot_b.s, config.slot_b.v);
  const hexColor = hsvToHex(activeColor.h, activeColor.s, activeColor.v);

  const isColorMode = mode === "color";
  const overrideOn = config.override_enabled;

  // ── Keycode mode: larger label, corner badge ──
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
        {/* K{n} corner badge */}
        <span className="absolute top-1.5 left-2 font-pixel text-[8px] text-white/20 leading-none">
          {index + 1}
        </span>
        {/* Primary keycode label — large and prominent */}
        <span className="font-pixel text-[13px] text-white/80 leading-tight text-center px-1.5 truncate max-w-full mt-1">
          {keycodeLabel || "\u2014"}
        </span>
      </button>
    );
  }

  // ── Color mode: polished key cell ──
  return (
    <div
      className={cn(
        "key-cell-color relative flex flex-col rounded-xl overflow-hidden",
        "w-20 transition-all duration-100",
        "border",
        isSelected
          ? "border-white/60 key-selected"
          : overrideOn
            ? "border-white/15 hover:border-white/30"
            : "border-white/[0.08] hover:border-white/15",
      )}
      style={overrideOn && !isSelected ? {
        boxShadow: "0 0 0 1px rgba(16,185,129,0.15)",
      } : undefined}
    >
      {/* Main clickable area */}
      <button
        type="button"
        className={cn(
          "relative flex flex-col items-center justify-center w-full cursor-pointer",
          "transition-all duration-100",
        )}
        style={{
          height: "68px",
          ...(overrideOn
            ? {
                backgroundColor: bgColor,
                boxShadow: isSelected
                  ? undefined
                  : `inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -2px 4px rgba(0,0,0,0.3), 0 4px 16px -6px ${bgColor}`,
              }
            : {
                backgroundColor: "#111113",
              }),
        }}
        onClick={onClick}
      >
        {overrideOn ? (
          /* ── Override ON: CUSTOM state ── */
          <>
            {/* Key label — top left */}
            <span className="absolute top-1.5 left-2 font-pixel text-sm leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">
              K{index + 1}
            </span>

            {/* CUSTOM badge — top right */}
            <span className="custom-badge absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 font-pixel text-[7px] text-emerald-300 uppercase leading-none">
              custom
            </span>

            {/* Dual color swatches — centered */}
            <div className="flex items-center gap-2 mt-2">
              {(["A", "B"] as const).map((s) => {
                const isActive = editSlot === s;
                const swatchColor = s === "A" ? colorA : colorB;
                return (
                  <div key={s} className={cn(
                    "flex flex-col items-center gap-0.5",
                    isActive ? "opacity-100" : "opacity-50",
                  )}>
                    <span
                      className={cn(
                        "w-3 h-3 rounded-[3px] border transition-all",
                        isActive
                          ? "border-white/70 shadow-[0_0_6px_rgba(255,255,255,0.15)]"
                          : "border-white/25",
                      )}
                      style={{ backgroundColor: swatchColor }}
                    />
                    <span className="font-pixel text-[7px] text-white/40 drop-shadow-[0_1px_2px_rgba(0,0,0,1)] leading-none">
                      {s}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Hex color value */}
            <span className="font-pixel text-[8px] text-white/50 tabular-nums leading-none mt-1.5">
              {hexColor}
            </span>
          </>
        ) : (
          /* ── Override OFF: DEVICE state ── */
          <>
            {/* Key label — dimmed */}
            <span className="font-pixel text-sm leading-none text-white/25">
              K{index + 1}
            </span>

            {/* DEVICE badge — centered pill */}
            <div className="flex items-center gap-1 mt-2">
              <Cpu className="w-2.5 h-2.5 text-white/20" />
              <span className="font-pixel text-[8px] text-white/20 uppercase leading-none">
                device
              </span>
            </div>

            {/* Sub-label */}
            <span className="font-pixel text-[7px] text-white/12 uppercase leading-none mt-1">
              rgb matrix
            </span>
          </>
        )}
      </button>

      {/* Bottom toggle strip — 32px height */}
      <button
        type="button"
        className={cn(
          "key-toggle-strip flex items-center justify-center gap-2.5 w-full cursor-pointer",
          "border-t transition-all duration-100 active:scale-[0.98]",
          overrideOn
            ? "border-white/[0.08] bg-black/30 hover:bg-black/20"
            : "border-white/[0.04] bg-[#0d0d0f] hover:bg-white/[0.04]",
        )}
        style={{ height: "32px" }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleOverride?.();
        }}
        title={overrideOn ? "Disable color override" : "Enable color override"}
      >
        {/* Toggle switch — w-8 h-4 track */}
        <div
          className={cn(
            "w-8 h-4 rounded-full p-[2px] transition-all duration-150",
            overrideOn
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
              : "bg-white/12",
          )}
        >
          <div
            className={cn(
              "w-3 h-3 rounded-full transition-all duration-150",
              overrideOn
                ? "translate-x-4 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                : "translate-x-0 bg-white/30",
            )}
          />
        </div>
        <span
          className={cn(
            "font-pixel text-[8px] uppercase tracking-wide leading-none",
            overrideOn ? "text-emerald-300/60" : "text-white/15",
          )}
        >
          {overrideOn ? "on" : "off"}
        </span>
      </button>
    </div>
  );
});
