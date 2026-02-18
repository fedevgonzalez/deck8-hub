use anyhow::{Context, Result};
use log::{error, info};
use ringbuf::{
    traits::{Consumer, Producer, Split},
    HeapRb,
};
use rodio::cpal::{
    self,
    traits::{DeviceTrait, HostTrait, StreamTrait},
};
use rodio::{Decoder, OutputStream, Sink, Source};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::state::SoundEntry;

// ── Types ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDeviceInfo {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDeviceList {
    pub input_devices: Vec<AudioDeviceInfo>,
    pub output_devices: Vec<AudioDeviceInfo>,
}

// ── Device enumeration ──────────────────────────────────────────────

pub fn list_devices() -> AudioDeviceList {
    let host = cpal::default_host();

    let input_devices = host
        .input_devices()
        .map(|devs| {
            devs.filter_map(|d| {
                d.name().ok().map(|name| AudioDeviceInfo { name })
            })
            .collect()
        })
        .unwrap_or_default();

    let output_devices = host
        .output_devices()
        .map(|devs| {
            devs.filter_map(|d| {
                d.name().ok().map(|name| AudioDeviceInfo { name })
            })
            .collect()
        })
        .unwrap_or_default();

    AudioDeviceList {
        input_devices,
        output_devices,
    }
}

fn find_input_device(name: &str) -> Option<cpal::Device> {
    let host = cpal::default_host();
    host.input_devices().ok()?.find(|d| {
        d.name().map(|n| n == name).unwrap_or(false)
    })
}

fn find_output_device(name: &str) -> Option<cpal::Device> {
    let host = cpal::default_host();
    host.output_devices().ok()?.find(|d| {
        d.name().map(|n| n == name).unwrap_or(false)
    })
}

// ── Sound file management ───────────────────────────────────────────

pub fn sounds_dir() -> Result<PathBuf> {
    let base = dirs::config_dir().context("Cannot determine config directory")?;
    let dir = base.join("deck8-hub").join("sounds");
    if !dir.exists() {
        fs::create_dir_all(&dir).context("Failed to create sounds directory")?;
    }
    Ok(dir)
}

pub fn delete_sound(filename: &str) -> Result<()> {
    let path = sounds_dir()?.join(filename);
    if path.exists() {
        fs::remove_file(&path).context("Failed to delete sound file")?;
        info!("[audio] Deleted sound: {}", filename);
    }
    Ok(())
}

pub fn resolve_sound_path(filename: &str) -> Result<PathBuf> {
    let path = sounds_dir()?.join(filename);
    if !path.exists() {
        anyhow::bail!("Sound file not found: {}", filename);
    }
    Ok(path)
}

/// Simple timestamp-based unique ID (no extra crate needed).
pub fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let d = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{:x}{:04x}", d.as_secs(), d.subsec_millis())
}

// ── Sound Library imports ───────────────────────────────────────────

/// Import a sound file into the library. Copies file to sounds_dir with a unique filename.
pub fn import_to_library(source_path: &str, display_name: &str) -> Result<SoundEntry> {
    let src = Path::new(source_path);
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("wav");
    let id = uuid_simple();
    let filename = format!("{}.{}", id, ext);
    let dest = sounds_dir()?.join(&filename);
    fs::copy(src, &dest).context("Failed to copy sound file")?;
    info!("[audio] Library import: {} → {}", source_path, dest.display());
    Ok(SoundEntry {
        id,
        filename,
        display_name: display_name.to_string(),
    })
}

/// Import a sound file into the library with trimming. Saves as WAV.
pub fn import_to_library_trimmed(
    source_path: &str,
    display_name: &str,
    start_ms: u64,
    end_ms: u64,
) -> Result<SoundEntry> {
    let file = fs::File::open(source_path)
        .context(format!("Cannot open: {}", source_path))?;
    let reader = BufReader::new(file);
    let source = Decoder::new(reader).context("Failed to decode audio")?;

    let sample_rate = source.sample_rate();
    let channels = source.channels();

    let start_sample = (start_ms as usize) * (sample_rate as usize) * (channels as usize) / 1000;
    let end_sample = (end_ms as usize) * (sample_rate as usize) * (channels as usize) / 1000;

    let samples: Vec<f32> = source
        .skip(start_sample)
        .take(end_sample - start_sample)
        .map(|s| s as f32 / 32768.0)
        .collect();

    if samples.is_empty() {
        anyhow::bail!("Trimmed audio is empty");
    }

    let id = uuid_simple();
    let filename = format!("{}.wav", id);
    let dest = sounds_dir()?.join(&filename);

    let spec = hound::WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };
    let mut writer = hound::WavWriter::create(&dest, spec)
        .context("Failed to create WAV file")?;

    for sample in &samples {
        writer.write_sample(*sample).context("Failed to write sample")?;
    }
    writer.finalize().context("Failed to finalize WAV")?;

    info!(
        "[audio] Library trim import {}ms-{}ms → {} ({} samples, {}ch @ {}Hz)",
        start_ms, end_ms, filename, samples.len(), channels, sample_rate
    );
    Ok(SoundEntry {
        id,
        filename,
        display_name: display_name.to_string(),
    })
}

// ── Audio trim & duration ───────────────────────────────────────────

/// Get the duration of an audio file in milliseconds.
pub fn get_audio_duration(file_path: &str) -> Result<u64> {
    let file = fs::File::open(file_path)
        .context(format!("Cannot open: {}", file_path))?;
    let reader = BufReader::new(file);
    let source = Decoder::new(reader).context("Failed to decode audio")?;
    let sample_rate = source.sample_rate() as u64;
    let channels = source.channels() as u64;
    // Count total samples
    let total_samples: u64 = source.count() as u64;
    if sample_rate == 0 || channels == 0 {
        return Ok(0);
    }
    let frames = total_samples / channels;
    Ok(frames * 1000 / sample_rate)
}

/// Preview a trimmed portion of an audio file through the default output device.
pub fn preview_trim(source_path: &str, start_ms: u64, end_ms: u64) -> Result<()> {
    let file = fs::File::open(source_path)
        .context(format!("Cannot open: {}", source_path))?;
    let reader = BufReader::new(file);
    let source = Decoder::new(reader).context("Failed to decode audio")?;

    let sample_rate = source.sample_rate();
    let channels = source.channels();

    let start_sample = (start_ms as usize) * (sample_rate as usize) * (channels as usize) / 1000;
    let end_sample = (end_ms as usize) * (sample_rate as usize) * (channels as usize) / 1000;

    // Collect trimmed samples into a buffer (Decoder yields i16, convert to f32)
    let samples: Vec<f32> = source
        .skip(start_sample)
        .take(end_sample - start_sample)
        .map(|s| s as f32 / 32768.0)
        .collect();

    if samples.is_empty() {
        anyhow::bail!("Trimmed audio is empty");
    }

    // Play through default output (speakers) for preview.
    // OutputStream contains cpal::Stream which is !Send on Windows,
    // so we spawn a new thread that owns both the stream and sink.
    std::thread::spawn(move || {
        let Ok((_stream, handle)) = OutputStream::try_default() else {
            error!("[audio] Failed to open default output for preview");
            return;
        };
        let Ok(sink) = Sink::try_new(&handle) else {
            error!("[audio] Failed to create preview sink");
            return;
        };
        let buffer = rodio::buffer::SamplesBuffer::new(channels, sample_rate, samples);
        sink.append(buffer);
        sink.sleep_until_end();
    });

    Ok(())
}

// ── MicSource (rodio::Source reading from ring buffer) ───────────────

struct MicSource {
    consumer: ringbuf::HeapCons<f32>,
    sound_consumer: ringbuf::HeapCons<f32>,
    channels: u16,
    sample_rate: u32,
    volume: Arc<AtomicU32>,
    sound_volume: Arc<AtomicU32>,
}

impl Iterator for MicSource {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        let mic_sample = self.consumer.try_pop().unwrap_or(0.0);
        let vol = f32::from_bits(self.volume.load(Ordering::Relaxed));

        let sound_sample = self.sound_consumer.try_pop().unwrap_or(0.0);
        let svol = f32::from_bits(self.sound_volume.load(Ordering::Relaxed));

        // Mix mic + sound into a single stream so Discord sees sound as mic input
        Some(mic_sample * vol + sound_sample * svol)
    }
}

impl Source for MicSource {
    fn current_frame_len(&self) -> Option<usize> {
        None
    }

    fn channels(&self) -> u16 {
        self.channels
    }

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn total_duration(&self) -> Option<Duration> {
        None // infinite stream
    }
}

// ── AudioPipeline ───────────────────────────────────────────────────

pub struct AudioPipeline {
    _input_stream: cpal::Stream,
    _output_stream: OutputStream,
    mic_volume: Arc<AtomicU32>,
    sound_volume: Arc<AtomicU32>,
    _mic_sink: Sink,
    // Sound injection: decoded samples are pushed here and mixed into the mic stream
    sound_producer: Mutex<ringbuf::HeapProd<f32>>,
    pipeline_channels: u16,
    pipeline_sample_rate: u32,
}

// SAFETY: AudioPipeline is created and dropped on the main thread.
// cpal::Stream is !Send on Windows due to COM, but we never move it
// between threads — only the Arc<AtomicU32> volumes and Mutex<HeapProd>
// are accessed from Tauri command threads, and those are inherently thread-safe.
unsafe impl Send for AudioPipeline {}
unsafe impl Sync for AudioPipeline {}

impl AudioPipeline {
    pub fn start(
        input_device_name: &str,
        output_device_name: &str,
        mic_vol: f32,
        sound_vol: f32,
    ) -> Result<Self> {
        // Find devices
        let input_dev = find_input_device(input_device_name)
            .context(format!("Input device not found: {}", input_device_name))?;
        let output_dev = find_output_device(output_device_name)
            .context(format!("Output device not found: {}", output_device_name))?;

        info!(
            "[audio] Starting pipeline: input={} output={}",
            input_device_name, output_device_name
        );

        // Get input config
        let input_config = input_dev
            .default_input_config()
            .context("No default input config")?;
        let channels = input_config.channels();
        let sample_rate = input_config.sample_rate().0;

        info!(
            "[audio] Input: {}ch @ {}Hz",
            channels, sample_rate
        );

        // Ring buffer: ~1 second of mic audio
        let buf_size = (sample_rate as usize) * (channels as usize);
        let rb = HeapRb::<f32>::new(buf_size);
        let (mut producer, consumer) = rb.split();

        // Ring buffer for sound injection: ~30 seconds capacity
        let sound_buf_size = (sample_rate as usize) * (channels as usize) * 30;
        let sound_rb = HeapRb::<f32>::new(sound_buf_size);
        let (sound_producer, sound_consumer) = sound_rb.split();

        // Shared volumes (lock-free via AtomicU32)
        let mic_volume = Arc::new(AtomicU32::new(mic_vol.to_bits()));
        let sound_volume = Arc::new(AtomicU32::new(sound_vol.to_bits()));

        // cpal input stream → ring buffer
        let input_stream = input_dev
            .build_input_stream(
                &input_config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    for &sample in data {
                        let _ = producer.try_push(sample);
                    }
                },
                move |err| {
                    error!("[audio] Input stream error: {}", err);
                },
                None,
            )
            .context("Failed to build input stream")?;

        input_stream.play().context("Failed to start input stream")?;

        // rodio output stream on the selected output device
        let (output_stream, output_handle) = OutputStream::try_from_device(&output_dev)
            .context("Failed to open output stream on selected device")?;

        // Create MicSource that mixes mic + sound and play through a Sink (infinite)
        let mic_source = MicSource {
            consumer,
            sound_consumer,
            channels,
            sample_rate,
            volume: Arc::clone(&mic_volume),
            sound_volume: Arc::clone(&sound_volume),
        };

        let mic_sink = Sink::try_new(&output_handle)
            .context("Failed to create mic sink")?;
        mic_sink.append(mic_source);

        info!("[audio] Pipeline started successfully");

        Ok(Self {
            _input_stream: input_stream,
            _output_stream: output_stream,
            mic_volume,
            sound_volume,
            _mic_sink: mic_sink,
            sound_producer: Mutex::new(sound_producer),
            pipeline_channels: channels,
            pipeline_sample_rate: sample_rate,
        })
    }

    pub fn play_sound(&self, path: &Path) -> Result<()> {
        // Inject into mic stream (mixed with mic → virtual cable → Discord)
        // Decode, convert to pipeline format, push to sound ring buffer
        {
            let file = fs::File::open(path)
                .context(format!("Cannot open sound: {}", path.display()))?;
            let reader = BufReader::new(file);
            let source = Decoder::new(reader)
                .context("Failed to decode audio file")?;

            let src_rate = source.sample_rate();
            let src_channels = source.channels();
            let dst_rate = self.pipeline_sample_rate;
            let dst_channels = self.pipeline_channels;

            // Collect all samples as f32 (normalized to [-1, 1])
            let raw: Vec<f32> = source.convert_samples::<f32>().collect();

            // Channel conversion
            let chan_converted: Vec<f32> = if src_channels == 2 && dst_channels == 1 {
                raw.chunks(2)
                    .map(|c| (c[0] + c.get(1).copied().unwrap_or(0.0)) / 2.0)
                    .collect()
            } else if src_channels == 1 && dst_channels == 2 {
                raw.iter().flat_map(|&s| [s, s]).collect()
            } else {
                raw
            };

            // Sample rate conversion (linear interpolation)
            let resampled = if src_rate != dst_rate {
                let ratio = src_rate as f64 / dst_rate as f64;
                let out_len = (chan_converted.len() as f64 / ratio) as usize;
                let mut out = Vec::with_capacity(out_len);
                for i in 0..out_len {
                    let src_pos = i as f64 * ratio;
                    let idx = src_pos as usize;
                    let frac = (src_pos - idx as f64) as f32;
                    let s0 = chan_converted.get(idx).copied().unwrap_or(0.0);
                    let s1 = chan_converted.get(idx + 1).copied().unwrap_or(s0);
                    out.push(s0 + (s1 - s0) * frac);
                }
                out
            } else {
                chan_converted
            };

            // Push to sound ring buffer (MicSource will mix it with mic)
            if let Ok(mut prod) = self.sound_producer.lock() {
                for &sample in &resampled {
                    let _ = prod.try_push(sample);
                }
                info!(
                    "[audio] Injected {} samples into mic stream ({}ch @ {}Hz)",
                    resampled.len(), dst_channels, dst_rate
                );
            }
        }

        // Also play through default output (headphones) so the user hears it
        let vol = f32::from_bits(self.sound_volume.load(Ordering::Relaxed));
        let path_clone = path.to_path_buf();
        std::thread::spawn(move || {
            let Ok((_stream, handle)) = OutputStream::try_default() else { return; };
            let Ok(sink) = Sink::try_new(&handle) else { return; };
            let Ok(file) = fs::File::open(&path_clone) else { return; };
            let reader = BufReader::new(file);
            let Ok(source) = Decoder::new(reader) else { return; };
            sink.set_volume(vol);
            sink.append(source);
            sink.sleep_until_end();
        });

        Ok(())
    }

    pub fn set_mic_volume(&self, vol: f32) {
        self.mic_volume.store(vol.to_bits(), Ordering::Relaxed);
    }

    pub fn set_sound_volume(&self, vol: f32) {
        self.sound_volume.store(vol.to_bits(), Ordering::Relaxed);
    }
}
