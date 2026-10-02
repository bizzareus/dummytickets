'use client'
import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plane, PlaneTakeoff, PlaneLanding, Calendar as CalIcon, Users, ShieldCheck, Clock, AlertTriangle, ArrowRight, CheckCircle2, Minus, Plus, Loader2, Lock, FileCheck, Mail, Globe } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import OrderTracker from '@/components/order-tracker'

const TITLES = ['Mr', 'Mrs', 'Ms', 'Master']
const PURPOSES = ['Visa Application', 'Immigration / Proof of Return', 'Passport Renewal', 'Other']

function AirportInput({ label, value, onChange, icon: Icon, placeholder }) {
  const [q, setQ] = useState(value ? `${value.iata} - ${value.city}` : '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  useEffect(() => { if (value) setQ(`${value.iata} - ${value.city}, ${value.country}`) }, [value])
  useEffect(() => {
    if (!open || q.length < 1) { setResults([]); return }
    const ctl = new AbortController()
    fetch(`/api/airports?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
      .then(r => r.json()).then(setResults).catch(() => {})
    return () => ctl.ctrl?.abort?.()
  }, [q, open])
  return (
    <div className="relative">
      <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1.5 block">{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-600" />
        <Input
          value={q}
          onChange={e => { setQ(e.target.value); onChange(null); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className="pl-9 h-12 bg-white/60 border-slate-200 focus:bg-white text-base"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-auto">
          {results.map(a => (
            <button key={a.iata} type="button"
              onMouseDown={() => { onChange(a); setQ(`${a.iata} - ${a.city}, ${a.country}`); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 hover:bg-sky-50 border-b border-slate-100 last:border-b-0 flex items-center gap-3">
              <div className="font-mono text-sm font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded">{a.iata}</div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">{a.city}, {a.country}</div>
                <div className="text-xs text-slate-500">{a.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Counter({ label, sub, value, onChange, min = 0, max = 9 }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div>
        <div className="font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">{sub}</div>
      </div>
      <div className="flex items-center gap-3">
        <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}><Minus className="w-3 h-3"/></Button>
        <div className="w-6 text-center font-semibold">{value}</div>
        <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}><Plus className="w-3 h-3"/></Button>
      </div>
    </div>
  )
}

function ValidityBanner({ validity }) {
  if (!validity) return null
  const colors = validity.rule === 'A'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
    : validity.rule === 'B'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-rose-50 border-rose-300 text-rose-900'
  const Icon = validity.rule === 'A' ? ShieldCheck : validity.rule === 'B' ? Clock : AlertTriangle
  return (
    <div className={`rounded-xl border-2 p-4 flex gap-3 ${colors}`}>
      <Icon className="w-5 h-5 mt-0.5 shrink-0"/>
      <div>
        <div className="font-semibold">{validity.label} · Rule {validity.rule}</div>
        <div className="text-sm mt-0.5 opacity-90">{validity.message}</div>
      </div>
    </div>
  )
}

function computeValidityClient(dateStr) {
  if (!dateStr) return null
  const dep = new Date(dateStr + 'T00:00:00Z')
  const diffH = (dep - new Date()) / 36e5
  if (diffH > 14 * 24) return { rule: 'A', label: 'Advance Booking', message: 'Reservation verified and valid up to 14 days prior to travel date.' }
  if (diffH >= 24) return { rule: 'B', label: 'Near-Term Booking', message: 'Reservation hold guaranteed valid for 24 to 48 hours from issuance.' }
  return { rule: 'C', label: 'Urgent Booking', message: 'Emergency priority: reservation held for 24 hours maximum.' }
}

const StepDot = ({ n, active, done, label }) => (
  <div className="flex items-center gap-2">
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition ${
      done ? 'bg-emerald-500 text-white' : active ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30' : 'bg-slate-200 text-slate-500'
    }`}>
      {done ? <CheckCircle2 className="w-4 h-4"/> : n}
    </div>
    <span className={`text-sm font-medium hidden md:block ${active || done ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
  </div>
)

export default function App() {
  const [step, setStep] = useState(0)
  const [tripType, setTripType] = useState('ONE_WAY')
  const [origin, setOrigin] = useState(null)
  const [destination, setDestination] = useState(null)
  const [departureDate, setDepartureDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [contact, setContact] = useState({ email: '', phone: '', whatsapp: false })
  const [passengers, setPassengers] = useState([{ title: 'Mr', firstName: '', lastName: '', dob: '', nationality: '', type: 'ADULT' }])
  const [travelPurpose, setTravelPurpose] = useState('')
  const [preferredAirline, setPreferredAirline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [bookingRef, setBookingRef] = useState(null)

  const totalPax = adults + children + infants
  const total = totalPax * (tripType === 'ROUND_TRIP' ? 30 : 15)
  const validity = useMemo(() => computeValidityClient(departureDate), [departureDate])
  const today = new Date().toISOString().split('T')[0]

  // sync passenger array with counts
  useEffect(() => {
    const built = []
    for (let i = 0; i < adults; i++) built.push({ title: 'Mr', firstName: '', lastName: '', dob: '', nationality: '', type: 'ADULT' })
    for (let i = 0; i < children; i++) built.push({ title: 'Master', firstName: '', lastName: '', dob: '', nationality: '', type: 'CHILD' })
    for (let i = 0; i < infants; i++) built.push({ title: 'Master', firstName: '', lastName: '', dob: '', nationality: '', type: 'INFANT' })
    setPassengers(prev => built.map((b, i) => ({ ...b, ...(prev[i] && prev[i].type === b.type ? prev[i] : {}) })))
  }, [adults, children, infants])

  const canProceedStep0 = origin && destination && departureDate && (tripType === 'ONE_WAY' || returnDate) && totalPax > 0
  const canProceedStep1 = contact.email && contact.phone && passengers.every(p => p.firstName && p.lastName && p.dob && p.nationality)

  async function submitBooking() {
    setSubmitting(true)
    try {
      const r = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripType,
          originIata: origin.iata, destinationIata: destination.iata,
          departureDate, returnDate: tripType === 'ROUND_TRIP' ? returnDate : null,
          adults, children, infants,
          contact, passengers,
          travelPurpose, preferredAirline
        })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to create booking')
      setBookingRef(data)
      // now redirect to checkout
      const c = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: data.id })
      })
      const cd = await c.json()
      if (!c.ok) throw new Error(cd.error || 'Checkout failed')
      window.location.href = cd.url
    } catch (e) {
      toast.error(e.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-slate-100">
      <Toaster position="top-center" richColors />

      {/* Nav */}
      <nav className="border-b border-slate-200/70 bg-white/70 backdrop-blur-lg sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center shadow-md">
              <Plane className="w-5 h-5 text-white -rotate-45"/>
            </div>
            <div>
              <div className="font-bold text-slate-900 leading-none">OnwardTicket</div>
              <div className="text-[10px] text-slate-500 leading-none mt-0.5">Verified Flight Reservations</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="#track-order" className="text-xs font-semibold text-primary hover:underline">Track My Order</a>
            <a href="/admin" className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"><Lock className="w-3 h-3"/> Admin</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      {step === 0 && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800"></div>
          <div className="absolute inset-0 opacity-20" style={{backgroundImage:'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)', backgroundSize:'40px 40px'}}></div>
          <div className="relative container mx-auto px-4 py-14 text-center text-white">
            <Badge className="bg-white/15 hover:bg-white/20 text-white border-white/20 mb-4">
              <ShieldCheck className="w-3 h-3 mr-1"/> Trusted by 50,000+ travelers worldwide
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
              Verified Flight Reservations<br/>
              <span className="bg-gradient-to-r from-sky-200 to-white bg-clip-text text-transparent">for Visa & Immigration</span>
            </h1>
            <p className="text-lg text-sky-100 max-w-2xl mx-auto mb-2">
              Real PNR-backed reservations. Delivered in 30-120 minutes. Perfect proof of onward travel.
            </p>
            <div className="flex gap-6 justify-center mt-6 text-sm text-sky-100">
              <span className="flex items-center gap-1.5"><FileCheck className="w-4 h-4"/> Real PNR</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4"/> Fast delivery</span>
              <span className="flex items-center gap-1.5"><Globe className="w-4 h-4"/> All embassies accepted</span>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Stepper */}
        {step > 0 && (
          <div className="flex items-center justify-center gap-2 md:gap-6 mb-8">
            <StepDot n={1} label="Trip" done={step > 0} />
            <div className="h-px w-6 md:w-12 bg-slate-300"/>
            <StepDot n={2} label="Passengers" active={step === 1} done={step > 1} />
            <div className="h-px w-6 md:w-12 bg-slate-300"/>
            <StepDot n={3} label="Review" active={step === 2} done={step > 2} />
            <div className="h-px w-6 md:w-12 bg-slate-300"/>
            <StepDot n={4} label="Payment" active={step === 3} />
          </div>
        )}

        {/* STEP 0: Search */}
        {step === 0 && (
          <Card className="-mt-14 relative z-10 shadow-2xl border-slate-200/60 bg-white/95 backdrop-blur">
            <CardContent className="p-6 md:p-8">
              <RadioGroup value={tripType} onValueChange={setTripType} className="flex gap-2 mb-6">
                <label className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 cursor-pointer transition ${tripType === 'ONE_WAY' ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-200 hover:border-slate-300'}`}>
                  <RadioGroupItem value="ONE_WAY" className="sr-only"/>
                  <PlaneTakeoff className="w-4 h-4"/> One-Way <span className="font-bold ml-1">$15</span>
                </label>
                <label className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 cursor-pointer transition ${tripType === 'ROUND_TRIP' ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-200 hover:border-slate-300'}`}>
                  <RadioGroupItem value="ROUND_TRIP" className="sr-only"/>
                  <PlaneLanding className="w-4 h-4"/> Round-Trip <span className="font-bold ml-1">$30</span>
                </label>
              </RadioGroup>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AirportInput label="From" placeholder="City, airport or IATA" icon={PlaneTakeoff}
                  value={origin} onChange={setOrigin}/>
                <AirportInput label="To" placeholder="City, airport or IATA" icon={PlaneLanding}
                  value={destination} onChange={setDestination}/>
                <div>
                  <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1.5 block">Departure</Label>
                  <div className="relative">
                    <CalIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-600"/>
                    <Input type="date" min={today} value={departureDate}
                      onChange={e => setDepartureDate(e.target.value)}
                      className="pl-9 h-12 bg-white/60"/>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1.5 block">Return</Label>
                  <div className="relative">
                    <CalIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-600"/>
                    <Input type="date" disabled={tripType === 'ONE_WAY'}
                      min={departureDate || today} value={returnDate}
                      onChange={e => setReturnDate(e.target.value)}
                      className="pl-9 h-12 bg-white/60"/>
                  </div>
                </div>
              </div>

              <Card className="mt-4 border-slate-100 bg-slate-50/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2 text-slate-700">
                    <Users className="w-4 h-4"/> <span className="font-medium text-sm">Passengers</span>
                    <Badge variant="secondary" className="ml-auto">{totalPax} total</Badge>
                  </div>
                  <Counter label="Adults" sub="12+ years" value={adults} onChange={v => setAdults(Math.max(1, v))} min={1} max={9}/>
                  <Counter label="Children" sub="2 to 11 years" value={children} onChange={setChildren} min={0} max={8}/>
                  <Counter label="Infants" sub="Under 2 years" value={infants} onChange={setInfants} min={0} max={4}/>
                </CardContent>
              </Card>

              {validity && <div className="mt-4"><ValidityBanner validity={validity}/></div>}

              <Button size="lg" className="w-full mt-6 h-14 text-base bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 shadow-lg shadow-sky-600/25"
                disabled={!canProceedStep0}
                onClick={() => setStep(1)}>
                Proceed to Passenger Details <ArrowRight className="w-4 h-4 ml-2"/>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 1: Passenger form */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Mail className="w-5 h-5 text-sky-600"/> Contact Details</CardTitle>
                  <CardDescription>Where should we deliver your ticket?</CardDescription></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label>Email address *</Label><Input type="email" value={contact.email} onChange={e => setContact({...contact, email: e.target.value})} placeholder="you@example.com"/></div>
                  <div><Label>Phone (with country code) *</Label><Input value={contact.phone} onChange={e => setContact({...contact, phone: e.target.value})} placeholder="+1 555 123 4567"/></div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <Checkbox id="wa" checked={contact.whatsapp} onCheckedChange={v => setContact({...contact, whatsapp: v})}/>
                    <Label htmlFor="wa" className="text-sm">Also send ticket via WhatsApp</Label>
                  </div>
                </CardContent>
              </Card>

              {passengers.map((p, i) => (
                <Card key={i}>
                  <CardHeader><CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-sky-600"/> Passenger {i+1}
                    <Badge variant="outline" className="ml-2 text-xs">{p.type}</Badge>
                  </CardTitle>
                    <CardDescription>Enter names exactly as they appear on passport.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label>Title</Label>
                      <Select value={p.title} onValueChange={v => { const c=[...passengers]; c[i]={...c[i], title:v}; setPassengers(c) }}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>{TITLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Nationality *</Label><Input value={p.nationality} onChange={e => { const c=[...passengers]; c[i]={...c[i], nationality:e.target.value}; setPassengers(c) }} placeholder="e.g. Indian, British"/></div>
                    <div><Label>First / Given name *</Label><Input value={p.firstName} onChange={e => { const c=[...passengers]; c[i]={...c[i], firstName:e.target.value}; setPassengers(c) }}/></div>
                    <div><Label>Last / Surname *</Label><Input value={p.lastName} onChange={e => { const c=[...passengers]; c[i]={...c[i], lastName:e.target.value}; setPassengers(c) }}/></div>
                    <div><Label>Date of Birth *</Label><Input type="date" max={today} value={p.dob} onChange={e => { const c=[...passengers]; c[i]={...c[i], dob:e.target.value}; setPassengers(c) }}/></div>
                  </CardContent>
                </Card>
              ))}

              <Card>
                <CardHeader><CardTitle className="text-lg">Additional Info (optional)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label>Purpose of ticket</Label>
                    <Select value={travelPurpose} onValueChange={setTravelPurpose}>
                      <SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                      <SelectContent>{PURPOSES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Preferred airline</Label><Input value={preferredAirline} onChange={e => setPreferredAirline(e.target.value)} placeholder="Any"/></div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                <Button className="bg-gradient-to-r from-sky-600 to-blue-700" disabled={!canProceedStep1} onClick={() => setStep(2)}>Review Order <ArrowRight className="w-4 h-4 ml-2"/></Button>
              </div>
            </div>

            <div>
              <Card className="sticky top-20 shadow-lg">
                <CardHeader><CardTitle className="text-base">Trip summary</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-3 font-medium">
                    <div className="font-mono text-sky-700 bg-sky-50 px-2 py-1 rounded text-xs">{origin?.iata}</div>
                    <ArrowRight className="w-3 h-3 text-slate-400"/>
                    <div className="font-mono text-sky-700 bg-sky-50 px-2 py-1 rounded text-xs">{destination?.iata}</div>
                  </div>
                  <Separator/>
                  <div className="text-slate-600">Type: <span className="text-slate-900 font-medium">{tripType === 'ROUND_TRIP' ? 'Round-Trip' : 'One-Way'}</span></div>
                  <div className="text-slate-600">Depart: <span className="text-slate-900 font-medium">{departureDate}</span></div>
                  {returnDate && <div className="text-slate-600">Return: <span className="text-slate-900 font-medium">{returnDate}</span></div>}
                  <div className="text-slate-600">Passengers: <span className="text-slate-900 font-medium">{totalPax}</span></div>
                  <Separator/>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-600">Total</span>
                    <span className="text-2xl font-bold text-slate-900">${total}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* STEP 2: Review */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader><CardTitle>Review your order</CardTitle>
                  <CardDescription>Please double-check every detail before payment.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-sky-50 to-blue-50 rounded-xl border border-sky-100">
                    <div className="text-center">
                      <div className="font-mono text-2xl font-bold text-sky-800">{origin?.iata}</div>
                      <div className="text-xs text-slate-600">{origin?.city}</div>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-px bg-sky-300"/>
                      <Plane className="w-5 h-5 text-sky-600 -rotate-45"/>
                      <div className="flex-1 h-px bg-sky-300"/>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-2xl font-bold text-sky-800">{destination?.iata}</div>
                      <div className="text-xs text-slate-600">{destination?.city}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><div className="text-slate-500 text-xs">Departure</div><div className="font-medium">{departureDate}</div></div>
                    {returnDate && <div><div className="text-slate-500 text-xs">Return</div><div className="font-medium">{returnDate}</div></div>}
                    <div><div className="text-slate-500 text-xs">Trip type</div><div className="font-medium">{tripType === 'ROUND_TRIP' ? 'Round-Trip' : 'One-Way'}</div></div>
                    <div><div className="text-slate-500 text-xs">Contact</div><div className="font-medium">{contact.email}</div></div>
                  </div>
                  <Separator/>
                  <div>
                    <div className="text-sm font-semibold mb-2">Passengers ({passengers.length})</div>
                    <div className="space-y-1.5">
                      {passengers.map((p, i) => (
                        <div key={i} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                          <span>{p.title} {p.firstName} {p.lastName}</span>
                          <span className="text-slate-500 text-xs">{p.nationality} · {p.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <ValidityBanner validity={validity}/>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button size="lg" className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-600/25" disabled={submitting} onClick={submitBooking}>
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Processing…</> : <><Lock className="w-4 h-4 mr-2"/> Pay ${total} & Confirm</>}
                </Button>
              </div>
            </div>

            <div>
              <Card className="sticky top-20 shadow-lg border-2 border-sky-100">
                <CardHeader className="bg-gradient-to-br from-sky-50 to-blue-50">
                  <CardTitle className="text-base">Price breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">${tripType === 'ROUND_TRIP' ? 30 : 15} × {passengers.length} passenger{passengers.length > 1 ? 's' : ''}</span>
                    <span className="font-medium">${total}</span>
                  </div>
                  <Separator/>
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold">Total (USD)</span>
                    <span className="text-3xl font-bold text-slate-900">${total}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-2">
                    <Lock className="w-3 h-3"/> Secure payment via Stripe
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <OrderTracker />
      </div>

      <footer className="border-t border-slate-200 mt-16 py-8 text-center text-xs text-slate-500">
        <div className="container mx-auto px-4">
          OnwardTicket · Verified flight reservations for visa, immigration and proof of onward travel
        </div>
      </footer>
    </div>
  )
}
