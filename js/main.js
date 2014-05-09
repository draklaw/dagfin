// Constants.
var MAX_WIDTH = 800;
var MAX_HEIGHT = 600;

var TILE_SIZE = 32;

var DOOD_WIDTH = TILE_SIZE;
var DOOD_HEIGHT = TILE_SIZE*1.5;
var DOOD_OFFSET_X = TILE_SIZE/2;
var DOOD_OFFSET_Y = -TILE_SIZE/2;

var DOWN  = 0;
var UP    = 1;
var RIGHT = 2;
var LEFT  = 3;

var PLAYER_VELOCITY = 140;
var PLAYER_MAX_LIFE = 3;
var PLAYER_FULL_LIFE_RECOVERY_TIME = 60; //in seconds 0 for no regen
var SLOW_PLAYER_WHEN_DAMAGED = false;

var HIT_COOLDOWN = 500;

var ZOMBIE_SHAMBLE_VELOCITY = 40;
var ZOMBIE_CHARGE_VELOCITY = 400;
var ZOMBIE_STUNNED_VELOCITY = 0;
var ZOMBIE_SPOTTING_RANGE = TILE_SIZE*5;
var ZOMBIE_SPOTTING_ANGLE = Math.sin(Math.PI / 6); // Don't ask.
var ZOMBIE_SPOTTING_DELAY = 50;
var ZOMBIE_STUN_DELAY = 1000;
var ZOMBIE_IDEA_DELAY = 5000;
var FULL_SOUND_RANGE = ZOMBIE_SPOTTING_RANGE*1;
var FAR_SOUND_RANGE = ZOMBIE_SPOTTING_RANGE*2;

var DAGFIN_WIDTH = 5*TILE_SIZE;
var DAGFIN_DISPLAY_HEIGHT = 4*TILE_SIZE;
var DAGFIN_COLLISION_HEIGHT = 2*TILE_SIZE;
var DAGFIN_SPOTTING_RANGE = 10*TILE_SIZE;
var DAGFIN_BASE_VELOCITY = 50;
var DAGFIN_RITUAL_VELOCITY_BOOST = 15;
var DAGFIN_ZOMBIE_SPAWN_FREQUENCY = 60; // in seconds, 0 for no spawn over time

var NORMAL  = 0;
var STUNNED = 1;
var AGGRO = 2;

var FLOOR_CRUMBLING_DELAY = 500;

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
	this.updateTasks = [];
	var savedGame = loadSavedGameData();

	levelId = levelId || location.href.split('level=')[1] || savedGame.level || 'intro';
	
	this.levelId = levelId;

	var levelConstructor = levelId.substring(0,1).toUpperCase() + levelId.substring(1).toLowerCase() + 'Level';
	if(typeof window[levelConstructor] === 'function')
		this.level = new window[levelConstructor](this);
	else
		console.error("Unknown level '"+levelId+"'.");
};

////////////////////////////////////////////////////////////////////////////
// Preload

GameState.prototype.preload = function () {
	'use strict';
	
	this.load.image("black", "assets/sprites/black.png");
	this.load.image("damage", "assets/sprites/damage.png");
	this.load.spritesheet("noise", "assets/sprites/noise.png", 200, 150);
	
	this.load.image("message_bg", "assets/message_bg.png");
	this.load.bitmapFont("message_font", "assets/fonts/font.png",
						 "assets/fonts/font.fnt");

	this.load.spritesheet("zombie", "assets/sprites/zombie.png", DOOD_WIDTH, DOOD_HEIGHT);
	this.load.spritesheet("player", "assets/sprites/player.png", DOOD_WIDTH, DOOD_HEIGHT);
	
	this.load.image("hdoor", "assets/sprites/hdoor.png");
	this.load.image("vdoor", "assets/sprites/vdoor.png");
	
	this.load.image("radial_light", "assets/sprites/radial_light.png");
	
	this.load.json("sfxInfo", "assets/audio/sfx/sounds.json");
	this.load.audio('sfx', ["assets/audio/sfx/sounds.mp3","assets/audio/sfx/sounds.ogg"]);
	
	this.level.preload();
};


////////////////////////////////////////////////////////////////////////////
// Create

GameState.prototype.create = function () {
	'use strict';
	var gs = this;

	// System stuff...
	this.time.advancedTiming = true;
	
	// Cap at 30fps to try to avoid people going through walls.
	this.time.deltaCap = 0.033333;
	
	this.game.physics.startSystem(Phaser.Physics.ARCADE);
	
	
	// Some settings...
	this.debugMode = true;
	this.enableLighting = true;
	this.enableCollisions = true;

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
	this.k_use = this.game.input.keyboard.addKey(Phaser.Keyboard.ENTER);

	if(this.debugMode) {
		this.k_debug2 = this.game.input.keyboard.addKey(Phaser.Keyboard.NUMPAD_2);
		this.k_debug3 = this.game.input.keyboard.addKey(Phaser.Keyboard.NUMPAD_3);
	}
	//TODO: m et M (sound control)

	game.scale.fullScreenScaleMode = Phaser.ScaleManager.EXACT_FIT; // Stretch to fill
	// game.scale.fullScreenScaleMode = Phaser.ScaleManager.NO_SCALE; // Keep original size
	// game.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL; // Maintain aspect ratio
	this.k_fullscreen = this.game.input.keyboard.addKey(Phaser.Keyboard.F);
	this.k_fullscreen.onDown.add(toggleFullScreen, this);
	
	function toggleFullScreen(){
		this.scale.startFullScreen();
	}

	// Group all the stuff on the ground (always in background)
	this.objectsGroup = this.make.group();
	// Group all the doors.
	this.doorsGroup = this.make.group();	
	// Group all the stuff that should be sorted by depth.
	this.characters = this.make.group();	
	// Group all the stuff that should be sorted above the rest.
	this.ceiling = this.make.group();	

	// Map.
	this.level.create();
		
	// Add groups after level
	this.world.add(this.objectsGroup);
	this.world.add(this.doorsGroup);
	this.world.add(this.characters);
	this.world.add(this.ceiling);

	// Items in the map
	this.objects = {};
	if(this.map.objects.items) {
		for(var i = 0 ; i < this.map.objects.items.length ; i++) {
			var item = this.map.objects.items[i];
			var offset_x = parseInt(item.properties.offset_x, 10) || 0;
			var offset_y = parseInt(item.properties.offset_y, 10) || 0;
			var key = item.properties.key || item.name+"_item";
			var sprite = this.add.sprite(item.x + offset_x + 16,
										 item.y + offset_y - 16,
										 key, 0, this.objectsGroup);
			sprite.anchor.set(.5, .5);
			this.objects[item.name] = sprite;
			sprite.objName = item.name;
			this.game.physics.arcade.enable(sprite);
		}
	}
	
	// Doors in the map
	this.doors = [];
	if(this.map.objects.doors) {
		for(var i = 0 ; i < this.map.objects.doors.length ; i++) {
			var door = this.map.objects.doors[i];
			var offset_x = parseInt(door.properties.offset_x, 10) || 0;
			var offset_y = parseInt(door.properties.offset_y, 10) || 0;
			var key = door.name.toLowerCase(); //FIXME: Should be door.type but it fails.
			if (key === "hdoor") offset_y -= 32; else offset_y -= 16;
			var sprite = this.add.sprite(door.x + offset_x + 16,
			                             door.y + offset_y,
			                             key, 0, this.doorsGroup);
			sprite.anchor.set(.5, .5);
			sprite.objName = door.name;
			this.game.physics.arcade.enable(sprite);
			sprite.body.immovable = true;
			door.sprite = sprite;
		}
	}
	
	// People.
	var rawPlayerData = this.map.objects.doods[0];
	this.player = new Player(this.game, rawPlayerData.x, rawPlayerData.y);

	// Zombies
	this.mobs = [];
	var zombieList = gs.map.objects.doods;
	for (var i = 1 ; i < zombieList.length ; i++)
		gs.mobs.push(new Zombie(gs.game, zombieList[i].x, zombieList[i].y));



	this.postProcessGroup = this.add.group();
	
	// Lighting.
	if(this.enableLighting) {
		var margin = 5;
		this.lightmap = this.make.renderTexture(MAX_WIDTH+margin*2,
												MAX_HEIGHT+margin*2,
												"lightmap");
		this.lightLayer = this.add.sprite(-margin, -margin, this.lightmap, 0, this.postProcessGroup);
		this.lightLayer.blendMode = PIXI.blendModes.MULTIPLY;
		
		// Contains all the stuff renderer to the lightmap.
		this.lightLayerGroup = this.make.group();
		
		this.lightClear = this.add.sprite(0, 0, "black", 0, this.lightLayerGroup);
		this.lightClear.scale.set(this.map.widthInPixels, this.map.heightInPixels);
		
		this.lightGroup = this.add.group(this.lightLayerGroup);
		this.lightGroup.position.set(margin, margin);
		
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
			var light = this.addLight(mapLights[i].x + 16, mapLights[i].y - 16,
									  mapLights[i].properties.size,
									  sizeWooble,
									  color,
									  colorWooble,
									  mapLights[i].properties);
			
			if(typeof light.properties.enabled !== 'undefined' &&
			   light.properties.enabled === 'false') {
				light.kill();
			}
		}
		
		this.playerLight = this.addLight(this.player.x + 16,
										 this.player.y - 32,
										 7,
										 LIGHT_RAND,
										 0xa0c0e0,
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
	
	// Game Over
	this.gameOver = this.add.sprite(0, 0, "black", 0, this.postProcessGroup);
	this.gameOver.scale.set(MAX_WIDTH, MAX_HEIGHT);
	this.gameOver.kill();
	this.gameOverText = this.add.text(40, 280,
						"", { font: "32px Arial", fill: "#c00000", align: "center" }, this.postProcessGroup);
	
	// Noise pass
	this.noiseSprite = this.add.sprite(0, 0, "noise", 0, this.postProcessGroup);
	this.noiseSprite.animations.add("noise", null, 24, true);
	this.noiseSprite.animations.play("noise");
	this.noiseSprite.scale.set(4, 4);
	this.noiseSprite.alpha = .2;
	if(!this.level.enableNoisePass) {
		this.noiseSprite.kill();
	}
	
	// Damage pass
	this.damageSprite = this.add.sprite(0, 0, "damage", 0, this.postProcessGroup);
	this.damageSprite.scale.set(MAX_WIDTH, MAX_HEIGHT);

	/*
	// Noises pass
	this.sounds = game.add.audio("sounds");
	this.sounds.addMarker("grunt", 0, 0.8);
	this.sounds.addMarger("growling", 1, 1.6);
	//... */
};


////////////////////////////////////////////////////////////////////////////
// Update

GameState.prototype.updateInjector = function (injectedFunction) {
	'use strict';
	this.updateTasks.push(injectedFunction);
};

GameState.prototype.update = function () {
	'use strict';
	var gs = this;
	this.updateTasks.forEach(function(injectedFunction){
		injectedFunction(gs);
	});

	// Debug cheats !
	if(this.debugMode) {
		if(this.k_debug3.justPressed(1)) {
			this.enableCollisions = !this.enableCollisions;
			console.log("Collisions:", this.enableCollisions);
		}
		if(this.k_debug2.justPressed(1)) {
			this.enableLighting = !this.enableLighting;
			console.log("Lighting:", this.enableLighting);
		}
	}
	
	// Hack use key !
	this.k_use.triggered = this.k_use.justPressed(1);
	
	var player = this.player;
	
	// React to controls.
	player.body.velocity.set(0, 0);
	if(!this.blocPlayerWhileMsg) {
		if (this.k_down.isDown) {
			player.body.velocity.y = 1;
			player.facing = DOWN;
		}
		if (this.k_up.isDown) {
			player.body.velocity.y = -1;
			player.facing = UP;
		}
		if (this.k_right.isDown) {
			player.body.velocity.x = 1;
			player.facing = RIGHT;
		}
		if (this.k_left.isDown) {
			player.body.velocity.x = -1;
			player.facing = LEFT;
		}
		player.body.velocity.setMagnitude(player.speed());
	}
	player.frame = player.behavior*4 + player.facing;

	// bruit de pas
	if(	player.body.prev.x !== player.body.position.x
	   || player.body.prev.y !== player.body.position.y
	  ){
		player.sfx.play('playerFootStep', 0, 1, false, false);
	}
	
	if(this.k_use.triggered && this.hasMessageDisplayed()) {
		this.k_use.triggered = false;
		this.nextMessage();
	}
	else if(this.question) {
		if (this.k_down.isDown &&
				this.questionChoice+1 < this.question.choices.length) {
			++this.questionChoice;
			this.updateQuestionText();
		}
		if (this.k_up.isDown &&
				this.questionChoice > 0) {
			--this.questionChoice;
			this.updateQuestionText();
		}
	}
	
	var punch = false;
	if (this.k_punch.isDown && !player.hitCooldown && player.canPunch)
	{
		// Player stun zombie
		punch = true;
		player.hitCooldown = true;
		this.time.events.add(HIT_COOLDOWN, function () { player.hitCooldown = false; }, this);
		player.sfx.play('playerHit',0,1,false,true); //FIXME : different sound when you hit zombie and when you are hit by zombie
	}
	
	// Everyday I'm shambling.
	for (var i = 0 ; i < this.mobs.length ; i++)
	{
		var zombie = this.mobs[i];

		// EXTERMINATE ! EXTERMINATE !
		if (zombie.behavior != STUNNED && zombie.body.hitTest(this.player.x, this.player.y))
		{
			player.body.velocity.set(0, 0);
			if(punch) {
				zombie.behavior = STUNNED;
				zombie.body.velocity.set(0, 0);
				this.time.events.add(
					ZOMBIE_STUN_DELAY,
					function () {
						zombie.behavior = NORMAL;
					}, this);
			} else if (!zombie.hitCooldown) {
				zombie.behavior = AGGRO;
				zombie.body.velocity.set(0, 0);
				zombie.hitCooldown = true;
				this.time.events.add(
					HIT_COOLDOWN,
					function () {
						zombie.hitCooldown = false;
					}, this);
				zombie.sfx.play('zombieHit',0,1,false,true); //hit by zombie
				player.damage(1);
			}
		}
		else if (zombie.behavior == AGGRO && !this.lineOfSight(zombie, this.player))
			zombie.behavior = NORMAL;
	}

	this.level.update();

	this.characters.sort('y', Phaser.Group.SORT_ASCENDING);
	
	// Move full-screen sprite with the camera.
	this.camera.update();
	this.postProcessGroup.x = this.camera.x;
	this.postProcessGroup.y = this.camera.y;

	// Update lighting.
	if(this.enableLighting) {
		this.playerLight.x = this.player.x;
		this.playerLight.y = this.player.y - 16;
		
		this.lightmap.renderXY(this.lightLayerGroup,
							   -this.camera.x,
							   -this.camera.y);
		
		this.lightLayer.revive();
	}
	else {
		this.lightLayer.kill();
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

GameState.prototype.addSfx = function(entity){
	'use strict';
	var gs = this;
	var soundSprite = gs.cache.getJSON("sfxInfo").spritemap;
	entity.sfx = gs.add.audio('sfx');
	for (var key in soundSprite){
		entity.sfx.addMarker(
			key,
			soundSprite[key].start,
				soundSprite[key].end - soundSprite[key].start,
			1,
			soundSprite[key].loop
		);
	}
};

GameState.prototype.addLight = function(x, y, size, sizeWooble, color, colorWooble, properties) {
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
	light.properties = properties || {};
	
	light.anchor.set(.5, .5);
	var scale = size * this.rnd.realInRange(
		1. - light.lightSizeWooble,
		1. + light.lightSizeWooble);
	light.scale.set(scale);
	
	light.blendMode = PIXI.blendModes.ADD;
	light.tint = color;
	
	return light;
};

GameState.prototype.toggleLights = function(toggle) {
	for(var i=0; i<this.lightGroup.length; ++i) {
		var light = this.lightGroup.children[i];
		
		if(light.properties.toggle === toggle) {
			if(light.alive) {
				light.kill();
			}
			else {
				light.revive();
			}
		}
	}
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
	if(this.question) {
		var choice = this.question.choices[this.questionChoice];
		this.messageQueue = choice.message;
		this.messageCallback = this.questionCallbacks[this.questionChoice];
		this.messageCallbackParam = this.questionCallbackParam;
		this.question = null;
	}
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

GameState.prototype.updateQuestionText = function() {
	var msg = this.question.question + "\n";
	console.log("Update question:", this.questionChoice);
	for(var i=0; i<this.question.choices.length; ++i) {
		msg += "\n";
		if(i === this.questionChoice)
			msg += "> ";
		else
			msg += "  ";
		msg += this.question.choices[i].ans;
	}
	this.message.text = msg;
};

GameState.prototype.askQuestion = function(key, msg, callbacks, param) {
	this.blocPlayerWhileMsg = true;
	this.questionCallbacks = callbacks || [];
	this.questionCallbackParam = param;
	this.question = this.cache.getJSON(key)[msg];
	this.questionChoice = 0;

	this.messageGroup.callAll('revive');
	this.updateQuestionText();
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

GameState.prototype.hasMessageDisplayed = function() {
	return this.messageBg.alive;
};

// Kind of assumes the stalker is a zombie.
GameState.prototype.lineOfSight = function(stalker, target) {
	var line2Target = new Phaser.Line(stalker.x, stalker.y, target.x, target.y);
	var staring_angle = (line2Target.angle+3*Math.PI/2)-(2*Math.PI-stalker.body.angle);
	// Don't ask, lest the zombie stare at YOU instead.
	return line2Target.length < ZOMBIE_SPOTTING_RANGE
		&& !this.obstructed(line2Target)
		&& Math.cos(staring_angle) > 0
		&& Math.abs(Math.sin(staring_angle)) < ZOMBIE_SPOTTING_ANGLE;
};

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// DOODS !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

function Dood(game, x, y, spritesheet, group) {
	'use strict';
	Phaser.Sprite.call(this, game, x+DOOD_OFFSET_X, y+DOOD_OFFSET_Y, spritesheet, 0);

	game.physics.arcade.enable(this);
	this.body.setSize(TILE_SIZE, TILE_SIZE, 0, TILE_SIZE/2);
	this.anchor.set(.5, .6666667);
	this.revive();

	this.behavior = NORMAL;
	this.facing = DOWN;
	this.hitCooldown = false;

	this.gs = game.state.getCurrentState(); // gs easy acces for Doods childs classes
	var gs = this.gs;
	gs.addSfx(this);

	if (!group) group = gs.characters;
	group.add(this);

	var dood = this;
	this.onUpdateBehavior = function(){
		gs.game.physics.arcade.collide(dood, gs.mapLayer);
		gs.game.physics.arcade.collide(dood, gs.doorsGroup);
	};
	gs.updateInjector(dood.onUpdateBehavior);

	this.aggroPlayer = function (aggroRange, aggroFrontConeAngle, aggroThroughWall) {
		if ( 		( !aggroRange || this.isTargetInRange(gs.player,aggroRange) )
				&& 	( aggroThroughWall || this.isDirectPathObstructed(gs.player) )
				&& 	(!aggroFrontConeAngle || this.isInFrontCone(gs.player,aggroFrontConeAngle) )
			) {
				this.behavior = AGGRO;
				game.physics.arcade.moveToObject(this, gs.player, this.speed());
				this.triggerAggroSoundEffect();
				return true;
		}
		return false;
	};
	this.isTargetInRange = function(target, range) {
		var line2Target = new Phaser.Line(this.x, this.y, target.x, target.y);
		return line2Target.length < range;
	};
	this.isDirectPathObstructed = function(target) {
		var line2Target = new Phaser.Line(this.x, this.y, target.x, target.y);
		return !gs.obstructed(line2Target);
	};
	this.isInFrontCone = function(target, frontConeAngle) {
		var line2Target = new Phaser.Line(this.x, this.y, target.x, target.y);
		var staring_angle = (line2Target.angle+3*Math.PI/2)-(2*Math.PI-this.body.angle);
		return Math.cos(staring_angle) > 0
			&& Math.abs(Math.sin(staring_angle)) < frontConeAngle;
	};
	this.triggerAggroSoundEffect = function(){
		this.sfx.play('aggro',0,1,false,false);
	};
	this.intensityDistanceDependant = function(){
		var distance = gs.game.physics.arcade.distanceBetween(gs.player, dood);
		var intensity = Math.max(0,Math.min(1,
				1 - (
				( distance - FULL_SOUND_RANGE )
				/ 	( FAR_SOUND_RANGE - FULL_SOUND_RANGE )
				)
		));
		return intensity;
	};

	this.speed = function(){
		console.warn('override this method to let your dood move');
		return 0;
	};
}

Dood.prototype = Object.create(Phaser.Sprite.prototype);


////////////////////////////////////////////////////////////////////////////
// Player

function Player(game, x, y) {
	'use strict';
	Dood.call(this, game, x, y, "player");

	var player = this;
	var gs = this.gs;

	gs.camera.follow(player, Phaser.Camera.FOLLOW_TOPDOWN);

	player.health = PLAYER_MAX_LIFE;
	player.canPunch = true;

	var savedGame = loadSavedGameData();
	player.inventory = savedGame.inventory || [];


	this.onUpdateBehavior = function(){
		player.regenerate();

		gs.damageSprite.alpha = 1 - player.abilityRate();
		if(gs.damageSprite.alpha == 0) gs.damageSprite.kill();
		else gs.damageSprite.revive();
	};
	gs.updateInjector(player.onUpdateBehavior);

	player.events.onKilled.add(function(){
		gs.gameOver.revive();
		gs.gameOverText.text = "You disapeard deep beneath the surface...";
		//		console.log("Humanity lost you beneath the surface !");
		gs.time.events.repeat(1500, 1, function() {
			gs.state.restart(true, false, null, gs.levelId);
		}, gs);
		//TODO : death sound, death music
	});
	
	player.lastTime = (new Date()).getTime();
	player.regenerate = function(){
		player.now = (new Date()).getTime();
		if(player.alive && PLAYER_FULL_LIFE_RECOVERY_TIME)
			player.health = Math.min(
				PLAYER_MAX_LIFE, 
				player.health + ( 
					( player.now - player.lastTime ) * PLAYER_MAX_LIFE /
					( 1000 * PLAYER_FULL_LIFE_RECOVERY_TIME )
				)
			);
		player.lastTime = player.now;
	};
	player.abilityRate = function(){
		return Math.sqrt(player.health / PLAYER_MAX_LIFE);
	};
	player.speed = function(){
		if(SLOW_PLAYER_WHEN_DAMAGED) return PLAYER_VELOCITY * player.abilityRate();
		else return PLAYER_VELOCITY;
	};
	player.loot = function(item){
		player.inventory.push(item.objName);
		item.kill();
	};
}

Player.prototype = Object.create(Dood.prototype);


////////////////////////////////////////////////////////////////////////////
// Zombie

function Zombie(game, x, y) {
	'use strict';
	Dood.call(this, game, x, y, "zombie");

	var zombie = this;
	var gs = this.gs;

	this.onUpdateBehavior = function(){
		zombie.stumbleAgainstWall();
		zombie.footNoise();
	};
	gs.updateInjector(zombie.onUpdateBehavior);

	this.stumbleAgainstWall = function(){
		var zblock = zombie.body.blocked;
		if (zblock.up || zblock.down || zblock.left || zblock.right)
			zombie.shamble();
		zombie.frame = zombie.behavior*4 + zombie.facing;
	};
	this.shamble = function () {
		if (zombie.behavior == STUNNED)
			return;
		zombie.facing = gs.rnd.integer()%4;
		switch (zombie.facing) {
			case DOWN:
				zombie.body.velocity.x = 0;
				zombie.body.velocity.y = zombie.speed();
				break;
			case UP:
				zombie.body.velocity.x = 0;
				zombie.body.velocity.y = -zombie.speed();
				break;
			case RIGHT:
				zombie.body.velocity.y = 0;
				zombie.body.velocity.x = zombie.speed();
				break;
			case LEFT:
				zombie.body.velocity.y = 0;
				zombie.body.velocity.x = -zombie.speed();
				break;
		}
	};
	this.footNoise = function(){
		if(zombie.body.velocity.x || zombie.body.velocity.y) {
			zombie.sfx.play(
				'zombieFootStep',0,
				this.intensityDistanceDependant(),
				false,false);
		}
	};
	this.spot = function () {
		if (zombie.behavior == NORMAL){
			zombie.aggroPlayer(ZOMBIE_SPOTTING_RANGE,ZOMBIE_SPOTTING_ANGLE);
		}
	};
	this.speed = function(){
		switch (zombie.behavior){
			case AGGRO: return ZOMBIE_CHARGE_VELOCITY;
			case STUNNED: return ZOMBIE_STUNNED_VELOCITY;
			case NORMAL:
			default:
				return ZOMBIE_SHAMBLE_VELOCITY;
		}
	};

	gs.time.events.loop(ZOMBIE_IDEA_DELAY, zombie.shamble, gs);
	gs.time.events.loop(ZOMBIE_SPOTTING_DELAY, zombie.spot, gs);
}

Zombie.prototype = Object.create(Dood.prototype);





























////////////////////////////////////////////////////////////////////////////
// Dagfin


function Dagfin(game, x, y) {
	'use strict';
	Dood.call(this, game, x, y, "dagfin");

	var dagfin = this;
	var gs = this.gs;
	this.body.setSize(DAGFIN_WIDTH, DAGFIN_COLLISION_HEIGHT, 0, DAGFIN_COLLISION_HEIGHT/2);
	this.animations.add("move", null, 16, true);
	this.animations.play("move");

	this.revive();

	game.physics.arcade.enable(this);

	this.ritualItemPlaced = 0;
	this.lastZombieSpawn = 0;

	this.events.onKilled.add(function(){
		console.log("You Win");
		//TODO : death sound, death music, win screen
	});
	dagfin.lastTime = (new Date()).getTime();
	this.onUpdateBehavior = function(){
		if(!dagfin.activate) return;

		dagfin.now = (new Date()).getTime();

		dagfin.aggroPlayer(DAGFIN_SPOTTING_RANGE);

		// when aggro, spawn zombie over time
		if(dagfin.behavior == AGGRO && dagfin.lastZombieSpawn + DAGFIN_ZOMBIE_SPAWN_FREQUENCY*1000 < dagfin.now){
			dagfin.spawnZombie();
			dagfin.lastZombieSpawn = dagfin.now;
		}

		dagfin.lastTime = dagfin.now;

		// kill player if contact
		if(dagfin.body.hitTest(gs.player.x, gs.player.y)){
			gs.player.kill();
		}
	};
	gs.updateInjector(dagfin.onUpdateBehavior);

	this.ritualStepBehavior = function(){
		dagfin.ritualItemPlaced++; // will increase Speed
		dagfin.spawnZombie();
	};
	this.spawnZombie = function(){
		gs.mobs.push(new Zombie(gs.game, dagfin.x, dagfin.y));
	};
	this.speed = function(){
		return DAGFIN_BASE_VELOCITY + this.ritualItemPlaced*DAGFIN_RITUAL_VELOCITY_BOOST;
	};
}

Dagfin.prototype = Object.create(Dood.prototype);

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

Level.prototype.parseLevel = function(mapJson) {
	'use strict';
	
	var gs = this.gameState;
		
	this.triggersLayer = null;
	this.mapLayers = {};
	for(var i=0; i<mapJson.layers.length; ++i) {
		var layer = mapJson.layers[i];
		if(layer.name === 'triggers') {
			this.triggersLayer = layer;
		}
		this.mapLayers[layer.name] = layer;
	}
	if(!this.triggersLayer) {
		console.warn("Triggers not found !");
	}
	
	this.triggers = {};
	for(var i=0; i<this.triggersLayer.objects.length; ++i) {
		var tri = this.triggersLayer.objects[i];
		tri.rect = new Phaser.Rectangle(
			tri.x, tri.y, tri.width, tri.height);
		tri.onEnter = null;
		tri.onLeave = null;
		tri.isInside = false;
		this.triggers[tri.name] = tri;
	}
};

Level.prototype.processTriggers = function(mapJson) {
	'use strict';
	
	var gs = this.gameState;
	
	for(var id in this.triggers) {
		var tri = this.triggers[id];
		var inside = tri.rect.contains(gs.player.x, gs.player.y);

		if(inside && !tri.isInside) {
			console.log("Enter:", id);
			if(tri.onEnter) {
				tri.onEnter();
			}
			tri.isInside = true;
		}
		if(!inside && tri.isInside) {
			console.log("Leave:", id);
			if(tri.onLeave) {
				tri.onLeave();
			}
			tri.isInside = false;
		}
	}
};


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

};

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

	gs.mapLayer = gs.map.createLayer("map");
	gs.mapLayer.resizeWorld();
//	gs.mapLayer.debug = true;

};

TestLevel.prototype.update = function() {
	'use strict';
	
	var gs = this.gameState;
};

TestLevel.prototype.render = function() {
	'use strict';
	
	var gs = this.gameState;
};

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
};

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
	
	for (var x = 0 ; x < gs.map.width ; x++)
		for (var y = 0 ; y < gs.map.height ; y++)
			for (var i = 0 ; i < this.vulnerableTiles.length ; i++)
				if (gs.map.getTile(x,y).index == this.vulnerableTiles[i]) {
					gs.map.getTile(x,y).vulnerable = true;
					break;
				}
	
	gs.mapLayer = gs.map.createLayer("map");
	gs.mapLayer.resizeWorld();
	
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
			gs.map.getTile(xi,yi).vulnerable = false; // Can't be too sure.
		}
		
		this.infectedTiles = newlyInfected;
	};
	gs.time.events.loop(FLOOR_CRUMBLING_DELAY, this.crumble, this);
};

ExperimentalLevel.prototype.getNeighbours = function (x, y) {
	return [[x+1,y],[x,y+1],[x-1,y],[x,y-1]]
};

ExperimentalLevel.prototype.isVulnerable = function (map, coords, infected) {
	for (var i = 0 ; i < infected.length ; i++)
		if (infected[i][0] === coords[0] && infected[i][1] == coords[1])
			return false; // Tile already infected.
	
	if (map.getTile(coords[0],coords[1]).vulnerable === true)
		return true; // Tile is sane and vulnerable.
	
	return false;
};

ExperimentalLevel.prototype.update = function() {
	var gs = this.gameState;
	
};

ExperimentalLevel.prototype.render = function() {
	var gs = this.gameState;
	
};

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
	gs.load.json("messages", "assets/texts/"+lang+"/intro.json");
	
	gs.load.image("intro_tileset", "assets/tilesets/intro.png");
	gs.load.spritesheet("pillar_item", "assets/sprites/pillar.png", 32, 64);
	gs.load.image("carpet_item", "assets/sprites/carpet.png");
	gs.load.image("blood_item", "assets/sprites/blood.png");
	gs.load.image("femur_item", "assets/sprites/femur.png");
	gs.load.image("collar_item", "assets/sprites/collar.png");
	gs.load.audio('music', [
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.mp3',
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.ogg']);
};

IntroLevel.prototype.create = function() {
	'use strict';
	
	var gs = this.gameState;

	// Defered loading here. But as we have the json, it's instant.
	this.mapJson = gs.cache.getJSON("intro_map_json");
	gs.load.tilemap("intro_map", null, this.mapJson,
				  Phaser.Tilemap.TILED_JSON);
	
	this.parseLevel(this.mapJson);

	gs.map = gs.game.add.tilemap("intro_map");
	gs.map.addTilesetImage("intro_tileset", "intro_tileset");
	gs.map.setCollision([ 6, 9, 18, 24, 30 ]);

	gs.mapLayer = gs.map.createLayer("map");
	gs.mapLayer.resizeWorld();
//	gs.mapLayer.debug = true;

	gs.music = game.add.audio('music');
	gs.music.play('', 0, 0.2);

	this.enablePlayerLight = false;
	this.enableNoisePass = false;
	
	gs.displayMessage("messages", "intro", true);
	
	this.pentacleFound = false;
	this.carpetFound = false;
	this.found = {};
	this.exiting = false;
};

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
		
	if(gs.messageQueue.length === 0 && gs.k_use.triggered) {
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
		}
		
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
							gs.player.loot(obj);
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
				goToLevel('chap1');
			});
		});
	}
};

IntroLevel.prototype.render = function() {
	'use strict';
	
	var gs = this.gameState;
};


////////////////////////////////////////////////////////////////////////////
// Chapter I

function Chap1Level(gameState) {
	'use strict';
	
	Level.call(this, gameState);
}

Chap1Level.prototype = Object.create(Level.prototype);

Chap1Level.prototype.preload = function() {
	'use strict';
	
	var gs = this.gameState;

	gs.load.json("chap1_map_json", "assets/maps/chap1.json");
	gs.load.json("messages", "assets/texts/"+lang+"/chap1.json");
	
	gs.load.image("chap1_tileset", "assets/tilesets/basic.png");
	gs.load.image("spawn", "assets/tilesets/spawn.png");
	gs.load.image("spawn2", "assets/tilesets/spawn2.png");

	gs.load.image("note", "assets/sprites/note.png");
	gs.load.image("clock", "assets/sprites/clock.png");

	gs.load.audio('music', [
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.mp3',
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.ogg']);
};

Chap1Level.prototype.create = function() {
	'use strict';
	
	var gs = this.gameState;

	// Deferred loading here. But since we have the json, it's instant.
	this.mapJson = gs.cache.getJSON("chap1_map_json");
	gs.load.tilemap("chap1_map", null, this.mapJson,
				  Phaser.Tilemap.TILED_JSON);
	
	this.parseLevel(this.mapJson);

	gs.map = gs.game.add.tilemap("chap1_map");
	gs.map.addTilesetImage("basic", "chap1_tileset");
	gs.map.addTilesetImage("spawn", "spawn");
	gs.map.addTilesetImage("spawn2", "spawn2");
	gs.map.setCollision([ 1, 8 ]);

	gs.mapLayer = gs.map.createLayer("map");
	gs.mapLayer.resizeWorld();
	// gs.mapLayer.debug = true;
	
	gs.overlayLayer = gs.map.createLayer("overlay");
	gs.bridgeLayer = gs.map.createLayer("lava_bridge");
	gs.secretLayer = gs.map.createLayer("secret_passage",
										undefined, undefined,
									   	gs.ceiling);
	
	this.LAVA_TILE = 7;
	
	
   	gs.music = game.add.audio('music');
	gs.music.play('', 0, 0.2);

	this.enablePlayerLight = false;
	this.enableNoisePass = true;
	
	gs.displayMessage("messages", "intro", true);
	
	var level = this;

	this.triggers.indice1.onEnter = function() {
		level.triggers.indice1.onEnter = null;
		gs.displayMessage("messages", "indice1", true, function() {
			gs.objects.indice1.kill();
		});
	};
	
	this.triggers.indice2.onEnter = function() {
		level.triggers.indice2.onEnter = null;
		gs.displayMessage("messages", "indice2", true, function() {
			gs.objects.indice2.kill();
		});
	};
	
	this.triggers.indice3.onEnter = function() {
		level.triggers.indice3.onEnter = null;
		gs.displayMessage("messages", "indice3", true, function() {
			gs.objects.indice3.kill();
		});
	};
	
	this.triggers.mazeToggle.onEnter = function() {
		gs.toggleLights('maze');
	};
	
	this.infectedTiles = [];
	this.crumble = function () {
		var newlyInfected = [];
		
		for (var i = 0 ; i < this.infectedTiles.length ; i++)
		{
			var coord = this.infectedTiles[i];
			var x = coord[0];
			var y = coord[1];
			gs.map.removeTile(x, y, gs.bridgeLayer);

			var neighbours = [
				[ x - 1, y ],
				[ x + 1, y ],
				[ x, y - 1 ],
				[ x, y + 1 ]
			];
			for (var j = 0 ; j < 4 ; j++) {
				var nb = neighbours[j];
				var tile = gs.map.getTile(nb[0], nb[1], gs.bridgeLayer);
				if(tile !== null && !tile.isMarked) {
					newlyInfected.push(nb);
					tile.isMarked = true;
				}
			}
		}
		
		this.infectedTiles = newlyInfected;
		if(this.infectedTiles.length === 0) {
			gs.time.events.remove(this.crumbleTimer);
		}
		
	};
	
	this.triggers.lava_fail.onEnter = function() {
		level.triggers.lava_fail.onEnter = null;
		level.infectedTiles = [ [ 6, 22 ] ];
		level.crumbleTimer = gs.time.events.loop(
			200, level.crumble, level);
	};
	
	this.triggers.secret_tip.onEnter = function() {
		level.triggers.secret_tip.onEnter = null;
		gs.displayMessage("messages", "secret", true);
	};

	this.triggers.reveal_secret.onEnter = function() {
		level.triggers.reveal_secret.onEnter = null;
		gs.ceiling.remove(gs.secretLayer);
	};
	
	this.triggers.clock.onEnter = function() {
		gs.askQuestion("messages", "clock", [
			function() {
				gs.player.loot(gs.objects.clock);
				level.triggers.clock.onEnter = null;
			},
			function() {
			}
		]);
	};
	
	this.triggers.exit.onEnter = function() {
		goToLevel('chap2');
	}
};

Chap1Level.prototype.update = function() {
	'use strict';
	
	var gs = this.gameState;
	
	this.processTriggers();
	
	var mapTile = gs.map.getTileWorldXY(gs.player.x, gs.player.y,
										undefined, undefined, gs.mapLayer);
	if(mapTile.index == this.LAVA_TILE) {
		var bridgeTile = gs.map.getTileWorldXY(gs.player.x, gs.player.y,
											   undefined, undefined, gs.bridgeLayer);
		if(bridgeTile === null) {
			gs.player.damage(1);
			
		}
	}
};

Chap1Level.prototype.render = function() {
	'use strict';
	
	var gs = this.gameState;
	
	
};

////////////////////////////////////////////////////////////////////////////
// Chapter II

function Chap2Level(gameState) {
	'use strict';
	
	Level.call(this, gameState);
}

Chap2Level.prototype = Object.create(Level.prototype);

Chap2Level.prototype.preload = function() {
	'use strict';
	
	var gs = this.gameState;
	
	gs.load.json("chap2_map_json", "assets/maps/chap2.json");
	gs.load.json("messages", "assets/texts/"+lang+"/chap2.json");
	
	gs.load.image("chap2_tileset", "assets/tilesets/basic.png");
	gs.load.image("spawn", "assets/tilesets/spawn.png");
	gs.load.image("spawn2", "assets/tilesets/spawn2.png");
	
	gs.load.image("note", "assets/sprites/note.png");
	gs.load.image("hourglass", "assets/sprites/sablier.png");
	gs.load.image("plante64", "assets/sprites/plante64.png");
	
	gs.load.audio('music', [
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.mp3',
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.ogg']);
};

Chap2Level.prototype.create = function() {
	'use strict';
	
	var gs = this.gameState;
	
	// Deferred loading here. But since we have the json, it's instant.
	this.mapJson = gs.cache.getJSON("chap2_map_json");
	gs.load.tilemap("chap2_map", null, this.mapJson,
	                Phaser.Tilemap.TILED_JSON);
	
	this.parseLevel(this.mapJson);
	
	gs.map = gs.game.add.tilemap("chap2_map");
	gs.map.addTilesetImage("terrain", "chap2_tileset");
	gs.map.setCollision([ 1, 8 ]);
	
	gs.mapLayer = gs.map.createLayer("map");
	gs.mapLayer.resizeWorld();
	// gs.mapLayer.debug = true;
	
	gs.music = game.add.audio('music');
    gs.music.play('', 0, 0.2);
	
	this.enablePlayerLight = false;
	this.enableNoisePass = true;
	
	gs.displayMessage("messages", "intro", true);
	
	var level = this;
	
	//FIXME: Ugly hack. Disables punching when there will be a player.
	gs.time.events.add(0, function () {gs.player.canPunch = false;}, this);
	
	this.triggers.dialog1.onEnter = function() {
		level.triggers.dialog1.onEnter = null;
		gs.displayMessage("messages", "dialog1", true);
	};
	
	this.triggers.dialog2.onEnter = function() {
		level.triggers.dialog2.onEnter = null;
		gs.displayMessage("messages", "dialog2", true);
	};
	
	//FIXME: Some part of the dialogs can be factorized in the JSON file.
	// It's also possible to make it so the door noise triggers just before
	// the last dialog when picking up the hourglass, but I'm late as a rabbit.
	
	this.noteLast = function() {
		level.triggers.hourglassNote.onEnter = null;
		gs.displayMessage("messages", "hourglassNoteLast", true, function() {
			gs.objects.hourglassNote.kill();
		});
	};
	
	this.hourglassLast = function() {
		level.triggers.hourglass.onEnter = null;
		for (var i = 0 ; i < gs.map.objects.doors.length ; i++)
			if (gs.map.objects.doors[i].properties.trigger === "two")
				gs.map.objects.doors[i].sprite.kill();
		gs.player.canPunch = true;
		gs.displayMessage("messages", "hourglassLast", true, function() {
			gs.objects.hourglass.kill();
		});
	};
	
	this.noteFirst = function() {
		level.triggers.hourglassNote.onEnter = null;
		level.triggers.hourglass.onEnter = level.hourglassLast;
		gs.displayMessage("messages", "hourglassNoteFirst", true, function() {
			gs.objects.hourglassNote.kill();
		});
	};
	
	this.hourglassFirst = function() {
		level.triggers.hourglass.onEnter = null;
		level.triggers.hourglassNote.onEnter = level.noteLast;
		for (var i = 0 ; i < gs.map.objects.doors.length ; i++)
			if (gs.map.objects.doors[i].properties.trigger === "two")
				gs.map.objects.doors[i].sprite.kill();
		gs.player.canPunch = true;
		gs.displayMessage("messages", "hourglassFirst", true, function() {
			gs.objects.hourglass.kill();
		});
	};
	
	this.triggers.hourglassNote.onEnter = this.noteFirst;
	this.triggers.hourglass.onEnter = this.hourglassFirst;
	
	this.triggers.importantNote.onEnter = function() {
		level.triggers.importantNote.onEnter = null;
		gs.displayMessage("messages", "importantNote", true, function() {
			gs.objects.importantNote.kill();
		});
	};
	
	this.triggers.scaredNote.onEnter = function() {
		level.triggers.scaredNote.onEnter = null;
		gs.displayMessage("messages", "scaredNote", true, function() {
			gs.objects.scaredNote.kill();
		});
	};
	
	this.triggers.doorSwitch.onEnter = function() {
		level.triggers.doorSwitch.onEnter = null;
		for (var i = 0 ; i < gs.map.objects.doors.length ; i++)
			if (gs.map.objects.doors[i].properties.trigger === "one")
				gs.map.objects.doors[i].sprite.kill();
		gs.displayMessage("messages", "doorSwitch", true);
	};
	
	this.triggers.carnivorousPlant.onEnter = function() {
		gs.askQuestion("messages", "carnivorousPlant", [
			function () {
				gs.player.loot(gs.objects.carnivorousPlant);
				level.triggers.carnivorousPlant.onEnter = null;
			},
			null
		]);
	};
	
	this.triggers.exit.onEnter = function() {
		goToLevel('chap3');
	}
};
Chap2Level.prototype.update = function() {
	'use strict';
	
	var gs = this.gameState;
	
	this.processTriggers();
};

Chap2Level.prototype.render = function() {
	'use strict';
	
	var gs = this.gameState;
};

////////////////////////////////////////////////////////////////////////////
// Chapter III

function Chap3Level(gameState) {
	'use strict';
	
	Level.call(this, gameState);
}

Chap3Level.prototype = Object.create(Level.prototype);

Chap3Level.prototype.preload = function() {
	'use strict';
	
	var gs = this.gameState;

	gs.load.json("chap3_map_json", "assets/maps/chap3.json");
	gs.load.json("messages", "assets/texts/"+lang+"/chap3.json");
	
	gs.load.image("chap3_tileset", "assets/tilesets/basic.png");
	gs.load.image("spawn", "assets/tilesets/spawn.png");
	gs.load.image("spawn2", "assets/tilesets/spawn2.png");

	gs.load.image("note", "assets/sprites/note.png");
	gs.load.image("flame", "assets/sprites/flame.png");
	gs.load.image("chair", "assets/sprites/chair.png");

	gs.load.audio('music', [
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.mp3',
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.ogg']);
};

Chap3Level.prototype.create = function() {
	'use strict';
	
	var gs = this.gameState;

	// Deferred loading here. But since we have the json, it's instant.
	this.mapJson = gs.cache.getJSON("chap3_map_json");
	gs.load.tilemap("chap3_map", null, this.mapJson,
				  Phaser.Tilemap.TILED_JSON);
	
	this.parseLevel(this.mapJson);

	gs.map = gs.game.add.tilemap("chap3_map");
	gs.map.addTilesetImage("basic", "chap3_tileset");
	gs.map.addTilesetImage("spawn", "spawn");
	gs.map.addTilesetImage("spawn2", "spawn2");
	gs.map.setCollision([ 1, 8, 10 ]);

	gs.mapLayer = gs.map.createLayer("map");
	gs.mapLayer.resizeWorld();
	// gs.mapLayer.debug = true;

	gs.overlayLayer = gs.map.createLayer("overlay");

	for(var i=0; i<this.mapLayers.crystals.objects.length; ++i) {
		var crystal = this.mapLayers.crystals.objects[i];
		crystal.rect = new Phaser.Rectangle(crystal.x, crystal.y, crystal.width, crystal.height);
	}
	this.crystals = this.mapLayers.crystals.objects;

	gs.music = game.add.audio('music');
    gs.music.play('', 0, 0.2);


    this.enablePlayerLight = false;
	this.enableNoisePass = true;

	gs.displayMessage("messages", "intro", true);
	
	var that = this;

	this.triggers.flame.onEnter = function() {
		that.triggers.flame.onEnter = null;
		gs.displayMessage("messages", "flame", true, function() {
			gs.objects.flame.kill();
			gs.playerLight.revive();
			gs.playerLight.powerFailure = 0;
			gs.playerLight.lastLightSize = 1;
			gs.toggleLights('flame');
		});
	};

	this.triggers.indice1.onEnter = function() {
		that.triggers.indice1.onEnter = null;
		gs.displayMessage("messages", "indice1", true, function() {
			gs.objects.indice1.kill();
		});
	};
	
	this.triggers.indice2.onEnter = function() {
		that.triggers.indice2.onEnter = null;
		gs.displayMessage("messages", "indice2", true, function() {
			gs.objects.indice2.kill();
		});
	};
	
	this.triggers.indice3.onEnter = function() {
		that.triggers.indice3.onEnter = null;
		gs.displayMessage("messages", "indice3", true, function() {
			gs.objects.indice3.kill();
		});
	};
	
	this.triggers.chair.onEnter = function() {
		gs.askQuestion("messages", "chair", [
			function() {
				gs.player.loot(gs.objects.chair);
				that.triggers.chair.onEnter = null;
			},
			null
		]);
	};

	this.triggers.exit.onEnter = function() {
		goToLevel('boss');
	}

};

Chap3Level.prototype.update = function() {
	'use strict';
	
	var gs = this.gameState;
	
	this.processTriggers();
	
	if(gs.playerLight.alive) {
		gs.playerLight.lightSize -= (1-gs.playerLight.powerFailure) * gs.time.elapsed / 12000;
		if(gs.playerLight.lightSize<=0) gs.playerLight.lightSize=0;
		else if(gs.playerLight.lightSize<0.5) gs.playerLight.lightSize=0.5;
		var theoricalLight = Math.max(gs.playerLight.lightSize, gs.playerLight.lastLightSize);
		if(theoricalLight < 2 && !gs.playerLight.powerFailure) gs.playerLight.powerFailure = 0.2;
		if(theoricalLight < 1.5 && gs.playerLight.powerFailure<0.2) gs.playerLight.powerFailure = 0.4;
		if(theoricalLight < 1.2 && gs.playerLight.powerFailure<0.4) gs.playerLight.powerFailure = 0.6;
		if(theoricalLight < 1 && gs.playerLight.powerFailure<0.6) gs.playerLight.powerFailure = 0.8;
		if(theoricalLight < 0.8 && gs.playerLight.powerFailure<0.8) gs.playerLight.powerFailure = 0.9;
		if(theoricalLight <= 0.5 && gs.playerLight.powerFailure<0.9) gs.playerLight.powerFailure = 0.95;
		if(gs.playerLight.powerFailure){
			if(Math.random() > gs.playerLight.powerFailure) {
				gs.playerLight.lightSize = gs.playerLight.lightSize || gs.playerLight.lastLightSize;
			}else{
				gs.playerLight.lastLightSize = gs.playerLight.lightSize || gs.playerLight.lastLightSize;
				gs.playerLight.lightSize = 0;
			}
		}
	}
	
	if(gs.messageQueue.length === 0 && gs.k_use.triggered) {
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
		}
		
		for(var i=0; i<this.crystals.length; ++i) {
			if(this.crystals[i].rect.contains(x, y)) {
				gs.playerLight.lightSize = 3;
				gs.playerLight.powerFailure = 0;
				break;
			}
		}
	}
};

Chap3Level.prototype.render = function() {
	'use strict';
	
	var gs = this.gameState;
	
	
};


////////////////////////////////////////////////////////////////////////////
// Boss

function BossLevel(gameState) {
	'use strict';
	
	Level.call(this, gameState);
}

BossLevel.prototype = Object.create(Level.prototype);

BossLevel.prototype.preload = function() {
	'use strict';
	
	var gs = this.gameState;

	gs.load.json("boss_map_json", "assets/maps/boss.json");
	gs.load.json("messages", "assets/texts/"+lang+"/ccl.json");
	
	gs.load.image("boss_tileset", "assets/tilesets/basic.png");
	gs.load.image("spawn2", "assets/tilesets/spawn2.png");
	gs.load.image("trone", "assets/sprites/trone.png");

	gs.load.spritesheet("dagfin", "assets/sprites/dagfin.png", DAGFIN_WIDTH, DAGFIN_DISPLAY_HEIGHT);
	gs.load.spritesheet("matt", "assets/sprites/matt.png", 32, 48);

	gs.load.audio('music', [
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.mp3',
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.ogg']);
};

BossLevel.prototype.create = function() {
	'use strict';
	
	var gs = this.gameState;

	// Defered loading here. But as we have the json, it's instant.
	this.mapJson = gs.cache.getJSON("boss_map_json");
	gs.load.tilemap("boss_map", null, this.mapJson,
				  Phaser.Tilemap.TILED_JSON);
	
	this.parseLevel(this.mapJson);

	gs.map = gs.game.add.tilemap("boss_map");
	gs.map.addTilesetImage("basic", "boss_tileset");
	gs.map.addTilesetImage("spawn2", "spawn2");
	gs.map.addTilesetImage("trone", "trone");
	gs.map.setCollision([ 1, 8 ]);
	
	gs.mapLayer = gs.map.createLayer("map");
	gs.mapLayer.resizeWorld();

	gs.overlayLayer = gs.map.createLayer("overlay");
	

   	gs.music = game.add.audio('music');
	gs.music.play('', 0, 0.2);

	this.enablePlayerLight = false;
	this.enableNoisePass = true;
	
	gs.dagfin = new Dagfin(gs.game, TILE_SIZE*32, TILE_SIZE*9.9);
	
	this.matt = gs.add.sprite(26*32, 9*32, "matt", 0);
	
//	gs.displayMessage("messages", "intro", true);
	
	this.triggers.boss.onEnter = function() {
		if(!gs.dagfin.activate) gs.displayMessage("messages", "aaarg", true, function() {
			gs.dagfin.activate = true;
			//gs.player.kill();
		});
	};
	
};

BossLevel.prototype.update = function() {
	'use strict';
	//var gs = this.gameState;
	this.processTriggers();
};

BossLevel.prototype.render = function() {
	'use strict';
	//var gs = this.gameState;
};


// TODO : find a better place for this function. Game method ? gs method ?
function goToLevel(levelName){
	var gs = game.state.getCurrentState();
	var save = {'level':levelName, 'inventory':gs.player.inventory};
	localStorage.setItem('save',JSON.stringify(save));
	gs.game.state.restart(true, false, null, save.level);

}
function loadSavedGameData(){
	var stringData = localStorage.getItem('save');
	if (stringData) return JSON.parse(stringData);
	else return {'level':'','inventory':[]};
}
function newGame(){
	localStorage.clear();
	goToLevel('intro');
}

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// MAIN !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

var game = new Phaser.Game(MAX_WIDTH, MAX_HEIGHT, Phaser.AUTO, 'game', GameState);
