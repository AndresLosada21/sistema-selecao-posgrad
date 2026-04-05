"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

type FileFieldProps = {
  label: string;
  accept?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  onFileSelect: (file: File) => void;
};

export function FileField({
  label,
  accept = "application/pdf",
  hint,
  error,
  disabled = false,
  onFileSelect,
}: FileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function getAcceptLabel() {
    if (accept === "application/pdf") {
      return "Apenas PDF";
    }

    if (accept === "image/png,image/jpeg") {
      return "PNG ou JPEG";
    }

    return accept;
  }

  function handleClick() {
    if (!disabled) inputRef.current?.click();
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFileSelect(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = event.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (!disabled) setDragOver(true);
  }

  return (
    <div className="file-field">
      <span className="form-field-label">{label}</span>
      <button
        type="button"
        className={`file-field-dropzone ${dragOver ? "file-field-dropzone--active" : ""} ${disabled ? "file-field-dropzone--disabled" : ""}`}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        disabled={disabled}
      >
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
        <span className="file-field-dropzone-text">Arraste o arquivo ou clique para selecionar</span>
        <span className="file-field-dropzone-hint">
          {getAcceptLabel()} · Maximo 10 MB
        </span>
      </button>
      {error ? (
        <span className="form-field-error">{error}</span>
      ) : hint ? (
        <span className="form-field-hint">{hint}</span>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        style={{ display: "none" }}
      />
    </div>
  );
}
