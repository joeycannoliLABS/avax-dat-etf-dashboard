import './globals.css';
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: 'Avalanche Institutional Dashboard | DATs & ETFs holding $AVAX',
  description: 'Track Avalanche Digital Asset Treasuries and ETFs. Live AVAX holdings, valuations, and institutional adoption data for AVAX One, Avalanche Treasury Co., DeFi Technologies, VanEck, Grayscale, and Bitwise.',
  keywords: 'Avalanche, AVAX, DAT, Digital Asset Treasury, ETF, VanEck, Grayscale, Bitwise, AVAX One, AVAT, DeFi Technologies, crypto institutional',
  openGraph: {
    title: 'Avalanche Institutional Dashboard',
    description: 'Live tracker for Avalanche Digital Asset Treasuries & ETFs. Holdings, valuations, and institutional AVAX adoption.',
    url: 'https://avax-dat-etf-dashboard.vercel.app',
    siteName: 'Avalanche Institutional Dashboard',
    type: 'website',
    images: [
      {
        url: '/avalanche-logo.png',
        width: 800,
        height: 400,
        alt: 'Avalanche Institutional Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Avalanche Institutional Dashboard',
    description: 'Live tracker for Avalanche Digital Asset Treasuries & ETFs. Holdings, valuations, and institutional AVAX adoption.',
    images: ['/avalanche-logo.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
