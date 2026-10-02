import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { searchAirports } from '@/lib/airports'

export const runtime = 'nodejs'

// ---------------- Mongo ----------------
let client
let dbRef
async function getDb() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    dbRef = client.db(process.env.DB_NAME)
  }
  return dbRef
}

// ---------------- Stripe ----------------
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || ''
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null

// ---------------- Admin ----------------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const ADMIN_TOKEN = 'onward-admin-' + ADMIN_PASSWORD

function requireAdmin(request) {
  const auth = request.headers.get('x-admin-token') || ''
  return auth === ADMIN_TOKEN
}

// ---------------- Helpers ----------------
function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token')
  return res
}
const json = (data, status = 200) => cors(NextResponse.json(data, { status }))

function generateReferenceCode() {
  const year = new Date().getFullYear()
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return `DT-${year}-${out}`
}

function computeValidity(departureDateStr) {
  const dep = new Date(departureDateStr + 'T00:00:00Z')
  const now = new Date()
  const diffHours = (dep - now) / (1000 * 60 * 60)
  if (diffHours > 14 * 24) {
    return { rule: 'A', label: 'Advance Booking', message: 'Reservation verified and valid up to 14 days prior to travel date.', urgent: false }
  }
  if (diffHours >= 24) {
    return { rule: 'B', label: 'Near-Term Booking', message: 'Reservation hold guaranteed valid for 24 to 48 hours from issuance.', urgent: false }
  }
  return { rule: 'C', label: 'Urgent Booking', message: 'Emergency priority: reservation held for 24 hours maximum.', urgent: true }
}

function computeTotal(tripType, passengerCount) {
  const perPax = tripType === 'ROUND_TRIP' ? 30 : 15
  return perPax * passengerCount
}

const stripDoc = (d) => {
  if (!d) return d
  const { _id, ...rest } = d
  return rest
}

// ---------------- Route handler ----------------
export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }))
}

async function handle(request, { params }) {
  const { path = [] } = await params
  const route = '/' + path.join('/')
  const method = request.method
  try {
    const db = await getDb()

    if (route === '/airports' && method === 'GET') {
      const url = new URL(request.url)
      const q = url.searchParams.get('q') || ''
      return json(searchAirports(q))
    }

    if (route === '/bookings' && method === 'POST') {
      const body = await request.json()
      const {
        tripType, originIata, destinationIata,
        departureDate, returnDate,
        adults = 1, children = 0, infants = 0,
        contact = {}, passengers = [],
        travelPurpose, preferredAirline
      } = body

      if (!['ONE_WAY', 'ROUND_TRIP'].includes(tripType)) return json({ error: 'Invalid trip type' }, 400)
      if (!originIata || !destinationIata) return json({ error: 'Origin and destination required' }, 400)
      if (originIata === destinationIata) return json({ error: 'Origin and destination must differ' }, 400)
      if (!departureDate) return json({ error: 'Departure date required' }, 400)
      if (tripType === 'ROUND_TRIP' && !returnDate) return json({ error: 'Return date required for round-trip' }, 400)
      if (!contact.email) return json({ error: 'Email required' }, 400)
      if (!Array.isArray(passengers) || passengers.length === 0) return json({ error: 'At least one passenger required' }, 400)

      const totalPax = passengers.length
      const totalAmount = computeTotal(tripType, totalPax)
      const validity = computeValidity(departureDate)
      const referenceCode = generateReferenceCode()
      const id = uuidv4()
      const now = new Date()

      const booking = {
        id,
        referenceCode,
        tripType,
        originIata,
        destinationIata,
        departureDate,
        returnDate: returnDate || null,
        adults, children, infants,
        contact,
        passengers: passengers.map(p => ({ id: uuidv4(), ...p })),
        travelPurpose: travelPurpose || null,
        preferredAirline: preferredAirline || null,
        totalAmount,
        currency: 'USD',
        paymentStatus: 'PENDING',
        fulfillmentStatus: 'UNFULFILLED',
        stripeSessionId: null,
        paymentIntentId: null,
        validity,
        pnrCode: null,
        airlineName: null,
        eTicketNumber: null,
        validUntil: null,
        adminNotes: null,
        createdAt: now,
        updatedAt: now,
        paidAt: null,
        fulfilledAt: null,
      }

      await db.collection('bookings').insertOne({ ...booking })
      return json({ id, referenceCode, totalAmount, validity })
    }

    if (route === '/tracking' && method === 'GET') {
      const reference = (new URL(request.url).searchParams.get('reference') || '').trim().toUpperCase()
      const trackingJson = (data, status = 200) => {
        const response = json(data, status)
        response.headers.set('Cache-Control', 'private, no-store, max-age=0')
        return response
      }
      if (!/^DT-\d{4}-[A-Z0-9]{4}$/.test(reference)) {
        return trackingJson({ error: 'Enter a valid DT-reference, such as DT-2026-ABCD.' }, 400)
      }
      // Status-only lookup: never return passenger, contact, payment IDs, PNR or admin notes.
      const booking = await db.collection('bookings').findOne(
        { referenceCode: reference },
        { projection: {
          _id: 0, referenceCode: 1, paymentStatus: 1, fulfillmentStatus: 1,
          updatedAt: 1, fulfilledAt: 1, mockPayment: 1,
        } }
      )
      if (!booking) return trackingJson({ error: 'No order found. Check your DT-reference and try again.' }, 404)
      return trackingJson(booking)
    }

    if (route.startsWith('/bookings/') && method === 'GET') {
      const ref = decodeURIComponent(path[1] || '')
      const b = await db.collection('bookings').findOne({ referenceCode: ref })
      if (!b) return json({ error: 'Booking not found' }, 404)
      return json(stripDoc(b))
    }

    if (route === '/checkout' && method === 'POST') {
      const body = await request.json()
      const { bookingId } = body
      const booking = await db.collection('bookings').findOne({ id: bookingId })
      if (!booking) return json({ error: 'Booking not found' }, 404)
      if (booking.paymentStatus === 'PAID') return json({ error: 'Already paid' }, 409)

      const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

      if (!stripe) {
        await db.collection('bookings').updateOne(
          { id: bookingId },
          { $set: { paymentStatus: 'PAID', paidAt: new Date(), updatedAt: new Date(), mockPayment: true } }
        )
        const successUrl = `${appUrl}/success?ref=${booking.referenceCode}&mock=1`
        return json({ url: successUrl, mock: true })
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${booking.tripType === 'ROUND_TRIP' ? 'Round-Trip' : 'One-Way'} Flight Reservation`,
              description: `${booking.originIata} to ${booking.destinationIata} - ${booking.passengers.length} passenger(s)`,
            },
            unit_amount: booking.totalAmount * 100,
          },
          quantity: 1,
        }],
        metadata: { booking_id: booking.id, reference_code: booking.referenceCode },
        customer_email: booking.contact.email,
        success_url: `${appUrl}/success?ref=${booking.referenceCode}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/?canceled=1&ref=${booking.referenceCode}`,
      })

      await db.collection('bookings').updateOne(
        { id: bookingId },
        { $set: { stripeSessionId: session.id, updatedAt: new Date() } }
      )
      return json({ url: session.url, sessionId: session.id })
    }

    if (route === '/verify-session' && method === 'GET') {
      const url = new URL(request.url)
      const sessionId = url.searchParams.get('session_id')
      const ref = url.searchParams.get('ref')
      if (!ref) return json({ error: 'ref required' }, 400)

      const booking = await db.collection('bookings').findOne({ referenceCode: ref })
      if (!booking) return json({ error: 'Booking not found' }, 404)

      if (booking.paymentStatus === 'PAID') return json({ paid: true, booking: stripDoc(booking) })

      if (stripe && sessionId) {
        try {
          const session = await stripe.checkout.sessions.retrieve(sessionId)
          if (session.payment_status === 'paid') {
            await db.collection('bookings').updateOne(
              { id: booking.id },
              { $set: { paymentStatus: 'PAID', paidAt: new Date(), updatedAt: new Date(), paymentIntentId: session.payment_intent || null } }
            )
            const updated = await db.collection('bookings').findOne({ id: booking.id })
            return json({ paid: true, booking: stripDoc(updated) })
          }
        } catch (e) {
          console.error('Stripe retrieve error:', e.message)
        }
      }

      return json({ paid: false, booking: stripDoc(booking) })
    }

    if (route === '/webhook' && method === 'POST') {
      if (!stripe) return json({ error: 'Stripe not configured' }, 400)
      const sig = request.headers.get('stripe-signature')
      const rawBody = await request.text()
      let event
      try {
        if (process.env.STRIPE_WEBHOOK_SECRET) {
          event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
        } else {
          event = JSON.parse(rawBody)
        }
      } catch (err) {
        return json({ error: 'Invalid signature' }, 400)
      }
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object
        const bookingId = session.metadata?.booking_id
        if (bookingId) {
          await db.collection('bookings').updateOne(
            { id: bookingId },
            { $set: { paymentStatus: 'PAID', paidAt: new Date(), updatedAt: new Date(), paymentIntentId: session.payment_intent || null } }
          )
        }
      }
      return json({ received: true })
    }

    if (route === '/admin/login' && method === 'POST') {
      const body = await request.json()
      if (body.password === ADMIN_PASSWORD) {
        return json({ token: ADMIN_TOKEN })
      }
      return json({ error: 'Invalid password' }, 401)
    }

    if (route === '/admin/bookings' && method === 'GET') {
      if (!requireAdmin(request)) return json({ error: 'Unauthorized' }, 401)
      const url = new URL(request.url)
      const status = url.searchParams.get('status')
      const search = url.searchParams.get('search') || ''
      const q = {}
      if (status === 'PENDING_FULFILLMENT') { q.paymentStatus = 'PAID'; q.fulfillmentStatus = { $ne: 'COMPLETED' } }
      else if (status === 'COMPLETED') { q.fulfillmentStatus = 'COMPLETED' }
      else if (status === 'CANCELLED') { q.paymentStatus = { $in: ['CANCELLED', 'REFUNDED', 'FAILED'] } }
      if (search) {
        q.$or = [
          { referenceCode: { $regex: search, $options: 'i' } },
          { 'contact.email': { $regex: search, $options: 'i' } },
        ]
      }
      const rows = await db.collection('bookings').find(q).sort({ createdAt: -1 }).limit(500).toArray()
      return json(rows.map(stripDoc))
    }

    if (route.startsWith('/admin/bookings/') && method === 'GET' && path.length === 3) {
      if (!requireAdmin(request)) return json({ error: 'Unauthorized' }, 401)
      const id = path[2]
      const b = await db.collection('bookings').findOne({ id })
      if (!b) return json({ error: 'Not found' }, 404)
      return json(stripDoc(b))
    }

    if (route.match(/^\/admin\/bookings\/[^/]+\/fulfill$/) && method === 'POST') {
      if (!requireAdmin(request)) return json({ error: 'Unauthorized' }, 401)
      const id = path[2]
      const body = await request.json()
      const { pnrCode, airlineName, eTicketNumber, validUntil, adminNotes } = body
      if (!pnrCode || !airlineName) return json({ error: 'PNR and airline required' }, 400)
      const upd = {
        pnrCode, airlineName,
        eTicketNumber: eTicketNumber || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        adminNotes: adminNotes || null,
        fulfillmentStatus: 'COMPLETED',
        fulfilledAt: new Date(),
        updatedAt: new Date(),
      }
      const result = await db.collection('bookings').updateOne({ id }, { $set: upd })
      if (result.matchedCount === 0) return json({ error: 'Not found' }, 404)
      return json({ ok: true })
    }

    if (route.match(/^\/admin\/bookings\/[^/]+\/cancel$/) && method === 'POST') {
      if (!requireAdmin(request)) return json({ error: 'Unauthorized' }, 401)
      const id = path[2]
      await db.collection('bookings').updateOne({ id }, { $set: { paymentStatus: 'CANCELLED', updatedAt: new Date() } })
      return json({ ok: true })
    }

    return json({ error: `Route ${route} not found` }, 404)
  } catch (err) {
    console.error('API error:', err)
    return json({ error: 'Internal server error', detail: err.message }, 500)
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
export const PATCH = handle
