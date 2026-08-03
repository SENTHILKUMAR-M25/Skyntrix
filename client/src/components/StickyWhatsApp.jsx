import { FaWhatsapp, FaPhone } from "react-icons/fa6";
import { SITE, whatsAppLink } from "../config/site";

export default function StickyWhatsApp() {
  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-3">
      <a
        href={whatsAppLink("Hi Skyntrix! I'm interested in your services.")}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="group grid h-14 w-14 place-items-center rounded-full bg-green-500 text-white shadow-lg transition-transform hover:scale-110"
      >
        <FaWhatsapp className="h-7 w-7" />
        <span className="absolute h-3 w-3 rounded-full bg-green-300 ring-2 ring-white" style={{ top: "8px", right: "8px" }} />
      </a>
      <a
        href={`tel:${SITE.phone.replace(/[^0-9]/g, "")}`}
        aria-label="Call us"
        className="grid h-14 w-14 place-items-center rounded-full bg-primary-gradient text-white shadow-soft transition-transform hover:scale-110 md:hidden"
      >
        <FaPhone className="h-6 w-6" />
      </a>
    </div>
  );
}