// Native draft patch: original desktop/tablet class chains and CSS remain intact.
import original from "./coming-soon-original-assignments.json" with { type: "json" };
export const siteId = "693b4fc98a599c12cbf30e36";
export const pageId = "693b4fcb8a599c12cbf30eca";
const margin = Object.fromEntries(["top", "bottom", "left", "right"].map(s => [`margin-${s}`, "0px"]));
const padding = (y, x) => ({ "padding-top": y, "padding-bottom": y, "padding-left": x, "padding-right": x });
const fluid = { width: "100%", "min-width": "0px", "max-width": "100%" };
const rounded = Object.fromEntries(["top-left", "top-right", "bottom-left", "bottom-right"].map(s => [`border-${s}-radius`, "1.25rem"]));
const grid = { display: "grid", "grid-template-columns": "minmax(0, 1fr)", "grid-template-rows": "auto", "grid-auto-columns": "minmax(0, 1fr)", "grid-row-gap": "2rem", "align-items": "start", ...fluid, ...padding("2.5rem", "1.5rem") };
const heading = { ...margin, ...fluid, "font-size": "2rem", "line-height": "1.2", "letter-spacing": "normal", "overflow-wrap": "anywhere" };
const copy = { ...margin, ...fluid, "font-size": "1.125rem", "line-height": "1.7", "letter-spacing": "normal", "overflow-wrap": "anywhere" };
const photo = { ...margin, ...fluid, display: "block", height: "auto", ...rounded };
export const styles = {
  "CS Mobile Page": { parents: ["Section"], small: { "background-color": "transparent", "background-image": "none" } },
  "CS Mobile Hero": { parents: ["Grid 3 Copy"], small: { ...grid, ...padding("2rem", "1.5rem") }, tiny: { ...padding("1.5rem", "1.25rem"), "grid-row-gap": "1.5rem" } },
  "CS Mobile Story": { parents: ["Grid 4"], small: { ...grid, "background-color": "transparent" }, tiny: padding("2.5rem", "1.25rem") },
  "CS Mobile Mission": { parents: ["Grid 5"], small: { ...grid, "background-color": "transparent" }, tiny: padding("2.5rem", "1.25rem") },
  "CS Mobile Content": { parents: ["Content"], small: { ...margin, ...fluid, "font-size": "1.125rem", "line-height": "1.65" } },
  "CS Mobile Hero Heading": { parents: ["Heading"], small: { ...heading, "font-size": "2.25rem" }, tiny: { "font-size": "2rem" } },
  "CS Mobile Section Heading": { parents: [], small: heading, tiny: { "font-size": "1.75rem" } },
  "CS Mobile Story Copy": { parents: ["Text Size Medium"], small: copy, tiny: { "font-size": "1rem" } },
  "CS Mobile Mission Copy": { parents: ["Paragraph"], small: copy, tiny: { "font-size": "1rem" } },
  "CS Mobile Image Frame": { parents: ["Hero Image Wrapper"], small: { ...margin, ...fluid } },
  "CS Mobile Hero Photo": { parents: ["Image 2", "Hero Image"], small: { ...photo, "aspect-ratio": "4 / 3", "object-fit": "cover", "object-position": "50% 40%" } },
  "CS Mobile Story Photo": { parents: ["Image 3"], small: photo },
  "CS Mobile Mission Photo": { parents: ["Image 2"], small: photo },
  "CS Mobile Signup Spacing": { parents: ["Padding Section Large"], small: padding("2.5rem", "0px") },
  "CS Mobile Closing Copy": { parents: ["Heading 5"], small: { ...copy, "font-weight": "400" }, tiny: { "font-size": "1rem" } },
  "CS Mobile Form Input": { parents: ["Form Input"], small: { ...fluid, "min-height": "3rem", "font-size": "1rem" } },
  "CS Mobile Submit": { parents: ["Button", "Is small"], small: { ...fluid, "min-height": "3rem", "white-space": "normal" } },
};
export const assignments = {
  "2a4c8d09-8224-7b6f-096f-bad0a1157f78": "CS Mobile Page",
  "c3f0922a-2a0e-5ed7-0af3-36cd47e24bd4": "CS Mobile Hero",
  "a654cbdc-3125-4dc3-ca14-30c420afe374": "CS Mobile Story",
  "3c6178ea-32cd-9e17-a466-ea7226ac5166": "CS Mobile Mission",
  "c3f0922a-2a0e-5ed7-0af3-36cd47e24bd5": "CS Mobile Content",
  "a654cbdc-3125-4dc3-ca14-30c420afe377": "CS Mobile Content",
  "3c6178ea-32cd-9e17-a466-ea7226ac5167": "CS Mobile Content",
  "3c6178ea-32cd-9e17-a466-ea7226ac5168": "CS Mobile Content",
  "c3f0922a-2a0e-5ed7-0af3-36cd47e24bd7": "CS Mobile Hero Heading",
  "a654cbdc-3125-4dc3-ca14-30c420afe379": "CS Mobile Section Heading",
  "3c6178ea-32cd-9e17-a466-ea7226ac516a": "CS Mobile Section Heading",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f83": "CS Mobile Section Heading",
  "a654cbdc-3125-4dc3-ca14-30c420afe37b": "CS Mobile Story Copy",
  "3c6178ea-32cd-9e17-a466-ea7226ac516c": "CS Mobile Mission Copy",
  "c3f0922a-2a0e-5ed7-0af3-36cd47e24be6": "CS Mobile Image Frame",
  "a654cbdc-3125-4dc3-ca14-30c420afe375": "CS Mobile Image Frame",
  "3c6178ea-32cd-9e17-a466-ea7226ac5176": "CS Mobile Image Frame",
  "c3f0922a-2a0e-5ed7-0af3-36cd47e24be7": "CS Mobile Hero Photo",
  "a654cbdc-3125-4dc3-ca14-30c420afe376": "CS Mobile Story Photo",
  "3c6178ea-32cd-9e17-a466-ea7226ac5177": "CS Mobile Mission Photo",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f7b": "CS Mobile Signup Spacing",
  "30ec5e92-ceb7-2626-e177-869767e90432": "CS Mobile Closing Copy",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f8d": "CS Mobile Form Input",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f91": "CS Mobile Form Input",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f96": "CS Mobile Submit",
};
export const properties = values => Object.entries(values).map(([property_name, property_value]) => ({ property_name, property_value }));
export const createActions = () => Object.entries(styles).map(([name, v]) => ({ label: name, create_style: { name, properties: [], ...(v.parents.length ? { parent_style_names: v.parents } : {}) } }));
export const responsiveActions = () => Object.entries(styles).flatMap(([style_name, v]) => Object.entries(v).filter(([key]) => key !== "parents").map(([breakpoint_id, values]) => {
  if (!["small", "tiny"].includes(breakpoint_id)) throw new Error("Desktop/tablet writes prohibited");
  return { label: `${style_name} ${breakpoint_id}`, update_style: { style_name, parent_style_names: v.parents, breakpoint_id, properties: properties(values) } };
}));
export const elementActions = () => Object.entries(assignments).map(([element, name]) => {
  const saved = original.find(o => o.id === element);
  if (JSON.stringify(saved?.styleNames) !== JSON.stringify(styles[name].parents)) throw new Error("Original class chain mismatch");
  return { label: name, set_style: { id: { component: pageId, element }, style_names: [...saved.styleNames, name] } };
});
export const restoreActions = () => original.flatMap(o => [
  { label: "Restore original classes", set_style: { id: { component: pageId, element: o.id }, style_names: o.styleNames } },
  ...(o.headingLevel ? [{ label: "Restore original heading", set_heading_level: { id: { component: pageId, element: o.id }, heading_level: o.headingLevel } }] : []),
]);
