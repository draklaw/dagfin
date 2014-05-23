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
var DOWN_FLAG  = 1;
var UP_FLAG    = 2;
var RIGHT_FLAG = 4;
var LEFT_FLAG  = 8;

var USE_DIST = 24;

var PLAYER_VELOCITY = 140;
var PLAYER_MAX_LIFE = 3;
var PLAYER_FULL_LIFE_RECOVERY_TIME = 60; //in seconds 0 for no regen
var SLOW_PLAYER_WHEN_DAMAGED = false;

var HIT_COOLDOWN = 500;

var ZOMBIE_SHAMBLE_VELOCITY = 40;
var ZOMBIE_CHARGE_VELOCITY = 400;
var ZOMBIE_STUNNED_VELOCITY = 0;
var ZOMBIE_SPOTTING_RANGE = TILE_SIZE*5;
var ZOMBIE_SPOTTING_ANGLE = 60 * Math.PI/180; // Don't ask.
var ZOMBIE_SPOTTING_DELAY = 50;
var ZOMBIE_STUN_DELAY = 1000;
var ZOMBIE_IDEA_DELAY = 4000;
var ZOMBIE_IDEA_DELAY_RAND = 2000;
var ZOMBIE_THINKING_PROBA = .1;
var FULL_SOUND_RANGE = ZOMBIE_SPOTTING_RANGE*1;
var FAR_SOUND_RANGE = ZOMBIE_SPOTTING_RANGE*2;

var DAGFIN_WIDTH = 5*TILE_SIZE;
var DAGFIN_DISPLAY_HEIGHT = 4*TILE_SIZE;
var DAGFIN_COLLISION_HEIGHT = 2*TILE_SIZE;
var DAGFIN_SPOTTING_RANGE = 10*TILE_SIZE;
var DAGFIN_BASE_VELOCITY = 50;
var DAGFIN_RITUAL_VELOCITY_BOOST = 15;
var DAGFIN_ZOMBIE_SPAWN_DELAY = 20; // in seconds, 0 for no spawn over time

var NORMAL  = 0;
var STUNNED = 1;
var AGGRO = 2;

var FLOOR_CRUMBLING_DELAY = 500;

var LIGHT_DELAY = 80;
var LIGHT_RAND = .01;
var LIGHT_COLOR_RAND = .2;

function soundFalloff(distance) {
	var intensity = Math.max(0,Math.min(1,
			1 - (
			( distance - FULL_SOUND_RANGE )
			/ 	( FAR_SOUND_RANGE - FULL_SOUND_RANGE )
			)
	));
	return intensity;
};


////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// GAME CLASS !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

function DagfinGame(width, height, renderer, parent) {
	'use strict';

	this.game = new Phaser.Game(width, height, renderer, parent);

	this.game.state.add('Boot', new BootState(this));
	this.game.state.add('Loading', new LoadingState(this));
	this.game.state.add('Menu', new MenuState(this));
	this.game.state.add('Game', new GameState(this));
	this.game.state.add('Credits', new CreditsState(this));

	this.lastSave = null;
	this.levelName = 'Intro';
	this.inventory = [];

	this.game.state.start('Boot');
	
	this.loadToCache = {
		'image': '_images',
		'spritesheet': '_images',
		'bitmapFont': '_bitmapFont',
		'json': '_json',
		'audio': '_sounds', // just don't ask...
		'tilemap': '_tilemap'
	};
};

DagfinGame.prototype.saveGameData = function() {
	'use strict';

	this.lastSave = {
		'levelName': this.levelName,
		'inventory': this.inventory.slice()
	};
	localStorage.setItem('save', JSON.stringify(this.lastSave));
};

DagfinGame.prototype.loadGameData = function() {
	'use strict';

	var stringData = localStorage.getItem('save');
	if (stringData) {
		return JSON.parse(stringData);
	}
	return null;
};

DagfinGame.prototype.newGame = function() {
	'use strict';

	this.levelName = 'Intro';
	this.inventory = [];
	this.saveGameData();

	this.reloadLastSave();
};

DagfinGame.prototype.continueFromSave = function() {
	'use strict';

	var save = this.loadGameData();
	if(save) {
		this.lastSave = save;
		this.reloadLastSave();
	}
	else {
		this.newGame();
	}
};

DagfinGame.prototype.reloadLastSave = function() {
	'use strict';

	this.levelName = this.lastSave.levelName;
	this.inventory = this.lastSave.inventory.slice();
	this.game.state.start('Game', true, false, this.levelName);
};

DagfinGame.prototype.goToLevel = function(levelName) {
	'use strict';

	this.levelName = levelName;
	
	this.saveGameData();
	this.reloadLastSave();
};

DagfinGame.prototype.initState = function(levelName) {
	'use strict';

	// Keys are reset when state changes, so each stat should call this
	// in preload in order to get global initialization.

	this.game.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;

	this.k_fullscreen = this.game.input.keyboard.addKey(Phaser.Keyboard.F);
	this.k_fullscreen.onDown.add(this.toggleFullScreen, this);

};

DagfinGame.prototype.toggleFullScreen = function() {
	'use strict';

	if(this.game.scale.isFullScreen) {
		// FIXME: This call seems broken. Update Phaser and try again.
		//this.game.scale.stopFullScreen();
	}
	else {
		this.game.scale.startFullScreen(false);
	}
};

DagfinGame.prototype.hasObject = function(obj) {
	'use strict';

	for(var i=0; i<this.inventory.length; ++i) {
		if(this.inventory[i] === obj) {
			return true;
		}
	}
	return false;
};

/**
* Check if something is in the cache. As Phaser does not seems to
* have an interface for this, we directly check the private members.
* May break on Phaser updates.
*/
DagfinGame.prototype.isLoaded = function(loadMethod, key) {
	'use strict';

	var cacheField = this.loadToCache[loadMethod]
	return this.game.cache[cacheField][key]? true: false; // Seriously ?!?
}

/**
* 'Intelligent' loading function. Load stuff using Phaser, but only if
* the key is not already in the cache. This mean that there can NOT be
* two ressources with the same key, even if they are in different levels.
*/
DagfinGame.prototype.load = function(loadMethod, key) {
	'use strict';

	if(this.isLoaded(loadMethod, key)) {
		return;
	}

	this.game.load[loadMethod].apply(this.game.load,
			Array.prototype.slice.call(arguments, 1));
}

DagfinGame.prototype.playMusic = function(loadMethod, key) {
	'use strict';

	if(!this.music) this.music = this.game.add.audio('music');
	this.music.play('', 0, 0.2);
}

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// BOOT STATE !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

function BootState(dagfin) {
	'use strict';

	Phaser.State.call(this);

	this.dagfin = dagfin;
}

BootState.prototype = Object.create(Phaser.State.prototype);

BootState.prototype.preload = function() {
	'use strict';

	this.dagfin.initState();

	this.dagfin.load('image', 'splash', 'assets/couverture.png');
	this.dagfin.load('image', 'progressBarBg', 'assets/progress_bar_bg.png');
	this.dagfin.load('image', 'progressBar', 'assets/progress_bar.png');
};

BootState.prototype.create = function() {
	'use strict';

	this.state.start('Loading');
};

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// LOADING STATE !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

function LoadingState(dagfin) {
	'use strict';

	Phaser.State.call(this);

	this.dagfin = dagfin;
}

LoadingState.prototype = Object.create(Phaser.State.prototype);

LoadingState.prototype.preload = function() {
	'use strict';

	this.dagfin.initState();
	document.getElementById('game').firstChild.style.opacity = 1;

	// Loaded by the 'Boot' state.
	this.add.sprite(0, 0, 'splash');
	this.add.sprite(0, 0, 'progressBarBg');
	this.progressBar = this.add.sprite(0, 0, 'progressBar');

	this.load.setPreloadSprite(this.progressBar);

	// Full-screen effects
	this.dagfin.load('image', "black", "assets/sprites/black.png");
	this.dagfin.load('image', "damage", "assets/sprites/damage.png");
	this.dagfin.load('spritesheet', "noise", "assets/sprites/noise.png", 200, 150);

	this.dagfin.load('image', "radial_light", "assets/sprites/radial_light.png");

	// Menu
	this.dagfin.load('image', 'menu_bg', 'assets/menu_bg.png');
	this.dagfin.load('image', 'menu_arrow', 'assets/menu_arrow.png');
	this.dagfin.load('image', 'menu_newGame', 'assets/sprites/'+lang+'/new_game.png');
	this.dagfin.load('image', 'menu_continue', 'assets/sprites/'+lang+'/continue.png');
	
	// Message stuff
	this.dagfin.load('json', "common_texts", "assets/texts/"+lang+"/common.json");
	this.dagfin.load('image', "message_bg", "assets/message_bg.png");
	this.dagfin.load('bitmapFont', "message_font", "assets/fonts/font.png",
						 "assets/fonts/font.fnt");

	// Map stuff
	this.dagfin.load('image', "basic_tileset", "assets/tilesets/basic.png");

	this.dagfin.load('image', "spawn", "assets/tilesets/spawn.png");
	this.dagfin.load('image', "spawn2", "assets/tilesets/spawn2.png");

	// Characters
	this.dagfin.load('spritesheet', "zombie", "assets/sprites/zombie.png", DOOD_WIDTH, DOOD_HEIGHT);
//	this.dagfin.load('spritesheet', "player", "assets/sprites/player.png", DOOD_WIDTH, DOOD_HEIGHT);
	this.dagfin.load('spritesheet', "player", "assets/sprites/player2.png", DOOD_WIDTH, DOOD_HEIGHT);
	this.dagfin.load('image', "dead_player", "assets/sprites/dead.png");

	// Props
	this.dagfin.load('image', "hdoor", "assets/sprites/hdoor.png");
	this.dagfin.load('image', "vdoor", "assets/sprites/vdoor.png");

	// Sounds
	this.dagfin.load('json', "sfxInfo", "assets/audio/sfx/sounds.json");
	this.dagfin.load('audio', 'sfx', ["assets/audio/sfx/sounds.mp3","assets/audio/sfx/sounds.ogg"]);

	this.dagfin.load('audio', 'music', [
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.mp3',
		'assets/audio/music/01 - SAKTO - L_Appel de Cthulhu.ogg']);

};

LoadingState.prototype.create = function() {
	'use strict';

	this.dagfin.playMusic();

	var level = location.href.split('level=')[1]
	if(level) {
		this.dagfin.goToLevel(level);
	}
	else {
		this.game.state.start('Menu');
	}
};


////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// MENU STATE !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

function MenuState(dagfin) {
	'use strict';

	Phaser.State.call(this);

	this.dagfin = dagfin;
}

MenuState.prototype = Object.create(Phaser.State.prototype);

MenuState.prototype.create = function() {
	'use strict';

	this.dagfin.initState();

	this.MIN_CHOICE = 0;
	this.MAX_CHOICE = 1;

	this.NEW_GAME = 0;
	this.CONTINUE = 1;

	this.arrowPos = [ 455, 520 ];

	this.choice = this.NEW_GAME;

	this.k_up = this.game.input.keyboard.addKey(Phaser.Keyboard.UP);
	this.k_down = this.game.input.keyboard.addKey(Phaser.Keyboard.DOWN);
	this.k_space = this.game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
	this.k_enter = this.game.input.keyboard.addKey(Phaser.Keyboard.ENTER);

	this.k_up.onDown.add(this.menuUp, this);
	this.k_down.onDown.add(this.menuDown, this);
	this.k_space.onDown.add(this.menuValidate, this);
	this.k_enter.onDown.add(this.menuValidate, this);

	this.add.sprite(0, 0, 'menu_bg');
	this.arrow = this.add.sprite(0, this.arrowPos[this.choice], 'menu_arrow');

	this.newGameButton = this.add.button(60, 440, 'menu_newGame', this.newGame, this);
	this.newGameButton.onInputOver.add(function() {
		this.choice = this.NEW_GAME;
	}, this);

	this.continueButton = this.add.button(60, 500, 'menu_continue', this.continue, this);
	this.continueButton.onInputOver.add(function() {
		this.choice = this.CONTINUE;
	}, this);

	// Preload next chapter in background.
	IntroLevel.prototype.preload.call({ gameState: this });
	this.load.start();
};

MenuState.prototype.update = function() {
	'use strict';

	this.arrow.y = this.arrowPos[this.choice];
};

MenuState.prototype.newGame = function() {
	'use strict';

	this.dagfin.newGame();
};

MenuState.prototype.continue = function() {
	'use strict';

	this.dagfin.continueFromSave();
};

MenuState.prototype.menuDown = function() {
	'use strict';

	this.choice = this.math.min(this.choice + 1, this.MAX_CHOICE);
};

MenuState.prototype.menuUp = function() {
	'use strict';

	this.choice = this.math.max(this.choice - 1, this.MIN_CHOICE);
};

MenuState.prototype.menuValidate = function() {
	'use strict';

	switch(this.choice) {
	case this.NEW_GAME:
		this.newGame();
		break;
	case this.CONTINUE:
		this.continue();
		break;
	}
};


////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// CREDITS STATE !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

function CreditsState(dagfin) {
	'use strict';

	Phaser.State.call(this);

	this.dagfin = dagfin;
}

CreditsState.prototype = Object.create(Phaser.State.prototype);

CreditsState.prototype.create = function() {
	'use strict';

	this.dagfin.initState();

	this.credits = this.add.text(400, 800,
		this.cache.getJSON("common_texts")["credits"],
		{ font: "32px Arial", fill: "#ffffff", align: "center" });
	this.credits.anchor.set(.5, .5);

	var tween = this.add.tween(this.credits);
	tween.to({ y: 300 }, 5000, Phaser.Easing.Linear.None, true);
};

CreditsState.prototype.update = function() {
	'use strict';

};


////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// GAME STATE !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

function GameState(dagfin) {
	'use strict';
	Phaser.State.call(this);


	this.dagfin = dagfin;
}

GameState.prototype = Object.create(Phaser.State.prototype);


////////////////////////////////////////////////////////////////////////////
// Init

GameState.prototype.init = function(levelId) {
	'use strict';

	levelId = levelId || 'intro';

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
	
	this.dagfin.initState();

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

	// A clock moving at real-time pace (without slow-down) but taking
	// pauses into account.
	this.fastClock = new Phaser.Clock(this.game);

	this.game.physics.startSystem(Phaser.Physics.ARCADE);

	// Some settings...
	this.debugMode = false;
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

	// Group all the stuff on the ground (always in background)
	this.objectsGroup = this.make.group();
	// Group all the stuff that should be sorted by depth.
	this.depthGroup = this.make.group();
	// Group all the stuff that should be sorted above the rest.
	this.ceiling = this.make.group();

	// Used by Level.create().
	this.blackScreen = this.make.sprite(0, 0, "black");
	this.blackScreen.scale.set(MAX_WIDTH, MAX_HEIGHT);
	this.blackScreen.kill();

	// Entities
	this.entities = [];

	// Player.
	this.player = new Player(this.game, 0, 0);
	this.camera.follow(this.player, Phaser.Camera.FOLLOW_TOPDOWN);

	// This stores the zombies.
	this.mobs = [];
	this.entities.push(this.mobs);

	// Map.
	this.level.create();

	var rawPlayerData = this.map.objects.doods[0];
	this.player.x = rawPlayerData.x + 16;
	this.player.y = rawPlayerData.y - 16;

	// Add groups after level
	this.world.add(this.objectsGroup);
	this.world.add(this.depthGroup);
	this.world.add(this.ceiling);

	this.postProcessGroup = this.add.group();
	
	// Lighting.
	var margin = 5;
	this.lightmap = this.make.renderTexture(MAX_WIDTH+margin*2,
											MAX_HEIGHT+margin*2,
											"lightmap");
	this.lightLayer = this.add.sprite(-margin, -margin, this.lightmap, 0, this.postProcessGroup);
	this.lightLayer.blendMode = PIXI.blendModes.MULTIPLY;

	// Contains all the stuff to render to the lightmap.
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

	this.fastClock.events.loop(LIGHT_DELAY, function() {
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

	this.postProcessGroup.add(this.blackScreen);

	// Add Message box
	this.postProcessGroup.add(this.messageGroup);

	// Damage pass
	this.damageSprite = this.add.sprite(0, 0, "damage", 0, this.postProcessGroup);
	this.damageSprite.scale.set(8, 8);

	// Game Over
	this.gameOver = this.add.sprite(0, 0, "black", 0, this.postProcessGroup);
	this.gameOver.scale.set(MAX_WIDTH, MAX_HEIGHT);
	this.gameOver.kill();
	this.gameOverText = this.add.text(400, 300,
						"", { font: "32px Arial", fill: "#c00000", align: "center" }, this.postProcessGroup);
	this.gameOverText.anchor.set(.5, .5);

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
	this.sounds = this.game.add.audio("sounds");
	this.sounds.addMarker("grunt", 0, 0.8);
	this.sounds.addMarger("growling", 1, 1.6);
	//... */
};


////////////////////////////////////////////////////////////////////////////
// Update

GameState.prototype.updateEntities = function(entity) {
	'use strict';

	if(Array.isArray(entity)) {
		entity.forEach(this.updateEntities, this);
	}
	else if(typeof entity.update === 'function') {
		entity.entityUpdate();
	}
	else {
		console.warn("Invalid entity:", entity);
	}
}

GameState.prototype.update = function () {
	'use strict';

	this.fastClock.update(this.time.elapsed);

	// Do collisions first to avoid weird behaviors...
	this.physics.arcade.collide(this.depthGroup, this.mapLayer);
	// Tests the collisions among the group itself, but avoid zombie vs player collisions.
	// TODO: Somthig wiser (collisions between zombies and dagfin...
	this.physics.arcade.collide(this.depthGroup, undefined, null, function(a, b) {
		return !(a instanceof Dood && b instanceof Dood);
	});

	this.updateEntities(this.entities);

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

	// TODO: move this in an event handler ?
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

	this.level.update();

	this.depthGroup.sort('y', Phaser.Group.SORT_ASCENDING);

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

	// Update damage sprite
	this.damageSprite.alpha = 1 - this.player.abilityRate();
	if(this.damageSprite.alpha == 0) this.damageSprite.kill();
	else this.damageSprite.revive();

};


////////////////////////////////////////////////////////////////////////////
// Render

GameState.prototype.render = function () {
	'use strict';
	if(this.debugMode) {
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
	//	this.depthGroup.forEach(function(body) {
	//		this.game.debug.body(body);
	//	}, this);
	}
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
		this.messageCallbackContext = this.questionCallbackContext;
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
			callback.apply(this.messageCallbackContext, this.messageCallbackParam);
		}
	}

	// Callback may have refilled the message queue.
	if(this.messageQueue.length !== 0) {
		this.messageGroup.callAll('revive');
		this.message.text = this.messageQueue.shift().replace(/\n/g, '\n  ');
	}
};

GameState.prototype.updateQuestionText = function() {
	var msg = this.question.question + "\n";
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

GameState.prototype.askQuestion = function(key, msg, callbacks, context, param) {
	callbacks = callbacks || [];

	var question = this.cache.getJSON(key)[msg];

	this.blocPlayerWhileMsg = true;
	if(Array.isArray(question.question)) {
		this.messageQueue = question.question.slice(0, -1);
		question.question = question.question.slice(-1);
		this.messageCallback = this._askQuestion;
		this.messageCallbackContext = this;
		this.messageCallbackParam = [
			question, callbacks, context,
			Array.prototype.slice.call(arguments, 4)
		];
		this.nextMessage();
	}
	else {
		this._askQuestion(question, callbacks, context, param);
	}
};

GameState.prototype._askQuestion = function(question, callbacks, context, params) {
	this.blocPlayerWhileMsg = true;
	this.questionCallbacks = callbacks || [];
	this.questionCallbackContext = context;
	this.questionCallbackParam = Array.prototype.slice.call(arguments, 3);
	this.question = question;
	this.questionChoice = 0;

	this.messageGroup.callAll('revive');
	this.updateQuestionText();
}

GameState.prototype.displayMessage = function(key, msg, blocPlayer, callback, cbContext, params) {
	this.blocPlayerWhileMsg = blocPlayer || false;
	this.messageCallback = callback || null;
	this.messageCallbackContext = cbContext || null;
	this.messageCallbackParam = Array.prototype.slice.call(arguments, 5);
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
	this.body.setSize(28, 16, 0, 9);

	this.anchor.set(.5, .8);
	this.revive();

	this.animateMove = true;
	this.behavior = NORMAL;
	this.facing = DOWN;

	// Is the dood moving ?
	this.moving = false;
	this.wasMoving = false;

	// Is there something restricting dood mooves ?
	this.hitWall = false;

	this.blockThisFrame = false;
	this.prevVelocity = new Phaser.Point(0, 0);
	this.tmpVec = new Phaser.Point();

	this.gameState = game.state.getCurrentState(); // gs easy acces for Doods childs classes
	var gs = this.gameState;
	gs.addSfx(this);

	if (!group) group = gs.depthGroup;
	group.add(this);

	var dood = this;
}

Dood.prototype = Object.create(Phaser.Sprite.prototype);

Dood.prototype.entityUpdate = function() {
	'use strict';

};

Dood.prototype.block = function() {
	'use strict';

	this.blockThisFrame = true;
}

Dood.prototype.isTargetInRange = function(target, range) {
	'use strict';

	var line2Target = new Phaser.Line(this.x, this.y, target.x, target.y);
	return line2Target.length < range;
};

Dood.prototype.isDirectPathObstructed = function(target) {
	'use strict';

	var line2Target = new Phaser.Line(this.x, this.y, target.x, target.y);
	return this.gameState.obstructed(line2Target);
};

Dood.prototype.isInFrontCone = function(target, frontConeAngle) {
	'use strict';

	// SO much better !!!
	var lookDir = this.facingOrientation(1, this.tmpVec);
	var targetDir = Phaser.Point.subtract(target.world, this.world).normalize();
	return lookDir.dot(targetDir) > Math.cos(frontConeAngle/2);
};

Dood.prototype.isInView = function(target, viewRange, frontConeAngle, viewThroughWalls) {
	'use strict';

	return	( !viewRange || this.isTargetInRange(target, viewRange) )
		&& 	( viewThroughWalls || !this.isDirectPathObstructed(target) )
		&& 	(!frontConeAngle || this.isInFrontCone(target, frontConeAngle));
};

Dood.prototype.facingOrientation = function(length, point) {
	'use strict';

	length = length || 1;
	if(typeof point === 'undefined') point = new Phaser.Point();

	point.set(0, 0);
	switch(this.facing) {
		case DOWN:  point.y =  length; break;
		case UP:    point.y = -length; break;
		case RIGHT: point.x =  length; break;
		case LEFT:  point.x = -length; break;
	}
	return point;
};

Dood.prototype.facingPosition = function(dist, point) {
	'use strict';

	dist = dist || 1;

	var point = this.facingOrientation(dist, point);
	point = Phaser.Point.add(point, this.world);

	return point;
};

/**
* kill overload to ensure onKilled is called only once.
*/
Dood.prototype.kill = function() {
	'use strict';

	if(this.alive) {
		this.health = 0;
		Phaser.Sprite.prototype.kill.call(this);
	}
};

Dood.prototype.speed = function() {
	'use strict';

	console.warn('override this method to let your dood move');
	return 0;
};

Dood.prototype.directionFlagsToVector = function(direction, vector) {
	'use strict';

	if(typeof vector === 'undefined') { vector = new Phaser.Point(); }

	vector.set(0, 0);
	if(direction & DOWN_FLAG)  { vector.y =  1; }
	if(direction & UP_FLAG)    { vector.y = -1; }
	if(direction & RIGHT_FLAG) { vector.x =  1; }
	if(direction & LEFT_FLAG)  { vector.x = -1; }

	return vector;
};

Dood.prototype.move = function(direction) {
	'use strict';

	var velocity = this.body.velocity;
	if(this.blockThisFrame) {
		this.blockThisFrame = false;
		velocity.set(0, 0);
	}
	else if(typeof direction === 'number') {
		velocity = this.directionFlagsToVector(direction, this.body.velocity);
	}
	else {
		velocity.copyFrom(direction);
	}

	if(velocity.getMagnitudeSq() > 0.001) {
		velocity.setMagnitude(this.speed());
	}

	var newFacing = DOWN;
	var maxDirSpeed = velocity.y;
	if(-velocity.y > maxDirSpeed) { newFacing = UP;    maxDirSpeed = -velocity.y; }
	if( velocity.x > maxDirSpeed) { newFacing = RIGHT; maxDirSpeed =  velocity.x; }
	if(-velocity.x > maxDirSpeed) { newFacing = LEFT;  maxDirSpeed = -velocity.x; }

	// Seems to bug if collisions are done after. This is why they are
	//  the first thing in GameSatae.update().
	this.wasMoving = this.moving;
	this.moving = maxDirSpeed > 0.01 &&
	   (Math.abs(this.body.prev.x - this.body.position.x) > .1
	    || Math.abs(this.body.prev.y - this.body.position.y) > .1);

	this.prevVelocity.normalize();
	var lastMove = Phaser.Point.subtract(this.body.position, this.body.prev, this.tmpVec).normalize();
	this.hitWall = Phaser.Point.distance(this.prevVelocity, lastMove) > 0.01;

	if(direction) {
		this.facing = newFacing;
	}

	if(this.moving) {
		var distance = Phaser.Point.distance(this.gameState.player.world, this.world);
		this.sfx.play('playerFootStep', 0,
					  soundFalloff(distance),
					  false, false);
		if(this.walkAnims) {
			this.animations.play(this.walkAnims[this.facing]);
		}
	}
	else if(this.walkAnims) {
		this.animations.stop();
		this.frame = (this.behavior*4 + this.facing)*3;
	}

	if(!this.walkAnims && this.animateMove) {
		this.frame = this.behavior*4 + this.facing;
	}

	this.prevVelocity.copyFrom(this.body.velocity.clone());
};


////////////////////////////////////////////////////////////////////////////
// Player

function Player(game, x, y) {
	'use strict';

	Dood.call(this, game, x, y, "player");

	var gs = this.gameState;
	gs.entities.push(this);

	this.onDeath(gs.level.displayDeathScreen, gs.level);

	this.animations.add('walk_down',  [0,  1, 0,  2], 8, true);
	this.animations.add('walk_up',    [3,  4, 3,  5], 8, true);
	this.animations.add('walk_right', [6,  7, 6,  8], 8, true);
	this.animations.add('walk_left',  [9, 10, 9, 11], 8, true);
	this.walkAnims = [];
	this.walkAnims[DOWN]  = 'walk_down';
	this.walkAnims[UP]    = 'walk_up';
	this.walkAnims[RIGHT] = 'walk_right';
	this.walkAnims[LEFT]  = 'walk_left';

	this.deadSprite = gs.add.sprite(0, 0, 'dead_player', 0, gs.objectsGroup);
	this.deadSprite.anchor.set(.5, .5);
	this.deadSprite.kill(); // Kill the dead !

	this.health = PLAYER_MAX_LIFE;
	this.canPunch = true;
	this.nextHit = 0;

	this.events.onKilled.add(this.killPlayer, this);

	this.lastRegen = gs.time.clock.now;
}

Player.prototype = Object.create(Dood.prototype);

Player.prototype.entityUpdate = function() {
	'use strict';

	Dood.prototype.update.call(this);

	var gs = this.gameState;
	var now = gs.time.clock.now;

	// React to controls.
	var moveDir = 0;
	if(!gs.blocPlayerWhileMsg && this.alive) {
		if(gs.k_down.isDown)  { moveDir |= DOWN_FLAG;  }
		if(gs.k_up.isDown)    { moveDir |= UP_FLAG;    }
		if(gs.k_right.isDown) { moveDir |= RIGHT_FLAG; }
		if(gs.k_left.isDown)  { moveDir |= LEFT_FLAG;  }
	}
	this.move(moveDir);

	if(gs.k_punch.isDown && this.canPunch && this.alive && this.nextHit <= now) {
		// Player stun zombie
		for(var i=0; i<gs.mobs.length; ++i) {
			var zombie = gs.mobs[i];
			if(zombie.state !== Zombie.updateStun &&
					gs.physics.arcade.overlap(this, zombie)) {
				zombie.stun();
				break;
			}
		}
		this.nextHit = now + HIT_COOLDOWN;
		this.sfx.play('playerHit',0,1,false,true); //FIXME : different sound when you hit zombie and when you are hit by zombie and when you hit nothing
	}

	this.regenerate();
};

Player.prototype.killPlayer = function() {
	'use strict';

	this.deadSprite.revive();
	this.deadSprite.x = this.x;
	this.deadSprite.y = this.y;

	this._deathCallback.call(this._deathCallbackContext);
	//TODO : death sound, death music
};

Player.prototype.onDeath = function(callback, context) {
	'use strict';

	this._deathCallback = callback;
	this._deathCallbackContext = context;
}

Player.prototype.regenerate = function() {
	'use strict';

	var now = this.gameState.time.clock.now;
	if(this.alive && PLAYER_FULL_LIFE_RECOVERY_TIME)
		this.health = Math.min(
			PLAYER_MAX_LIFE,
			this.health + (
				( now - this.lastRegen ) * PLAYER_MAX_LIFE /
				( 1000 * PLAYER_FULL_LIFE_RECOVERY_TIME )
			)
		);
	this.lastRegen = now;
};

Player.prototype.abilityRate = function() {
	'use strict';

	return Math.sqrt(this.health / PLAYER_MAX_LIFE);
};

Player.prototype.speed = function() {
	'use strict';

	if(SLOW_PLAYER_WHEN_DAMAGED) {
		return PLAYER_VELOCITY * this.abilityRate();
	}
	return PLAYER_VELOCITY;
};


////////////////////////////////////////////////////////////////////////////
// Zombie

function Zombie(game, x, y) {
	'use strict';

	Dood.call(this, game, x, y, "zombie");
	this.gameState.mobs.push(this);

	this.behavior = NORMAL;
	this.state = this.updateNormal;

	this.nextIdea = 0;
	this.nextSpoting = 0;
	this.nextAttack = 0;
	this.nextWakeUp = 0;

	this.walking = true;
	this.chargeDir = null;

	this.wakeUp();
}

Zombie.prototype = Object.create(Dood.prototype);

Zombie.prototype.entityUpdate = function() {
	'use strict';

	this.state();
};

Zombie.prototype.updateIdle = function() {
	'use strict';

	this.move(0);
}

Zombie.prototype.updateNormal = function() {
	'use strict';

	// EXTERMINATE ! EXTERMINATE !
	if(this.isOnPlayer()) {
		this.attack();
	}
	else {
		var now = this.gameState.time.clock.now;

		// Everyday I'm shambling.
		if(this.nextIdea <= now) { this.shamble(); }

		this.stumbleAgainstWall();

		// Look around
		if(this.nextSpoting <= now) { this.spot(); }

		var moveDir = 0;
		if(this.walking) { moveDir = 1 << this.facing; }

		this.move(moveDir);
	}
};

Zombie.prototype.updateStun = function() {
	'use strict';

	var now = this.gameState.time.clock.now;

	if(this.nextWakeUp <= now) {
		this.wakeUp();
	}
	this.move(0);
};

Zombie.prototype.updateCharge = function() {
	'use strict';

	var now = this.gameState.time.clock.now;

	if(this.isOnPlayer()) {
		this.attack();
	}
	else {
		// Everyday I'm shambling.
		if(this.nextIdea <= now) { this.shamble(); }

		if(this.hitWall) {
			if(this.seePlayer()) {
				this.aggroPlayer();
			}
			else {
				this.wakeUp();
			}
		}
	}

	this.move(this.chargeDir);
};

Zombie.prototype.updateAttack = function() {
	'use strict';

	var now = this.gameState.time.clock.now;

	this.gameState.player.block();
	if(!this.isOnPlayer()) {
		this.wakeUp();
	}
	else if(this.nextAttack <= now) {
		this.hit(this.gameState.player);
	}

	this.move(0);
};

Zombie.prototype.idle = function(delay) {
	'use strict';

		this.behavior = NORMAL;
		this.state = this.updateIdle;
}

Zombie.prototype.wakeUp = function(delay) {
	'use strict';

	if(typeof delay === 'undefined') { delay = 0 };

	var now = this.gameState.time.clock.now;

	if(this.state != this.updateNormal) {
		this.behavior = NORMAL;
		this.state = this.updateNormal;
		this.nextIdea = Math.max(this.nextIdea,
			this.gameState.time.clock.now + ZOMBIE_IDEA_DELAY
			+ this.gameState.rnd.integerInRange(-ZOMBIE_IDEA_DELAY_RAND, ZOMBIE_IDEA_DELAY_RAND));
		this.nextSpoting = now;
	}
};

Zombie.prototype.stun = function(delay) {
	'use strict';

	if(typeof delay === 'undefined') delay = ZOMBIE_STUN_DELAY;

	var now = this.gameState.time.clock.now;

	if(this.state !== this.updateStun) {
		this.behavior = STUNNED;
		this.state = this.updateStun;
		this.nextWakeUp = now + delay;
	}
};

Zombie.prototype.attack = function() {
	'use strict';

	var now = this.gameState.time.clock.now;

	this.behavior = AGGRO;
	this.state = this.updateAttack;
	this.gameState.player.body.velocity.set(0, 0);
	this.nextAttack =  now + HIT_COOLDOWN/2;
};

Zombie.prototype.aggroPlayer = function() {
	'use strict';

	this.behavior = AGGRO;
	this.state = this.updateCharge;
	this.chargeDir = Phaser.Point.subtract(this.gameState.player.world, this.world);

	this.sfx.play('aggro',0,1,false,false);
};

Zombie.prototype.seePlayer = function() {
	'use strict';

	return this.isInView(this.gameState.player, ZOMBIE_SPOTTING_RANGE, ZOMBIE_SPOTTING_ANGLE);
};

Zombie.prototype.isOnPlayer = function() {
	'use strict';

	return this.gameState.physics.arcade.overlap(this, this.gameState.player);
};

Zombie.prototype.stumbleAgainstWall = function() {
	'use strict';

	if(!this.moving && this.wasMoving && this.walking) {
		this.nextIdea = Math.min(this.nextIdea, this.gameState.time.clock.now + 250);
	}
};

Zombie.prototype.shamble = function() {
	'use strict';

	// Zombies can't think AND walk.
	this.walking = this.gameState.rnd.frac() > ZOMBIE_THINKING_PROBA;
	if(this.walking) {
		var newFacing = this.gameState.rnd.integer()%4;
		this.facing = newFacing;
	}

	this.nextIdea = this.gameState.time.clock.now + ZOMBIE_IDEA_DELAY
		+ this.gameState.rnd.integerInRange(-ZOMBIE_IDEA_DELAY_RAND, ZOMBIE_IDEA_DELAY_RAND);
};

Zombie.prototype.spot = function() {
	'use strict';

	if(this.seePlayer()) { this.aggroPlayer(); }

	this.nextSpoting = this.gameState.time.clock.now + ZOMBIE_SPOTTING_DELAY;
};

Zombie.prototype.speed = function() {
	'use strict';

	switch (this.behavior){
		case AGGRO: return ZOMBIE_CHARGE_VELOCITY;
		case STUNNED: return ZOMBIE_STUNNED_VELOCITY;
		case NORMAL:
		default:
			return ZOMBIE_SHAMBLE_VELOCITY;
	}
};

Zombie.prototype.hit = function(target) {
	'use strict';

	var now = this.gameState.time.clock.now;

	this.nextAttack =  now + HIT_COOLDOWN;
	this.sfx.play('zombieHit', 0, 1, false, true); //hit by zombie
	this.gameState.player.damage(1);
};


////////////////////////////////////////////////////////////////////////////
// Dagfin


function Dagfin(game, x, y) {
	'use strict';

	Dood.call(this, game, x, y, "dagfin");
	this.gameState.entities.push(this);

	this.body.setSize(110, 36, 0, 13);
	this.animations.add("move", null, 16, true);
	this.animations.play("move");

	this.animateMove = false;

	this.WAITING = 0;
	this.AGGRO = 1;
	this.state = this.WAITING;

	this.ritualItemPlaced = 0;
	this.nextZombieSpawn = 0;
}

Dagfin.prototype = Object.create(Dood.prototype);

Dagfin.prototype.entityUpdate = function() {
	'use strict';

	if(this.state === this.WAITING) {
		this.move(0);
		return;
	}

	var player = this.gameState.player;
	var now = this.gameState.time.clock.now;

	this.attack();

	// when aggro, spawn zombie over time
	if(this.nextZombieSpawn < now){
		this.spawnZombie();
		this.nextZombieSpawn = now + DAGFIN_ZOMBIE_SPAWN_DELAY*1000;
	}

	// kill player if contact
	if(this.body.hitTest(player.x, player.y)){
		player.kill();
	}
};

Dagfin.prototype.attack = function() {
	'use strict';

	// FIXME: change walking sound for dagfin.
	this.move(Phaser.Point.subtract(this.gameState.player.world, this.world));
};

Dagfin.prototype.ritualStepBehavior = function() {
	'use strict';

	this.ritualItemPlaced++; // will increase Speed
	this.spawnZombie();
};

Dagfin.prototype.spawnZombie = function() {
	'use strict';

	this.gameState.mobs.push(new Zombie(this.gameState.game, this.x, this.y));
};

Dagfin.prototype.speed = function() {
	'use strict';

	return DAGFIN_BASE_VELOCITY + this.ritualItemPlaced*DAGFIN_RITUAL_VELOCITY_BOOST;
};

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// LEVELS !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

function Level(gameState, name) {
	'use strict';
	
	this.gameState = gameState;
	this.name = name;
	
	this.enablePlayerLight = true;
	this.enableNoisePass = true;
}

Level.prototype.preload = function(mapJson) {
	'use strict';

	Phaser.State.prototype.preload.call(this);

	// Load screen : the test prevents the loading screen to pop up when
	// calling next level's preload.
	if(this instanceof Level && !this.loadScreen) {
		this.loadScreen = this.gameState.add.group();
		this.gameState.add.sprite(0, 0, 'splash', 0, this.loadScreen);
		this.gameState.add.sprite(0, 0, 'progressBarBg', 0, this.loadScreen);
		this.progressBar = this.gameState.add.sprite(0, 0, 'progressBar', 0, this.loadScreen);

		this.gameState.load.setPreloadSprite(this.progressBar);
	}
}

Level.prototype.create = function(mapJson) {
	'use strict';

	Phaser.State.prototype.create.call(this);

	this.loadScreen.callAll('kill');

	this.setBlackScreen(true);
}

Level.prototype.update = function(mapJson) {
	'use strict';

	Phaser.State.prototype.update.call(this);

	this.processTriggers();
}

Level.prototype.render = function(mapJson) {
	'use strict';

	Phaser.State.prototype.render.call(this);
}

Level.prototype.parseLevel = function(mapJson) {
	'use strict';
	
	// TODO: refactor this function.
	
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

		tri.onActivate = new Phaser.Signal();
		tri.onEnter = new Phaser.Signal();
		tri.onLeave = new Phaser.Signal();
		tri.isInside = false;

		this.triggers[tri.name] = tri;
	}

	// Items in the map
	this.objects = {};
	if(this.mapLayers.items) {
		for(var i = 0 ; i < this.mapLayers.items.objects.length ; i++) {
			var item = this.mapLayers.items.objects[i];
			var offset_x = parseInt(item.properties.offset_x, 10) || 0;
			var offset_y = parseInt(item.properties.offset_y, 10) || 0;
			var parent = (item.properties.solid === 'true')?
				gs.depthGroup: gs.objectsGroup;
			var key = item.properties.key || item.name+"_item";
			var sprite = gs.add.sprite(item.x + offset_x + 16,
										 item.y + offset_y - 16,
										 key, 0, parent);
			gs.game.physics.arcade.enable(sprite);
			sprite.name = item.name;
			sprite.objName = item.name;	// TODO: replace this by name !
			sprite.anchor.set(.5, .5);
			sprite.body.immovable = true;

			sprite.onActivate = new Phaser.Signal();
			sprite.onEnter = new Phaser.Signal();
			sprite.onLeave = new Phaser.Signal();
			sprite.isInside = false;

			this.objects[item.name] = sprite;
		}
	}
	
	// Doors in the map
	this.doors = []
	if(this.mapLayers.doors) {
		for(var i = 0 ; i < this.mapLayers.doors.objects.length ; i++) {
			var door = this.mapLayers.doors.objects[i];
			var offset_x = parseInt(door.properties.offset_x, 10) || 0;
			var offset_y = parseInt(door.properties.offset_y, 10) || 0;
			var key = door.type;
			var sprite = gs.add.sprite(door.x + offset_x,
			                             door.y + offset_y,
			                             key, 0, gs.depthGroup);
			gs.game.physics.arcade.enable(sprite);
			sprite.anchor.set(0, 1);
			sprite.body.setSize(TILE_SIZE, TILE_SIZE, 0, 0);
			sprite.objName = door.name;
			sprite.body.immovable = true;
			door.sprite = sprite;
			this.doors.push(door);
		}
	}

	// Zombies
	if(this.mapLayers.doods) {
		var zombieList = this.mapLayers.doods.objects;
		for (var i = 1 ; i < zombieList.length ; i++)
			new Zombie(gs.game, zombieList[i].x, zombieList[i].y);
	}
};

Level.prototype.processTriggers = function() {
	'use strict';

	var gs = this.gameState;

	var use = (!gs.hasMessageDisplayed() && gs.player.alive && gs.k_use.triggered);
	var usePos = gs.player.facingPosition(USE_DIST);

	for(var id in this.triggers) {
		var tri = this.triggers[id];
		var inside = tri.rect.contains(gs.player.x, gs.player.y);

		if(inside && !tri.isInside) {
			tri.onEnter.dispatch(tri);
			tri.isInside = true;
		}
		if(!inside && tri.isInside) {
			tri.onLeave.dispatch(tri);
			tri.isInside = false;
		}
		if(use && tri.rect.contains(usePos.x, usePos.y)) {
			tri.onActivate.dispatch(tri);
		}
	}

	for(var id in this.objects) {
		var obj = this.objects[id];

		if(!obj.exists) {
			continue;
		}

		var inside = obj.body.hitTest(gs.player.x, gs.player.y);
		if(inside && !obj.isInside) {
			obj.onEnter.dispatch(obj);
			obj.isInside = true;
		}
		if(!inside && obj.isInside) {
			obj.onLeave.dispatch(obj);
			obj.isInside = false;
		}
		if(use && obj.body.hitTest(usePos.x, usePos.y)) {
			obj.onActivate.dispatch(obj);
		}
	}
};

Level.prototype.pickUpMessage = function(msg) {
	'use strict';

	this.gameState.displayMessage(this.name+"_messages", msg.name, true,
								  msg.kill, msg);
};

Level.prototype.switchDoors = function(triggerName) {
	'use strict';

	for (var i = 0 ; i < this.doors.length ; i++) {
		var door = this.doors[i];
		if (door.properties.trigger === triggerName) {
			if(door.sprite.alive) {
				door.sprite.kill();
			}
			else {
				door.sprite.revive();
			}
		}
	}
};

Level.prototype.displayDeathScreen = function() {
	'use strict';

	var gs = this.gameState;

	gs.messageBg.kill();
	gs.message.text = "";

	gs.gameOver.revive();
	gs.gameOver.alpha = 0;
	var tween = gs.add.tween(gs.gameOver);
	tween.onComplete.add(function() {
		gs.gameOverText.text = gs.cache.getJSON("common_texts")["game_over"];
		gs.time.clock.events.add(2000, function() {
			gs.dagfin.reloadLastSave();
		}, this);
	}, this);
	tween.to({ alpha: 1}, 1500, Phaser.Easing.Linear.None, true, 500);
}

Level.prototype.setBlackScreen = function(turnOn) {
	'use strict';

	// gameOver is a fullscreen black sprite, so it does the job.
	if(turnOn) { this.gameState.blackScreen.revive(); }
	else { this.gameState.blackScreen.kill(); }
	this.gameState.blackScreen.alpha = 1;
}

Level.prototype.fade = function(fadeIn, delay) {
	'use strict';

	fadeIn = fadeIn? 1: 0;
	delay = delay || 1000;

	// gameOver is a fullscreen black sprite, so it does the job.
	this.gameState.blackScreen.revive();
	this.gameState.blackScreen.alpha = fadeIn;

	var fadeTween = this.gameState.add.tween(this.gameState.blackScreen);
	fadeTween.onComplete.add(function() {
		// May cause a minor bug if player dies before the end.
		// But this won't happen, right ?
		this.gameState.blackScreen.kill();
		this.gameState.blackScreen.alpha = 1;
	}, this);
	fadeTween.to({ alpha: 1-fadeIn }, delay);
	fadeTween.start();
	
	return fadeTween;
};

Level.prototype.goToLevel = function(level) {
	'use strict';

	var fadeTween = this.fade(false, 500);
	fadeTween.onComplete.add(function() {
		this.gameState.dagfin.goToLevel(level);
	}, this);
};

Level.prototype.loot = function(item) {
	'use strict';

	this.gameState.dagfin.inventory.push(item.name);
	item.kill();
};


////////////////////////////////////////////////////////////////////////////
// Intro

function IntroLevel(gameState) {
	'use strict';
	
	Level.call(this, gameState, 'intro');
}

IntroLevel.prototype = Object.create(Level.prototype);

IntroLevel.prototype.preload = function() {
	'use strict';

	Level.prototype.preload.call(this);

	var gs = this.gameState;

	gs.dagfin.load('json', "intro_map_json", "assets/maps/intro.json");
	gs.dagfin.load('json', "intro_messages", "assets/texts/"+lang+"/intro.json");
	
	gs.dagfin.load('image', "intro_tileset", "assets/tilesets/intro.png");
	gs.dagfin.load('spritesheet', "pillar_item", "assets/sprites/pillar.png", 32, 64);
	gs.dagfin.load('image', "carpet_item", "assets/sprites/carpet.png");
	gs.dagfin.load('image', "blood_item", "assets/sprites/blood.png");
	gs.dagfin.load('image', "femur_item", "assets/sprites/femur.png");
	gs.dagfin.load('image', "collar_item", "assets/sprites/collar.png");
};

IntroLevel.prototype.create = function() {
	'use strict';

	Level.prototype.create.call(this);

	var gs = this.gameState;

	// Defered loading here. But as we have the json, it's instant.
	this.mapJson = gs.cache.getJSON("intro_map_json");
	gs.load.tilemap("intro_map", null, this.mapJson,
				  Phaser.Tilemap.TILED_JSON);
	
	this.parseLevel(this.mapJson);

	gs.map = gs.game.add.tilemap("intro_map");
	gs.map.addTilesetImage("intro_tileset", "intro_tileset");
	gs.map.setCollision([ 6, 18, 24, 30 ]);

	gs.mapLayer = gs.map.createLayer("map");
	gs.mapLayer.resizeWorld();
//	gs.mapLayer.debug = true;

	this.enablePlayerLight = false;
	this.enableNoisePass = false;

	////////////////////////////////////////////////////////////////////
	// Level scripting.

	gs.displayMessage("intro_messages", "intro", true, function() {
		this.fade(true);
	}, this);

	this.triggers.room.onEnter.add(function() {
		gs.displayMessage("intro_messages", "room", true);
	}, this);

	this.objects.carpet.onEnter.add(this.findCarpet, this);

	this.objects.pillar.body.setSize(24, 24, 0, 16);
	this.objects.pillar.onActivate.addOnce(this.readBook, this);

	this.objects.blood.onActivate.add(this.pickObject, this);
	this.objects.femur.onActivate.add(this.pickObject, this);
	this.objects.collar.onActivate.add(this.pickObject, this);

	this.triggers.exit.onEnter.add(this.walkOnPentacle, this);

	// Preload next chapter in background.
	Chap1Level.prototype.preload.call(this);
	gs.load.start();
};

IntroLevel.prototype.update = function() {
	'use strict';

	Level.prototype.update.call(this);
};

IntroLevel.prototype.render = function() {
	'use strict';

	Level.prototype.render.call(this);
};

IntroLevel.prototype.findCarpet = function() {
	'use strict';

	this.gameState.displayMessage("intro_messages", "carpet", true,
			this.objects.carpet.kill, this.objects.carpet);
};

IntroLevel.prototype.readBook = function() {
	'use strict';

	this.gameState.displayMessage("intro_messages", 'book', true, function() {
		this.objects.pillar.frame = 1;
	}, this);
};

IntroLevel.prototype.pickObject = function(obj) {
	'use strict';

	if(this.objects.pillar.frame === 1) { // book read ?
		this.gameState.displayMessage("intro_messages", obj.objName+"2", true,
									  this.loot, this.gameState.player, obj);
	}
	else {
		this.gameState.displayMessage("intro_messages", obj.objName, true);
	}
};

IntroLevel.prototype.walkOnPentacle = function() {
	'use strict';

	if(!this.pentacleFound) {
		this.pentacleFound = true;
		this.gameState.displayMessage("intro_messages", 'pentacle', true);
	}
	else {
		var dagfin = this.gameState.dagfin;
		var foundAll = !this.objects.carpet.alive &&
					   dagfin.hasObject('blood') &&
					   dagfin.hasObject('femur') &&
					   dagfin.hasObject('collar');

		if(foundAll) {
			this.gameState.displayMessage("intro_messages", 'invoc', true,
										  this.exitLevel, this);
		}
	}
};

IntroLevel.prototype.exitLevel = function() {
	'use strict';

	var exitRect = this.triggers['exit'].rect;

	this.gameState.lightGroup.callAll('kill');
	this.gameState.addLight(exitRect.centerX, exitRect.centerY, 4, 0.05, 0xb36be3, .5);
	this.gameState.displayMessage("intro_messages", 'invoc2', true,
								  this.goToLevel, this, 'chap1');
};

////////////////////////////////////////////////////////////////////////////
// Chapter I

function Chap1Level(gameState) {
	'use strict';
	
	Level.call(this, gameState, 'chap1');
}

Chap1Level.prototype = Object.create(Level.prototype);

Chap1Level.prototype.preload = function() {
	'use strict';

	Level.prototype.preload.call(this);

	var gs = this.gameState;

	gs.dagfin.load('json', "chap1_map_json", "assets/maps/chap1.json");
	gs.dagfin.load('json', "chap1_messages", "assets/texts/"+lang+"/chap1.json");

	gs.dagfin.load('image', "crumbling_tile", "assets/sprites/crumbling.png");

	gs.dagfin.load('image', "note", "assets/sprites/note.png");
	gs.dagfin.load('image', "clock", "assets/sprites/clock.png");
	gs.dagfin.load('spritesheet', "switch", "assets/sprites/switch.png", 32,32);
};

Chap1Level.prototype.create = function() {
	'use strict';

	Level.prototype.create.call(this);

	var that = this;
	var gs = this.gameState;

	// Deferred loading here. But since we have the json, it's instant.
	this.mapJson = gs.cache.getJSON("chap1_map_json");
	gs.load.tilemap("chap1_map", null, this.mapJson,
				  Phaser.Tilemap.TILED_JSON);
	
	this.parseLevel(this.mapJson);

	gs.map = gs.game.add.tilemap("chap1_map");
	gs.map.addTilesetImage("basic", "basic_tileset");
	gs.map.setCollision([ 1, 8 ]);

	gs.mapLayer = gs.map.createLayer("map");
	gs.mapLayer.resizeWorld();
	// gs.mapLayer.debug = true;

	this.LAVA_TILE = 7;

	this.enablePlayerLight = false;
	this.enableNoisePass = true;
	
	gs.displayMessage("chap1_messages", "intro", true, function() {
		this.fade(true);
	}, this);
	
	var level = this;

	this.objects.indice1.onEnter.addOnce(this.pickUpMessage, this);
	this.objects.indice2.onEnter.addOnce(this.pickUpMessage, this);
	this.objects.indice3.onEnter.addOnce(this.pickUpMessage, this);

	this.objects.mazeSwitch.body.setSize(24, 16);
	this.objects.mazeSwitch.animations.add('toggle', null, 30);
	this.objects.mazeSwitch.animations.add('toggle2', [ 3, 2, 1, 0 ], 30);
	this.objects.mazeSwitch.frame = 0
	this.objects.mazeSwitch.onActivate.add(this.toogleMazeLights, this);

	// We avoid using mapLayer because it seems sloooooooow.
	this.crumbleTiles = {};
	this.crumbleGroup = gs.add.group(gs.objectsGroup);
	for(var y=0; y<gs.map.height; ++y) {
		for(var x=0; x<gs.map.width; ++x) {
			if(gs.map.layers[1].data[y][x].index != -1) {
				if(typeof this.crumbleTiles[y] === 'undefined') {
					this.crumbleTiles[y] = {};
				}
				this.crumbleTiles[y][x] =
					gs.add.sprite(x*32, y*32, 'crumbling_tile', 0, this.crumbleGroup);
			}
		}
	}
	this.infectedTiles = [];
	this.oldInfectedTiles = [];

	this.crumbleStep = 0;
	this.triggers.lava_fail.onEnter.addOnce(this.startCrumbleBridge, this);
	
	this.triggers.secret_tip.onEnter.addOnce(function() {
		gs.displayMessage("chap1_messages", "secret", true);
	}, this);

	this.secretGroup = gs.add.group(gs.ceiling);
	for(var y=0; y<gs.map.height; ++y) {
		for(var x=0; x<gs.map.width; ++x) {
			if(gs.map.layers[2].data[y][x].index != -1) {
				var s = gs.add.sprite(x*32, y*32, 'black', 0, this.secretGroup);
				s.scale.set(32, 32);
			}
		}
	}
	this.triggers.reveal_secret.onEnter.addOnce(function() {
		gs.ceiling.remove(this.secretGroup);
	}, this);

	for(var i=1; i<6; ++i) {
		this.setupAlleyLight(i);
	}

	this.objects.clock.onActivate.add(function() {
		gs.askQuestion("chap1_messages", "clock", [
			function() {
				this.loot(this.objects.clock);
			},
			null
		], this);
	}, this);

	this.triggers.exit.onEnter.add(function() {
		this.goToLevel('chap2');
	}, this);

	// Preload next chapter in background.
	Chap2Level.prototype.preload.call(this);
	gs.load.start();
};

Chap1Level.prototype.update = function() {
	'use strict';

	Level.prototype.update.call(this);

	var gs = this.gameState;

	var mapTile = gs.map.getTileWorldXY(gs.player.x, gs.player.y,
										undefined, undefined, gs.mapLayer);
	if(mapTile.index === this.LAVA_TILE) {
		var x = Math.floor(gs.player.x/32);
		var y = Math.floor(gs.player.y/32);
		var bridgeTile = this.getBridgeTile(x, y);
		if(!bridgeTile || !bridgeTile.alive) {
			gs.player.damage(.5);
		}
	}
};

Chap1Level.prototype.render = function() {
	'use strict';

	Level.prototype.render.call(this);

	var gs = this.gameState;
};

Chap1Level.prototype.toogleMazeLights = function() {
	'use strict';

	this.gameState.toggleLights('maze');
	
	var mSwitch = this.objects.mazeSwitch;
	if(mSwitch.frame === 0) {
		mSwitch.frame = 3;
		mSwitch.animations.play('toggle');
	}
	else {
		mSwitch.frame = 0;
		mSwitch.animations.play('toggle2');
	}
	
	// TODO: Add switch sound !
};

Chap1Level.prototype.getBridgeTile = function(x, y) {
	'use strict';

	var tile = this.crumbleTiles[y] && this.crumbleTiles[y][x];
	return tile || null;
}

Chap1Level.prototype.startCrumbleBridge = function() {
	'use strict';

	this.crumbleTile(6, 22);
	this.crumbleTimer = this.gameState.time.clock.events.loop(
		225, this.stepCrumbleBridge, this);
};

Chap1Level.prototype.crumbleTile = function(x, y) {
	'use strict';

	var tile = this.getBridgeTile(x, y);
	if(tile && tile.alive && !tile.crumling) {
		this.infectedTiles.push([x, y]);
		tile.crumling = true;
	}
}

Chap1Level.prototype.stepCrumbleBridge = function() {
	'use strict';

	var gs = this.gameState;

	var tmp = this.oldInfectedTiles;
	this.oldInfectedTiles = this.infectedTiles;
	this.infectedTiles = tmp;
	this.infectedTiles.length = 0;

	for (var i = 0 ; i < this.oldInfectedTiles.length ; i++)
	{
		var coord = this.oldInfectedTiles[i];
		var x = coord[0];
		var y = coord[1];
		this.getBridgeTile(x, y).kill();

		this.crumbleTile(x - 1, y);
		this.crumbleTile(x + 1, y);
		this.crumbleTile(x, y - 1);
		this.crumbleTile(x, y + 1);
	}

	++this.crumbleStep;
	for(var i=0; i<gs.lightGroup.length; ++i) {
		var light = gs.lightGroup.children[i];
		if(typeof light.properties.step !== 'undefined') {
			if(light.properties.step < this.crumbleStep+7 &&
			   light.properties.step > this.crumbleStep) {
				light.revive();
				light.lightColor = gs.multColor(
					gs.stringToColor(light.properties.color),
					(this.crumbleStep + 7 - light.properties.step) / 6);
				light.tint = light.lightColor;
			}
		}
	}

	if(this.infectedTiles.length === 0) {
		gs.time.clock.events.remove(this.crumbleTimer);
	}
};

Chap1Level.prototype.setupAlleyLight = function(i) {
	'use strict';

	var id = 'alley'+i.toString();
	this.triggers[id].onEnter.add(function() {
		this.gameState.toggleLights(id);
		this.triggers[id].onEnter.removeAll();
	}, this);
};


////////////////////////////////////////////////////////////////////////////
// Chapter II

function Chap2Level(gameState) {
	'use strict';
	
	Level.call(this, gameState, 'chap2');
}

Chap2Level.prototype = Object.create(Level.prototype);

Chap2Level.prototype.preload = function() {
	'use strict';

	Level.prototype.preload.call(this);

	var gs = this.gameState;

	gs.dagfin.load('json', "chap2_map_json", "assets/maps/chap2.json");
	gs.dagfin.load('json', "chap2_messages", "assets/texts/"+lang+"/chap2.json");

	gs.dagfin.load('image', "chap2_tileset", "assets/tilesets/basic.png");

	gs.dagfin.load('image', "note", "assets/sprites/note.png");
	gs.dagfin.load('image', "hourglass", "assets/sprites/sablier.png");
	gs.dagfin.load('image', "plante64", "assets/sprites/plante64.png");
	gs.dagfin.load('spritesheet', "switch", "assets/sprites/switch.png", 32,32);
};

Chap2Level.prototype.create = function() {
	'use strict';

	Level.prototype.create.call(this);

	var that = this;
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

	this.enablePlayerLight = false;
	this.enableNoisePass = true;

	gs.displayMessage("chap2_messages", "intro", true, function() {
		this.fade(true);
	}, this);

	gs.player.canPunch = false;

	gs.mobs[0].idle();
	this.triggers.dialog1.onEnter.addOnce(function() {
		gs.displayMessage("chap2_messages", "dialog1", true);
	}, this);

	this.triggers.dialog2.onEnter.addOnce(function() {
		gs.displayMessage("chap2_messages", "dialog2", true);
		gs.mobs[0].aggroPlayer();
	}, this);

	//FIXME: Some part of the dialogs can be factorized in the JSON file.
	// It's also possible to make it so the door noise triggers just before
	// the last dialog when picking up the hourglass, but I'm late as a rabbit.

	this.objects.hourglassNote.onEnter.addOnce(this.pickUpHourglassNote, this);
	this.objects.hourglass.onActivate.addOnce(this.pickUpHourglass, this);

	this.objects.importantNote.onEnter.addOnce(this.pickUpMessage, this);
	this.objects.scaredNote.onEnter.addOnce(this.pickUpMessage, this);

	// TODO: add a message telling that the switch is blocked if reactivated.
	this.objects.doorSwitch.body.setSize(24, 16);
	this.objects.doorSwitch.animations.add('toggle', null, 30);
	this.objects.doorSwitch.onActivate.addOnce(this.useDoorSwitch, this);

	this.objects.carnivorousPlant.body.setSize(32, 32, 0, 16);
	this.objects.carnivorousPlant.onActivate.add(this.pickUpPlant, this);

	this.triggers.exit.onEnter.add(function() {
		this.goToLevel('chap3');
	}, this);

	// Preload next chapter in background.
	Chap3Level.prototype.preload.call(this);
	gs.load.start();
};

Chap2Level.prototype.update = function() {
	'use strict';

	Level.prototype.update.call(this);
};

Chap2Level.prototype.render = function() {
	'use strict';

	Level.prototype.render.call(this);
};

Chap2Level.prototype.useDoorSwitch = function(obj) {
	'use strict';

	this.switchDoors("one");
	this.gameState.displayMessage("chap2_messages", "doorSwitch", true);
	obj.frame = 3;
	obj.animations.play('switch');
};

Chap2Level.prototype.pickUpHourglassNote = function(obj) {
	'use strict';

	var suffix = this.objects.hourglass.alive? 'First': 'Last';
	this.gameState.displayMessage("chap2_messages", "hourglassNote"+suffix, true,
								  obj.kill, obj);
}

Chap2Level.prototype.pickUpHourglass = function(obj) {
	'use strict';

	this.switchDoors("two");
	this.gameState.player.canPunch = true;
	var suffix = this.objects.hourglassNote.alive? 'First': 'Last';
	this.gameState.displayMessage("chap2_messages", "hourglass"+suffix, true,
								  obj.kill, obj);
}

Chap2Level.prototype.pickUpPlant = function(obj) {
	'use strict';

	this.gameState.askQuestion("chap2_messages", "carnivorousPlant", [
		function () {
			this.loot(obj);
		},
		null
	], this);
};

////////////////////////////////////////////////////////////////////////////
// Chapter III

function Chap3Level(gameState) {
	'use strict';
	
	Level.call(this, gameState, 'chap3');
}

Chap3Level.prototype = Object.create(Level.prototype);

Chap3Level.prototype.preload = function() {
	'use strict';

	Level.prototype.preload.call(this);

	var gs = this.gameState;

	gs.dagfin.load('json', "chap3_map_json", "assets/maps/chap3.json");
	gs.dagfin.load('json', "chap3_messages", "assets/texts/"+lang+"/chap3.json");
	
	gs.dagfin.load('image', "chap3_tileset", "assets/tilesets/basic.png");
	gs.dagfin.load('image', "spawn", "assets/tilesets/spawn.png");
	gs.dagfin.load('image', "spawn2", "assets/tilesets/spawn2.png");

	gs.dagfin.load('image', "note", "assets/sprites/note.png");
	gs.dagfin.load('image', "flame", "assets/sprites/flame.png");
	gs.dagfin.load('image', "chair", "assets/sprites/chair.png");
};

Chap3Level.prototype.create = function() {
	'use strict';

	Level.prototype.create.call(this);

	var that = this;
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

	this.enablePlayerLight = false;
	this.enableNoisePass = true;

	gs.displayMessage("chap3_messages", "intro", true, function() {
		this.fade(true);
	}, this);

	var that = this;

	this.objects.flame.onActivate.add(function(obj) {
		gs.displayMessage("chap3_messages", "flame", true, this.pickUpFlame, this, obj);
	}, this);

	this.objects.indice1.onEnter.add(this.pickUpMessage, this);
	this.objects.indice2.onEnter.add(this.pickUpMessage, this);
	this.objects.indice3.onEnter.add(this.pickUpMessage, this);

	this.objects.chair.body.setSize(32, 32, 0, 16);
	this.objects.chair.onActivate.add(this.pickUpChair, this);

	this.triggers.exit.onEnter.add(function() {
		this.goToLevel('boss');
	}, this);

	// Preload next chapter in background.
	BossLevel.prototype.preload.call(this);
	gs.load.start();
};

Chap3Level.prototype.update = function() {
	'use strict';

	Level.prototype.update.call(this);

	var gs = this.gameState;

	if(!this.objects.flame.alive) {
		gs.playerLight.normalLightSize -= gs.time.clock.elapsed / 12000;
		if(gs.playerLight.normalLightSize<1) {
			gs.playerLight.normalLightSize = 1;
		}

		// Maths:
		//  failure = a - b*lightSize
		//  b = maxFailure / (startSize - endSize)
		//  a = b * startSize
		gs.playerLight.powerFailure = 0.8333 - gs.playerLight.normalLightSize * .3333;

		gs.playerLight.lightSize = gs.playerLight.normalLightSize;
		if(Math.random() < gs.playerLight.powerFailure) {
			gs.playerLight.lightSize = 0;
		}

		if(gs.messageQueue.length === 0 && gs.k_use.triggered) {
			var pos = gs.player.facingPosition(USE_DIST);

			if(gs.map.getTileWorldXY(pos.x, pos.y, 32, 32, gs.mapLayer).index === 10) {
				this.restoreFlame();
			}
		}
	}
};

Chap3Level.prototype.render = function() {
	'use strict';

	Level.prototype.render.call(this);

	var gs = this.gameState;
};

Chap3Level.prototype.pickUpFlame = function(obj) {
	'use strict';

	obj.kill();
	this.restoreFlame();
	this.gameState.toggleLights('flame');
}

Chap3Level.prototype.restoreFlame = function(obj) {
	'use strict';

	this.gameState.playerLight.revive();
	this.gameState.playerLight.powerFailure = 0;
	this.gameState.playerLight.normalLightSize = 3;
};

Chap3Level.prototype.pickUpChair = function(obj) {
	'use strict';

	this.gameState.askQuestion("chap3_messages", "chair", [
		function() {
			this.loot(obj);
		},
		null
	], this);
}


////////////////////////////////////////////////////////////////////////////
// Boss

function BossLevel(gameState) {
	'use strict';
	
	Level.call(this, gameState, 'boss');
}

BossLevel.prototype = Object.create(Level.prototype);

BossLevel.prototype.preload = function() {
	'use strict';

	Level.prototype.preload.call(this);

	var gs = this.gameState;

	gs.dagfin.load('json', "boss_map_json", "assets/maps/boss.json");
	gs.dagfin.load('json', "boss_messages", "assets/texts/"+lang+"/ccl.json");
	
	gs.dagfin.load('image', "boss_tileset", "assets/tilesets/basic.png");
	gs.dagfin.load('image', "spawn2", "assets/tilesets/spawn2.png");
	gs.dagfin.load('image', "trone", "assets/sprites/trone.png");
	gs.dagfin.load('spritesheet', "slot", "assets/sprites/pillar_end.png", 32, 64);

	gs.dagfin.load('spritesheet', "dagfin", "assets/sprites/dagfin.png", DAGFIN_WIDTH, DAGFIN_DISPLAY_HEIGHT);
	gs.dagfin.load('spritesheet', "dagfin_warp", "assets/sprites/dagfin_warp.png", DAGFIN_WIDTH, DAGFIN_DISPLAY_HEIGHT);
	gs.dagfin.load('spritesheet', "matt", "assets/sprites/matt.png", 32, 48);
};

BossLevel.prototype.create = function() {
	'use strict';

	Level.prototype.create.call(this);

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
	gs.map.setCollision([ 1, 8, 10 ]);

	this.layersGroup = gs.game.add.group();

	gs.mapLayer = gs.map.createLayer("map", undefined, undefined, this.layersGroup);
	gs.mapLayer.resizeWorld();

	gs.overlayLayer = gs.map.createLayer("overlay", undefined, undefined, this.layersGroup);

	this.enablePlayerLight = false;
	this.enableNoisePass = true;

	this.STATE_BOSS = 0;
	this.STATE_MISSING = 1;
	this.STATE_WIN = 2;
	this.state = this.STATE_BOSS;

	this.slots = { 'blood': 1, 'clock': 2, 'carnivorousPlant': 3, 'collar': 4, 'chair': 5 };
	for(var name in this.slots) {
		var slot = this.objects[name];
		slot.y -= 16;
		slot.body.setSize(24, 24, 0, 16);
		slot.onActivate.add(this.activateSlot, this);
	}

	this.placed = {};

	this.fade(true);

	this.dagfinDood = new Dagfin(gs.game, TILE_SIZE*32, TILE_SIZE*9.5);
	
	this.dagfinWarp = gs.add.sprite(0, 0, 'dagfin_warp', 0);
	this.dagfinWarp.anchor.copyFrom(this.dagfinDood.anchor);
	this.dagfinWarpOut = this.dagfinWarp.animations.add('warpOut', null, 20);
	this.dagfinWarpIn = this.dagfinWarp.animations.add('warpIn', [ 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 ], 20);
	this.dagfinWarp.kill();

	this.triggers.boss.onEnter.addOnce(this.welcomeDialog, this);
	this.triggers.matt.onEnter.add(this.mattDialog, this);
};

BossLevel.prototype.update = function() {
	'use strict';

	Level.prototype.update.call(this);
};

BossLevel.prototype.render = function() {
	'use strict';

	Level.prototype.render.call(this);

//	var gs = this.gameState;
//	gs.depthGroup.forEach(function(body) {
//		gs.game.debug.body(body);
//	}, this);
//	gs.game.debug.geom(gs.player.facingPosition(USE_DIST), 'rgb(255, 0, 0)');
};

BossLevel.prototype.welcomeDialog = function() {
	'use strict';

	var startWarpIn = function() {
		this.dagfinDood.y = 22*32;
		this.dagfinWarp.y = this.dagfinDood.y;
		
		this.dagfinWarpIn.onComplete.addOnce(function() {
			this.dagfinDood.revive();
			this.dagfinDood.state = this.dagfinDood.AGGRO;
			
			this.dagfinWarp.kill();
		}, this);
		var anim = this.dagfinWarp.animations.play('warpIn');
	};

	var startWarpOut = function() {
		this.gameState.player.onDeath(function() {
			this.gameState.displayMessage("boss_messages", "death", true, this.displayDeathScreen, this);
		}, this);

		this.warpDagfinOut(startWarpIn, this);
	};

	this.gameState.askQuestion("boss_messages", "welcome", [
		startWarpOut,
		function() {
			this.gameState.player.kill();
		}
	], this);
}

BossLevel.prototype.warpDagfinOut = function(callback, context) {
	'use strict';

	this.dagfinDood.kill();

	this.dagfinWarp.x = this.dagfinDood.x;
	this.dagfinWarp.y = this.dagfinDood.y;
	this.dagfinWarp.revive();

	this.dagfinWarpOut.onComplete.addOnce(callback, context);
	this.dagfinWarp.animations.play('warpOut');
}

BossLevel.prototype.activateSlot = function(obj) {
	'use strict';

	var gs = this.gameState;

	if(this.dagfinDood.state === this.dagfinDood.WAITING || this.placed[obj.objName]) {
		return;
	}

	if(gs.dagfin.hasObject(obj.objName)) {
		this.placed[obj.objName] = true;
		obj.frame = this.slots[obj.objName];
		this.dagfinDood.ritualStepBehavior();
		this.checkVictory();
	}
	else {
		gs.displayMessage("boss_messages", obj.objName+'_missing');
		this.state = this.STATE_MISSING;
	}
};

BossLevel.prototype.checkVictory = function() {
	'use strict';

	var gs = this.gameState;

	if(this.placed.blood && this.placed.clock && this.placed.carnivorousPlant
			&& this.placed.collar && this.placed.chair) {
		this.dagfinDood.state = this.dagfinDood.WAITING;
		this.dagfinDood.body.velocity.set(0, 0);
		gs.depthGroup.forEach(function(dood) {
			if(dood instanceof Zombie) {
				dood.kill();
			}
		});
		gs.mobs.length = 0;
		this.state = this.STATE_WIN;
		gs.displayMessage("boss_messages", "win", true, function() {
			this.warpDagfinOut(this.dagfinWarp.kill, this.dagfinWarp);
		}, this);
	}
}

BossLevel.prototype.mattDialog = function(obj) {
	'use strict';

	var gs = this.gameState;

	switch(this.state) {
	case this.STATE_BOSS:
		gs.displayMessage("boss_messages", "matt_advice");
		break;
	case this.STATE_MISSING:
		gs.displayMessage("boss_messages", "matt_return", true, function() {
			this.goToLevel("chap1");
		}, this);
		break;
	case this.STATE_WIN:
		gs.askQuestion("boss_messages", "matt", [ this.startCredits, this.startCredits ], this);
		break;
	}
}

BossLevel.prototype.startCredits = function(obj) {
	'use strict';

	var gs = this.gameState;

	var blackScreen = gs.add.sprite(0, 0, 'black', 0, gs.postProcessGroup);
	blackScreen.scale.set(MAX_WIDTH, MAX_HEIGHT);
	blackScreen.alpha = 0;
	
	var tween = gs.add.tween(blackScreen);
	tween.to({ alpha: 1 }, 2000,
			 Phaser.Easing.Linear.None, true);
	tween.onComplete.add(function() {
		gs.game.state.start('Credits');
	});
}


////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
// MAIN !
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

var dagfin = new DagfinGame(MAX_WIDTH, MAX_HEIGHT, Phaser.AUTO, 'game');
