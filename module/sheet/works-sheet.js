import { DX3rdItemSheet } from "./item-sheet.js";

export class DX3rdWorksSheet extends DX3rdItemSheet {

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    if (this.actor != null)
      context.system.actorSkills = foundry.utils.duplicate(this.actor.system.attributes.skills);
    else
      context.system.actorSkills = foundry.utils.duplicate(game.DX3rd.baseSkills);

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add or Remove Attribute
    this.element.querySelectorAll(".add-skills .skill-create").forEach(el => {
      el.addEventListener("click", this._onSkillCreate.bind(this));
    });
    this.element.querySelector(".skills")?.addEventListener("click", this._onClickSKillControl.bind(this));
  }

  /* -------------------------------------------- */

  async _onSkillCreate(event) {
    const key = this.item.system.skillTmp;
    if (!key || key === "-") return;
    if (this.form.querySelector(`[name='system.skills.${key}.key']`)) return;

    // key だけを送ると、updateSkills が key を削除した結果 {} が保存され、
    // 名前も能力値も持たない空の行ができてしまう。既定値一式を一緒に送る。
    const base = this.actor?.system.attributes.skills?.[key]?.base
      ?? game.DX3rd.baseSkills?.[key]?.base ?? "-";
    const name = this.actor?.system.attributes.skills?.[key]?.name
      ?? game.DX3rd.baseSkills?.[key]?.name ?? "";

    const fields = [
      [`system.skills.${key}.key`, key],
      [`system.skills.${key}.name`, name],
      [`system.skills.${key}.base`, base]
    ];

    const injected = fields.map(([n, v]) => {
      const el = document.createElement("input");
      el.type = "hidden"; el.name = n; el.value = v;
      this.form.appendChild(el);
      return el;
    });

    try {
      await this.submit();
    } finally {
      // 再描画で置換されるのは .window-content の内側だけなので、
      // ルート<form>直下に足したこれらは明示的に取り除く。
      injected.forEach(el => el.remove());
    }
  }


  /* -------------------------------------------- */

  async _onClickSKillControl(event) {
    const a = event.target.closest("a.attribute-control");
    if (!a) return;
    event.preventDefault();

    const action = a.dataset.action;
    const form = this.form;

    // Add new attribute
    if ( action === "create" ) {
      // 要素種別を問わず既存の「-」行を検出する(input限定だと、再描画後に
      // selectとして現れる行を見落とし二重登録になる)。
      if (form.querySelector("[name='system.skills.-.key']"))
        return;

      let newKey = document.createElement("div");
      const skill = `<input type="hidden" name="system.skills.-.key" value="-"/>`;
      newKey.innerHTML = skill;

      newKey = newKey.children[0];
      form.appendChild(newKey);
      try {
        await this.submit();
      } finally {
        newKey.remove();
      }
    }

    // Remove existing attribute
    else if ( action === "delete" ) {
      const li = a.closest(".attribute");
      li.parentElement.removeChild(li);
      await this.submit();
    }
  }

  /** @override */
  _prepareSubmitData(event, form, formData, updateData) {
    let submitData = super._prepareSubmitData(event, form, formData, updateData);
    submitData = this.updateSkills(submitData);
    return submitData;
  }

  updateSkills(submitData) {
    // Handle the free-form attributes list
    const formAttrs = submitData.system?.skills ?? {};

    const attributes = Object.values(formAttrs).reduce((obj, v) => {
      // FormDataExtended は同名フィールドが複数あると配列を返す。
      // 想定外の型でも落ちないよう文字列へ正規化する。
      const rawKey = Array.isArray(v["key"]) ? v["key"][0] : v["key"];
      let k = String(rawKey ?? "").trim();
      if ( /[\s\.]/.test(k) ) {
        ui.notifications.error(game.i18n.localize("DX3rd.Notify.InvalidAttributeKey"));
        return obj;
      }

      delete v["key"];
      obj[k] = v;
      return obj;
    }, {});

    // Remove attributes which are no longer used
    for ( let k of Object.keys(this.item.system.skills) ) {
      if ( !attributes.hasOwnProperty(k) ) attributes[`-=${k}`] = null;
    }

    if (submitData.system) submitData.system.skills = attributes;

    return submitData;
  }




}
