// Native Designer patch for the ORIGINAL site's Coming Soon page, not a served page.
// Import the manifest to build MCP actions; importing never changes Webflow.
export const siteId = "693b4fc98a599c12cbf30e36";
export const pageId = "693b4fcb8a599c12cbf30eca";
const padding = (vertical, horizontal) => ({
  "padding-top": vertical, "padding-bottom": vertical,
  "padding-left": horizontal, "padding-right": horizontal,
});
const margin = { "margin-top": "0px", "margin-bottom": "0px", "margin-left": "0px", "margin-right": "0px" };
const rounded = (value) => Object.fromEntries(["top-left", "top-right", "bottom-left", "bottom-right"].map(c => [`border-${c}-radius`, value]));
const grid = {
  display: "grid", "grid-template-columns": "minmax(0, 1fr) minmax(0, 1fr)",
  "grid-template-rows": "auto", "grid-auto-columns": "minmax(0, 1fr)",
  "grid-column-gap": "4rem", "grid-row-gap": "2rem", "align-items": "center",
  width: "100%", "max-width": "76rem", "margin-left": "auto", "margin-right": "auto",
  ...padding("4rem", "3rem"),
};
const heading = {
  ...margin, "font-size": "clamp(1.75rem, 3vw, 2.5rem)", "font-weight": "700",
  "line-height": "1.15", "letter-spacing": "-0.025em", "overflow-wrap": "anywhere",
  "max-width": "100%", color: "#2d051a",
};
export const styles = {
  // Let the existing Main Wrapper gradient paint the entire page, including the footer.
  "CS Page": { main: { "background-color": "transparent", "background-image": "none", color: "#2d051a" } },
  "CS Header": { main: { display: "flex", "justify-content": "center", "align-items": "center", "background-color": "transparent", ...padding("1.5rem", "1.25rem") } },
  "CS Logo": { main: { display: "block", width: "7rem", "max-width": "100%", height: "auto", ...margin } },
  "CS Hero": {
    main: { ...grid, ...padding("3rem", "3rem"), "background-image": "none", ...rounded("1.5rem") },
    medium: { "grid-template-columns": "minmax(0, 1fr)", ...padding("2.5rem", "2rem") },
    small: { ...padding("2rem", "1.5rem") },
    tiny: { ...padding("1.5rem", "1.25rem"), "grid-row-gap": "1.5rem" },
  },
  "CS Story": {
    main: { ...grid, "grid-template-columns": "minmax(0, 0.85fr) minmax(0, 1.15fr)", "align-items": "start" },
    medium: { "grid-template-columns": "minmax(0, 1fr)", ...padding("3rem", "2rem") },
    small: { ...padding("2.5rem", "1.5rem") },
    tiny: { ...padding("2.5rem", "1.25rem") },
  },
  "CS Mission": {
    main: { ...grid, "grid-template-columns": "minmax(0, 1.15fr) minmax(0, 0.85fr)", "align-items": "start" },
    medium: { "grid-template-columns": "minmax(0, 1fr)", ...padding("3rem", "2rem") },
    small: { ...padding("2.5rem", "1.5rem") },
    tiny: { ...padding("2.5rem", "1.25rem") },
  },
  "CS Content": { main: { ...margin, width: "100%", "min-width": "0px", "max-width": "100%", "font-size": "1.125rem", "line-height": "1.65", "text-align": "left" } },
  "CS Heading Gap": { main: { "margin-bottom": "1.5rem" } },
  "CS Hero Heading": { main: { ...heading, "font-size": "clamp(2rem, 4.5vw, 3.5rem)", "font-weight": "500", "line-height": "1.12" } },
  "CS Section Heading": { main: heading },
  "CS Body Copy": { main: { ...margin, "font-size": "1.125rem", "line-height": "1.7", "letter-spacing": "normal", "overflow-wrap": "anywhere", "max-width": "100%" }, tiny: { "font-size": "1rem" } },
  "CS Image Frame": { main: { ...margin, width: "100%", "min-width": "0px", "max-width": "100%" } },
  "CS Hero Photo": { main: { ...margin, display: "block", width: "100%", "max-width": "100%", height: "auto", "aspect-ratio": "4 / 5", "object-fit": "cover", "object-position": "50% 40%", ...rounded("1.25rem") }, medium: { "max-width": "36rem", "margin-left": "auto", "margin-right": "auto", "aspect-ratio": "4 / 3" } },
  "CS Story Photo": { main: { ...margin, display: "block", width: "100%", "max-width": "100%", height: "auto", ...rounded("1.25rem") }, medium: { "max-width": "32rem", "margin-left": "auto", "margin-right": "auto" } },
  "CS Mission Photo": { main: { ...margin, display: "block", width: "100%", "max-width": "100%", height: "auto", ...rounded("1.25rem") }, medium: { "max-width": "32rem", "margin-left": "auto", "margin-right": "auto" } },
  "CS Signup Section": { main: { "max-width": "52rem", "margin-left": "auto", "margin-right": "auto", ...padding("4rem", "3rem") }, medium: { ...padding("3rem", "2rem") }, small: { ...padding("2.5rem", "1.5rem") }, tiny: { ...padding("2.5rem", "1.25rem") } },
  "CS Signup Inner": { main: { ...margin, ...padding("0px", "0px"), width: "100%", "max-width": "100%" } },
  "CS Signup Intro": { main: { "margin-bottom": "2rem", "text-align": "center" } },
  "CS Closing Copy": { main: { ...margin, "margin-top": "1.5rem", "font-size": "1.125rem", "font-weight": "400", "line-height": "1.65", "letter-spacing": "normal", "overflow-wrap": "anywhere" }, tiny: { "font-size": "1rem" } },
  "CS Signup Form": { main: { display: "flex", "flex-direction": "column", "grid-row-gap": "1rem", width: "100%", "max-width": "100%", "font-size": "1rem" } },
  "CS Form Field": { main: { width: "100%", "min-width": "0px" } },
  "CS Form Input": { main: { display: "block", width: "100%", "max-width": "100%", "min-height": "3rem", "font-size": "1rem", "line-height": "1.5", ...padding("0.75rem", "1rem"), "background-color": "white", color: "#2d051a", ...rounded("0.75rem"), ...Object.fromEntries(["top", "right", "bottom", "left"].flatMap(s => [[`border-${s}-style`, "solid"], [`border-${s}-width`, "1px"], [`border-${s}-color`, "#796a73"]])), "margin-bottom": "0px" }, focus: { "outline-style": "solid", "outline-width": "3px", "outline-color": "#6769f8", "outline-offset": "3px" } },
  "CS Submit": { main: { "min-height": "3rem", width: "100%", ...padding("0.875rem", "1.5rem"), "background-color": "#2d051a", color: "white", "font-size": "1rem", "font-weight": "600", "line-height": "1.4", "white-space": "normal", cursor: "pointer", ...rounded("3rem") }, "focus-visible": { "outline-style": "solid", "outline-width": "3px", "outline-color": "#6769f8", "outline-offset": "3px" } },
  "CS Copyright": { main: { ...padding("1.5rem", "1.25rem"), "text-align": "center", "font-size": "0.875rem", "line-height": "1.5" } },
};
// Full style replacement is deliberate: existing classes are shared with other pages.
export const assignments = {
  "2a4c8d09-8224-7b6f-096f-bad0a1157f78": "CS Page",
  "3d888e83-df27-9437-fc5f-e6fd02a95aa9": "CS Header",
  "388e4cfe-e275-00af-927d-1279902e031c": "CS Logo",
  "c3f0922a-2a0e-5ed7-0af3-36cd47e24bd4": "CS Hero",
  "a654cbdc-3125-4dc3-ca14-30c420afe374": "CS Story",
  "3c6178ea-32cd-9e17-a466-ea7226ac5166": "CS Mission",
  "c3f0922a-2a0e-5ed7-0af3-36cd47e24bd5": "CS Content",
  "a654cbdc-3125-4dc3-ca14-30c420afe377": "CS Content",
  "3c6178ea-32cd-9e17-a466-ea7226ac5167": "CS Content",
  "3c6178ea-32cd-9e17-a466-ea7226ac5168": "CS Content",
  "c3f0922a-2a0e-5ed7-0af3-36cd47e24bd6": "CS Signup Inner",
  "a654cbdc-3125-4dc3-ca14-30c420afe378": "CS Heading Gap",
  "3c6178ea-32cd-9e17-a466-ea7226ac5169": "CS Heading Gap",
  "c3f0922a-2a0e-5ed7-0af3-36cd47e24bd7": "CS Hero Heading",
  "a654cbdc-3125-4dc3-ca14-30c420afe379": "CS Section Heading",
  "3c6178ea-32cd-9e17-a466-ea7226ac516a": "CS Section Heading",
  "a654cbdc-3125-4dc3-ca14-30c420afe37b": "CS Body Copy",
  "3c6178ea-32cd-9e17-a466-ea7226ac516c": "CS Body Copy",
  "c3f0922a-2a0e-5ed7-0af3-36cd47e24be6": "CS Image Frame",
  "a654cbdc-3125-4dc3-ca14-30c420afe375": "CS Image Frame",
  "3c6178ea-32cd-9e17-a466-ea7226ac5176": "CS Image Frame",
  "c3f0922a-2a0e-5ed7-0af3-36cd47e24be7": "CS Hero Photo",
  "a654cbdc-3125-4dc3-ca14-30c420afe376": "CS Story Photo",
  "3c6178ea-32cd-9e17-a466-ea7226ac5177": "CS Mission Photo",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f79": "CS Signup Section",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f7a": "CS Signup Inner",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f7b": "CS Signup Inner",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f7c": "CS Signup Intro",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f87": "CS Signup Inner",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f83": "CS Section Heading",
  "30ec5e92-ceb7-2626-e177-869767e90432": "CS Closing Copy",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f89": "CS Signup Form",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f8a": "CS Form Field",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f8e": "CS Form Field",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f8d": "CS Form Input",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f91": "CS Form Input",
  "2a4c8d09-8224-7b6f-096f-bad0a1157f96": "CS Submit",
  "a3073b8a-c20b-2270-15e6-dba4f6cc1da4": "CS Copyright",
};
export const headingLevels = {
  "c3f0922a-2a0e-5ed7-0af3-36cd47e24bd7": 1,
  "a654cbdc-3125-4dc3-ca14-30c420afe379": 2,
  "3c6178ea-32cd-9e17-a466-ea7226ac516a": 2,
  "2a4c8d09-8224-7b6f-096f-bad0a1157f83": 2,
  "30ec5e92-ceb7-2626-e177-869767e90432": 3,
};
export const properties = (values) => Object.entries(values).map(([property_name, property_value]) => ({ property_name, property_value }));
export const createActions = () => Object.entries(styles).map(([name, variants]) => ({ label: name, create_style: { name, properties: properties(variants.main) } }));
export const responsiveActions = () => Object.entries(styles).flatMap(([style_name, variants]) => Object.entries(variants).filter(([key]) => key !== "main").map(([key, values]) => ({ label: `${style_name} ${key}`, update_style: { style_name, ...(["focus", "focus-visible"].includes(key) ? { pseudo: key } : { breakpoint_id: key }), properties: properties(values) } })));
export const elementActions = () => [
  ...Object.entries(assignments).map(([element, name]) => ({ label: name, set_style: { id: { component: pageId, element }, style_names: [name] } })),
  ...Object.entries(headingLevels).map(([element, heading_level]) => ({ label: `Heading level ${heading_level}`, set_heading_level: { id: { component: pageId, element }, heading_level } })),
  { label: "Separate title words at colon", set_text: { id: { component: pageId, element: "a654cbdc-3125-4dc3-ca14-30c420afe379" }, text: "Better Living, Better Dying: The Collective for Life, Death, and Everything in Between" } },
];
