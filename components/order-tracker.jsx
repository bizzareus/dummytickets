'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Search, RefreshCw, Loader2, CheckCircle2, Clock, ShieldCheck, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const paymentLabels = {
  PENDING: 'Awaiting payment', PAID: 'Paid', CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded', FAILED: 'Payment failed',
}
const fulfillmentLabels = { UNFULFILLED: 'Not yet fulfilled', COMPLETED: 'Completed', CANCELLED: 'Cancelled' }

const fetchStatus = async (url) => {
  const response = await fetch(url, { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) {
    const error = new Error(response.status >= 500
      ? 'We couldn’t check your order right now. Please try again.'
      : result?.error || 'Unable to check your order. Please try again.')
    error.status = response.status
    throw error
  }
  return result
}

const OrderTracker = () => {
  const [input, setInput] = useState('')
  const [reference, setReference] = useState('')
  const [validationError, setValidationError] = useState('')
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    reference ? `/api/tracking?reference=${encodeURIComponent(reference)}` : null,
    fetchStatus,
    {
      refreshInterval: 15000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      revalidateOnFocus: true,
      shouldRetryOnError: false,
      keepPreviousData: false,
    }
  )

  const trackOrder = (event) => {
    event.preventDefault()
    const normalized = input.trim().toUpperCase()
    if (!/^DT-\d{4}-[A-Z0-9]{4}$/.test(normalized)) {
      setValidationError('Enter your full DT-reference, such as DT-2026-ABCD.')
      return
    }
    setValidationError('')
    setInput(normalized)
    if (normalized === reference) mutate()
    else setReference(normalized)
  }

  const order = error?.status === 404 ? null : data
  const stopped = ['CANCELLED', 'REFUNDED', 'FAILED'].includes(order?.paymentStatus) || order?.fulfillmentStatus === 'CANCELLED'
  const paid = order?.paymentStatus === 'PAID'
  const completed = order?.fulfillmentStatus === 'COMPLETED'
  const title = stopped
    ? (order?.fulfillmentStatus === 'CANCELLED' ? 'Order cancelled' : paymentLabels[order?.paymentStatus])
    : completed ? 'Your reservation is ready' : paid ? 'We’re preparing your reservation' : 'Awaiting payment'
  const description = stopped
    ? 'This order is not progressing through fulfillment.'
    : completed ? 'Our team has completed your reservation. Ticket delivery is handled separately.'
      : paid ? 'Payment is confirmed. Our team is working on your reservation.'
        : 'Your order has been received, but payment has not been confirmed.'
  const steps = [
    { label: 'Order received', done: true },
    { label: 'Payment confirmed', done: paid },
    { label: 'Reservation ready', done: completed },
  ]

  return (
    <section id="track-order" aria-labelledby="track-order-heading" className="scroll-mt-24 mt-8">
      <Card className="border-border bg-card text-card-foreground shadow-sm">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-secondary text-secondary-foreground p-2.5"><Search className="h-5 w-5" aria-hidden="true" /></div>
            <div>
              <CardTitle id="track-order-heading" className="text-xl">Track My Order</CardTitle>
              <CardDescription className="mt-1">Already booked? Paste your DT-reference for live order status. No login needed.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={trackOrder} className="space-y-2" aria-label="Track your order">
            <Label htmlFor="order-reference">Order reference</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="order-reference" name="reference" placeholder="DT-2026-ABCD" value={input}
                onChange={(event) => { setInput(event.target.value); setValidationError('') }}
                autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={64}
                aria-invalid={Boolean(validationError)} aria-describedby={validationError ? 'reference-error' : 'reference-help'}
                className="h-11 font-mono sm:flex-1" />
              <Button type="submit" disabled={isLoading} className="h-11 shrink-0">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="mr-2 h-4 w-4" aria-hidden="true" />}
                {isLoading ? 'Checking…' : 'Track order'}
              </Button>
            </div>
            <p id="reference-help" className="text-xs text-muted-foreground">Find your reference on your order confirmation page.</p>
            {validationError && <p id="reference-error" role="alert" className="text-sm text-destructive">{validationError}</p>}
          </form>

          {isLoading && <p role="status" className="text-sm text-muted-foreground">Checking the latest status for {reference}…</p>}
          {error && (
            <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-destructive">{error?.status === 400 || error?.status === 404 ? error.message : 'Unable to refresh your order. Please try again.'}{order ? ' Showing the last known status below.' : ''}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>Try again</Button>
            </div>
          )}

          {order && (
            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4 sm:p-5" data-testid="tracking-result">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono font-semibold">{order?.referenceCode}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => mutate()} disabled={isValidating} aria-label="Refresh order status">
                  <RefreshCw aria-hidden="true" className={`mr-2 h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
                  {isValidating ? 'Refreshing…' : 'Refresh'}
                </Button>
              </div>
              <div role="status" aria-live="polite" aria-atomic="true" className="flex items-start gap-3">
                {stopped ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
                  : completed ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    : <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
                <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Payment: {paymentLabels[order?.paymentStatus] || 'Unknown'}</Badge>
                <Badge variant="outline">Fulfillment: {fulfillmentLabels[order?.fulfillmentStatus] || 'Processing'}</Badge>
              </div>
              {!stopped && (
                <ol aria-label="Order progress" className="grid gap-2 sm:grid-cols-3">
                  {steps.map((step) => (
                    <li key={step.label} className={`flex items-center gap-2 rounded-md border p-3 text-xs ${step.done ? 'border-primary/20 bg-secondary text-secondary-foreground' : 'border-border text-muted-foreground'}`}>
                      {step.done ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      <span>{step.label}<span className="sr-only">{step.done ? ': complete' : ': pending'}</span></span>
                    </li>
                  ))}
                </ol>
              )}
              {order?.mockPayment && <p className="text-xs text-muted-foreground"><strong>DEMO / MOCKED PAYMENT:</strong> No actual payment was collected.</p>}
              <p className="text-xs text-muted-foreground">{error ? 'Live updates interrupted. Use Refresh to check again.' : 'Checks for updates every 15 seconds while this page is visible.'}</p>
            </div>
          )}
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Status only. Passenger details and reservation codes are not shown here.</p>
        </CardContent>
      </Card>
    </section>
  )
}

export default OrderTracker
