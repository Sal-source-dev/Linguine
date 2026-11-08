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
// Adresse d'une page : sans accents, sans espaces
export function adresse(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
const normaliser = (s) => String(s || "").trim().toLowerCase();
const nombre = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));

// Couleurs des familles et des branches, comme sur une carte du ciel
const PALETTE = {
  "italique": "#F2D58A", "germanique": "#8FB3FF", "balto-slave": "#F4A28C", "hellenique": "#C3B1FF",
  "indo-iranien": "#7FD8C4", "semitique": "#EFA9D6", "afro-asiatique": "#EFA9D6", "turcique": "#B4DE8A",
  "celtique": "#8EDCF0", "armenien": "#E3C9A6", "albanais": "#D7B6F0", "ouralien": "#A9E0B0",
};
const RESERVE = ["#8EDCF0", "#E3C9A6", "#D7B6F0", "#A9E0B0", "#F7C59F", "#9FD1FF", "#F0E68C"];

// Construit l'arbre des langues à partir des fiches « Langues »
function construireAtlas(langues) {
  const noeuds = (langues || []).map((l) => {
    const d = l.data;
    return {
      id: adresse(d.nom || l.page.fileSlug),
      nom: d.nom || l.page.fileSlug,
      type: d.type || "langue",
      parentNom: d.parent || "",
      statut: d.statut || "",
      ecriture: d.ecriture || "",
      debut: nombre(d.debut),
      fin: nombre(d.fin),
      approx: !!d.dates_approximatives,
      region: d.region || "",
      lat: nombre(d.latitude),
      lon: nombre(d.longitude),
      resume: String(d.resume || "").replace(/\*/g, ""),
      url: l.url,
    };
  });
  const parId = new Map(noeuds.map((n) => [n.id, n]));
  noeuds.forEach((n) => {
    const p = adresse(n.parentNom);
    n.parent = p && parId.has(p) && p !== n.id ? p : null;
  });
  // Évite les boucles accidentelles (A parent de B, B parent de A)
  noeuds.forEach((n) => {
    const vus = new Set([n.id]);
    let p = n.parent;
    while (p) {
      if (vus.has(p)) { n.parent = null; break; }
      vus.add(p);
      p = parId.get(p).parent;
    }
  });
  // Clé de couleur : la branche juste sous la racine (ou la racine elle-même)
  const cles = [];
  noeuds.forEach((n) => {
    const chaine = [];
    let c = n;
    while (c) { chaine.unshift(c); c = c.parent ? parId.get(c.parent) : null; }
    n.ancetres = chaine.slice(0, -1).map((a) => a.id);
    n.racine = chaine[0].id;
    n.cle = (chaine[1] || chaine[0]).id;
    if (!cles.includes(n.cle)) cles.push(n.cle);
  });
  const libres = cles.filter((k) => !PALETTE[k]).sort();
  const couleurs = {};
  cles.forEach((k) => { couleurs[k] = PALETTE[k] || RESERVE[libres.indexOf(k) % RESERVE.length]; });
  noeuds.forEach((n) => { n.couleur = couleurs[n.cle]; });
  const legende = cles
    .map((k) => ({ id: k, nom: parId.get(k).nom, couleur: couleurs[k] }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return { noeuds, legende, parId };
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
  eleventyConfig.addCollection("langues", (api) =>
    api.getFilteredByGlob("contenus/langues/*.md").sort((a, b) =>
      String(a.data.nom || "").localeCompare(String(b.data.nom || ""), "fr")));

  // Texte en paragraphes (ligne vide = nouveau paragraphe)
  eleventyConfig.addFilter("md", (s) => (s ? aRemplir(typo(md.render(String(s)))) : ""));
  // Texte sur une seule ligne (italique, gras)
  eleventyConfig.addFilter("mdl", (s) => (s ? aRemplir(typo(md.renderInline(String(s)))) : ""));
  // Le corps des fiches et des articles
  eleventyConfig.addFilter("finitions", (html) => aRemplir(typo(html || "")));

  eleventyConfig.addFilter("sansEtoiles", (s) => String(s || "").replace(/\*/g, ""));
  eleventyConfig.addFilter("adresse", adresse);

  eleventyConfig.addFilter("dateFr", (d) => {
    if (!d) return "";
    const x = d instanceof Date ? d : new Date(String(d) + "T12:00:00Z");
    if (isNaN(x)) return String(d);
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(x);
  });
  // Une année : -600 → « 600 av. J.-C. »
  const annee = (v, approx) => {
    const n = nombre(v);
    if (n === null) return "";
    const t = n < 0 ? `${Math.abs(n)} av. J.-C.` : `${n}`;
    return (approx ? "vers " : "") + t;
  };
  eleventyConfig.addFilter("annee", annee);
  eleventyConfig.addFilter("periode", (d) => {
    const deb = annee(d.debut, d.dates_approximatives);
    const fin = annee(d.fin, d.dates_approximatives);
    if (!deb && !fin) return "";
    if (deb && !fin) return d.statut === "vivante" ? `depuis ${deb.replace(/^vers /, "environ ")}` : `à partir de ${deb.replace(/^vers /, "")}${d.dates_approximatives ? " environ" : ""}`;
    if (!deb) return `jusqu'à ${fin}`;
    return `${deb} – ${fin.replace(/^vers /, "")}`;
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

  // Langues sources présentes dans les fiches de mots (pour le filtre)
  eleventyConfig.addFilter("langues", (liste) => {
    const compte = {};
    (liste || []).forEach((m) => { const l = m.data.langue || "autre"; compte[l] = (compte[l] || 0) + 1; });
    return Object.keys(compte).sort((a, b) => a.localeCompare(b, "fr")).map((nom) => ({ nom, n: compte[nom] }));
  });

  // « du latin », « de l'arabe » ; « le latin », « l'arabe »
  const voyelle = (s) => /^[aeiouyhàâéèêëîïôöûü]/i.test(String(s || "").trim());
  eleventyConfig.addFilter("de", (s) => (voyelle(s) ? `de l'${s}` : `du ${s}`));
  eleventyConfig.addFilter("le", (s) => (voyelle(s) ? `l'${s}` : `le ${s}`));

  eleventyConfig.addFilter("arrivee", (d) => (d && d.langue_arrivee) || "français");

  // Les formes du premier parcours, reliées par des flèches
  eleventyConfig.addFilter("chaine", (parcours) => {
    const r = (parcours || [])[0];
    if (!r || !r.etapes) return "";
    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return r.etapes.map((e) => esc(e.forme || e.langue)).join(' <span aria-hidden="true">→</span> ');
  });

  // Retrouve la fiche d'un mot (utile pour « Mots à suivre » et « Le mot du moment »)
  eleventyConfig.addFilter("trouverMot", (liste, nom) => {
    const n = normaliser(nom);
    if (!n) return null;
    return (liste || []).find((m) => {
      const mot = normaliser(m.data.mot);
      return mot === n || mot.split(/\s*[&,]\s*/).includes(n);
    }) || null;
  });

  // Retrouve la page d'une langue à partir de son nom
  eleventyConfig.addFilter("trouverLangue", (langues, nom) => {
    const a = adresse(nom);
    if (!a) return null;
    return (langues || []).find((l) => adresse(l.data.nom || l.page.fileSlug) === a) || null;
  });

  // Les contenus qui concernent une langue
  eleventyConfig.addFilter("motsDepuis", (mots, nom) =>
    (mots || []).filter((m) => adresse(m.data.langue) === adresse(nom)));
  eleventyConfig.addFilter("motsVers", (mots, nom) =>
    (mots || []).filter((m) => adresse(m.data.langue_arrivee || "français") === adresse(nom)));
  eleventyConfig.addFilter("motsPassantPar", (mots, nom) =>
    (mots || []).filter((m) => {
      const a = adresse(nom);
      if (adresse(m.data.langue) === a || adresse(m.data.langue_arrivee || "français") === a) return false;
      return (m.data.parcours || []).some((r) => (r.etapes || []).some((e) => adresse(e.langue) === a));
    }));
  eleventyConfig.addFilter("taguesAvec", (liste, nom) =>
    (liste || []).filter((x) => (x.data.langues || []).some((l) => adresse(l) === adresse(nom))));

  // L'atlas : données de l'arbre, de la carte et de la frise
  eleventyConfig.addFilter("atlasJSON", (langues, mots) => {
    const { noeuds, legende } = construireAtlas(langues);
    const compte = {};
    (mots || []).forEach((m) => {
      [m.data.langue, m.data.langue_arrivee || "français"].forEach((l) => { const a = adresse(l); compte[a] = (compte[a] || 0) + 1; });
    });
    noeuds.forEach((n) => { n.mots = compte[n.id] || 0; delete n.parentNom; });
    return JSON.stringify({ noeuds, legende }).replace(/</g, "\\u003c");
  });
  // Petite constellation décorative pour l'accueil (vraies positions des langues)
  eleventyConfig.addFilter("miniCiel", (langues) => {
    const { noeuds, parId } = construireAtlas(langues);
    const pts = noeuds.filter((n) => n.lat !== null && n.lon !== null);
    if (!pts.length) return "";
    const W = 440, H = 260, m = 22;
    const lons = pts.map((n) => n.lon), lats = pts.map((n) => n.lat);
    const x0 = Math.min(...lons), x1 = Math.max(...lons), y0 = Math.min(...lats), y1 = Math.max(...lats);
    const k = Math.min((W - 2 * m) / Math.max(1, x1 - x0), (H - 2 * m) / Math.max(1, y1 - y0));
    const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
    const X = (n) => (ox + (n.lon - x0) * k).toFixed(1), Y = (n) => (oy + (y1 - n.lat) * k).toFixed(1);
    let svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"><defs><filter id="lueur-mini" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.2" result="f"/><feMerge><feMergeNode in="f"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    pts.forEach((n) => {
      const p = n.parent && parId.get(n.parent);
      if (p && p.lat !== null && p.lon !== null) svg += `<line x1="${X(p)}" y1="${Y(p)}" x2="${X(n)}" y2="${Y(n)}" stroke="${n.couleur}" stroke-opacity=".45" stroke-width="1"/>`;
    });
    pts.forEach((n) => {
      const r = n.type === "famille" ? 4.5 : n.type === "branche" ? 3.4 : 2.8;
      svg += n.statut === "reconstruite"
        ? `<circle cx="${X(n)}" cy="${Y(n)}" r="${r}" fill="#0A0D1A" stroke="${n.couleur}" stroke-dasharray="2 2"/>`
        : `<circle cx="${X(n)}" cy="${Y(n)}" r="${r}" fill="${n.couleur}" filter="url(#lueur-mini)"/>`;
    });
    return svg + "</svg>";
  });
  eleventyConfig.addFilter("legende", (langues) => construireAtlas(langues).legende);
  eleventyConfig.addFilter("infosLangue", (langues, nom) => {
    const { noeuds, parId } = construireAtlas(langues);
    const n = parId.get(adresse(nom));
    if (!n) return null;
    return {
      couleur: n.couleur,
      ancetres: n.ancetres.map((id) => parId.get(id)),
      enfants: noeuds.filter((x) => x.parent === n.id).sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
      soeurs: n.parent ? noeuds.filter((x) => x.parent === n.parent && x.id !== n.id).sort((a, b) => a.nom.localeCompare(b.nom, "fr")) : [],
    };
  });
  // Index de l'atlas : les langues regroupées par famille, dans l'ordre de l'arbre
  eleventyConfig.addFilter("indexAtlas", (langues) => {
    const { noeuds } = construireAtlas(langues);
    const enfants = (id) => noeuds.filter((x) => x.parent === id).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    const lignes = [];
    const parcourir = (n, niveau) => { lignes.push({ ...n, niveau }); enfants(n.id).forEach((e) => parcourir(e, niveau + 1)); };
    noeuds.filter((n) => !n.parent).sort((a, b) => a.nom.localeCompare(b.nom, "fr")).forEach((r) => parcourir(r, 0));
    return lignes;
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
