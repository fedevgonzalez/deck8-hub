import { useCallback, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { hsvToRgb, hsvToHex } from "@/lib/hsv";
import type { ActiveSlot, HsvColor } from "@/lib/tauri";

interface ColorPickerProps {
  keyIndex: number;
  slot: ActiveSlot;
  color: HsvColor;
  onChange: (h: number, s: number, v: number) => void;
  hideHeader?: boolean;
}

export function ColorPicker({
  keyIndex,
  slot,
  color,
  onChange,
  hideHeader,
}: ColorPickerProps) {
  const previewColor = hsvToRgb(color.h, color.s, color.v);
  const hexColor = hsvToHex(color.h, color.s, color.v);
  const hueColor = hsvToRgb(color.h, 255, 255);

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg border border-white/20 shrink-0"
              style={{
                backgroundColor: previewColor,
                boxShadow: `0 0 20px -4px ${previewColor}`,
              }}
            />
            <div>
              <div className="text-xs text-white/90 font-semibold">
                Key {keyIndex + 1}
                <span className="text-white/40 font-normal ml-1">/ Slot {slot}</span>
              </div>
              <div className="text-[10px] text-white/50 tabular-nums font-medium mt-0.5">
                {hexColor}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-white/30 tabular-nums">
            H{color.h} S{color.s} V{color.v}
          </div>
        </div>
      )}

      {/* 2D Saturation-Value area */}
      <SatValArea
        hue={color.h}
        sat={color.s}
        val={color.v}
        hueColor={hueColor}
        onChange={(s, v) => onChange(color.h, s, v)}
      />

      {/* Hue bar */}
      <div className="slider-hue">
        <Slider
          min={0}
          max={255}
          step={1}
          value={[color.h]}
          onValueChange={([h]) => onChange(h, color.s, color.v)}
        />
      </div>
    </div>
  );
}

/** 2D draggable Saturation (x) × Value (y) picker */
function SatValArea({
  hue: _hue,
  sat,
  val,
  hueColor,
  onChange,
}: {
  hue: number;
  sat: number;
  val: number;
  hueColor: string;
  onChange: (s: number, v: number) => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);

  const posFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      const rect = areaRef.current!.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      const s = Math.round(x * 255);
      const v = Math.round((1 - y) * 255);
      return { s, v };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const { s, v } = posFromEvent(e);
      onChange(s, v);

      const move = (ev: MouseEvent) => {
        const pos = posFromEvent(ev);
        onChange(pos.s, pos.v);
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [posFromEvent, onChange],
  );

  // cursor position (percentage)
  const cx = (sat / 255) * 100;
  const cy = (1 - val / 255) * 100;

  return (
    <div
      ref={areaRef}
      className="relative w-full cursor-crosshair select-none"
      style={{ height: 200 }}
      onMouseDown={handlePointerDown}
    >
      {/* Gradient layers (clipped to rounded corners) */}
      <div
        className="absolute inset-0 rounded-lg overflow-hidden"
        style={{ backgroundColor: hueColor }}
      >
        {/* White → transparent (saturation) */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to right, #fff, transparent)",
          }}
        />
        {/* Transparent → black (value) */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, transparent, #000)",
          }}
        />
      </div>
      {/* Border overlay */}
      <div className="absolute inset-0 rounded-lg border border-white/15 pointer-events-none" />
      {/* Cursor (not clipped) */}
      <div
        className="absolute pointer-events-none z-10"
        style={{
          left: `${cx}%`,
          top: `${cy}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div className="w-4 h-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.4)]" />
      </div>
    </div>
  );
}
