import { NightThemeRoot } from "@/features/workspace/night-theme-root";
import type { Metadata } from "next";
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
  title: "Grove",
  description: "A connected writing space for stories and worlds.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="day"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("grove-theme");if(t==="night")document.documentElement.setAttribute("data-theme","night")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full">
        <NightThemeRoot />
        {children}
      </body>
    </html>
  );
}
