import type { Metadata } from "next";
import { CreateChallengeForm } from "@/components/duel/CreateChallengeForm";

export const metadata: Metadata = { title: "Start a duel" };

export default function NewChallengePage() {
  return <CreateChallengeForm />;
}
