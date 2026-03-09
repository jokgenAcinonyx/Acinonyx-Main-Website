(async () => {
  for (const url of [
    'http://localhost:3000/api/admin/settings',
    'http://localhost:3000/api/kijo/game-accounts/1',
    'http://localhost:3000/api/kijo/notifications/1'
  ]) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log('URL:', url, 'status', res.status);
      console.log(text);
    } catch (err) {
      console.error('fetch error', url, err);
    }
  }
})();
