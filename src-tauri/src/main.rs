#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Temporary file logging for debugging
    let log_path = dirs::config_dir()
        .unwrap_or_default()
        .join("deck8-hub")
        .join("debug.log");
    let log_file = std::fs::File::create(&log_path).ok();

    let mut builder = env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info"),
    );
    builder.format_timestamp_millis();
    if let Some(file) = log_file {
        let file = std::sync::Mutex::new(file);
        let start = std::time::Instant::now();
        builder.format(move |buf, record| {
            use std::io::Write;
            let elapsed = start.elapsed().as_millis();
            let line = format!("[{:>6}ms] [{}] {}\n", elapsed, record.level(), record.args());
            let _ = buf.write_all(line.as_bytes());
            if let Ok(mut f) = file.lock() {
                let _ = f.write_all(line.as_bytes());
                let _ = f.flush();
            }
            Ok(())
        });
    }
    builder.init();
    deck8_hub::run();
}
