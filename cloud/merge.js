/**
 * 云快照合并工具（全局 window.CloudToolkitMerge）
 * - mergeRemoteIntoLocalSnap: 上传前把「线上同槽」合并进本地快照（同 id 以本地为准）
 * - mergeRemoteIntoLocalStorage: 拉取后写入本机 localStorage（文档按 lastModified 较新者胜）
 * - mergeAllSlotSnapshots: 合并 1..5 槽为一份（主持人全量）
 */
(function () {
  function safeArr(x) {
    return Array.isArray(x) ? x : [];
  }

  function mergeRemoteIntoLocalSnap(localSnap, remoteSnap) {
    if (!remoteSnap || typeof remoteSnap !== 'object') return localSnap;
    var local = localSnap && typeof localSnap === 'object' ? JSON.parse(JSON.stringify(localSnap)) : {};

    var docMap = {};
    safeArr(remoteSnap.documents).forEach(function (d) {
      if (d && d.id) docMap[d.id] = d;
    });
    safeArr(local.documents).forEach(function (d) {
      if (d && d.id) docMap[d.id] = d;
    });
    local.documents = Object.keys(docMap).map(function (k) {
      return docMap[k];
    });
    local.documents.sort(function (a, b) {
      return new Date(b.lastModified || 0) - new Date(a.lastModified || 0);
    });

    var lt = safeArr(local.teams)[0];
    var rt = safeArr(remoteSnap.teams)[0];
    if (lt && rt && lt.id === rt.id) {
      var memMap = {};
      safeArr(rt.members).forEach(function (m) {
        if (m && m.id) memMap[m.id] = m;
      });
      safeArr(lt.members).forEach(function (m) {
        if (m && m.id) memMap[m.id] = m;
      });
      lt.members = Object.keys(memMap).map(function (k) {
        return memMap[k];
      });
      local.teams = [lt];
    } else if (!lt && rt) {
      local.teams = safeArr(remoteSnap.teams);
    }

    var itemMap = {};
    safeArr(remoteSnap.items).forEach(function (i) {
      if (i && i.id) itemMap[i.id] = i;
    });
    safeArr(local.items).forEach(function (i) {
      if (i && i.id) itemMap[i.id] = i;
    });
    local.items = Object.keys(itemMap).map(function (k) {
      return itemMap[k];
    });

    var map = {};
    Object.assign(map, remoteSnap.mapPositions || {});
    Object.assign(map, local.mapPositions || {});
    local.mapPositions = map;

    local.updatedAt = new Date().toISOString();
    return local;
  }

  function mergeMember(a, b) {
    var o = Object.assign({}, a || {}, b || {});
    if (b && b.inventory) {
      if (a && a.inventory) {
        var invMap = {};
        safeArr(a.inventory).forEach(function (x) {
          if (x && x.itemId) invMap[x.itemId] = Object.assign({}, x);
        });
        safeArr(b.inventory).forEach(function (x) {
          if (x && x.itemId) {
            var prev = invMap[x.itemId];
            if (prev) {
              invMap[x.itemId] = Object.assign({}, prev, x, {
                quantity: (prev.quantity || 0) + (x.quantity || 0),
              });
            } else invMap[x.itemId] = Object.assign({}, x);
          }
        });
        o.inventory = Object.keys(invMap).map(function (k) {
          return invMap[k];
        });
      } else {
        o.inventory = safeArr(b.inventory).map(function (x) {
          return Object.assign({}, x);
        });
      }
    }
    return o;
  }

  function mergeTeamObj(oldT, newT) {
    var t = Object.assign({}, oldT || {}, newT || {});
    var memMap = {};
    safeArr(oldT && oldT.members).forEach(function (m) {
      if (m && m.id) memMap[m.id] = m;
    });
    safeArr(newT && newT.members).forEach(function (m) {
      if (m && m.id) {
        memMap[m.id] = mergeMember(memMap[m.id], m);
      }
    });
    t.members = Object.keys(memMap).map(function (k) {
      return memMap[k];
    });
    return t;
  }

  function mergeRemoteIntoLocalStorage(remoteSnap) {
    if (!remoteSnap || typeof remoteSnap !== 'object') return { ok: false, message: '无效快照' };

    function parseJson(raw, fb) {
      if (!raw) return fb;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return fb;
      }
    }

    var docs = parseJson(localStorage.getItem('adventure_logs_docs'), []);
    var docMap = {};
    docs.forEach(function (d) {
      if (d && d.id) docMap[d.id] = d;
    });
    safeArr(remoteSnap.documents).forEach(function (rd) {
      if (!rd || !rd.id) return;
      var old = docMap[rd.id];
      if (!old || new Date(rd.lastModified || 0) >= new Date(old.lastModified || 0)) docMap[rd.id] = rd;
    });
    var mergedDocs = Object.keys(docMap).map(function (k) {
      return docMap[k];
    });
    mergedDocs.sort(function (a, b) {
      return new Date(b.lastModified || 0) - new Date(a.lastModified || 0);
    });
    localStorage.setItem('adventure_logs_docs', JSON.stringify(mergedDocs));

    var teams = parseJson(localStorage.getItem('teams_data'), []);
    var teamMap = {};
    teams.forEach(function (t) {
      if (t && t.id) teamMap[t.id] = t;
    });
    safeArr(remoteSnap.teams).forEach(function (rt) {
      if (!rt || !rt.id) return;
      if (!teamMap[rt.id]) teamMap[rt.id] = rt;
      else teamMap[rt.id] = mergeTeamObj(teamMap[rt.id], rt);
    });
    localStorage.setItem(
      'teams_data',
      JSON.stringify(
        Object.keys(teamMap).map(function (k) {
          return teamMap[k];
        })
      )
    );

    var items = parseJson(localStorage.getItem('item_encyclopedia_data'), []);
    var itemMap = {};
    items.forEach(function (i) {
      if (i && i.id) itemMap[i.id] = i;
    });
    safeArr(remoteSnap.items).forEach(function (ri) {
      if (ri && ri.id) itemMap[ri.id] = ri;
    });
    localStorage.setItem(
      'item_encyclopedia_data',
      JSON.stringify(
        Object.keys(itemMap).map(function (k) {
          return itemMap[k];
        })
      )
    );

    var map = parseJson(localStorage.getItem('map_member_positions'), {});
    Object.assign(map, remoteSnap.mapPositions || {});
    localStorage.setItem('map_member_positions', JSON.stringify(map));

    if (typeof window.updateDocsList === 'function') window.updateDocsList();
    return { ok: true };
  }

  function mergeAllSlotSnapshots(slotToSnap) {
    var docMap = {};
    var teamMap = {};
    var itemMap = {};
    var mapPositions = {};
    var slots = ['1', '2', '3', '4', '5'];
    slots.forEach(function (slot) {
      var s = slotToSnap[slot];
      if (!s || typeof s !== 'object') return;
      safeArr(s.documents).forEach(function (d) {
        if (d && d.id) docMap[d.id] = d;
      });
      safeArr(s.teams).forEach(function (t) {
        if (t && t.id) teamMap[t.id] = t;
      });
      safeArr(s.items).forEach(function (i) {
        if (i && i.id) itemMap[i.id] = i;
      });
      Object.assign(mapPositions, s.mapPositions || {});
    });
    var documents = Object.keys(docMap).map(function (k) {
      return docMap[k];
    });
    documents.sort(function (a, b) {
      return new Date(b.lastModified || 0) - new Date(a.lastModified || 0);
    });
    return {
      v: 2,
      mode: 'merged_all_slots',
      updatedAt: new Date().toISOString(),
      documents: documents,
      teams: Object.keys(teamMap).map(function (k) {
        return teamMap[k];
      }),
      items: Object.keys(itemMap).map(function (k) {
        return itemMap[k];
      }),
      mapPositions: mapPositions,
    };
  }

  window.CloudToolkitMerge = {
    mergeRemoteIntoLocalSnap: mergeRemoteIntoLocalSnap,
    mergeRemoteIntoLocalStorage: mergeRemoteIntoLocalStorage,
    mergeAllSlotSnapshots: mergeAllSlotSnapshots,
  };
})();
