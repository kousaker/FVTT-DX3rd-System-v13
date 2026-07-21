
import { ComboDialog } from "../dialog/combo-dialog.js";
import { DX3rdSkillDialog } from "../dialog/skill-dialog.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class DX3rdActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["dx3rd", "sheet", "actor"],
    position: {
      width: 850,
      height: 730
    },
    window: {
      resizable: true
    },
    // このアプリ自身のルート要素を<form>にする(DocumentSheetV2既定のtag)。
    // テンプレート側の<form>ラッパーは入れ子<form>を避けるため撤去済み。
    tag: "form",
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    },
    // 要実機検証: v13のActorSheetV2でのDragDrop登録方式・_onDrop系メソッドの
    // シグネチャ変更有無は未確認。ロジック自体はV1から踏襲。
    dragDrop: [{ dragSelector: ".items-list .item", dropSelector: null }]
  };

  /** @override */
  static PARTS = {
    form: {
      template: "systems/dx3rd/templates/sheet/actor/actor-sheet.html"
    }
  };

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // The Actor's data
    const actorData = this.actor.toObject(false);
    context.actor = actorData;
    context.system = this.actor.system;
    context.editable = this.isEditable;

    // Owned Items
    context.items = actorData.items;
    for (let i of context.items) {
      const item = this.actor.items.get(i._id);
      i.id = item._id;
    }
    context.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    this._prepareCharacterItems(actorData, context.items);

    let rollType = this.actor.system.attributes.dice.view;
    context.dice = this.actor.system.attributes.dice.value + Number(this.actor.system.attributes[rollType].dice) + Number(this.actor.system.attributes.encroachment.dice) + Number(this.actor.system.attributes.sublimation.dice);
    context.add = this.actor.system.attributes.add.value + Number(this.actor.system.attributes[rollType].value);

    let criticalVal = this.actor.system.attributes.critical.value + this.actor.system.attributes[rollType].critical;
    if (criticalVal < this.actor.system.attributes.critical.min)
      criticalVal = Number(this.actor.system.attributes.critical.min);
    context.critical = criticalVal + Number(this.actor.system.attributes.sublimation.critical);

    context.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.actor.system.description);

    return context;
  }

  /* -------------------------------------------- */

  _prepareCharacterItems(actorData, items) {
    actorData.workList = [];
    actorData.syndromeList = [];
    actorData.comboList = [];
    actorData.effectList = [];
    actorData.easyEffectList = [];
    actorData.extraEffectList = [];
    actorData.spellList = [];
    actorData.psionicsList = [];
    actorData.roisList = [];
    actorData.memoryList = [];

    actorData.weaponList = [];
    actorData.protectList = [];
    actorData.vehicleList = [];
    actorData.connectionList = [];
    actorData.itemList = [];
    actorData.recordList = [];


    for (let i of items) {
      if (i.type == 'works')
        actorData.workList.push(i);
      else if (i.type == 'syndrome')
        actorData.syndromeList.push(i);
      else if (i.type == 'combo')
        actorData.comboList.push(i);
      else if (i.type == 'effect') {
        if (i.system.type == 'normal')
          actorData.effectList.push(i);
        else if (i.system.type == 'easy')
          actorData.easyEffectList.push(i);
        else
          actorData.extraEffectList.push(i);
      } else if (i.type == 'spell') {
        actorData.spellList.push(i);
      } else if (i.type == 'psionic') {
        actorData.psionicsList.push(i);
      } else if (i.type == 'rois') {
        if (i.system.type == "M")
          actorData.memoryList.push(i);
        else
          actorData.roisList.push(i);
      }

      else if (i.type == 'weapon')
        actorData.weaponList.push(i);
      else if (i.type == 'protect')
        actorData.protectList.push(i);
      else if (i.type == 'vehicle')
        actorData.vehicleList.push(i);
      else if (i.type == 'connection')
        actorData.connectionList.push(i);
      else if (i.type == 'item')
        actorData.itemList.push(i);

      else if (i.type == 'record')
        actorData.recordList.push(i);
    }

    actorData.syndromeType = "-"
    if (actorData.syndromeList.length == 1)
      actorData.syndromeType = game.i18n.localize("DX3rd.PureBreed");
    else if (actorData.syndromeList.length == 2)
      actorData.syndromeType = game.i18n.localize("DX3rd.CrossBreed");
    else if (actorData.syndromeList.length == 3)
      actorData.syndromeType = game.i18n.localize("DX3rd.TriBreed");

    actorData.applied = Object.values(this.actor.system.attributes.applied).reduce((acc, i) => {
      if (game.actors.get(i.actorId) == undefined)
        return acc;

      let actor = game.actors.get(i.actorId);
      if (actor.items.get(i.itemId) == undefined)
        if (!(i.itemId in actor.items))
          return acc;

      let item = actor.items.get(i.itemId);

      let data = item.toObject(false);
      data.actor = actor.name;
      data.disable = i.disable;

      acc.push(data);
      return acc;
    }, []);

  }

  /* -------------------------------------------- */

  /**
   * addEventListenerの一括登録用ヘルパー。
   * @param {string} selector
   * @param {string} type
   * @param {(event: Event) => any} handler
   */
  _bindAll(selector, type, handler) {
    this.element.querySelectorAll(selector).forEach(el => el.addEventListener(type, handler));
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _onRender(context, options) {
    await super._onRender(context, options);

    // テンプレートから<form>ラッパーを撤去したため、autocomplete属性はここで付与する
    this.element.setAttribute("autocomplete", "off");

    this._activateTabs();

    this._bindAll('.ability-roll', 'mouseenter', event => this._onUpdateDice('ability', event));
    this._bindAll('.ability-roll', 'mouseleave', event => this._onUpdateDice(null, event));
    this._bindAll('.skill-roll', 'mouseenter', event => this._onUpdateDice('skill', event));
    this._bindAll('.skill-roll', 'mouseleave', event => this._onUpdateDice(null, event));

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    this._bindAll('.ability-roll', 'click', this._onRollAbility.bind(this));
    this._bindAll('.skill-roll', 'click', this._onRollSkill.bind(this));

    this._bindAll('.backtrack-roll', 'click', this.rollBackTrack.bind(this));

    this._bindAll('.active-check', 'click', async event => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = this.actor.items.get(li.dataset.itemId);
      await item.update({ 'system.active.state': !item.system.active.state });
    });

    this._bindAll('.used-input', 'change', async event => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = this.actor.items.get(li.dataset.itemId);
      await item.update({ 'system.used.state': +event.currentTarget.value });
    });

    this._bindAll('.active-equipment', 'click', async event => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = this.actor.items.get(li.dataset.itemId);
      await item.update({ 'system.equipment': !item.system.equipment });
    });

    this._bindAll('.active-titus', 'click', async event => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = this.actor.items.get(li.dataset.itemId);
      await item.update({ 'system.titus': !item.system.titus });
    });

    this._bindAll('.active-sublimation', 'click', async event => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = this.actor.items.get(li.dataset.itemId);
      await item.update({ 'system.sublimation': !item.system.sublimation });
    });

    this._bindAll('.btn-titus', 'click', async event => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = this.actor.items.get(li.dataset.itemId);
      await item.setTitus();
    });

    this._bindAll('.btn-sublimation', 'click', async event => {
      event.preventDefault();
      const li = event.currentTarget.closest(".item");
      const item = this.actor.items.get(li.dataset.itemId);
      await item.setSublimation();
    });


    this._bindAll('.skill-create', 'click', this._onSkillCreate.bind(this));
    this._bindAll('.skill-edit', 'click', this._onShowSkillDialog.bind(this));

    // Owned Item management
    this._bindAll('.item-create', 'click', this._onItemCreate.bind(this));
    this._bindAll('.item-edit', 'click', this._onItemEdit.bind(this));
    this._bindAll('.item-delete', 'click', this._onItemDelete.bind(this));

    // Talent
    this._bindAll('.item-label', 'click', this._onShowItemDetails.bind(this));
    this._bindAll('.echo-item', 'click', this._echoItemDescription.bind(this));

    this._bindAll('.show-applied', 'click', async event => {
      const list = { attack: "DX3rd.Attack", damage_roll: "DX3rd.DamageRoll", dice: "DX3rd.Dice", add: "DX3rd.Add", critical: "DX3rd.Critical", critical_min: "DX3rd.CriticalMin", hp: "DX3rd.HP", init: "DX3rd.Init", armor: "DX3rd.Armor", guard: "DX3rd.Guard", saving: "DX3rd.Saving", saving_max: "DX3rd.Saving", stock_point: "DX3rd.Stock", battleMove: "DX3rd.BattleMove", fullMove: "DX3rd.FullMove", major_dice: "DX3rd.MajorDice", major: "DX3rd.MajorAdd", major_critical: "DX3rd.MajorCritical", reaction_dice: "DX3rd.ReactionDice", reaction: "DX3rd.ReactionAdd", reaction_critical: "DX3rd.ReactionCritical", dodge_dice: "DX3rd.DodgeDice", dodge: "DX3rd.DodgeAdd", dodge_critical: "DX3rd.DodgeCritical", body_add: "DX3rd.BodyAdd", body_dice: "DX3rd.BodyDice", sense_add: "DX3rd.SenseAdd", sense_dice: "DX3rd.SenseDice", mind_add: "DX3rd.MindAdd", mind_dice: "DX3rd.MindDice", social_add: "DX3rd.SocialAdd", social_dice: "DX3rd.SocialDice", casting_dice: "DX3rd.CastingDice", casting_add: "DX3rd.CastingAdd", };

      const li = event.currentTarget.closest(".item");
      let attr = this.actor.system.attributes.applied[li.dataset.itemId].attributes;
      let content = `<table><tr><th>${game.i18n.localize("DX3rd.Attributes")}</th><th>${game.i18n.localize("DX3rd.Value")}</th></tr>`
      for (let [key, value] of Object.entries(attr)) {
        let str = "";
        str = game.i18n.localize(list[key]);
        content += `<tr><td>${str}</td><td>${value.value}</td></tr>`
      }
      content += `</table>`;

      new Dialog({
        title: game.i18n.localize("DX3rd.Applied"),
        content: content,
        buttons: {}
      }).render(true);
    });

    this._bindAll('.remove-applied', 'click', async event => {
      const li = event.currentTarget.closest(".item");
      await this.actor.update({ [`system.attributes.applied.-=${li.dataset.itemId}`]: null });
    });

    this._bindAll('.use-item', 'click', async event => {
      const li = event.currentTarget.closest(".item");
      const item = this.actor.items.get(li.dataset.itemId);
      await item.use(this.document);
    });
  }

  /* -------------------------------------------- */

  /**
   * ナビゲーション(.sheet-tabs)とタブ本体(.sheet-body > .tab)の
   * アクティブ状態切り替えを行う。ApplicationV2にはV1のTabsヘルパーに
   * 相当する仕組みが自動適用されないため、ここで手動実装する。
   * アクティブタブは再描画をまたいでインスタンスに保持する(既定: description)。
   */
  _activateTabs() {
    const navItems = this.element.querySelectorAll(".sheet-tabs .item");
    const tabs = this.element.querySelectorAll(".sheet-body > .tab");
    const activeTab = this._activeTab ?? "description";

    const setActive = tabName => {
      this._activeTab = tabName;
      navItems.forEach(nav => nav.classList.toggle("active", nav.dataset.tab === tabName));
      tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.tab === tabName));
    };

    navItems.forEach(nav => {
      nav.addEventListener("click", event => {
        event.preventDefault();
        setActive(event.currentTarget.dataset.tab);
      });
    });

    setActive(activeTab);
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options = {}) {
    const position = super.setPosition(options);
    const sheetBody = this.element.querySelector(".sheet-body");
    if (sheetBody) {
      const bodyHeight = position.height;
      sheetBody.style.height = `${bodyHeight - 300}px`;
    }
    return position;
  }

  /* -------------------------------------------- */

  _onUpdateDice(type, event) {
    const wrapper = event.currentTarget.closest(".sheet-wrapper");
    if (!wrapper) return;
    const dice = wrapper.querySelector("#dice");
    const critical = wrapper.querySelector("#critical");
    const add = wrapper.querySelector("#add");

    let diceOptions = {};

    if (type == 'ability') {
      const li = event.currentTarget.closest(".ability");
      const key = li.dataset.abilityId;

      diceOptions.base = key;
      diceOptions.skill = null;
      diceOptions.rollType = this.actor.system.attributes.dice.view;

    } else if (type == 'skill') {
      const li = event.currentTarget.closest(".skill");
      const key = li.dataset.skillId;
      const skill = this.actor.system.attributes.skills[key];

      diceOptions.base = skill.base;
      diceOptions.skill = key;
      diceOptions.rollType = this.actor.system.attributes.dice.view;

    } else {
      let rollType = this.actor.system.attributes.dice.view;

      dice.value = this.actor.system.attributes.dice.value + Number(this.actor.system.attributes[rollType].dice) + Number(this.actor.system.attributes.encroachment.dice) + Number(this.actor.system.attributes.sublimation.dice);
      add.value = this.actor.system.attributes.add.value + Number(this.actor.system.attributes[rollType].value);

      let criticalVal = this.actor.system.attributes.critical.value + this.actor.system.attributes[rollType].critical;
      if (criticalVal < this.actor.system.attributes.critical.min)
        criticalVal = Number(this.actor.system.attributes.critical.min);
      critical.value = criticalVal + Number(this.actor.system.attributes.sublimation.critical);

      return;
    }

    let ret = this.actor._getDiceData(diceOptions);
    dice.value = ret.dice;
    critical.value = ret.critical;
    add.value = ret.add;

  }

  /* -------------------------------------------- */

  async _onRollAbility(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".ability");
    const key = li.dataset.abilityId;
    const title = game.i18n.localize("DX3rd." + key[0].toUpperCase() + key.slice(1));

    const diceOptions = {
      "base": key,
      "skill": null
    };

    let append = false;
    if (event.ctrlKey)
      append = true;

    Dialog.confirm({
      title: game.i18n.localize("DX3rd.Combo"),
      content: "",
      yes: async () => await new ComboDialog(this.actor, title, diceOptions, append).render(true),
      no: async () => await this.actor.rollDice(title, diceOptions, append),
      defaultYes: false
    });

  }

  /* -------------------------------------------- */

  async _onRollSkill(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".skill");
    const key = li.dataset.skillId;
    const skill = this.actor.system.attributes.skills[key];
    const title = (skill.name.indexOf('DX3rd.') != -1) ? game.i18n.localize(skill.name) : skill.name;

    const diceOptions = {
      "base": skill.base,
      "skill": key
    };

    let append = false;
    if (event.ctrlKey)
      append = true;

    Dialog.confirm({
      title: game.i18n.localize("DX3rd.Combo"),
      content: "",
      yes: async () => await new ComboDialog(this.actor, title, diceOptions, append).render(true),
      no: async () => await this.actor.rollDice(title, diceOptions, append),
      defaultYes: false
    });

  }

  /* -------------------------------------------- */

  _onSkillCreate(event) {
    event.preventDefault();
    const key = event.currentTarget.dataset.abilityId;

    new DX3rdSkillDialog(this.actor, null, { "title": game.i18n.localize("DX3rd.CreateSkill"), base: key }).render(true);
  }

  /* -------------------------------------------- */

  _onShowSkillDialog(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".skill");
    const key = li.dataset.skillId;

    new DX3rdSkillDialog(this.actor, key, { "title": game.i18n.localize("DX3rd.EditSkill") }).render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const data = foundry.utils.duplicate(header.dataset);
    delete data["type"];

    if (type == 'effect')
      data.type = data.effectType;
    else if (type == 'rois')
      data.type = data.roisType;

    const name = `New ${type.capitalize()}`;
    const itemData = {
      name: name,
      type: type,
      img: `icons/svg/${header.dataset.img}.svg`,
      system: data
    };
    await this.actor.createEmbeddedDocuments('Item', [itemData], {});
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
    item.sheet.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle deleting an existing Owned Item for the Actor
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemDelete(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    let item = this.actor.items.get(li.dataset.itemId);
    item.delete();
  }

  /* -------------------------------------------- */

  _onShowItemDetails(event) {
    event.preventDefault();
    const toggler = event.currentTarget;
    const item = toggler.closest('.item');
    const description = item?.querySelector('.item-description');

    toggler.classList.toggle('open');
    // 元のjQuery slideToggle()に相当するネイティブAPIは無いため、
    // アニメーション無しの表示切り替えに単純化している。
    if (description)
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

  /** @inheritdoc */
  async _onDropActor(event, data) {
    if (!this.actor.isOwner) return false;

    const actor = await Actor.implementation.fromDropData(data);

    const itemData = {
      name: actor.name,
      img: actor.img,
      type: "rois",
      system: {
        "actor": actor.id
      }
    };

    // Handle item sorting within the same Actor
    // 要実機検証: v13のActorSheetV2で_onSortItem/_onDropItemCreateの
    // シグネチャが変わっていないか確認すること。
    if (this.actor.uuid === actor.parent?.uuid) return this._onSortItem(event, itemData);

    // Create the owned item
    return this._onDropItemCreate(itemData);
  }

  /* -------------------------------------------- */

  async rollBackTrack() {

    let rois = 0;
    let memory = 0;
    for (let item of this.actor.items) {
      if (item.type == "rois" && item.system.type != "D" && item.system.type != "M" && !item.system.titus && !item.system.sublimation)
        rois += 1;
      if (item.system.type == "M")
        memory += 1;
    }

    let extraBackTrackDialog = new Dialog({
      title: `${game.i18n.localize("DX3rd.BackTrack")} - ${game.i18n.localize("DX3rd.EXPExtra")}`,
      content: `
        <h2>${game.i18n.localize("DX3rd.BackTrack")} - ${game.i18n.localize("DX3rd.EXPExtra")} (${rois})</h2>
      `,
      buttons: {
        one: {
          icon: '<i class="fas fa-check"></i>',
          label: "Apply",
          callback: async () => {
            let formula = `${rois}D10`;

            let roll = new Roll(formula);
            await roll.evaluate();

            let before = this.actor.system.attributes.encroachment.value;
            let after = (before - roll.total < 0) ? 0 : before - roll.total;

            await this.actor.update({ "system.attributes.encroachment.value": after });

            let rollMode = game.settings.get("core", "rollMode");
            let rollData = await roll.render();
            let content = `
              <div class="dx3rd-roll">
                <h2 class="header"><div class="title width-100">
                  ${game.i18n.localize("DX3rd.BackTrack")}
                  <div style="font-size: smaller; color: gray; float: right;">${game.i18n.localize("DX3rd.EXPExtra")}</div>
                </div></h2>
                <div class="context-box">
                  ${game.i18n.localize("DX3rd.Encroachment")}: ${before} -> ${after} (-${roll.total})
                </div>
                ${rollData}
            `;

            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              content: content + `</div>`,
              style: CONST.CHAT_MESSAGE_STYLES.OTHER,
              sound: CONFIG.sounds.dice,
              rolls: [roll],
            }, { rollMode });

          }
        }
      }
    });

    let backTrackDialog = new Dialog({
      title: `${game.i18n.localize("DX3rd.BackTrack")}`,
      content: `
        <h2>${game.i18n.localize("DX3rd.BackTrack")} (${rois})</h2>
      `,
      buttons: {
        one: {
          icon: '<i class="fas fa-check"></i>',
          label: "X 1",
          callback: async () => {
            let formula = `${rois}D10`;

            let roll = new Roll(formula);
            await roll.evaluate();

            let before = this.actor.system.attributes.encroachment.value;
            let after = (before - roll.total < 0) ? 0 : before - roll.total;

            await this.actor.update({ "system.attributes.encroachment.value": after });

            let rollMode = game.settings.get("core", "rollMode");
            let rollData = await roll.render();
            let content = `
              <div class="dx3rd-roll">
                <h2 class="header"><div class="title">${game.i18n.localize("DX3rd.BackTrack")}</div></h2>
                <div class="context-box">
                  ${game.i18n.localize("DX3rd.Encroachment")}: ${before} -> ${after} (-${roll.total})
                </div>
                ${rollData}
            `;

            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              content: content + `</div>`,
              style: CONST.CHAT_MESSAGE_STYLES.OTHER,
              sound: CONFIG.sounds.dice,
              rolls: [roll],
            }, { rollMode });

            if (this.actor.system.attributes.encroachment.value >= 100)
              extraBackTrackDialog.render(true);
          }
        },
        two: {
          icon: '<i class="fas fa-times"></i>',
          label: "X 2",
          callback: async () => {
            let formula = `${rois * 2}D10`;

            let roll = new Roll(formula);
            await roll.evaluate();

            let before = this.actor.system.attributes.encroachment.value;
            let after = (before - roll.total < 0) ? 0 : before - roll.total;

            await this.actor.update({ "system.attributes.encroachment.value": after });

            let rollMode = game.settings.get("core", "rollMode");
            let rollData = await roll.render();
            let content = `
              <div class="dx3rd-roll">
                <h2 class="header"><div class="title width-100">
                  ${game.i18n.localize("DX3rd.BackTrack")}
                  <div style="font-size: smaller; color: gray; float: right;">${game.i18n.localize("DX3rd.EXPx2")}</div>
                </div></h2>
                <div class="context-box">
                  ${game.i18n.localize("DX3rd.Encroachment")}: ${before} -> ${after} (-${roll.total})
                </div>
                ${rollData}
            `;

            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              content: content + `</div>`,
              style: CONST.CHAT_MESSAGE_STYLES.OTHER,
              sound: CONFIG.sounds.dice,
              rolls: [roll],
            }, { rollMode });

            if (this.actor.system.attributes.encroachment.value >= 100)
              extraBackTrackDialog.render(true);
          }
        }
      },
      default: "one"
    });


    let eRoisDialog = new Dialog({
      title: game.i18n.localize("DX3rd.Exhaust") + ' ' + game.i18n.localize("DX3rd.BackTrack"),
      content: `
        <h2>${game.i18n.localize("DX3rd.Exhaust")} ${game.i18n.localize("DX3rd.BackTrack")}</h2>
        <input type="number" id="rois" placeholder="0">
      `,
      buttons: {
        one: {
          icon: '<i class="fas fa-check"></i>',
          label: "Apply",
          callback: async () => {
            let eRois = document.getElementById("rois")?.value;
            if (eRois != "" && eRois != 0) {
              let formula = `${eRois}D10`;

              let roll = new Roll(formula);
              await roll.evaluate();

              let before = this.actor.system.attributes.encroachment.value;
              let after = (before - roll.total < 0) ? 0 : before - roll.total;

              await this.actor.update({ "system.attributes.encroachment.value": after });

              let rollMode = game.settings.get("core", "rollMode");
              let rollData = await roll.render();
              let content = `
                <div class="dx3rd-roll">
                  <h2 class="header">
                    <div class="title">${game.i18n.localize("DX3rd.Exhaust")} ${game.i18n.localize("DX3rd.BackTrack")}</div></h2>
                  <div class="context-box">
                    ${game.i18n.localize("DX3rd.Encroachment")}: ${before} -> ${after} (-${roll.total})
                  </div>
                  ${rollData}
              `;

              ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                content: content + `</div>`,
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                sound: CONFIG.sounds.dice,
                rolls: [roll],
              }, { rollMode });
            }

          }
        }
      },
      default: "one",
      close: () => backTrackDialog.render(true)
    });

    let memoryDialog = new Dialog({
      title: game.i18n.localize("DX3rd.Memory") + ' ' + game.i18n.localize("DX3rd.BackTrack"),
      content: `
        <h2>${game.i18n.localize("DX3rd.Memory")} ${game.i18n.localize("DX3rd.BackTrack")} (${memory})</h2>
        <input type="number" id="memory" placeholder="0" value="${memory}">
      `,
      buttons: {
        one: {
          icon: '<i class="fas fa-check"></i>',
          label: "Apply",
          callback: async () => {
            let memoryInput = document.getElementById("memory")?.value;
            if (memoryInput != "" && memoryInput != 0) {
              let formula = `${(memoryInput > memory) ? memory * 10 : memoryInput * 10}`;

              let roll = new Roll(formula);
              await roll.evaluate();

              let before = this.actor.system.attributes.encroachment.value;
              let after = (before - roll.total < 0) ? 0 : before - roll.total;

              await this.actor.update({ "system.attributes.encroachment.value": after });

              let rollMode = game.settings.get("core", "rollMode");
              let rollData = await roll.render();
              let content = `
                <div class="dx3rd-roll">
                  <h2 class="header">
                    <div class="title">${game.i18n.localize("DX3rd.Memory")} ${game.i18n.localize("DX3rd.BackTrack")}</div></h2>
                  <div class="context-box">
                    ${game.i18n.localize("DX3rd.Encroachment")}: ${before} -> ${after} (-${roll.total})
                  </div>
                  ${rollData}
              `;

              ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                content: content + `</div>`,
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                sound: CONFIG.sounds.dice,
                rolls: [roll],
              }, { rollMode });
            }

          }
        }
      },
      default: "one",
      close: () => eRoisDialog.render(true)
    });

    memoryDialog.render(true);

  }

  /* -------------------------------------------- */

}
