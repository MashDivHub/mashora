import { useState } from 'react'
import { Button, Card, CardContent, Input, Label } from '@mashora/design-system'
import { toast } from '@/components/shared'

export default function ContactUs() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      toast.success('Message sent', 'We will get back to you soon.')
      setForm({ name: '', email: '', message: '' })
    }, 600)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
      <h1 className="text-4xl font-semibold tracking-tight mb-3">Contact us</h1>
      <p className="text-muted-foreground mb-8">Tell us about your project. We typically reply within one business day.</p>
      <Card>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <textarea id="message" required rows={6} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <Button type="submit" disabled={loading} size="lg">{loading ? 'Sending...' : 'Send message'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
