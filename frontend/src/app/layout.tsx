import type { Metadata } from 'next';
import { ThemeRegistry } from '@theme/theme-registry';
import { Header } from '@react-feature/header';
import './globals.css';
import { ReactNode } from 'react';
import { Container, Divider } from '@mui/material';
import { Footer } from '@react-feature/footer';

export const metadata: Metadata = {
  title: 'Public Transport Spy — DIY Live Departure Board',
  description:
    'Open-source ESP32 OLED departure board for public transport. Pair your display, pick stations and preview live departures.',
  keywords: [
    'ESP32',
    'SSD1322',
    'OLED',
    'departure board',
    'public transport',
    'DIY',
    'open source',
    'SBB',
    'CFF',
    'FFS',
    'Swiss Federal Railways',
    'Schweizerische Bundesbahnen'
  ],
  openGraph: {
    title: 'Public Transport Spy — DIY Live Departure Board',
    description: 'Build your own ESP32 OLED departure board with live public transport data.',
    type: 'website'
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <Header />
          <main className="flex flex-col min-h-screen">
            <Container maxWidth="xl" className="my-8">
              {children}
            </Container>
            <Divider />
            <Footer />
          </main>
        </ThemeRegistry>
      </body>
    </html>
  );
}
