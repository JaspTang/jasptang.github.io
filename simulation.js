/* Interactive canvas recreation of Jasper's eighth-grade gravity experiment. */
(() => {
  const canvas = document.querySelector("#physics-canvas");
  const resetButton = document.querySelector("#reset-simulation");
  const countLabel = document.querySelector("#ball-count");
  const context = canvas.getContext("2d");
  const particles = [];
  const gravity = 980;
  const restitution = 0.68;
  const friction = 0.92;
  const palette = ["#68f5d0", "#69aaff", "#e0ff63", "#ff8369"];
  let dimensions = { width: 0, height: 0, scale: 1 };
  let previousTime = performance.now();
  let pointerStart = null;

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;

    dimensions = { width: bounds.width, height: bounds.height, scale };
    canvas.width = Math.round(bounds.width * scale);
    canvas.height = Math.round(bounds.height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function addParticle(x, y, velocityX = 0, velocityY = 0) {
    particles.push({
      x,
      y,
      velocityX,
      velocityY,
      radius: 10 + Math.random() * 7,
      color: palette[particles.length % palette.length],
    });
  }

  function resetSimulation() {
    particles.length = 0;
    addParticle(dimensions.width * 0.28, dimensions.height * 0.2, 115, 0);
    addParticle(dimensions.width * 0.68, dimensions.height * 0.1, -75, 40);
  }

  function updateParticle(particle, deltaTime) {
    particle.velocityY += gravity * deltaTime;
    particle.x += particle.velocityX * deltaTime;
    particle.y += particle.velocityY * deltaTime;

    if (particle.x - particle.radius < 0 || particle.x + particle.radius > dimensions.width) {
      particle.x = Math.max(particle.radius, Math.min(dimensions.width - particle.radius, particle.x));
      particle.velocityX *= -0.95;
    }

    if (particle.y + particle.radius > dimensions.height) {
      particle.y = dimensions.height - particle.radius;
      particle.velocityY *= -restitution;
      particle.velocityX *= friction;

      if (Math.abs(particle.velocityY) < 18) particle.velocityY = 0;
    }
  }

  function drawParticle(particle) {
    const gradient = context.createRadialGradient(
      particle.x - particle.radius * 0.35,
      particle.y - particle.radius * 0.35,
      1,
      particle.x,
      particle.y,
      particle.radius,
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.18, particle.color);
    gradient.addColorStop(1, "rgba(5, 24, 30, 0.92)");

    context.beginPath();
    context.fillStyle = gradient;
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawFrame(now) {
    const deltaTime = Math.min((now - previousTime) / 1000, 0.033);
    previousTime = now;
    context.clearRect(0, 0, dimensions.width, dimensions.height);

    context.strokeStyle = "rgba(193, 247, 231, 0.12)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, dimensions.height - 0.5);
    context.lineTo(dimensions.width, dimensions.height - 0.5);
    context.stroke();

    particles.forEach((particle) => {
      updateParticle(particle, deltaTime);
      drawParticle(particle);
    });

    countLabel.textContent = `OBJECTS / ${String(particles.length).padStart(2, "0")}`;
    requestAnimationFrame(drawFrame);
  }

  function positionFromEvent(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointerStart = positionFromEvent(event);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!pointerStart) return;

    const end = positionFromEvent(event);
    addParticle(pointerStart.x, pointerStart.y, (end.x - pointerStart.x) * 3.5, (end.y - pointerStart.y) * 3.5);
    pointerStart = null;
  });

  resetButton.addEventListener("click", resetSimulation);
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  resetSimulation();
  requestAnimationFrame(drawFrame);
})();

// Small gravitational pulls keep related projects clustered in the work field.
(() => {
  const field = document.querySelector(".bubble-field");
  if (!field) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nodes = [...field.querySelectorAll("[data-bubble]")].map((element) => ({
    element,
    kind: element.dataset.kind,
    x: 0,
    y: 0,
    homeX: 0,
    homeY: 0,
    velocityX: 0,
    velocityY: 0,
    radius: 0,
  }));
  let fieldSize = { width: 0, height: 0 };
  let activeBubble = null;
  let previousFrame = performance.now();
  let mobileLayout = window.innerWidth <= 720;

  function arrangeNodes(preservePositions = false) {
    const bounds = field.getBoundingClientRect();
    const nextMobileLayout = window.innerWidth <= 720;
    const layoutChanged = mobileLayout !== nextMobileLayout;
    mobileLayout = nextMobileLayout;
    const scaleX = fieldSize.width ? bounds.width / fieldSize.width : 1;
    const scaleY = fieldSize.height ? bounds.height / fieldSize.height : 1;
    fieldSize = { width: bounds.width, height: bounds.height };

    nodes.forEach((node, index) => {
      const box = node.element.getBoundingClientRect();
      node.radius = Math.max(box.width, box.height) / 2;
      if (window.innerWidth <= 720) {
        const mobileHomes = [
          { x: 0.37, y: 0.24 },
          { x: 0.64, y: 0.53 },
          { x: 0.25, y: 0.82 },
        ];
        const home = mobileHomes[index] || { x: 0.75, y: 0.8 };
        node.homeX = bounds.width * home.x;
        node.homeY = bounds.height * home.y;
      } else {
        node.homeX = bounds.width * Number(node.element.dataset.x);
        node.homeY = bounds.height * Number(node.element.dataset.y);
      }

      if (!preservePositions || layoutChanged) {
        node.x = node.homeX;
        node.y = node.homeY;
      } else {
        node.x *= scaleX;
        node.y *= scaleY;
      }
      node.x = Math.max(node.radius + 8, Math.min(bounds.width - node.radius - 8, node.x));
      node.y = Math.max(node.radius + 8, Math.min(bounds.height - node.radius - 8, node.y));
      node.element.style.left = `${node.x}px`;
      node.element.style.top = `${node.y}px`;
    });
  }

  function updateBubbles(now) {
    if (document.hidden) {
      previousFrame = now;
      requestAnimationFrame(updateBubbles);
      return;
    }
    const elapsed = Math.min((now - previousFrame) / 16.67, 2);
    previousFrame = now;
    const accelerations = nodes.map(() => ({ x: 0, y: 0 }));

    nodes.forEach((node, index) => {
      const homePull = node.kind === "project" ? 0.001 : 0.00125;
      accelerations[index].x += (node.homeX - node.x) * homePull;
      accelerations[index].y += (node.homeY - node.y) * homePull;
    });

    for (let first = 0; first < nodes.length; first += 1) {
      for (let second = first + 1; second < nodes.length; second += 1) {
        const a = nodes[first];
        const b = nodes[second];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy) || 1;
        const directionX = dx / distance;
        const directionY = dy / distance;

        if (a.kind === "project" && b.kind === "project") {
          const pull = 0.00012;
          accelerations[first].x += dx * pull;
          accelerations[first].y += dy * pull;
          accelerations[second].x -= dx * pull;
          accelerations[second].y -= dy * pull;
        } else {
          const gentlePull = 0.000035;
          if (a.kind === "interest" && b.kind === "project") {
            accelerations[first].x += dx * gentlePull;
            accelerations[first].y += dy * gentlePull;
          } else if (a.kind === "project" && b.kind === "interest") {
            accelerations[second].x -= dx * gentlePull;
            accelerations[second].y -= dy * gentlePull;
          }
        }

        const minimumDistance = a.radius + b.radius + 14;
        if (distance < minimumDistance) {
          const push = (minimumDistance - distance) * 0.003;
          accelerations[first].x -= directionX * push;
          accelerations[first].y -= directionY * push;
          accelerations[second].x += directionX * push;
          accelerations[second].y += directionY * push;
        }
      }
    }

    if (activeBubble) {
      const activeIndex = nodes.indexOf(activeBubble);
      nodes.forEach((node, index) => {
        if (node === activeBubble) return;
        const dx = node.x - activeBubble.x;
        const dy = node.y - activeBubble.y;
        const distance = Math.hypot(dx, dy) || 1;
        const influence = activeBubble.radius + node.radius + (node.kind === "project" ? 90 : 130);
        if (distance >= influence) return;
        const nudge = (influence - distance) * 0.0022;
        accelerations[index].x += (dx / distance) * nudge;
        accelerations[index].y += (dy / distance) * nudge;
        accelerations[activeIndex].x -= (dx / distance) * nudge * 0.14;
        accelerations[activeIndex].y -= (dy / distance) * nudge * 0.14;
      });
    }

    nodes.forEach((node, index) => {
      node.velocityX = (node.velocityX + accelerations[index].x * elapsed) * Math.pow(0.94, elapsed);
      node.velocityY = (node.velocityY + accelerations[index].y * elapsed) * Math.pow(0.94, elapsed);
      node.x += node.velocityX * elapsed;
      node.y += node.velocityY * elapsed;
      node.x = Math.max(node.radius + 8, Math.min(fieldSize.width - node.radius - 8, node.x));
      node.y = Math.max(node.radius + 8, Math.min(fieldSize.height - node.radius - 8, node.y));
      node.element.style.left = `${node.x}px`;
      node.element.style.top = `${node.y}px`;
    });

    requestAnimationFrame(updateBubbles);
  }

  nodes.forEach((node) => {
    node.element.addEventListener("pointerenter", () => {
      activeBubble = node;
    });
    node.element.addEventListener("pointerleave", () => {
      if (activeBubble === node) activeBubble = null;
    });
    node.element.addEventListener("focus", () => { activeBubble = node; });
    node.element.addEventListener("blur", () => { if (activeBubble === node) activeBubble = null; });
  });

  arrangeNodes();
  if (!reducedMotion) requestAnimationFrame(updateBubbles);
  window.addEventListener("resize", () => arrangeNodes(true));
})();
