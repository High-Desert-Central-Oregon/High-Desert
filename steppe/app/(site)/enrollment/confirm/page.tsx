import { Suspense } from "react";
import { ConfirmationForm } from "./confirmation-form";
export const metadata = {
  title: "Steppe",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
async function Content({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <ConfirmationForm
      token={
        typeof token === "string" && /^[a-f0-9]{64}$/.test(token) ? token : ""
      }
    />
  );
}
export default function Page(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <div className="mx-auto max-w-lg px-6 py-20">
      <Suspense fallback={<p>Steppe</p>}>
        <Content {...props} />
      </Suspense>
    </div>
  );
}
