// Constants.
var MAX_WIDTH = 800;
var MAX_HEIGHT = 600;

var DOOD_WIDTH = 32;
var DOOD_HEIGHT = 48;
var DOOD_OFFSET_X = 16;
var DOOD_OFFSET_Y = -16;
var PLAYER_VELOCITY = 140;

var DOWN  = 0;
var UP    = 1;
var RIGHT = 2;
var LEFT  = 3;

var ZOMBIE_SHAMBLE_VELOCITY = 40;
var ZOMBIE_CHARGE_VELOCITY = 400;
var ZOMBIE_SPOTTING_RANGE = 160;
var ZOMBIE_SPOTTING_ANGLE = Math.sin(Math.PI / 6); // Don't ask.
var ZOMBIE_SPOTTING_DELAY = 50;
var ZOMBIE_CHARGE_DELAY = 0;
var ZOMBIE_IDEA_DELAY = 5000;

var NORMAL  = 0;
var BERZERK = 1;

var LIGHT_SCALE = 8;
var LIGHT_DELAY = 80;
var LIGHT_RAND = .01;
var LIGHT_COLOR_RAND = .2;

// GameState object.
function GameState() {
	'use strict';
	
	Phaser.State.call(this);
}

GameState.prototype = Object.create(Phaser.State.prototype);

GameState.prototype.preload = function () {
	'use strict';

	this.load.image("black", "assets/sprites/black.png");
	this.load.spritesheet("noise", "assets/sprites/noise.png", 200, 150);
	
	this.load.image("message_bg", "assets/message_bg.png");
	this.load.bitmapFont("message_font", "assets/fonts/font.png",
						 "assets/fonts/font.fnt");

	this.load.spritesheet("dummies", "assets/sprites/zombie.png", DOOD_WIDTH, DOOD_HEIGHT);
	this.load.spritesheet("player", "assets/sprites/player.png", DOOD_WIDTH, DOOD_HEIGHT);

	this.load.image("background", "assets/dummy_background.png");
	this.load.image("defaultTileset", "assets/tilesets/test.png");
	this.load.image("radial_light", "assets/sprites/radial_light.png");
	
	this.load.tilemap("map", "assets/maps/test.json", null,
	                  Phaser.Tilemap.TILED_JSON);
};

GameState.prototype.create = function () {
	'use strict';
	this.time.advancedTiming = true;
	
	// Cap at 30fps to try to avoid people going through walls.
	this.time.deltaCap = 0.033333;
	
	this.game.physics.startSystem(Phaser.Physics.ARCADE);
	
	// Keyboard controls.
	this.k_up = this.game.input.keyboard.addKey(Phaser.Keyboard.UP);
	this.k_down = this.game.input.keyboard.addKey(Phaser.Keyboard.DOWN);
	this.k_left = this.game.input.keyboard.addKey(Phaser.Keyboard.LEFT);
	this.k_right = this.game.input.keyboard.addKey(Phaser.Keyboard.RIGHT);
	this.k_space = this.game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
	
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
	this.player = new Player(this.game, spawnObj.x+DOOD_OFFSET_X, spawnObj.y+DOOD_OFFSET_Y);
	this.camera.follow(this.player, Phaser.Camera.FOLLOW_TOPDOWN);
	
	this.mobs = new Array();
	for (var i = 1 ; i < this.map.objects.doods.length ; i++)
	{
		spawnObj = this.map.objects.doods[i];
		this.mobs[i] = new Dood(this.game, spawnObj.x+DOOD_OFFSET_X, spawnObj.y+DOOD_OFFSET_Y, "dummies");

		var that = this, j = i;
		this.mobs[i].shamble = function () {
			var zed = that.mobs[j];
			zed.facing = that.rnd.integer()%4;
			switch (zed.facing) {
				case DOWN:
					zed.body.velocity.x = 0;
					zed.body.velocity.y = ZOMBIE_SHAMBLE_VELOCITY;
					break;
				case UP:
					zed.body.velocity.x = 0;
					zed.body.velocity.y = -ZOMBIE_SHAMBLE_VELOCITY;
					break;
				case RIGHT:
					zed.body.velocity.y = 0;
					zed.body.velocity.x = ZOMBIE_SHAMBLE_VELOCITY;
					break;
				case LEFT:
					zed.body.velocity.y = 0;
					zed.body.velocity.x = -ZOMBIE_SHAMBLE_VELOCITY;
					break;
			};
		};
		this.time.events.loop(ZOMBIE_IDEA_DELAY, this.mobs[i].shamble, this);
		
		this.mobs[i].spot = function () {
			var zed = that.mobs[j];
			if (!zed.looks == BERZERK && that.lineOfSight(zed, that.player)) {
				zed.looks = BERZERK;
				//TODO: Make a scary noise.
				that.game.physics.arcade.moveToObject(zed, that.player, ZOMBIE_CHARGE_VELOCITY);
			}
		};
		this.time.events.loop(ZOMBIE_SPOTTING_DELAY, this.mobs[i].spot, this);
	}
	
	this.postProcessGroup = this.add.group();
	
	// Lighting.
	this.enableLighting = true;
	
	if(this.enableLighting) {
		this.lightmap = this.make.renderTexture(MAX_WIDTH, MAX_HEIGHT, "lightmap");
		this.lightLayer = this.add.sprite(0, 0, this.lightmap, 0, this.postProcessGroup);
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

		this.playerLight = this.addLight(this.player.x,
										 this.player.y - 16,
										 LIGHT_SCALE);

		this.time.events.loop(LIGHT_DELAY, function() {
			this.lightGroup.forEach(function(light) {
				var scale = light.lightSize * this.rnd.realInRange(1.-LIGHT_RAND, 1.+LIGHT_RAND);
				light.scale.set(scale, scale);
				light.tint = this.multColor(light.lightColor, this.rnd.realInRange(1-LIGHT_COLOR_RAND, 1));
			}, this);
		}, this);
	}

	// Message box !
	this.messageGroup = this.add.group(this.postProcessGroup);
	this.messageBg = this.add.sprite(24, 384, "message_bg", 0, this.messageGroup);
	this.message = this.add.bitmapText(40, 400, "message_font", "", 24, this.messageGroup);
	this.messageQueue = [ "Test !", "Plop.", "Coin !" ];
	this.nextMessage();
	
	// Noise pass
	this.noiseSprite = this.add.sprite(0, 0, "noise", 0, this.postProcessGroup);
	this.noiseSprite.animations.add("noise", null, 24, true);
	this.noiseSprite.animations.play("noise");
	this.noiseSprite.scale.set(4, 4);
	this.noiseSprite.alpha = .2;
};

GameState.prototype.update = function () {
	'use strict';
	
	var pc = this.player;
	this.game.physics.arcade.collide(pc, this.mapLayer);
	
	// React to controls.
	pc.body.velocity.set(0, 0);
	if (this.k_down.isDown) {
		pc.body.velocity.y = PLAYER_VELOCITY;
		pc.facing = DOWN;
	}
	if (this.k_up.isDown) {
		pc.body.velocity.y = -PLAYER_VELOCITY;
		pc.facing = UP;
	}
	if (this.k_right.isDown) {
		pc.body.velocity.x = PLAYER_VELOCITY;
		pc.facing = RIGHT;
	}
	if (this.k_left.isDown) {
		pc.body.velocity.x = -PLAYER_VELOCITY;
		pc.facing = LEFT;
	}
	pc.frame = pc.looks*4 + pc.facing;
	
	if(this.k_space.justPressed(1)) {
		this.nextMessage();
	}
	
	// Everyday I'm shambling.
	for (var i = 1 ; i < this.map.objects.doods.length ; i++)
	{
		var zed = this.mobs[i];
		
		// Stumble against the walls.
		this.game.physics.arcade.collide(zed, this.mapLayer);
		var zblock = zed.body.blocked;
		if (zblock.up || zblock.down || zblock.left || zblock.right)
			zed.shamble();
		zed.frame = zed.looks*4 + zed.facing;
		
		// EXTERMINATE ! EXTERMINATE !
		if (zed.body.hitTest(this.player.x, this.player.y)) {
			zed.looks = BERZERK;
			pc.body.velocity.set(0,0);
			//console.log("HULK SMASH !");
		}
		else if (zed.looks == BERZERK && !this.lineOfSight(zed, this.player)) {
			// We lost him, boss !
			//console.log("Huh ?");
			zed.looks = NORMAL;
		}
	}
	
	this.postProcessGroup.x = this.camera.x;
	this.postProcessGroup.y = this.camera.y;

	// Update lighting.
	if(this.enableLighting) {
		this.playerLight.x = this.player.x;
		this.playerLight.y = this.player.y - 16;

		this.lightmap.renderXY(this.lightLayerGroup,
							   -this.camera.x,
							   -this.camera.y);
	}
};

GameState.prototype.render = function () {
	'use strict';
	this.game.debug.text("FPS: " + String(this.time.fps), 8, 16);
	/* CHECK LINE OF SIGHT OF ZOMBIE 1
	var line = new Phaser.Line(this.player.x, this.player.y, this.mobs[1].x, this.mobs[1].y);
	this.game.debug.geom(line, "rgb(0, 255, 255)");

	var tiles = this.mapLayer.getRayCastTiles(line);
	for (var i = 0 ; i < tiles.length ; i++) {
		var color = "rgba(0, 0, 255, .5)";
		if (tiles[i].canCollide)
			color = "rgba(255, 0, 0, .5)";
		this.game.debug.geom(new Phaser.Rectangle(tiles[i].x*32, tiles[i].y*32, tiles[i].width, tiles[i].height), color);
	}
	*/
};

GameState.prototype.addLight = function(x, y, size, color) {
	if(typeof color === 'undefined') { color = 0xffffff; }
	
	var light = this.add.sprite(x + 16,
								y - 16,
								'radial_light',
								0,
								this.lightGroup);

	light.anchor.set(.5, .5);
	light.lightSize = size / 2;
	var scale = size * this.rnd.realInRange(1.-LIGHT_RAND, 1.+LIGHT_RAND);;
	light.scale.set(scale);

	light.blendMode = PIXI.blendModes.ADD;
	light.lightColor = color;
	light.tint = color;
	
	return light;
};

GameState.prototype.stringToColor = function(str) {
	if(!str) {
		return 0xffffff;
	}
	return parseInt(str, 16);
};

GameState.prototype.multColor = function(color, mult) {
	var a = (color >> 24) & 0xff;
	var r = (color >> 16) & 0xff;
	var g = (color >> 8) & 0xff;
	var b = (color >> 0) & 0xff;
	
	r *= mult;
	g *= mult;
	b *= mult;
	
	return (
		(a & 0xff) << 24 |
		(r & 0xff) << 16 |
		(g & 0xff) << 8 |
		(b & 0xff));
};

GameState.prototype.obstructed = function(line) {
	tiles = this.mapLayer.getRayCastTiles(line);
	
	for (var i = 0 ; i < tiles.length ; i++)
		if (tiles[i].canCollide)
			return true;
	return false;
};

GameState.prototype.nextMessage = function() {
	if(this.messageQueue.length === 0) {
		this.messageGroup.callAll('kill');
		this.message.text = "";
	}
	else {
		this.messageGroup.callAll('revive');
		this.message.text = this.messageQueue.shift();
	}
};

// Kind of assumes the stalker is a zombie.
GameState.prototype.lineOfSight = function(stalker, victim) {
	var glance = new Phaser.Line(stalker.x, stalker.y, victim.x, victim.y);
	var staring_angle = (glance.angle+3*Math.PI/2)-(2*Math.PI-stalker.body.angle);
	// Don't ask, lest the zombie stare at YOU instead.
	return glance.length < ZOMBIE_SPOTTING_RANGE && !this.obstructed(glance) &&
	Math.cos(staring_angle) > 0 && Math.abs(Math.sin(staring_angle)) < ZOMBIE_SPOTTING_ANGLE;
};

// Dood object.
function Dood(game, x, y, spritesheet, group) {
	'use strict';
	
	if (typeof group === 'undefined') { group = game.world; }
	
	Phaser.Sprite.call(this, game, x, y, spritesheet, 0);
	group.add(this);
	this.anchor.set(.5, .6666667);
	
	this.looks = NORMAL;
	this.facing = DOWN;
	
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

