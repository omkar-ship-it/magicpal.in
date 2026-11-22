import type { Metadata } from "next";
import "./brainmate.css";
import TzCookie from "@/components/brainMate/TzCookie";

export const metadata: Metadata = {
  title: "Brain-Mate — Find your Brain-Mates",
  description: "12 kinds of minds. Which one is yours? Play in about 3 minutes, then find your Wavelength with a friend.",
};

/** Brain-Mate is a game, not a map panel: it gets its own full-screen chrome. */
export default function BrainMateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bm-root">
      <TzCookie />
      {children}
    </div>
  );
}
