/* Service worker của Ký Ức: lưu cả vỏ ứng dụng để chạy không cần mạng. Có bản lưu thì trả ngay (cache-first)
   và tải bản mới ở nền. Bản dựng mới có tên kho mới nên thay thế hoàn toàn kho cũ. Bản dựng thay 20261118234014 và danh sách file. */
'use strict';
const BUILD = '20261118234014';
const SHELL_FILES = ['./', 'app.js', 'creative.css', 'icon-192.png', 'icon-512.png', 'index.html', 'local_store.js', 'manifest.webmanifest', 'memory_board.js', 'merge.js', 'script_page.css', 'script_page.js', 'story-cards/card_01_01_cottage.png', 'story-cards/card_01_02_question_mark.png', 'story-cards/card_01_03_eye.png', 'story-cards/card_01_04_scroll.png', 'story-cards/card_01_05_open_book.png', 'story-cards/card_01_06_crossed_swords.png', 'story-cards/card_01_07_people.png', 'story-cards/card_01_08_lightbulb.png', 'story-cards/card_02_01_orange.png', 'story-cards/card_02_02_heart.png', 'story-cards/card_02_03_door.png', 'story-cards/card_02_04_mountain.png', 'story-cards/card_02_05_winding_road.png', 'story-cards/card_02_06_sun.png', 'story-cards/card_02_07_moon.png', 'story-cards/card_02_08_rain_cloud.png', 'story-cards/card_03_01_tree.png', 'story-cards/card_03_02_flower.png', 'story-cards/card_03_03_film_camera.png', 'story-cards/card_03_04_wanderer.png', 'story-cards/card_03_05_hourglass.png', 'story-cards/card_03_06_key.png', 'story-cards/card_03_07_treasure_map.png', 'story-cards/card_03_08_flame.png', 'story-cards/card_04_01_finish_flag.png', 'story-cards/card_04_02_music.png', 'story-cards/card_04_03_ocean_wave.png', 'story-cards/card_04_04_star.png', 'story-cards/card_04_05_puzzle_piece.png', 'story-cards/card_04_06_crystals.png', 'story-cards/card_04_07_sprout.png', 'story-cards/card_04_08_mask.png', 'story-cards/card_05_01_letter.png', 'story-cards/card_05_02_potion.png', 'story-cards/card_05_03_quill.png', 'story-cards/card_05_04_lantern.png', 'story-cards/card_05_05_tent.png', 'story-cards/card_05_06_telescope.png', 'story-cards/card_05_07_stacked_stones.png', 'story-cards/card_05_08_lotus.png', 'style.css', 'sync.js'];
const CACHE = 'ky-uc-shell-' + BUILD;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('ky-uc-shell-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
/* Có bản lưu thì trả ngay, đồng thời tải mới ở nền để lần mở sau dùng bản mới. */
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    });
    if (cached) { network.catch(() => {}); return cached; }
    return network.catch(() => request.mode === 'navigate' ? cache.match('./') : Response.error());
  }));
});
