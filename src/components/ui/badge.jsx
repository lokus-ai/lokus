import * as React from "react"

const Badge = React.forwardRef(({
  className,
  variant = "default",
  style,
  ...props
}, ref) => {
  const variantStyles = {
    default: {
      backgroundColor: 'rgb(var(--accent))',
      color: 'white',
    },
    secondary: {
      backgroundColor: 'rgb(var(--panel))',
      color: 'rgb(var(--text))',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'rgb(var(--border))',
    },
    outline: {
      color: 'rgb(var(--text))',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'rgb(var(--border))',
    },
    success: {
      backgroundColor: 'rgb(34, 197, 94)',
      color: 'white',
    },
    warning: {
      backgroundColor: 'rgb(234, 179, 8)',
      color: 'white',
    },
    danger: {
      backgroundColor: 'rgb(239, 68, 68)',
      color: 'white',
    },
  }

  const variantStyle = variantStyles[variant] || variantStyles.default

  return (
    <div
      ref={ref}
      style={{
        ...variantStyle,
        ...style
      }}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${className || ''}`}
      {...props}
    />
  )
})

Badge.displayName = "Badge"

export { Badge }
