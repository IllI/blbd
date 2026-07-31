'use client';

import type { Goal } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface GoalCardProps {
  goal: Goal;
  /** Read-only rendering for public profiles and the dashboard summary. */
  readOnly?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMove?: (direction: -1 | 1) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDrop?: () => void;
}

export function GoalCard({
  goal,
  readOnly = false,
  dragging = false,
  dropTarget = false,
  canMoveUp = false,
  canMoveDown = false,
  onToggle,
  onEdit,
  onDelete,
  onMove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: GoalCardProps) {
  return (
    <article
      className={`goal-card${goal.is_completed ? ' goal-card--done' : ''}`}
      data-dragging={dragging || undefined}
      data-dropping={dropTarget || undefined}
      draggable={!readOnly}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span className="goal-card__index" aria-hidden="true">
        {goal.position}
      </span>

      {readOnly ? (
        <span className="goal-card__toggle" aria-hidden="true" data-static="true">
          {goal.is_completed ? '✓' : ''}
        </span>
      ) : (
        <button
          type="button"
          className="goal-card__toggle"
          aria-pressed={goal.is_completed}
          aria-label={goal.is_completed ? `Mark "${goal.title}" as not done` : `Mark "${goal.title}" as done`}
          onClick={onToggle}
        >
          ✓
        </button>
      )}

      <div className="goal-card__body">
        <div className="goal-card__title">{goal.title}</div>
        {goal.description && <div className="goal-card__desc">{goal.description}</div>}

        {(goal.target_date || goal.is_completed) && (
          <div className="goal-card__meta">
            {goal.target_date && <span>◷ {formatDate(goal.target_date)}</span>}
            {goal.is_completed && <span>✓ Done</span>}
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="goal-card__actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onMove?.(-1)}
            disabled={!canMoveUp}
            aria-label={`Move "${goal.title}" up`}
          >
            ↑
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onMove?.(1)}
            disabled={!canMoveDown}
            aria-label={`Move "${goal.title}" down`}
          >
            ↓
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="btn btn--danger btn--sm" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </article>
  );
}
