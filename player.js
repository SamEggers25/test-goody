// ─────────────────────────────────────────────
//  player.js — Cow with gold chain player character
//  Edit this file to change how the player looks and feels.
// ─────────────────────────────────────────────

// ── Tuning values ──────────────────────────────
var PLAYER_SPEED = 260; // horizontal move speed (pixels/sec)
var PLAYER_JUMP = -500; // jump velocity — more negative = higher jump
var PLAYER_DOUBLE_JUMP = -400; // double jump velocity (slightly weaker than first jump)
var PLAYER_CHAR = "Ninja Frog"; // folder name inside assets/2d/Main Characters/
var PLAYER_SCALE = 1.8; // scale multiplier for sprite size

// Super jump — hold Space on the ground to charge, release to launch upward
var SUPER_JUMP_MAX_TIME = 900;   // ms to reach full charge
var SUPER_JUMP_MIN      = -550;  // upward velocity on a quick tap
var SUPER_JUMP_MAX      = -1200; // upward velocity at full charge

// Hitbox size — smaller than the 32x32 sprite frame to avoid snagging on tile corners
// and to give the player a "generous" feel (hazards must clearly overlap to register).
// Turn on debug: true in game.js to see the green hitbox while tuning these.
var PLAYER_HITBOX_WIDTH = 16;    // local px wide  → 29px world at scale 1.8
var PLAYER_HITBOX_HEIGHT = 28;   // local px tall  → 50px world at scale 1.8
var PLAYER_HITBOX_OFFSET_X = 8;  // center 16px body in 32px frame: (32-16)/2
var PLAYER_HITBOX_OFFSET_Y = 4;  // small gap at top of frame, feet flush at bottom

// Crouched hitbox — shorter than standing; offsetY keeps feet planted on the ground.
// Rule: CROUCH_OFFSET_Y = HITBOX_OFFSET_Y + (HITBOX_HEIGHT - CROUCH_HEIGHT)
var PLAYER_CROUCH_HEIGHT = 16;   // local px tall while crouching
var PLAYER_CROUCH_OFFSET_Y = 16; // = 4 + (28 - 16)

// ── Asset loading ──────────────────────────────
// Called from preload() in game.js
// Cow textures are drawn with Phaser Graphics in playerCreate — only audio loads here.
function playerPreload(scene) {
  scene.load.audio("jump-sfx",   "assets/audio/GameSFX/Bounce Jump/Retro Jump Simple C2 02.wav");
  scene.load.audio("charge-sfx", "assets/audio/GameSFX/Ascending/Retro Ascending Long 06.wav");
}

// ── Draw the cow character (multi-frame spritesheet baked into a canvas) ──────
// Each animation state gets several frames drawn side-by-side into one texture.
// Frame size: 32×32 px. All textures use "player-cow" as the key and different
// frame ranges for each animation.
//
// Frame layout:
//   0-3   idle  (body bob up/down + tail swish)
//   4-7   run   (leg pairs alternate, body bounces)
//   8     jump  (legs tucked)
//   9     fall  (legs splayed, worried eyes)
//   10    charge-ready (head lowered, steam lines)
//   11    wall-slide  (cow tilted, legs braced against wall)
function createCowTextures(scene) {
  var FRAME_W = 32;
  var FRAME_H = 32;
  var TOTAL_FRAMES = 12;  // added wall-slide frame

  var canvas = scene.textures.createCanvas("player-cow", FRAME_W * TOTAL_FRAMES, FRAME_H);
  var ctx = canvas.getContext();

  // Helper: draw one cow frame at x offset `ox`, y offset 0
  // opts: { legPhase: 0|1, bodyOY: 0..2, eyeOpen: bool, headLow: bool,
  //         tailAngle: deg, steamLines: bool, legSplay: bool }
  function drawCow(ox, opts) {
    var o = opts || {};
    var bodyOY  = o.bodyOY  || 0;     // body vertical wobble offset
    var legPh   = o.legPhase || 0;    // 0 = legs A down, 1 = legs B down
    var headLow = o.headLow || false; // head pitched forward for charge
    var splay   = o.legSplay || false;// legs splayed (falling)
    var steam   = o.steam   || false; // steam puffs from nose
    var chargeGlow = o.chargeGlow || false;

    var bx = ox + 16; // body centre x
    var by = 22 + bodyOY; // body centre y

    // ── Gold chain glow aura ──────────────────
    if (chargeGlow) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#ffd700";
      ctx.beginPath();
      ctx.ellipse(bx, by - 4, 14, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Body ──────────────────────────────────
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(bx, by, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Black body spots
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.ellipse(bx - 5, by - 1, 4, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + 4, by + 2, 3, 2, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // ── Gold chain across chest ───────────────
    var chainY = by - 4;
    var links = [bx - 7, bx - 3, bx + 1, bx + 5];
    links.forEach(function(lx) {
      ctx.fillStyle = "#ffd700";
      ctx.beginPath();
      ctx.ellipse(lx, chainY, 2.5, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b8860b";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });
    // Pendant
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.moveTo(bx, chainY + 2);
    ctx.lineTo(bx + 3, chainY + 6);
    ctx.lineTo(bx - 3, chainY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fffde0";
    ctx.beginPath();
    ctx.ellipse(bx, chainY + 4, 1, 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Tail ──────────────────────────────────
    var tailAngle = (o.tailAngle || 0) * Math.PI / 180;
    var tx = bx + 10;
    var ty = by - 2;
    ctx.strokeStyle = "#dddddd";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(
      tx + 5 * Math.cos(tailAngle - 0.5),
      ty - 6 + 3 * Math.sin(tailAngle),
      tx + 4 * Math.cos(tailAngle),
      ty - 8 * Math.abs(Math.sin(tailAngle + 0.8))
    );
    ctx.stroke();
    // Tuft
    ctx.fillStyle = "#cccccc";
    ctx.beginPath();
    ctx.ellipse(
      tx + 4 * Math.cos(tailAngle),
      ty - 8 * Math.abs(Math.sin(tailAngle + 0.8)),
      2.5, 2.5, 0, 0, Math.PI * 2
    );
    ctx.fill();

    // ── Legs ──────────────────────────────────
    // Front pair (left in frame) and back pair
    var legBaseY = by + 6;
    var legPairs = [
      { x: bx - 5, front: true  },
      { x: bx + 4, front: false }
    ];
    legPairs.forEach(function(pair) {
      // Alternate which leg in pair is raised
      var raise = splay ? -3 : (legPh === (pair.front ? 0 : 1) ? -4 : 0);
      var lx1 = pair.x - 2;
      var lx2 = pair.x + 2;

      // Back leg of pair lower, front raised
      ctx.fillStyle = "#eeeeee";
      ctx.fillRect(lx1, legBaseY,          2, 5 + raise * 0.5);
      ctx.fillRect(lx2, legBaseY - raise, 2, 5 - raise * 0.5);

      // Hooves
      ctx.fillStyle = "#222222";
      ctx.fillRect(lx1, legBaseY + 5 + raise * 0.5 - 2,  2, 2);
      ctx.fillRect(lx2, legBaseY + 5 - raise * 0.5 - 2 - raise, 2, 2);
    });

    // ── Ears ──────────────────────────────────
    var headX = headLow ? bx - 2 : bx;
    var headY = headLow ? by - 10 : by - 13;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(headX - 7, headY + 2, 4, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb3ba";
    ctx.beginPath();
    ctx.ellipse(headX - 7, headY + 2, 2.5, 1.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(headX + 7, headY + 2, 4, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb3ba";
    ctx.beginPath();
    ctx.ellipse(headX + 7, headY + 2, 2.5, 1.5, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // ── Head ──────────────────────────────────
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(headX, headY, 9, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Black patch
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.ellipse(headX + 3, headY - 2, 4, 3.5, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // ── Horns ─────────────────────────────────
    ctx.fillStyle = "#d4a56a";
    ctx.beginPath();
    ctx.moveTo(headX - 5, headY - 6);
    ctx.lineTo(headX - 8, headY - 11);
    ctx.lineTo(headX - 2, headY - 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(headX + 5, headY - 6);
    ctx.lineTo(headX + 8, headY - 11);
    ctx.lineTo(headX + 2, headY - 8);
    ctx.closePath();
    ctx.fill();

    // ── Snout ─────────────────────────────────
    ctx.fillStyle = "#ffb3ba";
    ctx.beginPath();
    ctx.ellipse(headX, headY + 5, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff7bac";
    ctx.beginPath();
    ctx.ellipse(headX - 2, headY + 6, 1, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headX + 2, headY + 6, 1, 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Steam from nose when charging
    if (steam) {
      ctx.strokeStyle = "#aaddff";
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      [[headX - 2, headY + 6, headX - 6, headY + 3],
       [headX + 2, headY + 6, headX + 6, headY + 3]].forEach(function(l) {
        ctx.beginPath();
        ctx.moveTo(l[0], l[1]);
        ctx.quadraticCurveTo(l[0] + (l[2]-l[0]) * 0.5, l[1] - 3, l[2], l[3]);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    // ── Eyes ──────────────────────────────────
    var eyeOpen = (o.eyeOpen !== false); // default open
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.ellipse(headX - 4, headY - 1, 2, eyeOpen ? 2 : 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headX + 4, headY - 1, 2, eyeOpen ? 2 : 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (eyeOpen) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(headX - 3, headY - 2, 0.8, 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(headX + 5, headY - 2, 0.8, 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Clear whole canvas first
  ctx.clearRect(0, 0, FRAME_W * TOTAL_FRAMES, FRAME_H);

  // ── Idle frames 0-3: body bobs, tail swishes, blink on frame 3 ──
  drawCow(0  * FRAME_W, { bodyOY: 0, legPhase: 0, tailAngle:  20, eyeOpen: true  });
  drawCow(1  * FRAME_W, { bodyOY: 1, legPhase: 0, tailAngle:  40, eyeOpen: true  });
  drawCow(2  * FRAME_W, { bodyOY: 0, legPhase: 0, tailAngle:  20, eyeOpen: true  });
  drawCow(3  * FRAME_W, { bodyOY: 1, legPhase: 0, tailAngle: -10, eyeOpen: false }); // blink

  // ── Run frames 4-7: legs alternate, body bounces ──────────────
  drawCow(4  * FRAME_W, { bodyOY: -1, legPhase: 0, tailAngle: 30 });
  drawCow(5  * FRAME_W, { bodyOY:  1, legPhase: 1, tailAngle: 50 });
  drawCow(6  * FRAME_W, { bodyOY: -1, legPhase: 0, tailAngle: 30 });
  drawCow(7  * FRAME_W, { bodyOY:  1, legPhase: 1, tailAngle: 50 });

  // ── Jump frame 8: legs tucked ─────────────────────────────────
  drawCow(8  * FRAME_W, { bodyOY: -2, legPhase: 1, tailAngle: -20 });

  // ── Fall frame 9: legs splayed, worried eyes ──────────────────
  drawCow(9  * FRAME_W, { bodyOY: 0, legSplay: true, tailAngle: 60, eyeOpen: true });

  // ── Charge frame 10: head lowered, steam, gold glow ──────────
  drawCow(10 * FRAME_W, { bodyOY: 2, legPhase: 0, headLow: true, steam: true, chargeGlow: true, tailAngle: 10 });
  // ── Wall-slide frame 11: cow tilted sideways, all legs pushed out ─
  // We draw this one manually on the canvas for a rotated look.
  var wx = 11 * FRAME_W;
  ctx.save();
  ctx.translate(wx + 16, 16); // centre of frame
  ctx.rotate(0.45);           // tilt ~25° into the wall
  ctx.translate(-16, -16);    // draw relative to top-left
  drawCow(0, { bodyOY: 0, legPhase: 0, tailAngle: 80, eyeOpen: true });
  ctx.restore();
  // Scratch marks — short diagonal lines to show friction against the wall
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.55;
  [[wx+26,4,wx+30,10],[wx+25,11,wx+29,17],[wx+27,18,wx+31,24]].forEach(function(l){
    ctx.beginPath(); ctx.moveTo(l[0],l[1]); ctx.lineTo(l[2],l[3]); ctx.stroke();
  });
  ctx.globalAlpha = 1;
  // Tell Phaser the texture changed
  canvas.refresh();

  // Register each 32×32 frame by number so generateFrameNumbers() can find them.
  // Without this, the texture only has the default '__BASE' frame.
  var texture = scene.textures.get("player-cow");
  for (var fi = 0; fi < TOTAL_FRAMES; fi++) {
    texture.add(fi, 0, fi * FRAME_W, 0, FRAME_W, FRAME_H);
  }
}

// ── Create player sprite + animations ──────────
// Called from create() in game.js. Returns the player sprite.
function playerCreate(scene, x, y, groundLayer) {
  // Draw the cow textures before creating the sprite
  createCowTextures(scene);

  var player = scene.physics.add.sprite(x, y, "player-cow", 0); // start on idle frame 0
  player.setScale(PLAYER_SCALE); // make character bigger
  player.setCollideWorldBounds(true); // can't walk off the edge of the map
  player.setBounce(1, 0); // bounce off walls horizontally, no vertical bounce

  // Shrink the physics hitbox so it matches the visible character, not the full frame.
  player.body.setSize(PLAYER_HITBOX_WIDTH, PLAYER_HITBOX_HEIGHT);
  player.body.setOffset(PLAYER_HITBOX_OFFSET_X, PLAYER_HITBOX_OFFSET_Y);

  // Collide with ground tiles
  if (groundLayer) { scene.physics.add.collider(player, groundLayer); }

  // State tracking
  player.canDoubleJump = true;
  player.jumpsLeft = 2;               // 2 = can jump twice before landing
  player.wallSliding = false;         // true when pressed against a wall in the air
  player.wallDir = 0;                 // -1 = left wall, 1 = right wall
  player.wallJumpCooldownEnd = 0;     // can't wall-slide again for 1 s after a wall jump
  player.wallKickDir = 0;              // direction forced away from wall during kick
  player.wallKickEnd = 0;              // timestamp when the kick override expires
  player.chargeStartTime = 0;         // when space was pressed (0 = not charging)
  player.boostEndTime = 0;            // set on super jump release; isBoosting true while now < boostEndTime
  player.isBoosting = false;          // read by game.js to know when to smash green blocks
  player.isDying = false;             // true while the melt death animation is playing

  // ── Charge bar UI ─────────────────────────────
  // A small bar above the player that fills as you charge
  player.chargeBarBg = scene.add.rectangle(0, 0, 30, 5, 0x333333).setDepth(10);
  player.chargeBarFg = scene.add.rectangle(0, 0, 0,  5, 0xffd700).setDepth(11);

  // ── Animations ───────────────────────────────
  scene.anims.create({
    key: "cow-idle",
    frames: scene.anims.generateFrameNumbers("player-cow", { start: 0, end: 3 }),
    frameRate: 5,   // slow bob
    repeat: -1,
  });
  scene.anims.create({
    key: "cow-run",
    frames: scene.anims.generateFrameNumbers("player-cow", { start: 4, end: 7 }),
    frameRate: 10,  // snappy gallop
    repeat: -1,
  });
  scene.anims.create({
    key: "cow-jump",
    frames: scene.anims.generateFrameNumbers("player-cow", { start: 8, end: 8 }),
    frameRate: 1,
    repeat: 0,
  });
  scene.anims.create({
    key: "cow-fall",
    frames: scene.anims.generateFrameNumbers("player-cow", { start: 9, end: 9 }),
    frameRate: 1,
    repeat: 0,
  });
  scene.anims.create({
    key: "cow-charge",
    frames: scene.anims.generateFrameNumbers("player-cow", { start: 10, end: 10 }),
    frameRate: 1,
    repeat: 0,
  });
  scene.anims.create({
    key: "cow-wall",
    frames: scene.anims.generateFrameNumbers("player-cow", { start: 11, end: 11 }),
    frameRate: 1,
    repeat: 0,
  });

  return player;
}

// ── Movement + animation each frame ────────────
// Called from update() in game.js.
function playerUpdate(player, cursors, spaceKey) {
  if (player.isDying) return; // freeze all input while melt animation plays
  var scene    = player.scene;
  var onGround = player.body.blocked.down;
  var now      = scene.time.now;

  // crouching = down key while on the ground
  var crouching = cursors.down.isDown && onGround;
  var charging  = false; // super jump removed

  // Restore both jumps when landing
  if (onGround) { player.jumpsLeft = 2; player.wallSliding = false; }

  // ── Hitbox resize for crouch / charge ─────────
  if (crouching) {
    player.body.setSize(PLAYER_HITBOX_WIDTH, PLAYER_CROUCH_HEIGHT);
    player.body.setOffset(PLAYER_HITBOX_OFFSET_X, PLAYER_CROUCH_OFFSET_Y);
  } else {
    player.body.setSize(PLAYER_HITBOX_WIDTH, PLAYER_HITBOX_HEIGHT);
    player.body.setOffset(PLAYER_HITBOX_OFFSET_X, PLAYER_HITBOX_OFFSET_Y);
  }

  // isBoosting is always false now (no super jump)
  player.isBoosting = false;

  // ── Horizontal movement ─────────────────────
  var moveSpeed = PLAYER_SPEED;

  if (!crouching && cursors.left.isDown) {
    player.setVelocityX(-moveSpeed);
    player.setFlipX(true);
  } else if (!crouching && cursors.right.isDown) {
    player.setVelocityX(moveSpeed);
    player.setFlipX(false);
  } else {
    player.setVelocityX(0);
  }

  // If we're still in a wall-kick window, override X so player always flies away
  if (now < player.wallKickEnd) {
    player.setVelocityX(player.wallKickDir * PLAYER_SPEED * 1.6);
  }

  // ── Wall slide & wall jump ────────────────────────────────────
  // Wall slide: in the air, pressing into a blocked left/right side → slow fall.
  // Wall jump:  press W while wall-sliding → kick off the wall diagonally.
  var onWallLeft  = player.body.blocked.left;
  var onWallRight = player.body.blocked.right;
  var pressingIntoWall = (onWallLeft  && cursors.left.isDown) ||
                         (onWallRight && cursors.right.isDown);

  // Block wall-slide for 1.2 s after a wall jump so the player can escape cleanly
  player.wallSliding = !onGround && pressingIntoWall && (now > player.wallJumpCooldownEnd);

  if (player.wallSliding) {
    player.wallDir = onWallLeft ? -1 : 1;
    // Smoothly clamp fall speed — ease into the slide rather than hard cut
    var slideTarget = 55;
    if (player.body.velocity.y > slideTarget) {
      player.body.setVelocityY(
        player.body.velocity.y + (slideTarget - player.body.velocity.y) * 0.18
      );
    }
    player.jumpsLeft = 1; // always allow wall jump

    // Small dust particles trailing down the wall
    if (Math.random() < 0.15) {
      var wd = player.wallDir;
      var wx = player.x + wd * 12;
      var wy = player.y + (Math.random() - 0.5) * 16;
      var wdust = scene.add.circle(wx, wy, 2 + Math.random() * 2, 0xdddddd);
      wdust.setAlpha(0.6);
      scene.tweens.add({
        targets: wdust,
        y: wy + 12,
        alpha: 0,
        duration: 300,
        onComplete: function() { wdust.destroy(); }
      });
    }
  }

  // ── Jump & double jump (W key) ─────────────────────────────
  // jumpsLeft starts at 2 on the ground.
  // First press (jumpsLeft=2): full-height jump.
  // Second press in the air (jumpsLeft=1): double jump.
  if (Phaser.Input.Keyboard.JustDown(cursors.up) && !charging && player.jumpsLeft > 0) {
    if (player.wallSliding) {
      // Wall jump — strong kick away from wall, smooth arc
      player.setVelocityY(PLAYER_JUMP * 0.95);          // nearly full jump height
      var kickVx = -player.wallDir * PLAYER_SPEED * 1.6;
      player.setVelocityX(kickVx);
      player.wallKickDir = -player.wallDir;  // remember which way we're flying
      player.wallKickEnd = now + 500;        // enforce direction for 0.5 s
      player.setFlipX(player.wallDir > 0);
      player.jumpsLeft = 0;
      player.wallSliding = false;
      player.wallJumpCooldownEnd = now + 700; // 0.7 s — longer so player escapes cleanly
      scene.sound.play("jump-sfx");

      // Orange kick-off burst
      for (var w = 0; w < 3; w++) {
        (function(wi) {
          var wring = scene.add.circle(player.x, player.y, 10 + wi * 7, 0xff8800, 0);
          wring.setStrokeStyle(2, 0xff8800);
          wring.setAlpha(0.7);
          scene.tweens.add({
            targets: wring,
            scaleX: 3, scaleY: 3,
            alpha: 0,
            duration: 350,
            onComplete: function() { wring.destroy(); }
          });
        })(w);
      }
    } else if (player.jumpsLeft === 2) {
      // First jump — only allowed from the ground
      if (onGround) {
        player.setVelocityY(PLAYER_JUMP);
        player.jumpsLeft = 1;
        scene.sound.play("jump-sfx");
      }
    } else {
      // Double jump — usable in the air
      player.setVelocityY(PLAYER_DOUBLE_JUMP);
      player.jumpsLeft = 0;
      scene.sound.play("jump-sfx", { volume: 0.6 });

      // Cyan ring burst
      for (var r = 0; r < 3; r++) {
        (function(ri) {
          var ring = scene.add.circle(player.x, player.y, 15 + ri * 8, 0x00ffff, 0);
          ring.setStrokeStyle(2, 0x00ffff);
          ring.setAlpha(0.6);
          scene.tweens.add({
            targets: ring,
            scaleX: 3, scaleY: 3,
            alpha: 0,
            duration: 400,
            onComplete: function() { ring.destroy(); }
          });
        })(r);
      }
    }
  }

  // ── Animation picker ─────────────────────────
  if (charging) {
    player.anims.play("cow-charge", true);
  } else if (player.wallSliding) {
    player.anims.play("cow-wall", true); // tilted wall-slide frame
  } else if (!onGround) {
    if (player.body.velocity.y < 0) {
      player.anims.play("cow-jump", true);
    } else {
      player.anims.play("cow-fall", true);
    }
  } else if (Math.abs(player.body.velocity.x) > 10) {
    player.anims.play("cow-run", true);
  } else {
    player.anims.play("cow-idle", true);
  }
}

// ── Death melt animation ──────────────────────────────────────
// Called by game.js when the player hits lava.
// Squishes the cow flat like melting wax, then calls onComplete.
function playerMelt(player, onComplete) {
  player.isDying = true;
  var scene = player.scene;

  // Freeze physics so the cow doesn't drift while melting
  player.body.setVelocity(0, 0);
  player.body.allowGravity = false;
  player.body.enable = false;

  // Immediately tint orange-red
  player.setTint(0xff4400);

  // Squish flat (scaleY → 0) while spreading wide (scaleX grows), and sink a little
  scene.tweens.add({
    targets: player,
    scaleX: PLAYER_SCALE * 2.2,
    scaleY: 0.08,
    y: player.y + 14,
    duration: 550,
    ease: "Power2",
    onComplete: function() {
      // Fade the puddle out
      scene.tweens.add({
        targets: player,
        alpha: 0,
        duration: 350,
        onComplete: function() {
          if (onComplete) onComplete();
        }
      });
    }
  });
}
