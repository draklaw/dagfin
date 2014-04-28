// Constants.
var MAX_WIDTH = 800;
var MAX_HEIGHT = 600;

var DOOD_WIDTH = 32;
var DOOD_HEIGHT = 48;
var DOOD_OFFSET_X = 16;
var DOOD_OFFSET_Y = -16;

var DOWN  = 0;
var UP    = 1;
var RIGHT = 2;
var LEFT  = 3;

var PLAYER_VELOCITY = 140;

var HIT_COOLDOWN = 250;

var ZOMBIE_SHAMBLE_VELOCITY = 40;
var ZOMBIE_CHARGE_VELOCITY = 400;
var ZOMBIE_SPOTTING_RANGE = 160;
var ZOMBIE_SPOTTING_ANGLE = Math.sin(Math.PI / 6); // Don't ask.
var ZOMBIE_SPOTTING_DELAY = 50;
var ZOMBIE_CHARGE_DELAY = 0;
var ZOMBIE_STUN_DELAY = 1000;
var ZOMBIE_IDEA_DELAY = 5000;

var NORMAL  = 0;
var STUNNED = 1;
var BERZERK = 2;

var FLOOR_CRUMBLING_DELAY = 500;

var LIGHT_SCALE = 8;
var LIGHT_DELAY = 80;
var LIGHT_RAND = .01;
var LIGHT_COLOR_RAND = .2;


////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// GAME STATE !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

function GameState() {
	'use strict';
	
	Phaser.State.call(this);
	
}

GameState.prototype = Object.create(Phaser.State.prototype);


////////////////////////////////////////////////////////////////////////////
// Init

GameState.prototype.init = function(levelId) {
	'use strict';
	
	console.log("Load level: "+levelId);
	levelId = levelId || 'intro';
	
	if(levelId === 'intro') {
		this.level = new IntroLevel(this);
	}
	else if(levelId === 'test') {
		this.level = new TestLevel(this);
	}
	else if(levelId === 'expe') {
		this.level = new ExperimentalLevel(this);
	}
	else {
		console.error("Unknown level '"+levelId+"'.");
	}
};

////////////////////////////////////////////////////////////////////////////
// Preload

GameState.prototype.preload = function () {
	'use strict';
	
	this.load.image("black", "assets/sprites/black.png");
	this.load.spritesheet("noise", "assets/sprites/noise.png", 200, 150);
	
	this.load.image("message_bg", "assets/message_bg.png");
	this.load.bitmapFont("message_font", "assets/fonts/font.png",
						 "assets/fonts/font.fnt");
//	this.load.json("message_test", "assets/texts/test.json");
	
	this.load.spritesheet("zombie", "assets/sprites/zombie.png", DOOD_WIDTH, DOOD_HEIGHT);
	this.load.spritesheet("player", "assets/sprites/player.png", DOOD_WIDTH, DOOD_HEIGHT);
	
	this.load.image("radial_light", "assets/sprites/radial_light.png");
	
	this.load.json("sfxInfo", "assets/audio/sfx/sounds.json");
    	//this.load.audio('sfx', this.cache.getJSON("sfxInfo").resources);
	this.load.audio('sfx', ["assets/audio/sfx/sounds.mp3","assets/audio/sfx/sounds.ogg"]);
	
//	this.load.tilemap("map", "assets/maps/test.json", null, Phaser.Tilemap.TILED_JSON);
	
	
	this.level.preload();
};


////////////////////////////////////////////////////////////////////////////
// Create

GameState.prototype.create = function () {
	'use strict';
	
	// System stuff...
	this.time.advancedTiming = true;
	
	// Cap at 30fps to try to avoid people going through walls.
	this.time.deltaCap = 0.033333;
	
	this.game.physics.startSystem(Phaser.Physics.ARCADE);
	
	
	// Some settings...
	this.enableLighting = true;

	// Message box ! (Needed before level.create())
	this.messageGroup = this.make.group(this.postProcessGroup);
	this.messageBg = this.add.sprite(24, 384, "message_bg", 0, this.messageGroup);
	this.message = this.add.bitmapText(40, 400, "message_font", "", 24, this.messageGroup);
	this.messageQueue = [];
	this.blocPlayerWhileMsg = true;
	this.messageCallback = null;
	this.nextMessage();
	
	// Keyboard controls.
	this.k_up = this.game.input.keyboard.addKey(Phaser.Keyboard.UP);
	this.k_down = this.game.input.keyboard.addKey(Phaser.Keyboard.DOWN);
	this.k_left = this.game.input.keyboard.addKey(Phaser.Keyboard.LEFT);
	this.k_right = this.game.input.keyboard.addKey(Phaser.Keyboard.RIGHT);
	this.k_punch = this.game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
	this.k_use = this.game.input.keyboard.addKey(Phaser.Keyboard.CONTROL);
	this.k_read = this.game.input.keyboard.addKey(Phaser.Keyboard.ENTER);

	this.k_debug = this.game.input.keyboard.addKey(Phaser.Keyboard.BACKSPACE);
	//TODO: m et M (sound control)

	// Sound effects
	var soundSprite = this.cache.getJSON("sfxInfo").spritemap;
	this.sfx = this.add.audio('sfx');
	for (var key in soundSprite){
		this.sfx.addMarker(key, soundSprite[key].start, soundSprite[key].end - soundSprite[key].start, 1, soundSprite[key].loop);
	}

	// Map.
	this.level.create();
	
	this.mapLayer = this.map.createLayer("map");
	this.mapLayer.resizeWorld();
//	this.mapLayer.debug = true;
	
	// Group all the stuff on the ground (always in background)
	this.objectsGroup = this.add.group();
	// Group all the stuff that should be sorted by depth.
	this.characters = this.add.group();	
	
	// Items in the map
	this.objects = {};
	if(this.map.objects.items) {
		for(var i = 0 ; i < this.map.objects.items.length ; i++) {
			var item = this.map.objects.items[i];
			var offset_x = parseInt(item.properties.offset_x, 10) || 0;
			var offset_y = parseInt(item.properties.offset_y, 10) || 0;
			var sprite = this.add.sprite(item.x + offset_x + 16,
										 item.y + offset_y - 16,
										 item.name+"_item", 0, this.objectsGroup);
			sprite.anchor.set(.5, .5);
			this.objects[item.name] = sprite;
			sprite.objName = item.name;
			this.game.physics.arcade.enable(sprite);
		}
	}
	
	// People.
	var spawnObj = this.map.objects.doods[0];
	this.player = new Player(this.game, spawnObj.x+DOOD_OFFSET_X, spawnObj.y+DOOD_OFFSET_Y);
	this.camera.follow(this.player, Phaser.Camera.FOLLOW_TOPDOWN);
	
	this.mobs = new Array();
	for (var i = 1 ; i < this.map.objects.doods.length ; i++)
	{
		spawnObj = this.map.objects.doods[i];
		this.mobs[i] = new Dood(this.game, spawnObj.x+DOOD_OFFSET_X, spawnObj.y+DOOD_OFFSET_Y, "zombie");
		
		var that = this, j = i;
		this.mobs[i].shamble = function () {
			var zed = that.mobs[j];
			if (zed.looks == STUNNED)
				return;
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
			if (zed.looks == NORMAL && that.lineOfSight(zed, that.player)) {
				zed.looks = BERZERK;
				//TODO: Make a scary noise.
				that.game.physics.arcade.moveToObject(zed, that.player, ZOMBIE_CHARGE_VELOCITY);
			}
		};
		this.time.events.loop(ZOMBIE_SPOTTING_DELAY, this.mobs[i].spot, this);
	}
	
	this.postProcessGroup = this.add.group();
	
	// Lighting.
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
			var color = this.stringToColor(mapLights[i].properties.color);
			var colorWooble = parseInt(mapLights[i].properties.color_wooble, 10);
			if(isNaN(colorWooble)) {
				colorWooble = LIGHT_COLOR_RAND;
			}
			var sizeWooble = parseInt(mapLights[i].properties.size_wooble, 10);
			if(isNaN(sizeWooble)) {
				sizeWooble = LIGHT_RAND;
			}
			this.addLight(mapLights[i].x + 16, mapLights[i].y - 16,
						  mapLights[i].properties.size,
						  sizeWooble,
						  color,
						  colorWooble);
		}
		
		this.playerLight = this.addLight(this.player.x + 16,
										 this.player.y - 32,
										 LIGHT_SCALE,
										 LIGHT_RAND,
										 0xd0d0d0,
										 LIGHT_COLOR_RAND);
		if(!this.level.enablePlayerLight) {
			this.playerLight.kill();
		}
		
		this.time.events.loop(LIGHT_DELAY, function() {
			this.lightGroup.forEach(function(light) {
				var scale = light.lightSize * this.rnd.realInRange(
					1. - light.lightSizeWooble,
					1. + light.lightSizeWooble);
				light.scale.set(scale, scale);
				light.tint = this.multColor(
					light.lightColor,
					this.rnd.realInRange(
						1. - light.lightColorWooble,
						1. + light.lightColorWooble));
			}, this);
		}, this);
	}
	
	// Add Message box
	this.postProcessGroup.add(this.messageGroup);
	
	// Noise pass
	this.noiseSprite = this.add.sprite(0, 0, "noise", 0, this.postProcessGroup);
	this.noiseSprite.animations.add("noise", null, 24, true);
	this.noiseSprite.animations.play("noise");
	this.noiseSprite.scale.set(4, 4);
	this.noiseSprite.alpha = .2;
	if(!this.level.enableNoisePass) {
		this.noiseSprite.kill();
	}
	
	/*
	// Noises pass
	this.sounds = game.add.audio("sounds");
	this.sounds.addMarker("grunt", 0, 0.8);
	this.sounds.addMarger("growling", 1, 1.6);
	//... */
};


////////////////////////////////////////////////////////////////////////////
// Update

GameState.prototype.update = function () {
	'use strict';
	
	var pc = this.player;
	this.game.physics.arcade.collide(pc, this.mapLayer);
	
	// React to controls.
	pc.body.velocity.set(0, 0);
	if(!this.blocPlayerWhileMsg) {
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
	}
	pc.frame = pc.looks*4 + pc.facing;

	// bruit de pas
	if(pc.body.velocity.x || pc.body.velocity.y){
		this.sfx.play('footstep',0,1,true);
	} else this.sfx.stop('footstep');
	
	if(this.k_read.justPressed(1)) {
		this.nextMessage();
	}
	
	var punch = false;
	if (this.k_punch.isDown && !pc.hitCooldown)
	{
		punch = true;
		pc.hitCooldown = true;
		this.time.events.add(HIT_COOLDOWN, function () { pc.hitCooldown = false; }, this);
		//console.log("Take that !");
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
		if (zed.looks != STUNNED && zed.body.hitTest(this.player.x, this.player.y))
		{
			pc.body.velocity.set(0, 0);
			if(punch) {
				zed.looks = STUNNED;
				zed.body.velocity.set(0, 0);
				this.time.events.add(ZOMBIE_STUN_DELAY, function () { zed.looks = NORMAL; }, this);
				//console.log("In your face !");
			} else if (!zed.hitCooldown) {
				zed.looks = BERZERK;
				zed.body.velocity.set(0, 0);
				zed.hitCooldown = true;
				this.time.events.add(HIT_COOLDOWN, function () { zed.hitCooldown = false; }, this);
				//console.log("HULK SMASH !");
			}
		}
		else if (zed.looks == BERZERK && !this.lineOfSight(zed, this.player)) {
			// We lost him, boss !
			//console.log("Huh ?");
			zed.looks = NORMAL;
		}
	}
	
	this.level.update();
	
	this.characters.sort('y', Phaser.Group.SORT_ASCENDING);
	
	// Move full-screen sprite with the camera.
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


////////////////////////////////////////////////////////////////////////////
// Render

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
	this.level.render();
};


////////////////////////////////////////////////////////////////////////////
// Other stuff

GameState.prototype.addLight = function(x, y, size, sizeWooble, color, colorWooble) {
	if(typeof sizeWooble === 'undefined') { sizeWooble = LIGHT_RAND; }
	if(typeof color === 'undefined') { color = 0xffffff; }
	if(typeof colorWooble === 'undefined') { colorWooble = LIGHT_COLOR_RAND; }
	
	var light = this.add.sprite(x,
								y,
								'radial_light',
								0,
								this.lightGroup);
	
	light.lightSize = size / 2;
	light.lightSizeWooble = sizeWooble;
	light.lightColor = color;
	light.lightColorWooble = colorWooble;
	
	light.anchor.set(.5, .5);
	var scale = size * this.rnd.realInRange(
		1. - light.lightSizeWooble,
		1. + light.lightSizeWooble);
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

GameState.prototype.multColor = function(color, mult) {
	var a = (color >> 24) & 0xff;
	var r = (color >> 16) & 0xff;
	var g = (color >> 8) & 0xff;
	var b = (color >> 0) & 0xff;
	
	r *= mult;
	g *= mult;
	b *= mult;
	
	r = this.math.clamp(r, 0, 255);
	g = this.math.clamp(g, 0, 255);
	b = this.math.clamp(b, 0, 255);
	
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
		
		this.blocPlayerWhileMsg = false;
		if(this.messageCallback) {
			// reset callback before calling it allow to reset it in the callback.
			var callback = this.messageCallback;
			this.messageCallback = null;
			callback(this.messageCallbackParam);
		}
	}
	else {
		this.messageGroup.callAll('revive');
		this.message.text = this.messageQueue.shift();
	}
};

GameState.prototype.displayMessage = function(key, msg, blocPlayer, callback, param) {
	this.blocPlayerWhileMsg = blocPlayer || false;
	this.messageCallback = callback || null;
	this.messageCallbackParam = param;
	this.messageQueue = this.cache.getJSON(key)[msg].slice();
	this.nextMessage();
	if(!Array.isArray(this.messageQueue)) {
		console.warn("displayMessage: message '"+key+"."+msg+"' does not exist or is not an array.");
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

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// DOODS !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

function Dood(game, x, y, spritesheet, group) {
	'use strict';
	
	if (typeof group === 'undefined') {
		group = game.state.getCurrentState().characters;
	}
	
	Phaser.Sprite.call(this, game, x, y, spritesheet, 0);
	group.add(this);
	this.anchor.set(.5, .6666667);
	
	this.looks = NORMAL;
	this.facing = DOWN;
	this.hitCooldown = false;
	
	this.game.physics.arcade.enable(this);
	this.body.setSize(32, 32, 0, 16);
}

Dood.prototype = Object.create(Phaser.Sprite.prototype);


////////////////////////////////////////////////////////////////////////////
// Player

function Player(game, x, y) {
	'use strict';
	
	Dood.call(this, game, x, y, "player");
}

Player.prototype = Object.create(Dood.prototype);

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// LEVELS !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

function Level(gameState) {
	'use strict';
	
	this.gameState = gameState;
	
	this.enablePlayerLight = true;
	this.enableNoisePass = true;
}

////////////////////////////////////////////////////////////////////////////
// Test level

function TestLevel(gameState) {
	'use strict';
	
	Level.call(this, gameState);
}

TestLevel.prototype = Object.create(Level.prototype);

TestLevel.prototype.preload = function() {
	'use strict';
	
	var gs = this.gameState;
	
	gs.load.tilemap("map", "assets/maps/test.json", null,
	                  Phaser.Tilemap.TILED_JSON);
	gs.load.image("defaultTileset", "assets/tilesets/test.png");
}

TestLevel.prototype.create = function() {
	'use strict';
	
	var gs = this.gameState;
	
	gs.map = gs.game.add.tilemap("map");
	gs.map.addTilesetImage("default", "defaultTileset");
	gs.map.setCollision([
		10, 13, 14,
		18, 21, 22,
		26,
		49, 51
	]);
}

TestLevel.prototype.update = function() {
	'use strict';
	
	var gs = this.gameState;
}

TestLevel.prototype.render = function() {
	'use strict';
	
	var gs = this.gameState;
}

////////////////////////////////////////////////////////////////////////////
// Quack experimantal level

function ExperimentalLevel(gameState) {
	Level.call(this, gameState);
}

ExperimentalLevel.prototype = Object.create(Level.prototype);

ExperimentalLevel.prototype.preload = function() {
	var gs = this.gameState;
	
	gs.load.tilemap("map", "assets/maps/test2.json", null, Phaser.Tilemap.TILED_JSON);
	gs.load.image("terrainTileset", "assets/tilesets/test.png");
	gs.load.image("specialsTileset", "assets/tilesets/basic.png");
}

ExperimentalLevel.prototype.create = function() {
	var gs = this.gameState;
	
	gs.map = gs.game.add.tilemap("map");
	gs.map.addTilesetImage("terrain", "terrainTileset");
	gs.map.addTilesetImage("specials", "specialsTileset");
	gs.map.setCollision([
	// terrain: 8x8 (1-64)
	          4, 5, 6, 7,   
	   10,   12,13,14,15,   
	   18,   20,21,22,23,   
	   26,   28,      31,   
	         36,      39,   
	               46,47,   
	49,   51,               
	// special: 4x4 (65-80)
	65,        
	69,70,71,72
	           
	           
	]);
	
	this.infectedTiles = [[3,3]];
	this.deadTile = 67;
	this.vulnerableTiles = [
	// terrain: 8x8 (1-64)
	 1, 2, 3,               
	 9,   11,               
	17,   19,               
	25,   27,   29,30,      
	33,34,35,   37,38,      
	41,42,43,44,45,         
	   50,   52,53,         
	// special: 4x4 (65-80)
	   66,   68
	           
	           
	           
	];
	
	//TODO: Optimize this callback.
	this.crumble = function () {
		var newlyInfected = [];
		
		for (var i = 0 ; i < this.infectedTiles.length ; i++)
		{
			var xi = this.infectedTiles[i][0], yi = this.infectedTiles[i][1];
			var neighbours = this.getNeighbours(xi,yi);
			for (var j = 0 ; j < 4 ; j++)
				if (this.isVulnerable(gs.map, neighbours[j], newlyInfected))
					newlyInfected.push(neighbours[j]);
			gs.map.putTile(this.deadTile, xi, yi);
		}
		
		this.infectedTiles = newlyInfected;
	};
	gs.time.events.loop(FLOOR_CRUMBLING_DELAY, this.crumble, this);
}

ExperimentalLevel.prototype.getNeighbours = function (x, y) {
	return [[x+1,y],[x,y+1],[x-1,y],[x,y-1]]
};

ExperimentalLevel.prototype.isVulnerable = function (map, coords, infected) {
	for (var i = 0 ; i < infected.length ; i++)
		if (infected[i][0] === coords[0] && infected[i][1] == coords[1])
			return false; // Tile already infected.
	
	for (var i = 0 ; i < this.vulnerableTiles.length ; i++)
		if (map.getTile(coords[0],coords[1]).index === this.vulnerableTiles[i])
			return true; // Tile is sane and vulnerable.
	
	return false;
};

ExperimentalLevel.prototype.update = function() {
	var gs = this.gameState;
	
}

ExperimentalLevel.prototype.render = function() {
	var gs = this.gameState;
	
}

////////////////////////////////////////////////////////////////////////////
// Intro

function IntroLevel(gameState) {
	'use strict';
	
	Level.call(this, gameState);
}

IntroLevel.prototype = Object.create(Level.prototype);

IntroLevel.prototype.preload = function() {
	'use strict';
	
	var gs = this.gameState;

	gs.load.json("intro_map_json", "assets/maps/intro.json");
	gs.load.json("messages", "assets/texts/intro.json");
	
	gs.load.image("intro_tileset", "assets/tilesets/intro.png");
	gs.load.spritesheet("pillar_item", "assets/sprites/pillar.png", 32, 64);
	gs.load.image("carpet_item", "assets/sprites/carpet.png");
	gs.load.image("blood_item", "assets/sprites/blood.png");
	gs.load.image("femur_item", "assets/sprites/femur.png");
	gs.load.image("collar_item", "assets/sprites/collar.png");
	gs.load.audio('intro', [
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.mp3',
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.ogg']);
}

IntroLevel.prototype.create = function() {
	'use strict';
	
	var gs = this.gameState;

	// Defered loading here. But as we have the json, it's instant.
	this.mapJson = gs.cache.getJSON("intro_map_json");
	gs.load.tilemap("intro_map", null, this.mapJson,
				  Phaser.Tilemap.TILED_JSON);
	
	this.triggersLayer = null;
	for(var i=0; i<this.mapJson.layers.length; ++i) {
		var layer = this.mapJson.layers[i];
		if(layer.name === 'triggers') {
			this.triggersLayer = layer;
			break;
		}
	}
	if(!this.triggersLayer) {
		console.warn("Triggers not found !");
	}
	
	this.triggers = {};
	for(var i=0; i<this.triggersLayer.objects.length; ++i) {
		var tri = this.triggersLayer.objects[i];
		tri.rect = new Phaser.Rectangle(
			tri.x, tri.y, tri.width, tri.height);
		this.triggers[tri.name] = tri;
	}

	gs.map = gs.game.add.tilemap("intro_map");
	gs.map.addTilesetImage("intro_tileset", "intro_tileset");
	gs.map.setCollision([ 6, 9, 18, 24, 30 ]);

    	gs.music = game.add.audio('intro');
	gs.music.play();

	this.enablePlayerLight = false;
	this.enableNoisePass = false;
	
	gs.displayMessage("messages", "intro", true);
	
	this.pentacleFound = false;
	this.carpetFound = false;
	this.found = {};
	this.exiting = false;
}

IntroLevel.prototype.update = function() {
	'use strict';
	
	var gs = this.gameState;
	
	if(!this.carpetFound &&
	   gs.physics.arcade.overlap(gs.player, gs.objects.carpet)) {
		gs.displayMessage("messages", "carpet", true, function(obj) {
			gs.objects.carpet.kill();
		}, obj);
		this.carpetFound = true;
	}
		
	if(gs.messageQueue.length === 0 && gs.k_use.justPressed(1)) {
		var x = gs.player.x;
		var y = gs.player.y;

		switch(gs.player.facing) {
			case DOWN:
				y += 32;
				break;
			case UP:
				y -= 32;
				break;
			case RIGHT:
				x += 32;
				break;
			case LEFT:
				x -= 32;
				break;
		};
		
		for(var id in gs.objects) {
			var obj = gs.objects[id];
			var name = obj.objName;
			if(!this.found[name] && obj.body.hitTest(x, y)) {
				switch(name) {
				case "blood":
				case "femur":
				case "collar":
					if(this.found['pillar']) {
						this.found[name] = true;
						gs.displayMessage("messages", name+"2", true, function(obj) {
							obj.kill();
						}, obj);
					}
					else {
						gs.displayMessage("messages", name, true);
					}
					break;
				case "pillar":
					this.found[name] = true;
					gs.displayMessage("messages", 'book', true, function(obj) {
						obj.frame = 1;
					}, obj);
					break;
				}
			}
		}
	}

	var exitRect = this.triggers['exit'].rect;
	var foundAll = this.carpetFound && this.found['pillar'] && this.found['blood']
			&& this.found['femur'] && this.found['collar'];
	var onPentacle = exitRect.contains(gs.player.x, gs.player.y);
	if(!this.pentacleFound && onPentacle) {
		this.pentacleFound = true;
		gs.displayMessage("messages", 'pentacle', true);
	}
	else if(foundAll && !this.exiting && onPentacle) {
		this.exiting = true;
		gs.displayMessage("messages", 'invoc', true, function() {
			gs.lightGroup.callAll('kill');
			gs.addLight(exitRect.centerX, exitRect.centerY, 4, 0.05, 0xb36be3, .5);
			gs.displayMessage("messages", 'invoc2', true, function() {
				gs.game.state.restart(true, false, null, 'expe');
			});
		});
	}
}

IntroLevel.prototype.render = function() {
	'use strict';
	
	var gs = this.gameState;
}


////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// MAIN !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

var game = new Phaser.Game(MAX_WIDTH, MAX_HEIGHT, Phaser.AUTO, 'game', GameState);


////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// FUCK IT !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
