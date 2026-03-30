interface StarRatingProps {
  rating: number
  onChange?: (rating: number) => void
  readonly?: boolean
  size?: number
}

export default function StarRating({ rating, onChange, readonly = false, size = 18 }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5]

  return (
    <span style={{ display: 'inline-flex', gap: '2px', lineHeight: 1 }}>
      {stars.map((star) => (
        <span
          key={star}
          onClick={() => !readonly && onChange && onChange(star)}
          style={{
            fontSize: `${size}px`,
            color: star <= Math.round(rating) ? '#F59E0B' : '#D1D5DB',
            cursor: readonly ? 'default' : 'pointer',
            userSelect: 'none',
            transition: 'color 0.1s',
          }}
          title={readonly ? undefined : `${star} star${star !== 1 ? 's' : ''}`}
        >
          {star <= Math.round(rating) ? '\u2605' : '\u2606'}
        </span>
      ))}
    </span>
  )
}
