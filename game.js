var config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#2a2a2a",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 600 }, // how fast the player falls
      debug: false, // set to true to see physics boxes
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
};

var game = new Phaser.Game(config);

function preload() {
  // Tiled map and tileset image
  this.load.tilemapTiledJSON("level1", "maps/level1.tmj");
  this.load.image("terrain", "assets/2d/Terrain/Terrain (16x16).png");

  // Apple pickup image
  this.load.image("apple", "assets/2d/Items/Fruits/Apple_idle.png");

  // Pickup sound effect
  this.load.audio("pickup-sfx", "assets/audio/GameSFX/PickUp/Retro PickUp Coin 07.wav");

  // Checkpoint flag sprites (64x64 frames)
  this.load.spritesheet("flag-idle", "assets/2d/Items/Checkpoints/Checkpoint/Checkpoint (Flag Idle)(64x64).png", { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet("flag-out",  "assets/2d/Items/Checkpoints/Checkpoint/Checkpoint (Flag Out) (64x64).png",  { frameWidth: 64, frameHeight: 64 });

  // Player assets — defined in player.js
  playerPreload(this);
}

function create() {
  var scene = this; // alias used throughout create()

  // Build the tilemap from the loaded JSON file
  var map = this.make.tilemap({ key: "level1" });
  // 'Terrain' must match the tileset name inside level1.tmj
  var tileset = map.addTilesetImage("Terrain", "terrain");

  // ── Castle stone wall background ─────────────────────
  // Generate a tiling stone brick texture (96×64 px, 2 offset rows)
  var wallGfx = scene.make.graphics({ add: false });
  wallGfx.fillStyle(0x1e1e28); wallGfx.fillRect(0, 0, 96, 64); // mortar
  // Row 1
  wallGfx.fillStyle(0x484858); wallGfx.fillRect(1,  1, 44, 28);
  wallGfx.fillStyle(0x424252); wallGfx.fillRect(49, 1, 44, 28);
  // Row 2 (offset)
  wallGfx.fillStyle(0x404050); wallGfx.fillRect(1,  33, 20, 28);
  wallGfx.fillStyle(0x484858); wallGfx.fillRect(25, 33, 44, 28);
  wallGfx.fillStyle(0x424252); wallGfx.fillRect(73, 33, 22, 28);
  // Highlights (top edge of each stone)
  wallGfx.fillStyle(0x5c5c72, 0.6);
  wallGfx.fillRect(1, 1, 44, 2); wallGfx.fillRect(49, 1, 44, 2);
  wallGfx.fillRect(1, 33, 20, 2); wallGfx.fillRect(25, 33, 44, 2); wallGfx.fillRect(73, 33, 22, 2);
  // Shadows (bottom edge of each stone)
  wallGfx.fillStyle(0x10101a, 0.7);
  wallGfx.fillRect(1, 27, 44, 2); wallGfx.fillRect(49, 27, 44, 2);
  wallGfx.fillRect(1, 59, 20, 2); wallGfx.fillRect(25, 59, 44, 2); wallGfx.fillRect(73, 59, 22, 2);
  wallGfx.generateTexture("castle-wall", 96, 64);
  wallGfx.destroy();

  // Full-screen tileSprite pinned to the camera — tile position updated in update()
  // so it scrolls with the player across the infinite world
  this.bgWall = this.add.tileSprite(0, 0, window.innerWidth, window.innerHeight, "castle-wall")
    .setOrigin(0, 0).setScrollFactor(0).setDepth(-5);

  // Read the spawn position from the Tiled object layer
  var spawnLayer = map.getObjectLayer("spawnpoints");
  var spawn = spawnLayer.objects.find(function (obj) {
    return obj.name === "player";
  });

  // Create the player — pass null for groundLayer since we use platGroup now
  var PLAT1_X = 312; // center of first platform
  var PLAT1_Y = spawn.y - 138; // above first platform so player falls onto it
  var player = playerCreate(this, PLAT1_X, PLAT1_Y, null);

  // Respawn point — updated when player hits a checkpoint
  scene.respawnX = PLAT1_X;
  scene.respawnY = PLAT1_Y;

  // ── Pickups ──────────────────────────────────
  // Read all objects from the spawnpoints layer that have type "pickups"
  var pickupGroup = this.physics.add.staticGroup();
  spawnLayer.objects.forEach(function (obj) {
    if (obj.type === "pickups") {
      // Tiled tile-objects have their origin at bottom-left, so shift to center
      var sprite = pickupGroup.create(
        obj.x + obj.width / 2,
        obj.y - obj.height / 2,
        "apple"
      );
      // Read health_points from object properties if present, otherwise default to 10
      var hp = 10;
      if (obj.properties) {
        var hpProp = obj.properties.find(function (p) {
          return p.name === "health_points";
        });
        if (hpProp) hp = hpProp.value;
      }
      sprite.healthPoints = hp;
    }
  });

  // When the player overlaps an apple, flash it, remove it, and show popup text
  this.physics.add.overlap(player, pickupGroup, function (playerSprite, pickup) {
    var hp = pickup.healthPoints;
    var worldX = pickup.x;
    var worldY = pickup.y;

    // Disable physics body so this callback can't fire again for the same apple
    pickup.body.enable = false;

    // Play the pickup sound
    scene.sound.play("pickup-sfx");

    // Flash the apple: quickly blink alpha 3 times, then destroy it
    scene.tweens.add({
      targets: pickup,
      alpha: 0,
      duration: 80,       // each half-blink is 80ms
      yoyo: true,         // bounce back to alpha 1
      repeat: 2,          // 3 full blinks total
      onComplete: function () {
        pickup.destroy();
      }
    });

    // Show "+N Health!" text floating up from the apple's position, then fade out
    var popupText = scene.add.text(worldX, worldY - 20, "+" + hp + " Health!", {
      fontSize: "22px",
      color: "#00ff44",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5, 1);

    scene.tweens.add({
      targets: popupText,
      y: worldY - 80,     // floats upward
      alpha: 0,
      duration: 1200,     // 1.2 seconds — long enough to read, quick enough to feel snappy
      ease: "Power1",
      onComplete: function () {
        popupText.destroy();
      }
    });
  });
  // ─────────────────────────────────────────────

  // ── Castle level — horizontal path going right ──────────────
  var WORLD_W = 13000; // extended for level 2 underground section
  var WORLD_H = map.heightInPixels + 3200; // extra depth for level 2 below lava

  this.physics.world.setBounds(0, -1500, WORLD_W, WORLD_H);
  this.cameras.main.setBounds(0, -1500, WORLD_W, WORLD_H);

  // Camera follows player — slight horizontal lead so you can see ahead
  this.cameras.main.startFollow(player, true, 0.1, 0.1);
  this.cameras.main.setFollowOffset(-100, 0);

  // Static group — collider set once; every future platform added to the group
  // is automatically included without calling add.collider() again.
  var platGroup = this.physics.add.staticGroup();
  this.physics.add.collider(player, platGroup);

  var TILE = 32; // tile size used for platform placement

  // ── Scary bull painting textures (100×80 px, dark gold frame) ──────────
  function makeBullFrame(g, bgColor) {
    g.fillStyle(0x5a3a00); g.fillRect(0, 0, 100, 80); // outer dark frame
    g.fillStyle(0xd4a017); g.fillRect(3, 3, 94, 74);  // gold border
    g.fillStyle(0xb8860b); g.fillRect(5, 5, 90, 70);
    g.fillStyle(bgColor);  g.fillRect(7, 7, 86, 66);  // canvas
  }

  // Bull 1 — facing forward, angry
  var pg1 = scene.make.graphics({ add: false });
  makeBullFrame(pg1, 0x1a0a0a);
  pg1.fillStyle(0x2a1a0a); pg1.fillRect(28, 40, 44, 30); // body
  pg1.fillStyle(0x2a1a0a); pg1.fillRect(32, 22, 36, 24); // head
  pg1.fillStyle(0x3a2010); pg1.fillRect(35, 36, 30, 11); // snout
  pg1.fillStyle(0x111111); pg1.fillRect(38, 39, 6, 5); pg1.fillRect(56, 39, 6, 5); // nostrils
  pg1.fillStyle(0xffffff); pg1.fillRect(22, 10, 10, 16); pg1.fillRect(68, 10, 10, 16); // horns
  pg1.fillRect(18, 9, 12, 5); pg1.fillRect(70, 9, 12, 5); // horn tips
  pg1.fillStyle(0xff0000); pg1.fillRect(35, 24, 12, 9); pg1.fillRect(53, 24, 12, 9); // red eyes
  pg1.fillStyle(0x000000); pg1.fillRect(39, 27, 5, 5); pg1.fillRect(57, 27, 5, 5); // pupils
  pg1.fillStyle(0xff4400); pg1.fillRect(34, 22, 14, 3); pg1.fillRect(52, 22, 14, 3); // glow
  pg1.fillStyle(0x000000); pg1.fillRect(33, 21, 14, 4); pg1.fillRect(53, 21, 14, 4); // angry brow
  pg1.generateTexture("painting1", 100, 80); pg1.destroy();

  // Bull 2 — side profile, charging
  var pg2 = scene.make.graphics({ add: false });
  makeBullFrame(pg2, 0x0d0d1a);
  pg2.fillStyle(0x2a1a0a); pg2.fillRect(14, 32, 60, 32); // body
  pg2.fillRect(10, 24, 36, 22); // neck+head
  pg2.fillStyle(0xffffff); pg2.fillRect(8, 12, 8, 20); pg2.fillRect(6, 9, 12, 6); // front horn
  pg2.fillStyle(0xff0000); pg2.fillRect(13, 28, 12, 9); // eye
  pg2.fillStyle(0x000000); pg2.fillRect(16, 31, 5, 5); // pupil
  pg2.fillStyle(0xff4400); pg2.fillRect(12, 26, 14, 3); // glow
  pg2.fillStyle(0x000000); pg2.fillRect(12, 25, 14, 4); // brow
  pg2.fillStyle(0x3a2010); pg2.fillRect(8, 36, 14, 10); // snout
  pg2.fillStyle(0x111111); pg2.fillRect(9, 38, 4, 5); pg2.fillRect(15, 38, 4, 5); // nostrils
  pg2.fillStyle(0x555555); // motion lines
  pg2.fillRect(72, 32, 16, 3); pg2.fillRect(74, 40, 14, 3); pg2.fillRect(76, 48, 12, 3);
  pg2.generateTexture("painting2", 100, 80); pg2.destroy();

  // Bull 3 — close-up glowing eyes in darkness
  var pg3 = scene.make.graphics({ add: false });
  makeBullFrame(pg3, 0x050505);
  pg3.fillStyle(0x180e06); pg3.fillRect(15, 22, 70, 50); // barely-visible body
  pg3.fillStyle(0xff0000); pg3.fillRect(24, 28, 18, 14); pg3.fillRect(58, 28, 18, 14); // huge red eyes
  pg3.fillStyle(0xff6600); pg3.fillRect(19, 24, 28, 22); pg3.fillRect(53, 24, 28, 22); // outer glow
  pg3.fillStyle(0x000000); pg3.fillRect(29, 32, 7, 7); pg3.fillRect(63, 32, 7, 7); // pupils
  pg3.fillStyle(0xffffff); pg3.fillRect(22, 9, 10, 22); pg3.fillRect(68, 9, 10, 22); // horns
  pg3.fillRect(18, 7, 14, 7); pg3.fillRect(68, 7, 14, 7);
  pg3.fillStyle(0x3a1a0a); pg3.fillRect(35, 54, 10, 7); pg3.fillRect(55, 54, 10, 7); // nostrils
  pg3.fillStyle(0x000000); pg3.fillRect(36, 55, 6, 5); pg3.fillRect(56, 55, 6, 5);
  pg3.generateTexture("painting3", 100, 80); pg3.destroy();

  // Array to track world-space paintings for culling
  var paintings = [];

  // ── Green breakable blocks ──────────────────────────────
  // Dark castle stone breakable block — same brick pattern as wall but even darker,
  // with a subtle crack to hint it can be smashed.
  var bkGfx = scene.make.graphics({ add: false });
  // Very dark mortar
  bkGfx.fillStyle(0x080810); bkGfx.fillRect(0, 0, 16, 16);
  // Two rows of bricks (offset, matching the castle wall pattern at 16px scale)
  bkGfx.fillStyle(0x181828); bkGfx.fillRect(1, 1,  6, 6);
  bkGfx.fillStyle(0x161626); bkGfx.fillRect(9, 1,  6, 6);
  bkGfx.fillStyle(0x141424); bkGfx.fillRect(1, 9,  3, 6);
  bkGfx.fillStyle(0x181828); bkGfx.fillRect(6, 9,  6, 6);
  bkGfx.fillStyle(0x161626); bkGfx.fillRect(14,9,  1, 6);
  // Subtle top highlight on each brick
  bkGfx.fillStyle(0x2a2a40);
  bkGfx.fillRect(1,1,6,1); bkGfx.fillRect(9,1,6,1);
  bkGfx.fillRect(1,9,3,1); bkGfx.fillRect(6,9,6,1);
  // Crack lines (white-ish, faint) so it reads as breakable
  bkGfx.lineStyle(1, 0x555566, 0.9);
  bkGfx.lineBetween(8, 2, 6, 7);
  bkGfx.lineBetween(6, 7, 9, 13);
  bkGfx.generateTexture("break-block", 16, 16);
  bkGfx.destroy();

  // ── Cave platform texture — light sandy limestone, easy to see in dark ──
  var caveGfx = scene.make.graphics({ add: false });
  caveGfx.fillStyle(0x998866); caveGfx.fillRect(0, 0, 16, 16); // warm tan mortar
  caveGfx.fillStyle(0xc8aa77); caveGfx.fillRect(1, 1, 6, 6);   // stone brick A
  caveGfx.fillStyle(0xbba06e); caveGfx.fillRect(9, 1, 6, 6);   // stone brick B
  caveGfx.fillStyle(0xc0a070); caveGfx.fillRect(1, 9, 3, 6);   // stone brick C
  caveGfx.fillStyle(0xc8aa77); caveGfx.fillRect(6, 9, 6, 6);   // stone brick D
  caveGfx.fillStyle(0xbba06e); caveGfx.fillRect(14,9, 1, 6);
  // Bright highlight on top edge of each brick
  caveGfx.fillStyle(0xeeddaa);
  caveGfx.fillRect(1,1,6,1); caveGfx.fillRect(9,1,6,1);
  caveGfx.fillRect(1,9,3,1); caveGfx.fillRect(6,9,6,1);
  // Shadow on bottom edge
  caveGfx.fillStyle(0x886644, 0.7);
  caveGfx.fillRect(1,6,6,1); caveGfx.fillRect(9,6,6,1);
  caveGfx.fillRect(1,14,3,1); caveGfx.fillRect(6,14,6,1);
  caveGfx.generateTexture("cave-block", 16, 16);
  caveGfx.destroy();

  // Group that holds all green blocks
  var breakGroup = this.physics.add.staticGroup();

  // Normal collider — player can stand on / bump into blocks when NOT boosting
  var breakCollider = this.physics.add.collider(player, breakGroup, function (p, block) {
    if (!p.isBoosting) return; // only smash when boosting

    // Disable immediately so this fires only once
    block.body.enable = false;

    // Explosion of green shards
    for (var s = 0; s < 8; s++) {
      (function(si) {
        var shard = scene.add.rectangle(
          block.x + (Math.random() - 0.5) * 8,
          block.y + (Math.random() - 0.5) * 8,
          4 + Math.random() * 4, 4 + Math.random() * 4,
          0x181828
        ).setDepth(15);
        scene.tweens.add({
          targets: shard,
          x: shard.x + (Math.random() - 0.5) * 60,
          y: shard.y - 20 - Math.random() * 40,
          angle: Math.random() * 360,
          alpha: 0,
          duration: 400 + si * 30,
          onComplete: function() { shard.destroy(); }
        });
      })(s);
    }
    // Flash text
    var smashText = scene.add.text(block.x, block.y - 10, "SMASH!", {
      fontSize: "11px", color: "#ffffff",
      stroke: "#004400", strokeThickness: 3
    }).setDepth(20).setOrigin(0.5);
    scene.tweens.add({
      targets: smashText, y: smashText.y - 24, alpha: 0,
      duration: 700, onComplete: function() { smashText.destroy(); }
    });

    block.destroy();
  });

  // ── Hand-crafted castle level — path going right ─────────────
  // Helper: place a 2-tile-deep ledge at left edge px, top py, numTiles wide
  function plat(px, py, numTiles) {
    for (var t = 0; t < numTiles; t++) {
      platGroup.create(px + t*TILE + TILE/2, py + TILE/2,        "break-block").setDisplaySize(TILE, TILE).refreshBody();
      platGroup.create(px + t*TILE + TILE/2, py + TILE + TILE/2, "break-block").setDisplaySize(TILE, TILE).refreshBody();
    }
  }

  var gnd = spawn.y + 8; // ground Y reference (player spawns standing on floor)

  // Section 1 — gentle opening steps
  plat(280,  gnd - 96,  7);
  plat(580,  gnd - 160, 5);
  plat(840,  gnd - 96,  8);
  // Section 2 — castle corridor rising
  plat(1150, gnd - 192, 6);
  plat(1440, gnd - 128, 5);
  plat(1700, gnd - 224, 7);
  plat(2050, gnd - 160, 5);
  // Section 3 — tower climb
  plat(2310, gnd - 256, 4);
  plat(2530, gnd - 192, 8);
  plat(2930, gnd - 288, 5);
  plat(3180, gnd - 224, 4);
  // Section 4 — descent and final run
  plat(3440, gnd - 160, 6);
  plat(3740, gnd - 96,  5);
  plat(4000, gnd - 192, 7);
  plat(4320, gnd - 128, 8);
  plat(4720, gnd - 64,  10);

  // ── Section 5: Lava Crossing ─────────────────────────────────
  // Moving stone platforms that swing left and right over the lava.
  // onUpdate: sprite.refreshBody() keeps the physics body synced each frame.
  var movingGroup = scene.physics.add.staticGroup();
  scene.physics.add.collider(player, movingGroup);

  function movingPlat(cx, cy, wTiles, swingDist, duration) {
    for (var t = 0; t < wTiles; t++) {
      // Space tiles evenly, centered around cx
      var tx = cx + (t - Math.floor(wTiles / 2)) * TILE;
      // Top tile
      (function(spr) {
        var sx = spr.x;
        scene.tweens.add({
          targets: spr, x: sx + swingDist,
          duration: duration, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
          onUpdate: function() { spr.refreshBody(); }
        });
      })(movingGroup.create(tx, cy, "break-block").setDisplaySize(TILE, TILE).refreshBody());
      // Bottom tile
      (function(spr) {
        var sx = spr.x;
        scene.tweens.add({
          targets: spr, x: sx + swingDist,
          duration: duration, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
          onUpdate: function() { spr.refreshBody(); }
        });
      })(movingGroup.create(tx, cy + TILE, "break-block").setDisplaySize(TILE, TILE).refreshBody());
    }
  }

  // LAVA_Y = gnd + 22. Platform = 2 tiles tall (64px).
  // cy = gnd - 10 → top 32px above lava, bottom 32px below — exactly half submerged.
  var lx = 5100; // lava crossing start X
  movingPlat(lx + 220,  gnd - 10, 3, 120, 2200);
  movingPlat(lx + 600,  gnd - 12, 2, 100, 1800);
  movingPlat(lx + 980,  gnd - 8,  3, 140, 2500);
  movingPlat(lx + 1370, gnd - 11, 3, 110, 1600);
  movingPlat(lx + 1770, gnd - 9,  4, 130, 2800);
  movingPlat(lx + 2200, gnd - 12, 2, 120, 2000);
  movingPlat(lx + 2580, gnd - 8,  3, 150, 1900);
  movingPlat(lx + 2970, gnd - 10, 2, 140, 2400);
  // Safe landing platform at the end of the lava crossing
  plat(lx + 3250, gnd - 64, 10);

  // ── Section 6: Wall Jump Shaft ────────────────────────────────
  // Two vertical walls only — pure wall jump to climb, no rest ledges.
  var wx         = lx + 3250 + 10 * TILE + 16;
  var shaftInner = 288;   // 9 tiles gap between walls
  var shaftH     = 40;    // 40 tiles tall (1280px)
  var openH      = 8;     // bottom opening so player walks in from the left
  var shaftTop   = gnd - shaftH * TILE;

  // Helper: stack a 1-tile-wide column of platform tiles downward from topY
  function wallCol(wallX, topY, numHigh) {
    for (var r = 0; r < numHigh; r++) {
      platGroup.create(wallX + TILE/2, topY + r*TILE + TILE/2, "break-block")
        .setDisplaySize(TILE, TILE).refreshBody();
    }
  }

  // Left wall — gap at the bottom so player can walk in
  wallCol(wx, shaftTop, shaftH - openH);
  // Right wall — full height
  wallCol(wx + TILE + shaftInner, shaftTop, shaftH);

  // Entry floor connects safe platform into the shaft
  plat(wx + TILE, gnd - 64, 9);
  // Exit platform at the top
  plat(wx + 2*TILE + shaftInner, shaftTop - TILE, 14);

  // ── Section 7: Teleport Pad (top of wall jump shaft exit) ─────
  // A glowing purple pad on the exit platform warps the player down to Level 2.
  var exitPlatCX  = wx + 2*TILE + shaftInner + 7*TILE; // center of exit platform
  var exitPlatTopY = shaftTop - TILE;                   // top surface y of exit platform

  // Level 2 underground spawn position
  var lvl2SpawnX = exitPlatCX + 200;
  var lvl2SpawnY = 880; // well below lava

  // ── Draw teleport pad — glowing purple circle ──────────────
  var padGfx = scene.make.graphics({ add: false });
  padGfx.fillStyle(0x220033);
  padGfx.fillEllipse(32, 12, 64, 24); // dark base
  padGfx.fillStyle(0x9900ff, 0.5);
  padGfx.fillEllipse(32, 12, 60, 20); // glow fill
  padGfx.lineStyle(2, 0xcc44ff);
  padGfx.strokeEllipse(32, 12, 60, 20); // bright rim
  // Rune marks
  padGfx.lineStyle(1, 0xee88ff, 0.7);
  padGfx.strokeEllipse(32, 12, 44, 14);
  padGfx.generateTexture("telepad", 64, 24);
  padGfx.destroy();

  var padSprite = scene.add.image(exitPlatCX, exitPlatTopY - 2, "telepad")
    .setDepth(6).setOrigin(0.5, 1);
  // Pulse the pad
  scene.tweens.add({
    targets: padSprite, scaleX: 1.1, scaleY: 1.15, alpha: 0.75,
    duration: 750, yoyo: true, repeat: -1, ease: "Sine.easeInOut"
  });

  // Floating label above the pad
  var padLabel = scene.add.text(exitPlatCX, exitPlatTopY - 30, "LEVEL 2 ▼",
    { fontSize: "12px", color: "#cc44ff", stroke: "#000", strokeThickness: 3, fontFamily: "monospace" }
  ).setOrigin(0.5, 1).setDepth(7);
  scene.tweens.add({
    targets: padLabel, y: padLabel.y - 5,
    duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut"
  });

  // Invisible overlap zone the player walks into
  var padZone = scene.add.zone(exitPlatCX, exitPlatTopY - 16, 72, 40);
  scene.physics.add.existing(padZone);
  padZone.body.allowGravity = false;

  var teleporting = false;
  scene.physics.add.overlap(player, padZone, function() {
    if (teleporting || player.isDying) return;
    teleporting = true;

    // White flash screen → move player → fade back in
    var flash = scene.add.rectangle(
      window.innerWidth / 2, window.innerHeight / 2,
      window.innerWidth, window.innerHeight, 0xffffff
    ).setScrollFactor(0).setDepth(400).setAlpha(0);

    scene.tweens.add({
      targets: flash, alpha: 1, duration: 300,
      onComplete: function() {
        // Move player to Level 2 landing spot
        player.setPosition(lvl2SpawnX, lvl2SpawnY);
        player.setVelocity(0, 0);
        player.jumpsLeft = 2;
        scene.respawnX = lvl2SpawnX;
        scene.respawnY = lvl2SpawnY;

        scene.tweens.add({
          targets: flash, alpha: 0, duration: 400,
          onComplete: function() {
            flash.destroy();
            teleporting = false;

            // "LEVEL 2" banner fades in then out
            var banner = scene.add.text(
              window.innerWidth / 2, window.innerHeight / 2 - 30, "LEVEL 2",
              { fontSize: "52px", color: "#cc44ff", stroke: "#000", strokeThickness: 7, fontFamily: "monospace" }
            ).setScrollFactor(0).setDepth(300).setOrigin(0.5).setAlpha(0);
            var sub = scene.add.text(
              window.innerWidth / 2, window.innerHeight / 2 + 30, "the underground",
              { fontSize: "18px", color: "#aa88ff", stroke: "#000", strokeThickness: 4, fontFamily: "monospace" }
            ).setScrollFactor(0).setDepth(300).setOrigin(0.5).setAlpha(0);
            scene.tweens.add({
              targets: [banner, sub], alpha: 1, duration: 400, hold: 1500,
              onComplete: function() {
                scene.tweens.add({
                  targets: [banner, sub], alpha: 0, duration: 500,
                  onComplete: function() { banner.destroy(); sub.destroy(); }
                });
              }
            });
          }
        });
      }
    });
  });

  // ── Level 2: Underground Cave ─────────────────────────────────
  // Dark cave background slab — tall enough to contain the full cave
  scene.add.rectangle(exitPlatCX + 1500, 1280, 3200, 900, 0x0a0a14)
    .setDepth(-4).setAlpha(0.92);

  // Cave platforms — light cave-block texture so they're visible in the dark
  var cx  = exitPlatCX + 60;  // cave section start X
  var cgy = 1380;             // cave ground level Y — pushed deep so lava is far above

  // Helper: place a 2-tile-deep ledge using the bright cave-block texture
  function cavePlat(px, py, numTiles) {
    for (var t = 0; t < numTiles; t++) {
      platGroup.create(px + t*TILE + TILE/2, py + TILE/2,        "cave-block").setDisplaySize(TILE, TILE).refreshBody();
      platGroup.create(px + t*TILE + TILE/2, py + TILE + TILE/2, "cave-block").setDisplaySize(TILE, TILE).refreshBody();
    }
  }

  // Landing platform directly under the teleport destination
  cavePlat(cx - 2*TILE, cgy, 8);

  // Cave path going right with varied heights
  cavePlat(cx + 360,  cgy - 80,  5);
  cavePlat(cx + 660,  cgy + 32,  6);
  cavePlat(cx + 1010, cgy - 48,  4);
  cavePlat(cx + 1300, cgy - 128, 7);
  cavePlat(cx + 1680, cgy - 64,  5);
  cavePlat(cx + 2000, cgy - 96,  4);
  cavePlat(cx + 2300, cgy - 32,  6);
  cavePlat(cx + 2640, cgy - 80,  5);
  // Final wide platform — end of level 2
  cavePlat(cx + 2980, cgy - 48, 14);

  // Stalactite drips (decorative rectangles hanging from cave ceiling)
  var caveRoof = cgy - 500; // ceiling is 500px above cave floor — lots of headroom
  [cx+80, cx+240, cx+500, cx+730, cx+1050, cx+1400, cx+1750, cx+2100, cx+2450, cx+2750].forEach(function(sx) {
    var stalH = 40 + Math.floor(Math.random() * 60);
    scene.add.rectangle(sx, caveRoof + stalH/2, 8, stalH, 0x224422).setDepth(-3);
    scene.add.rectangle(sx, caveRoof + stalH, 14, 6, 0x335533).setDepth(-3); // tip
  });

  // Glowing mushroom lights at platform edges (decorative)
  [cx+30, cx+400, cx+700, cx+1060, cx+1350, cx+1720, cx+2010, cx+2340, cx+2660].forEach(function(mx) {
    var myc = scene.add.circle(mx, cgy - 96, 5, 0x44ff88, 0.7).setDepth(-2);
    scene.tweens.add({ targets: myc, alpha: 0.2, duration: 800 + Math.random()*600, yoyo: true, repeat: -1 });
  });

  // ── Checkpoint flag ───────────────────────────────────────────
  // Placed on top of the safe landing platform (center-ish)
  var flagX = lx + 3250 + 3 * TILE; // a few tiles in from the left edge
  var flagY = gnd - 64 - 32;        // 64px platform top, flag center 32px above that

  scene.anims.create({
    key: "flag-idle-anim",
    frames: scene.anims.generateFrameNumbers("flag-idle", { start: 0, end: 9 }),
    frameRate: 10,
    repeat: -1
  });
  scene.anims.create({
    key: "flag-out-anim",
    frames: scene.anims.generateFrameNumbers("flag-out", { start: 0, end: 25 }),
    frameRate: 16,
    repeat: 0
  });

  var flagSprite = scene.physics.add.sprite(flagX, flagY, "flag-idle").play("flag-idle-anim");
  flagSprite.setTint(0xff4444); // red until claimed
  flagSprite.body.allowGravity = false;
  flagSprite.body.immovable = true;
  flagSprite.setDepth(10);

  scene.physics.add.overlap(player, flagSprite, function() {
    if (flagSprite.activated) return;
    flagSprite.activated = true;
    flagSprite.play("flag-out-anim");
    flagSprite.setTint(0x44ff88); // turn green when claimed
    // Once the flag-out animation finishes, loop the idle again
    flagSprite.once("animationcomplete", function() {
      flagSprite.play("flag-idle-anim");
    });
    // Update respawn to just above this platform
    scene.respawnX = flagX;
    scene.respawnY = flagY - 20;
    // Flash a small "CHECKPOINT" message
    var cpText = scene.add.text(flagX, flagY - 60, "CHECKPOINT!",
      { fontSize: "16px", color: "#00ff88", stroke: "#000", strokeThickness: 4, fontFamily: "monospace" }
    ).setOrigin(0.5).setDepth(200);
    scene.tweens.add({ targets: cpText, y: cpText.y - 30, alpha: 0, duration: 1200, onComplete: function() { cpText.destroy(); } });
  });

  // Bull paintings at fixed scenic spots along the castle wall
  [
    { x: 440,  y: gnd - 220, k: 1 },
    { x: 1020, y: gnd - 260, k: 2 },
    { x: 1900, y: gnd - 320, k: 3 },
    { x: 2750, y: gnd - 360, k: 1 },
    { x: 3900, y: gnd - 280, k: 2 },
  ].forEach(function(s) {
    scene.add.image(s.x, s.y, "painting" + s.k).setDepth(-3);
  });

  // ── Lava ─────────────────────────────────────
  var LAVA_Y = spawn.y + 30; // sits just below the original ground level

  // Draw a small 256px-wide lava tile that repeats across the whole world
  var lavaGfx = scene.make.graphics({ add: false });
  lavaGfx.fillStyle(0xaa1100); lavaGfx.fillRect(0, 0, 256, 400);
  for (var li = 0; li < 5; li++) {
    lavaGfx.fillStyle((li % 2 === 0) ? 0xcc2200 : 0xff4400, 0.5);
    lavaGfx.fillRect(0, li * 80, 256, 40);
  }
  lavaGfx.generateTexture("lava-base", 256, 400);
  lavaGfx.destroy();

  scene.add.tileSprite(WORLD_W/2, LAVA_Y + 200, WORLD_W, 400, "lava-base").setDepth(50);
  scene.add.rectangle(WORLD_W/2, LAVA_Y,     WORLD_W, 6, 0xff6600).setDepth(53);
  scene.add.rectangle(WORLD_W/2, LAVA_Y + 5, WORLD_W, 3, 0xffaa00).setDepth(54);

  // Invisible hitbox for death detection
  var lavaHitbox = scene.add.rectangle(WORLD_W/2, LAVA_Y, WORLD_W, 20, 0xff0000, 0).setDepth(55);
  scene.physics.add.existing(lavaHitbox);
  lavaHitbox.body.allowGravity = false;
  lavaHitbox.body.immovable    = true;

  scene.physics.add.overlap(player, lavaHitbox, function() {
    if (player.isDying) return;
    player.isDying = true;

    // Dark overlay
    var overlay = scene.add.rectangle(
      window.innerWidth/2, window.innerHeight/2,
      window.innerWidth, window.innerHeight, 0x000000
    ).setScrollFactor(0).setDepth(300).setAlpha(0);

    scene.tweens.add({
      targets: overlay, alpha: 0.75, duration: 400,
      onComplete: function() {
        var diedText = scene.add.text(
          window.innerWidth/2, window.innerHeight/2 - 40,
          "YOU DIED",
          { fontSize: "52px", color: "#ff2200", stroke: "#000", strokeThickness: 6, fontFamily: "monospace" }
        ).setScrollFactor(0).setDepth(301).setOrigin(0.5).setAlpha(0);

        var restartText = scene.add.text(
          window.innerWidth/2, window.innerHeight/2 + 40,
          "Press W to restart",
          { fontSize: "18px", color: "#ffdd00", stroke: "#000", strokeThickness: 3, fontFamily: "monospace" }
        ).setScrollFactor(0).setDepth(301).setOrigin(0.5).setAlpha(0);

        scene.tweens.add({ targets: [diedText, restartText], alpha: 1, duration: 300 });

        scene.input.keyboard.once("keydown-W", function() {
          scene.tweens.add({
            targets: [overlay, diedText, restartText],
            alpha: 0, duration: 300,
            onComplete: function() { overlay.destroy(); diedText.destroy(); restartText.destroy(); }
          });
          player.setPosition(scene.respawnX, scene.respawnY);
          player.setVelocity(0, 0);
          player.jumpsLeft = 2;
          player.isDying = false;
        });
      }
    });
  });

  // WASD input
  var KB = Phaser.Input.Keyboard.KeyCodes;
  this.wasd = {
    up:    this.input.keyboard.addKey(KB.W),
    down:  this.input.keyboard.addKey(KB.S),
    left:  this.input.keyboard.addKey(KB.A),
    right: this.input.keyboard.addKey(KB.D),
  };

  // Space key for charge boost
  this.spaceKey = this.input.keyboard.addKey(KB.SPACE);

  // F key — fly cheat code
  this.fKey = this.input.keyboard.addKey(KB.F);
  this.flyMode = false;
  this.flyLabel = this.add.text(window.innerWidth - 16, 12, "FLY MODE",
    { fontSize: "16px", color: "#00ffff", stroke: "#000", strokeThickness: 4, fontFamily: "monospace" }
  ).setScrollFactor(0).setDepth(200).setOrigin(1, 0).setVisible(false);

  // Attach to the scene so update() can access them
  this.player = player;
}

function update() {
  // Scroll the castle wall to match the camera
  this.bgWall.tilePositionY = this.cameras.main.scrollY;
  this.bgWall.tilePositionX = this.cameras.main.scrollX;

  // ── Fly cheat (F key toggles) ──────────────────────────────────────
  var p = this.player;
  if (Phaser.Input.Keyboard.JustDown(this.fKey)) {
    this.flyMode = !this.flyMode;
    p.body.allowGravity = !this.flyMode;
    if (!this.flyMode) { p.body.setVelocityY(0); } // stop floating when turned off
    this.flyLabel.setVisible(this.flyMode);
  }

  if (this.flyMode) {
    p.body.setVelocityY(0); // cancel gravity each frame
    if (this.wasd.up.isDown)   { p.body.setVelocityY(-1400); }
    if (this.wasd.down.isDown) { p.body.setVelocityY(1400);  }
  }

  // Movement and animation — defined in player.js
  playerUpdate(this.player, this.wasd, this.spaceKey);

  // Override X velocity AFTER playerUpdate so fly speed wins
  if (this.flyMode) {
    if (this.wasd.left.isDown)  { p.body.setVelocityX(-1400); }
    if (this.wasd.right.isDown) { p.body.setVelocityX(1400);  }
  }
}
