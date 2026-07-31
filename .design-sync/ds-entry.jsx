// Design-system entry for claude.ai/design (design-sync).
// Explicit re-export surface of src/components/ui — edit this to change what syncs.
export { Badge, badgeVariants } from "../src/components/ui/badge.jsx";
export { Button, buttonVariants } from "../src/components/ui/button.jsx";
export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator } from "../src/components/ui/command.jsx";
export { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent, ContextMenuCheckboxItem, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuLabel, ContextMenuShortcut } from "../src/components/ui/context-menu.jsx";
export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "../src/components/ui/dialog.jsx";
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuShortcut } from "../src/components/ui/dropdown-menu.jsx";
export { Input } from "../src/components/ui/input.jsx";
export { Label } from "../src/components/ui/label.jsx";
export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton } from "../src/components/ui/select.jsx";
export { Toaster } from "../src/components/ui/sonner.jsx";
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from "../src/components/ui/table.jsx";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "../src/components/ui/tabs.jsx";
export { Textarea } from "../src/components/ui/textarea.jsx";
export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose, ToastAction } from "../src/components/ui/toast.jsx";
export { LokusRoot } from "./lokus-root.jsx";
// sonner's imperative API — the Toaster above is only a mount point, so the
// design agent needs toast() from the SAME module instance the bundle inlines.
export { toast } from "sonner";
