import type { Metadata, Viewport } from "next";
import { Provider } from './provider';
import { MaintenanceWrapper } from '@/components/maintenance/MaintenanceWrapper';

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KeepKey Vault | Secure Crypto Wallet Management",
  description: "KeepKey Vault - The secure way to manage your cryptocurrency wallet. Store, send and receive crypto with confidence using the trusted hardware wallet solution.",
  keywords: [
    "KeepKey", 
    "hardware wallet", 
    "crypto wallet", 
    "bitcoin wallet", 
    "cryptocurrency storage", 
    "secure wallet", 
    "digital asset management",
    "ethereum wallet",
    "cold storage",
    "blockchain security"
  ],
  authors: [{ name: "KeepKey" }],
  creator: "KeepKey",
  publisher: "KeepKey",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://keepkey.com/vault",
    siteName: "KeepKey Vault",
    title: "KeepKey Vault | Secure Crypto Wallet Management",
    description: "The secure way to manage your cryptocurrency with the trusted KeepKey hardware wallet. Take control of your digital assets.",
    images: [
      {
        url: "/images/logos/keepkey-logo-square.png",
        width: 1200,
        height: 630,
        alt: "KeepKey Vault"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "KeepKey Vault | Secure Crypto Wallet Management",
    description: "The secure way to manage your cryptocurrency with the trusted KeepKey hardware wallet. Take control of your digital assets.",
    images: ["/images/logos/keepkey-logo-square.png"],
    creator: "@keepkey"
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" }
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" }
    ]
  },
  robots: {
    index: true,
    follow: true
  },

  category: "Finance"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <MaintenanceWrapper>
          <Provider>{children}</Provider>
        </MaintenanceWrapper>
      </body>
    </html>
  );
}
