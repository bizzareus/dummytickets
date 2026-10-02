'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, Loader2, Clock, Mail, Plane, ShieldCheck, Copy } from 'lucide-react'
import { toast, Toaster } from 'sonner'

export default function SuccessPage() {
  const [state, setState] = useState('loading')
  const [booking, setBooking] = useState(null)
  const [ref, setRef] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const r = params.get('ref')
    const sessionId = params.get('session_id')
    setRef(r || '')
    if (!r) { setState('missing'); return }
    const url = `/api/verify-session?ref=${encodeURIComponent(r)}${sessionId ? `&session_id=${sessionId}` : ''}`
    fetch(url).then(r => r.json()).then(d => {
      if (d.paid) { setBooking(d.booking); setState('paid') }
      else if (d.booking) { setBooking(d.booking); setState('pending') }
      else setState('error')
    }).catch(() => setState('error'))
  }, [])

  const copyRef = () => { navigator.clipboard.writeText(ref); toast.success('Reference copied') }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50">
      <Toaster position="top-center" richColors/>
      <div className="container mx-auto max-w-2xl px-4 py-16">
        {state === 'loading' && (
          <Card className="text-center p-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-sky-600"/><div className="mt-4 text-slate-600">Verifying your payment…</div></Card>
        )}
        {state === 'paid' && booking && (
          <>
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-12 h-12 text-emerald-600"/>
              </div>
              <h1 className="text-3xl font-bold text-slate-900">Payment Successful!</h1>
              <p className="text-slate-600 mt-2">Your reservation request is being processed.</p>
            </div>

            <Card className="shadow-xl border-slate-200">
              <CardHeader className="bg-gradient-to-r from-sky-50 to-emerald-50 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Reference</div>
                    <CardTitle className="font-mono text-xl mt-1">{ref}</CardTitle>
                  </div>
                  <Button size="sm" variant="outline" onClick={copyRef}><Copy className="w-3 h-3 mr-1"/> Copy</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="font-mono font-bold text-lg text-sky-800">{booking.originIata}</div>
                  <Plane className="w-4 h-4 text-slate-400 -rotate-45"/>
                  <div className="font-mono font-bold text-lg text-sky-800">{booking.destinationIata}</div>
                  <div className="ml-auto text-right text-sm">
                    <div className="text-slate-900 font-medium">{booking.departureDate}</div>
                    {booking.returnDate && <div className="text-slate-500 text-xs">Return: {booking.returnDate}</div>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-slate-500">Trip type</div><div className="font-medium">{booking.tripType === 'ROUND_TRIP' ? 'Round-Trip' : 'One-Way'}</div></div>
                  <div><div className="text-xs text-slate-500">Passengers</div><div className="font-medium">{booking.passengers.length}</div></div>
                  <div><div className="text-xs text-slate-500">Amount paid</div><div className="font-medium">${booking.totalAmount}</div></div>
                  <div><div className="text-xs text-slate-500">Status</div><Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><Clock className="w-3 h-3 mr-1"/> Processing</Badge></div>
                </div>

                <Separator/>

                <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-sky-900 mb-1"><Mail className="w-4 h-4"/> What happens next?</div>
                  <ul className="text-sky-900/80 space-y-1 mt-2 pl-6 list-disc">
                    <li>Our team will generate a real PNR reservation for you</li>
                    <li>Ticket usually delivered in 30-120 minutes to <span className="font-medium">{booking.contact.email}</span></li>
                    <li>Save your reference code above for tracking</li>
                  </ul>
                </div>

                {booking.validity && (
                  <div className="rounded-xl bg-slate-50 border p-4 text-sm flex gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"/>
                    <div><div className="font-semibold">{booking.validity.label}</div><div className="text-slate-600 mt-0.5">{booking.validity.message}</div></div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="text-center mt-6">
              <Button variant="outline" onClick={() => window.location.href = '/'}>Book another</Button>
            </div>
          </>
        )}
        {state === 'pending' && (
          <Card className="text-center p-12">
            <Clock className="w-12 h-12 text-amber-500 mx-auto"/>
            <h2 className="text-xl font-bold mt-4">Payment still processing</h2>
            <p className="text-slate-600 mt-2">Ref: <span className="font-mono">{ref}</span></p>
            <Button className="mt-4" onClick={() => window.location.reload()}>Refresh</Button>
          </Card>
        )}
        {(state === 'error' || state === 'missing') && (
          <Card className="text-center p-12">
            <h2 className="text-xl font-bold">Unable to verify</h2>
            <p className="text-slate-600 mt-2">Please contact support with your reference.</p>
            <Button className="mt-4" onClick={() => window.location.href = '/'}>Home</Button>
          </Card>
        )}
      </div>
    </div>
  )
}
