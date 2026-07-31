'use client';

import Link from 'next/link';
import type { Goal, GoalCategory } from '@/lib/types';
import { GoalCard } from './GoalCard';

const COPY: Record<GoalCategory, { heading: string; blurb: string }> = {
  living: {
    heading: '5 Goals for Better Living',
    blurb: 'The things that make being here worth it.',
  },
  dying: {
    heading: '5 Goals for Better Dying',
    blurb: 'The things that make leaving lighter — for you and for them.',
  },
};

interface GoalColumnProps {
  category: GoalCategory;
  goals: Goal[];
  /** Slots unlocked by the member's tier (2 on free, 5 on paid). */
  unlockedSlots: number;
  readOnly?: boolean;
  draggingId?: string | null;
  dropTargetId?: string | null;
  onAdd?: (position: number) => void;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goal: Goal) => void;
  onToggle?: (goal: Goal) => void;
  onMove?: (goal: Goal, direction: -1 | 1) => void;
  onDragStart?: (goal: Goal) => void;
  onDragEnd?: () => void;
  onDragOverGoal?: (goal: Goal) => void;
  onDropOnGoal?: (goal: Goal) => void;
}

export function GoalColumn({
  category,
  goals,
  unlockedSlots,
  readOnly = false,
  draggingId,
  dropTargetId,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
  onMove,
  onDragStart,
  onDragEnd,
  onDragOverGoal,
  onDropOnGoal,
}: GoalColumnProps) {
  const ordered = [...goals].sort((a, b) => a.position - b.position);
  const completed = ordered.filter((goal) => goal.is_completed).length;
  const percent = ordered.length ? Math.round((completed / ordered.length) * 100) : 0;

  // Slot numbers not yet filled, capped at the 5 the concept allows.
  const takenPositions = new Set(ordered.map((goal) => goal.position));
  const emptySlots = [1, 2, 3, 4, 5].filter((position) => !takenPositions.has(position));

  const copy = COPY[category];

  return (
    <section className={`goal-column goal-column--${category}`}>
      <header className="goal-column__head">
        <h2>{copy.heading}</h2>
        <p>{copy.blurb}</p>
        <div
          className="goal-column__progress"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${copy.heading}: ${completed} of ${ordered.length} complete`}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </header>

      <div className="goal-column__body">
        {ordered.length === 0 && readOnly && (
          <p className="small muted" style={{ padding: '0.5rem' }}>
            Nothing here yet.
          </p>
        )}

        {ordered.map((goal, index) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            readOnly={readOnly}
            dragging={draggingId === goal.id}
            dropTarget={dropTargetId === goal.id && draggingId !== goal.id}
            canMoveUp={index > 0}
            canMoveDown={index < ordered.length - 1}
            onToggle={() => onToggle?.(goal)}
            onEdit={() => onEdit?.(goal)}
            onDelete={() => onDelete?.(goal)}
            onMove={(direction) => onMove?.(goal, direction)}
            onDragStart={() => onDragStart?.(goal)}
            onDragEnd={onDragEnd}
            onDragOver={(event) => {
              event.preventDefault();
              onDragOverGoal?.(goal);
            }}
            onDrop={() => onDropOnGoal?.(goal)}
          />
        ))}

        {!readOnly &&
          emptySlots.map((position) => {
            const locked = position > unlockedSlots;
            return (
              <button
                key={position}
                type="button"
                className="goal-slot"
                disabled={locked}
                onClick={() => onAdd?.(position)}
              >
                <span className="goal-slot__index" aria-hidden="true">
                  {position}
                </span>
                {locked ? 'Locked on the free plan' : 'Add a goal'}
                {locked && (
                  <span style={{ marginLeft: 'auto' }} aria-hidden="true">
                    🔒
                  </span>
                )}
              </button>
            );
          })}

        {!readOnly && unlockedSlots < 5 && (
          <p className="upgrade-note">
            Free members get {unlockedSlots} slots per list.{' '}
            <Link href="/checkout">Upgrade</Link> to open all five.
          </p>
        )}
      </div>
    </section>
  );
}
