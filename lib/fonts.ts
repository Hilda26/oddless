import { Anton, Inter_Tight, Roboto_Mono } from "next/font/google";

/**
 * Display face: Anton — a tall, condensed grotesk used for the poster-style
 * headline system ("TWO SIDES. SAME STAKE. NO HOUSE."). Spec calls for
 * Anton or an equivalently strong condensed grotesk; Anton is used directly.
 */
export const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

/** UI face for body copy, forms, and buttons. */
export const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter-tight",
  display: "swap",
});

/** Meta face for on-chain terms, addresses, hashes, timestamps. */
export const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const fontVariables = `${anton.variable} ${interTight.variable} ${robotoMono.variable}`;
