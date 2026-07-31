'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Goal, GoalCategory, MembershipTier } from '@/lib/types';
import { goalSlots } from '@/lib/tiers';
import { createClient } from '@/lib/supabase/client';
import { Alert } from '@/components/ui/Alert';
import { GoalColumn } from './GoalColumn';
import { GoalEditor, type GoalDraft } from './GoalEditor';

interface EditorState {
  category: GoalCategory;
  position: number;
  goal: Goal | null;
}

export function GoalsBoard({
  userId,
  tier,
  initialGoals,
}: {
  userId: string;
  tier: MembershipTier;
  initialGoals: Goal[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const unlockedSlots = goalSlots(tier);

  const byCategory = useCallback(
    (category: GoalCategory) => goals.filter((goal) => goal.category === category),
    [goals],
  );

  async function saveGoal(draft: GoalDraft) {
    if (!editor) return;
    setSaving(true);
    setEditorError(null);

    if (editor.goal) {
      const { data, error } = await supabase
        .from('goals')
        .update({
          title: draft.title,
          description: draft.description || null,
          target_date: draft.target_date,
        })
        .eq('id', editor.goal.id)
        .select()
        .single();

      if (error) {
        setEditorError(error.message);
        setSaving(false);
        return;
      }
      setGoals((current) => current.map((goal) => (goal.id === data.id ? (data as Goal) : goal)));
    } else {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          user_id: userId,
          category: editor.category,
          position: editor.position,
          title: draft.title,
          description: draft.description || null,
          target_date: draft.target_date,
        })
        .select()
        .single();

      if (error) {
        setEditorError(error.message);
        setSaving(false);
        return;
      }
      setGoals((current) => [...current, data as Goal]);
    }

    setSaving(false);
    setEditor(null);
  }

  async function toggleGoal(goal: Goal) {
    const next = !goal.is_completed;
    // Optimistic: the celebration animation should fire on click, not on
    // round-trip. Reverted below if the write fails.
    setGoals((current) =>
      current.map((item) => (item.id === goal.id ? { ...item, is_completed: next } : item)),
    );
    setBoardError(null);

    const { error } = await supabase.from('goals').update({ is_completed: next }).eq('id', goal.id);

    if (error) {
      setGoals((current) =>
        current.map((item) => (item.id === goal.id ? { ...item, is_completed: !next } : item)),
      );
      setBoardError(error.message);
    }
  }

  async function deleteGoal(goal: Goal) {
    if (!window.confirm(`Delete “${goal.title}”? This can't be undone.`)) return;

    const snapshot = goals;
    setGoals((current) => current.filter((item) => item.id !== goal.id));
    setBoardError(null);

    const { error } = await supabase.from('goals').delete().eq('id', goal.id);
    if (error) {
      setGoals(snapshot);
      setBoardError(error.message);
    }
  }

  /**
   * Swaps two goals' `position` values in a single upsert. It has to be one
   * request: the (user_id, category, position) unique constraint is deferred
   * to end-of-transaction, and two separate requests are two transactions.
   */
  const swapPositions = useCallback(
    async (a: Goal, b: Goal) => {
      const snapshot = goals;
      setGoals((current) =>
        current.map((goal) => {
          if (goal.id === a.id) return { ...goal, position: b.position };
          if (goal.id === b.id) return { ...goal, position: a.position };
          return goal;
        }),
      );
      setBoardError(null);

      const { error } = await supabase.from('goals').upsert(
        [
          { id: a.id, user_id: a.user_id, category: a.category, title: a.title, position: b.position },
          { id: b.id, user_id: b.user_id, category: b.category, title: b.title, position: a.position },
        ],
        { onConflict: 'id' },
      );

      if (error) {
        setGoals(snapshot);
        setBoardError(error.message);
      }
    },
    [goals, supabase],
  );

  function moveGoal(goal: Goal, direction: -1 | 1) {
    const ordered = byCategory(goal.category).sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((item) => item.id === goal.id);
    const neighbour = ordered[index + direction];
    if (neighbour) void swapPositions(goal, neighbour);
  }

  function dropOnGoal(target: Goal) {
    setDropTargetId(null);
    const dragged = goals.find((goal) => goal.id === draggingId);
    setDraggingId(null);
    if (!dragged || dragged.id === target.id) return;
    // Cross-column drags would need a category change plus a slot check, so
    // they're ignored — the two lists are conceptually separate anyway.
    if (dragged.category !== target.category) return;
    void swapPositions(dragged, target);
  }

  return (
    <div className="stack">
      {boardError && <Alert tone="error">{boardError}</Alert>}

      <div className="goals-board">
        {(['living', 'dying'] as GoalCategory[]).map((category) => (
          <GoalColumn
            key={category}
            category={category}
            goals={byCategory(category)}
            unlockedSlots={unlockedSlots}
            draggingId={draggingId}
            dropTargetId={dropTargetId}
            onAdd={(position) => {
              setEditorError(null);
              setEditor({ category, position, goal: null });
            }}
            onEdit={(goal) => {
              setEditorError(null);
              setEditor({ category, position: goal.position, goal });
            }}
            onDelete={deleteGoal}
            onToggle={toggleGoal}
            onMove={moveGoal}
            onDragStart={(goal) => setDraggingId(goal.id)}
            onDragEnd={() => {
              setDraggingId(null);
              setDropTargetId(null);
            }}
            onDragOverGoal={(goal) => setDropTargetId(goal.id)}
            onDropOnGoal={dropOnGoal}
          />
        ))}
      </div>

      <GoalEditor
        open={editor !== null}
        category={editor?.category ?? 'living'}
        position={editor?.position ?? 1}
        goal={editor?.goal ?? null}
        saving={saving}
        error={editorError}
        onSave={saveGoal}
        onClose={() => setEditor(null)}
      />
    </div>
  );
}
