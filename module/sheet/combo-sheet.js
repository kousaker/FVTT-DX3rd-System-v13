import { DX3rdAttributesSheet } from "./attributes-sheet.js";

export class DX3rdComboSheet extends DX3rdAttributesSheet {

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.actorEffect = {};
    context.actorWeapon = {};

    if (this.actor != null) {
      context.actor = this.actor;
      let items = this.actor.items;

      for (let i of items) {
        let item = i;

        if (item.type == 'weapon' || item.type == 'vehicle')
          context.actorWeapon[i.id] = i.name;
        else if (item.type == 'effect')
          context.actorEffect[i.id] = i.name;
      }
    }

    return context;
  }

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender(context, options);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    this.element.querySelector(".change-skill")?.addEventListener("change", this._onSkillChange.bind(this));

    this.element.querySelector(".add-effect")?.addEventListener("click", this._onEffectCreate.bind(this));
    this.element.querySelector(".add-weapon")?.addEventListener("click", this._onWeaponCreate.bind(this));

    this.element.querySelectorAll(".item-edit").forEach(el => el.addEventListener("click", this._onItemEdit.bind(this)));
    this.element.querySelectorAll(".item-delete").forEach(el => el.addEventListener("click", this._onItemDelete.bind(this)));
    this.element.querySelectorAll(".item-label").forEach(el => el.addEventListener("click", this._onShowItemDetails.bind(this)));
  }

  /* -------------------------------------------- */

  async _onSkillChange(event) {
    const skillId = event.currentTarget.value;
    let base = "-";
    if (this.actor != null && "base" in this.actor.system.attributes.skills[skillId])
      base = this.actor.system.attributes.skills[skillId].base;
    else if ("base" in game.DX3rd.baseSkills[skillId])
      base = game.DX3rd.baseSkills[skillId].base;

    const baseInput = this.element.querySelector("#base");
    if (baseInput) baseInput.value = base;

    await this.submit();
  }


  /* -------------------------------------------- */

  async _onEffectCreate(event) {
    let key = this.item.system.effectTmp;
    if (this.item.system.effect.includes(key))
      return;

    let newKey = document.createElement("div");
    const effect = `<input type="hidden" name="system.effect" value="${key}"/>`;
    newKey.innerHTML = effect;

    newKey = newKey.children[0];
    // 再描画で置換されるのは .window-content の内側だけなので、ルート<form>直下へ
    // 足したこの要素は送信後に必ず取り除く(残ると次回送信で値が二重になる)。
    this.form.appendChild(newKey);
    try {
      await this.submit();
    } finally {
      newKey.remove();
    }
  }

  /* -------------------------------------------- */

  async _onWeaponCreate(event) {
    let key = this.item.system.weaponTmp;
    if (this.item.system.weapon.includes(key))
      return;

    let newKey = document.createElement("div");
    const weapon = `<input type="hidden" name="system.weapon" value="${key}"/>`;
    newKey.innerHTML = weapon;

    newKey = newKey.children[0];
    // 再描画で置換されるのは .window-content の内側だけなので、ルート<form>直下へ
    // 足したこの要素は送信後に必ず取り除く(残ると次回送信で値が二重になる)。
    this.form.appendChild(newKey);
    try {
      await this.submit();
    } finally {
      newKey.remove();
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle editing an existing Owned Item for the Actor
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemEdit(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    const item = this.actor.items.get(li.dataset.itemId);

    item.sheet.render({force: true});
  }

  /* -------------------------------------------- */

  /**
   * Handle deleting an existing Owned Item for the Actor
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemDelete(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    li.remove();
    await this.submit();
  }

  /* -------------------------------------------- */

  _onShowItemDetails(event) {
    event.preventDefault();
    const item = event.currentTarget.closest('.item');
    const description = item?.querySelector('.item-description');

    item?.classList.toggle('open');
    // 元のjQuery slideToggle()に相当するネイティブAPIは無いため、
    // アニメーション無しの表示切り替えに単純化している。
    if (description)
      description.style.display = (description.style.display === 'block') ? 'none' : 'block';
  }

  /* -------------------------------------------- */

}
