
import { WeaponDialog } from "./weapon-dialog.js";

export class ComboDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {

  constructor(actor, title, diceOptions, append, options = {}) {
    super(options);

    this.actor = actor;

    this.chatTitle = game.i18n.localize("DX3rd.Combo") + ": " + title;
    this.skillId = diceOptions.skill;
    this.base = diceOptions.base;

    if (this.skillId != null)
      this.skill = actor.system.attributes.skills[this.skillId];
    else
      this.skill = "-";

    this.append = append;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["dx3rd", "dialog"],
    position: { width: 600 },
    window: { title: "DX3rd.Combo", resizable: true },
    actions: {
      submit: this.#onSubmit
    }
  };

  /** @override */
  static PARTS = {
    form: { template: "systems/dx3rd/templates/dialog/combo-dialog.html" }
  };

  /** @override */
  async _prepareContext(options) {
    let actorSkills = foundry.utils.deepClone(this.actor.system.attributes.skills);
    let effectList = [];

    for (let i of this.actor.items) {
      if (i.type == 'effect')
        effectList.push(i);
    }

    return {
      title: this.title,

      actor: this.actor,
      skill: this.skillId,
      base: this.base,
      effectList: effectList,
      actorSkills: actorSkills
    }
  }

  /** @override */
  _onRender(context, options) {
    for (const el of this.element.querySelectorAll('.item-label'))
      el.addEventListener('click', this._onShowItemDetails.bind(this));

    for (const el of this.element.querySelectorAll('.echo-item'))
      el.addEventListener('click', this._echoItemDescription.bind(this));
  }

  static async #onSubmit(event, target) {
    event.preventDefault();
    await this._onSubmit();
  }

  async _onSubmit() {
    let effectList = [];
    let macroList = [];
    let key = this.id;

    let encroachStr = [];
    let encroach = 0;

    for (const el of this.element.querySelectorAll(".active-effect")) {
      if (el.checked) {
        let effect = this.actor.items.get(el.dataset.id);
        effectList.push(effect);

        if ( Number.isNaN(Number(effect.system.encroach.value)) )
          encroachStr.push(effect.system.encroach.value);
        else
          encroach += Number(effect.system.encroach.value);

        let updates = {};
        if (effect.system.active.disable != 'notCheck')
            updates["system.active.state"] = true;
        await effect.update(updates);
      }
    }

    if (encroachStr.length > 0)
        encroach += "+" + encroachStr.join("+");

    for (let effect of effectList) {
      if (!effect.system.getTarget) {
        const macro = game.macros.contents.find(m => (m.name === effect.system.macro));
        if (macro != undefined)
            macro.execute();
        else if (effect.system.macro != "")
            foundry.applications.api.DialogV2.prompt({
              window: { title: "macro" },
              content: `Do not find this macro: ${effect.system.macro}`,
              ok: { label: "OK" }
            });
      } else
        macroList.push(effect);
    }

    Hooks.call("setActorCost", this.actor, key, "encroachment", encroach);


    const root = this.element;
    let skill = root.querySelector("#skill").value;
    let base = root.querySelector("#base").value;
    let rollType = root.querySelector("#roll").value;
    let attackRoll = root.querySelector("#attackRoll").value;


    let content = `<button class="chat-btn toggle-btn" data-style="effect-list">${game.i18n.localize("DX3rd.Effect")}</button>
      <div class="effect-list">`;

    for (let e of effectList) {
      content += `
        <div>
          <h4 class="item-name toggle-btn" data-style="item-description">`;
      content += `<img src="${e.img}" width="20" height="20" style="vertical-align : middle;margin-right:8px;">`;

      content += `<span class="item-label">[${e.system.level.value}] ${e.name}<br>
              <span style="color : gray; font-size : smaller;">
                ${game.i18n.localize("DX3rd.Timing")} : ${ Handlebars.compile('{{timing arg}}')({arg: e.system.timing}) } /
                ${game.i18n.localize("DX3rd.Skill")} : ${ Handlebars.compile('{{skillByKey actor key}}')({actor: this.actor, key: e.system.skill}) } /
                ${game.i18n.localize("DX3rd.Target")} : ${e.system.target} /
                ${game.i18n.localize("DX3rd.Range")} : ${e.system.range} /
                ${game.i18n.localize("DX3rd.Encroach")} : ${e.system.encroach.value} /
                ${game.i18n.localize("DX3rd.Limit")} : ${e.system.limit}
                <span class="item-details-toggle"><i class="fas fa-chevron-down"></i></span>
              </span>
            </span>
          </h4>
          <div class="item-description">${e.system.description}</div>
        </div>
        `;
    }
    content += `</div>`;

    const diceOptions = {
      "key": key,
      "rollType": rollType,
      "base": base,
      "skill": skill,
      "content": content
    };

    if (attackRoll != "-") {
      let confirm = async (weaponData) => {
        diceOptions["attack"] = {
          "value": weaponData.attack,
          "type": attackRoll
        };

        await this.actor.rollDice(this.chatTitle, diceOptions, this.append);
      }

      new WeaponDialog(this.actor, confirm).render(true);
    } else
      await this.actor.rollDice(this.chatTitle, diceOptions, this.append);


    let getTarget = false;
    let appliedList = [];
    for (let e of effectList) {
      if (e.system.effect.disable != "notCheck")
        appliedList.push(e);
      if (e.system.getTarget)
        getTarget = true;
    }

    if (!getTarget)
      Hooks.call("updateActorCost", this.actor, key, "target");
    else {
      new foundry.applications.api.DialogV2({
        window: { title: game.i18n.localize("DX3rd.SelectTarget") },
        position: { top: 300, left: 20 },
        content: `
          <h2><b>${game.i18n.localize("DX3rd.SelectTarget")}</b></h2>
        `,
        buttons: [{
          action: "confirm",
          icon: "fas fa-check",
          label: "Confirm",
          default: true,
          callback: async () => {
            let targets = game.user.targets;
            for (let t of targets) {
              let a = t.actor;

              for (let e of appliedList)
                await e.applyTarget(a);

              for (let e of macroList) {
                const macro = game.macros.contents.find(m => (m.name === e.system.macro));
                if (macro != undefined)
                    macro.execute();
                else if (e.system.macro != "")
                    foundry.applications.api.DialogV2.prompt({
                      window: { title: "macro" },
                      content: `Do not find this macro: ${e.system.macro}`,
                      ok: { label: "OK" }
                    });
              }
            }
            Hooks.call("updateActorCost", this.actor, key, "target");
          }
        }]
      }).render(true);
    }

    await this.close();

  }


  /* -------------------------------------------- */

  _onShowItemDetails(event) {
    if (event.target.classList.contains("active-effect") || event.target.classList.contains("echo-item"))
      return;

    event.preventDefault();
    const toggler = event.currentTarget;
    const item = toggler.closest('.item');
    const description = item.querySelector('.item-description');

    toggler.classList.toggle('open');
    description.style.display = (description.style.display === 'block') ? 'none' : 'block';
  }

  /* -------------------------------------------- */

  _echoItemDescription(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    let item = this.actor.items.get(li.dataset.itemId);

    item.toMessage();
  }

  /* -------------------------------------------- */



}
