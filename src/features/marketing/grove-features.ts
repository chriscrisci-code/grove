import {
  BookOpen,
  Clapperboard,
  Clock3,
  GitFork,
  Mic,
  Network,
  Search,
  Tags,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type GroveFeature = {
  icon: LucideIcon;
  title: string;
  summary: string;
  detail: string;
};

export const GROVE_FEATURES: GroveFeature[] = [
  {
    icon: BookOpen,
    title: "Write the manuscript",
    summary:
      "Keep chapters in their own list, move between scenes as you draft, and print a clean chapter PDF when it is time to share.",
    detail:
      "Chapters live beside the rest of the story, in the order you will export them. Open any chapter to keep writing, then print the manuscript without assembling files from somewhere else.",
  },
  {
    icon: Clapperboard,
    title: "Write in script format",
    summary:
      "Open a Script page to draft in screenplay form—scene headings, character cues, and dialogue—inside the same story.",
    detail:
      "Grove includes a dedicated script format for when a scene needs to look like a screenplay. Script pages have their own list, use screenplay layout while you write, and print in that form. They sit with your chapters and world pages, not in a separate program.",
  },
  {
    icon: Network,
    title: "Connect every name",
    summary:
      "Turn characters, places, objects, and ideas into linked pages without leaving the paragraph you are writing.",
    detail:
      "A name on the page can become its own living entry. Click through to the character or place, then return to the sentence you were finishing. Also known as names can be found the same way.",
  },
  {
    icon: Clock3,
    title: "See the timeline",
    summary:
      "Place chapters and events on a visual timeline so parallel plots and cause-and-effect stay clear.",
    detail:
      "The Timeline is a board you scroll through in time. Drop chapters and events onto colored lanes, create a new event where it belongs, and open any card to write the page behind it.",
  },
  {
    icon: GitFork,
    title: "Understand relationships",
    summary:
      "Map named connections in the relationship web and build a family tree from your Character pages.",
    detail:
      "Name how pages relate—lives in, knows, owns—and see them on a pan-able web. Character pages can also form a typed family tree with parents, partners, and the people who descend from them.",
  },
  {
    icon: Tags,
    title: "Organize your world",
    summary:
      "Use page types, aliases, nested pages, and colored tags to find the right detail when you need it.",
    detail:
      "Give a page a type such as Character, Location, or Event. Nest notes under notes, color your tags, and keep Also known as names so the story bible stays searchable while you draft.",
  },
  {
    icon: Search,
    title: "Research beside the story",
    summary:
      "Find and save sources in the same workspace as the page they inform, instead of losing them in another app.",
    detail:
      "Open Research from the page you are writing. Search, save a source with its link, or drop an image onto that page. Research stays attached to the entry.",
  },
  {
    icon: Users,
    title: "Share with a reviewer",
    summary:
      "Invite a beta reader or editor to comment and suggest. One person writes at a time, so drafts are never overwritten.",
    detail:
      "Send a private invite. Reviewers can read, copy, comment, and suggest wording. Editors can also write. Grove keeps one editing session at a time so two people cannot overwrite the same draft.",
  },
  {
    icon: Mic,
    title: "Dictate and look up words",
    summary:
      "Speak the sentence when typing would break the thought. Right-click a word for spelling and similar words.",
    detail:
      "Dictate stays with you through ordinary pauses. Right-click any word for spelling fixes, synonyms, and related words, then keep moving.",
  },
];
