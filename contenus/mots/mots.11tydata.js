// Réglage technique (ne pas modifier) : l'adresse de chaque page,
// tirée du nom du fichier, sans accents ni espaces.
const adresse = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "sans-titre";

export default {
  layout: "layouts/mot.njk",
  section: "mots",
  permalink: (data) => `/mots/${adresse(data.page.fileSlug)}/`,
};
