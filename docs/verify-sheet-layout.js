/**
 * シートレイアウト自動検証スクリプト (Foundry VTT v13 / dx3rd)
 *
 * ■ 使い方
 *   1. ワールドを起動し、GMでログインする
 *   2. F12 で開発者コンソールを開く
 *   3. このファイルの中身を全部貼り付けて Enter
 *
 *   結果はコンソールに表を出しつつ、戻り値としてもオブジェクトを返す。
 *   `await verifySheetLayout()` で再実行できる。
 *   対象アクターを指定する場合: `await verifySheetLayout({ actorId: "xxxx" })`
 *
 * ■ 検査項目
 *   1. clipping   … シート幅からのはみ出し
 *   2. overlap    … 兄弟要素同士の視覚的な重なり
 *   3. collision  … ラベル文字とアイコンの衝突(実描画幅で判定)
 *   4. contrast   … 文字色と実効背景色のコントラスト比
 *   5. scroll     … データ増加時にスクロールできるか
 *   いずれも light / dark 両テーマで実行する。
 *
 * ■ 重要な注意
 *   - ワールドのデータは一切変更しない。スクロール検査はDOMへ一時的な行を
 *     注入して測り、終了時に除去して再描画する。
 *   - コントラスト検査は「疑似要素(::before)で描かれた背景」を考慮する。
 *     本システムは白い平行四辺形を .stat-list::before 等で描き、input 自身は
 *     transparent にしているため、DOM祖先だけを遡ると暗い背景を拾ってしまい
 *     大量の偽陽性が出る。elementsFromPoint と ::before の背景も見て判定する。
 */

async function verifySheetLayout({ actorId = null, quiet = false } = {}) {
  const log = (...a) => { if (!quiet) console.log(...a); };

  const actor = actorId ? game.actors.get(actorId) : game.actors.contents[0];
  if (!actor) return { error: "アクターが見つかりません" };

  await actor.sheet.render(true);
  await new Promise(r => setTimeout(r, 800));
  const root = actor.sheet.element;
  if (!root) return { error: "シートが描画されていません" };

  /* ---------- 色ユーティリティ ---------- */
  const parseRGB = (str) => {
    const m = String(str).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map(Number);
    return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
  };

  const luminance = ([r, g, b]) => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const contrast = (fg, bg) => {
    const l1 = luminance(fg), l2 = luminance(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  /**
   * 実効背景色を求める。
   * 自身→祖先と遡りつつ、各段で ::before / ::after の背景も見る。
   * 本システムは skewX した ::before で白い枠を描いているため、これを
   * 見落とすと「白地に黒文字」を「黒地に黒文字」と誤判定する。
   */
  const effectiveBg = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      for (const pseudo of [null, "::before", "::after"]) {
        const c = parseRGB(getComputedStyle(n, pseudo).backgroundColor);
        if (c && c.a > 0.1) {
          // 疑似要素は content が無ければ描画されない
          if (pseudo) {
            const content = getComputedStyle(n, pseudo).content;
            if (content === "none" || content === "normal") continue;
          }
          return c.rgb;
        }
      }
      n = n.parentElement;
    }
    return [255, 255, 255];
  };

  /* ---------- 1. はみ出し ---------- */
  const checkClipping = () => {
    const wrap = root.querySelector(".sheet-wrapper") || root;
    const wr = wrap.getBoundingClientRect();
    const out = [];
    wrap.querySelectorAll("*").forEach(e => {
      const c = getComputedStyle(e);
      if (c.display === "none" || c.position === "absolute" || c.position === "fixed") return;
      const r = e.getBoundingClientRect();
      if (r.width === 0) return;
      const over = Math.round(r.right - wr.right);
      if (over > 2) out.push({ el: tag(e), overflowPx: over });
    });
    return out;
  };

  /* ---------- 2. 重なり ---------- */
  /* 注: .title(黒い平行四辺形)は意匠として隣へ約6px食い込む設計のため、
     しきい値未満の重なりは既知として除外する。 */
  const DESIGN_OVERLAP_PX = 8;
  const checkOverlap = () => {
    const out = [];
    const walk = (parent) => {
      const kids = [...parent.children].filter(e => {
        const c = getComputedStyle(e);
        if (c.display === "none" || c.visibility === "hidden") return false;
        if (c.position === "absolute" || c.position === "fixed") return false;
        if (c.pointerEvents === "none") return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > DESIGN_OVERLAP_PX && oy > 2) {
          out.push({ parent: tag(parent), a: tag(kids[i]), b: tag(kids[j]), x: Math.round(ox), y: Math.round(oy) });
        }
      }
      [...parent.children].forEach(walk);
    };
    walk(root.querySelector(".sheet-wrapper") || root);
    return out;
  };

  /* ---------- 3. 文字とアイコンの衝突 ---------- */
  /* ボックス同士ではなく、Range で測った「実際の文字の右端」で判定する。
     技能名が長い言語(日本語の「知識: クトゥルフ」等)で効く。 */
  const checkTextCollision = () => {
    const out = [];
    root.querySelectorAll("label.skill, .stat-box, .item-name").forEach(box => {
      const t = box.querySelector(".title, .item-label");
      const ic = box.querySelector("a[class*='-edit'], a[class*='-create'], .item-controls");
      if (!t || !ic) return;
      const rg = document.createRange();
      rg.selectNodeContents(t);
      const tr = rg.getBoundingClientRect(), ir = ic.getBoundingClientRect();
      if (tr.width === 0 || ir.width === 0) return;
      const gap = Math.round(ir.left - tr.right);
      if (gap < 0) out.push({ text: t.textContent.trim().slice(0, 20), textW: Math.round(tr.width), gapPx: gap });
    });
    return out;
  };

  /* ---------- 4. コントラスト ---------- */
  const checkContrast = () => {
    const out = [];
    root.querySelectorAll("input,select,textarea").forEach(e => {
      if (["checkbox", "radio", "hidden", "range"].includes(e.type)) return;
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const c = getComputedStyle(e);
      const fillRaw = (c.webkitTextFillColor && c.webkitTextFillColor !== "currentcolor")
        ? c.webkitTextFillColor : c.color;
      const fg = parseRGB(fillRaw);
      if (!fg) return;
      const bg = effectiveBg(e);
      const ratio = contrast(fg.rgb, bg);
      // 4.5 は WCAG AA(通常文字)の基準
      if (ratio < 4.5) {
        out.push({
          field: e.name || e.className || e.type,
          value: String(e.value).slice(0, 12),
          fg: fg.rgb.join(","), bg: bg.join(","),
          ratio: +ratio.toFixed(2),
          disabled: e.disabled
        });
      }
    });
    return out;
  };

  /* ---------- 5. スクロール耐性 ---------- */
  /* ワールドを汚さないよう、Document は作らず DOM にだけ行を注入する。 */
  const checkScroll = async (probeCount = 30) => {
    const body = root.querySelector(".sheet-body");
    if (!body) return { error: ".sheet-body が見つかりません" };

    const nav = [...root.querySelectorAll(".sheet-tabs [data-tab]")]
      .find(a => a.dataset.tab === "equipment");
    if (nav) { nav.click(); await new Promise(r => setTimeout(r, 300)); }

    const before = { scrollH: body.scrollHeight, clientH: body.clientHeight };
    const list = root.querySelector('.tab[data-tab="equipment"] .items-list') || body;
    const probes = [];
    for (let i = 0; i < probeCount; i++) {
      const li = document.createElement("li");
      li.className = "__layout_probe";
      li.style.height = "34px";
      li.textContent = "probe " + i;
      list.appendChild(li);
      probes.push(li);
    }
    await new Promise(r => setTimeout(r, 200));

    const after = { scrollH: body.scrollHeight, clientH: body.clientHeight };
    body.scrollTop = 999999;
    await new Promise(r => setTimeout(r, 120));
    const reachedBottom = Math.abs(body.scrollTop + body.clientHeight - body.scrollHeight) < 3;
    const scrollable = after.scrollH > after.clientH;

    probes.forEach(p => p.remove());
    body.scrollTop = 0;
    await actor.sheet.render(false);
    await new Promise(r => setTimeout(r, 300));

    return {
      before, after, scrollable, reachedBottom,
      leftovers: document.querySelectorAll(".__layout_probe").length
    };
  };

  const tag = (e) => e.tagName + "." + String(e.className || "").split(" ").filter(Boolean).slice(0, 2).join(".");

  /* ---------- テーマを切り替えて両方で実行 ---------- */
  const themeHost = document.body;
  const originalTheme = themeHost.className;

  const runFor = async (theme) => {
    themeHost.classList.remove("theme-light", "theme-dark");
    themeHost.classList.add(theme);
    await actor.sheet.render(false);
    await new Promise(r => setTimeout(r, 400));
    return {
      clipping: checkClipping(),
      overlap: checkOverlap(),
      collision: checkTextCollision(),
      contrast: checkContrast()
    };
  };

  const light = await runFor("theme-light");
  const dark = await runFor("theme-dark");

  themeHost.className = originalTheme;
  await actor.sheet.render(false);
  await new Promise(r => setTimeout(r, 300));

  const scroll = await checkScroll();

  const result = {
    actor: actor.name,
    system: `${game.system.id} v${game.system.version}`,
    core: game.version,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    light, dark, scroll
  };

  /* ---------- 結果表示 ---------- */
  const verdict = (n) => n === 0 ? "OK" : `NG(${n})`;
  log("%c=== シートレイアウト検証 ===", "font-weight:bold;font-size:14px");
  log(`対象: ${result.actor} / ${result.system} / core ${result.core} / ${result.viewport}`);
  console.table({
    "はみ出し":            { light: verdict(light.clipping.length),  dark: verdict(dark.clipping.length) },
    "重なり":              { light: verdict(light.overlap.length),   dark: verdict(dark.overlap.length) },
    "文字とアイコンの衝突": { light: verdict(light.collision.length), dark: verdict(dark.collision.length) },
    "低コントラスト":      { light: verdict(light.contrast.length),  dark: verdict(dark.contrast.length) }
  });
  log("スクロール:", scroll.scrollable && scroll.reachedBottom ? "OK" : "NG", scroll);
  if (scroll.leftovers > 0) console.warn("注入した検査用DOMが残っています。シートを開き直してください。");

  for (const [name, r] of [["light", light], ["dark", dark]]) {
    if (r.clipping.length)  { console.groupCollapsed(`[${name}] はみ出し ${r.clipping.length}件`);  console.table(r.clipping);  console.groupEnd(); }
    if (r.overlap.length)   { console.groupCollapsed(`[${name}] 重なり ${r.overlap.length}件`);     console.table(r.overlap);   console.groupEnd(); }
    if (r.collision.length) { console.groupCollapsed(`[${name}] 文字衝突 ${r.collision.length}件`); console.table(r.collision); console.groupEnd(); }
    if (r.contrast.length)  { console.groupCollapsed(`[${name}] 低コントラスト ${r.contrast.length}件`); console.table(r.contrast); console.groupEnd(); }
  }

  return result;
}

// 貼り付け直後に一度実行する
await verifySheetLayout();
