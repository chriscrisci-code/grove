"use client";

import { CircleHelp, X } from "lucide-react";
import { useEffect } from "react";

type HelpDialogProps = {
  onClose: () => void;
};

const SECTIONS = [
  {
    title: "Writing",
    items: [
      {
        keys: ["right-click"],
        text: "A misspelled word with a red underline shows spelling fixes. Every word also shows synonyms and similar words. Click one to replace it.",
      },
      {
        keys: ["toolbar"],
        text: "The formatting icons stay at the top as you scroll. The title and fields above them scroll away.",
      },
    ],
  },
  {
    title: "Linked pages",
    items: [
      {
        keys: ["Alt+P", "/page"],
        text: "Turn the previous word or a selection into a linked sibling page. Grove stays here; new pages get a green dot until you open them.",
      },
      {
        keys: ["click"],
        text: "Click a linked name to open that page. Typing beside a link stays ordinary text.",
      },
      {
        keys: ["Alt+L", "/link"],
        text: "Find Links wraps names on this page that already have pages, including Also known as names. It does not create pages.",
      },
    ],
  },
  {
    title: "Tags and relationships",
    items: [
      {
        keys: ["title"],
        text: "Click the title to tag or relate this page. Long titles wrap. Tag and Relate stay in the toolbar.",
      },
      {
        keys: ["Alt+T", "/t"],
        text: "Tag the last linked page. Click the title first to tag this page instead. Existing tags narrow as you type and keep their color; new tags offer sixteen colors.",
      },
      {
        keys: ["Alt+R", "/r"],
        text: "Name a relationship to another page. A linked name relates this page to that one. Click the title first to pick any page from here.",
      },
    ],
  },
  {
    title: "Types and chapters",
    items: [
      {
        keys: ["Type"],
        text: "Set a page to Script, Event, Character, Location, Animal, Transport, or Unique object. Typed bible pages keep Also known as. Events stay in Your story. Scripts live in the Scripts list, like Chapters.",
      },
      {
        keys: ["Chapters"],
        text: "Chapter pages live only in the Chapters list. Drag order is manuscript order. The printer icon prints chapters to PDF.",
      },
    ],
  },
  {
    title: "Script",
    items: [
      {
        keys: ["Import"],
        text: "On a Script page, Import a chapter copies that chapter here as a first-pass screenplay. The chapter is not overwritten. Scripts live in the Scripts list under Chapters; drag order is print order, and the printer icon prints them as a screenplay PDF.",
      },
      {
        keys: ["Tab", "Enter"],
        text: "Enter makes the next script line. Tab from Action starts a Character cue, from Dialogue starts the next speaker, and on a Scene heading cycles INT. / EXT. / INT./EXT.",
      },
      {
        keys: ["/int", "/ext", "/c"],
        text: "/int and /ext start a scene heading. /c or Alt+C opens character names from Character pages. /cut, /fade, /paren, and /night fill common script lines.",
      },
      {
        keys: ["Alt+S"],
        text: "Start a scene heading. Character names autocomplete as you type a Character line. Tab accepts a name; Enter accepts it and moves to Dialogue.",
      },
    ],
  },
  {
    title: "Timeline",
    items: [
      {
        keys: ["Time"],
        text: "Down the board is later. The arrow labeled Time is that direction.",
      },
      {
        keys: ["Tray"],
        text: "Unused Chapters and Events wait here. Click one to place it after the last card, or drag it onto a rainbow lane.",
      },
      {
        keys: ["Lanes"],
        text: "Six colored lines. Cards snap to a line; the dot on top of a card is which line it is on. Overlap with a neighbor is fine.",
      },
      {
        keys: ["Move"],
        text: "Drag a card up or down to change when it happens, or sideways to change lanes. Click a card to open that page. The X, or a drag back to the tray, takes it off the Timeline.",
      },
      {
        keys: ["double-click"],
        text: "Empty space creates a new Event there and lets you title it immediately. Nesting that Event in Your story does not move it on the Timeline.",
      },
      {
        keys: ["scroll"],
        text: "Scroll near the bottom to grow more time downward.",
      },
    ],
  },
  {
    title: "Sidebar and modes",
    items: [
      {
        keys: ["+"],
        text: "The plus beside Your story creates a top-level page; the plus on a row creates a subpage. The plus beside Chapters or Scripts adds to that list. Pages list A to Z, with subpages under their parent. Drag onto a title to nest, or onto Your story to un-nest. Filter by page type.",
      },
      {
        keys: ["Research"],
        text: "Search and save sources for the current page.",
      },
      {
        keys: ["Relationships"],
        text: "Timeline orders Chapters and Events. Web shows every named connection. Family builds a typed character tree.",
      },
      {
        keys: ["Review"],
        text: "Members can leave page comments, quote selected text, and propose replacement wording. Owners and editors resolve completed notes.",
      },
      {
        keys: ["Share"],
        text: "Grove Plus owners can create a private 14-day invite link for a Reviewer or Editor. Reviewers cannot change story text.",
      },
      {
        keys: ["Alt+A"],
        text: "Ask AI about the current selection. Dictate turns speech into text and stays on through pauses of up to 30 seconds.",
      },
      {
        keys: ["Settings"],
        text: "Connect an AI key, set a sign-in password, choose night colors for low light, and open the Changelog for everything shipped so far.",
      },
      {
        keys: ["Dashboard"],
        text: "Project owners can delete a project from its cover. Grove asks for confirmation because every page, tag, relationship, and research item is permanently removed.",
      },
      {
        keys: ["Paid"],
        text: "Free includes 1 story and 50 pages. Grove Plus will unlock more stories, unlimited pages, collaboration, Ask AI, Research, and chapter PDF. Payments are not connected during the preview.",
      },
    ],
  },
];

export function HelpDialog({ onClose }: HelpDialogProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">GROVE</span>
            <h2 id="help-title">
              <CircleHelp size={20} />
              Page help
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close help"
          >
            <X size={18} />
          </button>
        </header>
        <div className="help-content">
          {SECTIONS.map((section) => (
            <section key={section.title} className="help-section">
              <h3>{section.title}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item.text}>
                    <span className="help-keys">
                      {item.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </span>
                    <p>{item.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
