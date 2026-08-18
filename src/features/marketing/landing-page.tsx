import {
  ArrowRight,
  Bold,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FilePlus2,
  FileText,
  GitFork,
  Italic,
  LibraryBig,
  Link2,
  Mic,
  Network,
  Plus,
  Printer,
  Search,
  Settings,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import Link from "next/link";
import { MarketingShell } from "@/features/marketing/marketing-shell";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Write the manuscript",
    text: "Keep chapters in order, move between scenes instantly, and print a clean chapter PDF when it is time to share.",
  },
  {
    icon: Network,
    title: "Connect every name",
    text: "Turn characters, places, objects, and ideas into linked pages without leaving the paragraph you are writing.",
  },
  {
    icon: Clock3,
    title: "See the timeline",
    text: "Place chapters and events on a visual timeline so parallel plots and cause-and-effect stay clear.",
  },
  {
    icon: GitFork,
    title: "Understand relationships",
    text: "Map named connections in the relationship web and build a family tree from your Character pages.",
  },
  {
    icon: Tags,
    title: "Organize your world",
    text: "Use page types, aliases, nested pages, and colored tags to find the right detail when you need it.",
  },
  {
    icon: Search,
    title: "Research beside the story",
    text: "Find and save sources in the same workspace as the page they inform instead of losing them in another app.",
  },
  {
    icon: Users,
    title: "Share with a reviewer",
    text: "Invite a beta reader or editor to comment and suggest. One person writes at a time, so drafts are never overwritten.",
  },
];

export function LandingPage() {
  return (
    <MarketingShell>
      <main>
        <section className="marketing-hero">
          <div className="marketing-hero-copy">
            <span className="eyebrow">A CONNECTED WRITING SPACE</span>
            <h1>Keep your whole story connected.</h1>
            <p>
              Write chapters while organizing characters, places, timelines,
              relationships, research, and ideas in one living story workspace.
            </p>
            <div className="marketing-cta-row">
              <Link href="/sign-up" className="marketing-primary-cta">
                Start writing free
                <ArrowRight size={17} />
              </Link>
              <Link href="#how-it-works" className="marketing-secondary-cta">
                See how Grove works
              </Link>
            </div>
            <small>No credit card required · One story free</small>
          </div>
          <ProductPreview />
        </section>

        <section className="marketing-problem" id="how-it-works">
          <span className="eyebrow">ONE PLACE FOR THE WHOLE STORY</span>
          <h2>
            Your manuscript, character notes, timelines, and research should
            not live in five different places.
          </h2>
          <p>
            Grove keeps the page you are writing connected to the world behind
            it—without turning your creative work into a spreadsheet.
          </p>
        </section>

        <section className="marketing-benefits">
          <article>
            <span>01</span>
            <h3>Write</h3>
            <p>A calm editor keeps the current sentence at the center.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Connect</h3>
            <p>Every important name can lead to its own living page.</p>
          </article>
          <article>
            <span>03</span>
            <h3>See</h3>
            <p>Timelines and relationships reveal the shape of the story.</p>
          </article>
        </section>

        <section className="marketing-section" id="features">
          <div className="marketing-section-heading">
            <div>
              <span className="eyebrow">BUILT FOR LONG STORIES</span>
              <h2>Everything stays within reach.</h2>
            </div>
            <p>
              Grove grows from a blank page into a story reference you can
              actually use while drafting.
            </p>
          </div>
          <div className="marketing-feature-grid">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="marketing-feature-card">
                  <span>
                    <Icon size={19} />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="marketing-ai-note">
          <span>
            <Sparkles size={21} />
          </span>
          <div>
            <p className="eyebrow">OPTIONAL AI, YOUR CHOICE</p>
            <h2>Think alongside AI without handing it the whole experience.</h2>
            <p>
              Ask questions about selected text when you want help. Grove
              connects to your own OpenAI, Anthropic, or Google key, and stays
              a writing tool first.
            </p>
          </div>
        </section>

        <section className="marketing-audience">
          <div>
            <span className="eyebrow">FOR NOVELISTS &amp; WORLDBUILDERS</span>
            <h2>Made for stories with roots.</h2>
          </div>
          <blockquote>
            The more your story grows, the more useful its connections become.
          </blockquote>
          <div className="marketing-audience-icons" aria-hidden="true">
            <BookOpen size={22} />
            <GitFork size={22} />
            <Printer size={22} />
          </div>
        </section>

        <section className="marketing-final-cta">
          <span className="eyebrow">BEGIN WITH ONE PAGE</span>
          <h2>Your story already has roots. Give it somewhere to grow.</h2>
          <p>One story and fifty pages are free. No credit card required.</p>
          <div className="marketing-cta-row">
            <Link href="/sign-up" className="marketing-primary-cta">
              Start writing free
              <ArrowRight size={17} />
            </Link>
            <Link href="/pricing" className="marketing-secondary-cta">
              See pricing
            </Link>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}

function ProductPreview() {
  return (
    <div className="marketing-product" aria-label="Preview of the Grove editor">
      <aside className="marketing-app-sidebar">
        <div className="marketing-app-brand">
          <span className="brand-mark">
            <BookOpen size={13} />
          </span>
          <strong>Grove</strong>
          <span>‹</span>
        </div>
        <div className="marketing-app-search">
          <Search size={11} />
          <span>Find anything…</span>
          <kbd>⌘ K</kbd>
        </div>
        <div className="marketing-app-section-label">
          <span>Your story</span>
          <div>
            <span>≡</span>
            <Plus size={10} />
          </div>
        </div>
        <div className="marketing-app-pages">
          <div>
            <ChevronDown size={9} />
            <FileText size={10} />
            <span>Characters</span>
          </div>
          <div className="nested active">
            <span />
            <FileText size={10} />
            <span>Mara Venn</span>
          </div>
          <div>
            <ChevronDown size={9} />
            <FileText size={10} />
            <span>Places</span>
          </div>
          <div className="nested">
            <span />
            <FileText size={10} />
            <span>Evermere</span>
          </div>
          <div>
            <ChevronRight size={9} />
            <FileText size={10} />
            <span>Events</span>
          </div>
        </div>
        <div className="marketing-app-sidebar-group">
          <ChevronDown size={9} />
          <BookOpen size={10} />
          <strong>Chapters</strong>
          <small>3</small>
        </div>
        <div className="marketing-app-chapters">
          <span>1</span>
          <span>The Watchtower</span>
          <span>2</span>
          <span>First Snow</span>
        </div>
        <div className="marketing-app-sidebar-group tags">
          <ChevronRight size={9} />
          <Tags size={10} />
          <strong>Tags</strong>
          <small>4</small>
        </div>
        <div className="marketing-app-sidebar-footer">
          <Settings size={11} />
          <span>Settings</span>
          <b>M</b>
        </div>
      </aside>

      <section className="marketing-app-main">
        <header className="marketing-app-topbar">
          <div>
            <span>← Projects</span>
            <ChevronRight size={9} />
            <span>The Northern Ridge</span>
            <ChevronRight size={9} />
            <strong>Mara Venn</strong>
          </div>
          <nav>
            <small>Saved</small>
            <span>
              <LibraryBig size={10} /> Research
            </span>
            <span>
              <GitFork size={10} /> Relationships
            </span>
            <CircleHelp size={11} />
          </nav>
        </header>
        <article className="marketing-app-document">
          <div className="marketing-app-meta">
            <span>CHARACTER</span>
            <span>•</span>
            <span>EDITED JUST NOW</span>
          </div>
          <div className="marketing-app-type">
            <span>TYPE</span>
            <b>Character⌄</b>
          </div>
          <h2>Mara Venn</h2>
          <div className="marketing-app-alias">
            <span>ALSO KNOWN AS</span>
            <b>The Cartographer</b>
          </div>
          <div className="marketing-app-tags">
            <span>Mystery</span>
            <span>Northern party</span>
          </div>
          <div className="marketing-app-toolbar">
            <Bold size={11} />
            <Italic size={11} />
            <span>H1</span>
            <span>“</span>
            <i />
            <span>
              <FilePlus2 size={10} /> Page
            </span>
            <span>
              <Tags size={10} /> Tag
            </span>
            <span>
              <GitFork size={10} /> Relate
            </span>
            <span>
              <Link2 size={10} /> Links
            </span>
            <span>
              <Mic size={10} /> Dictate
            </span>
          </div>
          <div className="marketing-app-prose">
            <p>
              Mara had always believed the northern ridge ended at the old
              watchtower. On the first morning of winter,{" "}
              <mark>Evermere</mark> appeared beyond it.
            </p>
            <p>
              She folded the map into her coat and followed the path before the
              snow could cover it.
            </p>
          </div>
          <div className="marketing-app-related">
            <span>
              <GitFork size={9} /> child of Elian Venn
            </span>
          </div>
        </article>
      </section>
    </div>
  );
}
