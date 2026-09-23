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
  const palette = ["#40e1c0", "#51a8ff", "#a9f36a", "#f4d35e"];
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
