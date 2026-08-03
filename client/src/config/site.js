export const SITE = {
  name: "Skyntrix Technologies",
  shortName: "Skyntrix",
  tagline: "Building Digital Experiences That Drive Growth",
  url: "https://skyntrix.com",
  email: "hello@skyntrix.com",
  careersEmail: "careers@skyntrix.com",
  phone: "+91 98765 43210",
  whatsapp: "919876543210",
  address: "Madurai",
  hours: "Mon - Sat: 9:00 AM - 7:00 PM IST",
  social: {
    linkedin: "https://linkedin.com/company/skyntrix",
    twitter: "https://twitter.com/skyntrix",
    instagram: "https://instagram.com/skyntrix",
    facebook: "https://facebook.com/skyntrix",
    github: "https://github.com/skyntrix",
    dribbble: "https://dribbble.com/skyntrix"
  }
};

export const whatsAppLink = (msg = "Hi Skyntrix Technologies! I'd like to discuss a project.") =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(msg)}`;

export const API_URL = import.meta.env.VITE_API_URL || "/api";