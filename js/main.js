// "Global" variables.
var Phaser = Phaser || null;
var Dood = Dood || null;

var PLAYER_VELOCITY = 140;

// GameState object.
function GameState() {
	'use strict';
	
	Phaser.State.call(this);
}

GameState.prototype = Object.create(Phaser.State.prototype);

GameState.prototype.preload = function () {
	'use strict';
	this.load.image("player", "assets/sprites/dummy_char.png");
	this.load.image("defaultTileset", "assets/tilesets/test.png");
	
	this.load.tilemap("map", "assets/maps/test.json", null,
					  Phaser.Tilemap.TILED_JSON);
};

GameState.prototype.create = function () {
	'use strict';
	this.time.advancedTiming = true;
	
//	this.game.physics.startSystem(Phaser.Physics.ARCADE);
	
	// Keyboard controls.
	this.k_up = this.input.keyboard.addKey(Phaser.Keyboard.UP);
	this.k_down = this.input.keyboard.addKey(Phaser.Keyboard.DOWN);
	this.k_left = this.input.keyboard.addKey(Phaser.Keyboard.LEFT);
	this.k_right = this.input.keyboard.addKey(Phaser.Keyboard.RIGHT);
	
	// Map.
	this.map = this.game.add.tilemap("map");
	this.map.addTilesetImage("default", "defaultTileset");
	this.map.setCollision([
		10, 13, 14,
		18, 21, 22,
		26,
		49, 51
	]);
	
	this.mapLayer = this.map.createLayer("map");
	this.mapLayer.resizeWorld();
//	this.mapLayer.debug = true;
	
	// People.
	var spawnObj = this.map.objects.entities[0];
	var playerHeight = this.cache.getImage("player").height;
	this.player = new Dood(this.game, spawnObj.x, spawnObj.y-playerHeight, "player");
	
	this.camera.follow(this.player, Phaser.Camera.FOLLOW_TOPDOWN);
};

GameState.prototype.update = function () {
	'use strict';

	this.game.physics.arcade.collide(this.player, this.mapLayer);
	
	// React to controls.
	this.player.body.velocity.set(0, 0);
	if (this.k_up.isDown)
		this.player.body.velocity.y = -PLAYER_VELOCITY;
	if (this.k_down.isDown)
		this.player.body.velocity.y = PLAYER_VELOCITY;
	if (this.k_left.isDown)
		this.player.body.velocity.x = -PLAYER_VELOCITY;
	if (this.k_right.isDown)
		this.player.body.velocity.x = PLAYER_VELOCITY;
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
	
	this.game.physics.arcade.enable(this);
	this.body.setSize(32, 32, 0, 16);
}

Dood.prototype = Object.create(Phaser.Sprite.prototype);

// Player object.
function Player() {
	'use strict';
}

// Actual main.
var game = new Phaser.Game(800, 600, Phaser.AUTO, '', GameState);

