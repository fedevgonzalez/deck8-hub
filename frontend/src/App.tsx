import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Toolbar } from "@/components/toolbar";
import { ColorView } from "@/components/color-view";
import { KeyAssignmentView } from "@/components/key-assignment-view";
import { SettingsView } from "@/components/settings-view";
import { SoundView } from "@/components/sound-view";
import { useDeck8 } from "@/hooks/use-deck8";
import { Unplug, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

import { useState } from "react";

const isTauri = "__TAURI_INTERNALS__" in window;

export default function App() {
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const {
    state,
    connecting,
    selectedKey,
    setSelectedKey,
    connect,
    updateKeyColor,
    updateKeycode,
    toggleKeyOverride,
    toggleKeySlot,
    saveCustom,
    restoreDefaults,
    bootloaderJump,
    eepromReset,
    dynamicKeymapReset,
    macroReset,
    updateRgb,
    updateRgbColor,
    saveRgb,
    audioDevices,
    refreshAudioDevices,
    selectAudioInput,
    selectAudioOutput,
    updateSoundVolume,
    updateMicVolume,
    addToLibrary,
    addToLibraryTrimmed,
    removeFromLibrary,
    renameSound,
    setKeySound,
    previewLibrarySound,
    getFileDuration,
    previewTrimmedAudio,
  } = useDeck8();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full select-none">
        {/* Connection indicator line — 2px bar at the very top */}
        <div
          className={cn(
            "h-[2px] shrink-0 transition-colors duration-300",
            connecting
              ? "bg-amber-500 shadow-[0_1px_8px_-1px_rgba(251,191,36,0.4)]"
              : state.connected
                ? "bg-emerald-500 shadow-[0_1px_8px_-1px_rgba(52,211,153,0.4)]"
                : "bg-red-500/70 shadow-[0_1px_8px_-1px_rgba(239,68,68,0.3)]",
          )}
        />

        {/* Main content with tabs — Toolbar is inside Tabs so TabsList works */}
        <Tabs defaultValue="keys" className="flex flex-col flex-1 min-h-0 !gap-0">
          {/* Unified toolbar: brand + tabs + connection */}
          <Toolbar
            connected={state.connected}
            connecting={connecting}
            onReconnect={connect}
          />

          <TabsContent value="keys" className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in">
            <KeyAssignmentView
              keys={state.keys}
              keymaps={state.keymaps}
              connected={state.connected}
              onKeycodeChange={updateKeycode}
              soundLibrary={state.audio_config.sound_library}
              keySounds={state.audio_config.key_sounds}
              onSetKeySound={setKeySound}
              onPreviewLibrarySound={previewLibrarySound}
              onGetDuration={getFileDuration}
              onPreviewTrim={previewTrimmedAudio}
              onAddToLibrary={addToLibrary}
              onAddToLibraryTrimmed={addToLibraryTrimmed}
            />
          </TabsContent>

          <TabsContent value="color" className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in">
            <ColorView
              keys={state.keys}
              selectedKey={selectedKey}
              onSelectKey={(i) => setSelectedKey(i === -1 ? null : i)}
              onColorChange={updateKeyColor}
              onToggleOverride={toggleKeyOverride}
              onToggleKeySlot={toggleKeySlot}
              onSaveCustom={saveCustom}
            />
          </TabsContent>

          <TabsContent value="sound" className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in">
            <SoundView
              audioConfig={state.audio_config}
              audioDevices={audioDevices}
              onSelectInput={selectAudioInput}
              onSelectOutput={selectAudioOutput}
              onSoundVolumeChange={updateSoundVolume}
              onMicVolumeChange={updateMicVolume}
              onRefreshDevices={refreshAudioDevices}
              onGetDuration={getFileDuration}
              onPreviewTrim={previewTrimmedAudio}
              onAddToLibrary={addToLibrary}
              onAddToLibraryTrimmed={addToLibraryTrimmed}
              onRemoveFromLibrary={removeFromLibrary}
              onRenameSound={renameSound}
              onSetKeySound={setKeySound}
              onPreviewLibrarySound={previewLibrarySound}
            />
          </TabsContent>

          <TabsContent value="settings" className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in">
            <SettingsView
              rgbMatrix={state.rgb_matrix}
              connected={state.connected}
              onRgbChange={updateRgb}
              onRgbColorChange={updateRgbColor}
              onRgbSave={saveRgb}
              onRestoreDefaults={restoreDefaults}
              onBootloaderJump={bootloaderJump}
              onEepromReset={eepromReset}
              onDynamicKeymapReset={dynamicKeymapReset}
              onMacroReset={macroReset}
            />
          </TabsContent>
        </Tabs>

        {/* Connection overlay — only in Tauri, not in browser dev mode */}
        {isTauri && !state.connected && !overlayDismissed && (
          <div className="connection-overlay fixed inset-0 z-50 flex items-center justify-center bg-[#09090b]/80 backdrop-blur-sm animate-fade-in">
            <div className="flex flex-col items-center gap-5 p-8 max-w-xs text-center">
              {connecting ? (
                <>
                  {/* Syncing spinner */}
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-amber-500/20 flex items-center justify-center">
                    <RefreshCw className="w-7 h-7 text-amber-400/60 animate-spin" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="font-pixel text-sm text-amber-400/70 font-bold uppercase tracking-wider">
                      Syncing
                    </h2>
                    <p className="font-clean text-[11px] text-white/30 leading-relaxed">
                      Connecting to your Deck-8 and syncing key configuration…
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Disconnected state */}
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                      <Unplug className="w-7 h-7 text-white/20" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse-subtle" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="font-pixel text-sm text-white/70 font-bold uppercase tracking-wider">
                      No Device
                    </h2>
                    <p className="font-clean text-[11px] text-white/30 leading-relaxed">
                      Connect your Deck-8 via USB and click reconnect, or the app will auto-detect on plug-in.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.08] border border-white/15 text-white/70 hover:bg-white/[0.14] hover:text-white/90 hover:border-white/25 transition-all duration-150 font-clean text-[11px] font-bold"
                    onClick={connect}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reconnect
                  </button>
                  <button
                    type="button"
                    className="font-clean text-[9px] text-white/15 hover:text-white/30 transition-colors"
                    onClick={() => setOverlayDismissed(true)}
                  >
                    continue without device
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <Toaster position="top-right" richColors />
    </TooltipProvider>
  );
}
