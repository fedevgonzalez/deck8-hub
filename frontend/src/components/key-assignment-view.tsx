import { useCallback, useState } from "react";
import { KeyGrid } from "@/components/key-grid";
import { KeyEditorDialog } from "@/components/key-editor-dialog";
import { SoundUploadDialog } from "@/components/sound-upload-dialog";
import { keycodeToLabel } from "@/lib/keycodes";
import { Unplug } from "lucide-react";
import { isInternalKeycode } from "@/lib/tauri";
import type { KeyConfig, SoundEntry } from "@/lib/tauri";

/**
 * Maps LED index → matrix index.
 * LEDs snake on the PCB: top row L→R (0-3), bottom row R→L (7-4 physically).
 * The key matrix is always L→R: top (0-3), bottom (4-7).
 * So LED 7 = physical bottom-left = matrix 4, LED 4 = bottom-right = matrix 7.
 */
const LED_TO_MATRIX = [0, 1, 2, 3, 7, 6, 5, 4];

interface KeyAssignmentViewProps {
  keys: KeyConfig[];
  keymaps: number[];
  connected: boolean;
  onKeycodeChange: (keyIndex: number, keycode: number) => void;
  soundLibrary: SoundEntry[];
  keySounds: (string | null)[];
  onSetKeySound: (keyIndex: number, soundId: string | null) => void;
  onPreviewLibrarySound: (soundId: string) => void;
  onGetDuration: (filePath: string) => Promise<number>;
  onPreviewTrim: (sourcePath: string, startMs: number, endMs: number) => void;
  onAddToLibrary: (filePath: string, displayName: string) => Promise<SoundEntry | null>;
  onAddToLibraryTrimmed: (filePath: string, displayName: string, startMs: number, endMs: number) => Promise<SoundEntry | null>;
}

export function KeyAssignmentView({
  keys,
  keymaps,
  connected,
  onKeycodeChange,
  soundLibrary,
  keySounds,
  onSetKeySound,
  onPreviewLibrarySound,
  onGetDuration,
  onPreviewTrim,
  onAddToLibrary,
  onAddToLibraryTrimmed,
}: KeyAssignmentViewProps) {
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Remap keycodeLabels from matrix order to LED order so KeyGrid
  // (which iterates by LED index) shows the correct keycode per position.
  // Internal keycodes (auto-assigned for sound-only keys) show as empty.
  const keycodeLabels = LED_TO_MATRIX.map((matrixIdx) => {
    const kc = keymaps[matrixIdx];
    return isInternalKeycode(kc) ? "" : keycodeToLabel(kc);
  });

  // Resolve sound names for each key (by LED/hw index)
  const soundNames = Array.from({ length: 8 }, (_, hwIndex) => {
    const soundId = keySounds[hwIndex];
    if (!soundId) return null;
    const entry = soundLibrary.find((e) => e.id === soundId);
    return entry?.display_name ?? null;
  });

  const handleKeyClick = (ledIndex: number) => {
    setSelectedKey(ledIndex);
    setEditorOpen(true);
  };

  // Convert selected LED index to matrix index for keymap operations
  const matrixIndex = selectedKey !== null ? LED_TO_MATRIX[selectedKey] : null;

  const handleAddSoundFromDialog = useCallback(() => {
    setUploadOpen(true);
  }, []);

  return (
    <div className="flex flex-1 min-h-0 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="surface p-4">
          <KeyGrid
            keys={keys}
            selectedKey={selectedKey}
            onSelectKey={handleKeyClick}
            mode="keycode"
            keycodeLabels={keycodeLabels}
            soundNames={soundNames}
          />
        </div>
        {!connected && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] animate-fade-in">
            <Unplug className="w-3 h-3 text-white/20 shrink-0" />
            <span className="text-[10px] text-white/25 font-medium">
              Connect device to read/write key assignments
            </span>
          </div>
        )}
      </div>

      {selectedKey !== null && matrixIndex !== null && (
        <KeyEditorDialog
          open={editorOpen}
          keyIndex={selectedKey}
          currentKeycode={keymaps[matrixIndex]}
          onSave={(keycode) => onKeycodeChange(matrixIndex, keycode)}
          onClose={() => {
            setEditorOpen(false);
            setSelectedKey(null);
          }}
          soundLibrary={soundLibrary}
          currentSoundId={keySounds[selectedKey] ?? null}
          onSoundChange={(soundId) => onSetKeySound(selectedKey, soundId)}
          onPreviewSound={onPreviewLibrarySound}
          onAddSound={handleAddSoundFromDialog}
        />
      )}

      <SoundUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onGetDuration={onGetDuration}
        onPreviewTrim={onPreviewTrim}
        onAddToLibrary={onAddToLibrary}
        onAddToLibraryTrimmed={onAddToLibraryTrimmed}
      />
    </div>
  );
}
