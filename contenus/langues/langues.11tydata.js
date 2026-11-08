// Réglage technique (ne pas modifier) : l'adresse de chaque langue,
// tirée de son nom, sans accents ni espaces.
const adresse = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "sans-nom";

export default {
  layout: "layouts/langue.njk",
  section: "langues",
  permalink: (data) => `/langues/${adresse(data.nom || data.page.fileSlug)}/`,
};
