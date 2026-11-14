// Two separate touch layouts:
//  on foot: left = floating joystick, right = swipe to look, buttons ZIELEN / SCHIESSEN / SPRUNG / EIN / Waffe / Rennen
//  in car : left = horizontal steering slider only, right = GAS + BREMSE pedals, Handbremse, Hupe, RAUS (no shooting)
export class Input {
  constructor() {
    this.mx = 0; this.my = 0;
    this.steer = 0; this.gas = false; this.brake = false;
    this.lookDX = 0; this.lookDY = 0;
    this.shoot = false; this.aimToggle = false; this.aimHeld = false;
    this.handbrake = false; this.horn = false; this.sprintToggle = false;
    this.edges = new Set();
    this.keys = new Set();
    this.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.joy = null;
    this.wheelT = null;
    this.looks = new Map();
    this.pointerLocked = false;
    this.sens = 1;
    this.enabled = false;
    this.carMode = false;
    this.bind();
  }
  get aim() { return this.aimToggle || this.aimHeld; }
  press(name) { this.edges.add(name); }
  consume(name) { const h = this.edges.has(name); this.edges.delete(name); return h; }
  setCarMode(on) {
    this.carMode = on;
    // drop any running touch on mode switch
    this.joy = null; this.wheelT = null;
    this.mx = this.my = 0; this.steer = 0;
    this.gas = this.brake = this.shoot = this.handbrake = this.horn = false;
    this.aimToggle = false;
    this.joyBase.style.display = 'none';
    this.wheelAngle = 0;
    this.wheelEl.style.transform = 'rotate(0deg)';
    document.querySelectorAll('.tb.down').forEach((b) => b.classList.remove('down'));
  }
  bind() {
    const joyBase = (this.joyBase = document.getElementById('joyBase'));
    const joyKnob = (this.joyKnob = document.getElementById('joyKnob'));
    this.wheelEl = document.getElementById('wheel');
    this.wheelAngle = 0;
    const wheelCenter = () => { const r = this.wheelEl.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    this.wheelCenter = wheelCenter;
    const btn = (id, down, up, look) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        el.classList.add('down');
        down && down();
        // the shoot button also lets you keep steering the camera with the same finger
        if (look) for (const t of e.changedTouches) this.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
      }, { passive: false });
      const end = (e) => {
        e.preventDefault();
        el.classList.remove('down');
        up && up();
        for (const t of e.changedTouches) this.looks.delete(t.identifier);
      };
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
      el.addEventListener('mousedown', (e) => { e.stopPropagation(); el.classList.add('down'); down && down(); });
      el.addEventListener('mouseup', (e) => { e.stopPropagation(); el.classList.remove('down'); up && up(); });
    };
    // on foot
    btn('bShoot', () => { this.shoot = true; }, () => { this.shoot = false; }, true);
    btn('bAim', () => { this.aimToggle = !this.aimToggle; this.press(this.aimToggle ? 'aimOn' : 'aimOff'); });
    btn('bJump', () => this.press('jump'));
    btn('bEnter', () => this.press('enter'));
    btn('bExit', () => this.press('enter'));
    btn('bWeapon', () => this.press('weapon'));
    btn('bReload', () => this.press('reload'));
    btn('bSprint', () => { this.sprintToggle = !this.sprintToggle; document.getElementById('bSprint').classList.toggle('on', this.sprintToggle); });
    // in car
    btn('bGas', () => { this.gas = true; }, () => { this.gas = false; });
    btn('bBrake', () => { this.brake = true; }, () => { this.brake = false; });
    btn('bHand', () => { this.handbrake = true; }, () => { this.handbrake = false; });
    btn('bHorn', () => { this.horn = true; }, () => { this.horn = false; });
    btn('bUp', () => { this.pitchUp = true; }, () => { this.pitchUp = false; });
    btn('bDown', () => { this.pitchDown = true; }, () => { this.pitchDown = false; });
    // shared
    btn('bCam', () => this.press('cam'));
    btn('bPause', () => this.press('pause'));

    const area = document.getElementById('touchArea');
    area.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const left = t.clientX < window.innerWidth * 0.45;
        if (left && this.carMode && !this.wheelT) {
          const [cx, cy] = wheelCenter();
          this.wheelT = { id: t.identifier, a: Math.atan2(t.clientY - cy, t.clientX - cx), x: t.clientX };
        } else if (left && !this.carMode && !this.joy) {
          this.joy = { id: t.identifier, x0: t.clientX, y0: t.clientY };
          joyBase.style.display = 'block';
          joyBase.style.left = t.clientX + 'px';
          joyBase.style.top = t.clientY + 'px';
          joyKnob.style.transform = 'translate(-50%,-50%)';
        } else {
          this.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
      }
    }, { passive: false });
    const move = (e) => {
      // let menus (customs, shop, vault, pause) scroll normally
      if (!(e.target && e.target.closest && e.target.closest('.ovl .card, #pause'))) e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.wheelT && t.identifier === this.wheelT.id) {
          // turn the wheel: angle change around its centre (plus a bit of sideways drag)
          const [cx, cy] = wheelCenter();
          const a = Math.atan2(t.clientY - cy, t.clientX - cx);
          let da = a - this.wheelT.a;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          const dist = Math.hypot(t.clientX - cx, t.clientY - cy);
          if (dist < 18) da = 0; // too close to the centre: angle is unreliable
          da += ((t.clientX - this.wheelT.x) / 160) * (dist < 40 ? 1 : 0.15);
          this.wheelT.a = a;
          this.wheelT.x = t.clientX;
          const MAX = (130 * Math.PI) / 180;
          this.wheelAngle = Math.max(-MAX, Math.min(MAX, this.wheelAngle + da));
          const v = this.wheelAngle / MAX;
          const k = Math.max(0, Math.abs(v) - 0.04) / 0.96;
          this.steer = Math.sign(v) * Math.pow(k, 1.2);
          this.wheelEl.style.transform = `rotate(${this.wheelAngle}rad)`;
        } else if (this.joy && t.identifier === this.joy.id) {
          const R = 55;
          let dx = t.clientX - this.joy.x0, dy = t.clientY - this.joy.y0;
          const d = Math.hypot(dx, dy);
          if (d > R) {
            this.joy.x0 += (dx / d) * (d - R);
            this.joy.y0 += (dy / d) * (d - R);
            joyBase.style.left = this.joy.x0 + 'px';
            joyBase.style.top = this.joy.y0 + 'px';
            dx = (dx / d) * R; dy = (dy / d) * R;
          }
          this.mx = dx / R;
          this.my = -dy / R;
          joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        } else if (this.looks.has(t.identifier)) {
          const l = this.looks.get(t.identifier);
          this.lookDX += (t.clientX - l.x) * 0.0062 * this.sens;
          this.lookDY += (t.clientY - l.y) * 0.005 * this.sens;
          l.x = t.clientX; l.y = t.clientY;
        }
      }
    };
    window.addEventListener('touchmove', move, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (this.joy && t.identifier === this.joy.id) {
          this.joy = null;
          this.mx = this.my = 0;
          joyBase.style.display = 'none';
        }
        if (this.wheelT && t.identifier === this.wheelT.id) {
          this.wheelT = null;
          this.steer = 0;
        }
        this.looks.delete(t.identifier);
      }
    };
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);

    // keyboard + mouse
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) {
        if (k === 'f' || k === 'enter') this.press('enter');
        if (k === ' ') this.press('jump');
        if (k === 'q' || k === 'e') this.press('weapon');
        if (k === '1') this.press('w0');
        if (k === '2') this.press('w1');
        if (k === '3') this.press('w2');
        if (k === 'c' || k === 'v') this.press('cam');
        if (k === 'escape' || k === 'p') this.press('pause');
        if (k === 'm') this.press('map');
        if (k === 'r') this.press('reload');
        if (k === 'n') this.press('mute');
        if (k === 'tab') { e.preventDefault(); this.press('nextTarget'); }
      }
      this.keys.add(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    const canvas = document.getElementById('c');
    area.addEventListener('mousedown', (e) => {
      if (this.touch && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      if (!this.pointerLocked && this.enabled) {
        try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) {}
        return;
      }
      if (e.button === 0) this.shoot = true;
      if (e.button === 2) { this.aimHeld = true; this.press('aimOn'); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.shoot = false;
      if (e.button === 2) { this.aimHeld = false; this.press('aimOff'); }
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      document.body.classList.toggle('locked', this.pointerLocked);
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.lookDX += e.movementX * 0.0024 * this.sens;
      this.lookDY += e.movementY * 0.0022 * this.sens;
    });
    window.addEventListener('wheel', (e) => { if (this.pointerLocked) this.wheel = (this.wheel || 0) + Math.sign(e.deltaY); });
  }
  poll() {
    const k = this.keys;
    // the wheel springs back to the centre when released
    if (!this.wheelT && this.wheelAngle) {
      this.wheelAngle *= 0.8;
      if (Math.abs(this.wheelAngle) < 0.01) this.wheelAngle = 0;
      this.wheelEl.style.transform = `rotate(${this.wheelAngle}rad)`;
    }
    // keyboard: on foot WASD, in car W/S = gas/brake, A/D = steer
    if (!this.joy && !this.wheelT) {
      let x = 0, y = 0;
      if (k.has('w') || k.has('arrowup')) y += 1;
      if (k.has('s') || k.has('arrowdown')) y -= 1;
      if (k.has('a') || k.has('arrowleft')) x -= 1;
      if (k.has('d') || k.has('arrowright')) x += 1;
      const l = Math.hypot(x, y);
      if (!this.carMode) {
        this.mx = l > 1 ? x / l : x;
        this.my = l > 1 ? y / l : y;
      } else {
        this.kbSteer = x;
        this.kbThrottle = y;
      }
    }
    this.kbSprint = k.has('shift');
    this.kbHandbrake = k.has(' ');
    this.kbHorn = k.has('h');
  }
  // car: combined throttle (-1..1) and steering
  throttle() {
    if (this.gas && !this.brake) return 1;
    if (this.brake && !this.gas) return -1;
    if (this.gas && this.brake) return 0;
    return this.kbThrottle || 0;
  }
  steering() {
    return this.wheelT ? this.steer : this.kbSteer || 0;
  }
  takeLook() {
    const r = [this.lookDX, this.lookDY];
    this.lookDX = this.lookDY = 0;
    return r;
  }
}
