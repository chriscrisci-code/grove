import {
  ArrowRight,
  Bold,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  FilePlus2,
  FileText,
  GitFork,
  Italic,
  LibraryBig,
  Link2,
  Mic,
  Plus,
  Printer,
  Search,
  Settings,
  Sparkles,
  Tags,
} from "lucide-react";
import Link from "next/link";
import { GROVE_FEATURES } from "@/features/marketing/grove-features";
import { GroveJsonLd } from "@/features/marketing/grove-json-ld";
import { MarketingShell } from "@/features/marketing/marketing-shell";

export function LandingPage() {
  return (
    <MarketingShell>
      <GroveJsonLd />
      <main>
        <section className="marketing-hero">
          <div className="marketing-hero-copy">
            <span className="eyebrow">A CONNECTED WRITING SPACE</span>
            <h1>Keep your whole story connected.</h1>
            <p>
              Write chapters, tend the world beside them, and open a Script
              page when a scene needs to look like a screenplay—all in one
              living workspace.
            </p>
            <div className="marketing-cta-row">
              <Link href="/sign-up" className="marketing-primary-cta">
                Start writing
                <ArrowRight size={17} />
              </Link>
              <Link href="/features" className="marketing-secondary-cta">
                See how Grove works
              </Link>
            </div>
            <small>Free to start · No credit card · One story</small>
          </div>
          <ProductPreview />
        </section>

        <section className="marketing-problem" id="how-it-works">
          <span className="eyebrow">ONE PLACE FOR THE WHOLE STORY</span>
          <h2>
            Your manuscript, world notes, and scripts should not live in five
            different places.
          </h2>
          <p>
            Grove keeps the page you are writing connected to the world behind
            it—and includes a dedicated script format when the work needs to
            look like a screenplay.
          </p>
        </section>

        <section className="marketing-benefits">
          <article>
            <span>01</span>
            <h3>Write</h3>
            <p>
              A calm editor for chapters, and a script format when the scene
              should look like a screenplay.
            </p>
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
              actually use while drafting—chapters, world pages, and script
              format included.
            </p>
          </div>
          <div className="marketing-feature-grid">
            {GROVE_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="marketing-feature-card">
                  <span>
                    <Icon size={19} />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.summary}</p>
                </article>
              );
            })}
          </div>
          <p className="marketing-features-more">
            <Link href="/features">Read the full list of Grove features</Link>
          </p>
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
            <Clapperboard size={22} />
            <Printer size={22} />
          </div>
        </section>

        <section className="marketing-final-cta">
          <span className="eyebrow">FREE FOR EVERYONE</span>
          <h2>Sign up and start writing.</h2>
          <p>
            Every Grove feature is free. No credit card required. Optional
            donations support development.
          </p>
          <div className="marketing-cta-row">
            <Link href="/sign-up" className="marketing-primary-cta">
              Start writing
              <ArrowRight size={17} />
            </Link>
            <Link href="/pricing" className="marketing-secondary-cta">
              Support Grove
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
          <small>2</small>
        </div>
        <div className="marketing-app-chapters">
          <span>1</span>
          <span>The Watchtower</span>
          <span>2</span>
          <span>First Snow</span>
        </div>
        <div className="marketing-app-sidebar-group">
          <ChevronDown size={9} />
          <Clapperboard size={10} />
          <strong>Scripts</strong>
          <small>1</small>
        </div>
        <div className="marketing-app-chapters">
          <span>1</span>
          <span>Watchtower Night</span>
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
