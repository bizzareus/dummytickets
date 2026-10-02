'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Lock, Search, Plane, Clock, CheckCircle2, AlertTriangle, Loader2, RefreshCw, LogOut, Mail, User } from 'lucide-react'
import { toast, Toaster } from 'sonner'

function useAdminToken() {
  const [token, setToken] = useState(null)
  useEffect(() => { setToken(localStorage.getItem('adminToken')) }, [])
  const save = t => { localStorage.setItem('adminToken', t); setToken(t) }
  const clear = () => { localStorage.removeItem('adminToken'); setToken(null) }
  return { token, save, clear }
}

export default function AdminPage() {
  const { token, save, clear } = useAdminToken()
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  async function login() {
    setLoggingIn(true)
    try {
      const r = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Login failed')
      save(d.token); toast.success('Welcome back!')
    } catch (e) { toast.error(e.message) } finally { setLoggingIn(false) }
  }

  if (token === null) return null

  if (!token) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Toaster position="top-center" richColors/>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-2"><Lock className="w-6 h-6 text-slate-700"/></div>
          <CardTitle>Admin Console</CardTitle><CardDescription>Enter password to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}/></div>
          <Button className="w-full" onClick={login} disabled={loggingIn}>{loggingIn?<Loader2 className="w-4 h-4 animate-spin"/>:'Sign in'}</Button>
          <div className="text-xs text-center text-slate-500">Default password: <code>admin123</code></div>
        </CardContent>
      </Card>
    </div>
  )

  return <AdminDashboard token={token} onLogout={clear}/>
}

function AdminDashboard({ token, onLogout }) {
  const [tab, setTab] = useState('PENDING_FULFILLMENT')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/bookings?status=${tab}&search=${encodeURIComponent(search)}`, { headers: { 'x-admin-token': token } })
      if (r.status === 401) { onLogout(); return }
      const d = await r.json(); setRows(d)
    } catch (e) { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [tab])

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-center" richColors/>
      <nav className="bg-slate-900 text-white">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2"><Plane className="w-5 h-5 -rotate-45 text-sky-400"/><span className="font-semibold">OnwardTicket Admin</span></div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-slate-300 hover:text-white">View site</a>
            <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800" onClick={onLogout}><LogOut className="w-3 h-3 mr-1"/> Logout</Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div><h1 className="text-2xl font-bold">Fulfillment Queue</h1><p className="text-sm text-slate-500">Manage flight reservation requests</p></div>
          <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1"/> Refresh</Button>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
            <Input placeholder="Search by reference or email…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} className="pl-9"/>
          </div>
          <Button onClick={load}>Search</Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="PENDING_FULFILLMENT">Paid · Pending</TabsTrigger>
            <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
            <TabsTrigger value="CANCELLED">Cancelled</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                {loading && <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400"/></div>}
                {!loading && rows.length === 0 && <div className="p-12 text-center text-slate-400">No bookings found</div>}
                {!loading && rows.length > 0 && (
                  <div className="divide-y">
                    {rows.map(b => <Row key={b.id} b={b} onClick={() => setSelected(b)}/>)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {selected && <DetailModal booking={selected} token={token} onClose={() => setSelected(null)} onDone={() => { setSelected(null); load() }}/>}
      </div>
    </div>
  )
}

function Row({ b, onClick }) {
  const dep = new Date(b.departureDate)
  const hoursToDep = (dep - new Date()) / 36e5
  const urgent = hoursToDep < 48 && b.fulfillmentStatus !== 'COMPLETED'
  return (
    <button onClick={onClick} className="w-full text-left px-5 py-4 hover:bg-slate-50 transition flex items-center gap-4">
      <div className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded shrink-0">{b.referenceCode}</div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono font-semibold">{b.originIata}</span>
        <Plane className="w-3 h-3 text-slate-400 -rotate-45"/>
        <span className="font-mono font-semibold">{b.destinationIata}</span>
      </div>
      <div className="hidden md:block text-sm text-slate-600 shrink-0">{b.departureDate}</div>
      <div className="hidden lg:block text-sm text-slate-500 flex-1 truncate">{b.contact?.email}</div>
      <div className="ml-auto flex items-center gap-2">
        {urgent && <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100"><AlertTriangle className="w-3 h-3 mr-1"/> Urgent</Badge>}
        <Badge variant="outline">${b.totalAmount}</Badge>
        {b.fulfillmentStatus === 'COMPLETED'
          ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><CheckCircle2 className="w-3 h-3 mr-1"/> Fulfilled</Badge>
          : b.paymentStatus === 'PAID' ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>
          : <Badge variant="secondary">{b.paymentStatus}</Badge>}
      </div>
    </button>
  )
}

function DetailModal({ booking, token, onClose, onDone }) {
  const [pnrCode, setPnrCode] = useState(booking.pnrCode || '')
  const [airlineName, setAirlineName] = useState(booking.airlineName || '')
  const [eTicketNumber, setETicketNumber] = useState(booking.eTicketNumber || '')
  const [validUntil, setValidUntil] = useState(booking.validUntil ? new Date(booking.validUntil).toISOString().slice(0,16) : '')
  const [adminNotes, setAdminNotes] = useState(booking.adminNotes || '')
  const [saving, setSaving] = useState(false)
  const completed = booking.fulfillmentStatus === 'COMPLETED'

  async function fulfill() {
    setSaving(true)
    try {
      const r = await fetch(`/api/admin/bookings/${booking.id}/fulfill`, {
        method:'POST', headers: { 'Content-Type':'application/json', 'x-admin-token': token },
        body: JSON.stringify({ pnrCode, airlineName, eTicketNumber, validUntil, adminNotes })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed')
      toast.success('Fulfilled successfully!')
      onDone()
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-sky-700 bg-sky-50 px-2 py-1 rounded text-sm">{booking.referenceCode}</span>
            {completed && <Badge className="bg-emerald-100 text-emerald-800">Fulfilled</Badge>}
          </DialogTitle>
          <DialogDescription>Full booking details and fulfillment form</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-lg text-sm">
            <div><div className="text-xs text-slate-500">Route</div><div className="font-mono font-semibold">{booking.originIata} → {booking.destinationIata}</div></div>
            <div><div className="text-xs text-slate-500">Departure</div><div className="font-medium">{booking.departureDate}</div></div>
            {booking.returnDate && <div><div className="text-xs text-slate-500">Return</div><div className="font-medium">{booking.returnDate}</div></div>}
            <div><div className="text-xs text-slate-500">Trip</div><div className="font-medium">{booking.tripType === 'ROUND_TRIP' ? 'Round-Trip' : 'One-Way'}</div></div>
            <div><div className="text-xs text-slate-500">Amount</div><div className="font-medium">${booking.totalAmount}</div></div>
            <div><div className="text-xs text-slate-500">Purpose</div><div className="font-medium">{booking.travelPurpose || '-'}</div></div>
            <div><div className="text-xs text-slate-500">Airline pref.</div><div className="font-medium">{booking.preferredAirline || 'Any'}</div></div>
            <div><div className="text-xs text-slate-500">Booked</div><div className="font-medium">{new Date(booking.createdAt).toLocaleString()}</div></div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Mail className="w-4 h-4"/> Contact</div>
            <div className="text-sm space-y-1">
              <div>{booking.contact?.email}</div>
              <div className="text-slate-500">{booking.contact?.phone}</div>
              {booking.contact?.whatsapp && <Badge variant="outline">WhatsApp preferred</Badge>}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2 flex items-center gap-2"><User className="w-4 h-4"/> Passengers ({booking.passengers.length})</div>
            <div className="space-y-2">
              {booking.passengers.map((p, i) => (
                <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm p-3 bg-slate-50 rounded">
                  <div><div className="text-xs text-slate-500">Name</div><div className="font-medium">{p.title} {p.firstName} {p.lastName}</div></div>
                  <div><div className="text-xs text-slate-500">DOB</div><div>{p.dob}</div></div>
                  <div><div className="text-xs text-slate-500">Nationality</div><div>{p.nationality}</div></div>
                  <div><div className="text-xs text-slate-500">Type</div><div>{p.type}</div></div>
                </div>
              ))}
            </div>
          </div>

          <Separator/>

          <div>
            <div className="text-sm font-semibold mb-3">Fulfillment</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Airline name *</Label><Input value={airlineName} onChange={e=>setAirlineName(e.target.value)} placeholder="e.g. Emirates"/></div>
              <div><Label>PNR / Reservation code *</Label><Input value={pnrCode} onChange={e=>setPnrCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={10} className="font-mono uppercase"/></div>
              <div><Label>E-ticket number (optional)</Label><Input value={eTicketNumber} onChange={e=>setETicketNumber(e.target.value)}/></div>
              <div><Label>Reservation valid until</Label><Input type="datetime-local" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></div>
              <div className="md:col-span-2"><Label>Notes (internal)</Label><Textarea rows={2} value={adminNotes} onChange={e=>setAdminNotes(e.target.value)}/></div>
            </div>
            <Button className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700" onClick={fulfill} disabled={saving || !pnrCode || !airlineName}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <CheckCircle2 className="w-4 h-4 mr-2"/>}
              {completed ? 'Update fulfillment' : 'Mark as Fulfilled'}
            </Button>
            <p className="text-xs text-slate-500 mt-2 text-center">Ticket PDF will be emailed manually by admin.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
