(function () {
  var STORAGE_DOCS = 'adventure_logs_docs';
  var STORAGE_TEAMS = 'teams_data';
  var STORAGE_ITEMS = 'item_encyclopedia_data';
  var STORAGE_MAP = 'map_member_positions';

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
      exportKind: 'player-submit-to-host',
      sourceLocalTeamId: teamId,
      documents: docs,
      teams: [team],
      items: loadItems(),
      mapPositions: mapFiltered,
    };
  }

  function sanitizeFilePart(s) {
    return String(s || '队伍')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80);
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

  function downloadJson(filename, text) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 2000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (sessionStorage.getItem('TOOLKIT_CLOUD_MODE') === '1') {
      alert('当前处于只读快照模式，请退出后再导出本机数据。');
    }

    var teamSelect = document.getElementById('exportLocalTeam');
    var uncatCb = document.getElementById('exportIncludeUncat');
    var statusEl = document.getElementById('exportStatus');
    var btn = document.getElementById('exportDoDownload');

    renderTeamSelect(teamSelect);

    btn.addEventListener('click', function () {
      statusEl.style.color = '#2c6e9e';
      statusEl.textContent = '';
      var teamId = teamSelect.value;
      if (!teamId) {
        statusEl.style.color = '#c0392b';
        statusEl.textContent = '请先选择队伍。';
        return;
      }
      var snap;
      try {
        snap = buildSnapshot(teamId, !!(uncatCb && uncatCb.checked));
      } catch (e) {
        statusEl.style.color = '#c0392b';
        statusEl.textContent = e.message || String(e);
        return;
      }
      var team = (snap.teams && snap.teams[0]) || {};
      var namePart = sanitizeFilePart(team.name || teamId);
      var datePart = (snap.updatedAt || '').slice(0, 10).replace(/-/g, '');
      var fn = '提交主持人_' + namePart + '_' + (datePart || 'export') + '.json';
      downloadJson(fn, JSON.stringify(snap, null, 2));
      statusEl.textContent = '已下载：' + fn;
    });
  });
})();
