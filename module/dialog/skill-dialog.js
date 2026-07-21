
export class DX3rdSkillDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(actor, skillId, options = {}) {
    super(options);

    this.actor = actor;
    this.key = skillId;

    if (this.key != null) {
      this.option = "edit";
      this.skill = actor.system.attributes.skills[skillId];
      this.skill.key = skillId;

    } else {
      this.option = "create";
      this.skill = {
        key: "",
        name: "",
        point: "",
        base: options.base,
        delete: true
      }
    }

    this.options.window.title = options.title;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["dx3rd", "dialog"],
    position: { width: 500 },
    window: { resizable: true },
    actions: {
      create: this.#onCreate
    }
  };

  /** @override */
  static PARTS = {
    form: { template: "systems/dx3rd/templates/dialog/skill-dialog.html" }
  };

  /** @override */
  async _prepareContext(options) {
    return {
      title: this.title,
      skill: this.skill,
      delete: (this.option == "create") ? false : this.skill.delete,
      option: this.option
    }
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.addEventListener("keydown", this._onKeyDown.bind(this));
  }

  /** @override */
  _onRender(context, options) {
    for (const el of this.element.querySelectorAll(".skill-change"))
      el.addEventListener("change", this._skillChange.bind(this));

    for (const el of this.element.querySelectorAll(".skill-delete"))
      el.addEventListener("click", this._skillDelete.bind(this));
  }

  _onKeyDown(event) {
    if (event.key === "Enter" && this.option == "edit") {
      event.preventDefault();
      this.close();
    }
  }

  static async #onCreate(event, target) {
    event.preventDefault();
    await this._skillCreate();
  }

  async _skillChange(event) {
    event.preventDefault();
    const input = event.currentTarget;
    const type = input.dataset.type;
    let val = input.value;

    if (this.option == "create")
      return;

    if (type == "base" && !this.skill.delete)
      return;

    if (type == "point")
      val = Number(val);

    await this.actor.update({[`system.attributes.skills.${this.key}.${type}`]: val});
    if (type == "point") {
      let add = this.actor.system.attributes.skills[this.key].value;
      this.element.querySelector("#skill-value").value = "+" + add;
    }
  }

  async _skillDelete(event) {
    if (this.option == "create")
      return;

    if (!this.skill.delete)
      return;

    await foundry.applications.api.DialogV2.confirm({
      window: { title: "Delete?" },
      content: "",
      yes: {
        callback: async () => {
          await this.actor.update({[`system.attributes.skills.-=${this.key}`]: null});
          this.close();
        }
      },
      no: {
        callback: () => console.log("Canceled")
      }
    });
  }

  async _skillCreate() {
    const root = this.element;

    this.key = root.querySelector("#skill-key").value;
    this.skill.name = root.querySelector("#skill-name").value;
    this.skill.point = root.querySelector("#skill-point").value;
    this.skill.base = root.querySelector("#skill-base").value;

    if (this.skill.point.trim() == "")
      this.skill.point = 0;
    else
      this.skill.point = Number(this.skill.point);

    if (this.key.trim() != "")
      await this.actor.update({[`system.attributes.skills.${this.key}`]: this.skill});
    this.close();
  }


}
