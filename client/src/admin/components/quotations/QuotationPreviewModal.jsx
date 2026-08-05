import { useEffect, useMemo, useState } from "react";
import { FaCopy, FaFilePdf, FaWhatsapp } from "react-icons/fa6";
import { Modal, Button } from "../Ui";
import { buildQuotationMessagePreview, formatMobileNumber } from "../../utils/quotation";

const copy = (text) => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  } else {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
};

/**
 * Modal that shows the WhatsApp message + PDF attachment that will be sent.
 * Props: open, onClose, quotation, sending, onSend, title
 */
export default function QuotationPreviewModal({ open, onClose, quotation, sending = false, onSend, title = "Preview WhatsApp message" }) {
  const [copied, setCopied] = useState(false);

  const message = useMemo(() => (quotation ? buildQuotationMessagePreview(quotation) : ""), [quotation]);

  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  if (!open || !quotation) return null;

  const handleCopy = () => {
    copy(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSend} loading={sending} className="bg-[#25D366] hover:bg-[#1fb959]">
            <FaWhatsapp /> Send Quotation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-base/80 px-4 py-3 text-sm">
          <div>
            <span className="text-ink/50">Sending to </span>
            <span className="font-semibold text-ink">{quotation.clientName}</span>
            <span className="ml-2 text-ink/60">{formatMobileNumber(quotation.mobile)}</span>
          </div>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <FaCopy /> {copied ? "Copied!" : "Copy message"}
          </button>
        </div>

        <div className="rounded-2xl bg-[#E7F8EC] p-4 sm:p-5">
          <div className="mx-auto max-w-md rounded-2xl rounded-tr-sm bg-white p-4 shadow-card">
            <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink/85">{message}</div>
            <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-ink/35">
              <span>WhatsApp</span>
              <FaWhatsapp className="h-3 w-3 text-[#25D366]" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-base bg-base/40 px-4 py-3 text-sm text-ink/70">
          <FaFilePdf className="h-5 w-5 shrink-0 text-red-500" />
          <span>
            The quotation PDF is sent first as a WhatsApp document attachment{" "}
            <span className="font-semibold">{"📄 Quotation - "}{quotation.quotationNumber || ""}.pdf</span>
            followed by the message above.
            {quotation.pdfUrl && (
              <a href={`${quotation.pdfUrl}?v=${encodeURIComponent(quotation.updatedAt || Date.now())}`} target="_blank" rel="noreferrer" className="ml-1 break-all font-medium text-primary hover:underline">(preview)</a>
            )}
          </span>
        </div>

        <p className="text-center text-xs text-ink/45">
          With Cloud API credentials, the message and the PDF are delivered to the client's WhatsApp
          (the PDF is uploaded to WhatsApp via the Media Upload API - no public URL needed).
          Without credentials, WhatsApp Web opens in a new tab with the quotation message.
        </p>
      </div>
    </Modal>
  );
}
