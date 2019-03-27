# SushiMenuJs
When I came up with the idea of making my site resemble a game’s menu, I started to write a library to would have helped me to quickly deal with this: there SushiMenu was born. I wanted my site to be single-page so the library works without the use of hyperlinks. \
It has been fully tested on Mozilla and Chrome.

## Dependencies

The library has no external dependecies.

## Getting Started

SushiMenuJs allows to easily define a menu static structure through html tags and attributes. Once the structure has been defined, it parse the html to build a menu's graph, that can be navigated through links between menu. \
Every function is fully documented with JSDoc within the sources.

### Menu

A menu is nothing but a html element (a container element like div is preferred) with **class="sm-menu"** and a unique id to be recognized among all other menu. The default menu (the first to be shown) must have **id="sm-main-menu"**. One and only one menu must have this id. All the menu are contained within an element with **id="sm-viewport"**.  

``` html
<div id="sm-viewport">
    <div id="sm-main-menu" class="sm-menu"></div>
    <div id="duloc" class="sm-menu"></div>
    <div id="farfaraway" class="sm-menu"></div>
    <div id="camelot" class="sm-menu"></div>
</div>
```

### Layout

Every menu can have one or more layouts (a container with **class="sm-layout"**), but only one at time is shown. By default the layout with **class="sm-main-layout"** is shown, but it can be changed with a js function (shown in the JS section). All the layout class name must have **"sm-"** prefix and **"-layout"** suffix.

``` html
<div id="sm-viewport">
    <div id="duloc" class="sm-menu">
        <div class="sm-layout sm-main-layout"></div>
        <div class="sm-layout sm-quietTooQuiet-layout"></div>
    </div>
</div>
```

They can be used, for example, to make your page have different aspect on different resolutions (see [my site](giulioaur.com)).

### Items

A menu is composed by items **(class=”sm-item”)** and every item is wrapped within a container (class=”sm-item-container). The item is the main element of the menu and it is the way to navigate through another menu thanks to the “data-goto” attribute. Once an item with a valid **“data-goto”** is clicked, first the out transition of the current menu is played, then the in transition of the pointed menu is played. \
While navigating in this way, a history of the menu is kept: the **“sm-back-item”** allows to navigate this history in the opposite direction. If a **“data-goto”** attribute is specified, the history is navigated back until that menu, if the attribute is not valid or it does not exist, the last visited menu is restored. \
If an item contains the class **"sm-clear-item"** it also clear the history until that moment.

``` html
<div id="sm-viewport">
    <div id="farfaraway" class="sm-menu">
        <div class="sm-layout sm-main-layout">
            <div class="sm-item-container">
                <a class="sm-item" data-goto="camelot">Ship</a>
            </div>
            <div class="sm-item-container">
                <a class="sm-item sm-clear-item" data-goto="past">Ship</a>
            </div>
        </div>
    </div>
    <div id="camelot" class="sm-menu">
        <div class="sm-layout sm-main-layout">
            <div class="sm-item-container">
                <a class="sm-item sm-back-item" data-goto="farfarawy">Magic</a>
            </div>
        </div>
    </div>
    <div id="past" class="sm-menu">
        <div class="sm-layout sm-main-layout">
            <div class="sm-item-container">
                <a class="sm-item sm-clear-item" data-goto="farfaraway">Rumpelstiltskin</a>
            </div>
        </div>
    </div>
</div>
```

The **“data-goto”** attribute can also contain a web-url, but to make the item correctly redirect to that resource, it has to have **class=”sm-redirect-item”** or **class=”sm-redirect-blank-item”** to open the link in a new tab. \
\
Sometimes can be useful to have the same items appear in more than one layout, without make any change to it. To avoid useless code replication and to manually change every copy when the original item is changed, an item container of a secondary layout can specify a **“data-item”** attribute. Its value is a class-name of an item contained by the main layout. During the graph construction, a copy of the first item with that class is done and this copy is appended to the container. 

``` html
<div id="sm-viewport">
    <div id="swamp" class="sm-menu">
        <div class="sm-layout sm-main-layout">
            <div class="sm-item-container">
                <div class="sm-item house" data-goto="past">
                    <h1>Shrek</h1>
                    <h3>Earwax's candle</h3>
                </div>
            </div>
        </div>
        <div class="sm-layout sm-farquad-layout">
            <div class="sm-item-container" data-item="house"></div>
            <div class="sm-item-container">
                <p class="sm-item"> Squatters </p>
            </div>
            </div>
        </div>
    </div>
</div>
```

### **Javascript**

### Graph construction

The only necessary Javascript code is the one that builds the graph. \
**NB:** This code must be called once all the html tree is built.

``` js
const graph = new SM.Graph(options);
``` 

The options are:
- {Boolean} [options.shouldSave = true] True if the menu state should be saved as session's state.
- {layoutGetter} [options.layoutMap] The function that returns the correct layout to use. Default always uses 'main' as layout. This function is used to re-compute the correct layout every time the **sm-viewport** element or any of its descendant are modified.
- {Boolean} [options.logError = true] True if errors must be logged on console, false otherwise. Usually set to true only in development.
- {Boolean} [options.playFirstAnimation = true] True if enter animation should be played on first menu shown.


### Animations

By default, the out-animation set the display property to none, while the in-animation restores the default one. Anyway customs animations can be set through the attributes “data-sm-in” and “data-sm-out”. These attributes accept the name of a declared JS function as value. 

``` html
<script>
    function bubbleAnimation()
    {
        // Make some bubbles.
    }
</script>
<div id="sm-viewport">
    <div id="fairy-godmather" class="sm-menu" data-sm-in="bubbleAnimation" data-sm-out="bubbleAnimation"> </div>
</div>
```

### Data callback

Sometimes can be useful to make the very same operation before or after a menu transition. With the **SM.Graph.addDataCallback(callback, beforeAnimation)** method is possible to add a function that is called every time a transition is starting (beforeAnimation = true) or once it is ended (beforeAnimation = false). While the functions called after the transition don’t need to return anything, the ones called before must return true to allow the transition to be triggered or false to block it.
Both the functions accept as arguments the current menu and the next one.

``` js
graph.addDataCallback((current, next) => {
    if ((current.id == "donkey" || next.id == "donkey") && isWoddenBridgeOnLava)
        return false;
    return true;
});
``` 

Obliviously there are a lot of things that can be equivalently done both in data callback and in/out animation. 

## SushiMenuInput

To offer a game-like experience, together with SushiMenuJs it comes a library extension that allows the user to navigate the menu also with the keyboard. Is indeed sufficient to include the **“SushiMenuInput.js”** file and recall the initialization function with the instance of the graph to which bind the input and a map of the desired input key and it’s done. \
Actually the list of possible actions is:
- Directional movement (up, down, left, right).
- Trigger the click action on current item (confirm).
- Go back to the previous menu (back).

When navigating, the library automatically computes the next items in the current direction. \
**NB:** The navigation is done only within the items of the same layout, so if an item is outside the layout tab, it is not considered.

``` html
<script src="scr/sushiMenu.js"></script>
<script src="scr/sushiMenuInput.js"></script>
<script>
    SM.input.bindInput(menuGraph, {
        back: [27],         // Esc
        select: [13],       // Enter
        down: [83, 40],     // S, DownArrow
        left: [65, 37],     // A, LeftArrow
        up: [87, 38],       // W, UpArrow
        right: [68, 39],    // D, RightArrow
    });
</script>
```

To allow the user extra customization during navigation, the input library adds two classes and two events. \
\
The **“sm-active”** class is assigned to the current active item. If no item is active when a navigation key is pressed, the first menu’s item is activated. An item can also be activated / deactivated through the hovering of the mouse. If an item has **“sm-no-input”** class it is not considered a valid item for the purpose of navigation.\
\
The **“sm-activate”** event is called every time an item becomes the current active item, while **“sm-deactivate”** event is called when it stops to be the active one. The Event object passed as parameter uses the detail attribute to pass the following data around:
- target: The item targeted by the event.
- other: For activate event, the previous active item, for deactivate event the new item. Can be null.
- isMouseTrigger: If the event is triggered by the mouse.
- direction: Can be "up", "down", "left" or "right" in case of keyboard's navigation, "restoreFocus", "firstFocus", "leaveMenu" or a custom value for focus event.
The event of deactivation is called on any active items when leaving the menu.

### Focus

Working with UI in games, I have learnt how important is the focus during navigation of menu, for this reason the library exposes three functions that allow to control the focus.

- setFocusOn(menu, element, isMouseTrigger, dir) that sets the focus to the element parameter if it is an HTMLElement, otherwise it tries to parse the element as integer and take the i-st element. All parameters are optional.
- saveFocus(menu, item) that saves the current item as the last one. The focus is cleaned during the data callback after the animations, so this method must be called before that moment. 
- restoreFocus(menu, isMouseTrigger) that restores the focus on the last element if any was saved exiting the restored menu, otherwise it set the focus to the first element.

``` html
<script>
    function onLeavingHighestRoom(from, to) {
        from.style.display = 'none';
        
        SM.input.saveFocus();
    }

    function onEnteringHighestRoom(from, to) {
        to.style.display = '';

        SM.input.restoreFocus();
    }
</script>
<div id="sm-viewport">
    <div id="highest-room" class="sm-menu">
        <div class="sm-layout sm-main-layout">
            <div class="sm-item-container">
                <div class="princess">
                    <h1>Fiona</h1>
                </div>
            </div>
            <div class="sm-item-container">
                <div class="wolf">
                    <h1>Wolf</h1>
                </div>
            </div>
        </div>
</div>
``` 
