import * as React from "react"
import { cn } from "../../lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text ring-offset-app-bg file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-app-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/40 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }
