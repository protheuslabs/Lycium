import type { Metadata } from "next";
import FlashcardsApp from "../../../components/Flashcards/FlashcardsApp";

export const metadata: Metadata = {
  title: "Flashcards | Lycium",
  description: "Create and study flashcard decks for courses, labs, and independent learning.",
  alternates: { canonical: "/tools/flashcards" },
};

export default function FlashcardsPage() {
  return <FlashcardsApp />;
}
