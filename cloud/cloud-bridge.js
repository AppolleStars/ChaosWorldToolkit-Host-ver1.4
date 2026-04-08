/**
 * 云快照只读桥接：在 sessionStorage 中注入 TOOLKIT_CLOUD_MODE 时，
 * 将 adventure_logs_docs / teams_data / item_encyclopedia_data / map_member_positions
 * 映射为云端快照，并阻止写回这四项。
 */
(function () {
  var MODE = 'TOOLKIT_CLOUD_MODE';
  var KEYS = {
    adventure_logs_docs: 'TOOLKIT_CLOUD_DOCS',
    teams_data: 'TOOLKIT_CLOUD_TEAMS',
    item_encyclopedia_data: 'TOOLKIT_CLOUD_ITEMS',
    map_member_positions: 'TOOLKIT_CLOUD_MAP',
  };
  var KEY_LIST = Object.keys(KEYS);

  function isCloudMode() {
    try {
      return sessionStorage.getItem(MODE) === '1';
    } catch (e) {
      return false;
    }
  }

  if (!isCloudMode()) return;

  var defaults = {
    adventure_logs_docs: '[]',
    teams_data: '[]',
    item_encyclopedia_data: '[]',
    map_member_positions: '{}',
  };

  function snapGet(storageKey) {
    var sk = KEYS[storageKey];
    try {
      var v = sessionStorage.getItem(sk);
      if (v === null || v === undefined) return defaults[storageKey];
      return v;
    } catch (e) {
      return defaults[storageKey];
    }
  }

  var realGet = Storage.prototype.getItem;
  var realSet = Storage.prototype.setItem;
  var realRemove = Storage.prototype.removeItem;

  Storage.prototype.getItem = function (key) {
    if (this === localStorage && KEY_LIST.indexOf(key) !== -1) {
      return snapGet(key);
    }
    return realGet.call(this, key);
  };

  Storage.prototype.setItem = function (key, val) {
    if (this === localStorage && KEY_LIST.indexOf(key) !== -1) {
      console.warn('[云快照] 当前为只读模式，已忽略对', key, '的写入');
      return;
    }
    return realSet.call(this, key, val);
  };

  Storage.prototype.removeItem = function (key) {
    if (this === localStorage && KEY_LIST.indexOf(key) !== -1) {
      console.warn('[云快照] 当前为只读模式，已忽略移除', key);
      return;
    }
    return realRemove.call(this, key);
  };

  function toolkitIndexHref() {
    try {
      var path = window.location.pathname || '';
      var parts = path.split('/').filter(function (s) {
        return s && s.length;
      });
      if (!parts.length) return 'index.html';
      parts.pop();
      var depth = parts.length;
      if (depth === 0) return 'index.html';
      var up = '';
      for (var i = 0; i < depth; i++) up += '../';
      return up + 'index.html';
    } catch (e) {
      return 'index.html';
    }
  }

  function exitCloud() {
    try {
      sessionStorage.removeItem(MODE);
      KEY_LIST.forEach(function (k) {
        sessionStorage.removeItem(KEYS[k]);
      });
    } catch (e) {}
    window.location.href = toolkitIndexHref();
  }

  function showBanner() {
    if (document.getElementById('toolkit-cloud-banner')) return;
    document.addEventListener('DOMContentLoaded', function () {
      var bar = document.createElement('div');
      bar.id = 'toolkit-cloud-banner';
      bar.setAttribute(
        'style',
        'position:fixed;z-index:99999;left:0;right:0;top:0;background:#1a2a44;color:#e9eef5;padding:10px 14px;font-size:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 2px 12px rgba(0,0,0,.2);'
      );
      bar.innerHTML =
        '<span>☁️ 正在查看<strong>云快照</strong>（只读，不会改动本机存档）</span>';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '退出云快照';
      btn.setAttribute(
        'style',
        'flex-shrink:0;background:#e9eef5;color:#1a2a44;border:none;padding:6px 14px;border-radius:999px;cursor:pointer;font-weight:600;'
      );
      btn.addEventListener('click', exitCloud);
      bar.appendChild(btn);
      document.body.insertBefore(bar, document.body.firstChild);
      document.body.style.paddingTop =
        (parseInt(getComputedStyle(document.body).paddingTop, 10) || 0) + 48 + 'px';
    });
  }

  showBanner();
})();
