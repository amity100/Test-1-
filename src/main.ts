import './style.css';
import * as THREE from 'three';

type BiomeActor = { group: THREE.Group; velocity: THREE.Vector3; phase: number; kind: 'fish' | 'shark' | 'dolphinAlly' };
type Vehicle = { group: THREE.Group; phase: number; speed: number };

type DolphinState = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number;
  chargeHeld: boolean;
  diveCharge: number;
  combo: number;
  perfects: number;
  bestHeight: number;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root element');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xf5a760, 0.0065);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2500);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.innerHTML = '';
app.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const waterLevel = 0;
const world = new THREE.Group();
scene.add(world);

const sun = new THREE.DirectionalLight(0xfff0c2, 5.4);
sun.position.set(-120, 62, -210);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xffcf9a, 0x06365e, 2.8));

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1800, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { top: { value: new THREE.Color(0x7d3e58) }, horizon: { value: new THREE.Color(0xffb15e) }, glow: { value: new THREE.Color(0xfff0a8) } },
    vertexShader: 'varying vec3 vPos; void main(){vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec3 vPos; uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; void main(){float h=normalize(vPos).y; vec3 c=mix(horizon,top,smoothstep(-.05,.75,h)); float sun=pow(max(dot(normalize(vPos),normalize(vec3(-.55,.22,-.8))),0.),22.); gl_FragColor=vec4(c+glow*sun*1.7,1.);}'
  })
);
scene.add(sky);

const waterUniforms = { time: { value: 0 }, sunDir: { value: sun.position.clone().normalize() } };
const ocean = new THREE.Mesh(
  new THREE.PlaneGeometry(2400, 2400, 220, 220),
  new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    vertexShader: `varying vec3 vWorld; varying vec3 vNormal; uniform float time;
      float wave(vec2 p,float s,float a){return sin(p.x*s+time*1.2)+cos((p.y+p.x*.35)*s*.72+time*.9)*a;}
      void main(){vec3 p=position; float h=wave(p.xz,.035,.7)*1.2+wave(p.zx,.09,.45)*.42+sin(length(p.xz)*.018-time)*.35; p.z+=h; vNormal=normalize(vec3(-.08*h,1.,-.06*h)); vec4 w=modelMatrix*vec4(p,1.); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `varying vec3 vWorld; varying vec3 vNormal; uniform vec3 sunDir; uniform float time;
      void main(){vec3 viewDir=normalize(cameraPosition-vWorld); float fres=pow(1.-max(dot(viewDir,vNormal),0.),3.); float sparkle=pow(max(dot(reflect(-sunDir,vNormal),viewDir),0.),80.); float lane=pow(max(dot(normalize(vec3(-.48,.08,-.88)),normalize(vWorld-cameraPosition)),0.),12.); vec3 deep=vec3(.015,.17,.28); vec3 teal=vec3(.02,.42,.50); vec3 gold=vec3(1.,.62,.18); vec3 col=mix(deep,teal,fres*.75+.18)+gold*(sparkle*3.2+lane*.38)*(sin(vWorld.x*.5+time*4.)*.25+.75); col+=vec3(1.,.82,.42)*pow(max(dot(normalize(vWorld-cameraPosition),normalize(vec3(-.5,.08,-.85))),0.),45.)*.75; gl_FragColor=vec4(col,.92);}`
  })
);
ocean.rotation.x = -Math.PI / 2;
ocean.receiveShadow = true;
world.add(ocean);

function mat(color: number, roughness = 0.55, metalness = 0) { return new THREE.MeshStandardMaterial({ color, roughness, metalness }); }
function add(mesh: THREE.Mesh, parent = world) { mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }

function createDolphin(color = 0x6da8b8) {
  const g = new THREE.Group();
  const body = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.3, 12, 28), mat(color, 0.36)), g);
  body.rotation.z = Math.PI / 2;
  body.scale.set(1, 0.62, 0.48);
  const nose = add(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.8, 24), mat(0xb8d4d9, 0.42)), g); nose.rotation.z = -Math.PI / 2; nose.position.x = 1.55;
  const tail = add(new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 24), mat(color, 0.38)), g); tail.rotation.z = Math.PI / 2; tail.position.x = -1.55;
  const fin = add(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.8, 3), mat(0x4a7989, 0.44)), g); fin.position.set(-0.2, 0.55, 0); fin.rotation.z = Math.PI;
  for (const z of [-0.42, 0.42]) { const fl = add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 3), mat(0x477384, 0.45)), g); fl.position.set(0.35, -0.12, z); fl.rotation.set(Math.PI / 2, 0, z > 0 ? -0.6 : 0.6); }
  return g;
}
const dolphin = createDolphin();
world.add(dolphin);
const state: DolphinState = { position: new THREE.Vector3(0, -1.2, 0), velocity: new THREE.Vector3(0, 0, -18), heading: 0, chargeHeld: false, diveCharge: 0, combo: 0, perfects: 0, bestHeight: 0 };

function island(x: number, z: number, s: number) {
  const g = new THREE.Group(); g.position.set(x, -1.7, z); g.scale.setScalar(s); world.add(g);
  add(new THREE.Mesh(new THREE.ConeGeometry(16, 10, 8), mat(0x5e4a35, 0.88)), g);
  for (let i = 0; i < 18; i++) { const p = add(new THREE.Mesh(new THREE.CylinderGeometry(.08,.13,3.5,7), mat(0x6a4324)), g); p.position.set((Math.random()-.5)*22,5,(Math.random()-.5)*22); const crown=add(new THREE.Mesh(new THREE.SphereGeometry(.85,8,6), mat(0x2f7d42,.75)), g); crown.position.copy(p.position).y+=2.1; }
}
island(-95, -210, 1.3); island(120, -390, .9); island(-180, -520, .7);

function createBoat(x: number, z: number, scale: number): Vehicle { const g = new THREE.Group(); g.position.set(x, .4, z); g.scale.setScalar(scale); world.add(g); add(new THREE.Mesh(new THREE.BoxGeometry(8,1.1,2.1), mat(0x6f3f22,.6)), g); const cabin=add(new THREE.Mesh(new THREE.BoxGeometry(2.4,1.3,1.7), mat(0xf4e4c2,.5)), g); cabin.position.y=1.1; const mast=add(new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,6,8), mat(0x4a2a17)), g); mast.position.y=3; const sail=add(new THREE.Mesh(new THREE.PlaneGeometry(2.6,3.8), mat(0xfff1d0,.35)), g); sail.position.set(.4,3,0); sail.rotation.y=Math.PI/2; for(let i=0;i<4;i++){const h=add(new THREE.Mesh(new THREE.CapsuleGeometry(.16,.55,5,8), mat(0xffc79a,.5)),g); h.position.set(-2+i*1.1,1.25,(i%2-.5)*1.2);} return { group:g, phase:Math.random()*10, speed:.5+Math.random()*.5 }; }
const vehicles = [createBoat(34,-86,1), createBoat(-70,-310,1.3), createBoat(150,-170,.55)];

const actors: BiomeActor[] = [];
for (let i=0;i<42;i++){ const kind = i%17===0?'shark':i%11===0?'dolphinAlly':'fish'; const g = kind==='dolphinAlly'?createDolphin(0x8ac6d1):new THREE.Group(); if(kind!=='dolphinAlly'){ add(new THREE.Mesh(new THREE.CapsuleGeometry(kind==='shark'?0.28:.09, kind==='shark'?1.5:.45, 6, 10), mat(kind==='shark'?0x56616a:0xffcf5a,.5)), g); g.rotation.z=Math.PI/2; } g.position.set((Math.random()-.5)*180, -2-Math.random()*16, -80-Math.random()*620); g.scale.setScalar(kind==='fish'?.7+Math.random()*1.2:1); world.add(g); actors.push({group:g, velocity:new THREE.Vector3((Math.random()-.5)*2,0,-1-Math.random()*2), phase:Math.random()*6, kind}); }

const wakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .42 });
const wake = new THREE.Mesh(new THREE.RingGeometry(1.1, 2.4, 48), wakeMat); wake.rotation.x=-Math.PI/2; world.add(wake);

const hud = document.createElement('div'); hud.className='hud'; hud.innerHTML=`<div class="brand">DOLPHIN SOLAR ODYSSEY</div><div class="panel"><b>Prototype: cinematic dolphin simulator</b><p>Hold Space / touch to dive during descent. Release under water to convert momentum into a bigger breach.</p><div>combo <span id="combo">0</span> · best height <span id="height">0</span>m</div></div><div class="prompt" id="prompt">Swim toward the sunset. Chain perfect dives to reach ridiculous skyscraper heights.</div>`; document.body.appendChild(hud);
const comboEl=hud.querySelector('#combo')!; const heightEl=hud.querySelector('#height')!; const promptEl=hud.querySelector('#prompt')!;
function setHeld(v:boolean){ state.chargeHeld=v; }
addEventListener('keydown', e=>{ if(e.code==='Space') setHeld(true); if(e.key.toLowerCase()==='a') state.heading+=.08; if(e.key.toLowerCase()==='d') state.heading-=.08; });
addEventListener('keyup', e=>{ if(e.code==='Space') setHeld(false); });
renderer.domElement.addEventListener('pointerdown',()=>setHeld(true)); renderer.domElement.addEventListener('pointerup',()=>setHeld(false));

function animate(){ const dt=Math.min(clock.getDelta(),.033); const t=clock.elapsedTime; waterUniforms.time.value=t; state.velocity.z=-22- state.combo*1.6; state.velocity.x=Math.sin(state.heading)*18; if(state.chargeHeld && state.velocity.y<1){ state.diveCharge=Math.min(state.diveCharge+dt*(state.velocity.y<0?1.8:.7),2.7); state.velocity.y-=24*dt*(.35+state.diveCharge); }
 if(!state.chargeHeld && state.position.y<waterLevel-.25 && state.diveCharge>0){ const timing=THREE.MathUtils.clamp((-state.position.y)/7,0,1); const boost=(18+state.combo*3.2)*state.diveCharge*(.65+timing); state.velocity.y=Math.max(state.velocity.y, boost); state.combo += timing>.45?1:0; state.perfects += timing>.62?1:0; state.diveCharge=0; promptEl.textContent=timing>.62?'Perfect breach! keep the rhythm.':'Good release — dive deeper for more boost.'; }
 state.velocity.y += (state.position.y>waterLevel?-13:5.5)*dt; state.velocity.multiplyScalar(state.position.y<waterLevel?.997:.992); state.position.addScaledVector(state.velocity,dt); state.bestHeight=Math.max(state.bestHeight,state.position.y); if(state.position.y<-22){ state.position.y=-22; state.velocity.y=Math.abs(state.velocity.y)*.35; }
 dolphin.position.copy(state.position); dolphin.rotation.y=state.heading; dolphin.rotation.z=THREE.MathUtils.lerp(dolphin.rotation.z, -state.velocity.y*.018, .08); dolphin.rotation.x=Math.sin(t*8)*.04;
 wake.position.set(state.position.x, .03, state.position.z+2); wake.scale.setScalar(THREE.MathUtils.clamp(Math.abs(state.velocity.y)*.05+1,1,5)); wakeMat.opacity=state.position.y<.8?.36:0;
 vehicles.forEach(v=>{v.group.position.x+=Math.sin(t*.2+v.phase)*dt*v.speed; v.group.position.y=.35+Math.sin(t*1.6+v.phase)*.22; v.group.rotation.z=Math.sin(t*1.3+v.phase)*.04;});
 actors.forEach(a=>{a.group.position.addScaledVector(a.velocity,dt); a.group.position.x+=Math.sin(t+a.phase)*dt*2; a.group.rotation.y=Math.atan2(a.velocity.x,a.velocity.z)+Math.PI/2; if(a.group.position.z>state.position.z+90){a.group.position.z=state.position.z-650; a.group.position.x=state.position.x+(Math.random()-.5)*220;}});
 camera.position.lerp(state.position.clone().add(new THREE.Vector3(Math.sin(state.heading)*-10, 7+Math.max(state.position.y,0)*.28, 18)), .045); camera.lookAt(state.position.x, state.position.y+1.4, state.position.z-18); comboEl.textContent=String(state.combo); heightEl.textContent=String(Math.max(0,Math.round(state.bestHeight))); renderer.render(scene,camera); requestAnimationFrame(animate); }

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight);});
requestAnimationFrame(animate);
