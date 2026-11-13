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
  metadataBase: new URL("https://elijahmwangi.net"),
  title: {
    default: "Elijah Mwangi — Software Engineer",
    template: "%s | Elijah Mwangi",
  },
  description:
    "Software engineer with 7 years of experience building .NET back ends, APIs and identity systems. Projects, case studies and writing on software engineering.",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Elijah Mwangi",
    title: "Elijah Mwangi — Software Engineer",
    description:
      "Projects, case studies and writing on .NET, architecture and building an ERP from scratch.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
