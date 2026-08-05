import { useEffect, useMemo, useState } from "react";
import { FaCopy, FaWhatsapp, FaEnvelope, FaReceipt } from "react-icons/fa6";
import { Modal, Button } from "../Ui";
import { buildReceiptMessagePreview, formatMobileNumber, formatDate } from "../../utils/receipt";

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
 * Modal that previews what will be sent for a receipt: the WhatsApp message,
 * the email body (when channel is email/both) and the PDF attachment.
 * Props: open, onClose, receipt, channel, sending, onSend, title
 */
export default function ReceiptPreviewModal({
  open, onClose, receipt, channel = "whatsapp", sending = false, onSend, title = "Resend receipt",
}) {
  const [copied, setCopied] = useState(false);

  const message = useMemo(() => (receipt ? buildReceiptMessagePreview(receipt, { includePdfLink: channel === "whatsapp" }) : ""), [receipt, channel]);
  const subject = useMemo(() => (receipt?.receiptNumber ? `Payment Receipt ${receipt.receiptNumber} from Skyntrix Technologies` : "Payment Receipt from Skyntrix Technologies"), [receipt]);

  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  if (!open || !receipt) return null;

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
          <Button onClick={onSend} loading={sending} className={channel === "email" ? "" : "bg-[#25D366] hover:bg-[#1fb959]"}>
            {channel === "email" ? <FaEnvelope /> : <FaWhatsapp />} Send Receipt
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-base/80 px-4 py-3 text-sm">
          <div>
            <span className="text-ink/50">Sending to </span>
            <span className="font-semibold text-ink">{receipt.clientName}</span>
            {channel !== "email" && <span className="ml-2 text-ink/60">{formatMobileNumber(receipt.mobile)}</span>}
            {channel !== "whatsapp" && receipt.email && <span className="ml-2 text-ink/60">&lt;{receipt.email}&gt;</span>}
          </div>
          {channel !== "email" && (
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:border-primary/40 hover:text-primary"
            >
              <FaCopy /> {copied ? "Copied!" : "Copy message"}
            </button>
          )}
        </div>

        {channel === "whatsapp" && (
          <div className="rounded-2xl bg-[#E7F8EC] p-4 sm:p-5">
            <div className="mx-auto max-w-md rounded-2xl rounded-tr-sm bg-white p-4 shadow-card">
              <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink/85">{message}</div>
              <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-ink/35">
                <span>WhatsApp</span>
                <FaWhatsapp className="h-3 w-3 text-[#25D366]" />
              </div>
            </div>
          </div>
        )}

        {channel === "email" && (
          <div className="rounded-2xl bg-blue-50 p-4 sm:p-5">
            <div className="mx-auto max-w-md rounded-2xl rounded-tl-sm bg-white p-4 shadow-card">
              <div className="border-b border-base pb-2 text-xs font-semibold text-ink/50">Subject: {subject}</div>
              <div className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink/85">{message}</div>
              <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-ink/35">
                <span>Email</span>
                <FaEnvelope className="h-3 w-3 text-blue-500" />
              </div>
            </div>
          </div>
        )}

        {channel === "both" && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">WhatsApp message</p>
            <div className="rounded-2xl bg-[#E7F8EC] p-4 sm:p-5">
              <div className="mx-auto max-w-md rounded-2xl rounded-tr-sm bg-white p-4 shadow-card">
                <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink/85">{message}</div>
              </div>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Email body</p>
            <div className="rounded-2xl bg-blue-50 p-4 sm:p-5">
              <div className="mx-auto max-w-md rounded-2xl rounded-tl-sm bg-white p-4 shadow-card">
                <div className="border-b border-base pb-2 text-xs font-semibold text-ink/50">Subject: {subject}</div>
                <div className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink/85">{message}</div>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-base bg-base/40 px-4 py-3 text-sm text-ink/70">
          <FaReceipt className="h-5 w-5 shrink-0 text-red-500" />
          <span>
            The receipt PDF is attached first as a document{" "}
            <span className="font-semibold">{"📄 "}{receipt.receiptNumber || "Receipt"}.pdf</span>
            {receipt.paidOn && <> · paid {formatDate(receipt.paidOn)}</>}
            {receipt.pdfUrl && (
              <a href={`${receipt.pdfUrl}?v=${encodeURIComponent(Date.now())}`} target="_blank" rel="noreferrer" className="ml-1 break-all font-medium text-primary hover:underline">(preview)</a>
            )}
          </span>
        </div>

        <p className="text-center text-xs text-ink/45">
          Without Cloud API credentials, WhatsApp Web opens in a new tab with the receipt message and you send the PDF
          manually. Email uses the SMTP configuration from the settings.
        </p>
      </div>
    </Modal>
  );
}
