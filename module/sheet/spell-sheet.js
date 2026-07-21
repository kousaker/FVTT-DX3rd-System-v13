import { DX3rdItemSheet } from "./item-sheet.js";

export class DX3rdSpellSheet extends DX3rdItemSheet {

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add or Remove Attribute
    this.element.querySelector(".show-actor")?.addEventListener("click", this._onShowActor.bind(this));
  }

  async _onShowActor(event) {
    event.preventDefault();

    let actorId = this.item.system.actor;
    let actor = game.actors.get(actorId);
    actor.sheet.render({force: true});
  }

}
