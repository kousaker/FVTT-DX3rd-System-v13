import { DX3rdWorksSheet } from "./works-sheet.js";

export class DX3rdEquipmentSheet extends DX3rdWorksSheet {

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    let skills = context.system.skills;
    let actorSkills = context.system.actorSkills;

    for (const [key, value] of Object.entries(skills)) {
      if (key in actorSkills)
        continue;

      if (value.apply)
        actorSkills[key] = value;
    }

    return context;
  }

}
