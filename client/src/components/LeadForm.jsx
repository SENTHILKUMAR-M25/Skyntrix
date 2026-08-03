import { useState } from "react";
import { useForm } from "react-hook-form";
import { FaCircleCheck, FaPaperPlane } from "react-icons/fa6";
import { API_URL } from "../config/site";

const inputCls =
  "w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-primary placeholder:text-ink/40";

const budgetOptions = [
  "Under ₹10,000",
  "₹10,000 – ₹25,000",
  "₹25,000 – ₹50,000",
  "₹50,000 – ₹1,00,000",
  "₹1,00,000+",
];

export default function LeadForm({ compact = false, dark = false, defaultService = "" }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();
  const [done, setDone] = useState(false);

  const onSubmit = async (data) => {
    try {
      await fetch(`${API_URL}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, source: window.location.pathname, service: defaultService || data.service, type: defaultService || data.service })
      });
      setDone(true);
      reset();
    } catch { /* handled gracefully */ }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <FaCircleCheck className="mx-auto mb-2 h-10 w-10 text-green-500" />
        <h3 className="font-display text-xl font-bold">Thank you!</h3>
        <p className="mt-1 text-sm text-ink/60">We'll get back to you within one business day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>
      <div className={compact ? "" : "sm:col-span-1"}>
        <input {...register("name", { required: "Name is required" })} placeholder="Full Name*" className={inputCls} />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
      </div>
      <div>
        <input {...register("email", { required: "Email is required", pattern: /^\S+@\S+\.\S+$/ })} placeholder="Work Email*" className={inputCls} />
        {errors.email && <p className="mt-1 text-xs text-red-500">Enter a valid email</p>}
      </div>
      <div>
        <input {...register("phone")} placeholder="Phone / WhatsApp" className={inputCls} />
      </div>
      <div>
        <input {...register("company")} placeholder="Company" className={inputCls} />
      </div>
      <div>
        <select {...register("service", { required: defaultService ? false : "Select a service" })} defaultValue={defaultService} className={inputCls}>
          <option value="">What do you need?</option>
          <option>Website Development</option>
          <option>Mobile App Development</option>
          <option>UI/UX Design</option>
          <option>Social Media Marketing</option>
          <option>Poster Designing</option>
          <option>Branding</option>
          <option>SEO</option>
          <option>Website Maintenance</option>
          <option>Other</option>
        </select>
        {errors.service && <p className="mt-1 text-xs text-red-500">Select a service</p>}
      </div>
      <div>
        <select {...register("budget")} defaultValue="" className={inputCls}>
          <option value="">Estimated budget</option>
          {budgetOptions.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>
      <div className={compact ? "" : "sm:col-span-2"}>
        <textarea {...register("message")} rows={compact ? 3 : 4} placeholder="Tell us about your project" className={inputCls} />
      </div>
      <div className={compact ? "" : "sm:col-span-2"}>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          <FaPaperPlane className="h-4 w-4" /> {isSubmitting ? "Submitting..." : "Send Project Inquiry"}
        </button>
        <p className="mt-3 text-center text-xs text-ink/50">No spam. We reply within 24 hours.</p>
      </div>
    </form>
  );
}
