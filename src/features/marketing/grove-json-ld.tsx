import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export function GroveJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "BrowserApplication",
        operatingSystem: "Web",
        description: SITE_DESCRIPTION,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "Grove Free includes one story. Sign up with no credit card.",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
