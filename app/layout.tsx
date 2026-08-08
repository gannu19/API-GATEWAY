import React from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata = {
  title: 'API Gateway Control Center & Admin Portal (TypeScript)',
  description: 'Distributed API Gateway monitoring, rate limiting, and microservice traffic controller built with Next.js, Clerk Auth, Tailwind CSS & TypeScript',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html lang="en">
        <body className="dark font-sans antialiased transition-colors duration-300">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
