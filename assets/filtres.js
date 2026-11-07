// Filtre des Mots voyageurs par langue source
(function () {
  var boutons = document.querySelectorAll('.filtres [data-langue]');
  var cartes = document.querySelectorAll('#liste-mots [data-langue]');
  Array.prototype.forEach.call(boutons, function (b) {
    b.addEventListener('click', function () {
      var choix = b.getAttribute('data-langue');
      Array.prototype.forEach.call(boutons, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      Array.prototype.forEach.call(cartes, function (c) {
        c.hidden = !(choix === 'toutes' || c.getAttribute('data-langue') === choix);
      });
    });
  });
})();
