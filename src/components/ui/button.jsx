import * as React from "react"

const Button = React.forwardRef(({
  className,
  variant = "default",
  size = "default",
  style,
  ...props
}, ref) => {
  const sizeClasses = {
    default: "h-10 px-4 py-2",
    sm: "h-9 px-3 text-sm",
    lg: "h-11 px-8",
    icon: "h-10 w-10",
  }

  const variantStyles = {
    default: {
      backgroundColor: 'rgb(var(--accent))',
      color: 'white',
    },
    outline: {
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'rgb(var(--border))',
      backgroundColor: 'transparent',
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    secondary: {
      backgroundColor: 'rgb(var(--panel))',
      color: 'rgb(var(--text))',
    },
  }

  const sizeClass = sizeClasses[size] || sizeClasses.default
  const variantStyle = variantStyles[variant] || variantStyles.default

  return (
    <button
      ref={ref}
      style={{
        ...variantStyle,
        ...style
      }}
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 hover:opacity-90 ${sizeClass} ${className || ''}`}
      {...props}
    />
  )
})

Button.displayName = "Button"

export { Button }
