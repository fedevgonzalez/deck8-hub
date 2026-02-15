import { Slider } from "@/components/ui/slider";
import { hsvToRgb, satGradient, valGradient } from "@/lib/hsv";
import type { ActiveSlot, HsvColor } from "@/lib/tauri";

interface ColorPickerProps {
  keyIndex: number;
  slot: ActiveSlot;
  color: HsvColor;
  onChange: (h: number, s: number, v: number) => void;
}

export function ColorPicker({
  keyIndex,
  slot,
  color,
  onChange,
}: ColorPickerProps) {
  const previewColor = hsvToRgb(color.h, color.s, color.v);

  return (
    <div className="space-y-5">
      {/* Preview + info */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-lg border border-white/10 shrink-0 transition-colors duration-75"
          style={{ backgroundColor: previewColor }}
        />
        <div className="min-w-0">
          <div className="text-xs text-foreground font-medium">
            Key {keyIndex + 1} <span className="text-muted-foreground font-normal">/ Slot {slot}</span>
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
            {color.h} / {color.s} / {color.v}
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-4">
        <SliderRow
          label="H"
          value={color.h}
          className="slider-hue"
          onChange={(h) => onChange(h, color.s, color.v)}
        />
        <SliderRow
          label="S"
          value={color.s}
          className="slider-sat"
          style={{ "--sat-gradient": satGradient(color.h) } as React.CSSProperties}
          onChange={(s) => onChange(color.h, s, color.v)}
        />
        <SliderRow
          label="V"
          value={color.v}
          className="slider-val"
          style={{ "--val-gradient": valGradient(color.h, color.s) } as React.CSSProperties}
          onChange={(v) => onChange(color.h, color.s, v)}
        />
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  className,
  style,
  onChange,
}: {
  label: string;
  value: number;
  className?: string;
  style?: React.CSSProperties;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-muted-foreground w-3 shrink-0">{label}</span>
      <div className={`flex-1 ${className ?? ""}`} style={style}>
        <Slider
          min={0}
          max={255}
          step={1}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
        />
      </div>
      <span className="text-[10px] text-foreground tabular-nums w-7 text-right shrink-0">{value}</span>
    </div>
  );
}
