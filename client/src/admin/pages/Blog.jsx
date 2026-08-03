import CrudPage from "../components/CrudPage";

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "archived", label: "Archived" },
];

const blogConfig = {
  title: "Blog Posts",
  singular: "Blog post",
  apiPath: "blogs",
  statusKey: "status",
  statusOptions,
  imageField: "image",
  imagePreviewKey: "thumbnail",
  columns: [
    { key: "thumbnail", label: "", image: true },
    { key: "title", label: "Title" },
    { key: "category", label: "Category" },
    { key: "views", label: "Views" },
  ],
  fields: [
    { name: "title", label: "Title", required: true, fullWidth: true },
    { name: "category", label: "Category" },
    { name: "author", label: "Author" },
    {
      name: "status", label: "Status", type: "select", options: statusOptions,
    },
    { name: "excerpt", label: "Excerpt", type: "textarea", rows: 3, fullWidth: true },
    { name: "content", label: "Content (HTML)", type: "textarea", rows: 10, fullWidth: true },
    { name: "tags", label: "Tags (comma separated)", type: "tags", fullWidth: true },
  ],
};

export default function Blog() {
  return <CrudPage config={blogConfig} />;
}