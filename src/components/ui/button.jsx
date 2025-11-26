import * as React from "react"
import { cn } from "../../lib/utils"

const buttonVariants = {
  variant: {
    default: "bg-app-accent text-app-accent-fg hover:bg-app-accent/90",
    destructive: "bg-red-500 text-white hover:bg-red-600",
    outline: "border border-app-border bg-transparent hover:bg-app-panel text-app-text",
    secondary: "bg-app-panel text-app-text hover:bg-app-panel/80",
    ghost: "hover:bg-app-panel hover:text-app-text",
    link: "text-app-accent underline-offset-4 hover:underline",
  },
  size: {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  },
}

const Button = React.forwardRef(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = buttonVariants.variant[variant] || buttonVariants.variant.default
    const sizeClasses = buttonVariants.size[size] || buttonVariants.size.default

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-app-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/40 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
          variantClasses,
          sizeClasses,
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
