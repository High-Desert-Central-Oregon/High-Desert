import { PageSkeleton } from "@/components/page-skeleton";

// Route-level loading UI — instant client-side skeleton on tap. Cards silhouette
// (this segment's real content). The root file also backs any group without its
// own loading.tsx; each group above overrides it with a shape-matched skeleton.
export default function Loading() {
  return <PageSkeleton />;
}
