import { FormSkeleton } from "@/components/page-skeleton";

// Route-level loading UI — instant client-side skeleton on tap. Shape-matched to
// this group's form so the real fields land without layout shift.
export default function Loading() {
  return <FormSkeleton />;
}
