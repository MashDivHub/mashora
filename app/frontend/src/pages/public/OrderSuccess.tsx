import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@mashora/design-system'
import { ArrowRight, Check } from 'lucide-react'

export default function OrderSuccess() {
  const orderRef = useMemo(() => `ORDER-${Date.now().toString(36).toUpperCase()}`, [])

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-24 text-center">
      <div className="mx-auto w-fit rounded-full bg-emerald-500/10 p-6">
        <Check className="size-12 text-emerald-600" strokeWidth={2.5} />
      </div>

      <h1 className="mt-8 text-4xl font-bold tracking-tight md:text-5xl">Thank you!</h1>
      <p className="mt-4 text-base text-muted-foreground md:text-lg">
        Your order has been received. We&apos;ll send a confirmation email shortly.
      </p>

      <div className="mx-auto mt-8 w-fit rounded-2xl border border-border/60 bg-card px-6 py-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Order reference
        </div>
        <div className="mt-1 font-mono text-lg font-semibold">{orderRef}</div>
      </div>

      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild size="lg" className="h-12">
          <Link to="/shop">
            Continue shopping
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12">
          <Link to="/blog">View our blog</Link>
        </Button>
      </div>
    </div>
  )
}
