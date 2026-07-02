import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A native <select> styled to match the shadcn/ui form controls.
 *
 * The UI-SPEC calls for the Radix-based shadcn `Select`, but that requires
 * `@radix-ui/react-select`, which is not installed — and threat T-04-SC forbids
 * new package installs in this plan (Rule 3 also excludes installs from
 * auto-fix). This native-select vendoring gives the same cascade UX, spacing,
 * focus ring and typography without a new dependency, following the Plan 03
 * precedent (native details/summary user-menu, vendored Separator). Swapping in
 * the Radix `Select` later is a low-risk refactor once the dep is added.
 */
function SelectNative({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select-native"
        className={cn(
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-9 w-full appearance-none rounded-md border bg-transparent px-3 py-2 pr-8 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
    </div>
  );
}

export { SelectNative };
