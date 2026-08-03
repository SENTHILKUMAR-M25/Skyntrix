import CrudPage from "../components/CrudPage";

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const servicesConfig = {
  title: "Services",
  singular: "Service",
  apiPath: "services",
  statusKey: "status",
  statusOptions,
  imageField: "image",
  imagePreviewKey: "heroImage",
  columns: [
    { key: "title", label: "Title" },
    { key: "icon", label: "Icon" },
    { key: "featured", label: "Featured", render: (r) => (r.featured ? "★" : "—") },
    { key: "displayOrder", label: "Order" },
  ],
  fields: [
    { name: "title", label: "Title", required: true },
    { name: "short", label: "Short description", fullWidth: true },
    { name: "overview", label: "Overview", type: "textarea", rows: 5, fullWidth: true },
    { name: "icon", label: "Icon", hint: "e.g. globe, phone, palette, share, search, brush" },
    { name: "displayOrder", label: "Display order", type: "number" },
    {
      name: "status", label: "Status", type: "select", options: statusOptions,
    },
    { name: "featured", label: "Featured on home", type: "switch" },
    { name: "features", label: "Features (comma separated)", type: "tags", fullWidth: true },
    { name: "technologies", label: "Technologies (comma separated)", type: "tags", fullWidth: true },
  ],
};

export default function Services() {
  return <CrudPage config={servicesConfig} />;
}