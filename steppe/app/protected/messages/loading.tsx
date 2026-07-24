import { ListSkeleton } from "@/components/page-skeleton";

// Route-level loading UI — shown INSTANTLY on tap, before any server round-trip
// (the click→first-byte feedback the in-page <Suspense> fallbacks can't give).
// Shape-matched to this group's list so real content lands without layout shift.
export default function Loading() {
  return <ListSkeleton />;
}
