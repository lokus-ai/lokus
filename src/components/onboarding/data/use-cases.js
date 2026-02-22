import { BookOpen, GraduationCap, Briefcase, PenTool, Database } from "lucide-react";

export const USE_CASES = [
  {
    id: "personal",
    icon: BookOpen,
    title: "Personal Notes",
    description: "Capture ideas, journal entries, and personal knowledge",
  },
  {
    id: "academic",
    icon: GraduationCap,
    title: "Academic",
    description: "Research notes, lecture summaries, and study materials",
  },
  {
    id: "professional",
    icon: Briefcase,
    title: "Professional",
    description: "Meeting notes, project docs, and work knowledge base",
  },
  {
    id: "creative",
    icon: PenTool,
    title: "Creative Writing",
    description: "Stories, scripts, worldbuilding, and creative projects",
  },
  {
    id: "knowledge-base",
    icon: Database,
    title: "Knowledge Base",
    description: "Build a connected wiki of everything you know",
  },
];
