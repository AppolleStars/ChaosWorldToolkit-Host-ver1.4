/* global CLOUD_WORKER_BASE, CloudToolkitMerge */
(function () {
  function workerBase() {
    var b = typeof window.CLOUD_WORKER_BASE === 'string' ? window.CLOUD_WORKER_BASE.trim() : '';
    return b.replace(/\/$/, '');
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (sessionStorage.getItem('TOOLKIT_CLOUD_MODE') === '1') {
      alert('当前处于云快照只读模式，请先点击顶部「退出云快照」后再拉取合并。');
    }

    var baseInput = document.getElementById('pullWorkerBase');
    var readInput = document.getElementById('pullReadToken');
    var adminInput = document.getElementById('pullAdminToken');
    var teamStatus = document.getElementById('pullTeamStatus');
    var adminStatus = document.getElementById('pullAdminStatus');

    try {
      var wb = localStorage.getItem('cloud_worker_base');
      if (wb) baseInput.value = wb;
      var rt = localStorage.getItem('cloud_read_token');
      if (rt) readInput.value = rt;
      var at = localStorage.getItem('cloud_admin_token');
      if (at) adminInput.value = at;
    } catch (e) {}

    var conf = workerBase();
    if (!baseInput.value && conf) baseInput.value = conf;

    function base() {
      return (baseInput.value || '').trim().replace(/\/$/, '');
    }

    document.getElementById('pullTeamBtn').addEventListener('click', function () {
      teamStatus.textContent = '';
      adminStatus.textContent = '';
      var b = base();
      var tok = (readInput.value || '').trim();
      if (!b) {
        teamStatus.textContent = '请填写 Worker 地址。';
        return;
      }
      if (!tok) {
        teamStatus.textContent = '请填写只读令牌。';
        return;
      }
      if (!window.CloudToolkitMerge) {
        teamStatus.textContent = '缺少 merge.js。';
        return;
      }
      teamStatus.textContent = '正在拉取…';
      try {
        localStorage.setItem('cloud_read_token', tok);
      } catch (e) {}
      fetch(b + '/api/snapshot?token=' + encodeURIComponent(tok))
        .then(function (r) {
          return r.text().then(function (t) {
            return { ok: r.ok, status: r.status, text: t };
          });
        })
        .then(function (res) {
          if (!res.ok) {
            var msg = res.text;
            try {
              var j = JSON.parse(res.text);
              if (j.error) msg = j.error;
            } catch (e) {}
            throw new Error(res.status + ' ' + msg);
          }
          var snap = JSON.parse(res.text);
          var r = window.CloudToolkitMerge.mergeRemoteIntoLocalStorage(snap);
          if (!r.ok) throw new Error(r.message || '合并失败');
          teamStatus.textContent = '已合并到本机，正在返回主界面…';
          setTimeout(function () {
            window.location.href = '../index.html';
          }, 400);
        })
        .catch(function (err) {
          teamStatus.textContent = '失败：' + (err.message || String(err));
        });
    });

    document.getElementById('pullAdminBtn').addEventListener('click', function () {
      adminStatus.textContent = '';
      teamStatus.textContent = '';
      var b = base();
      var tok = (adminInput.value || '').trim();
      if (!b) {
        adminStatus.textContent = '请填写 Worker 地址。';
        return;
      }
      if (!tok) {
        adminStatus.textContent = '请填写主持人全量令牌。';
        return;
      }
      if (!window.CloudToolkitMerge) {
        adminStatus.textContent = '缺少 merge.js。';
        return;
      }
      adminStatus.textContent = '正在拉取全量…';
      try {
        localStorage.setItem('cloud_admin_token', tok);
      } catch (e) {}
      fetch(b + '/api/snapshot/all?token=' + encodeURIComponent(tok))
        .then(function (r) {
          return r.text().then(function (t) {
            return { ok: r.ok, status: r.status, text: t };
          });
        })
        .then(function (res) {
          if (!res.ok) {
            var msg = res.text;
            try {
              var j = JSON.parse(res.text);
              if (j.error) msg = j.error;
            } catch (e) {}
            throw new Error(res.status + ' ' + msg);
          }
          var snap = JSON.parse(res.text);
          var r = window.CloudToolkitMerge.mergeRemoteIntoLocalStorage(snap);
          if (!r.ok) throw new Error(r.message || '合并失败');
          adminStatus.textContent = '已合并到本机，正在返回主界面…';
          setTimeout(function () {
            window.location.href = '../index.html';
          }, 400);
        })
        .catch(function (err) {
          adminStatus.textContent = '失败：' + (err.message || String(err));
        });
    });
  });
})();
