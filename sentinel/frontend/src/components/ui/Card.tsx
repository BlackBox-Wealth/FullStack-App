import { clsx } from 'clsx'
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  surface?: boolean
}

export function Card({ surface = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(surface ? 'card-surface' : 'card', 'p-5', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = false,
}: {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  accent?: boolean
}) {
  return (
    <Card className={clsx('flex flex-col gap-2', accent && 'border-accent-primary/30')}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">{label}</span>
        {icon && <span className="text-accent-primary">{icon}</span>}
      </div>
      <span
        className={clsx(
          'font-heading text-3xl font-bold',
          accent ? 'text-accent-primary' : 'text-text-primary'
        )}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-text-muted">{sub}</span>}
    </Card>
  )
}
