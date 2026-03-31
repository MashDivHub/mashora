import { Star } from 'lucide-react'

interface StarRatingProps {
  rating: number
  onChange?: (rating: number) => void
  readonly?: boolean
  size?: number
}

export default function StarRating({ rating, onChange, readonly = false, size = 18 }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5]

  return (
    <span className="inline-flex items-center gap-1 leading-none">
      {stars.map((star) => (
        <button
          type="button"
          key={star}
          onClick={() => !readonly && onChange && onChange(star)}
          className="inline-flex items-center justify-center rounded-sm transition-transform hover:scale-105 disabled:pointer-events-none"
          style={{ cursor: readonly ? 'default' : 'pointer' }}
          title={readonly ? undefined : `${star} star${star !== 1 ? 's' : ''}`}
          disabled={readonly}
        >
          <Star
            size={size}
            className={star <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 dark:text-zinc-600'}
          />
        </button>
      ))}
    </span>
  )
}
