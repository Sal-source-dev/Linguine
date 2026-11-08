// linguine — l'Atlas des langues : arbre, carte, frise, arbre + frise.
// Les données viennent des fiches « Langues » (Pages CMS). Rien à modifier ici.
(function () {
  'use strict';
  var source = document.getElementById('donnees-atlas');
  var ciel = document.getElementById('ciel');
  if (!source || !ciel || !window.d3) return;

  var d3 = window.d3;
  var donnees = JSON.parse(source.textContent || '{"noeuds":[]}');
  var noeuds = donnees.noeuds || [];
  var parId = {};
  noeuds.forEach(function (n) { parId[n.id] = n; });

  // Préfixe des adresses (le site vit sous /Linguine/ sur GitHub Pages)
  var logo = document.querySelector('.logo');
  var base = logo ? new URL(logo.href, location.href).pathname.replace(/\/$/, '') : '';
  function lien(n) { return base + n.url; }

  var AUJOURDHUI = new Date().getFullYear();
  var aide = document.getElementById('ciel-aide');
  var vueActive = 'arbre';
  var choisi = null;
  var terres = null;

  // ---------- Outils ----------
  function enfantsDe(id) {
    return noeuds.filter(function (n) { return n.parent === id; })
      .sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
  }
  // Ordre de l'arbre : familles, puis branches, puis langues, en profondeur
  function ordreArbre() {
    var ordre = [];
    function visiter(n, niveau) { ordre.push({ n: n, niveau: niveau }); enfantsDe(n.id).forEach(function (e) { visiter(e, niveau + 1); }); }
    noeuds.filter(function (n) { return !n.parent; })
      .sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); })
      .forEach(function (r) { visiter(r, 0); });
    return ordre;
  }
  function anneeTexte(v) { return v < 0 ? Math.abs(v) + ' av. J.-C.' : String(v); }
  function periode(n) {
    if (n.debut == null && n.fin == null) return '';
    var v = n.approx ? 'vers ' : '';
    if (n.debut != null && n.fin == null) return n.statut === 'vivante' ? 'depuis ' + (n.approx ? 'environ ' : '') + anneeTexte(n.debut) : v + anneeTexte(n.debut);
    if (n.debut == null) return "jusqu'à " + anneeTexte(n.fin);
    return v + anneeTexte(n.debut) + ' – ' + anneeTexte(n.fin);
  }
  function rayon(n) {
    var r = n.type === 'famille' ? 6.5 : n.type === 'branche' ? 5 : 4;
    return r + Math.min(3, n.mots || 0) * 0.8;
  }
  function vider() { while (ciel.firstChild) ciel.removeChild(ciel.firstChild); }
  function largeurDispo() { return Math.max(320, ciel.clientWidth || 800); }

  function nouveauSvg(w, h, titre) {
    var svg = d3.select(ciel).append('svg')
      .attr('width', w).attr('height', h).attr('viewBox', '0 0 ' + w + ' ' + h)
      .attr('role', 'img').attr('aria-label', titre);
    var defs = svg.append('defs');
    var f = defs.append('filter').attr('id', 'lueur').attr('x', '-200%').attr('y', '-200%').attr('width', '500%').attr('height', '500%');
    f.append('feGaussianBlur').attr('stdDeviation', 2.6).attr('result', 'flou');
    var m = f.append('feMerge');
    m.append('feMergeNode').attr('in', 'flou');
    m.append('feMergeNode').attr('in', 'SourceGraphic');
    return svg;
  }

  // Une étoile : halo de sélection, éclat, cœur
  function dessinerEtoile(g, n) {
    var r = rayon(n);
    g.attr('class', 'noeud').attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', n.nom + (n.type !== 'langue' ? ' (' + n.type + ')' : '') + '. Afficher la fiche.')
      .classed('choisi', choisi === n.id);
    g.append('circle').attr('class', 'halo').attr('r', r + 7).attr('fill', 'none')
      .attr('stroke', '#F2D58A').attr('stroke-width', 1.2);
    g.append('circle').attr('r', 22).attr('fill', 'transparent'); // zone tactile
    if (n.statut === 'reconstruite') {
      g.append('circle').attr('r', r).attr('fill', '#0A0D1A').attr('stroke', n.couleur).attr('stroke-width', 1.4).attr('stroke-dasharray', '2 2');
    } else {
      g.append('circle').attr('r', r).attr('fill', n.couleur).attr('filter', 'url(#lueur)')
        .attr('opacity', n.statut === 'morte' ? 0.6 : 1);
      if (n.statut !== 'morte') g.append('circle').attr('r', Math.max(1.4, r * 0.38)).attr('fill', '#FFFFFF').attr('opacity', 0.85);
    }
    g.on('click', function (ev) { ev.stopPropagation(); choisir(n.id); })
      .on('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choisir(n.id); } });
  }

  // ---------- Panneau de détail ----------
  var detail = document.getElementById('detail');
  function choisir(id) {
    choisi = id;
    var n = parId[id];
    if (!n || !detail) return;
    var type = n.type === 'langue' ? 'Langue' : n.type === 'branche' ? 'Branche' : 'Famille';
    document.getElementById('detail-type').textContent = type + (n.statut ? ' · ' + n.statut : '');
    document.getElementById('detail-nom').textContent = n.nom;
    document.getElementById('detail-resume').textContent = n.resume || '';
    var meta = [periode(n), n.region, n.ecriture, n.mots ? n.mots + (n.mots > 1 ? ' mots voyageurs' : ' mot voyageur') : '']
      .filter(Boolean).join(' · ');
    document.getElementById('detail-meta').textContent = meta;
    document.getElementById('detail-lien').setAttribute('href', lien(n));
    detail.hidden = false;
    d3.select(ciel).selectAll('.noeud').classed('choisi', function () { return this.getAttribute('data-id') === id; });
  }

  // ---------- 1. Arbre des familles ----------
  function vueArbre() {
    var racines = noeuds.filter(function (n) { return !n.parent; });
    var donneesArbre = [{ id: '__ciel', parent: null }].concat(noeuds.map(function (n) { return { id: n.id, parent: n.parent || '__ciel' }; }));
    var h = d3.stratify().id(function (d) { return d.id; }).parentId(function (d) { return d.parent; })(donneesArbre);
    h.sort(function (a, b) { return (parId[a.id] ? parId[a.id].nom : '').localeCompare(parId[b.id] ? parId[b.id].nom : '', 'fr'); });
    var pasY = 34, pasX = 180;
    d3.tree().nodeSize([pasY, pasX])(h);
    var desc = h.descendants().filter(function (d) { return d.id !== '__ciel'; });
    var minX = d3.min(desc, function (d) { return d.x; }), maxX = d3.max(desc, function (d) { return d.x; });
    var maxProf = d3.max(desc, function (d) { return d.depth; });
    var margeG = 120, margeD = 150, margeH = 34;
    var w = Math.max(largeurDispo(), margeG + (maxProf - 1) * pasX + margeD);
    var hauteur = (maxX - minX) + margeH * 2;
    var etirement = (w - margeG - margeD) / Math.max(1, (maxProf - 1) * pasX);
    var X = function (d) { return margeG + (d.depth - 1) * pasX * Math.max(1, etirement); };
    var Y = function (d) { return d.x - minX + margeH; };
    var svg = nouveauSvg(w, hauteur, 'Arbre des familles de langues : ' + racines.length + ' familles, ' + noeuds.length + ' entrées.');
    var g = svg.append('g');
    g.append('g').selectAll('path').data(h.links().filter(function (l) { return l.source.id !== '__ciel'; }))
      .join('path')
      .attr('d', function (l) { return d3.linkHorizontal().x(X).y(Y)(l); })
      .attr('fill', 'none').attr('stroke', function (l) { return parId[l.target.id].couleur; })
      .attr('stroke-opacity', 0.45).attr('stroke-width', 1);
    var n = g.append('g').selectAll('g').data(desc).join('g')
      .attr('data-id', function (d) { return d.id; })
      .attr('transform', function (d) { return 'translate(' + X(d) + ',' + Y(d) + ')'; });
    n.each(function (d) { dessinerEtoile(d3.select(this), parId[d.id]); });
    n.append('text')
      .attr('class', function (d) { return 'n-nom' + (parId[d.id].type !== 'langue' ? ' n-famille' : ''); })
      .attr('x', function (d) { return d.children ? -12 : 12; })
      .attr('y', function (d) { return d.children ? -9 : 5; })
      .attr('text-anchor', function (d) { return d.children ? 'end' : 'start'; })
      .text(function (d) { return parId[d.id].nom; });
    aide.textContent = 'Les grandes familles à gauche, les langues d’aujourd’hui à droite. Les cercles en pointillés sont des langues reconstruites.';
  }

  // ---------- 2. Carte ----------
  function vueCarte() {
    var places = noeuds.filter(function (n) { return n.lat != null && n.lon != null; });
    var sans = noeuds.length - places.length;
    var w = largeurDispo(), hauteur = Math.round(Math.min(620, Math.max(380, w * 0.62)));
    var svg = nouveauSvg(w, hauteur, 'Carte des langues : ' + places.length + ' langues placées.');
    var projection = d3.geoNaturalEarth1();
    var ensemble = { type: 'MultiPoint', coordinates: places.map(function (n) { return [n.lon, n.lat]; }) };
    if (places.length) projection.fitExtent([[60, 50], [w - 90, hauteur - 50]], ensemble);
    else projection.fitSize([w, hauteur], { type: 'Sphere' });
    var chemin = d3.geoPath(projection);
    var monde = svg.append('g');
    monde.append('path').datum(d3.geoGraticule10()).attr('class', 'graticule').attr('d', chemin).attr('vector-effect', 'non-scaling-stroke');
    if (terres) monde.append('path').datum(terres).attr('class', 'terres').attr('d', chemin).attr('vector-effect', 'non-scaling-stroke');
    var lignes = places.filter(function (n) { return n.parent && parId[n.parent] && parId[n.parent].lat != null; });
    var gL = svg.append('g');
    var gN = svg.append('g');
    function pos(n) { return projection([n.lon, n.lat]); }
    var t = d3.zoomIdentity;
    var dessiner = function () {
      monde.attr('transform', t);
      gL.selectAll('line').data(lignes).join('line')
        .attr('x1', function (n) { return t.applyX(pos(parId[n.parent])[0]); })
        .attr('y1', function (n) { return t.applyY(pos(parId[n.parent])[1]); })
        .attr('x2', function (n) { return t.applyX(pos(n)[0]); })
        .attr('y2', function (n) { return t.applyY(pos(n)[1]); })
        .attr('stroke', function (n) { return n.couleur; }).attr('stroke-opacity', 0.5).attr('stroke-width', 1);
      gN.selectAll('g.noeud').attr('transform', function (n) { var p = pos(n); return 'translate(' + t.applyX(p[0]) + ',' + t.applyY(p[1]) + ')'; });
    };
    var g = gN.selectAll('g').data(places).join('g').attr('data-id', function (n) { return n.id; });
    g.each(function (n) { dessinerEtoile(d3.select(this), n); });
    var gT = svg.append('g').attr('pointer-events', 'none');
    // Les langues d'abord, puis les branches et les familles
    var priorite = places.slice().sort(function (a, b) {
      var pa = a.type === 'langue' ? 0 : a.type === 'branche' ? 1 : 2, pb = b.type === 'langue' ? 0 : b.type === 'branche' ? 1 : 2;
      return pa - pb || (b.mots || 0) - (a.mots || 0) || a.nom.localeCompare(b.nom, 'fr');
    });
    var etiquettes = gT.selectAll('text').data(priorite).join('text')
      .attr('class', function (n) { return 'n-nom' + (n.type !== 'langue' ? ' n-famille' : ''); })
      .style('font-size', function (n) { return n.type === 'langue' ? '15px' : '14px'; })
      .text(function (n) { return n.nom; });
    // Place chaque étiquette là où elle ne chevauche ni une autre étiquette ni une étoile
    function placerEtiquettes() {
      var boites = places.map(function (n) { var p = pos(n); var X = t.applyX(p[0]), Y = t.applyY(p[1]); return [X - 6, Y - 6, X + 6, Y + 6]; });
      function libre(b) {
        if (b[0] < 2 || b[2] > w - 2 || b[1] < 2 || b[3] > hauteur - 2) return false;
        for (var i = 0; i < boites.length; i++) {
          var o = boites[i];
          if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return false;
        }
        return true;
      }
      etiquettes.each(function (n) {
        var p = pos(n), X = t.applyX(p[0]), Y = t.applyY(p[1]);
        var lw = n.nom.length * (n.type === 'langue' ? 7.4 : 6.8), lh = 15;
        var essais = [
          { x: X + 10, y: Y + 5, a: 'start', b: [X + 9, Y - 9, X + 11 + lw, Y + 7] },
          { x: X - 10, y: Y + 5, a: 'end', b: [X - 11 - lw, Y - 9, X - 9, Y + 7] },
          { x: X, y: Y - 11, a: 'middle', b: [X - lw / 2, Y - 11 - lh + 3, X + lw / 2, Y - 8] },
          { x: X, y: Y + 21, a: 'middle', b: [X - lw / 2, Y + 8, X + lw / 2, Y + 24] }
        ];
        var choix = null;
        for (var i = 0; i < essais.length; i++) { if (libre(essais[i].b)) { choix = essais[i]; break; } }
        var el = d3.select(this);
        if (!choix) { el.attr('display', 'none'); return; }
        boites.push(choix.b);
        el.attr('display', null).attr('x', choix.x).attr('y', choix.y).attr('text-anchor', choix.a);
      });
    }
    var dessinerBase = dessiner;
    dessiner = function () { dessinerBase(); placerEtiquettes(); };
    dessiner();
    svg.call(d3.zoom().scaleExtent([1, 10]).translateExtent([[-w, -hauteur], [2 * w, 2 * hauteur]])
      .on('zoom', function (ev) { t = ev.transform; dessiner(); }));
    aide.textContent = 'Pince ou fais glisser pour explorer : en zoomant, les noms cachés apparaissent. Les lignes relient chaque langue à sa langue mère. Pour les familles et les branches, le point indique un foyer supposé.' +
      (sans ? ' ' + sans + (sans > 1 ? ' entrées sans coordonnées n’apparaissent' : ' entrée sans coordonnées n’apparaît') + ' pas ici.' : '');
  }

  // ---------- 3 et 4. Frises ----------
  function echelleTemps(w, gauche, droite) {
    var min = d3.min(noeuds, function (n) { return n.debut; });
    if (min == null) min = -1000;
    var coupure = -1500;
    if (min >= coupure) return { x: d3.scaleLinear().domain([min - 100, AUJOURDHUI + 30]).range([gauche, w - droite]), coupure: null };
    return {
      x: d3.scaleLinear().domain([min - 200, coupure, AUJOURDHUI + 30]).range([gauche, gauche + (w - gauche - droite) * 0.16, w - droite]),
      coupure: coupure
    };
  }
  function axe(svg, ech, hauteur, haut) {
    var x = ech.x;
    var d = x.domain();
    var graduations = [-4000, -3000, -2000, -1500, -1000, -500, 1, 500, 1000, 1500, 2000].filter(function (v) {
      if (ech.coupure != null && v < ech.coupure && v !== -4000 && v !== -3000) return false;
      return v >= d[0] && v <= d[d.length - 1];
    });
    var g = svg.append('g').attr('class', 'axe');
    var dernier = -Infinity;
    graduations.forEach(function (v) {
      g.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', haut - 6).attr('y2', hauteur - 10)
        .attr('stroke-dasharray', v === ech.coupure ? '3 4' : null).attr('stroke-opacity', v === ech.coupure ? 0.9 : 0.5);
      // une étiquette seulement s'il reste de la place
      if (x(v) - dernier < 62 && v !== ech.coupure) return;
      dernier = x(v);
      g.append('text').attr('x', Math.max(26, x(v))).attr('y', haut - 12).attr('text-anchor', 'middle')
        .text(v < 0 ? Math.abs(v) + ' av.' : v === 1 ? 'an 1' : v);
    });
    if (ech.coupure != null) g.append('text').attr('x', x(ech.coupure) - 6).attr('y', hauteur - 14).attr('text-anchor', 'end').text('échelle resserrée');
  }

  function vueFrise(avecArbre) {
    var ordre = ordreArbre().map(function (o) { return o.n; });
    // Dates estimées pour placer les branches non datées (arbre + frise)
    var est = {};
    function debutEstime(n) {
      if (est[n.id] !== undefined) return est[n.id];
      var v = n.debut;
      if (v == null) {
        var e = enfantsDe(n.id).map(debutEstime).filter(function (x) { return x != null; });
        v = e.length ? d3.min(e) - 300 : null;
      }
      est[n.id] = v;
      return v;
    }
    ordre.forEach(debutEstime);
    function finDe(n) {
      if (n.fin != null) return n.fin;
      if (n.statut === 'reconstruite') {
        var e = enfantsDe(n.id).map(function (c) { return est[c.id]; }).filter(function (x) { return x != null; });
        return e.length ? d3.max(e) : (est[n.id] != null ? est[n.id] + 500 : null);
      }
      return AUJOURDHUI;
    }
    var lignes = ordre.filter(function (n) { return avecArbre ? est[n.id] != null : n.debut != null; });
    var exclues = noeuds.length - lignes.length;
    var pas = 32, haut = 40;
    var w = Math.max(largeurDispo(), 760);
    var hauteur = haut + lignes.length * pas + 24;
    var ech = echelleTemps(w, 24, 24);
    var x = ech.x;
    var svg = nouveauSvg(w, hauteur, (avecArbre ? 'Arbre et frise' : 'Frise chronologique') + ' des langues.');
    axe(svg, ech, hauteur, haut);
    var rang = {};
    lignes.forEach(function (n, i) { rang[n.id] = haut + 14 + i * pas; });

    if (avecArbre) {
      // Chaque langue se détache de sa mère au moment où elle apparaît
      svg.append('g').selectAll('path').data(lignes.filter(function (n) { return n.parent && rang[n.parent] != null; }))
        .join('path')
        .attr('d', function (n) {
          // depuis la ligne de la langue mère (au plus tard à sa fin), jusqu'à la naissance de la fille
          var mere = parId[n.parent];
          var debMere = est[mere.id], finMere = finDe(mere);
          var t = est[n.id];
          if (finMere != null) t = Math.min(t, finMere);
          if (debMere != null) t = Math.max(t, debMere);
          return 'M' + x(t) + ',' + rang[n.parent] + ' V' + rang[n.id] + ' H' + x(est[n.id]);
        })
        .attr('stroke', function (n) { return n.couleur; }).attr('stroke-opacity', 0.55).attr('stroke-width', 1).attr('fill', 'none');
    }
    var g = svg.append('g').selectAll('g').data(lignes).join('g');
    g.each(function (n) {
      var gg = d3.select(this);
      var d0 = avecArbre ? est[n.id] : n.debut;
      var f = finDe(n);
      var y = rang[n.id];
      var savante = n.statut === 'langue savante';
      var estime = n.debut == null;
      if (f != null && f > d0) {
        gg.append('line').attr('x1', x(d0)).attr('x2', x(f)).attr('y1', y).attr('y2', y)
          .attr('stroke', n.couleur).attr('stroke-width', n.statut === 'vivante' ? 2.4 : 1.6)
          .attr('stroke-opacity', n.statut === 'reconstruite' || estime ? 0.55 : 0.9)
          .attr('stroke-dasharray', n.statut === 'reconstruite' || estime ? '4 4' : null);
      }
      if (savante && f != null && f < AUJOURDHUI) {
        gg.append('line').attr('x1', x(f)).attr('x2', x(AUJOURDHUI)).attr('y1', y).attr('y2', y)
          .attr('stroke', n.couleur).attr('stroke-width', 1.2).attr('stroke-opacity', 0.5).attr('stroke-dasharray', '1 4');
      }
      var etoile = gg.append('g').attr('data-id', n.id).attr('transform', 'translate(' + x(d0) + ',' + y + ')');
      dessinerEtoile(etoile, n);
      gg.append('text').attr('class', 'n-nom' + (n.type !== 'langue' ? ' n-famille' : ''))
        .attr('x', x(d0) + 10).attr('y', y - 7).style('font-size', '15px').text(n.nom);
    });
    var txt = avecArbre
      ? 'Chaque trait vertical montre une langue qui naît de sa langue mère. En pointillés : langues reconstruites ou dates estimées.'
      : 'Chaque ligne va de la première attestation d’une langue à sa disparition, ou jusqu’à aujourd’hui. Pointillés fins : usage savant après la fin de l’usage courant.';
    if (exclues) txt += ' ' + exclues + (exclues > 1 ? ' entrées sans date n’apparaissent' : ' entrée sans date n’apparaît') + ' pas.';
    aide.textContent = txt;
  }

  // ---------- Changer de vue ----------
  var boutons = document.querySelectorAll('.vues [data-vue]');
  function afficher(vue) {
    vueActive = vue;
    Array.prototype.forEach.call(boutons, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-vue') === vue)); });
    vider();
    if (!noeuds.length) {
      var p = document.createElement('p');
      p.className = 'chargement';
      p.textContent = 'Aucune langue pour l’instant. Ajoute-en une dans Pages CMS, section « Langues ».';
      ciel.appendChild(p);
      aide.textContent = '';
      return;
    }
    if (vue === 'carte') vueCarte();
    else if (vue === 'frise') vueFrise(false);
    else if (vue === 'arbre-frise') vueFrise(true);
    else vueArbre();
    if (choisi) choisir(choisi);
  }
  Array.prototype.forEach.call(boutons, function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-vue');
      try { history.replaceState(null, '', '#' + v); } catch (e) {}
      afficher(v);
    });
  });
  var depart = (location.hash || '').slice(1);
  if (!/^(arbre|carte|frise|arbre-frise)$/.test(depart)) depart = 'arbre';

  window.addEventListener('hashchange', function () {
    var h = (location.hash || '').slice(1);
    if (/^(arbre|carte|frise|arbre-frise)$/.test(h) && h !== vueActive) afficher(h);
  });

  var largeur = largeurDispo();
  var minuteur = null;
  window.addEventListener('resize', function () {
    clearTimeout(minuteur);
    minuteur = setTimeout(function () {
      if (Math.abs(largeurDispo() - largeur) > 40) { largeur = largeurDispo(); afficher(vueActive); }
    }, 200);
  });

  afficher(depart);
  // Le fond de carte arrive un peu après : on redessine la carte s'il est utile
  var lienTerres = document.getElementById('terres');
  if (lienTerres && window.topojson) {
    fetch(lienTerres.href).then(function (r) { return r.ok ? r.json() : null; }).then(function (topo) {
      if (!topo) return;
      terres = window.topojson.feature(topo, topo.objects.land);
      if (vueActive === 'carte') afficher('carte');
    }).catch(function () {});
  }
})();
