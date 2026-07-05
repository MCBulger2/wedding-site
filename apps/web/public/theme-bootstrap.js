(function () {
  function resolveTheme() {
    try {
      var storageKey = 'wedding.theme';
      var storedTheme = window.localStorage.getItem(storageKey);
      return (
        storedTheme === 'light' || storedTheme === 'dark'
          ? storedTheme
          : window.matchMedia &&
              window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
      );
    } catch {
      return 'light';
    }
  }

  var theme = resolveTheme();
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
