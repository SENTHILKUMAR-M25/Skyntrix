import { Helmet } from "react-helmet-async";
import { SITE } from "../config/site";

export default function Seo({
  title,
  description,
  path = "/",
  image = "/og-default.png",
  type = "website",
  article,
  noindex = false,
  jsonLd,
}) {
  const canonical = `${SITE.url}${path}`;
  const fullDesc = description || SITE.tagline;

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      name: SITE.name,
      description: fullDesc,
      url: canonical,
      email: SITE.email,
      telephone: SITE.phone,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Hyderabad",
        addressRegion: "Telangana",
        addressCountry: "IN"
      },
      sameAs: Object.values(SITE.social)
    },
    ...(jsonLd ? [jsonLd] : [])
  ];

  return (
    <Helmet>
      <title>{title ? `${title} | ${SITE.name}` : `${SITE.name} | ${SITE.tagline}`}</title>
      <meta name="description" content={fullDesc} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:title" content={title || SITE.name} />
      <meta property="og:description" content={fullDesc} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={`${SITE.url}${image}`} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title || SITE.name} />
      <meta name="twitter:description" content={fullDesc} />
      <meta name="twitter:image" content={`${SITE.url}${image}`} />

      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
    </Helmet>
  );
}