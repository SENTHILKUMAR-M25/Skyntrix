import mongoose from "mongoose";

const whatsappConversationSchema = new mongoose.Schema(
  {
    // E.164 number (91XXXXXXXXXX) - unique per customer.
    phoneNumber: { type: String, required: true, unique: true, trim: true },
    // Timestamp of the customer's last inbound message. The 24-hour customer
    // service window is considered open while lastInboundAt is within 24h.
    lastInboundAt: { type: Date, default: null },
    lastOutboundAt: { type: Date, default: null },
    // Message id of the template that initiated this conversation (if any).
    lastTemplateMessageId: { type: String, default: "" },
    inboundCount: { type: Number, default: 0 },
    outboundCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

whatsappConversationSchema.index({ lastInboundAt: -1 });

const WhatsAppConversation = mongoose.model("WhatsAppConversation", whatsappConversationSchema);
export default WhatsAppConversation;
