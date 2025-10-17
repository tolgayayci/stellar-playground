use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;

/// Helper function to recursively copy directories
pub fn copy_dir_all(src: &PathBuf, dst: &PathBuf) -> Result<()> {
    fs::create_dir_all(dst).context("Failed to create destination directory")?;

    for entry in fs::read_dir(src).context("Failed to read source directory")? {
        let entry = entry.context("Failed to read directory entry")?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            // Skip target directory and .git directory to avoid copying build artifacts
            if let Some(dir_name) = src_path.file_name() {
                if dir_name == "target" || dir_name == ".git" {
                    continue;
                }
            }
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)
                .with_context(|| format!("Failed to copy file: {:?}", src_path))?;
        }
    }

    Ok(())
}

/// Helper function to ensure projects directory exists
pub fn ensure_projects_dir() -> Result<PathBuf> {
    let projects_dir = PathBuf::from("projects");
    if !projects_dir.exists() {
        fs::create_dir_all(&projects_dir)
            .context("Failed to create projects directory")?;
    }
    Ok(projects_dir)
}
