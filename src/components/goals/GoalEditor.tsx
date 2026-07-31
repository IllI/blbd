'use client';

import { useEffect, useState } from 'react';
import type { Goal, GoalCategory } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';

export interface GoalDraft {
  title: string;
  description: string;
  target_date: string | null;
}

interface GoalEditorProps {
  open: boolean;
  category: GoalCategory;
  position: number;
  goal: Goal | null;
  saving: boolean;
  error: string | null;
  onSave: (draft: GoalDraft) => void;
  onClose: () => void;
}

const PROMPTS: Record<GoalCategory, string> = {
  living: 'Something that would make this life richer — a place, a skill, a repaired relationship.',
  dying: 'Something that would make the ending lighter — a document, a conversation, a gift given early.',
};

export function GoalEditor({
  open,
  category,
  position,
  goal,
  saving,
  error,
  onSave,
  onClose,
}: GoalEditorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');

  // Re-seed the form whenever the modal opens on a different slot.
  useEffect(() => {
    if (!open) return;
    setTitle(goal?.title ?? '');
    setDescription(goal?.description ?? '');
    setTargetDate(goal?.target_date ?? '');
  }, [open, goal]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      target_date: targetDate || null,
    });
  }

  const heading = `${goal ? 'Edit' : 'Add'} ${category === 'living' ? 'living' : 'dying'} goal #${position}`;

  return (
    <Modal open={open} title={heading} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {error && <Alert tone="error">{error}</Alert>}

        <Input
          label="Goal"
          required
          maxLength={200}
          value={title}
          placeholder={category === 'living' ? 'See the Northern Lights' : 'Write the advance directive'}
          hint={PROMPTS[category]}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Textarea
          label="Why it matters"
          rows={4}
          maxLength={2000}
          value={description}
          placeholder="Optional. What does finishing this actually look like?"
          onChange={(e) => setDescription(e.target.value)}
        />

        <Input
          label="Target date"
          type="date"
          value={targetDate}
          hint="Optional. A date makes it real."
          onChange={(e) => setTargetDate(e.target.value)}
        />

        <div className="modal__actions">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!title.trim()}>
            {goal ? 'Save changes' : 'Add goal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
