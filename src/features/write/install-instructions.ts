export type InstallPlatform =
  | "ios"
  | "android"
  | "windows"
  | "macos"
  | "linux"
  | "other";

export type InstallBrowser = "chrome" | "edge" | "safari" | "firefox" | "other";

export type InstallEnvironment = {
  platform: InstallPlatform;
  browser: InstallBrowser;
};

export type InstallGuide = {
  title: string;
  steps: string[];
};

export function detectInstallEnvironment(
  userAgent: string,
): InstallEnvironment {
  const ua = userAgent.toLowerCase();
  let platform: InstallPlatform = "other";
  if (/iphone|ipad|ipod/.test(ua)) platform = "ios";
  else if (/android/.test(ua)) platform = "android";
  else if (/win/.test(ua)) platform = "windows";
  else if (/mac/.test(ua)) platform = "macos";
  else if (/linux/.test(ua)) platform = "linux";

  let browser: InstallBrowser = "other";
  if (/edg\//.test(ua)) browser = "edge";
  else if (/firefox\//.test(ua)) browser = "firefox";
  else if (/chrome\//.test(ua) || /crios\//.test(ua)) browser = "chrome";
  else if (/safari\//.test(ua)) browser = "safari";

  return { platform, browser };
}

export function installGuideFor(environment: InstallEnvironment): InstallGuide {
  const { platform, browser } = environment;

  if (platform === "ios") {
    return {
      title: "Add Grove Write on iPhone or iPad",
      steps: [
        "Open this page in Safari if you are in another browser.",
        "Tap the Share button at the bottom of the screen.",
        "Scroll down and choose Add to Home Screen.",
        "Tap Add. Open Grove Write from the new icon when you want to write offline.",
      ],
    };
  }

  if (platform === "android") {
    if (browser === "firefox") {
      return {
        title: "Add Grove Write on Android",
        steps: [
          "Firefox on Android does not install Grove Write as an app.",
          "Open grovewriter.com/write in Chrome instead.",
          "In Chrome, tap the menu (three dots), then Install app or Add to Home screen.",
        ],
      };
    }
    return {
      title: "Add Grove Write on Android",
      steps: [
        "Tap the menu (three dots) in the top-right corner.",
        "Choose Install app or Add to Home screen.",
        "Confirm the install. Grove Write will appear with your other apps.",
      ],
    };
  }

  if (platform === "windows") {
    if (browser === "edge") {
      return {
        title: "Install Grove Write on Windows (Edge)",
        steps: [
          "Look for App available (⊕) in the address bar on the right.",
          "If you do not see it, open the menu (⋯) → Apps → Install this site as an app.",
          "Click Install. Grove Write opens in its own window.",
          "Pin it from the Start menu or taskbar for quick access.",
        ],
      };
    }
    if (browser === "firefox") {
      return {
        title: "Install Grove Write on Windows (Firefox)",
        steps: [
          "Firefox does not install Grove Write as a standalone app.",
          "For the best offline experience, open grovewriter.com/write in Chrome or Edge.",
          "In Chrome or Edge, use the install option in the address bar or browser menu.",
        ],
      };
    }
    if (browser === "chrome") {
      return {
        title: "Install Grove Write on Windows (Chrome)",
        steps: [
          "Look for the Install app icon (monitor with a down arrow) on the right side of the address bar.",
          "If you do not see it, open the menu (⋮) → Save and share → Install page as app.",
          "Click Install. Grove Write opens in its own window.",
          "Pin it from the Start menu or taskbar for quick access.",
        ],
      };
    }
    return {
      title: "Install Grove Write on Windows",
      steps: [
        "Open grovewriter.com/write in Chrome or Microsoft Edge.",
        "Use the install option in the address bar or browser menu.",
        "Pin Grove Write from the Start menu or taskbar after it installs.",
      ],
    };
  }

  if (platform === "macos") {
    if (browser === "safari") {
      return {
        title: "Add Grove Write on Mac (Safari)",
        steps: [
          "Open the File menu and choose Add to Dock.",
          "If you do not see that option, click Share in the toolbar, then Add to Dock.",
          "Open Grove Write from the Dock when you want to write offline.",
        ],
      };
    }
    if (browser === "edge") {
      return {
        title: "Install Grove Write on Mac (Edge)",
        steps: [
          "Look for App available in the address bar.",
          "Or open the menu (⋯) → Apps → Install this site as an app.",
          "Click Install, then keep Grove Write in the Dock or Applications.",
        ],
      };
    }
    if (browser === "chrome") {
      return {
        title: "Install Grove Write on Mac (Chrome)",
        steps: [
          "Look for the Install icon in the address bar on the right.",
          "Or open the Chrome menu → Cast, save, and share → Install page as app.",
          "Click Install, then keep Grove Write in the Dock or Applications folder.",
        ],
      };
    }
    return {
      title: "Install Grove Write on Mac",
      steps: [
        "Open grovewriter.com/write in Chrome, Edge, or Safari.",
        "Use Add to Dock in Safari or Install app in Chrome or Edge.",
      ],
    };
  }

  if (platform === "linux") {
    if (browser === "firefox") {
      return {
        title: "Install Grove Write on Linux (Firefox)",
        steps: [
          "Open the menu → More tools → Install this site as an app, if available.",
          "For a fuller install experience, try grovewriter.com/write in Chrome or Edge.",
        ],
      };
    }
    return {
      title: "Install Grove Write on Linux",
      steps: [
        "Look for the install icon in the address bar.",
        "Or open the browser menu and choose Install Grove Write or Install page as app.",
        "Launch it from your applications menu after install.",
      ],
    };
  }

  return {
    title: "Install Grove Write",
    steps: [
      "Open grovewriter.com/write in Chrome, Edge, or Safari on your device.",
      "Use your browser's install or Add to Home Screen option.",
      "On phones, that usually means Share → Add to Home Screen.",
    ],
  };
}
