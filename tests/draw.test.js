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
      for (const hm of ["T07:00", "T20:00"]) { if (L.collectedIn(st, "s2").length >= S2TOTAL) break; const r = L.recordBrush(st, T(k + hm), T(k + hm) + 120000, R); ok(r.kind === "capture" || r.kind === "again"); if (r.kind === "capture") { if (r.item.id === S2FINAL) ok(r.unlock && r.unlock.item.id === "s3-m-01" && r.seasonComplete === "s2"); else eq(r.unlock, null); } }
      d.setDate(d.getDate() + 1);
    }
    eq(L.collectedIn(st, "s2").length, S2TOTAL); eq(L.collectedIn(st, "s3").length, 1, "集齊第二季時送出第三季第 1 張");
    eq(st.collected.length, TOTAL + S2TOTAL + 1);
    eq(st.collected[st.collected.length - 1].id, "s3-m-01");
    eq(new Set(st.collected.map((c) => c.id)).size, TOTAL + S2TOTAL + 1, "兩季加贈禮不重複");
    const s2ids = st.collected.filter((c) => L.byId[c.id].season === "s2").map((c) => c.id);
    eq(s2ids[0], "s2-m-01"); eq(s2ids[1], "s2-p-01"); eq(s2ids[S2TOTAL - 2], "s2-p-02"); eq(s2ids[S2TOTAL - 1], S2FINAL);
    ok(L.isSeasonComplete(st, "s2") && L.isSeasonComplete(st, "s1"));
    eq(L.currentSeasonId(st), "s3"); eq(L.displaySeasonId(st), "s3");
    const k2 = L.ymd(d);
    const pc = L.planBrush(st, T(k2 + "T08:00"), R); ok(pc.earn && pc.id === "s3-p-01", "下一張是鑽石公主");
    eq(L.songFor(st, "op", Date.UTC(2026,9,23,4)).src, "audio/s3_gem_op.m4a", "第三季刷牙播片頭曲");
    eq(L.songFor(st, "home", Date.UTC(2026,9,23,4)).src, "audio/s3_gem_ed.m4a", "第三季首頁播純音樂");
    eq(L.normalizeState(JSON.parse(JSON.stringify(st))).collected.length, TOTAL + S2TOTAL + 1);
  }
  // 第二季最後一張的 seasonComplete
  { const st = baseS1(); L.applyUnlocks(st, 0); st.collected.push(...s2.filter((i) => i.id !== S2FINAL && i.id !== "s2-m-01").map((i) => ({ id: i.id, t: 0, d: null, s: null })));
    eq(L.collectedIn(st, "s2").length, 73);
    const r = L.recordBrush(st, T("2026-12-01T08:00"), T("2026-12-01T08:02"), rng(3));
    eq(r.item.id, S2FINAL); eq(r.number, 74); eq(r.seasonComplete, "s2"); eq(r.unlock && r.unlock.item.id, "s3-m-01"); eq(r.unlock.from.id, "s2-m-20"); }

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
  eq(S3.transform.from, "s2-m-20"); eq(S3.transform.to, "s3-m-01");
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
    eq(L.applyUnlocks(st, T("2026-12-02T08:00")).length, 1);
    eq(st.collected[st.collected.length - 1].id, "s3-m-01");
    eq(L.applyUnlocks(st, 0).length, 0, "只送一次");
    const seq = ["s3-m-01"];
    let id;
    while (L.collectedIn(st, "s3").length < S3TOTAL && (id = L.drawNext(st, R))) {
      st.collected.push({ id, t: 0, d: null, s: null }); seq.push(id); st.pending = null;
      ok(seq.length <= S3TOTAL, "不可多於 76 張");
    }
    checkS3(seq, "模擬 " + run);
    eq(L.currentSeasonId(st), null, "三季集齊後不再抽");
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
    const st = baseS2(); L.applyUnlocks(st, 0);
    const seq = ["s3-m-01"]; let id;
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
    eq(L.applyUnlocks(n, T("2026-12-03T08:00")).length, 1);
    eq(n.collected[n.collected.length - 1].id, "s3-m-01"); eq(n.news[0], "s3");
    assert.deepStrictEqual(n.collected.slice(0, prior.length).map((c) => c.id), prior, "贈禮只加在後面");
    eq(n.days["2026-11-01"].mc, "s1-m-01"); eq(n.days["2026-11-01"].ec, "s2-m-02"); }
  { const st = baseS2(); L.applyUnlocks(st, 0);
    s3.filter((i) => i.id !== S3FINAL && i.id !== "s3-m-01").forEach((i) => st.collected.push({ id: i.id, t: 0, d: null, s: null }));
    eq(L.collectedIn(st, "s3").length, 75);
    const r = L.recordBrush(st, T("2027-02-01T08:00"), T("2027-02-01T08:02"), rng(9));
    eq(r.item.id, S3FINAL); eq(r.number, 76); eq(r.seasonComplete, "s3"); eq(r.unlock, null);
    const pc = L.planBrush(st, T("2027-02-01T20:00")); ok(!pc.earn && pc.reason === "complete");
    eq(L.recordBrush(st, T("2027-02-01T20:00"), T("2027-02-01T20:02")).kind, "all-done");
    const hw = Date.UTC(2026, 9, 28, 4);
    eq(L.songFor(st, "op", hw).src, "audio/halloween.m4a", "萬聖節覆寫刷牙歌");
    eq(L.songFor(st, "home", hw).src, "audio/halloween.m4a", "萬聖節覆寫首頁歌");
    eq(L.songFor(st, "home", hw).season, "halloween");
    eq(L.songFor(st, "op", Date.UTC(2026, 9, 23, 4)).src, "audio/s3_gem_op.m4a");
    eq(L.songFor(st, "home", Date.UTC(2026, 9, 23, 4)).src, "audio/s3_gem_ed.m4a"); }
  console.log("✓ 第三季：76 張、愛心第 1、鑽石第 2、笑笑／信信／贊贊偏早且公主緊接、寶石萌可中段、劇照穿插、奉獻最後、第二季集齊後贈送、舊進度保留、萬聖節仍覆寫");
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
console.log(`全部測試通過（${checks} 項斷言）`);
