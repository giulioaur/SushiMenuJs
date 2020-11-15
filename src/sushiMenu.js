/*********************************************************
 *          Created By Dr.Sushi (Giulio Auriemma)        *
 *        Licensed with GNU GENERAL PUBLIC LICENSE       *
 *********************************************************/

var SM = {

    CONST: {
        history: 'sm-history',
        current: 'sm-current',
        viewportId: 'sm-viewport',
        menuClass: 'sm-menu',
        itemClass: 'sm-item',
        backItemClass: 'sm-back-item',
        redirectItemClass: 'sm-redirect-item',
        redirectBlankItemClass: 'sm-redirect-blank-item',
        clearItemClass: 'sm-clear-item',
        itemContainerClass: 'sm-item-container',
        mainMenuId: 'sm-main-menu',
        mainLayoutClass: 'sm-main-layout',
        layoutClass: 'sm-layout',
        currentLayoutClass: 'sm-current-layout',
        layoutItemData: 'item',
        gotoData: 'goto',
        inAnimData: 'smIn',
        outAnimData: 'smOut'
    },

    /**
     * Class for the graph of menu.
     * It automatically builds the graph using sm-* classes and data-goto attribute.
     * This way the generation is completely automatic and no change is required on js when changing the 
     * graph structure.
     */
    Graph: class Graph {
        //////////////////////// TYPE DEF ////////////////////////

        /**
         * Callback for getting the layout to use in current configuration.
         *
         * @callback layoutGetter
         * @param {string} menu The id of the current menu.
         * @returns {string} The name of the class of layout to use for the given menu (without sm- prefix and -layout suffix). 
         */

        /**
        * The functions called to configure data before and after the menu has changed (and the animations have been played).
        *
        * @callback dataCallback
        * @param {HTMLElement} old The old menu.
        * @param {HTMLElement} new The new menu.
        * @returns {Boolean} False to prevent the menu changing to happen. 
        *                    NB: the return value is checked only for the callback executed before the animation.
        */

        //////////////////////// CONSTRUCT GRAPH ////////////////////////

        /**
         * Buils a new menu graph parsing the html file.
         * 
         * @param {Object} [options] The configuration options for the graph.
         * @param {Boolean} [options.shouldSave = true] True if the menu state should be saved as session's state.
         * @param {layoutGetter} [options.layoutMap] The function that returns the correct layout to use. Default always uses 'main' as layout.
         * @param {Boolean} [options.logError = true] True if errors must be logged on console, false otherwise. Usually set to true only in development.
         * @param {Boolean} [options.playFirstAnimation = true] True if enter animation should be played on first menu shown.
         */
        constructor(options) {
            this._saving = options && options.shouldSave !== undefined ? options.shouldSave : true;
            this._layoutGetter = options && options.layoutMap ? options.layoutMap : () => { return 'main' };
            this._shouldLog = options && options.logError !== undefined ? options.logError : true;
            this._playFirstAnimation = options && options.playFirstAnimation !== undefined ? options.playFirstAnimation : true;
            this._beforeAnimationFunc = [];
            this._afterAnimationFunc = [];

            // Observe the viewport to correctly update the layout.
            this._observer = new MutationObserver(this.forceUpdateLayout.bind(this));
            this._observer.observe(document.getElementById(SM.CONST.viewportId), { attributes: true, childList: true, subtree: true });

            if (this._setAttributes()) {
                this._buildGraph();

                // Show correct menu.
                if (this._playFirstAnimation) {
                    const inAnimation = this._current.dataset[SM.CONST.inAnimData] ? this._current.dataset[SM.CONST.inAnimData] : "SM.Animations.standardIn";
                    this._playAnimation(inAnimation, this._current, false);
                }
                else {
                    this._current.style.display = '';
                }
            }
        }

        /**
         * Returns the current menu.
         * 
         * @returns {HTMLElement} The current active menu.
         */
        get currentMenu() {
            return this._current;
        }

        /**
         * Sets the base graph attribute.
         * 
         * @returns {Boolean} true if all goes the right way, false otherwise.
         */
        _setAttributes() {
            if (document.getElementById(SM.CONST.mainMenuId)) {
                // Use sessionStorage.
                if (this._saving && typeof (Storage) !== 'undefined') {
                    // If no previous saving, create new one.                
                    this._history = sessionStorage.getItem(SM.CONST.history) ? sessionStorage.getItem(SM.CONST.history).split(',') : [];
                    this._current = document.getElementById(`${sessionStorage.getItem(SM.CONST.current) ?
                        sessionStorage.getItem(SM.CONST.current) : SM.CONST.mainMenuId}`);
                }
                // Do not use session storage.
                else {
                    this._history = [];
                    this._current = document.getElementById(SM.CONST.mainMenuId);
                }

                this._nodes = {};
                return true;
            }

            console.log(`No main menu declared (${SM.CONST.mainMenuId})`);
            return false;
        }

        /**
         * Creates the nodes of the graph and enables goto links.
         */
        _buildGraph() {
            const graph = this;
            const menuViewport = document.getElementById(SM.CONST.viewportId);
            const nodes = menuViewport.querySelectorAll(`#${SM.CONST.viewportId} .${SM.CONST.menuClass}`);

            // Creates a map of nodes.
            for (let node of nodes) {
                const nodeId = node.id;

                node.style.display = 'none';

                if (nodeId)
                    graph._nodes[nodeId] = node;
                else
                    this._logError('No id found', node);

                // Fill other layouts.
                this._populateLayouts(node);
            }

            // Add goto event to items.
            // Do it after creating map to check goto consistency.
            const items = menuViewport.getElementsByClassName(SM.CONST.itemClass);
            for (let item of items) {
                const label = item.dataset[SM.CONST.gotoData];
                const isBlank = item.classList.contains(SM.CONST.redirectBlankItemClass);

                // Check if the item is a normal item or a redirect item.
                if (!item.classList.contains(SM.CONST.redirectItemClass) && !isBlank)
                    item.addEventListener('click', () => graph.goto(label,
                        item.classList.contains(SM.CONST.backItemClass),
                        item.classList.contains(SM.CONST.clearItemClass)));
                else
                    item.addEventListener('click', () => graph._redirect(label, isBlank));
            }

            // Not all redirect item should also be normal item, so don't forget about them.
            const linkItems = menuViewport.querySelectorAll(`.${SM.CONST.redirectItemClass}:not(.${SM.CONST.itemClass}), .${SM.CONST.redirectBlankItemClass}:not(.${SM.CONST.itemClass})`);
            for (let item of linkItems) {
                const isBlank = item.classList.contains(SM.CONST.redirectBlankItemClass);
                item.addEventListener('click', () => graph._redirect(item.dataset[SM.CONST.gotoData], isBlank));
            }
        }

        //////////////////////// LAYOUT STUFF ////////////////////////

        /**
         * Fills all the layouts of a menu with the correct items.
         * The items should be put in the sm-main-layout, while other layouts must have a 
         * link to them through data-item attribute.
         * 
         * @param {HTMLElement} menu The menu to fill.
         */
        _populateLayouts(menu) {
            const mainLayout = menu.querySelector(`.${SM.CONST.mainLayoutClass}`);
            const layouts = menu.querySelectorAll(`.${SM.CONST.layoutClass}:not(.${SM.CONST.mainLayoutClass})`);

            if (!mainLayout)
            {
                this._logError("Add a main layout to menu " + menu.id);
                return;
            }

            for (let layout of layouts) {
                // Fill all the item's containers.
                const containers = layout.getElementsByClassName(SM.CONST.itemContainerClass);
                for (let container of containers) {
                    const itemsToAppend = mainLayout.querySelector(`.${container.dataset[SM.CONST.layoutItemData]}`);

                    if (itemsToAppend)
                        container.appendChild(itemsToAppend.cloneNode(true));
                    else
                        this._logError('No data-item attribute in container.', container);
                };

                layout.style.display = 'none';
            };

            // Set main layout as default, then find the correct layout.
            mainLayout.classList.add(SM.CONST.currentLayoutClass);
            this._setCorrectLayout(menu);
        }

        /**
         * Hides the previous layout and show the one returned from the layout callback.
         * 
         * @param {HTMLElement} menu The menu.
         */
        _setCorrectLayout(menu) {
            const layoutToShow = this._getLayoutName(menu.id);
            const currentLayout = menu.querySelector(`.${SM.CONST.currentLayoutClass}`);

            // Show only the correct layout.
            if (!currentLayout.classList.contains(layoutToShow)) {
                const newLayout = menu.querySelector(`.${layoutToShow}`);

                // Hide the previous active layout and show the new one.
                currentLayout.classList.remove(SM.CONST.currentLayoutClass);
                currentLayout.style.display = 'none';
                newLayout.classList.add(SM.CONST.currentLayoutClass);
                newLayout.style.display = '';
            }
        }


        /**
         * Forces the updating of current layout.
         */
        forceUpdateLayout() {
            this._setCorrectLayout(this._current);
        }


        //////////////////////// CHANGE MENU AND ANIMATIONS ////////////////////////

        /**
         * Changes the current menu with a new one.
         * If the label is empty and isBack is false, then do nothing, if isBack is true go to previous menu.
         * If the label is not empty and isBack is false go to the given menu and add the current to the history,
         * if isBack is false then go back in the history to find the searched menu, if no menu with that label
         * is found, then the history is cleared.
         * 
         * @param {string} label The new menu id.
         * @param {Boolean} isBack true if is a back transition.
         * @param {Boolean} clearHistory true if the history must be cleaned after transition.
         * 
         * @returns {Boolean} True if the transition has been successfully completed, false otherwise.
         */
        goto(label, isBack = false, clearHistory = false) {
            const oldHistory = this._history;
            let to = null;
            let inAnimation, outAnimation;

            if (!isBack) {
                // Go to menu.
                const nextMenu = this._nodes[label];
                if (nextMenu) {
                    if (nextMenu != this._current)
                    {
                        this._history.push(this._current.id);
                        to = nextMenu;
                    }
                }
                // Error.
                else {
                    this._logError(`${label} is not a valid menu in ${this._current.id}`);
                    return false;
                }
            }
            // Go back in history.
            else if (this._history && this._history.length > 0) {
                let toId = "";

                // Search for the label and pop all elements after it.
                if (label) {
                    for (toId = this._history.pop(); this._history.length > 0 && toId != label; toId = this._history.pop());
                }

                to = document.getElementById(`${(toId ? toId : this._history.pop())}`);
            }
            // There is an error.
            else {
                this._logError(`${this._current.id} cannot go back, no previous menu found.`);
                return false;
            }

            if (!to)    return;

            // Set current layout for the menu to show.
            this._setCorrectLayout(to);

            // Get animation.
            outAnimation = this._current.dataset[SM.CONST.outAnimData] ? this._current.dataset[SM.CONST.outAnimData] : "SM.Animations.standardOut";
            inAnimation = to.dataset[SM.CONST.inAnimData] ? to.dataset[SM.CONST.inAnimData] : "SM.Animations.standardIn";

            // Play the data callback.
            for (let func of this._beforeAnimationFunc) {
                if (!func(this._current, to)) {
                    this._history = oldHistory;
                    return false;
                }
            }

            // Play animations.
            const outPromise = this._playAnimation(outAnimation, to, isBack);
            const inPromise = this._playAnimation(inAnimation, to, isBack);

            // Play the data callback.
            const callAfterAnimFuncs = () => {
                for (let func of this._afterAnimationFunc)
                    func(this._current, to);
            }

            if (!outPromise && !inPromise)
            {
                callAfterAnimFuncs();
            }
            else
            {
                const firstPromise = outPromise ? outPromise : inPromise;
                const secondPromise = outPromise ? inPromise : outPromise;

                firstPromise.then(secondPromise ? () => { secondPromise.then(callAfterAnimFuncs); } : callAfterAnimFuncs);
            }

            // Update current
            this._current = to;

            // Clear history.
            if (clearHistory)
                this._history = [];

            // Save state.
            this._saveCurrentState();

            return true;
        }

        /**
         * Add a callback to the queue of functions to execute before or after an animation. 
         * If any function executed before an animation returns false, the animation and the functions post-animation
         * are not executed and the old state is restored.
         * 
         * @param {Boolean} beforeAnimation True if the callback have to been executed before the animations.
         * @param {dataCallback} callback The callback to call.
         */
        addDataCallback(callback, beforeAnimation) {
            if (beforeAnimation)
                this._beforeAnimationFunc.push(callback);
            else
                this._afterAnimationFunc.push(callback);
        }

        /**
         * Open a link.
         * 
         * @param {string} link The target link.
         * @param {Boolean} isBlank tru if the link must be opened in new tab.
         */
        _redirect(link, isBlank) {
            window.open(link, isBlank ? '_blank' : '_self');
        }

        /**
         * Plays an animation. 
         * To correctly call the function the name of the animation must contain also the necessary namespaces.
         * 
         * @param {string} animation The name of the animation to play.
         * @param {HTMLElement} to The new menu to show.
         * @param {Boolean} isBack true if is a back animation.
         * @return {Promise} The promise returned by the animation if asynchronous, can be null.
         */
        _playAnimation(animation, to, isBack) {
            // Resolve animation function call
            let animationContext = window;
            const contexts = animation.split('.');
            const animationFunction = contexts.pop();

            for (let context of contexts)
                animationContext = animationContext[context];

            if (animationContext[animationFunction])
            {
                return animationContext[animationFunction].call(animationContext, this._current, to, isBack);
            }
            else
            {
                this._logError(`${animationFunction} not found.`);
            }
        }



        //////////////////////// UTILITIES ////////////////////////

        /**
         * Save the current state if saving is active.
         */
        _saveCurrentState() {
            // Save current state.
            if (this._saving && typeof (Storage) !== 'undefined') {
                sessionStorage.setItem(SM.CONST.history, this._history.toString());
                sessionStorage.setItem(SM.CONST.current, this._current.id);
            }
        }

        /**
         * Returns the name of the layout to use for a given menu. If this layout does not exist,
         * returns the main layout instead.
         * 
         * @param {string} menuName The id of the menu.
         * @returns {string} The formatted name of the layout to use.
         */
        _getLayoutName(menuName) {
            const newLayout = `sm-${this._layoutGetter(menuName)}-layout`;
            return document.getElementById(menuName).querySelector(`.${newLayout}`) ? newLayout : SM.CONST.mainLayoutClass;
        }

        /**
         * Log the error to the console if log is active.
         * 
         * @param {Array} logList Array of element to pass to log function.
         */
        _logError(logList) {
            if (this._shouldLog) {
                if (logList instanceof Object)
                    console.error.apply(this, logList);
                else
                    console.error(logList);
            }
        }
    },


    Animations: class SMAnimations {
        /**
         * Showa the new menu.
         *
         * @param {HTMLElement} from The exiting menu.
         * @param {HTMLElement} to The entering menu.
         * @param {Boolean} isBack true if is a back animation.
         */
        static standardIn(from, to, isBack) {
            to.style.display = '';
        }

        /**
         * Hides the old menu.
         *
         * @param {HTMLElement} from The exiting menu.
         * @param {HTMLElement} to The entering menu.
         * @param {Boolean} isBack true if is a back animation.
         */
        static standardOut(from, to, isBack) {
            from.style.display = 'none';
        }
    }

}