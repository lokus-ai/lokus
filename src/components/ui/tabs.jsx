import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import './tabs.css'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, style, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    style={{
      backgroundColor: 'rgb(var(--panel))',
      color: 'rgb(var(--muted))',
      ...style
    }}
    className={`inline-flex h-10 items-center justify-center rounded-md p-1 ${className || ''}`}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, style, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    style={{
      '--ring-offset-color': 'rgb(var(--bg))',
      '--ring-color': 'rgb(var(--accent))',
      ...style
    }}
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${className || ''}`}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, style, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    style={{
      '--ring-offset-color': 'rgb(var(--bg))',
      '--ring-color': 'rgb(var(--accent))',
      ...style
    }}
    className={`mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${className || ''}`}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
