(function () {
  try {
    var stored = localStorage.getItem('kakeibo_theme');
    var theme = stored;
    if (theme !== 'dark' && theme !== 'light') {
      var prefersDark =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
      localStorage.setItem('kakeibo_theme', theme);
    }
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
