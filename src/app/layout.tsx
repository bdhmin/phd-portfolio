import type { Metadata } from 'next';
import './globals.css';
import { sansSerif } from './fonts';

export const metadata: Metadata = {
  title: 'Bryan Min',
  description: "Bryan's Portfolio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sansSerif.className} antialiased`}>{children}</body>
    </html>
  );
}
