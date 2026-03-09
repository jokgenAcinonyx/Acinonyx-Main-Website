(async () => {
  const res = await fetch('http://localhost:3000/api/kijo/notifications/1');
  console.log('status', res.status);
  const json = await res.json();
  console.log('body', json);
})();
