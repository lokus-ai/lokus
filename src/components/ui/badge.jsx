import * as React from "react"
import { cn } from "../../lib/utils"

const badgeVariants = {
  variant: {
    default: "border-transparent bg-app-accent text-app-accent-fg hover:bg-app-accent/80",
    secondary: "border-transparent bg-app-panel text-app-text hover:bg-app-panel/80",
    destructive: "border-transparent bg-red-500 text-white hover:bg-red-600",
    outline: "text-app-text border-app-border",
  },
}

function Badge({ className, variant = "default", ...props }) {
  const variantClasses = badgeVariants.variant[variant] || badgeVariants.variant.default

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-app-accent/40 focus:ring-offset-0",
        variantClasses,
        className
      )}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
