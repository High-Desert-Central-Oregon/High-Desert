import type { ComponentPropsWithoutRef } from "react";

type ChoiceCardProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "type" | "className" | "title" | "id"
> & {
  id: string;
  title: string;
  description: string;
};

/** A native radio with a readable selected surface and a card-wide focus cue. */
export function ChoiceCard({
  id,
  title,
  description,
  checked,
  ...props
}: ChoiceCardProps) {
  return (
    <label
      className="choice-card flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors"
      data-selected={checked}
    >
      <input
        {...props}
        id={id}
        type="radio"
        checked={checked}
        aria-describedby={`${id}-description`}
        className="mt-1 size-4 shrink-0 accent-foreground"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}
