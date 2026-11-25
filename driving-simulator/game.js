"use strict";

(() => {
  const canvas = document.getElementById("road-view");
  const context = canvas.getContext("2d");
  const speedLabel = document.getElementById("speed");
  const distanceLabel = document.getElementById("distance");
  const gearLabel = document.getElementById("gear");
  const driveStateLabel = document.getElementById("drive-state");
  const speedFill = document.getElementById("speed-fill");
  const hint = document.getElementById("scene-hint");
  const restartButton = document.getElementById("restart");
  const keys = new Set();
  const pointerControls = new Set();
  const state = {
    speed: 0,
    distance: 0,
    steering: 0,
    roadPosition: 0,
    roadOffset: 0,
    lastFrame: 0
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const isDown = (...names) => names.some((name) => keys.has(name) || pointerControls.has(name));

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(bounds.width * pixelRatio));
    canvas.height = Math.max(1, Math.round(bounds.height * pixelRatio));
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawScene();
  }

  function drawScene() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;

    const horizon = height * 0.43;
    const center = width * (0.5 - state.roadPosition * 0.1);
    const perspective = (y) => clamp((y - horizon) / (height - horizon), 0, 1);
    const roadHalfAt = (t) => width * (0.055 + t * 0.54);
    const shiftAt = (t) => Math.sin(state.roadOffset * 0.42 + t * 1.6) * width * t * 0.025;

    const sky = context.createLinearGradient(0, 0, 0, horizon + 40);
    sky.addColorStop(0, "#72918e");
    sky.addColorStop(0.65, "#b8c5a6");
    sky.addColorStop(1, "#e5c998");
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    const sunGlow = context.createRadialGradient(width * 0.73, horizon * 0.68, 3, width * 0.73, horizon * 0.68, width * 0.19);
    sunGlow.addColorStop(0, "rgba(255, 231, 164, .58)");
    sunGlow.addColorStop(1, "rgba(255, 231, 164, 0)");
    context.fillStyle = sunGlow;
    context.fillRect(0, 0, width, horizon + 45);

    drawMountainLayer(width, horizon, 0);
    drawMountainLayer(width, horizon, 1);

    const ground = context.createLinearGradient(0, horizon, 0, height);
    ground.addColorStop(0, "#76875e");
    ground.addColorStop(1, "#324636");
    context.fillStyle = ground;
    context.fillRect(0, horizon, width, height - horizon);

    drawRoadside(width, height, horizon, center, roadHalfAt, shiftAt, perspective);
    drawRoad(width, height, horizon, center, roadHalfAt, shiftAt, perspective);
    drawRoadsideDetails(width, height, horizon, center, roadHalfAt, shiftAt, perspective);
    drawCockpit(width, height);
  }

  function drawMountainLayer(width, horizon, layer) {
    const far = layer === 0;
    const baseY = horizon * (far ? 0.92 : 1.03);
    const peaks = far
      ? [[0, .28], [.08, .43], [.19, .22], [.31, .48], [.43, .3], [.56, .47], [.71, .2], [.84, .39], [1, .24]]
      : [[0, .48], [.11, .26], [.24, .54], [.38, .32], [.52, .56], [.65, .25], [.79, .5], [.91, .3], [1, .45]];
    const parallax = far ? 0.018 : 0.038;
    context.beginPath();
    context.moveTo(0, horizon + 2);
    for (const [ratio, heightRatio] of peaks) {
      const x = ratio * width + state.roadPosition * width * parallax;
      context.lineTo(x, baseY - heightRatio * horizon * (far ? .52 : .35));
    }
    context.lineTo(width, horizon + 3);
    context.closePath();
    context.fillStyle = far ? "#849888" : "#657b68";
    context.fill();

    if (!far) {
      context.fillStyle = "rgba(192, 196, 146, .25)";
      context.beginPath();
      context.moveTo(0, horizon * 1.02);
      context.lineTo(width * .18, horizon * .76);
      context.lineTo(width * .29, horizon * 1.02);
      context.lineTo(width * .43, horizon * .79);
      context.lineTo(width * .57, horizon * 1.02);
      context.closePath();
      context.fill();
    }
  }

  function drawRoadside(width, height, horizon, center, roadHalfAt, shiftAt, perspective) {
    const samples = 32;
    context.beginPath();
    context.moveTo(0, horizon);
    context.lineTo(center, horizon);
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const y = horizon + t * (height - horizon);
      const half = roadHalfAt(t) + width * .025;
      const roadCenter = center + shiftAt(t);
      context.lineTo(roadCenter + half, y);
    }
    context.lineTo(width, height);
    context.lineTo(0, height);
    context.closePath();
    const shoulder = context.createLinearGradient(0, horizon, 0, height);
    shoulder.addColorStop(0, "#879168");
    shoulder.addColorStop(1, "#354b37");
    context.fillStyle = shoulder;
    context.fill();

    for (let side = -1; side <= 1; side += 2) {
      context.beginPath();
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const y = horizon + t * (height - horizon);
        const half = roadHalfAt(t);
        const roadCenter = center + shiftAt(t);
        const x = roadCenter + side * (half + width * .008);
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = "rgba(238, 221, 175, .38)";
      context.lineWidth = Math.max(1, width * .0014);
      context.stroke();
    }

    context.fillStyle = "rgba(231, 205, 143, .16)";
    for (let i = 0; i < 50; i++) {
      const t = ((i / 50 + state.roadOffset * .018) % 1);
      const y = horizon + t * (height - horizon);
      const scale = perspective(y);
      const side = i % 2 ? -1 : 1;
      const x = center + shiftAt(t) + side * (roadHalfAt(t) + width * (.08 + (i % 5) * .025));
      context.beginPath();
      context.ellipse(x, y, width * .003 * scale + 1, height * .0024 * scale + 1, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawRoad(width, height, horizon, center, roadHalfAt, shiftAt, perspective) {
    const segments = 46;
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = horizon + t * (height - horizon);
      points.push({ y, t, center: center + shiftAt(t), half: roadHalfAt(t) });
    }

    context.beginPath();
    points.forEach((point, index) => {
      const x = point.center - point.half;
      if (index === 0) context.moveTo(x, point.y);
      else context.lineTo(x, point.y);
    });
    for (let i = points.length - 1; i >= 0; i--) {
      context.lineTo(points[i].center + points[i].half, points[i].y);
    }
    context.closePath();
    const road = context.createLinearGradient(0, horizon, 0, height);
    road.addColorStop(0, "#646b63");
    road.addColorStop(.52, "#434b46");
    road.addColorStop(1, "#343b38");
    context.fillStyle = road;
    context.fill();

    const edgeWidth = Math.max(1, width * .003);
    for (const side of [-1, 1]) {
      context.beginPath();
      points.forEach((point, index) => {
        const x = point.center + side * point.half;
        if (index === 0) context.moveTo(x, point.y);
        else context.lineTo(x, point.y);
      });
      context.strokeStyle = "#ece3c8";
      context.lineWidth = edgeWidth;
      context.stroke();
    }

    for (const divider of [-1 / 3, 1 / 3]) {
      const spacing = .19;
      const offset = (state.roadOffset * .025) % spacing;
      for (let stripe = -1; stripe < 6; stripe++) {
        const t1 = (stripe * spacing + offset + spacing) % 1;
        const t2 = Math.min(1, t1 + .055 + t1 * .035);
        if (t2 <= t1 || t1 < .012) continue;
        const y1 = horizon + t1 * (height - horizon);
        const y2 = horizon + t2 * (height - horizon);
        const scale1 = perspective(y1);
        const scale2 = perspective(y2);
        const x1 = center + shiftAt(t1) + divider * roadHalfAt(t1);
        const x2 = center + shiftAt(t2) + divider * roadHalfAt(t2);
        const lineWidth1 = Math.max(1, width * .0018 * scale1);
        const lineWidth2 = Math.max(1, width * .0018 * scale2);
        context.beginPath();
        context.moveTo(x1 - lineWidth1, y1);
        context.lineTo(x1 + lineWidth1, y1);
        context.lineTo(x2 + lineWidth2, y2);
        context.lineTo(x2 - lineWidth2, y2);
        context.closePath();
        context.fillStyle = "rgba(231, 231, 214, .88)";
        context.fill();
      }
    }
  }

  function drawRoadsideDetails(width, height, horizon, center, roadHalfAt, shiftAt, perspective) {
    const markers = 16;
    for (let i = 0; i < markers; i++) {
      const t = ((i / markers + state.roadOffset * .025) % 1);
      if (t < .018) continue;
      const y = horizon + t * (height - horizon);
      const scale = perspective(y);
      const size = 2 + scale * 26;
      const half = roadHalfAt(t);
      const curve = shiftAt(t);
      for (const side of [-1, 1]) {
        const x = center + curve + side * (half + size * .72);
        if (x < -size || x > width + size) continue;
        const trunkHeight = size * .88;
        context.fillStyle = "#4b5140";
        context.fillRect(x - size * .07, y - trunkHeight, size * .14, trunkHeight);
        context.fillStyle = i % 3 === 0 ? "#586d4c" : "#60764f";
        context.beginPath();
        context.moveTo(x, y - trunkHeight - size * .95);
        context.lineTo(x - size * .52, y - trunkHeight * .12);
        context.lineTo(x + size * .52, y - trunkHeight * .12);
        context.closePath();
        context.fill();
        context.fillStyle = "rgba(174, 178, 116, .14)";
        context.beginPath();
        context.ellipse(x - size * .1, y - trunkHeight * .63, size * .12, size * .27, -.2, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawCockpit(width, height) {
    const horizon = height * .43;
    const dashboardY = height * .87;
    const cabin = context.createLinearGradient(0, dashboardY - 5, 0, height);
    cabin.addColorStop(0, "rgba(24, 29, 27, .91)");
    cabin.addColorStop(1, "#111513");
    context.fillStyle = cabin;
    context.beginPath();
    context.moveTo(0, height);
    context.lineTo(0, dashboardY + height * .02);
    context.quadraticCurveTo(width * .5, dashboardY - height * .04, width, dashboardY + height * .02);
    context.lineTo(width, height);
    context.closePath();
    context.fill();

    context.strokeStyle = "rgba(19, 25, 23, .82)";
    context.lineWidth = Math.max(8, width * .018);
    context.beginPath();
    context.moveTo(0, horizon * .32);
    context.lineTo(width * .07, horizon * .32);
    context.lineTo(width * .18, horizon * 1.03);
    context.stroke();
    context.beginPath();
    context.moveTo(width, horizon * .32);
    context.lineTo(width * .93, horizon * .32);
    context.lineTo(width * .82, horizon * 1.03);
    context.stroke();

    context.fillStyle = "rgba(10, 14, 13, .8)";
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(width * .035, 0);
    context.lineTo(width * .13, horizon * 1.02);
    context.lineTo(0, horizon * 1.08);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(width, 0);
    context.lineTo(width * .965, 0);
    context.lineTo(width * .87, horizon * 1.02);
    context.lineTo(width, horizon * 1.08);
    context.closePath();
    context.fill();

    const wheelX = width * (.5 + state.steering * .025);
    const wheelY = height * 1.05;
    const wheelRadius = Math.min(width * .15, height * .32);
    context.save();
    context.translate(wheelX, wheelY);
    context.rotate(state.steering * .28);
    context.beginPath();
    context.arc(0, 0, wheelRadius, Math.PI * 1.12, Math.PI * 1.88);
    context.strokeStyle = "#151918";
    context.lineWidth = Math.max(11, width * .025);
    context.stroke();
    context.beginPath();
    context.arc(0, 0, wheelRadius, Math.PI * 1.12, Math.PI * 1.88);
    context.strokeStyle = "#38413c";
    context.lineWidth = Math.max(3, width * .007);
    context.stroke();
    context.restore();

    context.fillStyle = "rgba(196, 240, 106, .11)";
    context.fillRect(width * .5 - 24, dashboardY + 9, 48, 2);
  }

  function update(delta) {
    const throttle = isDown("w", "arrowup", "throttle");
    const braking = isDown("s", "arrowdown", "brake");
    const left = isDown("a", "arrowleft", "left");
    const right = isDown("d", "arrowright", "right");

    if (throttle || braking || left || right) {
      hint.classList.add("is-hidden");
    }

    if (throttle) state.speed += 33 * delta;
    else state.speed -= 2.4 * delta;
    if (braking) state.speed -= 75 * delta;

    state.speed = clamp(state.speed, 0, 180);
    const steeringInput = (right ? 1 : 0) - (left ? 1 : 0);
    state.steering += (steeringInput - state.steering) * Math.min(1, delta * 5.5);
    state.roadPosition = clamp(state.roadPosition + state.steering * delta * (0.1 + state.speed / 160), -1.45, 1.45);
    if (!steeringInput) state.roadPosition *= Math.max(0, 1 - delta * .13);
    if (Math.abs(state.roadPosition) > .84) state.speed = Math.max(0, state.speed - 18 * delta);
    state.roadOffset += state.speed * delta * .012;
    state.distance += state.speed * delta / 3600;

    speedLabel.textContent = String(Math.round(state.speed));
    distanceLabel.textContent = state.distance.toFixed(2);
    speedFill.style.width = `${(state.speed / 180) * 100}%`;
    const gear = state.speed < 1 ? "N" : String(clamp(Math.ceil(state.speed / 32), 1, 6));
    gearLabel.textContent = gear;
    driveStateLabel.textContent = Math.abs(state.roadPosition) > .84 ? "OFF-ROAD - SLOWING" : state.speed > 1 ? "ENJOY THE OPEN ROAD" : "READY WHEN YOU ARE";
  }

  function frame(timestamp) {
    const elapsed = state.lastFrame ? Math.min((timestamp - state.lastFrame) / 1000, .05) : 0;
    state.lastFrame = timestamp;
    update(elapsed);
    drawScene();
    window.requestAnimationFrame(frame);
  }

  function reset() {
    state.speed = 0;
    state.distance = 0;
    state.steering = 0;
    state.roadPosition = 0;
    state.roadOffset = 0;
    state.lastFrame = 0;
    keys.clear();
    pointerControls.clear();
    hint.classList.remove("is-hidden");
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    keys.add(key);
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());
  restartButton.addEventListener("click", reset);

  document.querySelectorAll("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    const release = () => {
      pointerControls.delete(control);
      button.classList.remove("is-active");
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      pointerControls.add(control);
      button.classList.add("is-active");
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  window.requestAnimationFrame(frame);
})();
