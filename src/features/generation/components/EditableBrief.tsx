"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, X, Check, Loader2 } from "lucide-react";

interface EditableBriefProps {
  briefText: string;
  /** Whether editing is allowed in the current phase */
  canEdit: boolean;
  /** Called when user submits a new brief */
  onEdit: (newText: string) => void;
  /** Whether the edit mutation is in progress */
  isEditing?: boolean;
}

export function EditableBrief({
  briefText,
  canEdit,
  onEdit,
  isEditing = false,
}: EditableBriefProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draft, setDraft] = useState(briefText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft when briefText changes externally
  useEffect(() => {
    if (!isEditMode) {
      setDraft(briefText);
    }
  }, [briefText, isEditMode]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditMode && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditMode]);

  // Exit edit mode when mutation succeeds
  useEffect(() => {
    if (!isEditing && isEditMode) {
      setIsEditMode(false);
    }
  }, [isEditing, isEditMode]);

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === briefText) {
      setIsEditMode(false);
      setDraft(briefText);
      return;
    }
    onEdit(trimmed);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setDraft(briefText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
    if (e.key === "Enter" && e.metaKey) {
      handleSubmit();
    }
  };

  if (isEditMode) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--accent)]/40 bg-[var(--background-elevated)]/60 px-6 py-5 backdrop-blur-sm">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
          Edit your brief
        </p>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isEditing}
          rows={3}
          maxLength={2000}
          className="mt-2 w-full resize-none bg-transparent text-base leading-relaxed text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none disabled:opacity-50"
          placeholder="Describe your vision..."
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-[var(--foreground-subtle)]">
            {"\u2318"}+Enter to save &middot; Esc to cancel
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isEditing}
              className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background-overlay)] hover:text-[var(--foreground)] disabled:opacity-50"
              aria-label="Cancel editing"
            >
              <X className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isEditing || draft.trim().length === 0}
              className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--background)] transition-colors hover:bg-[var(--accent)]/90 disabled:opacity-50"
              aria-label="Save brief"
            >
              {isEditing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-[var(--radius-md)] border border-[var(--border)]/40 bg-[var(--background-elevated)]/60 px-6 py-5 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
          Your brief
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => setIsEditMode(true)}
            className="flex size-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--foreground-subtle)] opacity-0 transition-all hover:bg-[var(--background-overlay)] hover:text-[var(--foreground)] group-hover:opacity-100"
            aria-label="Edit brief"
          >
            <Pencil className="size-3" />
          </button>
        )}
      </div>
      <p className="mt-2 text-base leading-relaxed text-[var(--foreground)]">
        &ldquo;{briefText}&rdquo;
      </p>
    </div>
  );
}
