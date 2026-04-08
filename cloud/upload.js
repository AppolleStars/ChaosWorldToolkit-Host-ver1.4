/* global CLOUD_WORKER_BASE, CloudToolkitMerge */
(function () {
  var STORAGE_DOCS = 'adventure_logs_docs';
  var STORAGE_TEAMS = 'teams_data';
  var STORAGE_ITEMS = 'item_encyclopedia_data';
  var STORAGE_MAP = 'map_member_positions';
  var LS_MERGE_READ = 'cloud_merge_read_token';

  function workerBase() {
    var b = typeof window.CLOUD_WORKER_BASE === 'string' ? window.CLOUD_WORKER_BASE.trim() : '';
    return b.replace(/\/$/, '');
  }

  function parseJson(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function loadTeams() {
    return parseJson(localStorage.getItem(STORAGE_TEAMS), []);
  }

  function loadDocs() {
    return parseJson(localStorage.getItem(STORAGE_DOCS), []);
  }

  function loadItems() {
    return parseJson(localStorage.getItem(STORAGE_ITEMS), []);
  }

  function loadMap() {
    return parseJson(localStorage.getItem(STORAGE_MAP), {});
  }

  function buildSnapshot(teamId, includeUncategorized) {
    var teams = loadTeams();
    var team = teams.find(function (t) {
      return t.id === teamId;
    });
    if (!team) {
      throw new Error('未找到所选队伍');
    }
    var memberIds = (team.members || []).map(function (m) {
      return m.id;
    });
    var docs = loadDocs().filter(function (d) {
      if (d.teamId === teamId) return true;
      if (includeUncategorized && (d.teamId === null || d.teamId === undefined || d.teamId === '')) {
        return true;
      }
      return false;
    });
    var mapFull = loadMap();
    var mapFiltered = {};
    memberIds.forEach(function (mid) {
      if (mapFull[mid] !== undefined) mapFiltered[mid] = mapFull[mid];
    });
    return {
      v: 1,
      updatedAt: new Date().toISOString(),
      cloudTeamSlotNote: '由本地队伍 id 生成，与 Worker 槽位通过写入密钥对应',
      sourceLocalTeamId: teamId,
      documents: docs,
      teams: [team],
      items: loadItems(),
      mapPositions: mapFiltered,
    };
  }

  function persistSettings(base, writeKey, mergeRead) {
    try {
      if (base) localStorage.setItem('cloud_worker_base', base);
      if (writeKey !== undefined && writeKey !== null) localStorage.setItem('cloud_write_key', writeKey);
      if (mergeRead !== undefined && mergeRead !== null) localStorage.setItem(LS_MERGE_READ, mergeRead);
    } catch (e) {}
  }

  function loadSettings() {
    try {
      return {
        base: localStorage.getItem('cloud_worker_base') || '',
        writeKey: localStorage.getItem('cloud_write_key') || '',
        mergeRead: localStorage.getItem(LS_MERGE_READ) || '',
      };
    } catch (e) {
      return { base: '', writeKey: '', mergeRead: '' };
    }
  }

  function renderTeamSelect(selectEl) {
    var teams = loadTeams();
    selectEl.innerHTML = '';
    if (!teams.length) {
      selectEl.innerHTML = '<option value="">（请先在「队伍管理」中创建队伍）</option>';
      return;
    }
    teams.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name + ' (' + (t.members && t.members.length ? t.members.length + ' 名队员' : '无队员') + ')';
      selectEl.appendChild(opt);
    });
  }

  function fetchRemoteSnapshot(base, readToken) {
    var url = base + '/api/snapshot?token=' + encodeURIComponent(readToken);
    return fetch(url).then(function (r) {
      return r.text().then(function (t) {
        return { ok: r.ok, status: r.status, text: t };
      });
    });
  }

  function postUpload(base, writeKey, body) {
    return fetch(base + '/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Write-Key': writeKey,
      },
      body: body,
    }).then(function (r) {
      return r.text().then(function (t) {
        return { ok: r.ok, status: r.status, text: t };
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (sessionStorage.getItem('TOOLKIT_CLOUD_MODE') === '1') {
      alert('当前处于云快照只读模式，请先退出后再上传。');
    }

    var baseInput = document.getElementById('cloudWorkerBase');
    var keyInput = document.getElementById('cloudWriteKey');
    var teamSelect = document.getElementById('cloudLocalTeam');
    var uncatCb = document.getElementById('cloudIncludeUncat');
    var mergeCb = document.getElementById('cloudMergeBeforeUpload');
    var mergeReadInput = document.getElementById('cloudMergeReadToken');
    var statusEl = document.getElementById('cloudUploadStatus');
    var btn = document.getElementById('cloudDoUpload');

    var saved = loadSettings();
    var confBase = workerBase();
    baseInput.value = saved.base || confBase || '';
    keyInput.value = saved.writeKey || '';
    if (mergeReadInput) mergeReadInput.value = saved.mergeRead || '';

    renderTeamSelect(teamSelect);

    btn.addEventListener('click', function () {
      statusEl.textContent = '';
      var base = (baseInput.value || '').trim().replace(/\/$/, '');
      var writeKey = (keyInput.value || '').trim();
      var teamId = teamSelect.value;
      var mergeRead = mergeReadInput ? (mergeReadInput.value || '').trim() : '';

      if (!base) {
        statusEl.textContent = '请填写 Worker 地址，或在 cloud/config.local.js 中设置 CLOUD_WORKER_BASE。';
        return;
      }
      if (!writeKey) {
        statusEl.textContent = '请填写写入密钥（与 Worker TEAMS_CONFIG 中对应队伍的 writeKey 一致）。';
        return;
      }
      if (!teamId) {
        statusEl.textContent = '请选择要打包上传的本地队伍。';
        return;
      }
      if (mergeCb && mergeCb.checked) {
        if (!mergeRead) {
          statusEl.textContent = '已勾选合并上传：请填写本槽位的只读令牌。';
          return;
        }
      }

      var snap;
      try {
        snap = buildSnapshot(teamId, !!(uncatCb && uncatCb.checked));
      } catch (e) {
        statusEl.textContent = e.message || String(e);
        return;
      }

      persistSettings(base, writeKey, mergeRead);

      function doPost(finalSnap) {
        statusEl.textContent = '正在上传…';
        return postUpload(base, writeKey, JSON.stringify(finalSnap)).then(function (_ref) {
          if (!_ref.ok) {
            var errMsg = _ref.text;
            try {
              var j = JSON.parse(_ref.text);
              if (j.error) errMsg = j.error;
            } catch (e) {}
            throw new Error(_ref.status + ' ' + errMsg);
          }
          try {
            var j2 = JSON.parse(_ref.text);
            statusEl.textContent = '上传成功：槽位 ' + (j2.slot || '?') + '，' + (j2.savedAt || '');
          } catch (e2) {
            statusEl.textContent = '上传成功';
          }
        });
      }

      if (mergeCb && mergeCb.checked && window.CloudToolkitMerge) {
        statusEl.textContent = '正在拉取云端并合并…';
        fetchRemoteSnapshot(base, mergeRead)
          .then(function (res) {
            if (!res.ok) {
              var msg = res.text;
              try {
                var je = JSON.parse(res.text);
                if (je.error) msg = je.error;
              } catch (e) {}
              throw new Error(res.status + ' ' + msg);
            }
            var remote = JSON.parse(res.text);
            var merged = window.CloudToolkitMerge.mergeRemoteIntoLocalSnap(snap, remote);
            return doPost(merged);
          })
          .catch(function (err) {
            statusEl.textContent = '失败：' + (err.message || String(err));
          });
      } else if (mergeCb && mergeCb.checked && !window.CloudToolkitMerge) {
        statusEl.textContent = '缺少 merge.js，无法合并。';
      } else {
        doPost(snap).catch(function (err) {
          statusEl.textContent = '失败：' + (err.message || String(err));
        });
      }
    });
  });
})();
