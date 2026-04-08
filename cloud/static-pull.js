(function () {
  var DEFAULT_REL = '../data/shared-snapshot.json';

  function resolveUrl(input) {
    var s = (input || '').trim();
    if (!s) return new URL(DEFAULT_REL, window.location.href).href;
    try {
      return new URL(s, window.location.href).href;
    } catch (e) {
      return new URL(DEFAULT_REL, window.location.href).href;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (sessionStorage.getItem('TOOLKIT_CLOUD_MODE') === '1') {
      alert('当前处于只读快照模式，请先点击顶部「退出云快照」后再合并。');
    }

    var urlInput = document.getElementById('staticPullUrl');
    var statusEl = document.getElementById('staticPullStatus');
    try {
      var saved = sessionStorage.getItem('TOOLKIT_STATIC_SNAPSHOT_URL');
      if (saved) urlInput.value = saved;
    } catch (e) {}

    document.getElementById('staticPullBtn').addEventListener('click', function () {
      statusEl.textContent = '';
      statusEl.style.color = '#2c6e9e';
      if (!window.CloudToolkitMerge) {
        statusEl.style.color = '#c0392b';
        statusEl.textContent = '缺少 merge.js。';
        return;
      }
      var target = resolveUrl(urlInput.value);
      try {
        sessionStorage.setItem('TOOLKIT_STATIC_SNAPSHOT_URL', urlInput.value.trim() || DEFAULT_REL);
      } catch (e) {}
      statusEl.textContent = '正在拉取…';
      fetch(target, { cache: 'no-store' })
        .then(function (r) {
          return r.text().then(function (t) {
            return { ok: r.ok, status: r.status, text: t };
          });
        })
        .then(function (res) {
          if (!res.ok) {
            throw new Error(res.status + ' ' + (res.text.slice(0, 200) || ''));
          }
          var snap = JSON.parse(res.text);
          var r = window.CloudToolkitMerge.mergeRemoteIntoLocalStorage(snap);
          if (!r.ok) throw new Error(r.message || '合并失败');
          statusEl.textContent = '已合并到本机，正在返回主界面…';
          setTimeout(function () {
            window.location.href = '../index.html';
          }, 400);
        })
        .catch(function (err) {
          statusEl.style.color = '#c0392b';
          statusEl.textContent = '失败：' + (err.message || String(err));
        });
    });
  });
})();
