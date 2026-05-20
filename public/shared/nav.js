(function () {
  const style = document.createElement('style');
  style.textContent = `
    #game-nav {
      display: flex;
      align-items: center;
      gap: 14px;
      font-family: 'Fredoka One', cursive;
      flex-shrink: 0;
      align-self: center;
    }
    #game-nav .nav-btn {
      background: none;
      border: 2px solid #555;
      color: #aaa;
      border-radius: 50%;
      width: 34px;
      height: 34px;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      padding: 0;
      line-height: 1;
    }
    #game-nav .nav-btn:hover:not(:disabled) {
      background: #e94560;
      color: white;
      border-color: #e94560;
    }
    #game-nav .nav-btn:disabled { opacity: 0.2; cursor: default; }
    #game-nav .nav-label {
      font-size: 1rem;
      color: #666;
      letter-spacing: 3px;
      min-width: 56px;
      text-align: center;
    }
  `;
  document.head.appendChild(style);

  const gameId = document.body.dataset.game;

  fetch('/api/games')
    .then(function (r) { return r.json(); })
    .then(function (games) {
      const idx = games.indexOf(gameId);

      const nav = document.createElement('div');
      nav.id = 'game-nav';

      const prev = document.createElement('button');
      prev.className = 'nav-btn';
      prev.textContent = '◀';
      prev.disabled = idx <= 0;
      prev.addEventListener('click', function () {
        window.location.href = '/game/' + games[idx - 1];
      });

      const label = document.createElement('span');
      label.className = 'nav-label';
      label.textContent = gameId;

      const next = document.createElement('button');
      next.className = 'nav-btn';
      next.textContent = '▶';
      next.disabled = idx >= games.length - 1;
      next.addEventListener('click', function () {
        window.location.href = '/game/' + games[idx + 1];
      });

      nav.appendChild(prev);
      nav.appendChild(label);
      nav.appendChild(next);

      document.body.insertBefore(nav, document.body.firstChild);
    });
})();
