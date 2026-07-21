
export class DefenseDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(actor, data, options = {}) {
    super(options);

    this.actor = actor;
    this.damageData = data;

    game.DX3rd.DamageDialog.push(this);
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["dx3rd", "dialog"],
    position: { width: 400 },
    window: { title: "DX3rd.DefenseDamage", resizable: true },
    actions: {
      confirm: this.#onConfirm,
      reset: this.#onReset
    }
  };

  /** @override */
  static PARTS = {
    form: { template: "systems/dx3rd/templates/dialog/defense-dialog.html" }
  };

  /**
   * V1-style state alias kept for compatibility with module/init.js, which tracks open
   * DefenseDialog instances via `game.DX3rd.DamageDialog` and filters them with
   * `dialog._state != -1`. ApplicationV2 exposes the same information through the public
   * `state` getter, so this is a thin read-only bridge (no writes, no risk to core internals).
   */
  get _state() {
    return this.state;
  }

  /** @override */
  async _prepareContext(options) {
    let weaponList = [];

    for (let i of this.actor.items) {
      let item = i;

      if (i.type == 'weapon')
        weaponList.push(item);
    }

    let defense = {
      armor: Number(this.actor.system.attributes.armor.value),
      guard: Number(this.actor.system.attributes.guard.value),
      reduce: 0,
      double: false,
      guardCheck: false
    }

    let {life, realDamage} = this.calcDefenseDamage(defense);

    return {
      name: this.actor.name,
      src: this.actor.img,
      life: life,
      realDamage: realDamage,
      damage: "-" + this.damageData.realDamage,
      armor: defense.armor,
      guard: defense.guard,
      weaponList: weaponList,
      reduce: defense.reduce,
      double: (defense.double) ? "checked" : ""
    }
  }

  /** @override */
  _onRender(context, options) {
    for (const el of this.element.querySelectorAll('input, select'))
      el.addEventListener('change', this.calcLife.bind(this));
  }

  static async #onConfirm(event, target) {
    event.preventDefault();

    let defense = this.getDefense();
    let {life, realDamage} = this.calcDefenseDamage(defense);

    Hooks.call("afterReaction", this.actor);

    await this.actor.update({"system.attributes.hp.value": life});
    let chatData = {"content": this.actor.name + " (" + realDamage + ")", "speaker": ChatMessage.getSpeaker({ actor: this.actor })};
    ChatMessage.create(chatData);

    await this.close();
  }

  static #onReset(event, target) {
    event.preventDefault();
    this.reset();
  }

  /* -------------------------------------------- */

  getDefense() {
    let defense = {};
    const root = this.element;

    defense.double = root.querySelector("#double").checked;
    defense.guardCheck = root.querySelector("#guard-check").checked;

    const armorVal = root.querySelector("#armor").value;
    const guardVal = root.querySelector("#guard").value;
    const reduceVal = root.querySelector("#reduce").value;

    defense.armor = (armorVal == "") ? 0 : +armorVal;
    defense.guard = (guardVal == "") ? 0 : +guardVal;
    defense.reduce = (reduceVal == "") ? 0 : +reduceVal;

    const selectedOption = root.querySelector("#weapon")?.selectedOptions?.[0];
    const weapon = Number(selectedOption?.dataset.guard ?? 0);
    if (defense.guardCheck)
      defense.guard += weapon;

    return defense;
  }

  calcLife() {
    let defense = this.getDefense();
    let {life, realDamage} = this.calcDefenseDamage(defense);

    this.element.querySelector("#realDamage").textContent = realDamage;
    this.element.querySelector("#life").textContent = life;
  }

  reset() {
    this.render({force: true});
  }

  calcDefenseDamage(def) {
    let defense = foundry.utils.deepClone(def);
    let actorData = this.actor.system;

    if (this.damageData.data.ignoreArmor)
      defense.armor = 0;

    let realDamage = this.damageData.realDamage;
    let life = actorData.attributes.hp.value;
    let maxLife = actorData.attributes.hp.max;

    realDamage -= defense.armor;
    if (defense.guardCheck)
      realDamage -= defense.guard;

    if (defense.double)
      realDamage *= 2;

    realDamage -= defense.reduce;
    realDamage = (realDamage < 0) ? 0 : realDamage;

    life = (life - realDamage < 0) ? 0 : life - realDamage;
    realDamage = "-" + realDamage;

    return {
      life,
      realDamage
    }

  }

}
