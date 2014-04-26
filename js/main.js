// Constants.
var MAX_WIDTH = 800;
var MAX_HEIGHT = 600;

var DOOD_WIDTH = 32;
var DOOD_HEIGHT = 48;

var LIGHT_SCALE = 8;
var LIGHT_DELAY = 80;

var PLAYER_VELOCITY = 140;
var ZOMBIE_VELOCITY = 40;

// GameState object.
function GameState() {
	'use strict';
	
	Phaser.State.call(this);
}

GameState.prototype = Object.create(Phaser.State.prototype);

GameState.prototype.preload = function () {
	'use strict';
	this.load.spritesheet("dummies", "assets/sprites/dummies.png", DOOD_WIDTH, DOOD_HEIGHT);
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
	var spawnObj = this.map.objects.doods[0];
	this.player = new Player(this.game, spawnObj.x, spawnObj.y-DOOD_HEIGHT);
	this.camera.follow(this.player, Phaser.Camera.FOLLOW_TOPDOWN);
	
	this.mobs = new Array();
	for (var i = 1 ; i < this.map.objects.doods.length ; i++)
	{
		spawnObj = this.map.objects.doods[i];
		this.mobs[i] = new Dood(this.game, spawnObj.x, spawnObj.y-DOOD_HEIGHT, 1);
		this.mobs[i].body.velocity.x = ZOMBIE_VELOCITY;
	}
	
	// Lighting.
	this.i_lantern = this.cache.getImage("radial_light");
	
	this.i_mask = this.game.make.bitmapData(MAX_WIDTH, MAX_HEIGHT);
	this.lightmap = this.game.add.image(0,0,this.i_mask);
//	this.lightmap.scale.set(LIGHT_SCALE, LIGHT_SCALE);
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
	
	// Shamble around aimlessly.
	for (var i = 1 ; i < this.map.objects.doods.length ; i++)
	{
		this.game.physics.arcade.collide(this.mobs[i], this.mapLayer);
		var zed = this.mobs[i].body;
		if (zed.blocked.up||zed.blocked.down||zed.blocked.left||zed.blocked.right)
			switch (this.rnd.integer()%4) {
				case 0:
					zed.velocity.x = 0;
					zed.velocity.y = -ZOMBIE_VELOCITY;
					break;
				case 1:
					zed.velocity.x = 0;
					zed.velocity.y = ZOMBIE_VELOCITY;
					break;
				case 2:
					zed.velocity.y = 0;
					zed.velocity.x = -ZOMBIE_VELOCITY;
					break;
				case 3:
					zed.velocity.y = 0;
					zed.velocity.x = ZOMBIE_VELOCITY;
					break;
			}
	}
	
	// Update lighting.
	this.i_mask.context.fillStyle = "rgba(0,0,0,1.0)";
	this.i_mask.context.globalCompositeOperation = 'source-over';
	this.i_mask.context.fillRect(0, 0, MAX_WIDTH, MAX_HEIGHT);
	this.i_mask.context.globalCompositeOperation = 'destination-out';
	
	this.drawLight(this.player.x + this.player.width / 2,
				   this.player.y + this.player.height / 2,
				   this.lightVariant, LIGHT_SCALE);
	var mapLights = this.map.objects.lights;
	for(var i=0; i<mapLights.length; ++i) {
		this.drawLight(mapLights[i].x + 16,
					   mapLights[i].y - 16,
					   this.lightVariant,
					   mapLights[i].properties.size);
	}

	this.i_mask.dirty = true;
	
	this.lightmap.x = this.camera.x;
	this.lightmap.y = this.camera.y;
};

GameState.prototype.render = function () {
	'use strict';
	this.game.debug.text("FPS: " + String(this.time.fps), 8, 16);
};

GameState.prototype.drawLight = function(wx, wy, variant, scale) {
	var lx = (variant % 4) * 32;
	var ly = this.math.truncate(variant / 4) * 32;
	this.i_mask.context.drawImage(this.i_lantern,
		lx, ly, 32, 32,		  
		(wx - this.camera.x) - 16 * scale,
		(wy - this.camera.y) - 16 * scale,
		32 * scale, 32 * scale);
};

// Dood object.
function Dood(game, x, y, id, group) {
	'use strict';
	
	if (typeof group === 'undefined') { group = game.world; }
	
	Phaser.Sprite.call(this, game, x, y, "dummies", id);
	group.add(this);
	
	this.game.physics.arcade.enable(this);
	this.body.setSize(32, 32, 0, 16);
}

Dood.prototype = Object.create(Phaser.Sprite.prototype);

// Player object.
function Player(game, x, y) {
	'use strict';
	
	Dood.call(this, game, x, y, 0);
}

Player.prototype = Object.create(Dood.prototype);

// Actual main.
var game = new Phaser.Game(MAX_WIDTH, MAX_HEIGHT, Phaser.AUTO, '', GameState);

