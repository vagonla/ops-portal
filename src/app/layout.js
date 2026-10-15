import "./globals.css";
import { Anek_Latin } from 'next/font/google';
import ErrorBoundary from "./ErrorBoundary";
import { ShiftProvider } from "@/context/ShiftContext";
import LocalDataCleanup from "@/components/LocalDataCleanup";

const anekLatin = Anek_Latin({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-anek-latin',
});

export const metadata = {
  title: "OPS Portal",
  description: "Haftalık vardiya programı görüntüleyici",
};

// Mobil uyumluluk için viewport — kullanıcı yakınlaştırmasını engeller,
// iOS Safari'de env(safe-area-inset-*) değerlerinin doğru çalışmasını sağlar
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className={anekLatin.variable}>
      <body>
        <ErrorBoundary>
            <ShiftProvider>
              <LocalDataCleanup />
              {children}
            </ShiftProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
