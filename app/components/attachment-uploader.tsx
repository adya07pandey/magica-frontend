"use client";

import { FileImage, LoaderCircle, Upload, X } from "lucide-react";
import { useId, useState } from "react";

import { uploadFiles, type GetToken } from "../lib/api-client";

const acceptedFileTypes =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/wav";
const maxFileBytes = 512 * 1024 * 1024;

export function AttachmentUploader({
  open,
  taskId,
  getToken,
  onClose,
  onUploaded,
}: {
  open: boolean;
  taskId?: string;
  getToken: GetToken;
  onClose: () => void;
  onUploaded: (taskId: string) => void | Promise<void>;
}) {
  const inputId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const chooseFiles = (selected: File[]) => {
    setError(null);
    if (selected.length > 10) {
      setError("Choose no more than 10 files.");
      return;
    }
    const tooLarge = selected.find((file) => file.size > maxFileBytes);
    if (tooLarge) {
      setError(`${tooLarge.name} is larger than 512 MB.`);
      return;
    }
    setFiles(selected);
  };

  const upload = async () => {
    if (files.length === 0 || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadFiles(getToken, files, taskId);
      await onUploaded(result.taskId);
      setFiles([]);
      onClose();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload the selected files",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="upload-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Upload media"
    >
      <section className="upload-shell">
        <header className="upload-header">
          <div>
            <strong>Upload media</strong>
            <span>Images, video, or audio</span>
          </div>
          <button
            type="button"
            className="upload-close"
            onClick={onClose}
            aria-label="Close upload dialog"
            disabled={uploading}
          >
            <X size={20} />
          </button>
        </header>

        <label className="upload-dropzone" htmlFor={inputId}>
          <Upload size={28} />
          <strong>Choose files from your device</strong>
          <span>Up to 10 files, 512 MB each</span>
        </label>
        <input
          id={inputId}
          className="upload-input"
          type="file"
          accept={acceptedFileTypes}
          multiple
          disabled={uploading}
          onChange={(event) =>
            chooseFiles(Array.from(event.currentTarget.files ?? []))
          }
        />

        {files.length > 0 && (
          <div className="upload-file-list">
            {files.map((file) => (
              <div key={`${file.name}-${file.size}-${file.lastModified}`}>
                <FileImage size={18} />
                <span>{file.name}</span>
                <small>{formatBytes(file.size)}</small>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="upload-inline-error" role="alert">
            {error}
          </p>
        )}

        <footer className="upload-actions">
          <button type="button" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button
            type="button"
            className="upload-submit"
            onClick={() => void upload()}
            disabled={files.length === 0 || uploading}
          >
            {uploading ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Upload size={18} />
            )}
            {uploading
              ? "Uploading"
              : `Upload${files.length > 1 ? ` ${files.length} files` : ""}`}
          </button>
        </footer>
      </section>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
