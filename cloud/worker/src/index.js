/**
 * ChaosWorldToolkit 云快照 Worker
 * POST /api/upload  Header: X-Write-Key  Body: JSON 快照
 * GET  /api/snapshot?token=只读令牌
 * GET  /api/snapshot/all?token=ADMIN_READ_TOKEN（合并 snap:1..5，主持人）
 *
 * TEAMS_CONFIG: {"1":{"writeKey","readToken"},...,"5":{...}}
 * ADMIN_READ_TOKEN: 可选，未设置则 /api/snapshot/all 返回 503
 */

function corsHeaders(originAllowed, requestOrigin) {
  const o =
    originAllowed === '*' || !originAllowed
      ? '*'
      : requestOrigin && originAllowed.split(',').map((s) => s.trim()).includes(requestOrigin)
        ? requestOrigin
        : originAllowed.split(',')[0].trim();
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Write-Key',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(obj, status, env, request) {
  const origin = request.headers.get('Origin') || '';
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(env.ALLOWED_ORIGIN || '*', origin),
    },
  });
}

function parseTeamsConfig(env) {
  const raw = env.TEAMS_CONFIG;
  if (!raw || typeof raw !== 'string') return null;
  try {
    const cfg = JSON.parse(raw);
    if (!cfg || typeof cfg !== 'object') return null;
    return cfg;
  } catch {
    return null;
  }
}

function slotByWriteKey(cfg, writeKey) {
  if (!writeKey || !cfg) return null;
  for (let i = 1; i <= 5; i++) {
    const k = String(i);
    const t = cfg[k];
    if (t && t.writeKey === writeKey) return k;
  }
  return null;
}

function slotByReadToken(cfg, readToken) {
  if (!readToken || !cfg) return null;
  for (let i = 1; i <= 5; i++) {
    const k = String(i);
    const t = cfg[k];
    if (t && t.readToken === readToken) return k;
  }
  return null;
}

function safeArr(x) {
  return Array.isArray(x) ? x : [];
}

function mergeAllSlotSnapshotsFromStrings(slotToRaw) {
  const docMap = {};
  const teamMap = {};
  const itemMap = {};
  let mapPositions = {};
  const slots = ['1', '2', '3', '4', '5'];
  for (const slot of slots) {
    const raw = slotToRaw[slot];
    if (!raw || typeof raw !== 'string') continue;
    let s;
    try {
      s = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!s || typeof s !== 'object') continue;
    safeArr(s.documents).forEach((d) => {
      if (d && d.id) docMap[d.id] = d;
    });
    safeArr(s.teams).forEach((t) => {
      if (t && t.id) teamMap[t.id] = t;
    });
    safeArr(s.items).forEach((i) => {
      if (i && i.id) itemMap[i.id] = i;
    });
    Object.assign(mapPositions, s.mapPositions || {});
  }
  const documents = Object.values(docMap).sort(
    (a, b) => new Date(b.lastModified || 0) - new Date(a.lastModified || 0)
  );
  return {
    v: 2,
    mode: 'merged_all_slots',
    updatedAt: new Date().toISOString(),
    documents,
    teams: Object.values(teamMap),
    items: Object.values(itemMap),
    mapPositions,
  };
}

const MAX_BODY_BYTES = 18 * 1024 * 1024;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env.ALLOWED_ORIGIN || '*', origin),
      });
    }

    const url = new URL(request.url);
    const cfg = parseTeamsConfig(env);
    if (!cfg) {
      return jsonResponse({ error: 'TEAMS_CONFIG 未配置' }, 500, env, request);
    }

    if (url.pathname === '/api/upload' && request.method === 'POST') {
      const writeKey = request.headers.get('X-Write-Key') || '';
      const slot = slotByWriteKey(cfg, writeKey);
      if (!slot) {
        return jsonResponse({ error: '无效的写入密钥' }, 401, env, request);
      }
      const ct = request.headers.get('Content-Type') || '';
      if (!ct.includes('application/json')) {
        return jsonResponse({ error: '需要 Content-Type: application/json' }, 400, env, request);
      }
      const buf = await request.arrayBuffer();
      if (buf.byteLength > MAX_BODY_BYTES) {
        return jsonResponse({ error: '请求体过大' }, 413, env, request);
      }
      const text = new TextDecoder().decode(buf);
      try {
        JSON.parse(text);
      } catch {
        return jsonResponse({ error: 'Body 不是合法 JSON' }, 400, env, request);
      }
      const key = `snap:${slot}`;
      await env.SNAPSHOT.put(key, text);
      return jsonResponse({ ok: true, slot, savedAt: new Date().toISOString() }, 200, env, request);
    }

    if (url.pathname === '/api/snapshot/all' && request.method === 'GET') {
      const adminTok = env.ADMIN_READ_TOKEN;
      if (!adminTok || typeof adminTok !== 'string') {
        return jsonResponse({ error: '未配置主持人全量令牌 ADMIN_READ_TOKEN' }, 503, env, request);
      }
      const token = url.searchParams.get('token') || '';
      if (token !== adminTok) {
        return jsonResponse({ error: '无效的主持人令牌' }, 401, env, request);
      }
      const slotToRaw = {};
      for (let i = 1; i <= 5; i++) {
        const k = String(i);
        slotToRaw[k] = await env.SNAPSHOT.get(`snap:${k}`);
      }
      const merged = mergeAllSlotSnapshotsFromStrings(slotToRaw);
      const body = JSON.stringify(merged);
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...corsHeaders(env.ALLOWED_ORIGIN || '*', origin),
        },
      });
    }

    if (url.pathname === '/api/snapshot' && request.method === 'GET') {
      const token = url.searchParams.get('token') || '';
      const slot = slotByReadToken(cfg, token);
      if (!slot) {
        return jsonResponse({ error: '无效的只读令牌' }, 401, env, request);
      }
      const key = `snap:${slot}`;
      const data = await env.SNAPSHOT.get(key);
      if (data === null) {
        return jsonResponse({ error: '该队伍尚无快照' }, 404, env, request);
      }
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...corsHeaders(env.ALLOWED_ORIGIN || '*', origin),
        },
      });
    }

    if (url.pathname === '/' || url.pathname === '') {
      return jsonResponse(
        {
          service: 'ChaosWorldToolkit snapshot',
          upload: '/api/upload',
          snapshot: '/api/snapshot?token=',
          snapshotAll: '/api/snapshot/all?token=ADMIN_READ_TOKEN',
        },
        200,
        env,
        request
      );
    }

    return jsonResponse({ error: 'Not Found' }, 404, env, request);
  },
};
