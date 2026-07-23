import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Griswold Hospitality — Client Portal',
  description: 'Private audit reports and performance data for your properties.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
