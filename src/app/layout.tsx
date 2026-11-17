import "./globals.css";
import "./dashboard.css";
import "./dark.css";
import type { Metadata, Viewport } from "next";
import { Montserrat, Poppins } from "next/font/google";
import { ToastContainer } from "@/components/ui/Toast";
import { CookieConsent } from "@/components/ui/CookieConsent";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EduCore",
  description: "Next-generation smart classroom operating system",
  other: { "color-scheme": "light dark" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#EBF4F2",
  viewportFit: "cover",
};

// Runs before first paint so the saved text size and theme never flash. No saved choice means the system setting.
const THEME_SCRIPT = `
(function () {
  try {
    var ok = /(?:^|; )c35_consent=[^;]*preferences%22%3Atrue/.test(document.cookie);
    var sz = ok ? localStorage.getItem('c35_font_size') : null;
    if (sz) document.documentElement.dataset.fontSize = sz;
    var th = ok ? localStorage.getItem('c35_theme') : null;
    var dark = th ? th === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (_) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${montserrat.variable} ${poppins.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
        <ToastContainer />
        <CookieConsent />
      </body>
    </html>
  );
}
