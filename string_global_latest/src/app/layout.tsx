import './globals.css';
import type { Metadata } from 'next';
import { AppProviders } from '@/components/AppProviders';

export const metadata: Metadata = {
  title: 'StringGlobe MVP',
  description: 'Zero-friction digital stringing system',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'StringGlobe',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
