import type { Metadata, Viewport } from "next";
// Self-hosted variable fonts (no build-time dependency on fonts.gstatic.com):
// - Inter Variable: latin + cyrillic (RU)
// - Heebo Variable: hebrew + latin (HE)
import "@fontsource-variable/inter";
import "@fontsource-variable/heebo";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";

export const metadata: Metadata = {
  title: "GymShift — календарь смен для тренеров",
  description:
    "Онлайн-календарь рабочих смен спортзала: все тренеры видят изменения в реальном времени. Русский и иврит, 10 тем, виды «сегодня / 3 дня / неделя / месяц», панель последних изменений.",
  keywords: ["календарь смен", "спортзал", "тренеры", "GymShift", "משמרות מאמנים"],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GymShift",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
};

/**
 * Applies saved theme + language + font scale before first paint (no flash):
 * - resolves "auto" theme by current hour (morning/day/sunset/night)
 * - sets dir="rtl" for Hebrew
 * - restores the UI font scale (0.8..1.4, see FontSizeControl in the header)
 */
const themeInit = `(function(){try{var t=localStorage.getItem("gs-theme")||"auto";if(t==="auto"){var h=new Date().getHours();t=(h>=5&&h<11)?"morning":(h>=11&&h<17)?"day":(h>=17&&h<22)?"sunset":"night";}document.documentElement.dataset.theme=t;var l=localStorage.getItem("gs-lang");if(l==="he"){document.documentElement.dir="rtl";document.documentElement.lang="he";}var f=parseFloat(localStorage.getItem("gs-font-scale")||"1");if(f>=0.8&&f<=1.4&&f!==1){document.documentElement.style.fontSize=(16*f)+"px";}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" dir="ltr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
          <Toaster />
        </Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
