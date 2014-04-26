// "Global" variables.
var Phaser = Phaser || null;
var Dood = Dood || null;

// Constants.
var MAX_WIDTH = 800;
var MAX_HEIGHT = 600;

var LIGHT_SCALE = 8;
var LIGHT_DELAY = 80;

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
	this.load.image("background", "assets/dummy_background.png");
	this.load.image("radial_light", "assets/sprites/radial_light.png");
	this.load.image("defaultTileset", "assets/tilesets/test.png");
	
	this.load.tilemap("map", "assets/maps/test.json", null,
	                  Phaser.Tilemap.TILED_JSON);
};

GameState.prototype.create = function () {
	'use strict';
	this.time.advancedTiming = true;
	
	this.game.physics.startSystem(Phaser.Physics.ARCADE);
	
	// Keyboard controls.
	this.k_up = this.game.input.keyboard.addKey(Phaser.Keyboard.UP);
	this.k_down = this.game.input.keyboard.addKey(Phaser.Keyboard.DOWN);
	this.k_left = this.game.input.keyboard.addKey(Phaser.Keyboard.LEFT);
	this.k_right = this.game.input.keyboard.addKey(Phaser.Keyboard.RIGHT);
	
	// Background.
	this.game.add.image(0, 0, "background");
	
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
	
	// Lighting.
	this.i_lantern = this.cache.getImage("radial_light");
	
	this.i_mask = this.game.make.bitmapData(MAX_WIDTH, MAX_HEIGHT);
	this.lightmap = this.game.add.image(0,0,this.i_mask);
	this.lightmap.scale.set(LIGHT_SCALE, LIGHT_SCALE);
	this.lightVariant = 0;
	this.time.events.loop(LIGHT_DELAY, function() {
		this.lightVariant = (this.lightVariant+1) % 8; }, this);
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
	
	// Update lighting.
	this.i_mask.context.fillStyle = "rgba(0,0,0,1.0)";
	this.i_mask.context.globalCompositeOperation = 'source-over';
	this.i_mask.context.fillRect(0, 0, MAX_WIDTH/LIGHT_SCALE, MAX_HEIGHT/LIGHT_SCALE);
	this.i_mask.context.globalCompositeOperation = 'destination-out';

	this.drawLight(this.player.x + this.player.width / 2,
				   this.player.y + this.player.height / 2,
				   this.lightVariant);
	
	this.i_mask.dirty = true;
	
	this.lightmap.x = this.camera.x;
	this.lightmap.y = this.camera.y;
};

GameState.prototype.render = function () {
	'use strict';
	this.game.debug.text("FPS: " + String(this.time.fps), 8, 16);
};

GameState.prototype.drawLight = function(wx, wy, variant) {
	var lx = (variant % 4) * 32;
	var ly = this.math.truncate(variant / 4) * 32;
	this.i_mask.context.drawImage(this.i_lantern,
		lx, ly, 32, 32,		  
		(wx - this.camera.x) / LIGHT_SCALE - 16,
		(wy - this.camera.y) / LIGHT_SCALE - 16,
		32, 32);
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
var game = new Phaser.Game(MAX_WIDTH, MAX_HEIGHT, Phaser.AUTO, '', GameState);

