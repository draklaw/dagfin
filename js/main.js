// Constants.
var MAX_WIDTH = 800;
var MAX_HEIGHT = 600;

var DOOD_WIDTH = 32;
var DOOD_HEIGHT = 48;

var LIGHT_SCALE = 8;
var LIGHT_DELAY = 80;
var LIGHT_RAND = .01;

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

	this.load.image("black", "assets/sprites/black.png");

	this.load.spritesheet("dummies", "assets/sprites/dummies.png", DOOD_WIDTH, DOOD_HEIGHT);
	this.load.spritesheet("player", "assets/sprites/player.png", DOOD_WIDTH, DOOD_HEIGHT);

	this.load.image("background", "assets/dummy_background.png");
	this.load.image("defaultTileset", "assets/tilesets/test.png");
	this.load.spritesheet("radial_light", "assets/sprites/radial_light.png", 32, 32);
	
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
		this.mobs[i] = new Dood(this.game, spawnObj.x, spawnObj.y-DOOD_HEIGHT, "dummies");
		this.mobs[i].body.velocity.x = ZOMBIE_VELOCITY;
	}
	
	// Lighting.
	this.lightmap = this.make.renderTexture(MAX_WIDTH, MAX_HEIGHT, "lightmap");
	this.lightLayer = this.add.sprite(0, 0, this.lightmap);
	this.lightLayer.blendMode = PIXI.blendModes.MULTIPLY;
	
	// Contains all the stuff renderer to the lightmap.
	this.lightLayerGroup = this.make.group();

	this.lightClear = this.add.sprite(0, 0, "black", 0, this.lightLayerGroup);
	this.lightClear.scale.set(this.map.widthInPixels, this.map.heightInPixels);

	this.lightGroup = this.add.group(this.lightLayerGroup);

	var mapLights = this.map.objects.lights;
	for(var i=0; i<mapLights.length; ++i) {
		this.addLight(mapLights[i].x, mapLights[i].y,
					  mapLights[i].properties.size,
					  this.stringToColor(mapLights[i].properties.color));
	}
	
	this.playerLight = this.addLight(this.player.x + this.player.width / 2,
									 this.player.y + this.player.height / 2,
					  				 LIGHT_SCALE);

	this.time.events.loop(LIGHT_DELAY, function() {
		this.lightGroup.forEach(function(light) {
			light.frame = (light.frame+1) % 8;
			var scale = light.lightSize * this.rnd.realInRange(1.-LIGHT_RAND, 1.+LIGHT_RAND);
			light.scale.set(scale, scale);
		}, this);
	}, this);
};

GameState.prototype.update = function () {
	'use strict';
	
	this.game.physics.arcade.collide(this.player, this.mapLayer);
	
	// React to controls.
	this.player.body.velocity.set(0, 0);
	if (this.k_down.isDown) {
		this.player.body.velocity.y = PLAYER_VELOCITY;
		this.player.frame = 0;
	}
	if (this.k_up.isDown) {
		this.player.body.velocity.y = -PLAYER_VELOCITY;
		this.player.frame = 1;
	}
	if (this.k_right.isDown) {
		this.player.body.velocity.x = PLAYER_VELOCITY;
		this.player.frame = 2;
	}
	if (this.k_left.isDown) {
		this.player.body.velocity.x = -PLAYER_VELOCITY;
		this.player.frame = 3;
	}
	
	// Shamble around aimlessly.
	for (var i = 1 ; i < this.map.objects.doods.length ; i++)
	{
		this.game.physics.arcade.collide(this.mobs[i], this.mapLayer);
//this.game.physics.arcade.collide(this.mobs[i], this.player);
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
	this.playerLight.x = this.player.x + 16;
	this.playerLight.y = this.player.y + 24;
	
	this.lightmap.renderXY(this.lightLayerGroup,
						   -this.camera.x,
						   -this.camera.y);
	
	this.lightLayer.x = this.camera.x;
	this.lightLayer.y = this.camera.y;
};

GameState.prototype.render = function () {
	'use strict';
	this.game.debug.text("FPS: " + String(this.time.fps), 8, 16);
};

GameState.prototype.addLight = function(x, y, size, color) {
	if(typeof color === 'undefined') { color = 0xffffff; }
	
	var light = this.add.sprite(x + 16,
								y - 16,
								'radial_light',
								this.rnd.integer() % 8,
								this.lightGroup);

	light.anchor.set(.5, .5);
	light.lightSize = size;
	var scale = size * this.rnd.realInRange(1.-LIGHT_RAND, 1.+LIGHT_RAND);;
	light.scale.set(scale);

	light.blendMode = PIXI.blendModes.ADD;
	light.tint = color;
	
	return light;
};

GameState.prototype.stringToColor = function(str) {
	if(!str) {
		return 0xffffff;
	}
	return parseInt(str, 16);
};

// Dood object.
function Dood(game, x, y, spritesheet, group) {
	'use strict';
	
	if (typeof group === 'undefined') { group = game.world; }
	
	Phaser.Sprite.call(this, game, x, y, spritesheet, 0);
	group.add(this);
	
	this.game.physics.arcade.enable(this);
	this.body.setSize(32, 32, 0, 16);
}

Dood.prototype = Object.create(Phaser.Sprite.prototype);

// Player object.
function Player(game, x, y) {
	'use strict';
	
	Dood.call(this, game, x, y, "player");
}

Player.prototype = Object.create(Dood.prototype);

// Actual main.
var game = new Phaser.Game(MAX_WIDTH, MAX_HEIGHT, Phaser.AUTO, '', GameState);

