import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Minimal Separator (shadcn-shaped). The canonical shadcn separator wraps
 * @radix-ui/react-separator, but that primitive is a thin div with role/aria
 * attributes. To avoid pulling a new dependency into this plan (threat T-03-SC:
 * no new package installs), this vendors an equivalent accessible element.
 */
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}) {
  return (
    <div
      data-slot="separator"
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "bg-border shrink-0",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
