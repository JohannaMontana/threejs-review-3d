import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camera, scene, renderer, controls, water, sun, stats, mixer;
let boat, character;
const clock = new THREE.Clock();
const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const manager = new THREE.LoadingManager();

const params = {
    asset: 'Swim',
    asset: 'SwimStop',
    asset: 'Death',
    asset: 'TreadingWater',
    asset: 'VeryDie',
    hemiLightIntensity: 5,
    dirLightIntensity: 70,
    fogDensity: 0.000
};

const assets = [
    'Samba Dancing', 
    'morph_test',
    'Swim', 
    'SwimStop', 
    'Death', 
    'VeryDie',
    'TreadingWater'
];

const TRASH_COUNT = 500;
let trashes = [];

class Boat {
    constructor() {
        gltfLoader.load("assets/boat/scene.gltf", (gltf) => {
            scene.add(gltf.scene);
            gltf.scene.scale.set(3, 3, 3);
            gltf.scene.position.set(5, 13, 50);
            gltf.scene.rotation.y = 1.5;

            this.boat = gltf.scene;
            this.speed = { vel: 0, rot: 0 };
        });
    }

    stop() {
        this.speed.vel = 0;
        this.speed.rot = 0;
    }

    update() {
        if (this.boat) {
            this.boat.rotation.y += this.speed.rot;
            this.boat.translateX(this.speed.vel);
        }
    }
}

class Character {
    constructor() {
        this.loadCharacter(params.asset);
        this.speed = { vel: 0, rot: 0 };
    }

    loadCharacter(asset) {
        fbxLoader.load(`models/fbx/${asset}.fbx`, (group) => {
            if (this.character) {
                scene.remove(this.character);
            }

            this.character = group;
            this.character.scale.set(0.05, 0.05, 0.05);
            this.character.position.set(10, -8, 53);

            group.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material.map) {
                        child.material.map.needsUpdate = true;
                    }
                }
            });

            if (this.character.animations && this.character.animations.length) {
                mixer = new THREE.AnimationMixer(this.character);
                const action = mixer.clipAction(this.character.animations[0]);
                action.play();
            } else {
                mixer = null;
            }

            scene.add(this.character);
        });
    }

    stop() {
        this.speed.vel = 0;
        this.speed.rot = 0;
    }

    update() {
        if (this.character) {
            this.character.rotation.y += this.speed.rot;
            this.character.translateZ(this.speed.vel);
        }
    }
}

class Trash {
    constructor(_scene) {
        scene.add(_scene);
        _scene.scale.set(1.5, 1.5, 1.5);
        _scene.position.set(random(-500, 500), 0, random(-1000, 1000));

        this.trash = _scene;
    }
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

async function loadModel(url) {
    return new Promise((resolve, reject) => {
        gltfLoader.load(url, (gltf) => {
            resolve(gltf.scene);
        }, undefined, reject);
    });
}

let trashModel = null;
async function createTrash() {
    if (!trashModel) {
        trashModel = await loadModel("assets/trash/scene.gltf");
    }
    return new Trash(trashModel.clone());
}

init();
animate();

async function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1A2130);
    scene.fog = new THREE.FogExp2(0x1A2130, params.fogDensity); // Updated fog type

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 20000);
    camera.position.set(30, 30, 100);

    sun = new THREE.Vector3();

    const hemiLight = new THREE.HemisphereLight(0x1679AB, 0x9BEC00, params.hemiLightIntensity);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0x850F8D, params.dirLightIntensity);
    dirLight.position.set(0, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    scene.add(dirLight);

    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    water = new Water(waterGeometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load('assets/waternormals.jpg', (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        }),
        sunDirection: new THREE.Vector3(),
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    });
    water.rotation.x = -Math.PI / 2;
    scene.add(water);

    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 10;
    skyUniforms['rayleigh'].value = 2;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    const parameters = { elevation: 2, azimuth: 180 };
    const pmremGenerator = new THREE.PMREMGenerator(renderer);

    function updateSun() {
        const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
        const theta = THREE.MathUtils.degToRad(parameters.azimuth);

        sun.setFromSphericalCoords(1, phi, theta);
        sky.material.uniforms['sunPosition'].value.copy(sun);
        water.material.uniforms['sunDirection'].value.copy(sun).normalize();
        scene.environment = pmremGenerator.fromScene(sky).texture;
    }

    updateSun();

    controls = new OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set(0, 10, 0);
    controls.minDistance = 40.0;
    controls.maxDistance = 200.0;
    controls.update();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    stats = new Stats();
    container.appendChild(stats.dom);

    const gui = new GUI();
    gui.add(params, 'asset', assets).onChange((value) => {
        character.loadCharacter(value);
    });
    gui.add(params, 'hemiLightIntensity', 0, 10).onChange((value) => {
        hemiLight.intensity = value;
    });
    gui.add(params, 'dirLightIntensity', 0, 100).onChange((value) => {
        dirLight.intensity = value;
    });
    gui.add(params, 'fogDensity', 0, 0.1).onChange((value) => {
        scene.fog.density = value;
    });

    boat = new Boat();
    character = new Character();

    for (let i = 0; i < TRASH_COUNT; i++) {
        const trash = await createTrash();
        trashes.push(trash);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(e) {
    switch (e.key) {
        case 'ArrowUp':
            boat.speed.vel = 1;
            break;
        case 'ArrowDown':
            boat.speed.vel = -1;
            break;
        case 'ArrowRight':
            boat.speed.rot = -0.1;
            break;
        case 'ArrowLeft':
            boat.speed.rot = 0.1;
            break;
        case 'w':
            character.speed.vel = 1;
            break;
        case 's':
            character.speed.vel = -1;
            break;
        case 'd':
            character.speed.rot = -0.1;
            break;
        case 'a':
            character.speed.rot = 0.1;
            break;
    }
}

function onKeyUp(e) {
    switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
            boat.stop();
            break;
        case 'ArrowRight':
        case 'ArrowLeft':
            boat.stop();
            break;
        case 'w':
        case 's':
            character.stop();
            break;
        case 'd':
        case 'a':
            character.stop();
            break;
    }
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    boat.update();
    character.update();
    checkCollisions();
    checkCharacterTrashCollisions();
    renderer.render(scene, camera);
    stats.update();
}

function isColliding(obj1, obj2) {
    return (
        Math.abs(obj1.position.x - obj2.position.x) < 15 &&
        Math.abs(obj1.position.z - obj2.position.z) < 15
    );
}

function checkCollisions() {
    if (boat.boat) {
        trashes.forEach(trash => {
            if (trash.trash) {
                if (isColliding(boat.boat, trash.trash)) {
                    scene.remove(trash.trash);
                }
            }
        });
    }
}

function checkCharacterTrashCollisions() {
    if (character.character) {
        trashes.forEach((trash, index) => {
            if (trash.trash) {
                if (isColliding(character.character, trash.trash)) {
                    scene.remove(trash.trash);
                    trashes.splice(index, 1); // Remove from array
                }
            }
        });
    }
}