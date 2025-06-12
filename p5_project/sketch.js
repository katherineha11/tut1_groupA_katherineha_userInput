let wheels = [];
let baseRadius = 65; // Smaller circles, so they can sparsely distribute yet still collide
let state = "idle";              // control game phases
let shakingStartTime;
let fallStartTime;
let fallingWheels = [];
let gameStart = false;
let currentWheel = null;
let stackedWheels = [];
let showGameInstructions = true;
let instructionTimer = 0;
let moveLeft = false;
let moveRight = false;
let gameOver = false;

function setup() {
  createCanvas(800, 800);
  ellipseMode(CENTER);

  // Keep manually specified positions
  let positions = [
    { x:  90, y: 100 }, { x: 330, y:  30 }, { x: 570, y: -40 },
    { x:  50, y: 340 }, { x: 280, y: 270 }, { x: 510, y: 200 },
    { x: 740, y: 130 }, { x:  10, y: 580 }, { x: 240, y: 510 },
    { x: 470, y: 440 }, { x: 700, y: 360 }, { x: -20, y: 830 },
    { x: 210, y: 750 }, { x: 440, y: 680 }, { x: 670, y: 600 },
    { x: 620, y: 850 }, { x: 860, y: 770 }
  ];

  for (let pos of positions) {
    let wheel = new Wheel(pos.x, pos.y, baseRadius);
    wheel.updateOuterVisualRadius();
    wheels.push(wheel);
  }
}

function draw() {
  if (state === "fallingPhase2" && !gameStart) {
    background(255);
    let allGone = wheels.every(w => w.y > height + 100);
    if (allGone) {
      if (showGameInstructions) {
        textAlign(CENTER, CENTER);
        textSize(24);
        // Display welcome message with styled background
        textFont('monospace');
        fill('#999B84'); // Background color for message box
        rectMode(CENTER);
        let msg = "Welcome to the stacking game!\nUse ← and → to move the wheel";
        let padding = 20;
        let textW = textWidth("Welcome to the stacking game!");
        let textH = 60;
        rect(width/2, height/2, textW + padding * 2, textH + padding * 2, 10);
        fill('#EFD9D1'); // Text color for message
        text(msg, width/2, height/2);
        instructionTimer++;
        if (instructionTimer > 120) {
          showGameInstructions = false;
          startStackingGame(); // Start the minigame after delay
        }
      }
    } else {
      for (let w of wheels) {
        w.vy += 0.5;
        w.x += w.vx;
        w.y += w.vy;

        if (w.y > height + 150) continue;

        if (w.x - w.outerVisualRadius < 0 || w.x + w.outerVisualRadius > width) {
          w.vx *= -1;
        }

        w.display();
      }
    }
  } else if (gameStart) {
    background(255);
    for (let sw of stackedWheels) sw.display();
    
    // Apply gravity to current falling wheel and allow horizontal control
    if (currentWheel && !gameOver) {
      currentWheel.vy += 0.2;
      currentWheel.y += currentWheel.vy;

      if (moveLeft) currentWheel.x -= 4;
      if (moveRight) currentWheel.x += 4;
      
      // Prevent the wheel from going outside the canvas bounds
      currentWheel.x = constrain(currentWheel.x, currentWheel.outerVisualRadius, width - currentWheel.outerVisualRadius);

      // When wheel hits stack or floor, add it to the stack and create a new one
      if (hitsStackEdge(currentWheel)) {
        stackedWheels.push(currentWheel);
        let stackTop = min(stackedWheels.map(w => w.y - w.outerVisualRadius));
        if (stackTop <= 0) {
          gameOver = true;
        } else { 
          // Initialize the first falling wheel and reset the game state
          currentWheel = new Wheel(width / 2, -baseRadius, baseRadius);
          currentWheel.updateOuterVisualRadius();
          currentWheel.vx = 0;
          currentWheel.vy = 0;
        }
      }

      currentWheel.display();
    }

    if (gameOver) {
      textAlign(CENTER, CENTER);
      textSize(22);
      textFont('monospace'); // Display game over message with same style as the perious text
      fill('#999B84');
      rectMode(CENTER);
      let gameMsg = "🎉 Stack full! Press SPACE to play again\nOr reload the page to restart from the beginning";
      let gameTextW = textWidth("🎉 Stack full! Press SPACE to play again");
      let gameTextH = 60;
      rect(width/2, height/2, gameTextW + 200, gameTextH + 60, 10);
      fill('#EFD9D1');
      text(gameMsg, width / 2, height / 2);
    }
  } else {
    background('#2E5F72');

    for (let w of wheels) w.update();

    if (state === "idle" || state === "shaking") resolveCollisions();

    for (let w of wheels) w.display();

    if (state === "fallingPhase1") {
      for (let i = 0; i < fallingWheels.length; i++) {
        let w = fallingWheels[i];
        w.y += 5;
        if (w.y > height + 100 && i === fallingWheels.length - 1) {
          state = "fallingPhase2";
          fallStartTime = millis();
          for (let w2 of wheels) {
            w2.vx = random(-5, 5);
            w2.vy = random(-10, -5);
          }
        }
      }
    }
  }
}

function startStackingGame() {
  gameStart = true;
  currentWheel = new Wheel(width / 2, -baseRadius, baseRadius);
  currentWheel.updateOuterVisualRadius();
  currentWheel.vx = 0;
  currentWheel.vy = 0;
  stackedWheels = [];
  gameOver = false;
}

function hitsStackEdge(w) {
  if (w.y + w.outerVisualRadius >= height) {
    w.y = height - w.outerVisualRadius;
    return true;
  }
  for (let sw of stackedWheels) {
    let dx = w.x - sw.x;
    let dy = w.y - sw.y;
    let distance = sqrt(dx * dx + dy * dy);
    let requiredDist = w.outerVisualRadius + sw.outerVisualRadius;
    // Check collision between the falling wheel and existing stacked wheels or floor
    // If overlapping, reposition using distance and angle
    if (distance < requiredDist) {
      let angle = atan2(dy, dx);
      w.x = sw.x + cos(angle) * requiredDist;
      w.y = sw.y + sin(angle) * requiredDist;
      return true;
    }
  }
  return false;
}

// Only the hovered wheel will use its outer ring to push surrounding wheels
function resolveCollisions() {
  const dotRings    = 6;   // Consistent with display() in wheel.js
  const ringSpacing = 13;
  const extraOffset = 10;  // Extra 10px for the outermost ring

  for (let i = 0; i < wheels.length; i++) {
    let a = wheels[i];
    if (!a.isHovered) continue;

    // —— Calculate outer ring radius for A ——
    const pinkA  = a.radius * 0.45;
    const initA  = pinkA + 18;
    const outerA = initA + (dotRings - 1) * ringSpacing + extraOffset;

    for (let j = 0; j < wheels.length; j++) {
      if (i === j) continue;
      let b = wheels[j];

      // —— Calculate outer ring radius for B ——
      const pinkB  = b.radius * 0.45;
      const initB  = pinkB + 18;
      const outerB = initB + (dotRings - 1) * ringSpacing + extraOffset;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = sqrt(dx * dx + dy * dy);
      const minDist = outerA + outerB;

      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const moveX = (dx / dist) * overlap * 1.1;
        const moveY = (dy / dist) * overlap * 1.1;
        b.targetX += moveX;
        b.targetY += moveY;
      }
    }
  }
}

function keyPressed() {
  if (keyCode === ENTER && state === "idle") {
    state = "shaking";
    shakingStartTime = millis();
  }

  if (gameStart) { 
    // Allow keyboard controls to move the wheel left or right
    if (keyCode === LEFT_ARROW) moveLeft = true;
    if (keyCode === RIGHT_ARROW) moveRight = true;
  }

  if (gameOver && key === ' ') {
    startStackingGame(); // Restart game when pressing space
  }
}

function keyReleased() {
  if (gameStart) {
    if (keyCode === LEFT_ARROW) moveLeft = false;
    if (keyCode === RIGHT_ARROW) moveRight = false;
  }
}

function mousePressed() {
  if (state === "shaking") {
    for (let w of wheels) {
      let d = dist(mouseX, mouseY, w.x, w.y);
      if (d < w.radius) {
        let idx = wheels.indexOf(w);
        fallingWheels = wheels.slice(idx); // 🌪 trigger phase 1
        state = "fallingPhase1";
        return;
      }
    }
  }
}

// Random color generator, identical to the original
function randomColor() {
  return color(random(255), random(255), random(255));
}
