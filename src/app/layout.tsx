import "./globals.css";
import "./dashboard.css";
import type { Metadata, Viewport } from "next";
import { Montserrat, Poppins } from "next/font/google";
import { ToastContainer } from "@/components/ui/Toast";

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
  other: { "color-scheme": "light" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#EBF4F2",
  viewportFit: "cover",
};

// Runs before first paint so the saved text size never flashes. (The app is light-only; a stale dark flag is cleared.)
const THEME_SCRIPT = `
(function () {
  try {
    var sz = localStorage.getItem('c35_font_size');
    if (sz) document.documentElement.dataset.fontSize = sz;
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('c35_theme');
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
      </body>
    </html>
  );
}
