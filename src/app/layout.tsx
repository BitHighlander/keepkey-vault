import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import DeprecationGate from "@/components/DeprecationGate";
import { Provider } from "./provider";
import { MaintenanceWrapper } from "@/components/maintenance/MaintenanceWrapper";
import { Provider as ChakraProvider } from "@/components/ui/provider";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { HeaderProvider } from "@/contexts/HeaderContext";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KeepKey Vault — Deprecated",
  description:
    "KeepKey Vault is no longer supported. Please download and use the KeepKey Desktop app at https://keepkey.com/desktop.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
        suppressHydrationWarning
      >
        <DeprecationGate>
          <ChakraProvider>
            <MaintenanceWrapper>
              <Provider>
                <HeaderProvider>
                  <GlobalHeader />
                  <div style={{ paddingTop: "72px" }}>{children}</div>
                </HeaderProvider>
              </Provider>
            </MaintenanceWrapper>
          </ChakraProvider>
        </DeprecationGate>
      </body>
    </html>
  );
}
