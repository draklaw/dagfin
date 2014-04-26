// "Global" variables.
var Phaser = Phaser || null;
var Dood = Dood || null;

// GameState object.
function GameState() {
	'use strict';
    
	Phaser.State.call(this);
}

GameState.prototype = Object.create(Phaser.State.prototype);

GameState.prototype.preload = function () {
	'use strict';
	this.load.image("player", "assets/sprites/dummy_char.png");
};

GameState.prototype.create = function () {
	'use strict';
	this.time.advancedTiming = true;
	
	this.player = new Dood(this.game, 0, 0, "player");
};

GameState.prototype.update = function () {
	'use strict';
	
	
};

GameState.prototype.render = function () {
	'use strict';
	this.game.debug.text("FPS: " + String(this.time.fps), 8, 16);
};

// Dood object.
function Dood(game, x, y, img, group) {
	'use strict';
	
	if (typeof group === 'undefined') { group = game.world; }
	
	Phaser.Sprite.call(this, game, x, y, img);
	group.add(this);
}

Dood.prototype = Object.create(Phaser.Sprite.prototype);

// Player object.
function Player() {
	'use strict';
}

// Actual main.
var game = new Phaser.Game(800, 600, Phaser.AUTO, '', GameState);

