export class WeaponDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {

  constructor(actor, callback, options = {}) {
    super(options);

    this.actor = actor;
    this.callback = callback;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["dx3rd", "dialog"],
    position: { width: 600 },
    window: { title: "DX3rd.WeaponSelect", resizable: true },
    actions: {
      submit: this.#onSubmit
    }
  };

  /** @override */
  static PARTS = {
    form: { template: "systems/dx3rd/templates/dialog/weapon-dialog.html" }
  };

  /** @override */
  async _prepareContext(options) {
    let vehicleList = [];
    let weaponList = [];

    for (let i of this.actor.items) {
      if (i.type == 'weapon')
        weaponList.push(i);
      else if (i.type == 'vehicle')
        vehicleList.push(i);
    }

    return {
      title: this.title,

      actor: this.actor,
      vehicleList: vehicleList,
      weaponList: weaponList
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
    let attack = 0;
    let guard = 0;

    let list = [];

    for (const el of this.element.querySelectorAll(".check-equipment")) {
      if (el.checked) {
        list.push('<h4>' + el.dataset.name + ` (${el.dataset.attack} / ${el.dataset.guard})</h4>`);

        attack += Number(el.dataset.attack);
        guard += Number(el.dataset.guard);
      }
    }

    ChatMessage.create({
      "content": `<h2><b>${game.i18n.localize("DX3rd.WeaponSelect")} (${attack} / ${guard})</b></h2>${list.join("")}`,
      "speaker": ChatMessage.getSpeaker({actor: this.actor})
    });

    this.callback({ attack, guard });

    await this.close();
  }


  /* -------------------------------------------- */

  _onShowItemDetails(event) {
    if (event.target.tagName == "INPUT" || event.target.tagName == "IMG")
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
