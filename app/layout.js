import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'OnwardTicket · Verified Flight Reservations',
  description: 'Verified flight reservations for visa applications, immigration and proof of onward travel. Real PNR-backed bookings delivered in 30-120 minutes.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
