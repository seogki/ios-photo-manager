import { ipcMain as E, dialog as nt, app as N, BrowserWindow as z, protocol as et, net as ot, nativeImage as at } from "electron";
import { fileURLToPath as st, pathToFileURL as it } from "node:url";
import u from "node:path";
import g from "node:fs/promises";
const J = u.dirname(st(import.meta.url));
process.env.APP_ROOT = u.join(J, "..");
const A = process.env.VITE_DEV_SERVER_URL, Lt = u.join(process.env.APP_ROOT, "dist-electron"), K = u.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = A ? u.join(process.env.APP_ROOT, "public") : K;
let f;
const k = /* @__PURE__ */ new Set([".heic", ".jpg", ".jpeg", ".png"]), F = /* @__PURE__ */ new Set([".mov", ".mp4", ".m4v"]), rt = 500, ct = 4, lt = 6, ut = 1024 * 1024, y = /* @__PURE__ */ new Map(), T = /* @__PURE__ */ new Map();
let M = 0;
const W = [];
function X() {
  f = new z({
    icon: u.join(process.env.VITE_PUBLIC, "app-icon.png"),
    autoHideMenuBar: !0,
    webPreferences: {
      preload: u.join(J, "preload.mjs")
    }
  }), f.webContents.on("did-finish-load", () => {
    f == null || f.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), A ? f.loadURL(A) : f.loadFile(u.join(K, "index.html"));
}
async function C(t) {
  const n = [t], e = [];
  for (; n.length > 0; ) {
    const o = n.pop();
    if (!o)
      continue;
    const s = await g.readdir(o, { withFileTypes: !0 });
    for (const i of s) {
      const a = u.join(o, i.name);
      if (i.isDirectory()) {
        n.push(a);
        continue;
      }
      i.isFile() && e.push(a);
    }
  }
  return e;
}
function G(t, n, e, o, s, i) {
  if (e !== 2 || o <= 0)
    return null;
  let a = s;
  o > 4 && (a = n + (i ? t.readUInt32LE(s) : t.readUInt32BE(s)));
  const c = Math.min(t.length, a + o);
  return a < 0 || a >= c ? null : t.toString("ascii", a, c).replace(/\0/g, "").trim() || null;
}
function O(t, n, e) {
  if (n < 0 || n + 7 >= t.length)
    return null;
  const o = e ? t.readUInt32LE(n) : t.readUInt32BE(n), s = e ? t.readUInt32LE(n + 4) : t.readUInt32BE(n + 4);
  return s === 0 ? null : o / s;
}
function Y(t, n, e, o) {
  const s = n + e, i = O(t, s, o), a = O(t, s + 8, o), c = O(t, s + 16, o);
  return i === null || a === null || c === null ? null : i + a / 60 + c / 3600;
}
function ht(t) {
  if (t.length < 4 || t[0] !== 255 || t[1] !== 216)
    return null;
  let n = 2;
  for (; n + 4 < t.length && t[n] === 255; ) {
    const e = t[n + 1];
    if (e === 218 || e === 217)
      break;
    const o = t.readUInt16BE(n + 2);
    if (o < 2 || n + 2 + o > t.length)
      break;
    if (e === 225) {
      const s = n + 4;
      if (t.toString("ascii", s, s + 6) !== "Exif\0\0") {
        n += 2 + o;
        continue;
      }
      const a = s + 6;
      if (a + 8 >= t.length)
        return null;
      const c = t.toString("ascii", a, a + 2), r = c === "II";
      if (!r && c !== "MM")
        return null;
      const p = (d) => r ? t.readUInt16LE(d) : t.readUInt16BE(d), h = (d) => r ? t.readUInt32LE(d) : t.readUInt32BE(d), l = a + h(a + 4);
      if (l + 1 >= t.length)
        return null;
      const w = p(l);
      let I = 0;
      for (let d = 0; d < w; d += 1) {
        const m = l + 2 + d * 12;
        if (m + 11 >= t.length)
          break;
        if (p(m) === 34853) {
          I = h(m + 8);
          break;
        }
      }
      if (!I)
        return null;
      const P = a + I;
      if (P + 1 >= t.length)
        return null;
      const tt = p(P);
      let j = "N", V = "E", R = null, U = null;
      for (let d = 0; d < tt; d += 1) {
        const m = P + 2 + d * 12;
        if (m + 11 >= t.length)
          break;
        const _ = p(m), b = p(m + 2), L = h(m + 4), x = m + 8, H = h(x);
        if (_ === 1) {
          const v = G(t, a, b, L, x, r);
          (v === "S" || v === "N") && (j = v);
        } else if (_ === 2 && b === 5 && L >= 3)
          R = Y(t, a, H, r);
        else if (_ === 3) {
          const v = G(t, a, b, L, x, r);
          (v === "W" || v === "E") && (V = v);
        } else
          _ === 4 && b === 5 && L >= 3 && (U = Y(t, a, H, r));
      }
      if (R === null || U === null)
        return null;
      const D = j === "S" ? -R : R, $ = V === "W" ? -U : U;
      return Number.isNaN(D) || Number.isNaN($) ? null : { latitude: D, longitude: $ };
    }
    n += 2 + o;
  }
  return null;
}
async function dt(t, n = 1024 * 1024) {
  const e = await g.open(t, "r");
  try {
    const s = (await e.stat()).size;
    if (s <= n * 2)
      return await e.readFile();
    const i = Buffer.allocUnsafe(n), a = Buffer.allocUnsafe(n);
    return await e.read(i, 0, n, 0), await e.read(a, 0, n, s - n), Buffer.concat([i, a]);
  } finally {
    await e.close();
  }
}
async function pt(t, n) {
  const e = await g.open(t, "r");
  try {
    const o = await e.stat(), s = Math.min(o.size, n), i = Buffer.allocUnsafe(s), { bytesRead: a } = await e.read(i, 0, s, 0);
    return i.subarray(0, a);
  } finally {
    await e.close();
  }
}
async function mt(t) {
  const o = (await dt(t)).toString("latin1").match(/([+-]\d{1,2}\.\d+)([+-]\d{1,3}\.\d+)\//);
  if (!o)
    return null;
  const s = Number.parseFloat(o[1]), i = Number.parseFloat(o[2]);
  return Number.isNaN(s) || Number.isNaN(i) || s < -90 || s > 90 || i < -180 || i > 180 ? null : { latitude: s, longitude: i };
}
async function ft(t) {
  const n = u.extname(t).toLowerCase();
  if (n === ".jpg" || n === ".jpeg") {
    const e = await pt(t, ut);
    return ht(e);
  }
  return n === ".mov" || n === ".mp4" || n === ".m4v" ? mt(t) : null;
}
async function gt(t, n, e) {
  if (t.length === 0)
    return [];
  const o = Math.max(1, Math.min(n, t.length)), s = new Array(t.length);
  let i = 0;
  const a = async () => {
    for (; ; ) {
      const c = i;
      if (i += 1, c >= t.length)
        return;
      s[c] = await e(t[c]);
    }
  };
  return await Promise.all(Array.from({ length: o }, () => a())), s;
}
function Q(t) {
  return t.filter((n) => {
    const e = u.extname(n).toLowerCase();
    return k.has(e) || F.has(e);
  });
}
async function Z(t, n) {
  const o = (await gt(
    n,
    lt,
    async (a) => {
      try {
        const c = await ft(a);
        if (!c)
          return null;
        const r = u.extname(a).toLowerCase();
        return {
          filePath: a,
          type: F.has(r) ? "video" : "photo",
          latitude: c.latitude,
          longitude: c.longitude
        };
      } catch {
        return null;
      }
    }
  )).filter((a) => a !== null);
  let s = 0, i = 0;
  for (const a of o)
    a.type === "video" ? i += 1 : s += 1;
  return {
    folder: t,
    totalCandidates: n.length,
    located: o.length,
    locatedPhotos: s,
    locatedVideos: i,
    items: o
  };
}
function S(t, n) {
  const e = /* @__PURE__ */ new Map();
  for (const c of n) {
    const r = u.extname(c).toLowerCase();
    if (!k.has(r) && !F.has(r))
      continue;
    const h = u.parse(c).name.toLowerCase(), l = e.get(h) ?? { photos: [], videos: [] };
    k.has(r) ? l.photos.push(c) : l.videos.push(c), e.set(h, l);
  }
  const o = [], s = [];
  let i = 0, a = 0;
  for (const [c, r] of e.entries()) {
    const p = Math.min(r.photos.length, r.videos.length);
    for (let l = 0; l < p; l += 1)
      o.push({
        photoPath: r.photos[l],
        videoPath: r.videos[l]
      });
    const h = Math.max(r.photos.length, r.videos.length);
    for (let l = 0; l < h; l += 1) {
      const w = r.photos[l], I = r.videos[l], P = w ?? I;
      P && s.push({
        id: `${c}:${l}`,
        baseName: u.parse(P).name,
        photoPath: w,
        videoPath: I
      });
    }
    r.photos.length > r.videos.length ? i += r.photos.length - r.videos.length : r.videos.length > r.photos.length && (a += r.videos.length - r.photos.length);
  }
  return {
    scan: {
      folder: t,
      totalFiles: n.length,
      pairCount: o.length,
      orphanPhotos: i,
      orphanVideos: a,
      previews: s
    },
    pairs: o
  };
}
async function wt(t) {
  const n = await C(t);
  return S(t, n).scan;
}
async function vt(t) {
  const n = await C(t);
  return Z(t, Q(n));
}
async function yt(t) {
  const n = await C(t), e = S(t, n), o = await Z(t, Q(n));
  return {
    scan: e.scan,
    locations: o
  };
}
async function Et(t) {
  M >= ct && await new Promise((n) => {
    W.push(n);
  }), M += 1;
  try {
    return await t();
  } finally {
    M -= 1;
    const n = W.shift();
    n && n();
  }
}
function q(t, n) {
  if (y.has(t) && y.delete(t), y.set(t, n), y.size > rt) {
    const e = y.keys().next().value;
    typeof e == "string" && y.delete(e);
  }
}
async function B(t, n, e) {
  const o = `${t}::${n}x${e}`, s = y.get(o);
  if (s)
    return s;
  const i = T.get(o);
  if (i)
    return i;
  const a = Et(async () => {
    try {
      const c = await at.createThumbnailFromPath(t, { width: n, height: e }), r = c.isEmpty() ? { ok: !1, reason: "thumbnail-empty" } : { ok: !0, dataUrl: c.toDataURL() };
      return q(o, r), r;
    } catch {
      const c = { ok: !1, reason: "thumbnail-failed" };
      return q(o, c), c;
    }
  }).finally(() => {
    T.delete(o);
  });
  return T.set(o, a), a;
}
function It() {
  et.handle("local-media", (t) => {
    const e = new URL(t.url).searchParams.get("path");
    if (!e)
      return new Response("Missing path query", { status: 400 });
    const o = decodeURIComponent(e);
    return ot.fetch(it(o).toString());
  });
}
async function Pt(t) {
  let n = t, e = 1, o = !0;
  for (; o; )
    try {
      await g.access(n);
      const s = u.extname(t), i = u.basename(t, s), a = u.dirname(t);
      n = u.join(a, `${i} (${e})${s}`), e += 1;
    } catch {
      o = !1;
    }
  return n;
}
E.handle("live-photo:pick-folder", async () => {
  const t = await nt.showOpenDialog({
    properties: ["openDirectory"]
  });
  return t.canceled || t.filePaths.length === 0 ? null : t.filePaths[0];
});
E.handle("live-photo:scan", async (t, n) => wt(n));
E.handle("live-photo:analyze-folder", async (t, n) => yt(n));
E.handle("live-photo:media-locations", async (t, n) => vt(n));
E.handle(
  "live-photo:file-thumbnail",
  async (t, n) => {
    const { filePath: e, width: o = 480, height: s = 270 } = n;
    return B(e, o, s);
  }
);
E.handle("live-photo:video-thumbnail", async (t, n) => B(n, 480, 270));
E.handle(
  "live-photo:process",
  async (t, n) => {
    const { folder: e, action: o } = n, s = await C(e), i = S(e, s), a = [];
    let c;
    o === "move-video" && (c = u.join(e, "_livephoto_videos"), await g.mkdir(c, { recursive: !0 }));
    let r = 0;
    for (const h of i.pairs)
      try {
        if (o === "delete-video")
          await g.unlink(h.videoPath);
        else if (c) {
          const l = u.relative(e, h.videoPath), w = await Pt(u.join(c, l));
          await g.mkdir(u.dirname(w), { recursive: !0 }), await g.rename(h.videoPath, w);
        }
        r += 1;
      } catch (l) {
        a.push({
          filePath: h.videoPath,
          reason: l instanceof Error ? l.message : "Unknown error"
        });
      }
    return {
      folder: e,
      action: o,
      processed: r,
      failed: a,
      movedTo: c
    };
  }
);
N.on("window-all-closed", () => {
  process.platform !== "darwin" && (N.quit(), f = null);
});
N.on("activate", () => {
  z.getAllWindows().length === 0 && X();
});
N.whenReady().then(() => {
  It(), X();
});
export {
  Lt as MAIN_DIST,
  K as RENDERER_DIST,
  A as VITE_DEV_SERVER_URL
};
