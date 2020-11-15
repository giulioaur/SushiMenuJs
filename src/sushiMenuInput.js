/*********************************************************
 *          Created By Dr.Sushi (Giulio Auriemma)        *
 *        Licensed with GNU GENERAL PUBLIC LICENSE       *
 *********************************************************/

SM.CONST.activeItemClass = 'sm-active';
SM.CONST.lastActiveItemClass = 'sm-last-active';
SM.CONST.inputActivationEvent = 'sm-activate';
SM.CONST.inputDeactivationEvent = 'sm-deactivate';
SM.CONST.noInputClass = 'sm-no-input';
SM.CONST.inputEvent = {
    firstFocus: 0,
    hover: 1,
    restoreFocus: 2,
    leaveMenu: 3,
    moveLeft: 4,
    moveRight: 5,
    moveUp: 6,
    moveDown: 7
}

SM.CONST.inputData = [
        /* Back */ { events: [], callback: '_goBack' },
        /* Select */ { events: [], callback: '_select' },
        /* Down */ { events: [], callback: '_goDown' },
        /* Left */ { events: [], callback: '_goLeft' },
        /* Up */ { events: [], callback: '_goUp' },
        /* Right */ { events: [], callback: '_goRight' }
]


SM.input = {
    // Declare all needed event.
    _activationEvent: new CustomEvent(SM.CONST.inputActivationEvent, {
        detail: {
            target: null,
            other: null,
            isMouseTrigger: false,
            reason: ''
        }
    }),
    _deactivationEvent: new CustomEvent(SM.CONST.inputDeactivationEvent, {
        detail: {
            target: null,
            other: null,
            isMouseTrigger: false,
            reason: ''
        }
    }),
    _clickEvent: new MouseEvent('click'),

    // Other attributes.
    _graph: null,
    _activeItem: null,
    _cachedItems: {},
    _options: {
        firstFocus: false,
        dynamicMenu: false
    },
    _wasKeyboard: false,

    get wasKeyboard() {
        return this._wasKeyboard;
    },

    /**
     * Binds input to a menu graph.
     * The input works on active item. It's possible to add a custom event listener for
     * the activation / deactivation of an item through the 'sm-activate' and 'sm-deactivate' events.
     *
     * @param {SM.Graph} graph The graph to which bind the inputs.
     * @param {Object} map The map of input keys (the number are referred to which attribute of a key).
     * @param {Array<Number>} map.back The keys for back action.
     * @param {Array<Number>} map.select The keys for select action.
     * @param {Array<Number>} map.up The keys for go-up action.
     * @param {Array<Number>} map.down The keys for go-down action.
     * @param {Array<Number>} map.left The keys for go-left action.
     * @param {Array<Number>} map.right The keys for go-right action.
     * @param {Object} [options] The options object.
     * @param {Boolean} [options.firstFocus = true] True if the first item must be activated on entering the first menu.
     * @param {Boolean} [options.dynamicMenu = false] True if menu's items change at runtime. On false some optimizations are applied.
     * @param {HTMLElement} [element = document] The element to which bind the input handling.
     */
    bindInput(graph, map, options = {}, element = document) {
        const input = this;

        this._graph = graph;

        this._setupOptions(options);
        this._setupInputMap(map);

        // Add basic inputs.
        if (this._graph) {
            // Add event listener on keydown.
            element.addEventListener('keydown', (key) => {
                for (let input of SM.CONST.inputData) {
                    if (input.events.includes(key.which))
                        this[input.callback].call(this);
                }
            });

            const items = document.querySelectorAll(`.${SM.CONST.itemClass}:not(.${SM.CONST.noInputClass})`);
            for (let item of items) {
                // Add event listener for set the correct active menu with mouse.
                item.addEventListener('mouseenter', function () {
                    input._changeActive(this, true, SM.CONST.inputEvent.hover);
                });
            }

            // Set up the menu cleaning.
            this._graph.addDataCallback((oldMenu, newMenu) => this._cleanMenu(newMenu), true);

            // Set up the focus on first element.
            if (this._options.firstFocus)
                this._changeActive(this._getItems()[0], false, SM.CONST.inputEvent.firstFocus);
        }
        else
            console.error('No valid graph for input.')
    },

    /**
     * Clean the old menu from active items.
     * 
     * @param {HTMLElement} menu The menu to clean.
     */
    _cleanMenu(menu) {
        const items = menu.getElementsByClassName(SM.CONST.activeItemClass);

        for (let item of items) {
            this._changeEventDetails(this._deactivationEvent, item, null, false, SM.CONST.inputEvent.leaveMenu);
            item.dispatchEvent(this._deactivationEvent);

            if (item == this._activeItem) this._activeItem = null;
        }

        return true;
    },

    /**
     * Set the focus on the index-th item of the menu.
     * 
     * @param {HTMLElement} [menu] The menu in which restore the focus. If null is passed, current menu is used instead.
     * @param {Number | HTMLElement} [element=0] The item on which set the focus.
     * @param {Boolean} [isMouseTrigger=false] True if the action has been fired by a mouse event.
     * @param {string} [dir="firstFocus"] The event that moves the focus.
     */
    setFocusOn(menu, element = 0, isMouseTrigger = false, dir = SM.CONST.inputEvent.firstFocus) {
        if (!menu) menu = this._graph._current;

        const item = element instanceof HTMLElement ? element : menu.getElementsByClassName(SM.CONST.itemClass)[parseInt(element)];

        if (item) {
            // Clean previous focus.
            const itemToRestore = menu.querySelector(`.${SM.CONST.lastActiveItemClass}`);
            if (itemToRestore) itemToRestore.classList.remove(SM.CONST.lastActiveItemClass);

            // Set new focus.
            this._changeActive(item, isMouseTrigger, dir);
        }
    },

    /**
     * Add an event callback to the mouse click. This way, the focus change can be handled.
     * NB: This relies on the fact that the order in which registered events are called is consistent with the 
     * DOM 3 standard (first-assigned, first-called).
     *          
     * @param {HTMLElement} [menu] The menu in which save the focus. If null is passed, current menu is used instead.
     * @param {HTMLElement} [item=null] The item that has to be the last focuse. If null is passed, first active item is used instead.
     */
    saveFocus(menu, item = null) {
        if (!menu) menu = this._graph._current;
        if (!item) item = menu.querySelector(`.${SM.CONST.activeItemClass}`);

        // Reset the last active item of the menu after having saved it.
        if (item) {
            item.classList.add(SM.CONST.lastActiveItemClass);
        }
    },

    /**
     * Restore the previous focused item.
     * 
     * @param {HTMLElement} [menu] The menu in which restore the focus. If null is passed, current menu is used instead.
     * @param {Boolean} [isMouseTrigger] True if the action has been fired by a mouse event.
     */
    restoreFocus(menu, isMouseTrigger = false) {
        if (!menu) menu = this._graph._current;

        const itemToRestore = menu.querySelector(`.${SM.CONST.lastActiveItemClass}`);

        // Remove last item class.
        if (itemToRestore) {
            itemToRestore.classList.remove(SM.CONST.lastActiveItemClass);
            this._changeActive(itemToRestore, isMouseTrigger, SM.CONST.inputEvent.restoreFocus);
        }
        else {
            this.setFocusOn(menu, 0, isMouseTrigger, SM.CONST.inputEvent.restoreFocus);
        }
    },


    /**
     * Sets-up the options for the handler.
     * 
     * @param {Object} options The new options.
     */
    _setupOptions(options) {
        if (options && options.firstFocus === true)
            this._options.firstFocus = true;

        if (options && options.dynamicMenu === true)
            this._options.dynamicMenu = true;
    },

    /**
     * Binds the keys to the action.
     * 
     * @param {Object} map The map for the key-action bindings.
     */
    _setupInputMap(map) {
        SM.CONST.inputData[0].events = map.back;
        SM.CONST.inputData[1].events = map.select;
        SM.CONST.inputData[2].events = map.down;
        SM.CONST.inputData[3].events = map.left;
        SM.CONST.inputData[4].events = map.up;
        SM.CONST.inputData[5].events = map.right;
    },

    /**
     * Changes the current active item.
     * 
     * @param {HTMLElement} newActive The new active item.
     * @param {Boolean} mouseTrigger True if the action has been fired by a mouse event.
     * @param {string} evt The reason of the movement.
     */
    _changeActive(newActive, mouseTrigger, evt) {
        // Deactivate previous item if any.
        if (this._activeItem != newActive) {
            if (this._activeItem) {
                this._changeEventDetails(this._deactivationEvent, this._activeItem, newActive, mouseTrigger, evt);

                // To avoid recursive call inside a callback for deactivation event, put activeitem to
                // null, this way this branch will not be called again within the callback.
                const oldItem = this._activeItem;
                this._activeItem.classList.remove(SM.CONST.activeItemClass);
                this._activeItem = null;
                oldItem.dispatchEvent(this._deactivationEvent);
            }

            if (newActive) {
                // Activate new item.
                newActive.classList.add(SM.CONST.activeItemClass);

                this._changeEventDetails(this._activationEvent, newActive, this._activeItem, mouseTrigger, evt);
                this._activeItem = newActive;
                newActive.dispatchEvent(this._activationEvent);
            }
            // Assign null to the active item.
            else if (!newActive) {
                this._activeItem = newActive;
            }
        }
    },

    /**
     * Goes back to the previous menu.
     */
    _goBack() {
        this._wasKeyboard = true;
        this._graph.goto('', true);
        this._wasKeyboard = false;
    },

    /**
     * Goes to the menu pointed by that item if any.
     */
    _select() {
        this._wasKeyboard = true;
        this._activeItem.dispatchEvent(this._clickEvent);
        this._wasKeyboard = false;
    },

    /**
     * Movement events
     */
    _goDown() { this._move(0, 1) },
    _goUp() { this._move(0, -1) },
    _goRight() { this._move(1, 0) },
    _goLeft() { this._move(-1, 0) },

    /**
     * Moves the current active menu item if any.
     * 
     * @param {Number} dirX The x direction in which move (-1 left, 1 right).
     * @param {Number} dirY The y direction in which move (-1 top, 1 down).
     */
    _move(dirX, dirY) {
        const dir = dirX ? 
            (dirX > 0 ? SM.CONST.inputEvent.moveLeft : SM.CONST.inputEvent.moveRight) : 
            (dirY > 0 ? SM.CONST.inputEvent.moveDown : SM.CONST.inputEvent.moveLeft);

        // Move active item
        if (this._activeItem) {
            const currPos = this._getAbsolutePos(this._activeItem);


            // The map is done to avoid calling _getAbsolutePos() multiple times.
            const nextItems = Array.from(this._getItems()).map(item => {
                return { bb: this._getAbsolutePos(item), element: item };
            }).filter(item => {     // First filter all the items in the right direction.
                // Horizontal movement
                return dirX ? (dirX > 0 ? item.bb.left >= currPos.right : item.bb.right <= currPos.left) :
                    // Vertical movement
                    (dirY > 0 ? item.bb.top >= currPos.bottom : item.bb.bottom <= currPos.top);
            }).filter(item => {     // Then check if the two box projection on x / y axis interesct each other.
                // Y intersection
                return dirX ? Math.abs(item.bb.top - currPos.top) <= Math.max(item.bb.height, currPos.height) :
                    // X interesection
                    Math.abs(item.bb.left - currPos.left) <= Math.max(item.bb.width, currPos.width);
            }).sort((a, b) => {     // Then sort the remaining elements.
                // First compute the distance in the x/y axis.
                // The distance must be computed on different side based on where to move.
                // NB: on going down / right x1 > x2 => x2 - x1 < 0 => x1 comes before x2,
                //      on going up / left x1 < x2 => (x2 - x1) * (-1) < 0 => x1 comes before x2.
                //      where x1 is side of a and x2 side of b. 
                const side = dirX ? 
                    (dirX > 0 ? 'left' : 'right') : 
                    (dirY > 0 ? 'top' : 'bottom');
                let distance = (b.bb[side] - a.bb[side]) * -(dirX ? dirX : dirY);

                // Consider very near item as at the same distance.
                if (distance > -0.5 && distance < 0.5) distance = 0;

                // If the two items are at the same distance check for the one near to
                // top side while going horizontally, or to left side while going vertically.
                if (!distance) {
                    return dirX ? Math.abs(a.bb.top - currPos.top) - Math.abs(b.bb.top - currPos.top) :
                        Math.abs(a.bb.left - currPos.left) - Math.abs(b.bb.left - currPos.left);
                }

                return distance;
            });

            // If some item is left, change the current active item.
            if (nextItems.length > 0)
                this._changeActive(nextItems[0].element, false, dir);
        }
        // Set first item as active one.
        else {
            this._changeActive(this._graph._current.querySelector(`.${this._graph._getLayoutName(this._graph._current.id)} .${SM.CONST.itemClass}:not(.${SM.CONST.noInputClass})`), false, dir);
        }
    },



    //////////////////////// UTILITIES ////////////////////////

    /**
     * Returns the items of the current menu.
     * 
     * @returns {NodeList} The items of the current menu.
     */
    _getItems() {
        // Retrieves the item of the current menu if not cached.
        const currentId = this._graph._current.id;
        const currentLayout = this._graph._getLayoutName(currentId);

        // If dynamicMenu optimization is on just query again.
        if (this._options.dynamicMenu) {
            this._cachedItems.items = document.querySelectorAll(`#${currentId} .${currentLayout} .${SM.CONST.itemClass}:not(.${SM.CONST.noInputClass})`);
        }
        // Otherwise check if the chaced items need to be retrieved again.
        if (!this._cachedItems.menuId || this._cachedItems.menuId != currentId || this._cachedItems.layout != currentLayout) {
            this._cachedItems.items = document.querySelectorAll(`#${currentId} .${currentLayout} .${SM.CONST.itemClass}:not(.${SM.CONST.noInputClass})`);
            this._cachedItems.menuId = currentId;
            this._cachedItems.layout = currentLayout;
        }

        return this._cachedItems.items;
    },

    /**
     * Returns the coords of an element wrt document.
     * 
     * @param {HTMLElement} element The element.
     * 
     * @returns {DOMRect} A partial DomRect with just top, bottom, left and right attribute.
     */
    _getAbsolutePos(element) {
        const bb = element.getBoundingClientRect();

        return {
            top: bb.top + window.pageYOffset,
            bottom: bb.bottom + window.pageYOffset,
            right: bb.right + window.pageXOffset,
            left: bb.left + window.pageXOffset,
            width: bb.width,
            height: bb.height
        };
    },

    /**
     * Change the details of an event and dispatch it.
     * 
     * @param {CustomEvent} event The event to dispatch.
     * @param {HTMLElement} item The item to which dispatch the event.
     * @param {HTMLElement} other The new / old item.
     * @param {Boolean} isMouseTrigger True if the event is triggered by mouse.
     * @param {string} reason The reason of the event.
     */
    _changeEventDetails(event, item, other, isMouseTrigger, reason) {
        event.detail.target = item;
        event.detail.other = other;
        event.detail.isMouseTrigger = isMouseTrigger;
        event.detail.reason = reason;
    }
}