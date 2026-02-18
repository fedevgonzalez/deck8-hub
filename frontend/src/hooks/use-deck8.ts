import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActiveSlot, AudioDeviceList, RgbMatrixState, SoundEntry, StateSnapshot } from "@/lib/tauri";
import {
  connectDevice,
  getState,
  setKeyColor,
  onSlotToggled,
  onStateUpdated,
  toggleKeySlot as ipcToggleKeySlot,
  setKeycode as ipcSetKeycode,
  setKeyOverride,
  saveCustom,
  restoreDefaults,
  deviceIndication,
  bootloaderJump,
  eepromReset,
  dynamicKeymapReset,
  macroReset,
  setRgbBrightness,
  setRgbEffect,
  setRgbSpeed,
  setRgbColor,
  saveRgbMatrix,
  listAudioDevices,
  setAudioInputDevice,
  setAudioOutputDevice,
  setSoundVolume,
  setMicVolume,
  addToSoundLibrary,
  addToSoundLibraryTrimmed,
  removeFromSoundLibrary,
  renameSound as ipcRenameSound,
  setKeySound,
  previewLibrarySound as ipcPreviewLibrarySound,
  getAudioDuration,
  previewTrim,
} from "@/lib/tauri";

const DEFAULT_STATE: StateSnapshot = {
  connected: false,
  keys: Array.from({ length: 8 }, () => ({
    slot_a: { h: 0x55, s: 0xff, v: 0x78 },
    slot_b: { h: 0x00, s: 0xff, v: 0x78 },
    override_enabled: false,
    active_slot: "A" as const,
  })),
  active_slot: "A",
  keymaps: [0, 0, 0, 0, 0, 0, 0, 0],
  device_info: null,
  rgb_matrix: null,
  audio_config: {
    sound_files: [null, null, null, null, null, null, null, null],
    sound_library: [],
    key_sounds: [null, null, null, null, null, null, null, null],
    audio_input_device: null,
    audio_output_device: null,
    sound_volume: 1.0,
    mic_volume: 1.0,
    soundboard_enabled: false,
  },
};

const DEFAULT_DEVICES: AudioDeviceList = {
  input_devices: [],
  output_devices: [],
};

export function useDeck8() {
  const [state, setState] = useState<StateSnapshot>(DEFAULT_STATE);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [audioDevices, setAudioDevices] = useState<AudioDeviceList>(DEFAULT_DEVICES);
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rgbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Refresh helpers ─────────────────────────────────────

  const refreshState = useCallback(async () => {
    try {
      const s = await getState();
      setState(s);
    } catch {
      // Expected to fail outside Tauri
    }
  }, []);

  // ── Actions ─────────────────────────────────────────────

  const connect = useCallback(
    async (silent = false) => {
      try {
        const ok = await connectDevice();
        if (ok) {
          toast.success("Device connected");
        } else if (!silent) {
          toast.error("Device not found");
        }
        await refreshState();
      } catch (e) {
        if (!silent) toast.error(`Connection error: ${e}`);
      }
    },
    [refreshState],
  );

  const updateKeyColor = useCallback(
    (keyIndex: number, slot: ActiveSlot | "both", h: number, s: number, v: number) => {
      console.log(`[color] key=${keyIndex} slot=${slot} h=${h} s=${s} v=${v}`);
      const color = { h, s, v };
      setState((prev) => {
        const keys = prev.keys.map((k, i) => {
          if (i !== keyIndex) return k;
          if (slot === "both") return { ...k, slot_a: color, slot_b: color };
          return slot === "A"
            ? { ...k, slot_a: color, active_slot: "A" as const }
            : { ...k, slot_b: color, active_slot: "B" as const };
        });
        return { ...prev, keys };
      });

      if (colorTimer.current) clearTimeout(colorTimer.current);
      colorTimer.current = setTimeout(async () => {
        try {
          const activeSlot = slot === "both" ? "A" : slot;
          await setKeyColor(keyIndex, activeSlot, h, s, v);
          if (slot === "both") {
            await setKeyColor(keyIndex, "B", h, s, v);
          }
          console.log(`[color] key=${keyIndex} IPC OK`);
        } catch (e) {
          console.error(`[color] key=${keyIndex} IPC FAIL`, e);
        }
      }, 50);
    },
    [],
  );

  const updateKeycode = useCallback(
    async (keyIndex: number, keycode: number) => {
      // Optimistic update
      setState((prev) => {
        const keymaps = [...prev.keymaps];
        keymaps[keyIndex] = keycode;
        return { ...prev, keymaps };
      });
      try {
        await ipcSetKeycode(keyIndex, keycode);
      } catch (e) {
        toast.error(`Set keycode failed: ${e}`);
      }
    },
    [],
  );

  const toggleKeyOverride = useCallback(
    async (keyIndex: number) => {
      const newEnabled = !state.keys[keyIndex].override_enabled;
      console.log(`[override] key=${keyIndex} → ${newEnabled ? "ON" : "OFF"}`);
      // Optimistic toggle
      setState((prev) => {
        const keys = prev.keys.map((k, i) => {
          if (i !== keyIndex) return k;
          return { ...k, override_enabled: newEnabled };
        });
        return { ...prev, keys };
      });
      try {
        await setKeyOverride(keyIndex, newEnabled);
        console.log(`[override] key=${keyIndex} IPC OK`);
      } catch (e) {
        console.error(`[override] key=${keyIndex} IPC FAIL`, e);
        await refreshState();
      }
    },
    [state.keys, refreshState],
  );

  const doToggleKeySlot = useCallback(
    async (keyIndex: number) => {
      setState((prev) => {
        const oldSlot = prev.keys[keyIndex]?.active_slot ?? "A";
        const newSlot = oldSlot === "A" ? "B" : "A";
        console.log(`[slot-toggle] key=${keyIndex} ${oldSlot}→${newSlot}`);
        toast.info(`Key ${keyIndex + 1}: ${oldSlot} → ${newSlot}`);
        return {
          ...prev,
          keys: prev.keys.map((k, i) => {
            if (i !== keyIndex) return k;
            return { ...k, active_slot: newSlot as ActiveSlot };
          }),
        };
      });
      try {
        await ipcToggleKeySlot(keyIndex);
        console.log(`[slot-toggle] key=${keyIndex} IPC OK`);
      } catch (e) {
        console.error(`[slot-toggle] key=${keyIndex} IPC FAIL`, e);
        await refreshState();
      }
    },
    [refreshState],
  );

  const doSaveCustom = useCallback(async () => {
    try {
      await saveCustom();
    } catch {
      // silent — device might be disconnected
    }
  }, []);

  const doRestoreDefaults = useCallback(async () => {
    try {
      const snapshot = await restoreDefaults();
      setState(snapshot);
      toast.success("Defaults restored");
    } catch (e) {
      toast.error(`Restore failed: ${e}`);
    }
  }, []);

  // ── Device info & control actions ──────────────────────

  const doDeviceIndication = useCallback(async () => {
    try {
      await deviceIndication();
    } catch (e) {
      toast.error(`Identify failed: ${e}`);
    }
  }, []);

  const doBootloaderJump = useCallback(async () => {
    try {
      await bootloaderJump();
      setState((prev) => ({ ...prev, connected: false, device_info: null, rgb_matrix: null }));
      toast.success("Entering bootloader — device will disconnect");
    } catch (e) {
      toast.error(`Bootloader jump failed: ${e}`);
    }
  }, []);

  const doEepromReset = useCallback(async () => {
    try {
      await eepromReset();
      toast.success("EEPROM reset — reconnect device");
    } catch (e) {
      toast.error(`EEPROM reset failed: ${e}`);
    }
  }, []);

  const doDynamicKeymapReset = useCallback(async () => {
    try {
      await dynamicKeymapReset();
      await refreshState();
      toast.success("Keymap reset to defaults");
    } catch (e) {
      toast.error(`Keymap reset failed: ${e}`);
    }
  }, [refreshState]);

  const doMacroReset = useCallback(async () => {
    try {
      await macroReset();
      toast.success("Macros reset");
    } catch (e) {
      toast.error(`Macro reset failed: ${e}`);
    }
  }, []);

  // ── RGB Matrix actions ────────────────────────────────

  const updateRgb = useCallback(
    (field: keyof RgbMatrixState, value: number) => {
      setState((prev) => {
        if (!prev.rgb_matrix) return prev;
        return { ...prev, rgb_matrix: { ...prev.rgb_matrix, [field]: value } };
      });

      if (rgbTimer.current) clearTimeout(rgbTimer.current);
      rgbTimer.current = setTimeout(async () => {
        try {
          switch (field) {
            case "brightness":
              await setRgbBrightness(value);
              break;
            case "effect":
              await setRgbEffect(value);
              break;
            case "speed":
              await setRgbSpeed(value);
              break;
          }
        } catch { /* silent */ }
      }, 50);
    },
    [],
  );

  const updateRgbColor = useCallback(
    (h: number, s: number) => {
      setState((prev) => {
        if (!prev.rgb_matrix) return prev;
        return { ...prev, rgb_matrix: { ...prev.rgb_matrix, color_h: h, color_s: s } };
      });

      if (rgbTimer.current) clearTimeout(rgbTimer.current);
      rgbTimer.current = setTimeout(async () => {
        try {
          await setRgbColor(h, s);
        } catch { /* silent */ }
      }, 50);
    },
    [],
  );

  const doSaveRgb = useCallback(async () => {
    try {
      await saveRgbMatrix();
      toast.success("RGB settings saved to EEPROM");
    } catch (e) {
      toast.error(`Save failed: ${e}`);
    }
  }, []);

  // ── Soundboard actions ──────────────────────────────────

  const refreshAudioDevices = useCallback(async () => {
    try {
      const devices = await listAudioDevices();
      setAudioDevices(devices);
    } catch { /* silent */ }
  }, []);

  const selectAudioInput = useCallback(async (name: string) => {
    setState((prev) => ({
      ...prev,
      audio_config: { ...prev.audio_config, audio_input_device: name },
    }));
    try {
      await setAudioInputDevice(name);
    } catch (e) {
      toast.error(`Set input device failed: ${e}`);
    }
  }, []);

  const selectAudioOutput = useCallback(async (name: string) => {
    setState((prev) => ({
      ...prev,
      audio_config: { ...prev.audio_config, audio_output_device: name },
    }));
    try {
      await setAudioOutputDevice(name);
    } catch (e) {
      toast.error(`Set output device failed: ${e}`);
    }
  }, []);

  const addToLibrary = useCallback(async (filePath: string, displayName: string): Promise<SoundEntry | null> => {
    try {
      const entry = await addToSoundLibrary(filePath, displayName);
      setState((prev) => ({
        ...prev,
        audio_config: {
          ...prev.audio_config,
          sound_library: [...prev.audio_config.sound_library, entry],
        },
      }));
      toast.success(`"${displayName}" added to library`);
      return entry;
    } catch (e) {
      toast.error(`Add to library failed: ${e}`);
      return null;
    }
  }, []);

  const addToLibraryTrimmed = useCallback(async (
    filePath: string,
    displayName: string,
    startMs: number,
    endMs: number,
  ): Promise<SoundEntry | null> => {
    try {
      const entry = await addToSoundLibraryTrimmed(filePath, displayName, startMs, endMs);
      setState((prev) => ({
        ...prev,
        audio_config: {
          ...prev.audio_config,
          sound_library: [...prev.audio_config.sound_library, entry],
        },
      }));
      toast.success(`"${displayName}" added to library (trimmed)`);
      return entry;
    } catch (e) {
      toast.error(`Add trimmed to library failed: ${e}`);
      return null;
    }
  }, []);

  const doRemoveFromLibrary = useCallback(async (soundId: string) => {
    try {
      await removeFromSoundLibrary(soundId);
      setState((prev) => ({
        ...prev,
        audio_config: {
          ...prev.audio_config,
          sound_library: prev.audio_config.sound_library.filter((e) => e.id !== soundId),
          key_sounds: prev.audio_config.key_sounds.map((ks) =>
            ks === soundId ? null : ks,
          ) as (string | null)[],
        },
      }));
    } catch (e) {
      toast.error(`Remove from library failed: ${e}`);
    }
  }, []);

  const doRenameSound = useCallback(async (soundId: string, newName: string) => {
    try {
      await ipcRenameSound(soundId, newName);
      setState((prev) => ({
        ...prev,
        audio_config: {
          ...prev.audio_config,
          sound_library: prev.audio_config.sound_library.map((e) =>
            e.id === soundId ? { ...e, display_name: newName } : e,
          ),
        },
      }));
    } catch (e) {
      toast.error(`Rename failed: ${e}`);
    }
  }, []);

  const doSetKeySound = useCallback(async (keyIndex: number, soundId: string | null) => {
    try {
      await setKeySound(keyIndex, soundId);
      setState((prev) => {
        const keySounds = [...prev.audio_config.key_sounds];
        keySounds[keyIndex] = soundId;
        return {
          ...prev,
          audio_config: { ...prev.audio_config, key_sounds: keySounds },
        };
      });
    } catch (e) {
      toast.error(`Set key sound failed: ${e}`);
    }
  }, []);

  const doPreviewLibrarySound = useCallback(async (soundId: string) => {
    try {
      await ipcPreviewLibrarySound(soundId);
    } catch (e) {
      toast.error(`Preview failed: ${e}`);
    }
  }, []);

  const updateSoundVolume = useCallback((volume: number) => {
    setState((prev) => ({
      ...prev,
      audio_config: { ...prev.audio_config, sound_volume: volume },
    }));
    if (volumeTimer.current) clearTimeout(volumeTimer.current);
    volumeTimer.current = setTimeout(async () => {
      try {
        await setSoundVolume(volume);
      } catch { /* silent */ }
    }, 50);
  }, []);

  const updateMicVolume = useCallback((volume: number) => {
    setState((prev) => ({
      ...prev,
      audio_config: { ...prev.audio_config, mic_volume: volume },
    }));
    if (volumeTimer.current) clearTimeout(volumeTimer.current);
    volumeTimer.current = setTimeout(async () => {
      try {
        await setMicVolume(volume);
      } catch { /* silent */ }
    }, 50);
  }, []);

  // ── Audio trim actions ─────────────────────────────────────

  const getFileDuration = useCallback(async (filePath: string): Promise<number> => {
    try {
      return await getAudioDuration(filePath);
    } catch (e) {
      toast.error(`Get duration failed: ${e}`);
      return 0;
    }
  }, []);

  const previewTrimmedAudio = useCallback(async (sourcePath: string, startMs: number, endMs: number) => {
    try {
      await previewTrim(sourcePath, startMs, endMs);
    } catch (e) {
      toast.error(`Preview failed: ${e}`);
    }
  }, []);

  // ── Initialization + event listener ─────────────────────

  useEffect(() => {
    // Silent auto-connect — no toast on failure
    connect(true);
    // Load audio devices
    refreshAudioDevices();

    // Global toggle (tray menu "Toggle LEDs")
    const unlistenGlobal = onSlotToggled((newSlot) => {
      console.warn(`[GLOBAL EVENT] slot-toggled: all keys → ${newSlot}`);
      setState((prev) => ({
        ...prev,
        active_slot: newSlot as ActiveSlot,
        keys: prev.keys.map((k) => ({
          ...k,
          active_slot: newSlot as ActiveSlot,
        })),
      }));
    });

    // Per-key toggle (physical key press on Deck-8)
    const unlistenState = onStateUpdated((snapshot) => {
      console.log("[STATE EVENT] state-updated from physical key press");
      setState(snapshot);
    });

    return () => {
      unlistenGlobal.then((fn) => fn());
      unlistenState.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    selectedKey,
    setSelectedKey,
    connect: () => connect(false),
    updateKeyColor,
    updateKeycode,
    toggleKeyOverride,
    toggleKeySlot: doToggleKeySlot,
    saveCustom: doSaveCustom,
    restoreDefaults: doRestoreDefaults,
    deviceIndication: doDeviceIndication,
    bootloaderJump: doBootloaderJump,
    eepromReset: doEepromReset,
    dynamicKeymapReset: doDynamicKeymapReset,
    macroReset: doMacroReset,
    updateRgb,
    updateRgbColor,
    saveRgb: doSaveRgb,
    // Soundboard
    audioDevices,
    refreshAudioDevices,
    selectAudioInput,
    selectAudioOutput,
    updateSoundVolume,
    updateMicVolume,
    // Sound library
    addToLibrary,
    addToLibraryTrimmed,
    removeFromLibrary: doRemoveFromLibrary,
    renameSound: doRenameSound,
    setKeySound: doSetKeySound,
    previewLibrarySound: doPreviewLibrarySound,
    // Audio trim
    getFileDuration,
    previewTrimmedAudio,
  };
}
