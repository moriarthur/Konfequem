import React from 'react';

const STATUS_MAP = {
  upcoming: {
    text: 'Upcoming',
    style: 'bg-status-info-soft text-status-info-text border-status-info-border'
  },
  ongoing: {
    text: 'Ongoing',
    style: 'bg-status-warning-soft text-status-warning-text border-status-warning-border'
  },
  completed: {
    text: 'Completed',
    style: 'bg-status-neutral-soft text-status-neutral-text border-status-neutral-border'
  },
  cancelled: {
    text: 'Cancelled',
    style: 'bg-status-danger-soft text-status-danger-text border-status-danger-border'
  },
};

const SIZES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-sm',
  lg: 'px-3 py-1 text-base'
};

export default function StatusBadge({ status = 'upcoming', size = 'sm' }) {
  const config = STATUS_MAP[status] || STATUS_MAP.completed;
  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded-pill border ${config.style} ${SIZES[size]}`}>
      {config.text}
    </span>
  );
}
