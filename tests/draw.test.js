// 執行：node tests/draw.test.js
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const DATA = require("../data.js");
const L = require("../logic.js")(DATA);

// 簡單可重現的亂數（mulberry32）
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let checks = 0;
const ok = (c, m) => { assert(c, m); checks++; };
const eq = (a, b, m) => { assert.strictEqual(a, b, m); checks++; };

const TOTAL = 81;
const S1IDS = (st) => st.collected.map((c) => c.id).filter((id) => L.byId[id].season === "s1");
const s1 = DATA.items.filter((i) => i.season === "s1");
const royals = s1.filter((i) => i.category === "royal");
const princesses = s1.filter((i) => i.type === "princess");
const stills = s1.filter((i) => i.type === "still");
const FINAL = "s1-m-24";

// ---- 資料檢查 ----
eq(s1.length, TOTAL, "第一季 81 張");
eq(L.season("s1").total, TOTAL, "seasons.total = 81");
eq(s1.filter((i) => i.type === "momoke").length, 24);
eq(s1.filter((i) => i.category === "magic").length, 18, "18 魔方萌可");
eq(princesses.length, 5);
eq(stills.length, 52);
assert.deepStrictEqual(royals.map((r) => r.name), ["愛心萌可", "正正萌可", "勇氣萌可", "盼盼萌可", "唱唱萌可"]);
const pairs = { "愛心萌可": "愛心公主", "正正萌可": "正義公主", "勇氣萌可": "勇氣公主", "盼盼萌可": "希望公主", "唱唱萌可": "音樂公主" };
royals.forEach((r) => {
  eq(L.byId[r.princess].name, pairs[r.name]);
  eq(L.byId[r.princess].royal, r.id);
});
eq(L.byId[FINAL].name, "鬧鬧萌可");
eq(L.season("s1").finalItem, FINAL);
eq(new Set(DATA.items.map((i) => i.id)).size, DATA.items.length, "id 不重複");
// 劇照：按集數、a/b 排列；名稱/說明與 blurbs.json 完全一致；圖片檔存在
const V2 = "/workspace/momoke/images/s1_stills_v2";
const expectFiles = [];
for (let e = 1; e <= 26; e++) for (const ab of ["a", "b"]) expectFiles.push(`ep${String(e).padStart(2, "0")}_${ab}.jpg`);
assert.deepStrictEqual(stills.map((s) => path.basename(s.img)), expectFiles, "劇照次序：集數再 a/b");
stills.forEach((s) => ok(fs.existsSync(path.join(__dirname, "..", s.img)), "圖片存在 " + s.img));
s1.forEach((s) => ok(s.img && fs.existsSync(path.join(__dirname, "..", s.img)), "圖片存在 " + s.img));
if (fs.existsSync(V2)) {
  const blurbs = JSON.parse(fs.readFileSync(path.join(V2, "blurbs.json"), "utf8"));
  const byFile = Object.fromEntries(blurbs.map((b) => [b.file, b]));
  stills.forEach((s) => {
    const b = byFile[path.basename(s.img)];
    ok(b, "blurbs.json 有 " + s.img);
    eq(s.name, b.title, "name = title " + s.img);
    eq(s.blurb, b.blurb, "blurb = blurb " + s.img);
    eq(s.intro, b.intro, "intro = intro " + s.img);
  });
  // 舊劇照對應：與 manifest.json 的 reused_existing 一致
  const manifest = JSON.parse(fs.readFileSync(path.join(V2, "manifest.json"), "utf8"));
  const oldSrc = { "s1-still-01": "01_ep01_litv.jpg", "s1-still-02": "02_ep02_tx.jpg", "s1-still-03": "03_ep03_litv.jpg",
    "s1-still-04": "backup_02_ep07_tx.jpg", "s1-still-05": "05_ep07_iq.jpg", "s1-still-06": "06_ep13_litv.jpg",
    "s1-still-07": "07_ep14_litv.jpg", "s1-still-08": "08_ep16_tx.jpg", "s1-still-09": "09_ep20_litv.jpg", "s1-still-10": "10_ep23_tx.jpg" };
  Object.entries(oldSrc).forEach(([oldId, src]) => {
    const m = manifest.find((x) => x.reused_existing === src);
    ok(m, "manifest 有沿用 " + src);
    eq(path.basename(L.byId[DATA.legacyIds[oldId]].img), m.file, oldId + " → " + m.file);
  });
  console.log("✓ 劇照名稱 / 說明與 blurbs.json 一致，舊劇照對應與 manifest.json 一致");
}
console.log("✓ 資料檢查（81 張 = 24 萌可 + 5 公主 + 52 劇照）");

// ---- 抽卡順序檢查（共用） ----
function checkSequence(seq, label) {
  eq(seq.length, TOTAL, label + "：共 81 張");
  eq(new Set(seq).size, TOTAL, label + "：81 張都不重複");
  eq(seq[0], "s1-m-01", label + "：第 1 張是愛心萌可");
  eq(seq[1], "s1-p-01", label + "：第 2 張是愛心公主");
  eq(seq[TOTAL - 1], FINAL, label + "：第 81 張是鬧鬧萌可");
  royals.forEach((ro) => {
    const i = seq.indexOf(ro.id);
    eq(seq[i + 1], ro.princess, label + "：" + ro.name + " 之後緊接其公主");
    ok(i + 1 < TOTAL - 1, label + "：公主在鬧鬧之前");
  });
  princesses.forEach((p) => eq(seq[seq.indexOf(p.id) - 1], p.royal, label + "：" + p.name + " 前面是對應的皇室萌可"));
}

// ---- 抽卡模擬（drawNextS1 直接模擬） ----
const RUNS = 20000;
const positionHist = {};
let maxRoyalPos = 0, forcedRuns = 0;
for (let run = 0; run < RUNS; run++) {
  const r = rng(run + 1);
  const seq = [];
  for (;;) {
    const id = L.drawNextS1(seq, r);
    if (!id) break;
    seq.push(id);
    assert(seq.length <= TOTAL, "不可多於 81 張");
  }
  checkSequence(seq, "模擬 " + run);
  royals.forEach((ro) => { maxRoyalPos = Math.max(maxRoyalPos, seq.indexOf(ro.id) + 2); });
  if (royals.some((ro) => seq.indexOf(ro.princess) === TOTAL - 2)) forcedRuns++;
  seq.forEach((id, i) => { (positionHist[id] = positionHist[id] || []).push(i + 1); });
}
console.log(`✓ 抽卡模擬 ${RUNS} 次全部通過（皇室萌可 + 公主最遲在第 ${maxRoyalPos} 張，${forcedRuns} 次最後一對在第 79–80 張）`);
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log("  平均出現位置：" + ["s1-m-02", "s1-m-05", "s1-m-10", "s1-still-ep01a", "s1-still-ep26b"].map((id) => L.byId[id].name + "(" + id + ") " + avg(positionHist[id])).join("，"));

// 極端亂數（永遠 0 / 永遠接近 1）也要守規則（測試強制抽皇室萌可）
for (const fixed of [0, 0.999999, 0.5]) {
  const seq = [];
  for (let id; (id = L.drawNextS1(seq, () => fixed));) seq.push(id);
  checkSequence(seq, "固定亂數 " + fixed);
}
console.log("✓ 極端亂數（強制抽皇室萌可的情況）");

// ---- 日子 / 時段 ----
const T = (s) => new Date(s).getTime();
eq(L.dayKey(T("2026-09-26T03:59")), "2026-09-25");
eq(L.dayKey(T("2026-09-26T04:00")), "2026-09-26");
eq(L.dayKey(T("2026-10-01T01:00")), "2026-09-30");
eq(L.dayKey(T("2026-01-01T02:00")), "2025-12-31");
eq(L.slotOf(T("2026-09-26T03:59")), "evening");
eq(L.slotOf(T("2026-09-26T04:00")), "morning");
eq(L.slotOf(T("2026-09-26T11:59")), "morning");
eq(L.slotOf(T("2026-09-26T12:00")), null);
eq(L.slotOf(T("2026-09-26T16:59")), null);
eq(L.slotOf(T("2026-09-26T17:00")), "evening");
console.log("✓ 日子與時段");

// ---- 新的得卡規則：每次在時段內完整刷牙 = 一張卡，每時段最多一張 ----
{
  const st = L.emptyState();
  const R = rng(7);
  const rec = (s) => L.recordBrush(st, T(s), T(s) + 120000, R);
  let r = rec("2026-09-26T08:00");
  eq(r.kind, "capture", "早上刷牙得卡"); eq(r.item.id, "s1-m-01"); eq(r.number, 1); eq(r.slot, "morning");
  eq(rec("2026-09-26T09:00").kind, "again", "同一早上第二次不得卡");
  eq(rec("2026-09-26T14:00").kind, "outside", "時段外不得卡");
  r = rec("2026-09-26T21:00");
  eq(r.kind, "capture", "晚上刷牙得卡"); eq(r.item.id, "s1-p-01", "第 2 張愛心公主"); eq(r.number, 2);
  eq(rec("2026-09-26T22:00").kind, "again", "同一晚上第二次不得卡");
  eq(rec("2026-09-27T02:00").kind, "again", "凌晨 02:00 屬前一天晚上");
  eq(st.collected.length, 2);
  eq(L.cardsOnDay(st.days["2026-09-26"]), 2, "一天最多兩張");
  eq(st.days["2026-09-26"].x, 1);
  // 漏了早上：晚上照樣得卡（不再重設）
  r = rec("2026-09-27T20:00");
  eq(r.kind, "capture", "漏早上，晚上仍得卡"); eq(st.collected.length, 3);
  // 只有早上
  r = rec("2026-09-28T07:00"); eq(r.kind, "capture");
  eq(st.collected.length, 4);
  // 凌晨 01:00 的晚上刷牙屬於前一天
  r = rec("2026-09-30T01:00"); eq(r.kind, "capture"); eq(r.day, "2026-09-29"); eq(r.slot, "evening");
  eq(st.collected[4].s, "e");
  console.log("✓ 得卡規則（早上/晚上/時段外/同時段第二次/漏刷/凌晨歸前一天）");

  // ---- 刷牙開始時決定卡片；中途停止沿用同一張 ----
  const p1 = L.planBrush(st, T("2026-09-30T08:00"), rng(99));
  ok(p1.earn && p1.slot === "morning", "planBrush: 早上可得卡");
  eq(st.pending.id, p1.id, "pending 已保存");
  const saved = JSON.parse(JSON.stringify(st));
  const st2 = L.normalizeState(saved);
  eq(st2.pending.id, p1.id, "pending 經過儲存/讀取後保留");
  for (let i = 0; i < 20; i++) eq(L.planBrush(st2, T("2026-09-30T08:05"), rng(1000 + i)).id, p1.id, "停止後再開始：同一張");
  eq(L.planBrush(st2, T("2026-09-30T19:00"), rng(5)).id, p1.id, "改在晚上再試：仍是同一張");
  r = L.recordBrush(st2, T("2026-09-30T08:05"), T("2026-09-30T08:07"), rng(3));
  eq(r.item.id, p1.id, "完成時得到的就是 pending 那張"); eq(st2.pending, null);
  const pa = L.planBrush(st2, T("2026-09-30T09:00"));
  ok(!pa.earn && pa.reason === "already", "planBrush: 同時段已得卡");
  eq(st2.pending, null, "不得卡時不抽 pending");
  const po = L.planBrush(st2, T("2026-09-30T13:00"));
  ok(!po.earn && po.reason === "outside", "planBrush: 時段外");
  // pending 失效（收集數量改變）會重抽
  const st3 = L.normalizeState(saved); st3.pending.n = 99;
  eq(L.normalizeState(st3).pending, null, "失效的 pending 被清除");
  console.log("✓ 開始刷牙時決定卡片、停止後沿用同一張");

  // ---- 補齊到 81 張（每天兩張 ≈ 41 天）----
  let d = new Date(2026, 9, 1), last, days = 0;
  const firstDay = st2.collected.length;
  while (L.collectedIn(st2, "s1").length < TOTAL) {
    const k = L.ymd(d);
    for (const hm of ["T07:00", "T20:00"]) {
      if (L.collectedIn(st2, "s1").length >= TOTAL) break;
      const pl = L.planBrush(st2, T(k + hm), Math.random);
      ok(pl.earn, "未集齊時可得卡");
      last = L.recordBrush(st2, T(k + hm), T(k + hm) + 120000, Math.random);
      eq(last.item.id, pl.id, "得到的卡 = 開始時決定的卡");
    }
    d.setDate(d.getDate() + 1); days++;
  }
  eq(last.item.id, FINAL, "最後一張是鬧鬧萌可");
  eq(last.number, TOTAL);
  eq(last.seasonComplete, "s1");
  checkSequence(S1IDS(st2), "完整流程");
  // 第一季集齊的同一刻，第二季的第 1 張（幸福萌可）已直接送出
  eq(st2.collected.length, TOTAL + 1, "集齊第一季後多了第二季第 1 張");
  eq(st2.collected[TOTAL].id, "s2-m-01"); eq(last.unlock.item.id, "s2-m-01"); eq(L.pendingNews(st2), "s2");
  eq(L.normalizeState(JSON.parse(JSON.stringify(st2))).collected.length, TOTAL + 1);
  eq(L.normalizeState({ foo: 1 }), null);
  console.log(`✓ 完整流程集齊 81 張（由第 ${firstDay + 1} 張起用了 ${days} 天，每天最多兩張）`);
  eq(Math.ceil(TOTAL / 2), 41, "約 41 天");
}

// ---- 隨機模擬實際使用（漏刷、時段外、中途停止）----
{
  for (let run = 0; run < 3000; run++) {
    const R = rng(50000 + run);
    const st = L.emptyState();
    let d = new Date(2026, 9, 1), guard = 0;
    while (L.collectedIn(st, "s1").length < TOTAL && guard++ < 400) {
      const k = L.ymd(d);
      for (const hm of ["T07:00", "T13:00", "T20:00", "T21:00"]) {
        if (R() < 0.3) continue; // 漏刷
        const t = T(k + hm);
        const before = st.collected.length;
        const pl = L.planBrush(st, t, R);
        if (R() < 0.2) continue; // 中途停止：不記錄，pending 保留
        const res = L.recordBrush(st, t, t + 120000, R);
        const gift = res.unlock ? 1 : 0; // 集齊第一季的那一刻，第二季第 1 張一起送出
        if (pl.earn) { eq(res.kind, "capture"); eq(res.item.id, pl.id); eq(st.collected.length, before + 1 + gift); }
        else eq(st.collected.length, before, "不得卡的刷牙不增加卡片");
      }
      ok(L.cardsOnDay(st.days[k]) <= 2, "每天最多兩張");
      d.setDate(d.getDate() + 1);
    }
    checkSequence(S1IDS(st), "使用模擬 " + run);
  }
  console.log("✓ 使用模擬 3000 次（隨機漏刷 / 時段外 / 中途停止）全部符合抽卡規則");
}

// ---- 舊資料轉換（schema 1 → 2）----
{
  const NOW = T("2026-09-26T21:30");
  // 舊資料：9/24 捕捉愛心萌可，9/25 捕捉愛心公主，今天(9/26) 早上已刷、晚上未刷（舊規則：還差晚上）
  // 另有一張舊劇照 s1-still-04（→ ep07_a）
  const old = {
    schema: 1,
    days: {
      "2026-09-23": { m: T("2026-09-23T08:02"), e: null, cap: null, x: 0 },
      "2026-09-24": { m: T("2026-09-24T08:02"), e: T("2026-09-24T20:02"), cap: "s1-m-01", x: 0 },
      "2026-09-25": { m: T("2026-09-25T08:02"), e: T("2026-09-25T20:02"), cap: "s1-p-01", x: 1 },
      "2026-09-26": { m: T("2026-09-26T08:02"), e: null, cap: null, x: 0 },
    },
    collected: [
      { id: "s1-m-01", t: T("2026-09-24T20:02"), d: "2026-09-24" },
      { id: "s1-p-01", t: T("2026-09-25T20:02"), d: "2026-09-25" },
    ],
  };
  let m = L.migrateState(JSON.parse(JSON.stringify(old)), NOW, rng(1));
  ok(m, "轉換成功");
  eq(m.state.schema, 2);
  eq(m.state.collected.length, 3, "保留 2 張 + 補發今天早上 1 張");
  eq(m.state.collected[0].id, "s1-m-01"); eq(m.state.collected[1].id, "s1-p-01");
  eq(m.granted.length, 1); eq(m.granted[0].slot, "morning");
  eq(m.state.days["2026-09-26"].mc, m.granted[0].item.id);
  eq(m.state.days["2026-09-24"].ec, "s1-m-01", "舊 cap → 晚上的卡");
  eq(m.state.days["2026-09-23"].mc, null, "以前的日子不補發");
  eq(m.state.days["2026-09-25"].x, 1, "日曆紀錄保留");
  ok(L.normalizeState(JSON.parse(JSON.stringify(m.state))), "轉換後可通過 normalizeState");
  // 轉換後今天晚上還可以得卡
  const r = L.recordBrush(m.state, T("2026-09-26T21:40"), T("2026-09-26T21:42"), rng(2));
  eq(r.kind, "capture", "轉換後晚上可再得一張");

  // 舊劇照 + 皇室萌可最後收集（公主未有）+ 今天 cap 在晚上（早上的刷牙沒有卡）
  const old2 = {
    days: {
      "2026-09-20": { m: 1, e: 2, cap: "s1-m-01" }, "2026-09-21": { m: 1, e: 2, cap: "s1-p-01" },
      "2026-09-22": { m: 1, e: 2, cap: "s1-still-04" }, "2026-09-23": { m: 1, e: 2, cap: "s1-m-10" },
      "2026-09-24": { m: 1, e: 2, cap: "s1-still-09" }, "2026-09-25": { m: 1, e: null, cap: null },
      "2026-09-26": { m: T("2026-09-26T08:02"), e: T("2026-09-26T20:02"), cap: "s1-m-03" },
    },
    collected: [
      { id: "s1-m-01", t: 1, d: "2026-09-20" }, { id: "s1-p-01", t: 1, d: "2026-09-21" },
      { id: "s1-still-04", t: 1, d: "2026-09-22" }, { id: "s1-m-10", t: 1, d: "2026-09-23" },
      { id: "s1-still-09", t: 1, d: "2026-09-24" }, { id: "s1-m-03", t: 1, d: "2026-09-26" },
    ],
  };
  for (let i = 0; i < 200; i++) {
    m = L.migrateState(JSON.parse(JSON.stringify(old2)), NOW, rng(i));
    const ids = m.state.collected.map((c) => c.id);
    assert.deepStrictEqual(ids.slice(0, 6), ["s1-m-01", "s1-p-01", "s1-still-ep07a", "s1-m-10", "s1-still-ep20a", "s1-m-03"], "舊劇照換成新 id、次序不變");
    eq(ids[6], "s1-p-03", "皇室萌可（勇氣萌可）未有公主 → 補發的就是勇氣公主");
    eq(m.state.days["2026-09-26"].ec, "s1-m-03"); eq(m.state.days["2026-09-26"].mc, "s1-p-03");
    eq(m.state.days["2026-09-22"].ec, "s1-still-ep07a", "日曆中的舊劇照也轉換");
    eq(m.granted.length, 1, "今天晚上已有卡，只補發早上");
    // 繼續抽到 81 張仍符合規則
    const seq = ids.slice();
    const R = rng(900 + i);
    for (let id; (id = L.drawNextS1(seq, R));) seq.push(id);
    checkSequence(seq, "轉換後續抽 " + i);
  }
  // 皇室萌可收集了但公主沒有、而且不是最後一張（不正常的舊資料）→ 公主成為下一張
  const old3 = { days: {}, collected: [{ id: "s1-m-01" }, { id: "s1-p-01" }, { id: "s1-m-02" }, { id: "s1-m-12" }] };
  m = L.migrateState(old3, NOW, rng(3));
  eq(L.drawNext(m.state, rng(4)), "s1-p-02", "孤立的皇室萌可 → 公主成為下一張");
  // 今天只有晚上（舊規則：evening-no-morning，沒有卡）→ 補發晚上的卡
  const old4 = { schema: 1, days: { "2026-09-26": { m: null, e: T("2026-09-26T20:02"), cap: null } }, collected: [] };
  m = L.migrateState(old4, NOW, rng(5));
  eq(m.granted.length, 1); eq(m.granted[0].slot, "evening"); eq(m.granted[0].item.id, "s1-m-01", "空資料補發第 1 張愛心萌可");
  // 無法對應的舊劇照 → 改發未收集的劇照，張數不變
  const old5 = { days: {}, collected: [{ id: "s1-m-01" }, { id: "s1-p-01" }, { id: "s1-still-99", d: "2026-09-10" }, { id: "s1-still-01" }] };
  m = L.migrateState(old5, NOW, rng(6));
  eq(m.state.collected.length, 4, "張數不變");
  assert.deepStrictEqual(m.state.collected.map((c) => c.id), ["s1-m-01", "s1-p-01", "s1-still-ep01b", "s1-still-ep01a"]);
  ok(m.notes.some((n) => n.indexOf("s1-still-99") >= 0), "記錄無法對應");
  // schema 2 資料原樣通過；壞資料回傳 null
  const m2 = L.migrateState(JSON.parse(JSON.stringify(m.state)), NOW);
  eq(m2.granted.length, 0); eq(m2.state.collected.length, 4);
  eq(L.migrateState({ foo: 1 }, NOW), null);
  eq(L.migrateState(null, NOW), null);
  // 過了 04:00 分界：昨天的就不補發
  const m6 = L.migrateState({ days: { "2026-09-25": { m: 1, e: null, cap: null } }, collected: [] }, T("2026-09-26T08:00"), rng(1));
  eq(m6.granted.length, 0, "只補發今天");
  console.log("✓ 舊資料轉換（保留卡片與日曆、舊劇照對應、補發今天的卡、公主優先、無法對應時補發劇照）");
}

// ---- 刷牙動畫（brushfx.js）：泡泡按時間刷走，2:00 剛好全部刷走 ----
{
  const FX = require("../brushfx.js");
  eq(FX.BRUSH_MS, L.BRUSH_MS, "動畫長度 = 刷牙 2 分鐘");
  eq(FX.ZONE_MS, L.ZONE_MS, "每區 30 秒 = 刷牙提示");
  // 覆蓋檢查：某時間 e 已刷走的點是否蓋住 (x, y)
  function coveredAt(P, cnt, x, y) {
    for (let z = 0; z < 4; z++) {
      const st = P.zones[z].stamps;
      for (let k = 0; k < cnt[z]; k++) {
        const dx = st[2 * k] - x, dy = st[2 * k + 1] - y, r = FX.radius(P, z, k);
        if (dx * dx + dy * dy <= r * r) return true;
      }
    }
    return false;
  }
  for (const [w, h] of [[308, 308], [342, 187], [260, 260], [400, 225], [180, 180]]) {
    const P = FX.plan(w, h);
    const full = FX.counts(P, FX.BRUSH_MS);
    let miss = 0;
    for (let y = 0; y <= h; y += 2) for (let x = 0; x <= w; x += 2) if (!coveredAt(P, full, x, y)) miss++;
    eq(miss, 0, `2:00 全部刷走（${w}×${h}）`);
    // 每區在自己的 30 秒內刷完；之前完全未刷
    for (let q = 0; q < 4; q++) {
      const endQ = FX.counts(P, (q + 1) * FX.ZONE_MS - 1);
      const Z = P.zones[q];
      let m = 0;
      for (let y = Z.y; y <= Z.y + Z.h; y += 3) for (let x = Z.x; x <= Z.x + Z.w; x += 3) if (!coveredAt(P, FX.counts(P, (q + 1) * FX.ZONE_MS), x, y)) m++;
      eq(m, 0, `第 ${q + 1} 區在 ${(q + 1) * 30} 秒刷完（${w}×${h}）`);
      eq(FX.counts(P, q * FX.ZONE_MS + 1)[q], 0, "每區開頭牙刷先移動，未開始刷");
      ok(endQ[q] <= Z.n, "點數不超過");
    }
    // 單調：時間越後，刷走的點越多（每區都不會減少）
    let prev = [0, 0, 0, 0];
    for (let e = 0; e <= FX.BRUSH_MS; e += 250) {
      const c = FX.counts(P, e);
      for (let z = 0; z < 4; z++) ok(c[z] >= prev[z], "刷走的點只增不減");
      prev = c;
    }
    assert.deepStrictEqual(FX.counts(P, 0), [0, 0, 0, 0], "開始時全部蓋住");
    assert.deepStrictEqual(FX.counts(P, FX.BRUSH_MS + 5000), full, "超過 2:00 仍是全部刷走");
  }
  console.log("✓ 刷牙動畫：泡泡隨時間單調減少、四區跟提示同步、2:00 完全刷走（正方形卡和 16:9 劇照）");
}

// ---- 刷牙音樂、家長設定 ----
{
  // 固定非萬聖節時刻（10/28–10/31 以外），避免期間跑測試時被 halloween 覆寫
  const notHw = Date.UTC(2026, 9, 23, 4); // 2026-10-23 12:00 HKT
  const song = L.songFor(L.emptyState(), "op", notHw);
  eq(song.src, "audio/s1_op.m4a"); eq(song.title, "捕萌少女"); eq(song.season, "s1");
  ok(fs.existsSync(path.join(__dirname, "..", song.src)), "音樂檔存在");
  // 集齊第一季（第二季未開放）仍播第一季的歌
  const all = L.emptyState();
  s1.forEach((it) => all.collected.push({ id: it.id, t: 0, d: null, s: null }));
  eq(L.songFor(all, "op", notHw).src, "audio/s1_op.m4a", "集齊後仍播第一季主題曲");
  eq(DATA.seasons.find((x) => x.id === "s2").music, null, "第二季未有歌");
  // 首頁音樂：純音樂版（music.home）；該季沒有 home 時用該季的 op；刷牙仍用 op
  const hs = L.songFor(L.emptyState(), "home", notHw);
  eq(hs.src, "audio/s1_home.m4a"); eq(hs.kind, "home"); eq(hs.instrumental, true); eq(hs.title, "捕萌少女");
  ok(fs.existsSync(path.join(__dirname, "..", hs.src)), "首頁音樂檔存在");
  eq(L.songFor(L.emptyState(), "op", notHw).src, "audio/s1_op.m4a"); eq(song.kind, "op"); eq(song.instrumental, false);
  eq(L.songFor(all, "home", notHw).src, "audio/s1_home.m4a", "集齊後首頁仍播第一季純音樂版");
  {
    const D2 = JSON.parse(JSON.stringify(DATA)); delete D2.seasons[0].music.home;
    const L2 = require("../logic.js")(D2);
    eq(L2.songFor(L2.emptyState(), "home", notHw).src, "audio/s1_op.m4a", "沒有 home 時首頁用該季的 op");
    eq(L2.songFor(L2.emptyState(), "home", notHw).kind, "op");
    // 第二季開放而只有 op：首頁用第二季的 op；第二季沒有音樂：沿用第一季的 home
    const D3 = JSON.parse(JSON.stringify(DATA)); D3.seasons[1].open = true;
    D3.seasons[1].music = { op: { src: "audio/s2_op.m4a", title: "x" } };
    const L3 = require("../logic.js")(D3);
    const st3 = L3.emptyState(); s1.forEach((it) => st3.collected.push({ id: it.id, t: 0, d: null, s: null }));
    eq(L3.songFor(st3, "home", notHw).src, "audio/s2_op.m4a", "第二季有 op 沒有 home：首頁用第二季的 op");
    D3.seasons[1].music = null;
    const L4 = require("../logic.js")(D3);
    eq(L4.songFor(st3, "home", notHw).src, "audio/s1_home.m4a", "第二季沒有音樂：沿用第一季的純音樂版");
    eq(L4.songFor(st3, "op", notHw).src, "audio/s1_op.m4a");
  }
  assert.deepStrictEqual(L.normalizeSettings(null), { music: true }, "預設開啟");
  assert.deepStrictEqual(L.normalizeSettings({ music: false }), { music: false });
  assert.deepStrictEqual(L.normalizeSettings({ music: "x" }), { music: true });
  console.log("✓ 刷牙音樂：每季可各有主題曲（第一季《捕萌少女》），家長設定預設開啟");
}

// ---- 萬聖節期間覆寫（Asia/Hong_Kong 10/28–10/31）----
{
  // 用絕對 UTC 產生明確的 HK 時刻（HKT = UTC+8，無夏令時間；與測試機時區無關）
  const hk = (y, mo, d, h = 12, min = 0) => Date.UTC(y, mo - 1, d, h - 8, min);
  for (const day of [28, 29, 30, 31]) {
    ok(L.isHalloween(hk(2026, 10, day, 0)), `10/${day} 00:00 HKT 是萬聖節`);
    ok(L.isHalloween(hk(2026, 10, day, 12)), `10/${day} 12:00 HKT 是萬聖節`);
    ok(L.isHalloween(hk(2026, 10, day, 23)), `10/${day} 23:00 HKT 是萬聖節`);
  }
  ok(L.isHalloween(hk(2025, 10, 28, 12)), "任何年份 10/28 都是");
  ok(L.isHalloween(hk(2024, 10, 31, 23)), "任何年份 10/31 都是");
  ok(!L.isHalloween(hk(2026, 10, 27, 0)), "10/27 00:00 HKT 不是");
  ok(!L.isHalloween(hk(2026, 10, 27, 23)), "10/27 23:00 HKT 不是");
  ok(!L.isHalloween(hk(2026, 11, 1, 0)), "11/01 00:00 HKT 不是");
  ok(!L.isHalloween(hk(2026, 9, 30, 12)), "9/30 不是");
  // 剛好跨日：10/27 23:59 → 10/28 00:00；10/31 23:59 → 11/01 00:00
  ok(!L.isHalloween(Date.UTC(2026, 9, 27, 15, 59)), "10/27 23:59 HKT = UTC 15:59 不是");
  ok(L.isHalloween(Date.UTC(2026, 9, 27, 16, 0)), "10/28 00:00 HKT = UTC 16:00 是");
  ok(L.isHalloween(Date.UTC(2026, 9, 31, 15, 59)), "10/31 23:59 HKT = UTC 15:59 是");
  ok(!L.isHalloween(Date.UTC(2026, 9, 31, 16, 0)), "11/01 00:00 HKT = UTC 16:00 不是");
  const hw = DATA.halloween;
  ok(hw && hw.music && hw.music.src === "audio/halloween.m4a", "halloween.music 路徑");
  ok(hw.mascot && hw.mascot.src === "img/halloween/album_cover.jpg", "halloween.mascot 路徑");
  ok(fs.existsSync(path.join(__dirname, "..", hw.music.src)), "萬聖節音樂檔存在");
  ok(fs.existsSync(path.join(__dirname, "..", hw.mascot.src)), "萬聖節封面存在");
  for (const day of [28, 31]) {
    const ts = hk(2026, 10, day, 12);
    eq(L.songFor(L.emptyState(), "home", ts).src, "audio/halloween.m4a", `10/${day} 首頁歌`);
    eq(L.songFor(L.emptyState(), "op", ts).src, "audio/halloween.m4a", `10/${day} 刷牙歌`);
    eq(L.songFor(L.emptyState(), null, ts).src, "audio/halloween.m4a", `10/${day} 預設刷牙歌`);
    eq(L.songFor(L.emptyState(), "home", ts).season, "halloween");
    eq(L.songFor(L.emptyState(), "home", ts).title, "萬聖節歌");
  }
  // 其他日子不變（窗口前一天、窗口後一天、以及固定的 10/23）
  for (const other of [hk(2026, 10, 27, 23), hk(2026, 11, 1, 0), hk(2026, 10, 23, 12)]) {
    eq(L.songFor(L.emptyState(), "home", other).src, "audio/s1_home.m4a", "非萬聖節首頁仍是純音樂版");
    eq(L.songFor(L.emptyState(), "op", other).src, "audio/s1_op.m4a", "非萬聖節刷牙仍是人聲");
  }
  console.log("✓ 萬聖節：isHalloween（HK 10/28–10/31）覆寫首頁＋刷牙音樂；其他日子不變");
}

// ---- 聖誕期間覆寫（Asia/Hong_Kong 12/12–12/27；早上 00:00–11:59、晚上 12:00–23:59）----
{
  // 用絕對 UTC 產生明確的 HK 時刻（HKT = UTC+8，無夏令時間；與測試機時區無關）
  const hk = (y, mo, d, h = 12, min = 0) => Date.UTC(y, mo - 1, d, h - 8, min);
  // 預先排好的 32 個時段（seed 20261212；不是客戶端隨機）。track 與封面綁定。
  const EXPECT = {
    12: { morning: "teeniepingmas", evening: "teeniepingmas" },
    13: { morning: "carol_song", evening: "teeniepingmas" },
    14: { morning: "secret_christmas", evening: "secret_christmas" },
    15: { morning: "carol_song", evening: "teeniepingmas" },
    16: { morning: "carol_song", evening: "secret_christmas" },
    17: { morning: "secret_christmas", evening: "carol_song" },
    18: { morning: "carol_song", evening: "teeniepingmas" },
    19: { morning: "secret_christmas", evening: "teeniepingmas" },
    20: { morning: "teeniepingmas", evening: "carol_song" },
    21: { morning: "carol_song", evening: "carol_song" },
    22: { morning: "secret_christmas", evening: "teeniepingmas" },
    23: { morning: "secret_christmas", evening: "secret_christmas" },
    24: { morning: "teeniepingmas", evening: "teeniepingmas" },
    25: { morning: "secret_christmas", evening: "carol_song" },
    26: { morning: "carol_song", evening: "secret_christmas" },
    27: { morning: "carol_song", evening: "teeniepingmas" }
  };
  const TRACKS = {
    carol_song: { src: "audio/christmas/carol_song.m4a", cover: "img/christmas/carol_song_cover.jpg", title: "聖誕頌歌" },
    teeniepingmas: { src: "audio/christmas/teeniepingmas.m4a", cover: "img/christmas/teeniepingmas_cover.jpg", title: "萌可聖誕" },
    secret_christmas: { src: "audio/christmas/secret_christmas.m4a", cover: "img/christmas/secret_christmas_cover.jpg", title: "秘密聖誕" }
  };
  for (const day of [12, 13, 20, 25, 27]) {
    ok(L.isChristmas(hk(2026, 12, day, 0)), `12/${day} 00:00 HKT 是聖誕期間`);
    ok(L.isChristmas(hk(2026, 12, day, 11, 59)), `12/${day} 11:59 HKT 是聖誕期間`);
    ok(L.isChristmas(hk(2026, 12, day, 12)), `12/${day} 12:00 HKT 是聖誕期間`);
    ok(L.isChristmas(hk(2026, 12, day, 23, 59)), `12/${day} 23:59 HKT 是聖誕期間`);
  }
  ok(L.isChristmas(hk(2025, 12, 12, 0)), "任何年份 12/12 都是");
  ok(L.isChristmas(hk(2027, 12, 27, 23, 59)), "任何年份 12/27 都是");
  ok(!L.isChristmas(hk(2026, 12, 11, 23, 59)), "12/11 23:59 HKT 不是");
  ok(!L.isChristmas(hk(2026, 12, 28, 0)), "12/28 00:00 HKT 不是");
  ok(!L.isChristmas(hk(2026, 11, 5, 12)), "11/05 不是");
  ok(!L.isChristmas(hk(2026, 10, 31, 12)), "10/31 萬聖節不是聖誕");
  ok(!L.isChristmas(hk(2026, 1, 1, 0)), "1/1 不是");
  // 剛好跨日：12/11 23:59 → 12/12 00:00；12/27 23:59 → 12/28 00:00
  ok(!L.isChristmas(Date.UTC(2026, 11, 11, 15, 59)), "12/11 23:59 HKT = UTC 15:59 不是");
  ok(L.isChristmas(Date.UTC(2026, 11, 11, 16, 0)), "12/12 00:00 HKT = UTC 16:00 是");
  ok(L.isChristmas(Date.UTC(2026, 11, 27, 15, 59)), "12/27 23:59 HKT = UTC 15:59 是");
  ok(!L.isChristmas(Date.UTC(2026, 11, 27, 16, 0)), "12/28 00:00 HKT = UTC 16:00 不是");

  const xm = DATA.christmas;
  ok(xm && xm.tracks && xm.slots, "christmas 資料有 tracks 與 slots");
  eq(xm.slots.length, 32, "32 個時段（16 日 × 早／晚）");
  ok(xm.seed === 20261212, "schedule seed 20261212");
  for (const id of Object.keys(TRACKS)) {
    const tr = xm.tracks[id];
    ok(tr && tr.music && tr.music.src === TRACKS[id].src, id + " 音樂路徑");
    ok(tr.mascot && tr.mascot.src === TRACKS[id].cover, id + " 封面路徑");
    eq(tr.music.title, TRACKS[id].title, id + " 曲名");
    ok(fs.existsSync(path.join(__dirname, "..", tr.music.src)), id + " 音樂檔存在");
    ok(fs.existsSync(path.join(__dirname, "..", tr.mascot.src)), id + " 封面存在");
  }
  ok(Math.abs(xm.tracks.secret_christmas.music.duration - 106.7) < 0.05, "secret_christmas 約 106.7 秒");

  const seen = new Set();
  for (let day = 12; day <= 27; day++) {
    for (const period of ["morning", "evening"]) {
      const hour = period === "morning" ? 0 : 12;
      const ts = hk(2026, 12, day, hour, period === "morning" ? 30 : 0);
      const edge = period === "morning" ? hk(2026, 12, day, 11, 59) : hk(2026, 12, day, 23, 59);
      const id = EXPECT[day][period];
      seen.add(id);
      const slot = xm.slots.find((s) => s.month === 12 && s.day === day && s.period === period);
      eq(slot && slot.track_id, id, `data.js 12/${day} ${period} = ${id}`);
      for (const t of [ts, edge]) {
        const pick = L.christmasFor(t);
        eq(pick && pick.trackId, id, `12/${day} ${period} track`);
        eq(pick.period, period, `12/${day} ${period} 時段`);
        eq(pick.music.src, TRACKS[id].src, `12/${day} ${period} 音樂`);
        eq(pick.mascot.src, TRACKS[id].cover, `12/${day} ${period} 封面跟曲目`);
        eq(L.songFor(L.emptyState(), "home", t).src, TRACKS[id].src, `12/${day} ${period} 首頁歌`);
        eq(L.songFor(L.emptyState(), "op", t).src, TRACKS[id].src, `12/${day} ${period} 刷牙歌`);
        eq(L.songFor(L.emptyState(), null, t).src, TRACKS[id].src, `12/${day} ${period} 預設刷牙歌`);
        eq(L.songFor(L.emptyState(), "home", t).src, L.songFor(L.emptyState(), "op", t).src, "同一時段首頁與刷牙同一首");
        eq(L.songFor(L.emptyState(), "home", t).season, "christmas");
        eq(L.songFor(L.emptyState(), "home", t).title, TRACKS[id].title);
        eq(L.songFor(L.emptyState(), "op", t).title, TRACKS[id].title);
        const again = L.christmasFor(t);
        eq(again.trackId, pick.trackId, "同一時刻不重抽");
        eq(again.music.src, pick.music.src, "同一時刻音樂不變");
        eq(again.mascot.src, pick.mascot.src, "同一時刻封面不變");
      }
    }
  }
  eq(seen.size, 3, "三首曲目都有排到");
  // 12:00 邊界：12/13 11:59 仍是早上 carol_song；12:00 起是晚上 teeniepingmas
  eq(L.christmasFor(hk(2026, 12, 13, 11, 59)).trackId, "carol_song", "11:59 早上");
  eq(L.christmasFor(hk(2026, 12, 13, 11, 59)).period, "morning");
  eq(L.christmasFor(hk(2026, 12, 13, 12, 0)).trackId, "teeniepingmas", "12:00 晚上");
  eq(L.christmasFor(hk(2026, 12, 13, 12, 0)).period, "evening");
  eq(L.christmasFor(hk(2025, 12, 25, 8)).trackId, "secret_christmas", "年份不影響排程");
  eq(L.christmasFor(hk(2027, 12, 25, 18)).trackId, "carol_song", "2027 12/25 晚上仍是 carol_song");
  // 窗口外維持原曲（含第三季進度）
  for (const other of [hk(2026, 12, 11, 23, 59), hk(2026, 12, 28, 0), hk(2026, 10, 23, 12)]) {
    eq(L.christmasFor(other), null, "窗口外沒有聖誕曲目");
    eq(L.songFor(L.emptyState(), "home", other).src, "audio/s1_home.m4a", "非聖誕首頁仍是純音樂版");
    eq(L.songFor(L.emptyState(), "op", other).src, "audio/s1_op.m4a", "非聖誕刷牙仍是人聲");
  }
  ok(L.isHalloween(hk(2026, 10, 31, 12)) && !L.isChristmas(hk(2026, 10, 31, 12)), "萬聖節窗口仍只算萬聖節");
  console.log("✓ 聖誕：isChristmas（HK 12/12–12/27）按早／晚時段覆寫首頁＋刷牙音樂與對應封面；其他日子不變");
}
// ---- 預備倒數：時段邊緣取對小朋友較有利的時間、家長設定「預備時間」 ----
{
  const T = (str) => new Date(str).getTime();
  const fresh = () => L.emptyState();
  // 11:59:55 開始倒數、12:00:05 開始刷 → 早上
  let st = fresh();
  eq(L.brushStartTs(st, T("2026-09-26T11:59:55"), T("2026-09-26T12:00:05")), T("2026-09-26T11:59:55"), "11:59:55 倒數 → 算早上");
  eq(L.planBrush(JSON.parse(JSON.stringify(st)), L.brushStartTs(st, T("2026-09-26T11:59:55"), T("2026-09-26T12:00:05")), rng(1)).slot, "morning");
  // 16:59:55 開始倒數、17:00:05 開始刷 → 晚上
  eq(L.brushStartTs(st, T("2026-09-26T16:59:55"), T("2026-09-26T17:00:05")), T("2026-09-26T17:00:05"), "16:59:55 倒數、17:00:05 開始 → 算晚上");
  // 16:59:50 倒數但 16:59:55 就按「我準備好了」→ 兩個都在時段外 → 用倒數開始的時間（時段外）
  eq(L.brushStartTs(st, T("2026-09-26T16:59:50"), T("2026-09-26T16:59:55")), T("2026-09-26T16:59:50"));
  // 兩個都能得到卡片 → 用倒數開始的時間
  eq(L.brushStartTs(st, T("2026-09-26T08:00:00"), T("2026-09-26T08:00:10")), T("2026-09-26T08:00:00"));
  // 03:59:55：昨晚未得到卡 → 算昨晚；昨晚已得到卡 → 04:00:05 開始算今天早上
  eq(L.dayKey(L.brushStartTs(st, T("2026-09-27T03:59:55"), T("2026-09-27T04:00:05"))), "2026-09-26", "03:59:55 倒數 → 昨晚");
  st.collected.push({ id: "s1-m-01", t: 0, d: "2026-09-26", s: "e" });
  st.days["2026-09-26"] = { m: null, e: 1, mc: null, ec: "s1-m-01", x: 0 };
  const ts = L.brushStartTs(st, T("2026-09-27T03:59:55"), T("2026-09-27T04:00:05"));
  eq(ts, T("2026-09-27T04:00:05"), "昨晚已得到卡 → 算今天早上");
  eq(L.slotOf(ts), "morning"); eq(L.dayKey(ts), "2026-09-27");
  // 早上已得到卡、11:59:55 倒數、12:00:05 開始：都得不到卡 → 在時段內的優先（倒數開始，日曆記早上）
  st.days["2026-09-27"] = { m: 1, e: null, mc: "s1-p-01", ec: null, x: 0 };
  st.collected.push({ id: "s1-p-01", t: 0, d: "2026-09-27", s: "m" });
  eq(L.brushStartTs(st, T("2026-09-27T11:59:55"), T("2026-09-27T12:00:05")), T("2026-09-27T11:59:55"));
  // 集齊後（得不到卡）16:59:55 倒數、17:00:05 開始 → 在時段內的一個（晚上，日曆有紀錄）
  const all = fresh();
  s1.forEach((it) => all.collected.push({ id: it.id, t: 0, d: null, s: null }));
  eq(L.brushStartTs(all, T("2026-09-26T16:59:55"), T("2026-09-26T17:00:05")), T("2026-09-26T17:00:05"));
  // canEarn 不改動 state（不抽卡）
  const before = JSON.stringify(fresh());
  const s0 = fresh(); L.canEarn(s0, T("2026-09-26T08:00")); L.brushStartTs(s0, T("2026-09-26T08:00"), T("2026-09-26T08:00:10"));
  eq(JSON.stringify(s0), before, "brushStartTs / canEarn 不改動資料");
  // 家長設定：預備時間預設開啟（不寫入），關閉時為 ready: false；刷牙音樂設定不受影響
  assert.deepStrictEqual(L.normalizeSettings({ music: true, ready: false }), { music: true, ready: false });
  assert.deepStrictEqual(L.normalizeSettings({ music: false, ready: true }), { music: false });
  assert.deepStrictEqual(L.normalizeSettings({ ready: false }), { music: true, ready: false });
  // 首頁音樂：預設開啟（不寫入），關閉時為 homeMusic: false；與刷牙音樂、預備時間互不影響
  assert.deepStrictEqual(L.normalizeSettings({ music: true, homeMusic: false }), { music: true, homeMusic: false });
  assert.deepStrictEqual(L.normalizeSettings({ music: false, homeMusic: true, ready: false }), { music: false, ready: false });
  assert.deepStrictEqual(L.normalizeSettings({ homeMusic: "x" }), { music: true });
  checks += 6;
  console.log("✓ 預備倒數：時段邊緣以倒數開始 / 真正開始中較有利的時間判斷，不改動資料；預備時間設定預設開啟");
}
// ---- 第二季（74 張 = 20 萌可 + 2 公主 + 52 劇照）----
{
  const s2 = DATA.items.filter((i) => i.season === "s2");
  const S2 = L.season("s2");
  const S2TOTAL = 74, S2FINAL = "s2-m-20";
  eq(s2.length, S2TOTAL, "第二季 74 張"); eq(S2.total, S2TOTAL); ok(S2.open === true, "第二季 open");
  eq(s2.filter((i) => i.type === "momoke").length, 20); eq(s2.filter((i) => i.type === "still").length, 52);
  eq(s2.filter((i) => i.type === "princess").length, 2, "第二季 2 張公主");
  eq(new Set(DATA.items.map((i) => i.id)).size, DATA.items.length, "全部 id 不重複");
  // 名稱 / 次序 / 分類來自 manifest.json
  const MAN = "/workspace/momoke/images/s2/manifest.json";
  const names = ["幸福萌可", "冷冷萌可", "畫畫萌可", "重重萌可", "倒倒萌可", "速速萌可", "寶寶萌可", "睡睡萌可", "黏黏萌可", "好奇萌可", "玩具萌可", "變身萌可", "花花萌可", "玩玩萌可／樂樂萌可", "嘆氣萌可", "聰明萌可", "冰冰萌可", "電電萌可", "孤獨萌可", "妖妖萌可"];
  const ms = s2.filter((i) => i.type === "momoke");
  assert.deepStrictEqual(ms.map((m) => m.name), names, "第二季萌可名稱與次序");
  assert.deepStrictEqual(ms.map((m) => m.id), names.map((_, i) => "s2-m-" + String(i + 1).padStart(2, "0")));
  eq(ms[0].category, "royal"); eq(ms[19].category, "villain"); eq(ms.filter((m) => m.category === "magic").length, 18);
  eq(ms[0].princess, "s2-p-01", "幸福萌可 → 陽光公主");
  const S2_BLURBS = [
    "樂觀又天然呆，拿著泡泡槍，句尾「幸福」！",
    "很冷靜，手拿冰棍，能讓周圍變冷。",
    "最愛畫畫，手拿畫筆。",
    "最愛健身，提著啞鈴。",
    "喜歡倒立看世界，拿著磁鐵。",
    "跑得很快，騎著滑板車。",
    "很有童心，拿著手搖鈴。",
    "總想打瞌睡，拿著吸塵器。",
    "很黏人，拿著固體膠棒。",
    "什麼都好奇，拿著放大鏡。",
    "最愛玩具，玩著悠悠球。",
    "會變裝，戴著舞會面具，句尾「變變變」。",
    "喜歡花朵，拿著玫瑰花。",
    "大的玩玩拿遊戲機，小的樂樂抱奶瓶。",
    "容易嘆氣，拿著喇叭。",
    "很愛上學，拿著鉛筆和書本。",
    "很冰冷，拿著冰淇淋。",
    "很興奮，拿著閃電權杖。",
    "喜歡獨處，拿著釣魚竿。",
    "第二季最終反派，拿著惡魔三叉戟，句尾「昂昂」！",
  ];
  assert.deepStrictEqual(ms.map((m) => m.blurb), S2_BLURBS, "第二季萌可簡介（v11）");
  if (fs.existsSync(MAN)) {
    const man = JSON.parse(fs.readFileSync(MAN, "utf8"));
    man.forEach((x, i) => { eq(ms[i].name, x.name, "name = manifest " + x.file); eq(path.basename(ms[i].img), x.file); });
  }
  const ps = s2.filter((i) => i.type === "princess");
  eq(ps[0].id, "s2-p-01"); eq(ps[0].name, "陽光公主"); eq(ps[0].royal, "s2-m-01");
  eq(ps[0].blurb, "樂美和幸福萌可一起變身成陽光公主！");
  eq(ps[1].id, "s2-p-02"); eq(ps[1].name, "神聖公主"); ok(!ps[1].royal, "神聖公主無單一 royal");
  eq(ps[1].blurb, "樂美和六隻皇室萌可一起變身成神聖公主！");
  eq(path.basename(ps[0].img), "01_yangguang.jpg"); eq(path.basename(ps[1].img), "02_shensheng.jpg");
  ok(/^img\/s2_princess\//.test(ps[0].img) && /^img\/s2_princess\//.test(ps[1].img));
  const st2s = s2.filter((i) => i.type === "still");
  const efiles = []; for (let e = 1; e <= 26; e++) for (const ab of ["a", "b"]) efiles.push(`ep${String(e).padStart(2, "0")}_${ab}.jpg`);
  assert.deepStrictEqual(st2s.map((x) => path.basename(x.img)), efiles, "第二季劇照次序：集數再 a/b");
  st2s.forEach((x) => { ok(x.ep >= 1 && x.ep <= 26, "ep"); ok(/^img\/s2_stills\//.test(x.img)); });
  s2.forEach((i) => ok(i.img && fs.existsSync(path.join(__dirname, "..", i.img)), "圖片存在 " + i.img));
  eq(S2.first.length, 1); eq(S2.first[0], "s2-m-01"); eq(S2.finalItem, S2FINAL);
  eq(S2.transform.from, "s1-m-24"); eq(S2.transform.to, "s2-m-01"); eq(S2.music, null, "第二季音樂維持 null");

  // 抽卡：幸福第 1、陽光第 2、神聖第 73、妖妖第 74；中間萌可+劇照平均混合、不重複
  const baseS1 = () => {
    const st = L.emptyState();
    s1.forEach((it) => st.collected.push({ id: it.id, t: 0, d: "2026-10-01", s: null }));
    return st;
  };
  for (let run = 0; run < 3000; run++) {
    const R = rng(900000 + run);
    const st = baseS1();
    eq(L.currentSeasonId(st), "s2", "第一季集齊 → 目前第二季");
    ok(L.seasonUnlocked(st, "s2")); eq(L.applyUnlocks(st, T("2026-10-01T08:00")).length, 1);
    eq(L.applyUnlocks(st, T("2026-10-01T08:00")).length, 0, "只送一次");
    const seq = [];
    let id;
    seq.push("s2-m-01");
    while (L.collectedIn(st, "s2").length < S2TOTAL && (id = L.drawNext(st, R))) { st.collected.push({ id, t: 0, d: null, s: null }); seq.push(id); st.pending = null; ok(seq.length <= S2TOTAL, "不可多於 74 張"); }
    eq(seq.length, S2TOTAL, "共 74 張"); eq(new Set(seq).size, S2TOTAL, "74 張不重複");
    eq(seq[0], "s2-m-01", "第 1 張幸福萌可"); eq(seq[1], "s2-p-01", "第 2 張陽光公主");
    eq(seq[S2TOTAL - 2], "s2-p-02", "第 73 張神聖公主"); eq(seq[S2TOTAL - 1], S2FINAL, "第 74 張妖妖萌可");
    ok(seq.every((x) => L.byId[x].season === "s2"), "只有第二季");
    eq(seq.filter((x) => L.byId[x].type === "princess").length, 2, "剛好 2 張公主");
    for (let i = 2; i < S2TOTAL - 2; i++) ok(L.byId[seq[i]].type !== "princess" && seq[i] !== S2FINAL, "中段無公主無妖妖 @" + i);
    eq(L.currentSeasonId(st), "s3", "第二季集齊後進入第三季");
    if (run < 200) {
      const mid = seq.slice(2, S2TOTAL - 2);
      const firstStill = mid.findIndex((x) => L.byId[x].type === "still");
      const lastMom = mid.map((x) => L.byId[x].type).lastIndexOf("momoke");
      ok(firstStill >= 0 && lastMom >= 0);
    }
  }
  // 劇照和萌可平均混合：陽光之後的抽卡池 = 18 魔方萌可 + 52 劇照 = 70
  { let stillsIn20 = 0, N = 2000;
    for (let run = 0; run < N; run++) {
      const R = rng(40000 + run), st = baseS1(); L.applyUnlocks(st, 0);
      { const id = L.drawNext(st, R); eq(id, "s2-p-01"); st.collected.push({ id, t: 0, d: null, s: null }); }
      for (let k = 0; k < 20; k++) { const id = L.drawNext(st, R); st.collected.push({ id, t: 0, d: null, s: null }); if (L.byId[id].type === "still") stillsIn20++; }
    }
    const frac = stillsIn20 / (N * 20);
    ok(Math.abs(frac - 52 / 70) < 0.05, "陽光之後萌可和劇照平均混合 (" + frac.toFixed(3) + ")"); }
  for (const fixed of [0, 0.999999, 0.5]) {
    const st = baseS1(); L.applyUnlocks(st, 0); let id, n = 1, seq = ["s2-m-01"];
    while (L.collectedIn(st, "s2").length < S2TOTAL && (id = L.drawNext(st, () => fixed))) { st.collected.push({ id, t: 0, d: null, s: null }); seq.push(id); n++; }
    eq(n, S2TOTAL); eq(seq[1], "s2-p-01"); eq(seq[S2TOTAL - 2], "s2-p-02"); eq(seq[S2TOTAL - 1], S2FINAL);
  }

  // 第二季未開放：第一季還差一張（80/81）
  { const st = baseS1(); st.collected = st.collected.filter((c) => c.id !== "s1-m-24"); eq(st.collected.length, 80);
    eq(L.currentSeasonId(st), "s1"); ok(!L.seasonUnlocked(st, "s2"), "80/81：第二季未開放");
    eq(L.applyUnlocks(st, 0).length, 0); eq(L.displaySeasonId(st), "s1");
    eq(L.drawNext(st, rng(1)), "s1-m-24", "最後一張是鬧鬧萌可"); }

  // 完整流程
  { const R = rng(2468), st = baseS1(); st.collected = st.collected.filter((c) => c.id !== "s1-m-24");
    eq(st.collected.length, 80);
    let res = L.recordBrush(st, T("2026-10-01T08:00"), T("2026-10-01T08:02"), R);
    eq(res.kind, "capture"); eq(res.item.id, "s1-m-24", "第 81 張鬧鬧萌可"); eq(res.number, 81); eq(res.seasonComplete, "s1");
    ok(res.unlock && res.unlock.item.id === "s2-m-01" && res.unlock.from.id === "s1-m-24", "同時送出幸福萌可");
    eq(res.unlock.from.name + "變成" + res.unlock.item.name + "了！", "鬧鬧萌可變成幸福萌可了！", "S1→S2 解鎖文案不變");
    eq(L.collectedIn(st, "s1").length, 81, "第一季仍是 81 張，鬧鬧萌可還在"); eq(L.collectedIn(st, "s2").length, 1, "第二季 1/74");
    ok(L.collectedSet(st)["s1-m-24"] && L.collectedSet(st)["s2-m-01"]);
    eq(st.days["2026-10-01"].mc, "s1-m-24", "日曆記的是刷牙得到的鬧鬧萌可（幸福萌可是禮物，不佔名額）");
    eq(L.cardsOnDay(st.days["2026-10-01"]), 1);
    eq(L.pendingNews(st), "s2"); eq(L.displaySeasonId(st), "s2"); eq(L.currentSeasonId(st), "s2");
    const re = L.normalizeState(JSON.parse(JSON.stringify(st))); eq(re.news[0], "s2"); eq(re.collected.length, 82);
    L.clearNews(st, "s2"); eq(L.pendingNews(st), null); ok(!("news" in st), "清除後沒有 news 鍵");
    eq(L.applyUnlocks(st, 0).length, 0, "不會再次送出或再次通知"); eq(L.pendingNews(st), null);
    eq(L.recordBrush(st, T("2026-10-01T09:00"), T("2026-10-01T09:02"), R).kind, "again");
    const pl = L.planBrush(st, T("2026-10-01T20:00"), R); ok(pl.earn && pl.id === "s2-p-01", "下一張是陽光公主");
    eq(L.planBrush(st, T("2026-10-01T20:01"), rng(5)).id, pl.id, "中途停止沿用同一張");
    let d = new Date(2026, 9, 1), n = 0;
    while (L.collectedIn(st, "s2").length < S2TOTAL && n++ < 200) {
      const k = L.ymd(d);
      for (const hm of ["T07:00", "T20:00"]) { if (L.collectedIn(st, "s2").length >= S2TOTAL) break; const r = L.recordBrush(st, T(k + hm), T(k + hm) + 120000, R); ok(r.kind === "capture" || r.kind === "again"); if (r.kind === "capture") { if (r.item.id === S2FINAL) { eq(r.seasonComplete, "s2"); eq(r.unlock, null, "集齊第二季不顯示變身、不贈卡"); } else eq(r.unlock, null); } }
      d.setDate(d.getDate() + 1);
    }
    eq(L.collectedIn(st, "s2").length, S2TOTAL); eq(L.collectedIn(st, "s3").length, 0, "第三季解鎖進度 0/76");
    eq(st.collected.length, TOTAL + S2TOTAL);
    ok(!L.collectedSet(st)["s3-m-01"], "集齊第二季不贈送 s3-m-01");
    eq(L.pendingNews(st), null, "沒有變身通知");
    eq(L.season("s3").transform, undefined, "第二季沒有變身設定");
    eq(new Set(st.collected.map((c) => c.id)).size, TOTAL + S2TOTAL, "兩季卡片不重複");
    const s2ids = st.collected.filter((c) => L.byId[c.id].season === "s2").map((c) => c.id);
    eq(s2ids[0], "s2-m-01"); eq(s2ids[1], "s2-p-01"); eq(s2ids[S2TOTAL - 2], "s2-p-02"); eq(s2ids[S2TOTAL - 1], S2FINAL);
    ok(L.isSeasonComplete(st, "s2") && L.isSeasonComplete(st, "s1"));
    ok(L.seasonUnlocked(st, "s3"), "集齊第二季後開放第三季");
    eq(L.currentSeasonId(st), "s3"); eq(L.displaySeasonId(st), "s3");
    const album3 = L.albumView(st, "s3", false);
    eq(album3.open, true); eq(album3.items.length, 76); eq(album3.items.filter((row) => row.collected).length, 0, "畫冊 0/76");
    const k2 = L.ymd(d);
    const pc = L.planBrush(st, T(k2 + "T08:00"), R); ok(pc.earn && pc.id === "s3-m-01", "下一張刷牙是第三季愛心萌可");
    eq(L.songFor(st, "op", Date.UTC(2026,9,23,4)).src, "audio/s3_gem_op.m4a", "第三季刷牙播片頭曲");
    eq(L.songFor(st, "home", Date.UTC(2026,9,23,4)).src, "audio/s3_gem_ed.m4a", "第三季首頁播純音樂");
    eq(L.normalizeState(JSON.parse(JSON.stringify(st))).collected.length, TOTAL + S2TOTAL);
  }
  // 第二季最後一張的 seasonComplete
  { const st = baseS1(); L.applyUnlocks(st, 0); L.clearNews(st, "s2"); st.collected.push(...s2.filter((i) => i.id !== S2FINAL && i.id !== "s2-m-01").map((i) => ({ id: i.id, t: 0, d: null, s: null })));
    eq(L.collectedIn(st, "s2").length, 73);
    const r = L.recordBrush(st, T("2026-12-01T08:00"), T("2026-12-01T08:02"), rng(3));
    eq(r.item.id, S2FINAL); eq(r.number, 74); eq(r.seasonComplete, "s2"); eq(r.unlock, null, "妖妖萌可不變成愛心萌可");
    ok(L.seasonUnlocked(st, "s3")); eq(L.collectedIn(st, "s3").length, 0); ok(!L.collectedSet(st)["s3-m-01"]); eq(L.pendingNews(st), null);
    eq(L.drawNext(st, rng(4)), "s3-m-01", "下一張刷牙才抽第三季愛心萌可"); }

  // 舊進度加項：已集齊舊版 72 張（含妖妖、無公主）→ 補抽陽光、神聖
  { const st = baseS1(); L.applyUnlocks(st, 0);
    s2.filter((i) => i.type !== "princess").forEach((i) => { if (i.id !== "s2-m-01") st.collected.push({ id: i.id, t: 0, d: null, s: null }); });
    eq(L.collectedIn(st, "s2").length, 72);
    ok(!L.isSeasonComplete(st, "s2"), "缺 2 張公主 → 未集齊");
    const a = L.drawNext(st, rng(1)); eq(a, "s2-p-01", "補陽光公主"); st.collected.push({ id: a, t: 0, d: null, s: null });
    const b = L.drawNext(st, rng(2)); eq(b, "s2-p-02", "補神聖公主"); st.collected.push({ id: b, t: 0, d: null, s: null });
    eq(L.drawNext(st, rng(3)), "s3-m-01", "第二季集齊後下一張是第三季愛心萌可"); ok(L.isSeasonComplete(st, "s2")); }

  // 舊資料：v9 的進度完全不變
  { const v9 = { schema: 2, days: { "2026-09-26": { m: 1, e: 2, mc: "s1-m-01", ec: "s1-p-01", x: 0 } },
      collected: [{ id: "s1-m-01", t: 1, d: "2026-09-26", s: "m" }, { id: "s1-p-01", t: 2, d: "2026-09-26", s: "e" }, { id: "s1-still-ep03a", t: 3, d: "2026-09-27", s: null }], pending: { id: "s1-m-02", n: 3 } };
    const out = L.normalizeState(JSON.parse(JSON.stringify(v9)));
    assert.deepStrictEqual(out, v9, "v9 狀態經 normalize 後完全相同（沒有新增任何鍵）");
    const mg = L.migrateState(JSON.parse(JSON.stringify(v9)), T("2026-09-28T10:00"), rng(1));
    assert.deepStrictEqual(mg.state, v9); eq(mg.granted.length, 0);
    eq(L.applyUnlocks(out, 0).length, 0, "第一季未集齊 → 不送幸福萌可");
    assert.deepStrictEqual(out, v9, "applyUnlocks 沒有改動未集齊的資料");
    const full = { schema: 2, days: {}, pending: null, collected: s1.map((it) => ({ id: it.id, t: 1, d: "2026-10-01", s: null })) };
    const f = L.normalizeState(JSON.parse(JSON.stringify(full)));
    eq(L.applyUnlocks(f, T("2026-10-02T09:00")).length, 1);
    assert.deepStrictEqual(f.collected.slice(0, 81), full.collected, "第一季 81 張原封不動"); eq(f.collected[81].id, "s2-m-01"); eq(f.news[0], "s2");
    const back = L.migrateState(JSON.parse(JSON.stringify({ app: "x", state: f }).replace(/^/, "")).state, 0, rng(1));
    assert.deepStrictEqual(back.state, f, "含第二季卡片和通知的備份來回不變");
    const noNews = JSON.parse(JSON.stringify(f)); delete noNews.news; assert.deepStrictEqual(L.normalizeState(noNews).collected, f.collected);
  }
  eq(L.songFor(L.emptyState(), "op", Date.UTC(2026,9,23,4)).src, "audio/s1_op.m4a");
  eq(L.seasonUnlocked(L.emptyState(), "s1"), true); eq(L.seasonUnlocked(L.emptyState(), "s2"), false); eq(L.seasonUnlocked(L.emptyState(), "s3"), false);
  eq(L.displaySeasonId(L.emptyState()), "s1");
  console.log("✓ 第二季：74 張（20 萌可 + 2 公主 + 52 劇照）、幸福第 1、陽光第 2、神聖第 73、妖妖最後、第一季集齊後開放並直接送幸福萌可、舊 72 張進度可補公主、集齊後開放第三季");
}

// ---- 第三季《閃亮寶石》（76 張 = 20 萌可 + 4 公主 + 52 劇照）----
{
  const s3 = DATA.items.filter((i) => i.season === "s3");
  const S3 = L.season("s3");
  const S3TOTAL = 76, S3FINAL = "s3-m-20";
  const EARLY = ["s3-m-02", "s3-m-03", "s3-m-04"];
  const PAIRS = { "s3-m-01": "s3-p-01", "s3-m-02": "s3-p-02", "s3-m-03": "s3-p-04", "s3-m-04": "s3-p-03" };
  eq(L.season("s1").name, "奇妙萌可"); eq(L.season("s2").name, "奇妙萌可第二季"); eq(S3.name, "閃亮寶石");
  eq(s3.length, S3TOTAL, "第三季 76 張"); eq(S3.total, S3TOTAL); ok(S3.open === true, "第三季 open");
  eq(s3.filter((i) => i.type === "momoke").length, 20);
  eq(s3.filter((i) => i.type === "princess").length, 4);
  eq(s3.filter((i) => i.type === "still").length, 52);
  eq(new Set(DATA.items.map((i) => i.id)).size, DATA.items.length, "全部 id 不重複");
  const ms = s3.filter((i) => i.type === "momoke");
  const names = ["愛心萌可", "笑笑萌可", "信信萌可", "贊贊萌可", "嘻嘻萌可", "弱弱萌可", "願望萌可", "安慰萌可", "躲躲萌可", "淨淨萌可", "美味萌可", "暖暖萌可", "筆記萌可", "公主萌可", "雙雙萌可", "分享萌可", "雕刻萌可", "芭蕾萌可", "神奇萌可", "奉獻萌可"];
  assert.deepStrictEqual(ms.map((m) => m.name), names, "第三季萌可名稱與次序");
  assert.deepStrictEqual(ms.map((m) => m.id), names.map((_, i) => "s3-m-" + String(i + 1).padStart(2, "0")));
  eq(ms.filter((m) => m.category === "royal").length, 4);
  eq(ms.filter((m) => m.category === "gem").length, 15, "15 寶石萌可");
  eq(ms[19].category, "villain"); eq(ms[19].id, S3FINAL);
  const BLURB = {
    "00_aixin_gem.jpg": "本季換成豎琴造型，善良又重感情，句尾「啾」！",
    "01_xiaoxiao.jpg": "代表笑容，拿著禮炮煙花，總是笑眯眯，句尾「笑笑」！",
    "02_xinxin.jpg": "代表信任，撐著雨傘，憨厚純真，句尾「真的」！",
    "03_zanzan.jpg": "代表善良，拿著梳子，親切和藹，句尾「贊贊」！",
    "04_xixi.jpg": "愛惡作劇，揮著羽毛扇子。",
    "05_ruoruo.jpg": "容易覺得痛，貼著創可貼。",
    "06_yuanwang.jpg": "會實現願望，提著神燈。",
    "07_anwei.jpg": "最愛安慰別人，裹著毯子。",
    "08_duoduo.jpg": "很膽小，抱著手風琴。",
    "09_jingjing.jpg": "最愛整潔，拿著掃帚。",
    "10_meiwei.jpg": "很懂品味，拿著湯勺。",
    "11_nuannuan.jpg": "帶來温暖，拿著編織針。",
    "12_biji.jpg": "做事很慎密，拿著筆記本和筆。",
    "13_gongzhu.jpg": "舉止優雅，拿著權杖。",
    "14_shuangshuang.jpg": "喜歡成雙成對，拿著響板。",
    "15_fenxiang.jpg": "最愛分享，提著禮物盒。",
    "16_diaoke.jpg": "很有創造力，拿著錘子。",
    "17_balei.jpg": "最愛芭蕾舞，捧著水晶球。",
    "18_shenqi.jpg": "很有英雄氣概，拿著迴旋鏢。",
    "19_fengxian.jpg": "戴面具時是假面萌可，很疼愛珍珠，句尾「棒棒」！",
    "01_zuanshi.jpg": "樂美和愛心萌可一起變身成鑽石公主！",
    "02_shuijing.jpg": "樂美和笑笑萌可一起變身成水晶公主！",
    "03_feicui.jpg": "樂美和贊贊萌可一起變身成翡翠公主！",
    "04_lanshiba.jpg": "樂美和信信萌可一起變身成藍寶石公主！",
  };
  ms.forEach((m) => { eq(m.blurb, BLURB[require("path").basename(m.img)], "blurb " + m.img); ok(m.blurb.length > 0, "blurb 非空 " + m.id); });
  const ps = s3.filter((i) => i.type === "princess");
  ps.forEach((p) => { eq(p.blurb, BLURB[require("path").basename(p.img)], "公主 blurb " + p.name); ok(p.blurb.length > 0); });
  eq(ps.map((p) => p.name).join(","), "鑽石公主,水晶公主,翡翠公主,藍寶石公主");
  Object.entries(PAIRS).forEach(([royal, princess]) => { eq(L.byId[royal].princess, princess); eq(L.byId[princess].royal, royal); });
  const stl = s3.filter((i) => i.type === "still");
  const efiles = []; for (let e = 1; e <= 26; e++) for (const ab of ["a", "b"]) efiles.push("ep" + String(e).padStart(2, "0") + "_" + ab + ".jpg");
  assert.deepStrictEqual(stl.map((x) => require("path").basename(x.img)), efiles, "第三季劇照次序");
  const stillMan = JSON.parse(fs.readFileSync(require("path").join(__dirname, "..", "img/s3_gem_stills/manifest.json"), "utf8"));
  stl.forEach((x) => { eq(x.blurb, "第" + x.ep + "集〈" + stillMan.episode_titles_zh_hant[String(x.ep)] + "〉", x.id); ok(/^img\/s3_gem_stills\//.test(x.img)); });
  s3.forEach((i) => ok(i.img && fs.existsSync(require("path").join(__dirname, "..", i.img)), "圖片存在 " + i.img));
  eq(S3.first[0], "s3-m-01"); eq(S3.finalItem, S3FINAL); eq(S3.earlyWindow, 24);
  eq(S3.transform, undefined, "第三季沒有變身贈卡");
  eq(S3.music.op.src, "audio/s3_gem_op.m4a"); eq(S3.music.op.title, "閃亮寶石"); eq(S3.music.op.duration, 55.8);
  eq(S3.music.home.src, "audio/s3_gem_ed.m4a"); eq(S3.music.home.instrumental, true); eq(S3.music.home.duration, 20.0);
  ok(fs.existsSync(require("path").join(__dirname, "..", S3.music.op.src)));
  ok(fs.existsSync(require("path").join(__dirname, "..", S3.music.home.src)));

  const baseS2 = () => {
    const st = L.emptyState();
    DATA.items.filter((it) => it.season === "s1" || it.season === "s2").forEach((it) => st.collected.push({ id: it.id, t: 0, d: "2026-12-01", s: null }));
    return st;
  };
  const checkS3 = (seq, label) => {
    eq(seq.length, S3TOTAL, label + " 共 76 張");
    eq(new Set(seq).size, S3TOTAL, label + " 不重複");
    eq(seq[0], "s3-m-01", label + " 第 1 張愛心萌可");
    eq(seq[1], "s3-p-01", label + " 第 2 張鑽石公主");
    eq(seq[S3TOTAL - 1], S3FINAL, label + " 最後是奉獻萌可");
    ok(seq.every((x) => L.byId[x].season === "s3"), label + " 只有第三季");
    Object.entries(PAIRS).forEach(([royal, princess]) => eq(seq[seq.indexOf(royal) + 1], princess, label + " " + L.byId[royal].name + " 之後緊接公主"));
    seq.forEach((id, i) => { if (L.byId[id].type === "princess") eq(seq[i - 1], L.byId[id].royal, label + " 公主前面是皇室萌可"); });
    const lastEarly = Math.max.apply(null, EARLY.map((id) => seq.indexOf(id)));
    seq.forEach((id, i) => { if (L.byId[id].category === "gem") ok(i > lastEarly, label + " 寶石萌可在早期皇室之後"); });
    EARLY.forEach((id) => ok(seq.indexOf(PAIRS[id]) < S3.earlyWindow, label + " " + L.byId[id].name + " 的公主在第 " + S3.earlyWindow + " 張前"));
    ok(seq.indexOf(S3FINAL) === S3TOTAL - 1);
  };
  let earlyPos = 0, earlyN = 0, gemPos = 0, gemN = 0, obsStill = 0, expStill = 0;
  const RUNS = 2000;
  for (let run = 0; run < RUNS; run++) {
    const R = rng(700000 + run);
    const st = baseS2();
    eq(L.currentSeasonId(st), "s3", "第二季集齊 → 目前第三季");
    ok(!L.collectedSet(st)["s3-m-01"]);
    eq(L.applyUnlocks(st, T("2026-12-02T08:00")).length, 0, "集齊第二季不贈送第三季卡片");
    ok(!L.collectedSet(st)["s3-m-01"], "贈卡沒有寫入");
    eq(L.pendingNews(st), null);
    const seq = [];
    let id;
    while (L.collectedIn(st, "s3").length < S3TOTAL && (id = L.drawNext(st, R))) {
      st.collected.push({ id, t: 0, d: null, s: null }); seq.push(id); st.pending = null;
      ok(seq.length <= S3TOTAL, "不可多於 76 張");
    }
    checkS3(seq, "模擬 " + run);
    eq(L.currentSeasonId(st), "s4", "第三季集齊後進入第四季");
    EARLY.forEach((id) => { earlyPos += seq.indexOf(id) + 1; earlyN++; });
    seq.forEach((id, i) => { if (L.byId[id].category === "gem") { gemPos += i + 1; gemN++; } });
    const earlyIds = new Set(Object.keys(PAIRS).concat(Object.values(PAIRS)));
    let seen = 0, cut = -1;
    for (let i = 0; i < seq.length; i++) { if (earlyIds.has(seq[i])) seen++; if (seen === earlyIds.size) { cut = i; break; } }
    const usedStill = seq.slice(0, cut + 1).filter((id) => L.byId[id].type === "still").length;
    const leftStill = 52 - usedStill, leftGem = 15;
    expStill += leftStill / (leftStill + leftGem);
    if (L.byId[seq[cut + 1]].type === "still") obsStill++;
    ok(cut + 1 < S3TOTAL - 1, "中段還有卡");
  }
  ok(earlyPos / earlyN < 14, "笑笑／信信／贊贊平均偏早 (" + (earlyPos / earlyN).toFixed(1) + ")");
  const gavg = gemPos / gemN;
  ok(gavg > 24 && gavg < 70, "寶石萌可落在中段 (" + gavg.toFixed(1) + ")");
  ok(Math.abs(obsStill / RUNS - expStill / RUNS) < 0.05, "早期皇室之後劇照與寶石萌可平均混合");
  for (const fixed of [0, 0.999999, 0.5]) {
    const st = baseS2(); eq(L.applyUnlocks(st, 0).length, 0);
    const seq = []; let id;
    while (L.collectedIn(st, "s3").length < S3TOTAL && (id = L.drawNext(st, () => fixed))) { st.collected.push({ id, t: 0, d: null, s: null }); seq.push(id); }
    checkS3(seq, "固定亂數 " + fixed);
  }
  { const st = baseS2(); st.collected = st.collected.filter((c) => c.id !== "s2-m-20");
    eq(L.collectedIn(st, "s2").length, 73); ok(!L.seasonUnlocked(st, "s3"), "73/74：第三季未開放");
    eq(L.applyUnlocks(st, 0).length, 0); eq(L.currentSeasonId(st), "s2"); eq(L.drawNext(st, rng(1)), "s2-m-20", "還差妖妖萌可"); }
  { const prior = DATA.items.filter((it) => it.season === "s1" || it.season === "s2").map((it) => it.id);
    const saved = { schema: 2, days: { "2026-11-01": { m: 1, e: 2, mc: "s1-m-01", ec: "s2-m-02", x: 0 } }, pending: null, collected: prior.map((id) => ({ id, t: 1, d: "2026-11-01", s: null })) };
    const n = L.normalizeState(JSON.parse(JSON.stringify(saved)));
    assert.deepStrictEqual(n.collected.map((c) => c.id), prior, "舊進度原封不動");
    eq(L.applyUnlocks(n, T("2026-12-03T08:00")).length, 0, "舊進度集齊第二季也不贈送 s3-m-01");
    ok(!n.collected.some((c) => c.id === "s3-m-01"));
    eq(n.news, undefined, "沒有變身通知");
    assert.deepStrictEqual(n.collected.map((c) => c.id), prior, "收集清單原封不動");
    ok(L.seasonUnlocked(n, "s3"));
    eq(L.collectedIn(n, "s3").length, 0, "第三季 0/76");
    eq(L.drawNext(n, rng(1)), "s3-m-01");
    eq(n.days["2026-11-01"].mc, "s1-m-01"); eq(n.days["2026-11-01"].ec, "s2-m-02"); }
  { const st = baseS2();
    eq(L.applyUnlocks(st, 0).length, 0);
    s3.filter((i) => i.id !== S3FINAL).forEach((i) => st.collected.push({ id: i.id, t: 0, d: null, s: null }));
    eq(L.collectedIn(st, "s3").length, 75);
    ok(L.collectedSet(st)["s3-m-01"], "愛心萌可已在之前的刷牙得到");
    const r = L.recordBrush(st, T("2027-02-01T08:00"), T("2027-02-01T08:02"), rng(9));
    eq(r.item.id, S3FINAL); eq(r.number, 76); eq(r.seasonComplete, "s3");
    eq(r.unlock, null, "集齊第三季不贈送第四季卡片");
    ok(L.seasonUnlocked(st, "s4"));
    eq(L.collectedIn(st, "s4").length, 0, "第四季進度 0/79");
    ok(!L.collectedSet(st)["s4-m-00"]);
    eq(L.pendingNews(st), null);
    eq(L.season("s4").transform, undefined);
    const pc = L.planBrush(st, T("2027-02-01T20:00")); ok(pc.earn && pc.id === "s4-m-00", "下一張刷牙是第四季愛心萌可");
    const hw = Date.UTC(2026, 9, 28, 4);
    eq(L.songFor(st, "op", hw).src, "audio/halloween.m4a", "萬聖節覆寫刷牙歌");
    eq(L.songFor(st, "home", hw).src, "audio/halloween.m4a", "萬聖節覆寫首頁歌");
    eq(L.songFor(st, "home", hw).season, "halloween");
    eq(L.songFor(st, "op", Date.UTC(2026, 9, 23, 4)).src, "audio/s4_op.m4a", "進入第四季後刷牙播魔法鑰匙");
    eq(L.songFor(st, "home", Date.UTC(2026, 9, 23, 4)).src, "audio/s4_ed.m4a"); }
  console.log("✓ 第三季：76 張、愛心第 1、鑽石第 2、笑笑／信信／贊贊偏早且公主緊接、寶石萌可中段、劇照穿插、奉獻最後、第二季集齊後開放但不贈卡、舊進度保留、萬聖節仍覆寫");
}

// App 版本：主頁底部的小字（data.js 的 version）必須和 sw.js 的 VERSION 相同
{
  const swSrc = fs.readFileSync(require("path").join(__dirname, "..", "sw.js"), "utf8");
  const m = /var VERSION = "(v\d+)"/.exec(swSrc);
  ok(m, "sw.js 有 VERSION");
  eq(DATA.version, m[1], "data.js version 必須等於 sw.js VERSION");
  ok(/^v\d+$/.test(DATA.version), "版本格式 vN");
  console.log("✓ 版本標籤：data.js version = sw.js VERSION = " + DATA.version);
}

// 家長預覽 ?uat=1：只放寬畫冊翻看，不改收集進度
{
  eq(L.isUatMode(""), false);
  eq(L.isUatMode("?test=1"), false);
  eq(L.isUatMode("?uat=0"), false);
  eq(L.isUatMode("?uat=2"), false);
  eq(L.isUatMode("?uat="), false);
  eq(L.isUatMode("?preview=1"), false);
  eq(L.isUatMode("?uat=1"), true);
  eq(L.isUatMode("?test=1&uat=1"), true);
  eq(L.isUatMode("https://jzkitchen.github.io/momoke-toothbrush/?uat=1"), true);
  eq(L.isUatMode("https://jzkitchen.github.io/momoke-toothbrush/?uat=1#home"), true);
  const st = L.emptyState();
  const before = JSON.stringify(st);
  eq(L.seasonUnlocked(st, "s2"), false);
  eq(L.seasonUnlocked(st, "s3"), false);
  eq(L.albumSeasonOpen(st, "s2", false), false);
  eq(L.albumSeasonOpen(st, "s3", false), false);
  eq(L.albumSeasonOpen(st, "s1", true), true);
  eq(L.albumSeasonOpen(st, "s2", true), true);
  eq(L.albumSeasonOpen(st, "s3", true), true);
  const locked = L.albumView(st, "s3", false);
  eq(locked.open, false);
  eq(locked.items.length, 0, "未預覽時第三季畫冊不列出卡片");
  const preview = L.albumView(st, "s3", true);
  eq(preview.open, true);
  eq(preview.items.length, 76, "預覽列出第三季全部 76 張");
  ok(preview.items.every((row) => row.revealed && !row.collected), "預覽看得到圖，但都算未收集");
  const types = { momoke: 0, princess: 0, still: 0 };
  preview.items.forEach((row) => { types[row.type]++; });
  eq(types.momoke, 20); eq(types.princess, 4); eq(types.still, 52);
  eq(JSON.stringify(st), before, "albumView / albumSeasonOpen 不改 state");
  eq(L.seasonUnlocked(st, "s3"), false, "預覽沒有真的解鎖第三季");
  st.collected.push({ id: "s1-m-01", t: 0, d: null, s: null });
  const mixed = L.albumView(st, "s1", false);
  const heart = mixed.items.find((row) => row.id === "s1-m-01");
  const other = mixed.items.find((row) => row.id === "s1-m-02");
  eq(heart.collected, true); eq(heart.revealed, true);
  eq(other.collected, false); eq(other.revealed, false, "平常未收集的卡仍然蓋住");
  const mixedUat = L.albumView(st, "s1", true);
  eq(mixedUat.items.filter((row) => row.revealed).length, 81);
  eq(mixedUat.items.filter((row) => row.collected).length, 1, "預覽不把未收集的卡算成已收集");
  console.log("✓ 家長預覽 ?uat=1：可翻看全部季度和卡片，不改收集進度");
}
// ---- 第四季《魔法鑰匙》（79 張 = 21 萌可 + 6 公主 + 52 劇照）----
{
  const crypto = require("crypto");
  const s4 = DATA.items.filter((i) => i.season === "s4");
  const S4 = L.season("s4") || {};
  const S4TOTAL = 79, S4FINAL = "s4-m-20", HELD = "s4-p-06", LATE = "s4-m-04", LATE_P = "s4-p-05";
  const EARLY = ["s4-m-01", "s4-m-02", "s4-m-03"];
  const PAIRS = { "s4-m-00": "s4-p-01", "s4-m-01": "s4-p-04", "s4-m-02": "s4-p-02", "s4-m-03": "s4-p-03", "s4-m-04": "s4-p-05", "s4-m-20": "s4-p-06" };
  const MOM_BLURB = {
  "s4-m-00": "本季換成花飾與蓬裙，拿著香水瓶，善良又重感情，句尾「啾」！",
  "s4-m-01": "溫柔體貼又愛和平，抱著雪人玩偶，句尾「好好」！",
  "s4-m-02": "充滿熱情卻有點急性子，拿著手鏡，句尾「啦啦」！",
  "s4-m-03": "愛發牢騷卻很誠實，拿著棉花糖，句尾「誠實」！",
  "s4-m-04": "代表幸運，拿著幸運魔杖，起初被關在箱子裏。",
  "s4-m-05": "做事總想快一點，拿著懷錶，句尾「快點」！",
  "s4-m-06": "最愛吃美食，拿著叉子和盤子，句尾「吞吞」！",
  "s4-m-07": "很有責任心的小消防員，拿著滅火器，句尾「滅火」！",
  "s4-m-08": "懵懵懂懂卻很關心病人，拿著醫藥箱，句尾「嗶卟」！",
  "s4-m-09": "最愛為大家加油，拿著綵帶球，句尾「加油」！",
  "s4-m-10": "最愛修理東西，拿著扳手和工具箱，句尾「修理」！",
  "s4-m-11": "愛嘗試新藥劑，拿著燒瓶和魔法杖，句尾「發明」！",
  "s4-m-12": "最愛設計衣服，拿著捲尺和人台模型，句尾「時尚」！",
  "s4-m-13": "很有正義感，拿著警哨和擴音器，句尾「站住」！",
  "s4-m-14": "最愛自由自在地游泳，拿著海螺，句尾「人魚」！",
  "s4-m-15": "最愛開派對，拿著派對喇叭和氣球，句尾「派對」！",
  "s4-m-16": "最愛幫忙做造型，拿著剪刀和梳子，句尾「剪剪」！",
  "s4-m-17": "容易生氣，拿著棒棒糖，句尾「氣氣」！",
  "s4-m-18": "最愛唱歌拉琴，拿著小提琴和樂譜，句尾「啊啊」！",
  "s4-m-19": "很優美的滑冰選手，拿著陀螺，句尾「轉轉」！",
  "s4-m-20": "本季拿著黑珍珠權杖，很疼愛珍珠，句尾「棒棒」！"
};
  const PRI_BLURB = {
  "s4-p-01": "樂美和愛心萌可一起變身成花神公主！",
  "s4-p-02": "樂美和熱情萌可一起變身成太陽公主！",
  "s4-p-03": "樂美和誠實萌可一起變身成彩雲公主！",
  "s4-p-04": "樂美和好好萌可一起變身成雪花公主！",
  "s4-p-05": "樂美和幸運萌可一起變身成暮光公主！",
  "s4-p-06": "樂美和奉獻萌可一起變身成迷宮公主！"
};
  const TITLES = [
  "迷迷糊糊，鑰匙萌可",
  "變身！花神公主",
  "暴食很危險，吞吞",
  "火熱滾燙的露營事件",
  "讓我來治癒你",
  "萌可醫院成立了",
  "加油加油，需要鼓勵",
  "幫我修好，修理萌可",
  "樂美和愛心萌可的身體互換了",
  "白雪樂美",
  "時尚萌可的服裝設計",
  "給我站住，警察萌可",
  "會闖禍的幸運餅乾",
  "撲通撲通，人魚萌可",
  "來場華麗的派對吧",
  "做個好髮型，美髮萌可",
  "爸爸的照相機",
  "要耍小脾氣，氣氣萌可",
  "尋找樂美的項鍊",
  "唱歌的歌聲萌可",
  "大家一起來玩吧，萌可遊樂園",
  "滑著冰，轉圈圈",
  "幸運萌可，登場！",
  "萌可時裝秀",
  "危機一觸即發，秘鑰之境",
  "再見，鑰匙萌可"
];
  const NAMES = [
  "愛心萌可",
  "好好萌可",
  "熱情萌可",
  "誠實萌可",
  "幸運萌可",
  "快快萌可",
  "吞吞萌可",
  "滅火萌可",
  "醫生萌可",
  "加油萌可",
  "修理萌可",
  "發明萌可",
  "時尚萌可",
  "警察萌可",
  "人魚萌可",
  "派對萌可",
  "美髮萌可",
  "氣氣萌可",
  "歌聲萌可",
  "滑冰萌可",
  "奉獻萌可"
];
  const HASHES = {
  "audio/s4_op.m4a": "5c42ee6e9e218f39918a4c1cf40673c6d613b9e9c79ddf7d3cf395ef24aeee87",
  "audio/s4_ed.m4a": "d5551d535ffc8dc481720fc80b5fb335da9e6f992054a463b6aea56f98397836",
  "img/s4_stills/ep07_b.jpg": "b7501dc9bb89ab7316adf2a8c106acadc66977005c59602d605f2e9483feffca",
  "img/s4_stills/ep19_b.jpg": "bb6463f1ca65da6246966f1ffd370843cad53b5ef0454009bc3cafc44c67a2d6",
  "img/s4_stills/ep09_b.jpg": "ef5676a2affa8ca72a54c8b0a69f1ac2624d24e908f130924bf470783e6132fe",
  "img/s4_stills/ep17_a.jpg": "ee969b44cc9b33f9c20ae411070f2897f2202d82d0c98d7ca05a2f73fb63727c",
  "img/s4_stills/ep05_a.jpg": "fd32eb9f2e7fb83d1985e3e6d2204e849ad4c8098a2f4dcba63dd09c98ece121",
  "img/s4_stills/ep04_b.jpg": "589ad4cee67c64324a581346a747eee5ba9affe4a667f599a9866e881ce3fbba",
  "img/s4_stills/ep26_b.jpg": "b5b823dc8100e40771bc2c0c003cf5e4dad3aa0e6cffa44810656b4c1d6a61d3",
  "img/s4_stills/ep22_b.jpg": "d8efef590638feed707c73a3e2c16da692191967b1259c0774d887203b733398",
  "img/s4_stills/ep16_a.jpg": "635cd5b6b377a50211093ec897da1d18c132d9aa5b3e22e46e3e48e2c501d2a5",
  "img/s4_stills/ep02_a.jpg": "c16a21f9288fadc6f5098a775025c6c0a8b621fb5f174cf67acf3a59c98ea679",
  "img/s4_stills/ep23_b.jpg": "b808473c2e3e64145c800ae660b0ca43a416978500fda9e4527b53bfc898ae46",
  "img/s4_stills/ep16_b.jpg": "e49078d13bd29fde9e53aeed83dfdd459083c6b71ce2214469d9660a61e58c7f",
  "img/s4_stills/ep15_b.jpg": "8b81584f32ea68cbf6cdea799f8cde39ea66d6cfa29c04c36e20416546aeb32b",
  "img/s4_stills/ep19_a.jpg": "9abd49497a851f437720657612edb751e16aa9a9d65eb473d174e09c062be1d5",
  "img/s4_stills/ep14_b.jpg": "4a2b9a8d698c2c8ef16c0f68e881c952fe08997843ca4bb6b1d21dc6d87048ba",
  "img/s4_stills/ep09_a.jpg": "6ac89cc55e496337d76678d59141314f859a6d1a3a1693c9c2831ec655f757b6",
  "img/s4_stills/ep17_b.jpg": "8fe595e855ce75e852a788303315dd77847a42e92db1eda3d43e726f482d13b2",
  "img/s4_stills/ep05_b.jpg": "60b3637f040ac42509b2f59161e6e351092081bbeb93771624417d50fcc28232",
  "img/s4_stills/ep24_b.jpg": "d3468b6ac0d328336df1fcad4d1be5db88e545bbe60455c9745cb7a51707b400",
  "img/s4_stills/ep03_a.jpg": "020d7bf6d091677eda50b64da19efc8f7adcd64cc5d0cf052f03f515a0b182b9",
  "img/s4_stills/ep10_b.jpg": "20b5a17396d2de176a85cb02f4e1c30133a639903c993dfbd70b60bcb3bc809c",
  "img/s4_stills/ep13_a.jpg": "ae75510307b434377bde8a7a2e18fb30e042d83062e287826ad3c2403af5863f",
  "img/s4_stills/ep23_a.jpg": "48b815e8c21f8bbee95f45c356d354b089339d9978a7d909ab0d2c776ea3de67",
  "img/s4_stills/ep13_b.jpg": "f8fa7c2c269e9a26544086aa1d317845fb846c5ebc63795a6bb4ce9b463aeeef",
  "img/s4_stills/ep03_b.jpg": "ed74b41beb7fc9b39eaea92447d58850ce1e86191eb276b9f9a0efa334e43e0c",
  "img/s4_stills/ep10_a.jpg": "bc446a94adced49ff1128c39b795df3d9e9b28c1595939204993ad46d3183079",
  "img/s4_stills/ep22_a.jpg": "57f305eeca140b6ad811d013ca757eefdf2c26915fdb8a627744a982f4c29783",
  "img/s4_stills/ep07_a.jpg": "dc54e3491903f2fd2c4eed022eedb58d6944153c81c8d2a3751423704298e31b",
  "img/s4_stills/ep12_a.jpg": "948bfb4305791999e75e1a3006bcbf5fd461ff5552f8cd75ed2d783179a88468",
  "img/s4_stills/ep04_a.jpg": "fe0567ca84cbb347bfaefec888c8ef072ac48b1368b885f9020c625687a1c2bf",
  "img/s4_stills/ep14_a.jpg": "7d3e974ea98b6f5cd909deafd6594b887b37e9d7c3d3bbf195ab09967ee9e019",
  "img/s4_stills/ep11_a.jpg": "9b3a50282f3c1122b7ec903a289507aebd6978b911bd45972f4b1f44e59a6359",
  "img/s4_stills/ep18_b.jpg": "af9fa02bb83899b49099382b2e0696902eb35c319c95d9a9a8cb3b82a5d1635e",
  "img/s4_stills/ep02_b.jpg": "bb55847fde66ea5d111a78d10dc0b643423ea75ae076d10ef59e1eeb61ea02df",
  "img/s4_stills/ep11_b.jpg": "9fd575c5bb65cb752dc4f030fb52cec7711148a66f9d795a628261d1431c4e62",
  "img/s4_stills/ep08_b.jpg": "5d579977b06679ddb59cfbef042b39b6a1e0a81f6c7d659adfb10e259cc6e64e",
  "img/s4_stills/ep12_b.jpg": "b85271203d4034f73f055af3005f83e2875bd3957eb39994fa80a4909765d3e0",
  "img/s4_stills/ep26_a.jpg": "f0ae89864fc5720aeae65de76844d5ab1a06771783289dc80bf46d15f58c940f",
  "img/s4_stills/ep20_a.jpg": "5533fa29bd8202a652c79d4df07c7e17d3a10556b34ac145218c66bbe1bf3043",
  "img/s4_stills/ep06_a.jpg": "77da2efcd07e7b94371533bb2323e1471c2673b4e7155feb766db81ce80b6506",
  "img/s4_stills/ep01_b.jpg": "eec99677e461614f18e83a62d2ea29264bf59d017af6c0aa9c0f680790a2c788",
  "img/s4_stills/ep01_a.jpg": "48f1ae30eea630d3c8cdf4386dadb338f51ed52765db86260bcf6f8c15aeefbe",
  "img/s4_stills/ep20_b.jpg": "ca9abb10a365aeccd627c68840bc7dfb1409b37e1e879ad40d06d01a05ade9da",
  "img/s4_stills/ep06_b.jpg": "d24cb8aff76dfa0a960aed388d481f623bf5f414f969ba24c3c3d83049540930",
  "img/s4_stills/ep15_a.jpg": "cbb62f8a51fe8ddb28330c77229523ef3ec56085e1bf67f3e1da7fb41bfb3d43",
  "img/s4_stills/ep08_a.jpg": "de3ee180487da218e547fb19e0ba3596605811cba6bca722eaf3b6107961a2c1",
  "img/s4_stills/ep21_a.jpg": "135d77ddddf61343e1d2cf63cffad596ddb7cb8aefde20414c6e740583bf3f3f",
  "img/s4_stills/ep25_a.jpg": "0be9eb34c73024db9bf03d182b8e0af2eddad67584adaff766e219381ba70bbb",
  "img/s4_stills/ep18_a.jpg": "f29cccf0315ed3935aad8ef9855ec16ef9e53680dc143fa8234ce7e6dffab308",
  "img/s4_stills/ep24_a.jpg": "940a9c59663e0602e23bcb8e56fb7f8fce8a33747039d257b15261826d9278bd",
  "img/s4_stills/ep21_b.jpg": "93bbd4775caf8423450f42610cd02a0024905d1c8c2acd7421f2137a6240de3f",
  "img/s4_stills/ep25_b.jpg": "cbfe326ae628d5d57ec405a2eba2f571e7fcf8c9af5086e527c7115213eb12a1",
  "img/s4_princess/06_migong.jpg": "33460a19bfd6754bd81cd242e9050bfc246c7ff2deab4c01aceae9fb087417c2",
  "img/s4_princess/02_taiyang.jpg": "e7af14081d6bdabf83bf35b7201ec34fd62f1e41fc9e4354ecbff0afff2ff522",
  "img/s4_princess/03_caiyun.jpg": "9955cd8d61bdb73fbcfb7e4db9e922c303d8f15c1148aae53356d78cbec67f4b",
  "img/s4_princess/04_xuehua.jpg": "1306a9ec2b3cf8cec8df309548ff804d98f10583d4406f2b502546fc636f4471",
  "img/s4_princess/05_muguang.jpg": "4449a8c0e9d498564315435958648529efe3a48960d6a3c67b4c212e8cd1792b",
  "img/s4_princess/01_huashen.jpg": "881e978026afea5456432ca0067e0cb60afb2b86a50e0265fe5b80268a860f49",
  "img/s4/04_xingyun.jpg": "9bdaedc571e99ee8eb412bc25d5590a905a95da17f8a9aaaca09d6e23090fd3a",
  "img/s4/08_yisheng.jpg": "d318d0526fb72d27125bc33150698fb70a3a285d676a88870c55dca32d67301c",
  "img/s4/07_miehuo.jpg": "ca56ee716c4d2f0be66231658d6d4b3a174d03857db55cd192eba44a51b59908",
  "img/s4/17_qiqi.jpg": "c55e0d3d17a8a3732c8058d8481da1d860a64cdda52b575810581f7d82b40c60",
  "img/s4/14_renyu.jpg": "8b4f1f5cb00fdbdfa4229feb9476bddeba8702bb020aebab38ce68af6390fa01",
  "img/s4/11_faming.jpg": "05583dd126bbceecedf199d9084af381a374518a81356eeedd311b73fdf84689",
  "img/s4/02_reqing.jpg": "878670a61a9914e3e9fbbbe1ac505fa12413f2f79f2c83a87badd74077c92bcc",
  "img/s4/01_haohao.jpg": "911a27801037951519916e90e12ce8f1b67ba788b7c33ae61fd1978dcd592aed",
  "img/s4/18_gesheng.jpg": "d69e23018ec6b56885ead02868a1abcbfbad7cce36de882520deb230e1740bec",
  "img/s4/00_aixin_s3.jpg": "d194dbcc12ac842248841b47ce3668f348b8d65debca18dc856952d5669e4b31",
  "img/s4/05_kuaikuai.jpg": "fa538e7bda148fda5d0d551c79836bf9eb011da910d16d5d2da72d4ab26c445f",
  "img/s4/20_fengxian.jpg": "c79ce4c0d333f8af8f57422e4a3c5ac706f3240a929226574d297f4df830fcfc",
  "img/s4/15_paidui.jpg": "8310f351928ab6060b33e26672edf0e23e860afa2e7df6e11da8201d13d9b854",
  "img/s4/03_chengshi.jpg": "ac591636da805e6fa511f6b5e5d962b34207bbff40b735ad891b264496018fc6",
  "img/s4/16_meifa.jpg": "8c90660d9aa1388182044ceeaae12bf2b34cde112fdd21a731d971d03c358758",
  "img/s4/19_huabing.jpg": "318ef69d572327b9fa90504cd01556998fffa2fbd4491fa51763199e05d4102b",
  "img/s4/09_jiayou.jpg": "ab3d8c98642329a6410abdcd14e72a6b4d942fcb0e3a5e3d184e48ae2e924108",
  "img/s4/13_jingcha.jpg": "985ef8725a989f0f87cd3b16a5a26548b44593a608471aa3ac6aef81136b7563",
  "img/s4/06_tuntun.jpg": "213111b8ec0f13aeefce1c526b67fa1fede9cbe180b3c2384b68ffbaff5762d9",
  "img/s4/10_xiuli.jpg": "e4d7515d6a9631a1a172e0618d423aff8274beccde402f3557a5ed91edbf2ab1",
  "img/s4/12_shishang.jpg": "e146313630bcefe11fc470f1f80f0d838af7bae370d44fb671bee6c2ceb95b50"
};

  eq(DATA.version, "v22", "data.js 版本 v22");
  eq(S4.id, "s4");
  eq(S4.name, "魔法鑰匙");
  ok(S4.open === true, "第四季 open");
  eq(S4.total, S4TOTAL);
  eq(S4.first && S4.first.length, 1);
  eq(S4.first && S4.first[0], "s4-m-00");
  eq(S4.earlyWindow, 24, "早期窗口 24：好好／熱情／誠實連同公主可在窗口內出完");
  eq(S4.finalItem, S4FINAL);
  eq(S4.completeTitle, "恭喜集齊魔法鑰匙！");
  eq(S4.lockedText, "魔法鑰匙 敬請期待");
  eq(S4.transform, undefined, "第四季沒有變身贈卡");
  eq(S4.music && S4.music.op && S4.music.op.src, "audio/s4_op.m4a");
  eq(S4.music.op.type, "audio/mp4");
  eq(S4.music.op.title, "魔法鑰匙");
  eq(S4.music.op.duration, 57.934);
  ok(!S4.music.op.instrumental, "片頭曲有人聲");
  eq(S4.music.home.src, "audio/s4_ed.m4a");
  eq(S4.music.home.type, "audio/mp4");
  eq(S4.music.home.title, "魔法鑰匙");
  eq(S4.music.home.instrumental, true);
  eq(S4.music.home.duration, 18.088);
  eq(L.season("s2").music, null, "第二季仍然沒有自己的歌");
  eq(L.season("s1").transform, undefined);
  eq(L.season("s2").transform.from, "s1-m-24");
  eq(L.season("s2").transform.to, "s2-m-01");
  eq(L.byId["s1-m-24"].name, "鬧鬧萌可");
  eq(L.byId["s2-m-01"].name, "幸福萌可");

  eq(s4.length, S4TOTAL, "第四季 79 張");
  eq(s4.filter((i) => i.type === "momoke").length, 21);
  eq(s4.filter((i) => i.type === "princess").length, 6);
  eq(s4.filter((i) => i.type === "still").length, 52);
  eq(DATA.items.filter((i) => i.season === "s1").length, 81, "第一季仍是 81 張");
  eq(DATA.items.filter((i) => i.season === "s2").length, 74, "第二季仍是 74 張");
  eq(DATA.items.filter((i) => i.season === "s3").length, 76, "第三季仍是 76 張");
  eq(L.season("s3").name, "閃亮寶石");
  eq(L.season("s3").total, 76);
  ok(DATA.items.filter((i) => i.season === "s3").every((i) => /^img\/s3_gem/.test(i.img)), "第三季圖片路徑維持 s3_gem");
  ok(!DATA.items.some((i) => /護士/.test((i.name || "") + (i.blurb || "") + i.id + (i.img || ""))), "沒有護士萌可");
  eq(new Set(DATA.items.map((i) => i.id)).size, DATA.items.length, "全部 id 不重複");

  const ms = s4.filter((i) => i.type === "momoke");
  assert.deepStrictEqual(ms.map((m) => m.name), NAMES, "第四季萌可名稱與次序");
  assert.deepStrictEqual(ms.map((m) => m.id), NAMES.map((_, i) => "s4-m-" + String(i).padStart(2, "0")));
  eq(ms.filter((m) => m.category === "royal").length, 6, "皇室六位（含奉獻）");
  eq(ms.filter((m) => m.category === "key").length, 15, "15 鑰匙萌可");
  ["s4-m-00", "s4-m-01", "s4-m-02", "s4-m-03", "s4-m-04", S4FINAL].forEach((id) => eq(L.byId[id].category, "royal", id));
  ms.filter((m) => m.category === "key").forEach((m) => ok(!m.princess, m.id + " 不是皇室"));
  ms.forEach((m) => {
    eq(m.blurb, MOM_BLURB[m.id], "萌可簡介原文 " + m.id);
    eq(m.type, "momoke");
    eq(m.season, "s4");
    ok(/^img\/s4\//.test(m.img), m.img);
  });
  const ps = s4.filter((i) => i.type === "princess");
  eq(ps.map((p) => p.id).join(","), "s4-p-01,s4-p-02,s4-p-03,s4-p-04,s4-p-05,s4-p-06");
  eq(ps.map((p) => p.name).join(","), "花神公主,太陽公主,彩雲公主,雪花公主,暮光公主,迷宮公主");
  Object.entries(PAIRS).forEach(([royal, princess]) => {
    eq(L.byId[royal].princess, princess);
    eq(L.byId[princess].royal, royal);
    eq(L.byId[princess].blurb, PRI_BLURB[princess], "公主簡介 " + princess);
    eq(L.byId[princess].type, "princess");
    ok(/^img\/s4_princess\//.test(L.byId[princess].img));
  });
  const stl = s4.filter((i) => i.type === "still");
  const efiles = [];
  for (let e = 1; e <= 26; e++) for (const ab of ["a", "b"]) efiles.push("ep" + String(e).padStart(2, "0") + "_" + ab + ".jpg");
  assert.deepStrictEqual(stl.map((x) => path.basename(x.img)), efiles, "第四季劇照次序");
  eq(TITLES.length, 26);
  stl.forEach((x) => {
    eq(x.name, TITLES[x.ep - 1], x.id + " name");
    eq(x.blurb, "第" + x.ep + "集〈" + TITLES[x.ep - 1] + "〉", x.id + " blurb");
    eq(x.id, "s4-still-ep" + String(x.ep).padStart(2, "0") + path.basename(x.img).slice(-5, -4), x.id);
    ok(/^img\/s4_stills\//.test(x.img));
  });

  function jpegSize(file) {
    const b = fs.readFileSync(file);
    let i = 2;
    while (i < b.length - 8) {
      if (b[i] !== 0xFF) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
      i += 2 + b.readUInt16BE(i + 2);
    }
    throw new Error("不是 JPEG " + file);
  }
  Object.entries(HASHES).forEach(([rel, hex]) => {
    const abs = path.join(__dirname, "..", rel);
    ok(fs.existsSync(abs), "檔案存在 " + rel);
    const got = crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
    eq(got, hex, "原檔未改 " + rel);
  });
  eq(crypto.createHash("md5").update(fs.readFileSync(path.join(__dirname, "..", "img/s4/00_aixin_s3.jpg"))).digest("hex"),
    "4fc07016495db53c6cccc163e430808b", "第四季愛心萌可 md5");
  s4.forEach((i) => {
    const wh = jpegSize(path.join(__dirname, "..", i.img));
    if (i.type === "still") { eq(wh.w, 1280, i.img); eq(wh.h, 720, i.img); }
    else { eq(wh.w, 1080, i.img); eq(wh.h, 1080, i.img); }
  });
  const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  ok(/\(self\.MOMOKE_DATA\.items \|\| \[\]\)/.test(sw), "卡片圖由 sw.js 跟 data.js 快取");
  ok(/s\.music\[k\]\.src/.test(sw), "季節音樂由 sw.js 快取");
  eq((/var VERSION = "(v\d+)"/.exec(sw) || [])[1], "v22", "sw.js VERSION v22");

  const priorSeasons = () => DATA.items.filter((it) => it.season === "s1" || it.season === "s2" || it.season === "s3");
  const baseS3 = () => {
    const st = L.emptyState();
    priorSeasons().forEach((it) => st.collected.push({ id: it.id, t: 0, d: "2027-03-01", s: null }));
    return st;
  };
  {
    const locked = baseS3();
    locked.collected = locked.collected.filter((c) => c.id !== "s3-m-20");
    eq(L.collectedIn(locked, "s3").length, 75);
    ok(!L.seasonUnlocked(locked, "s4"), "75/76：第四季未開放");
    eq(L.applyUnlocks(locked, 0).length, 0);
    eq(L.albumSeasonOpen(locked, "s4", false), false);
    const closed = L.albumView(locked, "s4", false);
    eq(closed.open, false);
    eq(closed.items.length, 0, "未解鎖畫冊不列出魔法鑰匙");
    const before = JSON.stringify(locked);
    eq(L.isUatMode("?uat=1"), true);
    eq(L.albumSeasonOpen(locked, "s1", true), true);
    eq(L.albumSeasonOpen(locked, "s2", true), true);
    eq(L.albumSeasonOpen(locked, "s3", true), true);
    eq(L.albumSeasonOpen(locked, "s4", true), true);
    const preview = L.albumView(locked, "s4", true);
    eq(preview.open, true);
    eq(preview.items.length, 79, "預覽列出第四季 79 張");
    ok(preview.items.every((row) => row.revealed && !row.collected), "預覽看得到、但不算已收集");
    const types = { momoke: 0, princess: 0, still: 0 };
    preview.items.forEach((row) => { types[row.type]++; });
    eq(types.momoke, 21); eq(types.princess, 6); eq(types.still, 52);
    eq(L.albumView(locked, "s1", true).items.length, 81);
    eq(L.albumView(locked, "s2", true).items.length, 74);
    eq(L.albumView(locked, "s3", true).items.length, 76);
    eq(JSON.stringify(locked), before, "?uat=1 不寫入收集");
    ok(!L.seasonUnlocked(locked, "s4"), "預覽沒有真的解鎖第四季");
    eq(L.currentSeasonId(locked), "s3");
    eq(L.drawNext(locked, rng(1)), "s3-m-20", "未集齊第三季時下一張仍是奉獻萌可");
  }
  {
    const st = baseS3();
    ok(L.isSeasonComplete(st, "s3"));
    ok(L.seasonUnlocked(st, "s4"), "集齊第三季後開放第四季");
    ok(!L.collectedSet(st)["s4-m-00"]);
    eq(L.collectedIn(st, "s4").length, 0, "第四季進度 0/79");
    eq(L.applyUnlocks(st, T("2027-03-02T08:00")).length, 0, "不贈送 s4-m-00");
    ok(!L.collectedSet(st)["s4-m-00"], "收集裡沒有第四季愛心萌可");
    eq(L.pendingNews(st), null, "沒有變身通知");
    eq(L.season("s4").transform, undefined);
    eq(L.drawNext(st, rng(2)), "s4-m-00", "下一張刷牙是第四季愛心萌可");
    eq(L.drawNextS4(st.collected.map((c) => c.id), rng(2)), "s4-m-00");
    eq(L.currentSeasonId(st), "s4");
    eq(L.displaySeasonId(st), "s4");
    eq(L.collectedIn(st, "s1").length, 81);
    eq(L.collectedIn(st, "s2").length, 74);
    eq(L.collectedIn(st, "s3").length, 76, "第三季 76 張仍在");
    const album = L.albumView(st, "s4", false);
    eq(album.open, true);
    eq(album.items.length, 79);
    eq(album.items.filter((row) => row.collected).length, 0, "畫冊 0/79");
    st.collected.push({ id: "s4-m-00", t: 0, d: null, s: "m" });
    eq(L.drawNext(st, rng(3)), "s4-p-01", "得到愛心萌可後下一張是花神公主");
    eq(L.drawNextS4(st.collected.map((c) => c.id), rng(3)), "s4-p-01");
  }
  {
    const st = baseS3();
    st.collected = st.collected.filter((c) => c.id !== "s3-m-20");
    const r = L.recordBrush(st, T("2027-03-01T08:00"), T("2027-03-01T08:02"), rng(4));
    eq(r.kind, "capture");
    eq(r.item.id, "s3-m-20");
    eq(r.number, 76);
    eq(r.seasonComplete, "s3");
    eq(r.unlock, null, "集齊第三季不變成、不贈卡");
    eq(st.days["2027-03-01"].mc, "s3-m-20", "日曆記刷牙得到的奉獻萌可");
    eq(L.cardsOnDay(st.days["2027-03-01"]), 1);
    eq(L.collectedIn(st, "s4").length, 0);
    eq(L.collectedSet(st)["s3-m-20"], true);
    ok(!L.collectedSet(st)["s4-m-00"]);
    eq(L.pendingNews(st), null);
    ok(L.seasonUnlocked(st, "s4"));
    eq(L.planBrush(st, T("2027-03-01T20:00"), rng(5)).id, "s4-m-00", "晚上那一次刷牙先抽第四季愛心萌可");
  }

  const earlyIds = new Set(["s4-m-00", "s4-p-01"].concat(EARLY, EARLY.map((id) => PAIRS[id])));
  const checkS4 = (seq, label) => {
    eq(seq.length, S4TOTAL, label + " 共 79 張");
    eq(new Set(seq).size, S4TOTAL, label + " 不重複");
    eq(seq[0], "s4-m-00", label + " 第 1 張愛心萌可");
    eq(seq[1], "s4-p-01", label + " 第 2 張花神公主");
    eq(seq[S4TOTAL - 2], HELD, label + " 倒數第二是迷宮公主");
    eq(seq[S4TOTAL - 1], S4FINAL, label + " 最後是奉獻萌可");
    ok(seq.every((x) => L.byId[x].season === "s4"), label + " 只有第四季");
    ["s4-m-00", "s4-m-01", "s4-m-02", "s4-m-03", LATE].forEach((royal) => {
      eq(seq[seq.indexOf(royal) + 1], PAIRS[royal], label + " " + L.byId[royal].name + " 之後緊接公主");
    });
    eq(seq.indexOf(HELD), seq.indexOf(S4FINAL) - 1, label + " 迷宮緊接在奉獻之前");
    ok(seq.indexOf(HELD) > seq.indexOf(LATE_P), label + " 迷宮在暮光之後");
    for (let i = 0; i < S4.earlyWindow; i++) {
      const it = L.byId[seq[i]];
      ok(it.type === "still" || earlyIds.has(seq[i]), label + " 窗口內 @" + i + " 是 " + seq[i]);
    }
    EARLY.forEach((id) => ok(seq.indexOf(PAIRS[id]) < S4.earlyWindow, label + " " + L.byId[id].name + " 的公主在第 " + S4.earlyWindow + " 張內"));
    ok(seq.indexOf(LATE) >= S4.earlyWindow, label + " 幸運在早期窗口之後");
    ok(seq.indexOf(LATE_P) >= S4.earlyWindow, label + " 暮光在早期窗口之後");
    eq(seq.indexOf(LATE_P), seq.indexOf(LATE) + 1, label + " 暮光緊接幸運");
    s4.filter((i) => i.category === "key").forEach((i) => ok(seq.indexOf(i.id) >= S4.earlyWindow, label + " " + i.name + " 在窗口之後"));
    ok(!seq.slice(0, S4.earlyWindow).includes(LATE), label + " 幸運不在早期窗口");
    ok(!seq.slice(0, S4.earlyWindow).includes(S4FINAL), label + " 奉獻不在早期窗口");
    ok(!seq.slice(0, S4.earlyWindow).includes(HELD), label + " 迷宮不在早期窗口");
  };

  let earlyPos = 0, earlyN = 0, stillBefore = 0, midStill = 0;
  const RUNS = 2000;
  for (let run = 0; run < RUNS; run++) {
    const R = rng(800000 + run);
    const st = baseS3();
    eq(L.applyUnlocks(st, 0).length, 0, "模擬前不贈送第四季愛心萌可");
    ok(!L.collectedSet(st)["s4-m-00"]);
    const seq = [];
    let id;
    while (L.collectedIn(st, "s4").length < S4TOTAL && (id = L.drawNext(st, R))) {
      st.collected.push({ id, t: 0, d: null, s: null });
      seq.push(id);
      st.pending = null;
      ok(seq.length <= S4TOTAL, "不可多於 79 張");
    }
    checkS4(seq, "模擬 " + run);
    eq(L.drawNext(st, R), null, "四季集齊後不再抽");
    eq(L.currentSeasonId(st), null, "四季集齊後沒有下一季");
    EARLY.forEach((id) => { earlyPos += seq.indexOf(id) + 1; earlyN++; });
    const lastEarly = Math.max.apply(null, EARLY.map((id) => seq.indexOf(id)));
    if (seq.slice(0, lastEarly).some((id) => L.byId[id].type === "still")) stillBefore++;
    if (L.byId[seq[S4.earlyWindow]].type === "still") midStill++;
    if (run === 0) {
      const seq2 = [];
      const R2 = rng(800000);
      for (;;) {
        const id2 = L.drawNextS4(seq2, R2);
        if (!id2) break;
        seq2.push(id2);
        ok(seq2.length <= S4TOTAL, "drawNextS4 不超抽");
      }
      assert.deepStrictEqual(seq2, seq, "drawNextS4 與 drawNext 同一序列");
    }
  }
  ok(earlyPos / earlyN < 14, "好好／熱情／誠實平均偏早 (" + (earlyPos / earlyN).toFixed(1) + ")");
  ok(stillBefore / RUNS > 0.5, "劇照會穿插在早期皇室之間 (" + (stillBefore / RUNS).toFixed(2) + ")");
  const midP = 36 / 52;
  ok(Math.abs(midStill / RUNS - midP) < 0.05, "窗口之後鑰匙萌可、幸運與剩下的劇照平均混合 (" + (midStill / RUNS).toFixed(3) + ")");
  for (const fixed of [0, 0.999999, 0.5]) {
    const st = baseS3();
    eq(L.applyUnlocks(st, 0).length, 0);
    const seq = [];
    let id;
    while (L.collectedIn(st, "s4").length < S4TOTAL && (id = L.drawNext(st, () => fixed))) {
      st.collected.push({ id, t: 0, d: null, s: null });
      seq.push(id);
    }
    checkS4(seq, "固定亂數 " + fixed);
  }

  {
    const plain = Date.UTC(2026, 9, 23, 4);
    const st = baseS3();
    eq(L.applyUnlocks(st, 0).length, 0, "第四季歌曲不依賴贈卡");
    eq(L.songFor(st, "op", plain).src, "audio/s4_op.m4a", "第四季刷牙播片頭曲");
    eq(L.songFor(st, "op", plain).season, "s4");
    eq(L.songFor(st, "op", plain).title, "魔法鑰匙");
    eq(L.songFor(st, "home", plain).src, "audio/s4_ed.m4a", "第四季首頁播片尾純音樂");
    eq(L.songFor(st, "home", plain).instrumental, true);
    eq(L.songFor(st, "home", plain).kind, "home");
    const hw = Date.UTC(2026, 9, 28, 4);
    eq(L.isHalloween(hw), true);
    eq(L.songFor(st, "op", hw).src, "audio/halloween.m4a", "萬聖節仍覆寫第四季刷牙歌");
    eq(L.songFor(st, "home", hw).src, "audio/halloween.m4a", "萬聖節仍覆寫第四季首頁歌");
    eq(L.songFor(st, "home", hw).season, "halloween");
    const xm = Date.UTC(2026, 11, 24, 4);
    eq(L.isChristmas(xm), true);
    eq(L.christmasFor(xm).trackId, "teeniepingmas");
    eq(L.songFor(st, "op", xm).src, "audio/christmas/teeniepingmas.m4a", "聖誕仍覆寫第四季刷牙歌");
    eq(L.songFor(st, "home", xm).src, "audio/christmas/teeniepingmas.m4a", "聖誕仍覆寫第四季首頁歌");
    eq(L.songFor(st, "home", xm).season, "christmas");
    eq(L.songFor(st, "home", xm).src, L.songFor(st, "op", xm).src);
    const s2st = L.emptyState();
    DATA.items.filter((i) => i.season === "s1").forEach((i) => s2st.collected.push({ id: i.id, t: 0, d: null, s: null }));
    L.applyUnlocks(s2st, 0);
    eq(L.currentSeasonId(s2st), "s2");
    eq(L.songFor(s2st, "op", plain).src, "audio/s1_op.m4a", "第二季沒有歌時刷牙沿用第一季");
    eq(L.songFor(s2st, "home", plain).src, "audio/s1_home.m4a", "第二季沒有歌時首頁沿用第一季純音樂");
    const s3st = L.emptyState();
    DATA.items.filter((i) => i.season === "s1" || i.season === "s2").forEach((i) => s3st.collected.push({ id: i.id, t: 0, d: null, s: null }));
    eq(L.applyUnlocks(s3st, 0).length, 0, "第三季進行中不贈送愛心萌可");
    eq(L.currentSeasonId(s3st), "s3");
    eq(L.songFor(s3st, "op", plain).src, "audio/s3_gem_op.m4a", "第三季進行中仍播閃亮寶石片頭");
    eq(L.songFor(s3st, "home", plain).src, "audio/s3_gem_ed.m4a", "第三季進行中仍播閃亮寶石片尾");
  }
  console.log("✓ 第四季：79 張、愛心第 1、花神第 2、好好／熱情／誠實在窗口內且公主緊接、幸運與暮光在窗口後、迷宮緊接奉獻之前、奉獻最後、第三季集齊後開放但不贈卡、預覽不改進度、節日覆寫仍在（早期皇室平均位置 " + (earlyPos / earlyN).toFixed(1) + "）");
}

// ---- 解鎖贈卡：只保留第一季 → 第二季的「鬧鬧變成幸福」----
{
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  ok(html.includes("鬧鬧萌可變成幸福萌可了！"), "解鎖畫面預設文案仍是鬧鬧萌可變成幸福萌可了");
  const s1only = L.emptyState();
  DATA.items.filter((it) => it.season === "s1" && it.id !== "s1-m-24").forEach((it) => s1only.collected.push({ id: it.id, t: 0, d: null, s: null }));
  const done1 = L.recordBrush(s1only, T("2026-10-01T08:00"), T("2026-10-01T08:02"), rng(11));
  eq(done1.seasonComplete, "s1");
  eq(done1.unlock && done1.unlock.from && done1.unlock.from.id, "s1-m-24");
  eq(done1.unlock.item.id, "s2-m-01");
  eq(done1.unlock.from.name + "變成" + done1.unlock.item.name + "了！", "鬧鬧萌可變成幸福萌可了！");
  eq(L.pendingNews(s1only), "s2");
  eq(L.collectedIn(s1only, "s2").length, 1);
  eq(L.season("s2").transform.from, "s1-m-24");
  eq(L.season("s2").transform.to, "s2-m-01");

  const s2done = L.emptyState();
  DATA.items.filter((it) => it.season === "s1" || it.season === "s2").forEach((it) => s2done.collected.push({ id: it.id, t: 0, d: null, s: null }));
  eq(L.applyUnlocks(s2done, T("2026-12-01T08:00")).length, 0);
  ok(L.seasonUnlocked(s2done, "s3"));
  eq(L.collectedIn(s2done, "s3").length, 0, "第三季 0/76");
  ok(!L.collectedSet(s2done)["s3-m-01"]);
  eq(L.pendingNews(s2done), null);
  eq(L.season("s3").transform, undefined);
  eq(L.season("s3").first[0], "s3-m-01");
  eq(L.drawNext(s2done, rng(12)), "s3-m-01", "第三季解鎖後第一次刷牙抽愛心萌可");

  const s3done = L.emptyState();
  DATA.items.filter((it) => it.season === "s1" || it.season === "s2" || it.season === "s3").forEach((it) => s3done.collected.push({ id: it.id, t: 0, d: null, s: null }));
  eq(L.applyUnlocks(s3done, T("2027-03-01T08:00")).length, 0);
  ok(L.seasonUnlocked(s3done, "s4"));
  eq(L.collectedIn(s3done, "s4").length, 0, "第四季 0/79");
  ok(!L.collectedSet(s3done)["s4-m-00"]);
  eq(L.pendingNews(s3done), null);
  eq(L.season("s4").transform, undefined);
  eq(L.season("s4").first[0], "s4-m-00");
  eq(L.drawNext(s3done, rng(13)), "s4-m-00", "第四季解鎖後第一次刷牙抽愛心萌可");
  console.log("✓ 解鎖：S1 仍贈幸福萌可並沿用變成文案；S2／S3 只開放下一季，不贈卡、不變身，下一抽仍是該季愛心萌可");
}
console.log(`全部測試通過（${checks} 項斷言）`);
