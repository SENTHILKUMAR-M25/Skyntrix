import CrudPage from "../components/CrudPage";

const teamConfig = {
  title: "Team",
  singular: "Team member",
  apiPath: "team",
  imageField: "image",
  imagePreviewKey: "photo",
  columns: [
    { key: "photo", label: "", image: true },
    { key: "name", label: "Name" },
    { key: "position", label: "Position" },
    { key: "displayOrder", label: "Order" },
  ],
  fields: [
    { name: "name", label: "Name", required: true },
    { name: "position", label: "Position" },
    { name: "bio", label: "Bio", type: "textarea", fullWidth: true },
    { name: "displayOrder", label: "Display order", type: "number" },
    { name: "isActive", label: "Active", type: "switch" },
    { name: "skills", label: "Skills (comma separated)", type: "tags", fullWidth: true },
  ],
};

export default function Team() {
  return <CrudPage config={teamConfig} />;
}