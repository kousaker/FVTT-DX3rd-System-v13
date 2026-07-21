import { DX3rdWorksSheet } from "./works-sheet.js";

export class DX3rdAttributesSheet extends DX3rdWorksSheet {

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
    this.element.querySelector(".attributes")?.addEventListener("click", this._onClickAttributeControl.bind(this));
  }

  /* -------------------------------------------- */

  async _onClickAttributeControl(event) {
    const a = event.target.closest("a.attribute-control");
    if (!a) return;
    event.preventDefault();

    const action = a.dataset.action;
    const pos = a.dataset.pos;
    const form = this.form;

    // Add new attribute
    if ( action === "create" ) {
      let attr = 'system.attributes'
      if (pos != "main")
        attr = 'system.effect.attributes';

      // 既存の「-」行があれば何もしない。
      // 旧コードは select[name=...] だけを見ていたが、ここで注入するのは
      // input[type=hidden] なので、テンプレート再描画後にselectとして現れる行と
      // 二重になり、FormDataExtended が key を配列 ["-","-"] として拾って
      // updateAttributes の v.key.trim() が落ちていた。要素種別を問わず見る。
      if (form.querySelector(`[name='${attr}.-.key']`))
        return;

      let newKey = document.createElement("div");
      const skill = `<input type="hidden" name="${attr}.-.key" value="-"/>`;
      newKey.innerHTML = skill;

      newKey = newKey.children[0];
      // ApplicationV2 では this.form はルート<form>で、再描画で置換されるのは
      // 内側の .window-content のみ。ここに足した要素は再描画後も生き残るため、
      // 送信後に必ず取り除く。
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
    submitData = this.updateAttributes(submitData);
    return submitData;
  }

  updateAttributes(submitData) {
    // Handle the free-form attributes list
    const formAttrs = submitData.system?.attributes ?? {};

    const attributes = Object.values(formAttrs).reduce((obj, v) => {
      // FormDataExtended は同名フィールドが複数あると配列を返す。
      // 想定外の型でも落ちないよう文字列へ正規化する。
      const rawKey = Array.isArray(v["key"]) ? v["key"][0] : v["key"];
      let k = String(rawKey ?? "").trim();
      if ( /[\s\.]/.test(k) )  return ui.notifications.error(game.i18n.localize("DX3rd.Notify.InvalidAttributeKey"));
      delete v["key"];

      try {
        if (k != "-") {
          let num = v.value.replace("@level", 0);
          math.evaluate(num);
        }
      } catch (error) {
        ui.notifications.error(v.value + ": Values other than formula, @level are not allowed.");
      }

      obj[k] = v;
      return obj;
    }, {});

    // Remove attributes which are no longer used
    for ( let k of Object.keys(this.item.system.attributes) ) {
      if ( !attributes.hasOwnProperty(k) ) attributes[`-=${k}`] = null;
    }

    if (submitData.system) submitData.system.attributes = attributes;

    return submitData;
  }


}
