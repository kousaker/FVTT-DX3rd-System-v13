const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class DX3rdItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["dx3rd", "sheet", "item"],
    position: {
      width: 520,
      height: 480
    },
    window: {
      resizable: true
    },
    form: {
      submitOnChange: true
    }
  };

  /* -------------------------------------------- */

  /** @override */
  static PARTS = {
    form: {
      template: "systems/dx3rd/templates/sheet/item/item-sheet.html"
    }
  };

  /* -------------------------------------------- */

  /**
   * アイテムタイプごとに異なるテンプレートファイルを使用する(V1の `get template()` 相当)。
   * static PARTS はクラス単位でしか定義できないため、レンダリング直前にインスタンスの
   * item.type を見てテンプレートパスを差し替える。
   * @override
   */
  _configureRenderParts(options) {
    const parts = foundry.utils.deepClone(super._configureRenderParts(options));
    if (parts.form) {
      parts.form.template = `systems/dx3rd/templates/sheet/item/${this.item.type}-sheet.html`;
    }
    return parts;
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.item = this.item;
    context.system = this.item.system;
    context.editable = this.isEditable;
    context.cssClass = this.isEditable ? "editable" : "locked";
    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation
      .enrichHTML(this.item.system.description ?? "");

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    this._activateItemTabs();

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add or Remove Attribute
    //this.element.querySelector(".attributes")?.addEventListener("click", ...);
  }

  /* -------------------------------------------- */

  /**
   * V1の Tabs ヘルパー(navSelector: ".sheet-tabs", contentSelector: ".sheet-body") 相当の
   * タブ切り替えをネイティブDOMで実装する。テンプレート側のマークアップ(nav[data-group] > [data-tab]
   * と .tab[data-group][data-tab])は変更していない。
   */
  _activateItemTabs() {
    const nav = this.element.querySelector('.sheet-tabs[data-group="primary"]');
    const tabs = this.element.querySelectorAll('.tab[data-group="primary"]');
    if (!nav || !tabs.length) return;

    const navItems = nav.querySelectorAll("[data-tab]");

    const activate = (tabName) => {
      navItems.forEach(el => el.classList.toggle("active", el.dataset.tab === tabName));
      tabs.forEach(el => {
        const isActive = el.dataset.tab === tabName;
        el.classList.toggle("active", isActive);
        el.style.display = isActive ? "" : "none";
      });
      if (this.tabGroups) this.tabGroups.primary = tabName;
    };

    const current = this.tabGroups?.primary
      ?? Array.from(navItems).find(el => el.classList.contains("active"))?.dataset.tab
      ?? navItems[0]?.dataset.tab;

    if (current) activate(current);

    navItems.forEach(el => {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        activate(el.dataset.tab);
      });
    });
  }

}
