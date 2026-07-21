import { DX3rdAttributesSheet } from "./attributes-sheet.js";

export class DX3rdEffectSheet extends DX3rdAttributesSheet {

  /** @override */
  _prepareSubmitData(event, form, formData, updateData) {
    let submitData = super._prepareSubmitData(event, form, formData, updateData);
    submitData = this.updateEffectAttributes(submitData);
    return submitData;
  }

  updateEffectAttributes(submitData) {
    // Handle the free-form attributes list
    const formAttrs = submitData.system?.effect?.attributes ?? {};

    const attributes = Object.values(formAttrs).reduce((obj, v) => {
      let k = v["key"].trim();
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
    if (this.item.system.effect?.attributes != null)
    for ( let k of Object.keys(this.item.system.effect.attributes) ) {
      if ( !attributes.hasOwnProperty(k) ) attributes[`-=${k}`] = null;
    }

    if (submitData.system?.effect) submitData.system.effect.attributes = attributes;
    else if (submitData.system) submitData.system.effect = { attributes };

    return submitData;
  }

}
