import CrudPage from "../components/CrudPage";

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const testimonialsConfig = {
  title: "Testimonials",
  singular: "Testimonial",
  apiPath: "testimonials",
  statusKey: "status",
  statusOptions,
  imageField: "image",
  imagePreviewKey: "image",
  columns: [
    { key: "image", label: "", image: true },
    { key: "clientName", label: "Client" },
    { key: "company", label: "Company" },
    { key: "rating", label: "Rating", render: (r) => "★".repeat(r.rating || 0) },
  ],
  fields: [
    { name: "clientName", label: "Client name", required: true },
    { name: "company", label: "Company" },
    { name: "designation", label: "Designation" },
    { name: "rating", label: "Rating (1-5)", type: "number" },
    { name: "review", label: "Review", type: "textarea", rows: 5, required: true, fullWidth: true },
    {
      name: "status", label: "Status", type: "select", options: statusOptions,
    },
    { name: "featured", label: "Featured", type: "switch" },
    { name: "displayOrder", label: "Display order", type: "number" },
  ],
};

export default function Testimonials() {
  return <CrudPage config={testimonialsConfig} />;
}