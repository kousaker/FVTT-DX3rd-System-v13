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
    let key = this.item.system.skillTmp;

    let newKey = document.createElement("div");
    const skill = `<input type="hidden" name="system.skills.${key}.key" value="${key}"/>`;
    newKey.innerHTML = skill;

    newKey = newKey.children[0];
    this.form.appendChild(newKey);
    await this.submit();
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
      if (form.querySelector("input[name='system.skills.-.key']"))
        return;

      let newKey = document.createElement("div");
      const skill = `<input type="hidden" name="system.skills.-.key" value="-"/>`;
      newKey.innerHTML = skill;

      newKey = newKey.children[0];
      form.appendChild(newKey);
      await this.submit();
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
      let k = v["key"].trim();
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
