// linguine — configuration du générateur de site (Eleventy).
// Tu n'as pas besoin de modifier ce fichier : tes contenus se gèrent dans Pages CMS.
import { HtmlBasePlugin } from "@11ty/eleventy";
import markdownIt from "markdown-it";

const md = markdownIt({ html: true, typographer: false });

// Espaces insécables de la typographie française
function typo(html) {
  return String(html)
    .replace(/« /g, "« ")
    .replace(/ »/g, " »")
    .replace(/ ([:;!?])(?=\s|<|$)/g, " $1");
}
// [texte] = repère surligné « à remplir »
function aRemplir(html) {
  return String(html).replace(/\[([^\]]+)\](?![(:])/g, '<span class="a-remplir">[$1]</span>');
}

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.ignores.add("README.md");
  eleventyConfig.ignores.add("LISEZMOI.md");
  eleventyConfig.ignores.add("node_modules/**");

  eleventyConfig.addCollection("mots", (api) => api.getFilteredByGlob("contenus/mots/*.md"));
  eleventyConfig.addCollection("lectures", (api) => api.getFilteredByGlob("contenus/lectures/*.md"));
  eleventyConfig.addCollection("articles", (api) => api.getFilteredByGlob("contenus/articles/*.md"));

  // Texte en paragraphes (ligne vide = nouveau paragraphe)
  eleventyConfig.addFilter("md", (s) => (s ? aRemplir(typo(md.render(String(s)))) : ""));
  // Texte sur une seule ligne (italique, gras)
  eleventyConfig.addFilter("mdl", (s) => (s ? aRemplir(typo(md.renderInline(String(s)))) : ""));
  // Le corps des fiches et des articles
  eleventyConfig.addFilter("finitions", (html) => aRemplir(typo(html || "")));

  eleventyConfig.addFilter("sansEtoiles", (s) => String(s || "").replace(/\*/g, ""));

  eleventyConfig.addFilter("dateFr", (d) => {
    if (!d) return "";
    const x = d instanceof Date ? d : new Date(String(d) + "T12:00:00Z");
    if (isNaN(x)) return String(d);
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(x);
  });

  const quand = (item) => {
    const d = item.data.date || item.date;
    const x = d instanceof Date ? d : new Date(d);
    return isNaN(x) ? 0 : x.getTime();
  };
  eleventyConfig.addFilter("parDate", (liste) => [...(liste || [])].sort((a, b) => quand(b) - quand(a)));
  eleventyConfig.addFilter("parMot", (liste) =>
    [...(liste || [])].sort((a, b) => String(a.data.mot || "").localeCompare(String(b.data.mot || ""), "fr")));
  eleventyConfig.addFilter("premiers", (liste, n) => (liste || []).slice(0, n));

  eleventyConfig.addFilter("langues", (liste) => {
    const compte = {};
    (liste || []).forEach((m) => { const l = m.data.langue || "autre"; compte[l] = (compte[l] || 0) + 1; });
    return Object.keys(compte).sort((a, b) => a.localeCompare(b, "fr")).map((nom) => ({ nom, n: compte[nom] }));
  });

  // Les formes du premier parcours, reliées par des flèches
  eleventyConfig.addFilter("chaine", (parcours) => {
    const r = (parcours || [])[0];
    if (!r || !r.etapes) return "";
    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return r.etapes.map((e) => esc(e.forme || e.langue)).join(' <span aria-hidden="true">→</span> ');
  });

  const normaliser = (s) => String(s || "").trim().toLowerCase();
  // Retrouve la fiche d'un mot (utile pour « Mots à suivre » et « Le mot du moment »)
  eleventyConfig.addFilter("trouverMot", (liste, nom) => {
    const n = normaliser(nom);
    if (!n) return null;
    return (liste || []).find((m) => {
      const mot = normaliser(m.data.mot);
      return mot === n || mot.split(/\s*[&,]\s*/).includes(n);
    }) || null;
  });

  eleventyConfig.addFilter("voisins", (liste, url) => {
    const tri = [...(liste || [])].sort((a, b) => String(a.data.mot || "").localeCompare(String(b.data.mot || ""), "fr"));
    const i = tri.findIndex((m) => m.url === url);
    return { prec: i > 0 ? tri[i - 1] : null, suiv: i >= 0 && i < tri.length - 1 ? tri[i + 1] : null };
  });

  eleventyConfig.addFilter("themesDe", (liste) => {
    const vus = [];
    (liste || []).forEach((l) => (l.data.themes || []).forEach((t) => { if (t && !vus.includes(t)) vus.push(t); }));
    return vus;
  });

  eleventyConfig.addFilter("pluriel", (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`);

  return {
    dir: { input: ".", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
  };
}
